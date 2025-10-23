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
 * ENVIRONMENTAL FACTORS SYSTEM
 * Y-level, biome, and weather intelligence
 * ===================================================== */

const BIOME_PROFILES = {
  plains: {
    type: "plains",
    cropGrowthRate: 1.0,
    treeGrowthRate: 1.0,
    hostileMobSpawnRate: 0.7,
    weatherRainChance: 0.3,
    optimalFor: ["wheat", "carrots", "potatoes", "beetroots"],
    hazards: ["low", "open_terrain"]
  },
  forest: {
    type: "forest",
    cropGrowthRate: 0.9,
    treeGrowthRate: 1.2,
    hostileMobSpawnRate: 0.9,
    weatherRainChance: 0.4,
    optimalFor: ["oak_log", "birch_log", "spruce_log"],
    hazards: ["medium", "dense_foliage", "navigation_difficulty"]
  },
  taiga: {
    type: "taiga",
    cropGrowthRate: 0.8,
    treeGrowthRate: 1.1,
    hostileMobSpawnRate: 0.8,
    weatherRainChance: 0.5,
    optimalFor: ["spruce_log"],
    hazards: ["medium", "wolves", "cold"]
  },
  desert: {
    type: "desert",
    cropGrowthRate: 0.7,
    treeGrowthRate: 0.5,
    hostileMobSpawnRate: 1.0,
    weatherRainChance: 0.0,
    optimalFor: [],
    hazards: ["high", "husks", "heat", "navigation_difficulty"]
  },
  mountains: {
    type: "mountains",
    cropGrowthRate: 0.6,
    treeGrowthRate: 0.8,
    hostileMobSpawnRate: 0.6,
    weatherRainChance: 0.5,
    optimalFor: ["stone", "coal_ore", "iron_ore"],
    hazards: ["very_high", "fall_damage", "steep_terrain", "weather_exposure"]
  },
  caves: {
    type: "caves",
    cropGrowthRate: 0.0,
    treeGrowthRate: 0.0,
    hostileMobSpawnRate: 1.5,
    weatherRainChance: 0.0,
    optimalFor: ["stone", "coal_ore", "iron_ore", "gold_ore", "diamond_ore"],
    hazards: ["very_high", "hostile_mobs", "fall_damage", "lava", "darkness", "navigation_difficulty"]
  },
  underground: {
    type: "underground",
    cropGrowthRate: 0.0,
    treeGrowthRate: 0.0,
    hostileMobSpawnRate: 1.8,
    weatherRainChance: 0.0,
    optimalFor: ["iron_ore", "gold_ore", "diamond_ore"],
    hazards: ["extreme", "hostile_mobs", "fall_damage", "lava", "suffocation", "getting_lost"]
  }
};

const Y_LEVEL_PROFILES = {
  // Surface levels
  surface: { min: 62, max: 320, lighting: "natural", mobSpawnRisk: "medium", optimalFor: ["crop", "wood"] },
  elevated: { min: 90, max: 320, lighting: "natural", mobSpawnRisk: "low", optimalFor: ["wood"] },

  // Mining levels
  shallow: { min: 40, max: 62, lighting: "mixed", mobSpawnRisk: "high", optimalFor: ["coal_ore", "iron_ore", "stone"] },
  mid_depth: { min: 0, max: 40, lighting: "artificial", mobSpawnRisk: "very_high", optimalFor: ["iron_ore", "gold_ore", "coal_ore"] },
  deep: { min: -16, max: 0, lighting: "artificial", mobSpawnRisk: "very_high", optimalFor: ["iron_ore", "gold_ore", "diamond_ore"] },
  deepslate: { min: -64, max: -16, lighting: "artificial", mobSpawnRisk: "extreme", optimalFor: ["diamond_ore", "gold_ore"] }
};

const WEATHER_CONDITIONS = {
  clear: {
    type: "clear",
    cropGrowthModifier: 1.0,
    visibilityModifier: 1.0,
    mobSpawnModifier: 1.0,
    lightningRisk: false,
    movementModifier: 1.0
  },
  rain: {
    type: "rain",
    cropGrowthModifier: 1.1,
    visibilityModifier: 0.8,
    mobSpawnModifier: 0.7,
    lightningRisk: true,
    movementModifier: 0.95
  },
  thunderstorm: {
    type: "thunderstorm",
    cropGrowthModifier: 1.1,
    visibilityModifier: 0.6,
    mobSpawnModifier: 1.5,
    lightningRisk: true,
    movementModifier: 0.9
  },
  snow: {
    type: "snow",
    cropGrowthModifier: 0.8,
    visibilityModifier: 0.7,
    mobSpawnModifier: 1.0,
    lightningRisk: false,
    movementModifier: 0.85
  }
};

/**
 * Determine Y-level category from coordinates
 */
function getYLevelCategory(yCoord) {
  if (yCoord == null) return null;

  for (const [category, profile] of Object.entries(Y_LEVEL_PROFILES)) {
    if (yCoord >= profile.min && yCoord <= profile.max) {
      return { category, ...profile };
    }
  }
  return null;
}

/**
 * Get biome profile with fallback
 */
function getBiomeProfile(biomeName) {
  if (!biomeName) return null;
  const normalized = normalizeItemName(biomeName);

  // Direct match
  if (BIOME_PROFILES[normalized]) {
    return { ...BIOME_PROFILES[normalized], name: normalized };
  }

  // Fuzzy match
  for (const [key, profile] of Object.entries(BIOME_PROFILES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return { ...profile, name: key };
    }
  }

  // Default to plains
  return { ...BIOME_PROFILES.plains, name: "unknown" };
}

/**
 * Get weather profile
 */
function getWeatherProfile(weather) {
  if (!weather) return WEATHER_CONDITIONS.clear;
  const normalized = normalizeItemName(weather);
  return WEATHER_CONDITIONS[normalized] || WEATHER_CONDITIONS.clear;
}

/**
 * Analyze environmental context for gathering operation
 */
function analyzeEnvironmentalContext(task, context) {
  const target = task.target || {};

  // Extract coordinates
  const yLevel = target.y ?? context?.position?.y ?? context?.location?.y;
  const yLevelInfo = getYLevelCategory(yLevel);

  // Extract biome
  const biome = task?.metadata?.biome || context?.biome || target.biome || "plains";
  const biomeProfile = getBiomeProfile(biome);

  // Extract weather
  const weather = task?.metadata?.weather || context?.weather || "clear";
  const weatherProfile = getWeatherProfile(weather);

  // Extract time of day
  const timeOfDay = task?.metadata?.timeOfDay || context?.timeOfDay || "day";
  const isNight = timeOfDay === "night" || timeOfDay === "midnight";

  // Extract light level
  const lightLevel = task?.metadata?.lightLevel ?? context?.lightLevel ?? (isNight ? 4 : 15);

  return {
    yLevel,
    yLevelInfo,
    biome,
    biomeProfile,
    weather,
    weatherProfile,
    timeOfDay,
    isNight,
    lightLevel
  };
}

/**
 * Check if resource is optimal for environmental conditions
 */
function isResourceOptimalForEnvironment(resourceProfile, environmentalContext) {
  const { biomeProfile, yLevelInfo } = environmentalContext;

  if (!biomeProfile || !yLevelInfo) return true;

  // Check biome optimization
  const biomeOptimal = biomeProfile.optimalFor.includes(resourceProfile.name);

  // Check Y-level optimization
  const yLevelOptimal = yLevelInfo.optimalFor.includes(resourceProfile.type) ||
    yLevelInfo.optimalFor.includes(resourceProfile.name);

  return { biomeOptimal, yLevelOptimal };
}

/* =====================================================
 * HAZARD SYSTEM
 * Safety risk assessment and recommendations
 * ===================================================== */

const HAZARD_TYPES = {
  hostile_mobs: {
    severity: "high",
    category: "combat",
    mitigations: ["armor", "weapons", "torches", "work_during_day"],
    description: "Hostile creatures may attack during gathering"
  },
  fall_damage: {
    severity: "medium",
    category: "environmental",
    mitigations: ["water_bucket", "slow_falling_potion", "careful_movement"],
    description: "Risk of falling from heights"
  },
  lava: {
    severity: "critical",
    category: "environmental",
    mitigations: ["fire_resistance_potion", "water_bucket", "careful_movement"],
    description: "Lava pools or flows present"
  },
  drowning: {
    severity: "medium",
    category: "environmental",
    mitigations: ["water_breathing_potion", "boat", "careful_swimming"],
    description: "Water hazards present"
  },
  darkness: {
    severity: "medium",
    category: "environmental",
    mitigations: ["torches", "night_vision_potion", "work_during_day"],
    description: "Low light levels increase danger"
  },
  lightning: {
    severity: "medium",
    category: "weather",
    mitigations: ["avoid_thunderstorms", "seek_shelter"],
    description: "Lightning strikes during storms"
  },
  getting_lost: {
    severity: "low",
    category: "navigation",
    mitigations: ["compass", "map", "coordinates", "torches_as_markers"],
    description: "May lose orientation in complex terrain"
  },
  tool_breakage: {
    severity: "low",
    category: "equipment",
    mitigations: ["backup_tools", "mending", "check_durability"],
    description: "Tools may break during operation"
  },
  hunger: {
    severity: "low",
    category: "survival",
    mitigations: ["bring_food", "saturation_items"],
    description: "Extended operations may deplete food"
  },
  weather_exposure: {
    severity: "low",
    category: "weather",
    mitigations: ["shelter", "wait_for_clear_weather"],
    description: "Adverse weather may slow operations"
  }
};

/**
 * Assess hazards based on environmental context and resource type
 */
function assessEnvironmentalHazards(resourceProfile, environmentalContext, inventoryCheck) {
  const hazards = [];
  const { biomeProfile, yLevelInfo, weatherProfile, lightLevel, isNight } = environmentalContext;

  // Hostile mob hazards
  if (biomeProfile) {
    const mobRiskMultiplier = isNight ? 1.5 : 1.0;
    const adjustedMobRisk = biomeProfile.hostileMobSpawnRate * mobRiskMultiplier * weatherProfile.mobSpawnModifier;

    if (adjustedMobRisk > 1.0 || lightLevel < 8) {
      hazards.push({
        type: "hostile_mobs",
        severity: adjustedMobRisk > 1.5 ? "critical" : adjustedMobRisk > 1.0 ? "high" : "medium",
        ...HAZARD_TYPES.hostile_mobs
      });
    }
  }

  // Y-level based hazards
  if (yLevelInfo) {
    if (yLevelInfo.category === "deep" || yLevelInfo.category === "deepslate") {
      hazards.push({
        type: "lava",
        severity: "high",
        ...HAZARD_TYPES.lava
      });
    }

    if (yLevelInfo.category !== "surface") {
      hazards.push({
        type: "darkness",
        severity: "medium",
        ...HAZARD_TYPES.darkness
      });
    }

    if (yLevelInfo.category === "elevated" || biomeProfile?.hazards?.includes("fall_damage")) {
      hazards.push({
        type: "fall_damage",
        severity: "medium",
        ...HAZARD_TYPES.fall_damage
      });
    }
  }

  // Biome-specific hazards
  if (biomeProfile?.hazards?.includes("navigation_difficulty")) {
    hazards.push({
      type: "getting_lost",
      severity: "medium",
      ...HAZARD_TYPES.getting_lost
    });
  }

  // Weather hazards
  if (weatherProfile.lightningRisk) {
    hazards.push({
      type: "lightning",
      severity: "medium",
      ...HAZARD_TYPES.lightning
    });
  }

  if (weatherProfile.movementModifier < 1.0) {
    hazards.push({
      type: "weather_exposure",
      severity: "low",
      ...HAZARD_TYPES.weather_exposure
    });
  }

  // Tool breakage hazard
  if (inventoryCheck.toolCondition && inventoryCheck.toolCondition.status === "low") {
    hazards.push({
      type: "tool_breakage",
      severity: "medium",
      ...HAZARD_TYPES.tool_breakage
    });
  }

  // Long operation hazard
  if (resourceProfile.type === "mining" || resourceProfile.type === "wood") {
    hazards.push({
      type: "hunger",
      severity: "low",
      ...HAZARD_TYPES.hunger
    });
  }

  return hazards;
}

/**
 * Generate safety recommendations based on hazards
 */
function generateSafetyRecommendations(hazards) {
  const recommendations = [];
  const mitigationsSeen = new Set();

  // Group by severity
  const criticalHazards = hazards.filter(h => h.severity === "critical");
  const highHazards = hazards.filter(h => h.severity === "high");
  const mediumHazards = hazards.filter(h => h.severity === "medium");

  // Add critical mitigations first
  for (const hazard of criticalHazards) {
    for (const mitigation of hazard.mitigations.slice(0, 2)) {
      if (!mitigationsSeen.has(mitigation)) {
        mitigationsSeen.add(mitigation);
        recommendations.push({
          priority: "critical",
          action: mitigation,
          reason: hazard.description
        });
      }
    }
  }

  // Add high priority mitigations
  for (const hazard of highHazards) {
    for (const mitigation of hazard.mitigations.slice(0, 1)) {
      if (!mitigationsSeen.has(mitigation)) {
        mitigationsSeen.add(mitigation);
        recommendations.push({
          priority: "high",
          action: mitigation,
          reason: hazard.description
        });
      }
    }
  }

  // Add medium priority mitigations (limited)
  for (const hazard of mediumHazards.slice(0, 2)) {
    for (const mitigation of hazard.mitigations.slice(0, 1)) {
      if (!mitigationsSeen.has(mitigation)) {
        mitigationsSeen.add(mitigation);
        recommendations.push({
          priority: "medium",
          action: mitigation,
          reason: hazard.description
        });
      }
    }
  }

  return recommendations;
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
 * Calculate realistic time estimation with environmental factors
 */
function calculateRealisticDuration(params, inventoryCheck, environmentalContext, task) {
  const { quantity, fieldSize, replant, processing, resourceProfile } = params;
  const { toolEfficiency, hasPrimaryTool } = inventoryCheck;
  const { weatherProfile, biomeProfile, yLevelInfo } = environmentalContext;

  // Base time per resource unit (ms)
  const baseTimePerUnit = 250;

  // Tool efficiency modifier
  const toolModifier = hasPrimaryTool
    ? 1.0 / Math.max(toolEfficiency, 0.5)
    : 2.0; // Significant penalty for missing tool

  // Weather modifier
  const weatherModifier = 1.0 / weatherProfile.movementModifier;

  // Biome modifier (terrain difficulty)
  let biomeModifier = 1.0;
  if (biomeProfile) {
    if (biomeProfile.hazards?.includes("navigation_difficulty")) biomeModifier *= 1.2;
    if (biomeProfile.hazards?.includes("steep_terrain")) biomeModifier *= 1.3;
    if (biomeProfile.type === "forest") biomeModifier *= 1.1;
  }

  // Y-level modifier (depth penalty)
  let yLevelModifier = 1.0;
  if (yLevelInfo) {
    if (yLevelInfo.category === "deep") yLevelModifier = 1.3;
    if (yLevelInfo.category === "deepslate") yLevelModifier = 1.5;
    if (yLevelInfo.category === "shallow") yLevelModifier = 1.1;
  }

  // Calculate gathering time
  const effectiveTimePerUnit = baseTimePerUnit * toolModifier * weatherModifier * biomeModifier * yLevelModifier;
  const gatherTime = quantity ? quantity * effectiveTimePerUnit : 3500;

  // Preparation time (5-10 minutes for gear checks)
  const prepTime = 5000 + (hasPrimaryTool ? 0 : 5000);

  // Travel time estimation
  const target = task.target || {};
  let travelTime = 2000; // Base 2 seconds
  if (target.x !== undefined && target.z !== undefined) {
    const distance = Math.sqrt(target.x ** 2 + target.z ** 2);
    travelTime = Math.min(distance * 50, 60000); // Max 1 minute
  }
  travelTime *= weatherModifier; // Weather affects travel

  // Replanting time
  const replantTime = replant && fieldSize ? fieldSize * 100 : 0;

  // Processing time
  const processingTime = processing?.length > 0 ? quantity * 50 : 0;

  // Storage and reporting time
  const postTime = 2000;

  // Total duration
  const totalDuration = prepTime + travelTime + gatherTime + replantTime + processingTime + postTime;

  return {
    totalDuration: Math.round(totalDuration),
    breakdown: {
      preparation: Math.round(prepTime),
      travel: Math.round(travelTime),
      gathering: Math.round(gatherTime),
      replanting: Math.round(replantTime),
      processing: Math.round(processingTime),
      storage: Math.round(postTime)
    },
    modifiers: {
      tool: toolModifier,
      weather: weatherModifier,
      biome: biomeModifier,
      yLevel: yLevelModifier
    }
  };
}

/**
 * Calculate plan metrics with environmental and hazard analysis
 */
function calculatePlanMetrics(params, inventoryCheck, environmentalContext, hazards, task) {
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

  const { biomeProfile, yLevelInfo, weatherProfile, biome, yLevel } = environmentalContext;

  // Realistic duration calculation
  const durationInfo = calculateRealisticDuration(params, inventoryCheck, environmentalContext, task);

  // Resources list
  const resources = [
    resource,
    tool,
    ...backupTools.filter(Boolean),
    ...(replantItem ? [replantItem] : [])
  ];
  const uniqueResources = [...new Set(resources.filter(name => name && name !== "unspecified item"))];

  // Risks from inventory and tools
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
  if (toolEfficiency < 0.8) {
    risks.push(`Low tool efficiency (${Math.round(toolEfficiency * 100)}%) will increase gathering time.`);
  }

  // Add hazard-based risks
  const criticalHazards = hazards.filter(h => h.severity === "critical");
  const highHazards = hazards.filter(h => h.severity === "high");

  for (const hazard of criticalHazards) {
    risks.push(`⚠️ CRITICAL: ${hazard.description}`);
  }
  for (const hazard of highHazards) {
    risks.push(`⚠️ ${hazard.description}`);
  }

  // Environmental optimality check
  const envOptimality = isResourceOptimalForEnvironment(resourceProfile, environmentalContext);
  if (envOptimality.biomeOptimal === false && biomeProfile) {
    risks.push(`${resource} is not optimal for ${biome} biome - reduced yields possible.`);
  }
  if (envOptimality.yLevelOptimal === false && yLevelInfo) {
    risks.push(`Y-level ${yLevel} is not optimal for ${resource} - consider relocating.`);
  }

  // Notes with environmental context
  const notes = [];

  // Environmental notes
  if (biome && yLevel != null) {
    notes.push(`Operating in ${biome} biome at Y=${yLevel} (${yLevelInfo?.category || "unknown"} level).`);
  }

  if (weatherProfile.type !== "clear") {
    notes.push(`Weather: ${weatherProfile.type} - expect ${Math.round((1 - weatherProfile.movementModifier) * 100)}% slower movement.`);
  }

  // Scheduling notes
  if (weatherSensitive) {
    notes.push("Avoid harvesting during rain to protect crops.");
  }
  if (schedule) {
    notes.push(`Preferred harvest schedule: ${schedule}.`);
  }
  if (harvestWindow) {
    notes.push(`Aim to harvest during ${harvestWindow} for peak yields.`);
  }

  // Yield estimation
  if (fieldSize) {
    let estimatedYield = yieldPerPlot && fieldSize && !quantity
      ? Math.round(yieldPerPlot * fieldSize)
      : quantity;

    // Apply biome growth modifier to yield
    if (biomeProfile && resourceProfile.type === "crop") {
      estimatedYield = Math.round(estimatedYield * biomeProfile.cropGrowthRate);
    }

    if (estimatedYield) {
      notes.push(`Expect roughly ${estimatedYield} items from ${fieldSize} plots.`);
    } else {
      notes.push(`Field area covers approximately ${fieldSize} plots.`);
    }
  }

  // Efficiency notes
  if (toolEfficiency > 2.0) {
    notes.push(`High tool efficiency (${Math.round(toolEfficiency * 100)}%) will speed up gathering.`);
  }

  // Time breakdown note
  if (durationInfo.totalDuration > 60000) {
    const minutes = Math.round(durationInfo.totalDuration / 60000);
    notes.push(`Estimated duration: ~${minutes} minutes (gathering: ${Math.round(durationInfo.breakdown.gathering / 1000)}s).`);
  }

  // Generate safety recommendations
  const safetyRecommendations = generateSafetyRecommendations(hazards);

  return {
    estimatedDuration: durationInfo.totalDuration,
    durationBreakdown: durationInfo.breakdown,
    resources: uniqueResources,
    risks,
    notes,
    safetyRecommendations,
    environmentalContext: {
      biome,
      yLevel,
      weather: weatherProfile.type,
      optimality: envOptimality
    },
    hazards: hazards.map(h => ({
      type: h.type,
      severity: h.severity,
      description: h.description
    }))
  };
}

/* =====================================================
 * MAIN PLANNING FUNCTION
 * Orchestrates the entire gather planning process
 * ===================================================== */

/**
 * Plan a gathering task with comprehensive environmental and hazard analysis
 */
export function planGatherTask(task, context = {}) {
  // Extract and normalize all parameters
  const params = extractTaskParameters(task, context);

  // Analyze environmental context
  const environmentalContext = analyzeEnvironmentalContext(task, context);

  // Check inventory for requirements
  const inventoryCheck = checkInventoryRequirements(params, context);

  // Assess environmental hazards
  const hazards = assessEnvironmentalHazards(
    params.resourceProfile,
    environmentalContext,
    inventoryCheck
  );

  // Generate plan steps
  const preparationSteps = createPreparationSteps(params, inventoryCheck);
  const harvestSteps = createHarvestSteps(params, inventoryCheck);
  const postHarvestSteps = createPostHarvestSteps(params);

  // Add safety briefing step if there are hazards
  const allSteps = [];
  if (hazards.length > 0) {
    const criticalHazards = hazards.filter(h => h.severity === "critical" || h.severity === "high");
    if (criticalHazards.length > 0) {
      const safetyRecommendations = generateSafetyRecommendations(hazards);
      const topRecommendations = safetyRecommendations.slice(0, 3).map(r => r.action).join(", ");

      allSteps.push(
        createStep({
          title: "Safety briefing",
          type: "preparation",
          description: `Review hazards and safety measures. Key mitigations: ${topRecommendations}.`,
          metadata: {
            hazards: criticalHazards.map(h => h.type),
            safetyMeasures: safetyRecommendations
          }
        })
      );
    }
  }

  allSteps.push(...preparationSteps, ...harvestSteps, ...postHarvestSteps);

  // Calculate comprehensive metrics
  const metrics = calculatePlanMetrics(
    params,
    inventoryCheck,
    environmentalContext,
    hazards,
    task
  );

  // Build summary with environmental context
  const envSummary = environmentalContext.biome && environmentalContext.yLevel != null
    ? ` in ${environmentalContext.biome} (Y=${environmentalContext.yLevel})`
    : "";

  // Create base plan
  const plan = createPlan({
    task,
    summary: `Gather ${params.resource} at ${params.targetDescription}${envSummary}.`,
    steps: allSteps,
    estimatedDuration: metrics.estimatedDuration,
    resources: metrics.resources,
    risks: metrics.risks,
    notes: metrics.notes
  });

  // Add enhanced metadata
  plan.metadata = {
    durationBreakdown: metrics.durationBreakdown,
    safetyRecommendations: metrics.safetyRecommendations,
    environmentalContext: metrics.environmentalContext,
    hazards: metrics.hazards,
    toolEfficiency: inventoryCheck.toolEfficiency,
    resourceOptimality: metrics.environmentalContext.optimality
  };

  return plan;
}
