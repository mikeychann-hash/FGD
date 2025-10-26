// tasks/plan_build.js
// Planning logic for construction tasks

import {
  createPlan,
  createStep,
  describeTarget,
  normalizeItemName,
  extractInventory,
  hasInventoryItem,
  formatRequirementList,
  resolveQuantity
} from "./helpers.js";

// Build estimation constants
const BUILD_TIME_BASE = 14000;  // Base construction time (ms)
const BUILD_TIME_PER_BLOCK = 90;  // Additional time per block (ms)
const BUILD_TIME_TALL_STRUCTURE = 4000;  // Extra time for tall builds (ms)
const TALL_STRUCTURE_THRESHOLD = 10;  // Height threshold for tall structures (blocks)
const VOLUME_TIME_MULTIPLIER = 5;  // Time multiplier for enclosed volume
const SCAFFOLDING_HEIGHT_THRESHOLD = 6;  // Minimum height requiring scaffolding (blocks)
const UNSPECIFIED_ITEM_NAME = "unspecified item";  // Constant for unspecified items

function parseDimensions(metadata = {}) {
  const raw = metadata.dimensions || metadata.dimension || "";
  if (typeof raw === "string" && raw.includes("x")) {
    const parts = raw
      .split("x")
      .map(part => Number.parseInt(part.trim(), 10))
      .filter(num => Number.isFinite(num) && num > 0);

    // Validate that we have valid positive dimensions
    if (parts.some(dim => dim <= 0)) {
      return null;  // Reject non-positive dimensions
    }

    if (parts.length === 3) {
      return { length: parts[0], width: parts[1], height: parts[2] };
    }
    if (parts.length === 2) {
      const parsedHeight = metadata.height ? resolveQuantity(metadata.height, null) : null;
      // Validate height if present
      if (parsedHeight !== null && parsedHeight < 0) {
        return null;
      }
      return {
        length: parts[0],
        width: parts[1],
        height: parsedHeight
      };
    }
  }

  const length = resolveQuantity(metadata.length, null);
  const width = resolveQuantity(metadata.width, null);
  const height = resolveQuantity(metadata.height ?? metadata.floors, null);

  // Validate individual dimensions - reject negative values
  if (length !== null && length <= 0) return null;
  if (width !== null && width <= 0) return null;
  if (height !== null && height < 0) return null;  // Allow 0 height for flat structures

  if (length && width) {
    return { length, width, height };
  }
  return null;
}

function normalizeMaterials(task) {
  const explicit = Array.isArray(task?.metadata?.materials) ? task?.metadata?.materials : [];
  const quantities = task?.metadata?.materialQuantities || task?.metadata?.materialCounts || {};
  const normalized = explicit
    .map(entry => {
      if (typeof entry === "string") {
        return {
          name: normalizeItemName(entry),
          count: resolveQuantity(quantities[entry], null)
        };
      }
      if (entry && typeof entry === "object") {
        const name = normalizeItemName(entry.name || entry.item);
        const count = resolveQuantity(entry.count ?? entry.quantity, null);
        return { name, count };
      }
      return null;
    })
    .filter(Boolean);

  if (normalized.length > 0) {
    return normalized;
  }

  const fallback = normalizeItemName(task?.metadata?.primaryMaterial || task?.details || "building blocks");
  const fallbackCount = resolveQuantity(task?.metadata?.quantity ?? task?.metadata?.blocks, null);
  return [{ name: fallback, count: fallbackCount }];
}

export function planBuildTask(task, context = {}) {
  // Validate input task
  if (!task || typeof task !== 'object') {
    throw new Error('Invalid task: task must be a non-null object');
  }

  const blueprint = normalizeItemName(task?.metadata?.blueprint || task?.metadata?.structure || task.details);
  const targetDescription = describeTarget(task.target);
  const orientation = normalizeItemName(task?.metadata?.orientation || task?.metadata?.facing || "");
  const height = resolveQuantity(task?.metadata?.height ?? task?.metadata?.floors, null);
  const inventory = extractInventory(context);
  const dimensions = parseDimensions(task?.metadata);

  const floorArea = dimensions?.length && dimensions?.width ? dimensions.length * dimensions.width : null;
  const enclosedVolume = floorArea && (dimensions?.height || height)
    ? floorArea * (dimensions.height || height)
    : null;

  const materialRequirements = normalizeMaterials(task);
  const missingMaterials = materialRequirements.filter(req => {
    if (!req?.name || req.name === UNSPECIFIED_ITEM_NAME) {
      return false;
    }
    if (req.count && req.count > 0) {
      return !hasInventoryItem(inventory, req.name, req.count);
    }
    return !hasInventoryItem(inventory, req.name, 1);
  });

  const materialSummary = formatRequirementList(materialRequirements);
  const missingSummary = formatRequirementList(missingMaterials);
  const blockCount = materialRequirements.reduce((total, req) => {
    const count = resolveQuantity(req.count, 0);
    return total + (count || 0);
  }, 0);

  const toolChecklist = [];
  const addTool = tool => {
    const normalized = normalizeItemName(tool);
    if (!normalized || normalized === UNSPECIFIED_ITEM_NAME) {
      return;
    }
    if (!toolChecklist.includes(normalized)) {
      toolChecklist.push(normalized);
    }
  };

  if (height && height > SCAFFOLDING_HEIGHT_THRESHOLD) {
    addTool("scaffolding");
  }
  if (task?.metadata?.terrain === "rocky" || task?.metadata?.foundation === "stone") {
    addTool("pickaxe");
  }
  if (task?.metadata?.terrain === "forest" || task?.metadata?.clearTrees) {
    addTool("axe");
  }
  if (task?.metadata?.terrain === "sand" || task?.metadata?.levelGround) {
    addTool("shovel");
  }
  if (task?.metadata?.includesRedstone) {
    addTool("redstone toolkit");
  }
  if (task?.metadata?.lighting || task?.metadata?.buildAtNight) {
    addTool("torches");
  }

  const missingTools = toolChecklist.filter(tool => !hasInventoryItem(inventory, tool, 1));

  const steps = [];

  if (toolChecklist.length > 0) {
    const toolDescription = missingTools.length
      ? `Gather tools before departure: ${formatRequirementList(missingTools.map(name => ({ name })))}.`
      : `Confirm required tools are on hand: ${formatRequirementList(toolChecklist.map(name => ({ name })))}.`;
    steps.push(
      createStep({
        title: missingTools.length > 0 ? "Prepare tools" : "Verify tools",
        type: "inventory",
        description: toolDescription,
        metadata: { required: toolChecklist, missing: missingTools }
      })
    );
  }

  if (task?.metadata?.blueprintUrl || task?.metadata?.blueprintReference) {
    const reference =
      task?.metadata?.blueprintReference || task?.metadata?.blueprintUrl || blueprint || "structure";
    steps.push(
      createStep({
        title: "Review blueprint",
        type: "planning",
        description: `Load ${reference} and verify dimensions before construction begins.`
      })
    );
  }

  const verifyDescription = materialSummary
    ? `Confirm required materials are ready: ${materialSummary}.`
    : "Confirm required materials are ready for the build.";
  const restockDescription = missingSummary
    ? `Obtain missing resources: ${missingSummary}. Stage extras near the build site.`
    : "Obtain missing resources before heading to the site.";

  steps.push(
    createStep({
      title: missingMaterials.length > 0 ? "Restock materials" : "Verify materials",
      type: "inventory",
      description: missingMaterials.length > 0 ? restockDescription : verifyDescription,
      metadata: { materials: materialRequirements, missing: missingMaterials }
    })
  );

  const surveyDescription = orientation
    ? `Inspect ${targetDescription} to ensure the area is clear, mark foundation corners, and align the main entrance toward ${orientation}.`
    : `Inspect ${targetDescription} to ensure the area is clear for building and mark foundation corners.`;

  steps.push(
    createStep({
      title: "Survey site",
      type: "planning",
      description: surveyDescription
    })
  );

  if (task?.metadata?.terrain === "uneven" || task?.metadata?.levelGround) {
    steps.push(
      createStep({
        title: "Prepare terrain",
        type: "preparation",
        description: `Clear vegetation and level ground to support the ${blueprint} footprint.`
      })
    );
  }

  steps.push(
    createStep({
      title: "Stage materials",
      type: "collection",
      description: `Move materials on-site, placing staging chests or shulker boxes for ${blueprint}.`,
      metadata: { materials: materialRequirements }
    })
  );

  if (task?.metadata?.perimeter || task?.metadata?.threatLevel === "high") {
    steps.push(
      createStep({
        title: "Secure perimeter",
        type: "safety",
        description: "Place perimeter lighting and temporary barricades to prevent mob interference during construction.",
        metadata: { recommended: ["torches", "fences"] }
      })
    );
  }

  steps.push(
    createStep({
      title: "Lay foundation",
      type: "construction",
      description: `Outline the ${blueprint} footprint and reinforce the base with durable blocks.`
    })
  );

  if (height && height > SCAFFOLDING_HEIGHT_THRESHOLD) {
    steps.push(
      createStep({
        title: "Place scaffolding",
        type: "safety",
        description: `Set up scaffolding and guard rails to safely build up to ${height} blocks high.`
      })
    );
  }

  steps.push(
    createStep({
      title: "Assemble structure",
      type: "construction",
      description: `Build the ${blueprint} layer by layer, checking alignment with the blueprint after each level.`
    })
  );

  if (task?.metadata?.roofStyle || task?.metadata?.requiresRoof) {
    steps.push(
      createStep({
        title: "Install roof",
        type: "construction",
        description: `Shape the roof using the ${task?.metadata?.roofStyle || "specified"} style, ensuring overhangs and lighting prevent mob spawns.`
      })
    );
  }

  if (task?.metadata?.includesRedstone) {
    steps.push(
      createStep({
        title: "Install redstone",
        type: "automation",
        description: `Wire redstone components and test circuits before sealing access panels.`
      })
    );
  }

  steps.push(
    createStep({
      title: "Finish and inspect",
      type: "inspection",
      description: `Add lighting, doors, and final touches, then verify the structure matches the blueprint and meets safety checks.`
    })
  );

  if (task?.metadata?.interior !== false) {
    steps.push(
      createStep({
        title: "Outfit interior",
        type: "decoration",
        description: "Place furnishings, storage, and lighting, verifying accessibility and spawn-proofing inside the structure."
      })
    );
  }

  if (task?.metadata?.cleanup !== false) {
    steps.push(
      createStep({
        title: "Cleanup site",
        type: "cleanup",
        description: `Remove scaffolding, excess materials, and restore surrounding terrain.`
      })
    );
  }

  const resources = [
    ...new Set(
      materialRequirements
        .map(req => req.name)
        .filter(name => name && name !== UNSPECIFIED_ITEM_NAME)
    )
  ];
  if (toolChecklist.length > 0) {
    for (const tool of toolChecklist) {
      if (!resources.includes(tool)) {
        resources.push(tool);
      }
    }
  }
  const risks = [];
  if (height && height > SCAFFOLDING_HEIGHT_THRESHOLD) {
    risks.push("Elevated work area increases fall damage risk.");
  }
  if (task?.metadata?.environment === "nether") {
    risks.push("Building in the Nether requires fire resistance and ghast-proofing.");
  }
  if (task?.metadata?.weather === "stormy") {
    risks.push("Stormy weather may cause lightning strikes; add lightning rods and shelter.");
  }
  if (task?.metadata?.threatLevel === "high") {
    risks.push("Hostile mobs likely to interrupt construction; maintain perimeter defenses.");
  }
  if (floorArea && floorArea > 0) {
    risks.push(`Large footprint (~${floorArea} blocks) increases build time and supply demand.`);
  }

  const volumeWeight = enclosedVolume && enclosedVolume > 0 ? enclosedVolume * VOLUME_TIME_MULTIPLIER : 0;
  const estimatedDuration =
    BUILD_TIME_BASE +
    blockCount * BUILD_TIME_PER_BLOCK +
    (height && height > TALL_STRUCTURE_THRESHOLD ? BUILD_TIME_TALL_STRUCTURE : 0) +
    volumeWeight;

  const notes = [];
  if (orientation) {
    notes.push(`Align entrance toward ${orientation}.`);
  }
  if (task?.metadata?.deadline) {
    notes.push(`Requested completion before ${task?.metadata?.deadline}.`);
  }
  if (floorArea) {
    notes.push(`Estimated footprint area: ${floorArea} blocks.`);
  }
  if (enclosedVolume) {
    notes.push(`Approximate enclosed volume: ${enclosedVolume} blocks.`);
  }
  if (missingTools.length > 0) {
    notes.push(`Acquire missing tools: ${formatRequirementList(missingTools.map(name => ({ name })))}.`);
  }

  return createPlan({
    task,
    summary: `Construct ${blueprint} at ${targetDescription}.`,
    steps,
    estimatedDuration,
    resources,
    risks,
    notes
  });
}
