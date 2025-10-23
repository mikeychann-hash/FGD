// tasks/plan_gather.js
// Planning logic for gathering crops or resources
// Refactored with Resource Profile System, Tool Efficiency System, and modular functions

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

/* =====================================================
 * RESOURCE PROFILE SYSTEM
 * Foundation for understanding resource characteristics
 * ===================================================== */

const RESOURCE_PROFILES = {
  // Crops
  wheat: {
    type: "crop",
    primaryTool: "hoe",
    harvestTool: "hand",
    replantable: true,
    seed: "wheat_seeds",
    maturityStages: 8,
    maturityTime: 24000, // ticks
    yieldPerPlot: 1.5,
    processingOptions: ["bread", "hay_bale"],
    weatherSensitive: true
  },
  carrots: {
    type: "crop",
    primaryTool: "hoe",
    harvestTool: "hand",
    replantable: true,
    seed: "carrot",
    maturityStages: 8,
    maturityTime: 24000,
    yieldPerPlot: 2.5,
    processingOptions: [],
    weatherSensitive: false
  },
  potatoes: {
    type: "crop",
    primaryTool: "hoe",
    harvestTool: "hand",
    replantable: true,
    seed: "potato",
    maturityStages: 8,
    maturityTime: 24000,
    yieldPerPlot: 2.5,
    processingOptions: ["baked_potato"],
    weatherSensitive: false
  },
  beetroots: {
    type: "crop",
    primaryTool: "hoe",
    harvestTool: "hand",
    replantable: true,
    seed: "beetroot_seeds",
    maturityStages: 4,
    maturityTime: 24000,
    yieldPerPlot: 1.5,
    processingOptions: ["beetroot_soup"],
    weatherSensitive: false
  },

  // Wood types
  oak_log: {
    type: "wood",
    primaryTool: "axe",
    backupTools: ["hand"],
    replantable: true,
    seed: "oak_sapling",
    maturityTime: 60000,
    yieldPerTree: 6,
    processingOptions: ["planks", "charcoal"],
    weatherSensitive: false
  },
  birch_log: {
    type: "wood",
    primaryTool: "axe",
    backupTools: ["hand"],
    replantable: true,
    seed: "birch_sapling",
    maturityTime: 60000,
    yieldPerTree: 6,
    processingOptions: ["planks", "charcoal"],
    weatherSensitive: false
  },
  spruce_log: {
    type: "wood",
    primaryTool: "axe",
    backupTools: ["hand"],
    replantable: true,
    seed: "spruce_sapling",
    maturityTime: 60000,
    yieldPerTree: 8,
    processingOptions: ["planks", "charcoal"],
    weatherSensitive: false
  },

  // Stone types
  stone: {
    type: "mining",
    primaryTool: "pickaxe",
    minToolTier: "wooden",
    replantable: false,
    yieldPerBlock: 1,
    processingOptions: ["smooth_stone"],
    weatherSensitive: false
  },
  cobblestone: {
    type: "mining",
    primaryTool: "pickaxe",
    minToolTier: "wooden",
    replantable: false,
    yieldPerBlock: 1,
    processingOptions: ["stone", "stone_bricks"],
    weatherSensitive: false
  },

  // Ores
  coal_ore: {
    type: "mining",
    primaryTool: "pickaxe",
    minToolTier: "wooden",
    replantable: false,
    yieldPerBlock: 1,
    processingOptions: [],
    weatherSensitive: false
  },
  iron_ore: {
    type: "mining",
    primaryTool: "pickaxe",
    minToolTier: "stone",
    replantable: false,
    yieldPerBlock: 1,
    processingOptions: ["iron_ingot"],
    weatherSensitive: false
  },
  gold_ore: {
    type: "mining",
    primaryTool: "pickaxe",
    minToolTier: "iron",
    replantable: false,
    yieldPerBlock: 1,
    processingOptions: ["gold_ingot"],
    weatherSensitive: false
  },
  diamond_ore: {
    type: "mining",
    primaryTool: "pickaxe",
    minToolTier: "iron",
    replantable: false,
    yieldPerBlock: 1,
    processingOptions: [],
    weatherSensitive: false
  }
};

/**
 * Get resource profile with fallback to sensible defaults
 */
function getResourceProfile(resourceName) {
  const normalized = normalizeItemName(resourceName);

  // Direct match
  if (RESOURCE_PROFILES[normalized]) {
    return { ...RESOURCE_PROFILES[normalized], name: normalized };
  }

  // Fuzzy matching for common patterns
  for (const [key, profile] of Object.entries(RESOURCE_PROFILES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return { ...profile, name: normalized };
    }
  }

  // Default profile for unknown resources
  return {
    type: "generic",
    name: normalized,
    primaryTool: "hand",
    backupTools: [],
    replantable: false,
    yieldPerBlock: 1,
    processingOptions: [],
    weatherSensitive: false
  };
}

/* =====================================================
 * TOOL EFFICIENCY SYSTEM
 * Defines tool properties and effectiveness
 * ===================================================== */

const TOOL_PROFILES = {
  // Axes
  wooden_axe: {
    type: "axe",
    tier: "wooden",
    speedMultiplier: 2.0,
    durability: 59,
    efficiency: { wood: 1.0, leaves: 0.5 },
    durabilityPerUse: 1
  },
  stone_axe: {
    type: "axe",
    tier: "stone",
    speedMultiplier: 3.0,
    durability: 131,
    efficiency: { wood: 1.5, leaves: 0.6 },
    durabilityPerUse: 1
  },
  iron_axe: {
    type: "axe",
    tier: "iron",
    speedMultiplier: 4.0,
    durability: 250,
    efficiency: { wood: 2.0, leaves: 0.7 },
    durabilityPerUse: 1
  },
  diamond_axe: {
    type: "axe",
    tier: "diamond",
    speedMultiplier: 6.0,
    durability: 1561,
    efficiency: { wood: 3.0, leaves: 0.8 },
    durabilityPerUse: 1
  },

  // Pickaxes
  wooden_pickaxe: {
    type: "pickaxe",
    tier: "wooden",
    speedMultiplier: 2.0,
    durability: 59,
    efficiency: { mining: 1.0 },
    durabilityPerUse: 1,
    mineable: ["stone", "coal_ore"]
  },
  stone_pickaxe: {
    type: "pickaxe",
    tier: "stone",
    speedMultiplier: 3.0,
    durability: 131,
    efficiency: { mining: 1.5 },
    durabilityPerUse: 1,
    mineable: ["stone", "coal_ore", "iron_ore"]
  },
  iron_pickaxe: {
    type: "pickaxe",
    tier: "iron",
    speedMultiplier: 4.0,
    durability: 250,
    efficiency: { mining: 2.0 },
    durabilityPerUse: 1,
    mineable: ["stone", "coal_ore", "iron_ore", "gold_ore", "diamond_ore"]
  },
  diamond_pickaxe: {
    type: "pickaxe",
    tier: "diamond",
    speedMultiplier: 6.0,
    durability: 1561,
    efficiency: { mining: 3.0 },
    durabilityPerUse: 1,
    mineable: ["stone", "coal_ore", "iron_ore", "gold_ore", "diamond_ore", "obsidian"]
  },

  // Hoes
  wooden_hoe: {
    type: "hoe",
    tier: "wooden",
    speedMultiplier: 1.0,
    durability: 59,
    efficiency: { crop: 1.0 },
    durabilityPerUse: 1
  },
  stone_hoe: {
    type: "hoe",
    tier: "stone",
    speedMultiplier: 1.0,
    durability: 131,
    efficiency: { crop: 1.0 },
    durabilityPerUse: 1
  },
  iron_hoe: {
    type: "hoe",
    tier: "iron",
    speedMultiplier: 1.0,
    durability: 250,
    efficiency: { crop: 1.0 },
    durabilityPerUse: 1
  },
  diamond_hoe: {
    type: "hoe",
    tier: "diamond",
    speedMultiplier: 1.0,
    durability: 1561,
    efficiency: { crop: 1.0 },
    durabilityPerUse: 1
  },

  // Hand (fallback)
  hand: {
    type: "hand",
    tier: "none",
    speedMultiplier: 1.0,
    durability: Infinity,
    efficiency: { wood: 0.2, mining: 0.1, crop: 1.0 },
    durabilityPerUse: 0
  }
};

/**
 * Get tool profile with fallback to hand
 */
function getToolProfile(toolName) {
  const normalized = normalizeItemName(toolName);
  return TOOL_PROFILES[normalized] || TOOL_PROFILES.hand;
}

/**
 * Calculate tool efficiency for a given resource type
 */
function calculateToolEfficiency(toolProfile, resourceProfile) {
  const resourceType = resourceProfile.type;
  const efficiency = toolProfile.efficiency[resourceType] || 1.0;
  return efficiency * toolProfile.speedMultiplier;
}

/**
 * Check if tool is appropriate for the resource
 */
function isToolAppropriate(toolProfile, resourceProfile) {
  // For mining, check if tool can mine the resource
  if (resourceProfile.type === "mining" && toolProfile.type === "pickaxe") {
    const mineable = toolProfile.mineable || [];
    return mineable.includes(resourceProfile.name);
  }

  // For wood, need axe or hand
  if (resourceProfile.type === "wood") {
    return toolProfile.type === "axe" || toolProfile.type === "hand";
  }

  // For crops, any tool works but hoe for tilling
  if (resourceProfile.type === "crop") {
    return true;
  }

  return true;
}

/**
 * Calculate expected durability cost for gathering operation
 */
function calculateDurabilityCost(toolProfile, quantity) {
  if (toolProfile.durability === Infinity) return 0;
  return toolProfile.durabilityPerUse * quantity;
}

/**
 * Assess tool condition from inventory item
 */
function assessToolCondition(inventoryItem) {
  if (!inventoryItem) return null;

  const durability = inventoryItem.durability ?? inventoryItem.maxDurability;
  const maxDurability = inventoryItem.maxDurability ?? durability;

  if (durability == null || maxDurability == null) {
    return { status: "unknown", percentage: null };
  }

  const percentage = (durability / maxDurability) * 100;

  if (percentage > 75) return { status: "good", percentage };
  if (percentage > 40) return { status: "fair", percentage };
  if (percentage > 15) return { status: "low", percentage };
  return { status: "critical", percentage };
}

/* =====================================================
 * TASK PARAMETER EXTRACTION
 * Parse and normalize all task metadata
 * ===================================================== */

/**
 * Extract and normalize all task parameters
 */
function extractTaskParameters(task, context) {
  const resource = normalizeItemName(task?.metadata?.resource || task.details || "resources");
  const resourceProfile = getResourceProfile(resource);

  // Tool selection with profile-based defaults
  const tool = normalizeItemName(
    task?.metadata?.tool ||
    resourceProfile.primaryTool ||
    "hand"
  );

  const backupTools = Array.isArray(task?.metadata?.backupTools)
    ? task.metadata.backupTools.map(normalizeItemName)
    : (resourceProfile.backupTools || []).map(normalizeItemName);

  const targetDescription = describeTarget(task.target);
  const storage = normalizeItemName(task?.metadata?.storage || "storage chest");
  const quantity = resolveQuantity(task?.metadata?.quantity ?? task?.metadata?.count, null);
  const method = normalizeItemName(task?.metadata?.method || "manual harvest");

  // Replanting logic based on resource profile
  const replant = task?.metadata?.replant ?? resourceProfile.replantable;
  const replantItem = replant
    ? normalizeItemName(
        task?.metadata?.replantItem ||
        task?.metadata?.seed ||
        resourceProfile.seed ||
        `${resource}_seeds`
      )
    : null;

  const harvestWindow = task?.metadata?.window || task?.metadata?.timing;
  const maturity = task?.metadata?.maturity ||
    (resourceProfile.type === "crop" ? "fully grown" : null);

  const fieldSize = resolveQuantity(task?.metadata?.fieldSize, null);
  const yieldPerPlot = resolveQuantity(
    task?.metadata?.yieldPerPlot,
    resourceProfile.yieldPerPlot || resourceProfile.yieldPerTree || resourceProfile.yieldPerBlock || 1
  );

  const processing = Array.isArray(task?.metadata?.processing)
    ? task.metadata.processing.map(normalizeItemName)
    : resourceProfile.processingOptions || [];

  return {
    resource,
    resourceProfile,
    tool,
    backupTools,
    targetDescription,
    storage,
    quantity,
    method,
    replant,
    replantItem,
    harvestWindow,
    maturity,
    fieldSize,
    yieldPerPlot,
    processing,
    weatherSensitive: task?.metadata?.weatherSensitive ?? resourceProfile.weatherSensitive,
    schedule: task?.metadata?.schedule,
    hostileRisk: task?.metadata?.hostileRisk,
    compostExtras: task?.metadata?.compostExtras,
    report: task?.metadata?.report !== false,
    supplies: task?.metadata?.supplies
  };
}

/* =====================================================
 * INVENTORY REQUIREMENTS CHECKING
 * Check tools and supplies against inventory
 * ===================================================== */

/**
 * Check inventory for tools and supplies
 */
function checkInventoryRequirements(params, context) {
  const inventory = extractInventory(context);
  const { tool, backupTools, replant, replantItem, fieldSize, quantity, resourceProfile } = params;

  // Check primary tool
  const hasPrimaryTool = hasInventoryItem(inventory, tool);
  const primaryToolItem = inventory.find(i => i.name === normalizeItemName(tool));
  const toolProfile = getToolProfile(tool);
  const toolCondition = assessToolCondition(primaryToolItem);
  const toolEfficiency = calculateToolEfficiency(toolProfile, resourceProfile);
  const toolAppropriate = isToolAppropriate(toolProfile, resourceProfile);

  // Check backup tools
  const availableBackups = backupTools.filter(name => hasInventoryItem(inventory, name));
  const missingTools = [tool, ...backupTools].filter(name => !hasInventoryItem(inventory, name));

  // Check replanting supplies
  const replantQuantity = fieldSize || quantity || 1;
  const needsReplantSupplies = replant && replantItem &&
    !hasInventoryItem(inventory, replantItem, replantQuantity);

  // Calculate durability requirements
  const expectedDurabilityCost = quantity
    ? calculateDurabilityCost(toolProfile, quantity)
    : null;

  const sufficientDurability = toolCondition && expectedDurabilityCost
    ? (toolCondition.percentage / 100) * toolProfile.durability > expectedDurabilityCost
    : true;

  return {
    inventory,
    hasPrimaryTool,
    primaryToolItem,
    toolProfile,
    toolCondition,
    toolEfficiency,
    toolAppropriate,
    availableBackups,
    missingTools,
    needsReplantSupplies,
    replantQuantity,
    expectedDurabilityCost,
    sufficientDurability
  };
}

/* =====================================================
 * STEP CREATION FUNCTIONS
 * Generate plan steps for different phases
 * ===================================================== */

/**
 * Create preparation steps (gear, supplies, replanting stock)
 */
function createPreparationSteps(params, inventoryCheck) {
  const steps = [];
  const { tool, backupTools, replant, replantItem, supplies } = params;
  const { missingTools, needsReplantSupplies, replantQuantity, toolCondition, sufficientDurability } = inventoryCheck;

  // Gear preparation
  if (missingTools.length > 0) {
    steps.push(
      createStep({
        title: "Obtain tools",
        type: "preparation",
        description: `Obtain or craft required tools: ${formatRequirementList(
          missingTools.map(name => ({ name, count: 1 }))
        )}.`,
        metadata: { tool, backupTools, missing: missingTools }
      })
    );
  } else {
    // Check tool condition
    const conditionWarnings = [];
    if (toolCondition && toolCondition.status === "low") {
      conditionWarnings.push(`${tool} is at ${Math.round(toolCondition.percentage)}% durability`);
    }
    if (!sufficientDurability) {
      conditionWarnings.push(`may not have enough durability for planned gathering`);
    }

    const warningText = conditionWarnings.length > 0
      ? ` Warning: ${conditionWarnings.join(", ")}.`
      : "";

    steps.push(
      createStep({
        title: "Prepare gear",
        type: "preparation",
        description: `Check durability on ${tool}${backupTools.length > 0 ? ` and backups (${backupTools.join(", ")})` : ""} before departing.${warningText}`,
        metadata: {
          tool,
          backupTools,
          toolCondition,
          sufficientDurability
        }
      })
    );
  }

  // Replanting stock
  if (needsReplantSupplies) {
    steps.push(
      createStep({
        title: "Gather replanting stock",
        type: "inventory",
        description: `Restock ${replantQuantity} ${replantItem} so fields can be replanted after harvesting.`,
        metadata: { item: replantItem, amount: replantQuantity }
      })
    );
  }

  // Supplies
  if (supplies) {
    const suppliesList = Array.isArray(supplies)
      ? supplies
      : Object.entries(supplies).map(([name, count]) => ({ name, count }));
    const suppliesSummary = formatRequirementList(suppliesList) || "supportive items";
    steps.push(
      createStep({
        title: "Pack supplies",
        type: "inventory",
        description: `Carry supportive items (${suppliesSummary}).`,
        metadata: { supplies: suppliesList }
      })
    );
  }

  return steps;
}

/**
 * Create harvest steps (travel, inspect, gather, replant)
 */
function createHarvestSteps(params, inventoryCheck) {
  const steps = [];
  const {
    resource,
    targetDescription,
    maturity,
    harvestWindow,
    tool,
    quantity,
    method,
    replant,
    replantItem
  } = params;
  const { toolEfficiency } = inventoryCheck;

  // Travel
  steps.push(
    createStep({
      title: "Travel",
      type: "movement",
      description: `Head to ${targetDescription} where ${resource} can be collected.`,
      metadata: { destination: targetDescription }
    })
  );

  // Field inspection
  if (maturity || harvestWindow) {
    const readinessDescriptionParts = [];
    if (maturity) {
      readinessDescriptionParts.push(`Confirm ${resource} are ${maturity}`);
    }
    if (harvestWindow) {
      readinessDescriptionParts.push(`work within the preferred window (${harvestWindow})`);
    }
    const readinessDescription = readinessDescriptionParts.filter(Boolean).join(" and ") ||
      `Inspect ${resource} plots and confirm readiness.`;
    steps.push(
      createStep({
        title: "Inspect field",
        type: "survey",
        description: `${readinessDescription}.`,
        metadata: { maturity, window: harvestWindow }
      })
    );
  }

  // Harvest
  const efficiencyNote = toolEfficiency > 2.0
    ? " (high efficiency)"
    : toolEfficiency < 1.0
      ? " (low efficiency)"
      : "";

  const harvestDescription = quantity
    ? `Collect approximately ${quantity} ${resource} using the ${tool}${efficiencyNote} via ${method}.`
    : `Collect ${resource} efficiently using the ${tool}${efficiencyNote} via ${method}.`;

  steps.push(
    createStep({
      title: "Harvest",
      type: "collection",
      description: harvestDescription,
      metadata: {
        tool,
        quantity,
        method,
        efficiency: toolEfficiency
      }
    })
  );

  // Replant
  if (replant) {
    steps.push(
      createStep({
        title: "Replant",
        type: "maintenance",
        description: `Replant ${replantItem || "seeds or saplings"} to sustain future ${resource} harvests.`,
        metadata: { item: replantItem || undefined }
      })
    );
  }

  return steps;
}

/**
 * Create post-harvest steps (processing, sorting, storage, reporting)
 */
function createPostHarvestSteps(params) {
  const steps = [];
  const { resource, processing, storage, quantity, compostExtras, report } = params;

  // Processing
  if (processing.length > 0) {
    steps.push(
      createStep({
        title: "Process yield",
        type: "processing",
        description: `Process gathered items into ${processing.join(", ")}, such as composting extras or crafting blocks.`,
        metadata: { processing }
      })
    );
  }

  // Sorting
  steps.push(
    createStep({
      title: "Sort",
      type: "inventory",
      description: `Organize gathered ${resource} in inventory, converting to blocks or bundles if useful.`
    })
  );

  // Storage
  steps.push(
    createStep({
      title: "Store",
      type: "storage",
      description: `Deliver ${resource} to the ${storage} and update counts.`,
      metadata: { container: storage, quantity }
    })
  );

  // Composting
  if (compostExtras) {
    steps.push(
      createStep({
        title: "Compost surplus",
        type: "processing",
        description: `Convert excess or spoiled ${resource} into bone meal before closing out the run.`,
        metadata: { method: "compost" }
      })
    );
  }

  // Reporting
  if (report) {
    steps.push(
      createStep({
        title: "Report",
        type: "report",
        description: `Share totals gathered and note regrowth timers or hazards encountered.`
      })
    );
  }

  return steps;
}

/* =====================================================
 * METRICS CALCULATION
 * Calculate duration, risks, and notes
 * ===================================================== */

/**
 * Calculate plan metrics (duration, risks, notes)
 */
function calculatePlanMetrics(params, inventoryCheck) {
  const {
    resource,
    tool,
    backupTools,
    replant,
    replantItem,
    quantity,
    fieldSize,
    yieldPerPlot,
    weatherSensitive,
    schedule,
    harvestWindow,
    hostileRisk,
    resourceProfile
  } = params;

  const {
    hasPrimaryTool,
    needsReplantSupplies,
    toolEfficiency,
    toolAppropriate
  } = inventoryCheck;

  // Duration estimation with tool efficiency
  const baseTimePerUnit = 250; // ms per resource unit
  const adjustedTimePerUnit = baseTimePerUnit / Math.max(toolEfficiency, 0.5);
  const gatherTime = quantity ? quantity * adjustedTimePerUnit : 3500;
  const estimatedDuration = 9000 + gatherTime;

  // Resources list
  const resources = [
    resource,
    tool,
    ...backupTools.filter(Boolean),
    ...(replantItem ? [replantItem] : [])
  ];
  const uniqueResources = [...new Set(resources.filter(name => name && name !== "unspecified item"))];

  // Risks
  const risks = [];
  if (!hasPrimaryTool) {
    risks.push(`Missing primary tool (${tool}) could slow gathering significantly.`);
  }
  if (!toolAppropriate) {
    risks.push(`Tool ${tool} may not be effective for ${resource}.`);
  }
  if (needsReplantSupplies) {
    risks.push(`Insufficient ${replantItem} to fully replant after harvesting.`);
  }
  if (hostileRisk) {
    risks.push("Hostile mobs may spawn during gathering.");
  }
  if (toolEfficiency < 0.8) {
    risks.push(`Low tool efficiency (${Math.round(toolEfficiency * 100)}%) will increase gathering time.`);
  }

  // Notes
  const notes = [];
  if (weatherSensitive) {
    notes.push("Avoid harvesting during rain to protect crops.");
  }
  if (schedule) {
    notes.push(`Preferred harvest schedule: ${schedule}.`);
  }
  if (harvestWindow) {
    notes.push(`Aim to harvest during ${harvestWindow} for peak yields.`);
  }
  if (fieldSize) {
    const estimatedYield = yieldPerPlot && fieldSize && !quantity
      ? Math.round(yieldPerPlot * fieldSize)
      : quantity;
    if (estimatedYield) {
      notes.push(`Expect roughly ${estimatedYield} items from ${fieldSize} plots.`);
    } else {
      notes.push(`Field area covers approximately ${fieldSize} plots.`);
    }
  }
  if (toolEfficiency > 2.0) {
    notes.push(`High tool efficiency (${Math.round(toolEfficiency * 100)}%) will speed up gathering.`);
  }

  return {
    estimatedDuration: Math.round(estimatedDuration),
    resources: uniqueResources,
    risks,
    notes
  };
}

/* =====================================================
 * MAIN PLANNING FUNCTION
 * Orchestrates the entire gather planning process
 * ===================================================== */

/**
 * Plan a gathering task with resource profiles and tool efficiency
 */
export function planGatherTask(task, context = {}) {
  // Extract and normalize all parameters
  const params = extractTaskParameters(task, context);

  // Check inventory for requirements
  const inventoryCheck = checkInventoryRequirements(params, context);

  // Generate plan steps
  const preparationSteps = createPreparationSteps(params, inventoryCheck);
  const harvestSteps = createHarvestSteps(params, inventoryCheck);
  const postHarvestSteps = createPostHarvestSteps(params);
  const steps = [...preparationSteps, ...harvestSteps, ...postHarvestSteps];

  // Calculate metrics
  const metrics = calculatePlanMetrics(params, inventoryCheck);

  // Create and return the plan
  return createPlan({
    task,
    summary: `Gather ${params.resource} at ${params.targetDescription}.`,
    steps,
    estimatedDuration: metrics.estimatedDuration,
    resources: metrics.resources,
    risks: metrics.risks,
    notes: metrics.notes
  });
}
