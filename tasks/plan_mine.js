// tasks/plan_mine.js
// Generates a sequence for mining style tasks

import {
  createPlan,
  createStep,
  describeTarget,
  normalizeItemName,
  extractInventory,
  hasInventoryItem,
  countInventoryItems,
  formatRequirementList,
  resolveQuantity,
  extractEnvironmentalSignals,
  resolveToolIntegrity
} from "./helpers.js";

const DEFAULT_SUPPORT_SUPPLIES = [
  { name: "torch", count: 32 },
  { name: "wood", count: 16 },
  { name: "food", count: 8 }
];

const MINING_STYLES = Object.freeze([
  {
    id: "strip",
    label: "strip mine",
    synonyms: ["strip", "strip mine", "branch", "branch mine", "grid"],
    method: "branch",
    description: "Carve long horizontal corridors with evenly spaced branches for broad coverage of ore veins.",
    rationale: "Efficient for harvesting large volumes within a single depth layer.",
    recommendedSupplies: ["rails", "chest"],
    risk: "Long corridors may spawn mobs if left unlit.",
    durationModifier: 2500
  },
  {
    id: "staircase",
    label: "staircase",
    synonyms: ["staircase", "stair", "stair mine", "incline"],
    method: "staircase",
    description: "Dig a descending stair pattern that exposes new layers while maintaining a safe ascent route.",
    rationale: "Balanced approach for discovering new depths with safe retreat access.",
    recommendedSupplies: ["ladders", "torches"],
    risk: "Open stairwells can collect mobs if not sealed.",
    durationModifier: 1500
  },
  {
    id: "quarry",
    label: "quarry",
    synonyms: ["quarry", "pit", "open pit"],
    method: "quarry",
    description: "Clear large surface layers in a square or circular pattern, moving downward layer by layer.",
    rationale: "Ideal for surface-level bulk extraction and structured excavation projects.",
    recommendedSupplies: ["scaffolding", "storage chest"],
    risk: "Open pits increase fall hazards; perimeter must be secured.",
    durationModifier: 3000
  },
  {
    id: "vertical shaft",
    label: "vertical shaft",
    synonyms: ["vertical", "shaft", "drop shaft", "ladder shaft"],
    method: "shaft",
    description: "Sink a narrow shaft straight down with ladders or bubbles for rapid access to deep layers.",
    rationale: "Fastest way to reach deep ores when surface time is limited.",
    recommendedSupplies: ["ladders", "water bucket"],
    risk: "Falling or lava breakthroughs pose high danger without safety stops.",
    durationModifier: 1800
  }
]);

const MINING_STYLE_LOOKUP = new Map();
for (const style of MINING_STYLES) {
  const keys = new Set([style.id, style.label, ...(style.synonyms || [])]);
  for (const key of keys) {
    const normalized = normalizeItemName(key);
    if (normalized && normalized !== "unspecified item" && !MINING_STYLE_LOOKUP.has(normalized)) {
      MINING_STYLE_LOOKUP.set(normalized, style);
    }
  }
}

const MINING_STYLE_OPTIONS = MINING_STYLES.map(style => ({
  id: style.id,
  label: style.label,
  description: style.description
}));

function determineMiningStyle({
  task,
  context,
  methodHint,
  depth,
  quantity,
  hazards
}) {
  const styleHintRaw =
    task?.metadata?.style ||
    task?.metadata?.pattern ||
    task?.metadata?.layout ||
    context?.preferences?.mineStyle ||
    context?.preferences?.miningStyle ||
    context?.mineStyle ||
    context?.strategy?.miningStyle;

  const normalizedStyleHint = styleHintRaw ? normalizeItemName(styleHintRaw) : null;
  const normalizedMethod = methodHint ? normalizeItemName(methodHint) : null;

  let chosenStyle = normalizedStyleHint ? MINING_STYLE_LOOKUP.get(normalizedStyleHint) : null;
  let source = chosenStyle ? "task" : null;

  if (!chosenStyle && normalizedMethod) {
    chosenStyle = MINING_STYLE_LOOKUP.get(normalizedMethod) || null;
    if (chosenStyle) {
      source = "method";
    }
  }

  if (!chosenStyle) {
    const contextHint = context?.desiredStyle || context?.environment?.mineStyle;
    const normalizedContextHint = contextHint ? normalizeItemName(contextHint) : null;
    if (normalizedContextHint) {
      chosenStyle = MINING_STYLE_LOOKUP.get(normalizedContextHint) || null;
      if (chosenStyle) {
        source = "context";
      }
    }
  }

  const reasons = [];
  const hazardSet = new Set((hazards || []).map(normalizeItemName));

  if (!chosenStyle && typeof quantity === "number" && quantity >= 192) {
    chosenStyle = MINING_STYLE_LOOKUP.get("strip mine");
    if (chosenStyle) {
      source = "autonomy";
      reasons.push(`Large quota (${quantity}) benefits from strip mining coverage.`);
    }
  }

  if (!chosenStyle && typeof depth === "number") {
    if (depth <= 16) {
      chosenStyle = MINING_STYLE_LOOKUP.get("vertical shaft");
      if (chosenStyle) {
        source = "autonomy";
        reasons.push(`Deep target level (Y${depth}) favors a vertical shaft for speed.`);
      }
    } else if (depth < 40) {
      chosenStyle = MINING_STYLE_LOOKUP.get("staircase");
      if (chosenStyle) {
        source = "autonomy";
        reasons.push(`Moderate depth (Y${depth}) supports a staircase descent.`);
      }
    }
  }

  if (!chosenStyle && (hazardSet.has("surface") || hazardSet.has("ravine") || hazardSet.has("open pit"))) {
    chosenStyle = MINING_STYLE_LOOKUP.get("quarry");
    if (chosenStyle) {
      source = "autonomy";
      reasons.push("Surface exposure suggests an open quarry approach.");
    }
  }

  if (!chosenStyle && (hazardSet.has("gravel") || hazardSet.has("sand"))) {
    chosenStyle = MINING_STYLE_LOOKUP.get("staircase");
    if (chosenStyle) {
      source = "autonomy";
      reasons.push("Loose gravel hazards call for a controlled staircase dig.");
    }
  }

  if (!chosenStyle) {
    chosenStyle = MINING_STYLE_LOOKUP.get("staircase") || MINING_STYLES[0];
    if (!source) {
      source = "default";
    }
    if (reasons.length === 0) {
      reasons.push("Defaulting to staircase for balanced access and safety.");
    }
  }

  const method = chosenStyle.method || normalizedMethod || "branch";
  const rationale = reasons.join(" ") || chosenStyle.rationale || "";

  return {
    ...chosenStyle,
    method,
    rationale,
    source
  };
}

function determineSupportSupplies(task) {
  const extras = Array.isArray(task?.metadata?.supplies) ? task.metadata.supplies : [];
  const normalizedExtras = extras
    .map(item => {
      if (typeof item === "string") {
        return { name: normalizeItemName(item) };
      }
      if (item && typeof item === "object") {
        return {
          name: normalizeItemName(item.name || item.item),
          count: resolveQuantity(item.count ?? item.quantity, null)
        };
      }
      return null;
    })
    .filter(Boolean);

  return [...DEFAULT_SUPPORT_SUPPLIES, ...normalizedExtras];
}

export function planMineTask(task, context = {}) {
  const targetDescription = describeTarget(task.target);
  const resource = normalizeItemName(task?.metadata?.resource || task?.metadata?.ore || task.details);
  const tool = normalizeItemName(task?.metadata?.tool || "pickaxe");
  const backupTool = normalizeItemName(task?.metadata?.backupTool || task?.metadata?.secondaryTool || "");
  const dropOff = task?.metadata?.dropOff ? normalizeItemName(task.metadata.dropOff) : null;
  const quantity = resolveQuantity(task?.metadata?.quantity ?? task?.metadata?.count, null);
  const depth = resolveQuantity(task?.metadata?.depth ?? task?.metadata?.yLevel, null);
  const hazards = Array.isArray(task?.metadata?.hazards) ? task.metadata.hazards.map(normalizeItemName) : [];
  const miningMethodHint = normalizeItemName(task?.metadata?.method || "branch");
  const reinforcements = Array.isArray(task?.metadata?.reinforcements)
    ? task.metadata.reinforcements.map(item => {
        if (typeof item === "string") {
          return { name: normalizeItemName(item) };
        }
        if (item && typeof item === "object") {
          return {
            name: normalizeItemName(item.name || item.item),
            count: resolveQuantity(item.count ?? item.quantity, null)
          };
        }
        return null;
      }).filter(Boolean)
    : [];
  const anchorPoint = task?.metadata?.anchorPoint || task?.metadata?.respawnAnchor;
  const escort = task?.metadata?.escort;

  const inventory = extractInventory(context);
  const supportSupplies = determineSupportSupplies(task);
  const signals = extractEnvironmentalSignals(context);
  const miningStyle = determineMiningStyle({
    task,
    context,
    methodHint: miningMethodHint,
    depth,
    quantity,
    hazards
  });
  const miningMethod = miningStyle.method || miningMethodHint;
  const toolIntegrity = resolveToolIntegrity(tool, context);
  const backupToolIntegrity = backupTool ? resolveToolIntegrity(backupTool, context) : null;
  const missingSupport = supportSupplies.filter(item => {
    if (!item?.name) {
      return false;
    }
    if (item.count) {
      return !hasInventoryItem(inventory, item.name, item.count);
    }
    return !hasInventoryItem(inventory, item.name, 1);
  });

  const hasPrimaryTool = hasInventoryItem(inventory, tool);
  const hasBackupTool = backupTool ? hasInventoryItem(inventory, backupTool) : true;
  const durabilitySuffix = toolIntegrity?.percent !== null
    ? ` (~${Math.round(toolIntegrity.percent * 100)}% durability)`
    : toolIntegrity?.durability !== null
    ? ` (${toolIntegrity.durability} durability remaining)`
    : "";
  const toolStepDescription = toolIntegrity?.broken
    ? `Primary ${tool} is marked as broken; coordinate a replacement immediately before entering the mine.`
    : hasPrimaryTool
    ? `Inspect ${tool}${durabilitySuffix} and equip it before entering the mine.`
    : `Retrieve or craft a suitable ${tool} before entering the mine.`;

  const steps = [];

  const missingSupportSummary = formatRequirementList(missingSupport);
  const supportSummary = formatRequirementList(supportSupplies) || "support supplies";

  steps.push(
    createStep({
      title: "Stock supplies",
      type: "inventory",
      description:
        missingSupport.length > 0
          ? missingSupportSummary
            ? `Restock essential supplies (${missingSupportSummary}).`
            : "Restock essential supplies before descending."
          : `Confirm support supplies are packed: ${supportSummary}.`,
      metadata: { supplies: supportSupplies, missing: missingSupport }
    })
  );

  if (reinforcements.length > 0) {
    const reinforcementSummary = formatRequirementList(reinforcements) || "reinforcement blocks";
    steps.push(
      createStep({
        title: "Stage reinforcements",
        type: "preparation",
        description: `Pack building blocks for shoring: ${reinforcementSummary}.`,
        metadata: { reinforcements }
      })
    );
  }

  steps.push(
    createStep({
      title: "Gear check",
      type: "preparation",
      description: toolStepDescription,
      metadata: {
        tool,
        backupTool: backupTool || undefined
      }
    })
  );

  if (toolIntegrity?.broken) {
    steps.push(
      createStep({
        title: "Replace primary tool",
        type: "crafting",
        description: `Tool monitoring flagged the ${tool} as broken. Craft or retrieve a replacement before proceeding underground.`,
        metadata: {
          tool,
          trigger: "durability_zero",
          origin: toolIntegrity.origin || undefined,
          autoCraft: true
        }
      })
    );
  } else if (toolIntegrity?.percent !== null && toolIntegrity.percent < 0.2) {
    steps.push(
      createStep({
        title: "Stage backup tool",
        type: "preparation",
        description: `Primary ${tool} durability is low (~${Math.round(toolIntegrity.percent * 100)}%). Stage materials or a backup before descent.`,
        metadata: {
          tool,
          durability: toolIntegrity.percent
        }
      })
    );
  }

  if (backupTool && backupToolIntegrity?.broken) {
    steps.push(
      createStep({
        title: "Restore backup tool",
        type: "crafting",
        description: `Backup ${backupTool} is unavailable; craft or retrieve a replacement to cover failures mid-run.`,
        metadata: {
          tool: backupTool,
          trigger: "backup_tool_broken",
          origin: backupToolIntegrity.origin || undefined
        }
      })
    );
  }

  steps.push(
    createStep({
      title: "Select mining style",
      type: "planning",
      description: `Default to the ${miningStyle.label} pattern${miningStyle.rationale ? ` — ${miningStyle.rationale}` : ""}. Confirm with players if a different style is requested.`,
      metadata: {
        style: miningStyle.id,
        method: miningMethod,
        rationale: miningStyle.rationale || undefined,
        selectionSource: miningStyle.source,
        options: MINING_STYLE_OPTIONS
      }
    })
  );

  if (signals.lowLight) {
    steps.push(
      createStep({
        title: "Stabilize lighting",
        type: "safety",
        description: `Bridge detected low light${signals.lightLevel !== null ? ` (level ${signals.lightLevel})` : ""}; place torches every few blocks before digging deeper.`,
        command: "place_torches",
        metadata: {
          trigger: "low_light",
          lightLevel: signals.lightLevel || undefined
        }
      })
    );
  }

  steps.push(
    createStep({
      title: "Navigate",
      type: "movement",
      description: `Travel to ${targetDescription} using safe pathing and align the entrance with the ${miningStyle.label} layout.`
    })
  );

  if (anchorPoint || hasInventoryItem(inventory, "bed")) {
    steps.push(
      createStep({
        title: "Secure exit",
        type: "safety",
        description: anchorPoint
          ? `Set spawn or anchor at ${anchorPoint} and mark a clear return path.`
          : "Place a temporary bed near the mine entrance and mark the route back.",
        metadata: { anchor: anchorPoint || (hasInventoryItem(inventory, "bed") ? "bed" : undefined) }
      })
    );
  }

  if (escort) {
    steps.push(
      createStep({
        title: "Coordinate escort",
        type: "coordination",
        description: `Meet with ${escort} before descent and assign overwatch positions.`,
        metadata: { escort }
      })
    );
  }

  if (depth && depth < 20) {
    steps.push(
      createStep({
        title: "Stabilize shaft",
        type: "safety",
        description: `Install support beams and ladder access while descending to Y${depth}.`
      })
    );
  }

  const lavaThreat = signals.lava || hazards.includes("lava") || hazards.includes("lava pool");
  if (lavaThreat) {
    steps.push(
      createStep({
        title: "Lava contingency",
        type: "safety",
        description: signals.lava
          ? "Bridge detected active lava nearby. Deploy water or non-flammable blocks immediately and retreat if containment fails."
          : "Carry a water bucket or fire resistance potion and block off exposed lava before mining.",
        command: "retreat",
        metadata: {
          trigger: signals.lava ? "lava_detected" : "lava_expected",
          recommended: ["water bucket", "non-flammable blocks"]
        }
      })
    );
  }

  const gravelThreat = signals.gravel || hazards.includes("gravel") || hazards.includes("gravel pocket");
  if (gravelThreat) {
    steps.push(
      createStep({
        title: "Gravel collapse plan",
        type: "safety",
        description: signals.gravel
          ? "Bridge detected unstable gravel overhead; brace ceilings, dig from the top down, and retreat if collapse begins."
          : "Expect gravel pockets; brace ceilings and dig from above to prevent suffocation.",
        command: signals.gravel ? "retreat" : null,
        metadata: {
          trigger: signals.gravel ? "gravel_detected" : "gravel_expected"
        }
      })
    );
  }

  const miningDescription = quantity
    ? `Mine approximately ${quantity} blocks of ${resource} using the ${miningStyle.label} pattern (${miningMethod}).`
    : `Mine the ${resource} following the ${miningStyle.label} pattern (${miningMethod}), reinforcing ceilings and sealing hazards.`;

  steps.push(
    createStep({
      title: "Mine",
      type: "action",
      description: miningDescription,
      metadata: { method: miningMethod, quantity, style: miningStyle.id }
    })
  );

  if (reinforcements.length > 0) {
    steps.push(
      createStep({
        title: "Shore tunnels",
        type: "safety",
        description: "Place reinforcement blocks along long corridors and above exposed ceilings as you mine.",
        metadata: { reinforcements }
      })
    );
  }

  if (task?.metadata?.requiresSilkTouch) {
    steps.push(
      createStep({
        title: "Apply silk touch",
        type: "quality",
        description: `Use a silk touch tool on ${resource} blocks that should stay intact.`
      })
    );
  }

  steps.push(
    createStep({
      title: "Collect drops",
      type: "collection",
      description: `Collect the dropped items and ensure inventory space for ${resource}.`
    })
  );

  const oreCount = countInventoryItems(inventory, resource);
  const shouldSmelt = task?.metadata?.autoSmelt || resource.includes("ore");

  if (shouldSmelt) {
    steps.push(
      createStep({
        title: "Process ore",
        type: "processing",
        description: `Smelt or blast ${resource} at a furnace array before storage if time allows.`,
        metadata: { smelt: true }
      })
    );
  }

  if (dropOff) {
    steps.push(
      createStep({
        title: "Store resources",
        type: "storage",
        description: `Deliver the mined ${resource} to the ${dropOff} and tidy the mining shaft for future runs.`,
        metadata: { container: dropOff }
      })
    );
  }

  steps.push(
    createStep({
      title: "Log findings",
      type: "report",
      description: `Report yields (${oreCount} currently on hand) and note any hazards or new branches discovered.`
    })
  );

  const estimatedDuration = 11000 + (quantity ? quantity * 500 : 4000) + (miningStyle.durationModifier || 0);
  const resources = [resource, tool]
    .concat(supportSupplies.map(item => item.name))
    .concat(reinforcements.map(item => item.name))
    .concat(miningStyle.recommendedSupplies || [])
    .filter(Boolean);
  const uniqueResources = [...new Set(resources.filter(name => name && name !== "unspecified item"))];

  const risks = [];
  if (hazards.includes("cave")) {
    risks.push("Unlit caves may spawn hostile mobs.");
  }
  if (hazards.includes("gravel")) {
    risks.push("Falling gravel or sand could suffocate the miner.");
  }
  if (signals.lowLight) {
    risks.push("Low light flagged by the bridge could allow hostile mobs to spawn.");
  }
  if (signals.lava) {
    risks.push("Active lava detected; ensure retreat routes remain clear.");
  }
  if (signals.gravel) {
    risks.push("Detected loose gravel overhead may collapse unexpectedly.");
  }
  if (!hasBackupTool && backupTool) {
    risks.push(`No functional backup ${backupTool} is available if the primary breaks.`);
  }
  if (toolIntegrity?.broken) {
    risks.push(`Primary ${tool} is currently unusable and must be replaced.`);
  } else if (toolIntegrity?.percent !== null && toolIntegrity.percent < 0.2) {
    risks.push(`Primary ${tool} durability is low (~${Math.round(toolIntegrity.percent * 100)}%).`);
  }
  if (backupTool && backupToolIntegrity?.broken) {
    risks.push(`Backup ${backupTool} is broken; there is no redundancy if the primary fails.`);
  }
  if (reinforcements.length === 0 && (hazards.includes("ravine") || hazards.includes("unstable ceiling"))) {
    risks.push("Lack of reinforcement blocks increases collapse risk.");
  }
  if (miningStyle.risk) {
    risks.push(miningStyle.risk);
  }

  const notes = [];
  if (task?.metadata?.beacon) {
    notes.push(`Activate haste beacon at ${task.metadata.beacon}.`);
  }
  if (task?.metadata?.chunkBoundary) {
    notes.push(`Stay within chunk ${task.metadata.chunkBoundary} to avoid missing the lode.`);
  }
  if (reinforcements.length > 0) {
    notes.push("Use staged reinforcements to seal side tunnels once depleted.");
  }
  if (escort) {
    notes.push(`Escort ${escort} provides backup; maintain line-of-sight while mining.`);
  }
  if (miningStyle) {
    notes.push(`Selected style: ${miningStyle.label}${miningStyle.rationale ? ` — ${miningStyle.rationale}` : ""}.`);
    if (miningStyle.source) {
      notes.push(`Style selection source: ${miningStyle.source}.`);
    }
  }
  if (signals.lowLight) {
    notes.push("Bridge flagged insufficient lighting; prioritize torch placement.");
  }
  if (signals.lava) {
    notes.push("Retreat command armed for lava detection events.");
  }
  if (signals.gravel) {
    notes.push("Monitor gravel sensors and shore ceilings before tunneling upward.");
  }
  if (toolIntegrity?.origin) {
    notes.push(`Tool telemetry source: ${toolIntegrity.origin}.`);
  }
  if (backupToolIntegrity?.origin) {
    notes.push(`Backup tool telemetry source: ${backupToolIntegrity.origin}.`);
  }

  return createPlan({
    task,
    summary: `Mine ${resource} at ${targetDescription} using the ${miningStyle.label} pattern.`,
    steps,
    estimatedDuration,
    resources: uniqueResources,
    risks,
    notes
  });
}
