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
  resolveQuantity,
  countInventoryItems
} from "./helpers.js";

function parseDimensions(metadata = {}) {
  const raw = metadata.dimensions || metadata.dimension || "";
  if (typeof raw === "string" && raw.includes("x")) {
    const parts = raw
      .split("x")
      .map(part => Number.parseInt(part.trim(), 10))
      .filter(num => Number.isFinite(num) && num > 0);
    if (parts.length === 3) {
      return { length: parts[0], width: parts[1], height: parts[2] };
    }
    if (parts.length === 2) {
      return {
        length: parts[0],
        width: parts[1],
        height: metadata.height ? resolveQuantity(metadata.height, null) : null
      };
    }
  }

  const length = resolveQuantity(metadata.length, null);
  const width = resolveQuantity(metadata.width, null);
  const height = resolveQuantity(metadata.height ?? metadata.floors, null);
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
  const blueprint = normalizeItemName(task?.metadata?.blueprint || task?.metadata?.structure || task.details);
  const targetDescription = describeTarget(task.target);
  const orientation = normalizeItemName(task?.metadata?.orientation || task?.metadata?.facing || "");
  const height = resolveQuantity(task?.metadata?.height ?? task?.metadata?.floors, null);
  const inventory = extractInventory(context);
  const dimensions = parseDimensions(task?.metadata);
  const targetElevation = resolveQuantity(task?.target?.y ?? task?.metadata?.terrainLevel, null);

  const blueprintReference =
    task?.metadata?.blueprintReference ||
    task?.metadata?.blueprintUrl ||
    task?.metadata?.blueprintFile ||
    task?.metadata?.schematicFile ||
    task?.metadata?.schematicPath ||
    null;
  const blueprintJson = task?.metadata?.blueprintJson || task?.metadata?.schematicData || null;
  const isSchematic =
    typeof blueprintReference === "string" && blueprintReference.toLowerCase().endsWith(".schem");
  const hasAutoImport = Boolean(isSchematic || blueprintJson);

  const floorArea = dimensions?.length && dimensions?.width ? dimensions.length * dimensions.width : null;
  const enclosedVolume = floorArea && (dimensions?.height || height)
    ? floorArea * (dimensions.height || height)
    : null;

  const materialRequirements = normalizeMaterials(task);
  const inventoryScan = materialRequirements.map(req => {
    const name = req?.name;
    if (!name || name === "unspecified item") {
      return {
        name,
        required: resolveQuantity(req?.count, null),
        available: 0,
        deficit: 0,
        missing: false,
        requirement: req
      };
    }
    const required = resolveQuantity(req?.count, null);
    const assumedRequirement = required ?? 1;
    const available = countInventoryItems(inventory, name);
    const deficit = Math.max(assumedRequirement - available, 0);
    return {
      name,
      required,
      available,
      deficit,
      missing: deficit > 0,
      requirement: req
    };
  });
  const missingMaterials = inventoryScan
    .filter(entry => entry.missing)
    .map(entry => ({
      ...entry.requirement,
      count: entry.deficit || entry.required || null
    }));

  const materialSummary = formatRequirementList(materialRequirements);
  const missingSummary = formatRequirementList(
    inventoryScan.filter(entry => entry.missing).map(entry => ({ name: entry.name, count: entry.deficit || entry.required }))
  );
  const blockCount = materialRequirements.reduce((total, req) => {
    const count = resolveQuantity(req.count, 0);
    return total + (count || 0);
  }, 0);

  const toolChecklist = [];
  const addTool = tool => {
    const normalized = normalizeItemName(tool);
    if (!normalized || normalized === "unspecified item") {
      return;
    }
    if (!toolChecklist.includes(normalized)) {
      toolChecklist.push(normalized);
    }
  };

  if (height && height > 6) {
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

  if (inventoryScan.length > 0) {
    const auditDescription = missingSummary
      ? `Inventory scan shows deficits: ${missingSummary}.`
      : "Inventory scan confirms all required materials are on hand.";
    steps.push(
      createStep({
        title: "Audit materials inventory",
        type: "analysis",
        description: auditDescription,
        metadata: {
          materials: inventoryScan.map(entry => ({
            name: entry.name,
            required: entry.required,
            available: entry.available,
            deficit: entry.deficit,
            missing: entry.missing
          }))
        }
      })
    );
  }

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

  if (hasAutoImport) {
    const importDescription = isSchematic
      ? `Import schematic file ${blueprintReference} and convert it into layer-by-layer placement instructions.`
      : "Process provided blueprint JSON into sequential construction steps.";
    steps.push(
      createStep({
        title: "Import schematic data",
        type: "planning",
        description: importDescription,
        metadata: {
          source: blueprintReference,
          format: isSchematic ? "schematic" : "json",
          autoGeneratedPlan: true
        }
      })
    );
  }

  if (blueprint || hasAutoImport) {
    const elevationDetail = targetElevation !== null
      ? `terrain elevation (${targetElevation})`
      : "current terrain elevation";
    steps.push(
      createStep({
        title: "Run blueprint integrity check",
        type: "validation",
        description: `Verify placement coordinates from the blueprint align with ${elevationDetail} before placing blocks.`,
        metadata: {
          elevation: targetElevation,
          reference: blueprintReference || blueprint,
          check: "terrain-alignment"
        }
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

  if (missingMaterials.length > 0) {
    steps.push(
      createStep({
        title: "Dispatch gather subtask",
        type: "delegation",
        description: `Spawn gathering teams to collect shortages: ${missingSummary}.`,
        metadata: {
          subtask: "gather",
          requirements: inventoryScan.filter(entry => entry.missing).map(entry => ({
            name: entry.name,
            needed: entry.deficit || entry.required || 1
          }))
        }
      })
    );
  }

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

  if (height && height > 6) {
    steps.push(
      createStep({
        title: "Place scaffolding",
        type: "safety",
        description: `Set up scaffolding and guard rails to safely build up to ${height} blocks high.`
      })
    );
  }

  const builderRoster = [];
  const addBuilderCandidate = candidate => {
    if (!candidate) {
      return;
    }
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed && !builderRoster.includes(trimmed)) {
        builderRoster.push(trimmed);
      }
      return;
    }
    if (typeof candidate === "object") {
      const name = candidate.name || candidate.id || candidate.label;
      if (name && !builderRoster.includes(name)) {
        builderRoster.push(name);
      }
    }
  };

  if (Array.isArray(context?.builders)) {
    context.builders.forEach(addBuilderCandidate);
  }
  if (Array.isArray(context?.availableBuilders)) {
    context.availableBuilders.forEach(addBuilderCandidate);
  }
  if (Array.isArray(context?.team)) {
    context.team.forEach(addBuilderCandidate);
  }
  if (Array.isArray(context?.crew)) {
    context.crew.forEach(addBuilderCandidate);
  }
  if (Array.isArray(task?.metadata?.assignedBuilders)) {
    task.metadata.assignedBuilders.forEach(addBuilderCandidate);
  }
  if (context?.npc?.name) {
    addBuilderCandidate(context.npc.name);
  }

  const isLargeStructure =
    blockCount > 512 ||
    (floorArea && floorArea >= 400) ||
    (height && height >= 10) ||
    (dimensions?.height && dimensions.height >= 10);

  if (isLargeStructure) {
    const sliceBase = Math.max(2, Math.ceil((blockCount || 400) / 400));
    const sliceCount = builderRoster.length > 0 ? Math.min(builderRoster.length, sliceBase) : sliceBase;
    const assignments = [];
    for (let i = 0; i < sliceCount; i += 1) {
      const builder = builderRoster.length > 0 ? builderRoster[i % builderRoster.length] : null;
      assignments.push({
        slice: `Region slice ${i + 1}`,
        assignedTo: builder
      });
    }

    steps.push(
      createStep({
        title: "Coordinate collaborative build",
        type: "coordination",
        description:
          builderRoster.length > 0
            ? `Divide the blueprint into ${sliceCount} slices and assign them to ${builderRoster.join(", ")}.`
            : `Divide the blueprint into ${sliceCount} slices and assign available NPC builders to each region.`,
        metadata: {
          collaborative: true,
          assignments,
          participants: builderRoster
        }
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
        .filter(name => name && name !== "unspecified item")
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
  if (height && height > 6) {
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

  const volumeWeight = enclosedVolume && enclosedVolume > 0 ? enclosedVolume * 5 : 0;
  const estimatedDuration = 14000 + blockCount * 90 + (height && height > 10 ? 4000 : 0) + volumeWeight;

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
  if (missingMaterials.length > 0) {
    notes.push(`Gathering required for materials: ${missingSummary}.`);
  }
  if (isLargeStructure) {
    notes.push("Coordinate NPC builders to work in parallel on assigned slices.");
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
