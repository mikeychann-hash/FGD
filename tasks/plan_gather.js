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
 * GATHERING STRATEGIES SYSTEM
 * Optimization patterns for different resource types
 * ===================================================== */

const GATHERING_STRATEGIES = {
  // Mining strategies
  strip_mining: {
    type: "mining",
    pattern: "linear",
    efficiency: 0.85,
    coverage: "high",
    description: "Mine long tunnels at optimal Y-level with spacing",
    bestFor: ["diamond_ore", "gold_ore", "iron_ore"],
    spacing: 3,
    branchLength: 50,
    timeMultiplier: 1.0
  },
  branch_mining: {
    type: "mining",
    pattern: "branching",
    efficiency: 0.90,
    coverage: "very_high",
    description: "Main tunnel with perpendicular branches for maximum coverage",
    bestFor: ["diamond_ore", "ancient_debris"],
    spacing: 2,
    branchLength: 30,
    timeMultiplier: 1.1
  },
  cave_exploration: {
    type: "mining",
    pattern: "organic",
    efficiency: 0.70,
    coverage: "variable",
    description: "Explore natural caves and exposed ore veins",
    bestFor: ["coal_ore", "iron_ore", "copper_ore"],
    timeMultiplier: 0.8
  },
  quarry: {
    type: "mining",
    pattern: "layer_removal",
    efficiency: 1.0,
    coverage: "complete",
    description: "Remove entire layers systematically",
    bestFor: ["stone", "cobblestone", "andesite"],
    timeMultiplier: 1.3
  },

  // Crop strategies
  row_by_row: {
    type: "crop",
    pattern: "linear",
    efficiency: 0.95,
    coverage: "complete",
    description: "Harvest crops in systematic rows",
    bestFor: ["wheat", "carrots", "potatoes", "beetroots"],
    timeMultiplier: 1.0
  },
  spiral_harvest: {
    type: "crop",
    pattern: "spiral",
    efficiency: 0.88,
    coverage: "complete",
    description: "Harvest in spiral pattern from edge to center",
    bestFor: ["wheat", "carrots", "potatoes"],
    timeMultiplier: 1.05
  },

  // Tree strategies
  selective_logging: {
    type: "wood",
    pattern: "selective",
    efficiency: 0.75,
    coverage: "partial",
    description: "Harvest mature trees while preserving forest structure",
    bestFor: ["oak_log", "birch_log"],
    timeMultiplier: 0.9,
    sustainability: "high"
  },
  clear_cutting: {
    type: "wood",
    pattern: "area_clear",
    efficiency: 0.95,
    coverage: "complete",
    description: "Remove all trees in designated area",
    bestFor: ["oak_log", "birch_log", "spruce_log"],
    timeMultiplier: 1.0,
    sustainability: "low"
  },
  tree_farm_rotation: {
    type: "wood",
    pattern: "rotation",
    efficiency: 1.0,
    coverage: "complete",
    description: "Harvest planted trees in rotation for consistent yields",
    bestFor: ["oak_log", "birch_log", "spruce_log"],
    timeMultiplier: 0.85,
    sustainability: "very_high"
  }
};

/**
 * Select optimal gathering strategy for resource and context
 */
function selectGatheringStrategy(resourceProfile, environmentalContext, quantity) {
  const resourceType = resourceProfile.type;

  // Filter strategies by resource type
  const applicableStrategies = Object.entries(GATHERING_STRATEGIES)
    .filter(([_, strategy]) => strategy.type === resourceType)
    .map(([name, strategy]) => ({ name, ...strategy }));

  if (applicableStrategies.length === 0) {
    return null;
  }

  // Score strategies based on context
  const scoredStrategies = applicableStrategies.map(strategy => {
    let score = strategy.efficiency * 100;

    // Prefer strategies best for this specific resource
    if (strategy.bestFor?.includes(resourceProfile.name)) {
      score += 20;
    }

    // Consider quantity
    if (quantity) {
      if (quantity > 64 && strategy.coverage === "complete") score += 10;
      if (quantity < 32 && strategy.coverage === "partial") score += 10;
    }

    // Environmental considerations
    if (environmentalContext.biome === "forest" && strategy.sustainability === "high") {
      score += 15;
    }

    // Time efficiency for hazardous environments
    if (environmentalContext.yLevelInfo?.category === "deep" && strategy.efficiency > 0.9) {
      score += 10;
    }

    return { ...strategy, score };
  });

  // Return highest scoring strategy
  scoredStrategies.sort((a, b) => b.score - a.score);
  return scoredStrategies[0];
}

/**
 * Generate strategy-specific recommendations
 */
function generateStrategyRecommendations(strategy, resourceProfile, quantity) {
  if (!strategy) return [];

  const recommendations = [];

  // Pattern-specific advice
  if (strategy.pattern === "branching" && strategy.spacing) {
    recommendations.push(`Maintain ${strategy.spacing}-block spacing between branches for optimal coverage.`);
  }

  if (strategy.pattern === "linear" && strategy.branchLength) {
    recommendations.push(`Create branches of ${strategy.branchLength} blocks for efficiency.`);
  }

  if (strategy.pattern === "rotation" && resourceProfile.replantable) {
    recommendations.push(`Replant immediately after harvest to maintain rotation cycle.`);
  }

  if (strategy.sustainability === "low" && resourceProfile.replantable) {
    recommendations.push(`Ensure replanting to maintain resource availability.`);
  }

  // Quantity-based advice
  if (quantity > 64 && strategy.coverage !== "complete") {
    recommendations.push(`Large quantity requested - consider switching to ${strategy.pattern} coverage strategy.`);
  }

  return recommendations;
}

/* =====================================================
 * INVENTORY MANAGEMENT SYSTEM
 * Smart storage and capacity planning
 * ===================================================== */

const INVENTORY_SLOTS = {
  player: 36,      // Main inventory
  hotbar: 9,       // Quick access (subset of main)
  shulker_box: 27, // Portable storage
  ender_chest: 27  // Shared storage across world
};

const STACK_SIZES = {
  // Tools and weapons (non-stackable)
  tool: 1,
  weapon: 1,
  armor: 1,

  // Standard stackables
  block: 64,
  item: 64,
  food: 64,

  // Special stack sizes
  ender_pearl: 16,
  snowball: 16,
  egg: 16,
  bucket: 16,
  sign: 16,

  // Non-stackables
  potion: 1,
  banner: 16
};

/**
 * Get stack size for an item
 */
function getStackSize(itemName) {
  const normalized = normalizeItemName(itemName);

  // Check if it's a tool
  if (normalized.includes("pickaxe") || normalized.includes("axe") ||
      normalized.includes("shovel") || normalized.includes("hoe") ||
      normalized.includes("sword")) {
    return STACK_SIZES.tool;
  }

  // Check if it's armor
  if (normalized.includes("helmet") || normalized.includes("chestplate") ||
      normalized.includes("leggings") || normalized.includes("boots")) {
    return STACK_SIZES.armor;
  }

  // Check special items
  if (STACK_SIZES[normalized]) {
    return STACK_SIZES[normalized];
  }

  // Default to standard stack
  return STACK_SIZES.block;
}

/**
 * Calculate inventory space requirements
 */
function calculateInventoryRequirements(params, inventoryCheck) {
  const { resource, quantity, replantItem, processing, supplies, tool, backupTools } = params;
  const { replantQuantity } = inventoryCheck;

  const requirements = {
    totalSlotsNeeded: 0,
    breakdown: {},
    warnings: [],
    recommendations: []
  };

  // Tools (always 1 slot each)
  const toolSlots = 1 + (backupTools?.length || 0);
  requirements.breakdown.tools = toolSlots;
  requirements.totalSlotsNeeded += toolSlots;

  // Gathered resources
  if (quantity) {
    const resourceStackSize = getStackSize(resource);
    const resourceSlots = Math.ceil(quantity / resourceStackSize);
    requirements.breakdown.gathered = resourceSlots;
    requirements.totalSlotsNeeded += resourceSlots;
  }

  // Replanting supplies
  if (replantItem && replantQuantity) {
    const seedStackSize = getStackSize(replantItem);
    const seedSlots = Math.ceil(replantQuantity / seedStackSize);
    requirements.breakdown.replanting = seedSlots;
    requirements.totalSlotsNeeded += seedSlots;
  }

  // Processing outputs
  if (processing && processing.length > 0 && quantity) {
    // Assume processing creates additional item types
    const processingSlots = Math.min(processing.length, 3);
    requirements.breakdown.processing = processingSlots;
    requirements.totalSlotsNeeded += processingSlots;
  }

  // Supplies (food, torches, etc.)
  if (supplies) {
    const supplyList = Array.isArray(supplies) ? supplies : Object.keys(supplies);
    const supplySlots = Math.min(supplyList.length, 5);
    requirements.breakdown.supplies = supplySlots;
    requirements.totalSlotsNeeded += supplySlots;
  } else {
    // Default supplies (food + torches)
    requirements.breakdown.supplies = 2;
    requirements.totalSlotsNeeded += 2;
  }

  // Buffer slots for unexpected items (drops, mob loot)
  const bufferSlots = 3;
  requirements.breakdown.buffer = bufferSlots;
  requirements.totalSlotsNeeded += bufferSlots;

  // Check capacity
  const availableSlots = INVENTORY_SLOTS.player;
  if (requirements.totalSlotsNeeded > availableSlots) {
    const overflow = requirements.totalSlotsNeeded - availableSlots;
    requirements.warnings.push(`Inventory overflow: need ${requirements.totalSlotsNeeded} slots, have ${availableSlots}.`);
    requirements.warnings.push(`Consider ${overflow} shulker boxes or multiple trips.`);
  } else if (requirements.totalSlotsNeeded > availableSlots * 0.8) {
    requirements.warnings.push(`Inventory near capacity (${Math.round(requirements.totalSlotsNeeded / availableSlots * 100)}%). Consider bringing a shulker box.`);
  }

  // Recommendations
  if (quantity > 64) {
    const resourceStackSize = getStackSize(resource);
    if (resourceStackSize === 64) {
      requirements.recommendations.push(`Convert to blocks (9:1 ratio) to save ${Math.floor(quantity / 576)} inventory slots.`);
    }
  }

  if (requirements.totalSlotsNeeded > 27) {
    requirements.recommendations.push(`Bring an ender chest for convenient storage access.`);
  }

  if (processing && processing.length > 0) {
    requirements.recommendations.push(`Process items at base to free inventory space during gathering.`);
  }

  return requirements;
}

/**
 * Generate inventory organization plan
 */
function generateInventoryOrganization(params, requirements) {
  const organization = {
    hotbar: [],
    mainInventory: [],
    priority: []
  };

  // Hotbar (slots 0-8): Tools and frequently used items
  organization.hotbar.push(params.tool);
  if (params.backupTools && params.backupTools.length > 0) {
    organization.hotbar.push(...params.backupTools.slice(0, 1));
  }
  organization.hotbar.push("food");
  organization.hotbar.push("torches");
  if (params.replantItem) {
    organization.hotbar.push(params.replantItem);
  }

  // Main inventory priorities
  organization.priority = [
    "Keep tools in hotbar for quick access",
    "Reserve bottom row for gathered resources",
    "Place replanting supplies in accessible slot",
    "Store food and supplies in consistent locations"
  ];

  return organization;
}

/* =====================================================
 * ADVANCED DURABILITY CALCULATIONS
 * Comprehensive tool planning and management
 * ===================================================== */

/**
 * Calculate detailed durability requirements and planning
 */
function calculateDetailedDurability(params, inventoryCheck, strategy) {
  const { quantity, resourceProfile, tool, backupTools } = params;
  const { toolProfile, toolCondition, primaryToolItem } = inventoryCheck;

  const durabilityPlan = {
    primaryTool: {
      name: tool,
      currentDurability: null,
      maxDurability: toolProfile.durability,
      requiredDurability: 0,
      remainingAfter: null,
      sufficient: true,
      condition: toolCondition?.status || "unknown"
    },
    backupNeeded: false,
    backupTools: [],
    recommendations: [],
    warnings: [],
    enchantmentBenefits: {}
  };

  // Calculate required durability
  if (quantity && toolProfile.durabilityPerUse) {
    durabilityPlan.primaryTool.requiredDurability = quantity * toolProfile.durabilityPerUse;

    // Apply strategy modifier if applicable
    if (strategy && strategy.timeMultiplier) {
      // More time = potentially more blocks broken
      durabilityPlan.primaryTool.requiredDurability *= strategy.timeMultiplier;
    }
  }

  // Get current durability if tool is in inventory
  if (primaryToolItem && primaryToolItem.durability != null) {
    durabilityPlan.primaryTool.currentDurability = primaryToolItem.durability;
    durabilityPlan.primaryTool.remainingAfter =
      primaryToolItem.durability - durabilityPlan.primaryTool.requiredDurability;

    durabilityPlan.primaryTool.sufficient =
      durabilityPlan.primaryTool.remainingAfter >= 0;
  } else if (primaryToolItem) {
    // Tool exists but no durability info - assume new
    durabilityPlan.primaryTool.currentDurability = toolProfile.durability;
    durabilityPlan.primaryTool.remainingAfter =
      toolProfile.durability - durabilityPlan.primaryTool.requiredDurability;
    durabilityPlan.primaryTool.sufficient =
      durabilityPlan.primaryTool.remainingAfter >= 0;
  } else {
    // Tool not in inventory
    durabilityPlan.primaryTool.sufficient = false;
  }

  // Check if backup tool is needed
  if (!durabilityPlan.primaryTool.sufficient) {
    durabilityPlan.backupNeeded = true;

    const shortfall = Math.abs(durabilityPlan.primaryTool.remainingAfter || durabilityPlan.primaryTool.requiredDurability);
    const toolsNeeded = Math.ceil(shortfall / toolProfile.durability) + 1;

    durabilityPlan.warnings.push(
      `Primary ${tool} will break during gathering. Need ${toolsNeeded} total tools.`
    );

    // Check available backups
    if (backupTools && backupTools.length > 0) {
      for (const backupName of backupTools) {
        const backupProfile = getToolProfile(backupName);
        durabilityPlan.backupTools.push({
          name: backupName,
          durability: backupProfile.durability,
          available: inventoryCheck.availableBackups?.includes(backupName) || false
        });
      }
    }
  }

  // Warnings based on condition
  if (toolCondition) {
    if (toolCondition.status === "critical") {
      durabilityPlan.warnings.push(
        `${tool} at critical durability (${Math.round(toolCondition.percentage)}%). Repair or replace before gathering!`
      );
    } else if (toolCondition.status === "low") {
      durabilityPlan.warnings.push(
        `${tool} at low durability (${Math.round(toolCondition.percentage)}%). May break during operation.`
      );
    }
  }

  // Recommendations
  if (durabilityPlan.primaryTool.requiredDurability > 100) {
    durabilityPlan.recommendations.push(
      `Consider enchanting ${tool} with Unbreaking III to triple durability.`
    );

    // Calculate enchantment benefits
    durabilityPlan.enchantmentBenefits.unbreaking3 = {
      effectiveDurability: toolProfile.durability * 4, // Unbreaking III ~4x
      toolsSaved: Math.floor(durabilityPlan.primaryTool.requiredDurability / toolProfile.durability) -
                  Math.floor(durabilityPlan.primaryTool.requiredDurability / (toolProfile.durability * 4))
    };
  }

  if (durabilityPlan.primaryTool.requiredDurability > 50 && resourceProfile.type === "mining") {
    durabilityPlan.recommendations.push(
      `Mending enchantment recommended for extended mining operations.`
    );
  }

  if (durabilityPlan.backupNeeded && (!backupTools || backupTools.length === 0)) {
    durabilityPlan.recommendations.push(
      `Craft ${Math.ceil(durabilityPlan.primaryTool.requiredDurability / toolProfile.durability)} spare ${tool}s before departing.`
    );
  }

  // Repair recommendations
  if (durabilityPlan.primaryTool.remainingAfter != null &&
      durabilityPlan.primaryTool.remainingAfter < toolProfile.durability * 0.25) {
    durabilityPlan.recommendations.push(
      `Repair ${tool} after this operation (will be at ${Math.round((durabilityPlan.primaryTool.remainingAfter / toolProfile.durability) * 100)}% durability).`
    );
  }

  return durabilityPlan;
}

/**
 * Create tool management steps based on durability analysis
 */
function createToolManagementSteps(durabilityPlan) {
  const steps = [];

  // Add repair step if critical
  if (durabilityPlan.primaryTool.condition === "critical") {
    steps.push(
      createStep({
        title: "Repair tool",
        type: "preparation",
        description: `Repair ${durabilityPlan.primaryTool.name} before departure - currently at critical durability.`,
        metadata: {
          tool: durabilityPlan.primaryTool.name,
          durability: durabilityPlan.primaryTool.currentDurability
        }
      })
    );
  }

  // Add backup crafting step if needed
  if (durabilityPlan.backupNeeded && durabilityPlan.backupTools.length === 0) {
    const toolsNeeded = Math.ceil(durabilityPlan.primaryTool.requiredDurability / durabilityPlan.primaryTool.maxDurability);
    steps.push(
      createStep({
        title: "Craft backup tools",
        type: "preparation",
        description: `Craft ${toolsNeeded} additional ${durabilityPlan.primaryTool.name}s to complete gathering operation.`,
        metadata: {
          tool: durabilityPlan.primaryTool.name,
          quantity: toolsNeeded
        }
      })
    );
  }

  return steps;
}

/* =====================================================
 * AUTOMATION AWARENESS SYSTEM
 * Suggest automated or more efficient methods
 * ===================================================== */

const AUTOMATION_OPTIONS = {
  // Crop automation
  wheat: {
    automatable: true,
    methods: [
      {
        name: "villager_farm",
        type: "semi_auto",
        effort: "medium",
        yield: "high",
        description: "Villager-based automatic crop collection",
        requirements: ["villagers", "composter", "hoppers"],
        efficiency: 0.95,
        laborSavings: 0.9
      },
      {
        name: "redstone_farm",
        type: "full_auto",
        effort: "high",
        yield: "very_high",
        description: "Fully automatic observer-piston farm",
        requirements: ["observers", "pistons", "redstone", "hoppers"],
        efficiency: 1.0,
        laborSavings: 1.0
      }
    ]
  },
  carrots: {
    automatable: true,
    methods: [
      {
        name: "villager_farm",
        type: "semi_auto",
        effort: "medium",
        yield: "high",
        description: "Villager-based automatic crop collection",
        requirements: ["villagers", "composter", "hoppers"],
        efficiency: 0.95,
        laborSavings: 0.9
      }
    ]
  },
  potatoes: {
    automatable: true,
    methods: [
      {
        name: "villager_farm",
        type: "semi_auto",
        effort: "medium",
        yield: "high",
        description: "Villager-based automatic crop collection",
        requirements: ["villagers", "composter", "hoppers"],
        efficiency: 0.95,
        laborSavings: 0.9
      }
    ]
  },

  // Tree automation
  oak_log: {
    automatable: true,
    methods: [
      {
        name: "tnt_tree_farm",
        type: "semi_auto",
        effort: "high",
        yield: "very_high",
        description: "TNT-based automatic tree harvesting",
        requirements: ["tnt", "observers", "redstone"],
        efficiency: 0.85,
        laborSavings: 0.8
      }
    ]
  },
  birch_log: {
    automatable: true,
    methods: [
      {
        name: "tnt_tree_farm",
        type: "semi_auto",
        effort: "high",
        yield: "very_high",
        description: "TNT-based automatic tree harvesting",
        requirements: ["tnt", "observers", "redstone"],
        efficiency: 0.85,
        laborSavings: 0.8
      }
    ]
  },
  spruce_log: {
    automatable: true,
    methods: [
      {
        name: "mega_spruce_farm",
        type: "semi_auto",
        effort: "very_high",
        yield: "extreme",
        description: "2x2 spruce tree automatic farm",
        requirements: ["tnt", "observers", "redstone", "bone_meal_farm"],
        efficiency: 0.9,
        laborSavings: 0.85
      }
    ]
  },

  // Mining automation (limited)
  cobblestone: {
    automatable: true,
    methods: [
      {
        name: "cobble_generator",
        type: "full_auto",
        effort: "low",
        yield: "infinite",
        description: "Automatic cobblestone generator",
        requirements: ["water", "lava", "pistons", "observers"],
        efficiency: 1.0,
        laborSavings: 1.0
      }
    ]
  },
  stone: {
    automatable: true,
    methods: [
      {
        name: "stone_generator",
        type: "full_auto",
        effort: "medium",
        yield: "infinite",
        description: "Automatic stone generator with smelting",
        requirements: ["water", "lava", "pistons", "observers", "furnaces"],
        efficiency: 1.0,
        laborSavings: 1.0
      }
    ]
  },

  // Special resources
  iron_ingot: {
    automatable: true,
    methods: [
      {
        name: "iron_farm",
        type: "full_auto",
        effort: "very_high",
        yield: "infinite",
        description: "Automatic iron farm using villagers and golems",
        requirements: ["villagers", "zombie", "water", "hoppers"],
        efficiency: 1.0,
        laborSavings: 1.0
      }
    ]
  },
  gold_ingot: {
    automatable: true,
    methods: [
      {
        name: "gold_farm",
        type: "full_auto",
        effort: "very_high",
        yield: "infinite",
        description: "Nether portal-based gold farm",
        requirements: ["nether_portal", "turtle_eggs", "hoppers", "nether_access"],
        efficiency: 1.0,
        laborSavings: 1.0
      }
    ]
  }
};

/**
 * Analyze if automation is available and beneficial
 */
function analyzeAutomation(resourceProfile, params, context) {
  const resource = resourceProfile.name;
  const quantity = params.quantity || 0;

  const automation = {
    available: false,
    recommended: false,
    methods: [],
    reasoning: "",
    breakEvenPoint: null
  };

  // Check if resource has automation options
  const options = AUTOMATION_OPTIONS[resource];
  if (!options || !options.automatable) {
    automation.reasoning = "No automation available for this resource.";
    return automation;
  }

  automation.available = true;
  automation.methods = options.methods;

  // Determine if automation is recommended
  if (quantity > 128) {
    automation.recommended = true;
    automation.reasoning = `Large quantity (${quantity}) suggests automation would save significant time.`;
  } else if (quantity > 64) {
    automation.recommended = true;
    automation.reasoning = `Moderate quantity (${quantity}) - automation may be worthwhile for repeated gathering.`;
  } else {
    automation.recommended = false;
    automation.reasoning = `Small quantity (${quantity}) - manual gathering is more efficient.`;
  }

  // Calculate break-even point for automation setup
  if (automation.methods.length > 0) {
    const bestMethod = automation.methods[0];
    const setupTime = getAutomationSetupTime(bestMethod.effort);
    const manualTime = quantity * 250; // Base time per unit
    const autoTime = quantity * 250 * (1 - bestMethod.laborSavings);

    const timeSaved = manualTime - autoTime;
    const netBenefit = timeSaved - setupTime;

    automation.breakEvenPoint = {
      setupTime: Math.round(setupTime / 1000),
      timeSavedPerOperation: Math.round(timeSaved / 1000),
      netBenefit: Math.round(netBenefit / 1000),
      operationsToBreakEven: Math.ceil(setupTime / timeSaved)
    };
  }

  return automation;
}

/**
 * Get estimated setup time for automation method
 */
function getAutomationSetupTime(effort) {
  const times = {
    low: 300000,      // 5 minutes
    medium: 1800000,  // 30 minutes
    high: 3600000,    // 1 hour
    very_high: 7200000 // 2 hours
  };
  return times[effort] || 1800000;
}

/**
 * Generate automation recommendations
 */
function generateAutomationRecommendations(automation, params) {
  const recommendations = [];

  if (!automation.available) {
    return recommendations;
  }

  if (automation.recommended && automation.methods.length > 0) {
    const method = automation.methods[0];
    recommendations.push(
      `Consider building a ${method.name} for ${params.resource} (${method.type}, ${method.laborSavings * 100}% labor savings).`
    );

    if (automation.breakEvenPoint) {
      const bp = automation.breakEvenPoint;
      if (bp.operationsToBreakEven <= 3) {
        recommendations.push(
          `Automation breaks even after ${bp.operationsToBreakEven} operations (~${bp.setupTime}s setup time).`
        );
      }
    }

    if (method.requirements.length > 0) {
      recommendations.push(
        `Required materials: ${method.requirements.slice(0, 3).join(", ")}${method.requirements.length > 3 ? "..." : ""}`
      );
    }
  } else if (automation.available && !automation.recommended) {
    recommendations.push(
      `Automation available but not recommended for this quantity. Manual gathering is more efficient.`
    );
  }

  return recommendations;
}

/* =====================================================
 * YIELD PREDICTION SYSTEM
 * Fortune enchantments and yield modifiers
 * ===================================================== */

const ENCHANTMENT_EFFECTS = {
  fortune_i: {
    name: "Fortune I",
    applicable: ["diamond_ore", "coal_ore", "redstone_ore", "lapis_ore", "emerald_ore", "nether_quartz_ore"],
    yieldMultiplier: 1.33,  // Average 33% increase
    minYield: 1,
    maxYield: 2,
    description: "Increases ore drops"
  },
  fortune_ii: {
    name: "Fortune II",
    applicable: ["diamond_ore", "coal_ore", "redstone_ore", "lapis_ore", "emerald_ore", "nether_quartz_ore"],
    yieldMultiplier: 1.75,  // Average 75% increase
    minYield: 1,
    maxYield: 3,
    description: "Significantly increases ore drops"
  },
  fortune_iii: {
    name: "Fortune III",
    applicable: ["diamond_ore", "coal_ore", "redstone_ore", "lapis_ore", "emerald_ore", "nether_quartz_ore"],
    yieldMultiplier: 2.2,   // Average 120% increase
    minYield: 1,
    maxYield: 4,
    description: "Greatly increases ore drops"
  },
  looting_i: {
    name: "Looting I",
    applicable: ["mob_drops"],
    yieldMultiplier: 1.15,
    description: "Increases mob loot"
  },
  looting_ii: {
    name: "Looting II",
    applicable: ["mob_drops"],
    yieldMultiplier: 1.30,
    description: "Significantly increases mob loot"
  },
  looting_iii: {
    name: "Looting III",
    applicable: ["mob_drops"],
    yieldMultiplier: 1.50,
    description: "Greatly increases mob loot"
  }
};

const CROP_MODIFIERS = {
  bone_meal: {
    name: "Bone Meal",
    applicable: ["wheat", "carrots", "potatoes", "beetroots"],
    speedMultiplier: 10.0,  // Instant growth
    description: "Instantly grows crops to maturity"
  },
  fortune_crop: {
    name: "Fortune (on crops)",
    applicable: ["wheat_seeds", "carrot", "potato"],
    yieldMultiplier: 1.5,  // Fortune affects seed/item drops
    description: "Increases crop yield when harvesting"
  }
};

/**
 * Calculate yield predictions with enchantments
 */
function calculateYieldPrediction(params, inventoryCheck, context) {
  const { resource, quantity, resourceProfile } = params;
  const { primaryToolItem } = inventoryCheck;

  const prediction = {
    baseYield: quantity || 0,
    modifiedYield: quantity || 0,
    multiplier: 1.0,
    enchantments: [],
    modifiers: [],
    recommendations: []
  };

  // Check for Fortune enchantment on tool
  if (primaryToolItem && primaryToolItem.enchantments) {
    for (const [enchant, level] of Object.entries(primaryToolItem.enchantments)) {
      const enchantKey = `${enchant}_${level}`.toLowerCase();
      const enchantEffect = ENCHANTMENT_EFFECTS[enchantKey];

      if (enchantEffect && enchantEffect.applicable.includes(resource)) {
        prediction.multiplier *= enchantEffect.yieldMultiplier;
        prediction.enchantments.push({
          name: enchantEffect.name,
          multiplier: enchantEffect.yieldMultiplier,
          range: enchantEffect.maxYield ? `${enchantEffect.minYield}-${enchantEffect.maxYield}` : null
        });
      }
    }
  }

  // Check for crop modifiers
  if (resourceProfile.type === "crop") {
    if (context.boneMealAvailable) {
      prediction.modifiers.push({
        name: "Bone Meal",
        effect: "10x faster growth",
        recommendation: "Use bone meal to skip growth time"
      });
    }
  }

  // Calculate modified yield
  prediction.modifiedYield = Math.round(prediction.baseYield * prediction.multiplier);

  // Generate recommendations
  if (prediction.multiplier === 1.0 && resourceProfile.type === "mining") {
    // Check if Fortune would help
    const fortuneEffect = ENCHANTMENT_EFFECTS.fortune_iii;
    if (fortuneEffect.applicable.includes(resource)) {
      const potentialYield = Math.round(prediction.baseYield * fortuneEffect.yieldMultiplier);
      const bonusItems = potentialYield - prediction.baseYield;

      prediction.recommendations.push(
        `Fortune III would yield ~${bonusItems} additional ${resource} (${Math.round((fortuneEffect.yieldMultiplier - 1) * 100)}% increase).`
      );
    }
  }

  if (prediction.enchantments.length > 0) {
    prediction.recommendations.push(
      `Current enchantments will yield ~${prediction.modifiedYield} items (${Math.round((prediction.multiplier - 1) * 100)}% bonus).`
    );
  }

  if (resourceProfile.type === "crop" && !context.boneMealAvailable && quantity > 64) {
    prediction.recommendations.push(
      `Consider bringing bone meal to accelerate crop growth (instant maturity).`
    );
  }

  return prediction;
}

/* =====================================================
 * ROUTE OPTIMIZATION SYSTEM
 * Multi-resource gathering and pathfinding
 * ===================================================== */

/**
 * Analyze if multiple resources can be gathered in one trip
 */
function analyzeMultiResourceOpportunities(task, context) {
  const opportunities = {
    nearby: [],
    compatible: [],
    recommendations: [],
    routeOptimization: null
  };

  // Check if there are other pending tasks
  const pendingTasks = context?.pendingTasks || context?.taskQueue || [];

  if (pendingTasks.length === 0) {
    return opportunities;
  }

  const currentTarget = task.target || {};
  const currentBiome = task?.metadata?.biome || context?.biome;
  const currentYLevel = currentTarget.y ?? context?.position?.y;

  // Find nearby compatible tasks
  for (const pendingTask of pendingTasks) {
    const pendingTarget = pendingTask.target || {};
    const pendingBiome = pendingTask?.metadata?.biome;

    // Check spatial proximity (if coordinates available)
    if (currentTarget.x !== undefined && pendingTarget.x !== undefined) {
      const distance = Math.sqrt(
        Math.pow(currentTarget.x - pendingTarget.x, 2) +
        Math.pow(currentTarget.z - pendingTarget.z, 2)
      );

      if (distance < 500) {  // Within 500 blocks
        opportunities.nearby.push({
          task: pendingTask,
          distance: Math.round(distance),
          resource: pendingTask?.metadata?.resource || pendingTask.details
        });
      }
    }

    // Check biome compatibility
    if (currentBiome && pendingBiome && currentBiome === pendingBiome) {
      opportunities.compatible.push({
        task: pendingTask,
        reason: "same_biome",
        resource: pendingTask?.metadata?.resource || pendingTask.details
      });
    }

    // Check Y-level compatibility (for mining)
    if (currentYLevel !== undefined && pendingTarget.y !== undefined) {
      const yDiff = Math.abs(currentYLevel - pendingTarget.y);
      if (yDiff < 20) {
        opportunities.compatible.push({
          task: pendingTask,
          reason: "same_depth",
          resource: pendingTask?.metadata?.resource || pendingTask.details
        });
      }
    }
  }

  // Generate route optimization
  if (opportunities.nearby.length > 0) {
    const sortedByDistance = [...opportunities.nearby].sort((a, b) => a.distance - b.distance);
    opportunities.routeOptimization = {
      totalStops: sortedByDistance.length + 1,
      suggestedOrder: [
        task?.metadata?.resource || task.details,
        ...sortedByDistance.map(o => o.resource)
      ],
      estimatedExtraTime: sortedByDistance.reduce((sum, o) => sum + (o.distance * 50), 0), // 50ms per block
      travelSavings: calculateTravelSavings(sortedByDistance)
    };
  }

  // Generate recommendations
  if (opportunities.nearby.length > 0) {
    opportunities.recommendations.push(
      `${opportunities.nearby.length} gathering task(s) nearby - consider combining into one trip.`
    );

    if (opportunities.routeOptimization) {
      const savings = opportunities.routeOptimization.travelSavings;
      opportunities.recommendations.push(
        `Multi-resource route saves ~${Math.round(savings / 1000)}s travel time.`
      );
    }
  }

  if (opportunities.compatible.length > 0 && opportunities.nearby.length === 0) {
    opportunities.recommendations.push(
      `${opportunities.compatible.length} compatible task(s) in same biome/depth - may be worth combining.`
    );
  }

  return opportunities;
}

/**
 * Calculate travel time savings from multi-resource route
 */
function calculateTravelSavings(nearbyTasks) {
  if (nearbyTasks.length === 0) return 0;

  // Individual trips: home -> task1 -> home + home -> task2 -> home
  const individualTripTime = nearbyTasks.reduce((sum, task) => {
    return sum + (task.distance * 2 * 50); // Round trip
  }, 0);

  // Combined trip: home -> task1 -> task2 -> ... -> home
  const combinedTripTime = nearbyTasks.reduce((sum, task) => {
    return sum + (task.distance * 50); // One way
  }, 0);

  return individualTripTime - combinedTripTime;
}

/**
 * Generate route optimization steps
 */
function createRouteOptimizationStep(routeOptimization) {
  if (!routeOptimization) return null;

  const description = `Multi-resource route: ${routeOptimization.suggestedOrder.join(" → ")}. ` +
    `Saves ~${Math.round(routeOptimization.travelSavings / 1000)}s travel time vs separate trips.`;

  return createStep({
    title: "Plan multi-resource route",
    type: "preparation",
    description,
    metadata: {
      stops: routeOptimization.totalStops,
      order: routeOptimization.suggestedOrder,
      timeSavings: routeOptimization.travelSavings
    }
  });
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
 * Calculate plan metrics with comprehensive analysis
 */
function calculatePlanMetrics(params, inventoryCheck, environmentalContext, hazards, task, strategy, durabilityPlan, inventoryRequirements, automation, yieldPrediction, multiResource) {
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

  // Add durability warnings to risks
  if (durabilityPlan && durabilityPlan.warnings.length > 0) {
    risks.push(...durabilityPlan.warnings);
  }

  // Add inventory warnings to risks
  if (inventoryRequirements && inventoryRequirements.warnings.length > 0) {
    risks.push(...inventoryRequirements.warnings);
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

  // Strategy notes
  if (strategy) {
    notes.push(`Gathering strategy: ${strategy.name} (${Math.round(strategy.efficiency * 100)}% efficiency, ${strategy.coverage} coverage).`);
    const strategyRecs = generateStrategyRecommendations(strategy, resourceProfile, quantity);
    if (strategyRecs.length > 0) {
      notes.push(...strategyRecs.slice(0, 2)); // Add top 2 strategy recommendations
    }
  }

  // Inventory notes
  if (inventoryRequirements) {
    notes.push(`Inventory: ${inventoryRequirements.totalSlotsNeeded}/${INVENTORY_SLOTS.player} slots needed.`);
    if (inventoryRequirements.recommendations.length > 0) {
      notes.push(...inventoryRequirements.recommendations.slice(0, 2)); // Top 2 inventory recommendations
    }
  }

  // Durability notes
  if (durabilityPlan && durabilityPlan.recommendations.length > 0) {
    notes.push(...durabilityPlan.recommendations.slice(0, 2)); // Top 2 durability recommendations
  }

  // Automation notes
  if (automation && automation.available) {
    const autoRecs = generateAutomationRecommendations(automation, params);
    if (autoRecs.length > 0) {
      notes.push(...autoRecs.slice(0, 2)); // Top 2 automation recommendations
    }
  }

  // Yield prediction notes
  if (yieldPrediction && yieldPrediction.recommendations.length > 0) {
    notes.push(...yieldPrediction.recommendations.slice(0, 2)); // Top 2 yield recommendations
  }

  // Multi-resource route notes
  if (multiResource && multiResource.recommendations.length > 0) {
    notes.push(...multiResource.recommendations.slice(0, 2)); // Top 2 route recommendations
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
 * Plan a gathering task with comprehensive analysis and optimization
 */
export function planGatherTask(task, context = {}) {
  // Extract and normalize all parameters
  const params = extractTaskParameters(task, context);

  // Analyze environmental context
  const environmentalContext = analyzeEnvironmentalContext(task, context);

  // Check inventory for requirements
  const inventoryCheck = checkInventoryRequirements(params, context);

  // Select optimal gathering strategy
  const strategy = selectGatheringStrategy(
    params.resourceProfile,
    environmentalContext,
    params.quantity
  );

  // Calculate detailed durability requirements
  const durabilityPlan = calculateDetailedDurability(params, inventoryCheck, strategy);

  // Calculate inventory requirements
  const inventoryRequirements = calculateInventoryRequirements(params, inventoryCheck);
  const inventoryOrganization = generateInventoryOrganization(params, inventoryRequirements);

  // Assess environmental hazards
  const hazards = assessEnvironmentalHazards(
    params.resourceProfile,
    environmentalContext,
    inventoryCheck
  );

  // Analyze automation opportunities
  const automation = analyzeAutomation(params.resourceProfile, params, context);

  // Calculate yield predictions
  const yieldPrediction = calculateYieldPrediction(params, inventoryCheck, context);

  // Analyze multi-resource opportunities
  const multiResource = analyzeMultiResourceOpportunities(task, context);

  // Generate plan steps with all enhancements
  const allSteps = [];

  // Add automation awareness step if recommended
  if (automation.recommended && automation.methods.length > 0) {
    const method = automation.methods[0];
    allSteps.push(
      createStep({
        title: "Consider automation",
        type: "planning",
        description: `${method.name} available for ${params.resource} (${method.laborSavings * 100}% labor savings). ${automation.reasoning}`,
        metadata: {
          automation: method,
          breakEvenPoint: automation.breakEvenPoint,
          recommendations: generateAutomationRecommendations(automation, params)
        }
      })
    );
  }

  // Add multi-resource route optimization step
  const routeStep = createRouteOptimizationStep(multiResource.routeOptimization);
  if (routeStep) {
    allSteps.push(routeStep);
  }

  // Add safety briefing step if there are hazards
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

  // Add tool management steps (repair, craft backups)
  const toolManagementSteps = createToolManagementSteps(durabilityPlan);
  allSteps.push(...toolManagementSteps);

  // Add standard preparation steps
  const preparationSteps = createPreparationSteps(params, inventoryCheck);
  allSteps.push(...preparationSteps);

  // Add inventory organization step
  if (inventoryRequirements.totalSlotsNeeded > 20) {
    const hotbarSummary = inventoryOrganization.hotbar.slice(0, 3).join(", ");
    allSteps.push(
      createStep({
        title: "Organize inventory",
        type: "preparation",
        description: `Organize ${inventoryRequirements.totalSlotsNeeded} inventory slots. Hotbar: ${hotbarSummary}, etc.`,
        metadata: {
          organization: inventoryOrganization,
          requirements: inventoryRequirements.breakdown
        }
      })
    );
  }

  // Add gathering strategy step
  if (strategy) {
    allSteps.push(
      createStep({
        title: "Plan gathering route",
        type: "preparation",
        description: `Use ${strategy.name} strategy: ${strategy.description}`,
        metadata: {
          strategy: strategy.name,
          pattern: strategy.pattern,
          efficiency: strategy.efficiency,
          recommendations: generateStrategyRecommendations(strategy, params.resourceProfile, params.quantity)
        }
      })
    );
  }

  // Add harvest steps
  const harvestSteps = createHarvestSteps(params, inventoryCheck);
  allSteps.push(...harvestSteps);

  // Add post-harvest steps
  const postHarvestSteps = createPostHarvestSteps(params);
  allSteps.push(...postHarvestSteps);

  // Calculate comprehensive metrics
  const metrics = calculatePlanMetrics(
    params,
    inventoryCheck,
    environmentalContext,
    hazards,
    task,
    strategy,
    durabilityPlan,
    inventoryRequirements,
    automation,
    yieldPrediction,
    multiResource
  );

  // Build summary with environmental context and strategy
  const envSummary = environmentalContext.biome && environmentalContext.yLevel != null
    ? ` in ${environmentalContext.biome} (Y=${environmentalContext.yLevel})`
    : "";

  const strategySummary = strategy ? ` using ${strategy.name}` : "";

  // Create base plan
  const plan = createPlan({
    task,
    summary: `Gather ${params.resource} at ${params.targetDescription}${envSummary}${strategySummary}.`,
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
    resourceOptimality: metrics.environmentalContext.optimality,
    gatheringStrategy: strategy ? {
      name: strategy.name,
      pattern: strategy.pattern,
      efficiency: strategy.efficiency,
      recommendations: generateStrategyRecommendations(strategy, params.resourceProfile, params.quantity)
    } : null,
    durabilityPlan: {
      primaryTool: durabilityPlan.primaryTool,
      backupNeeded: durabilityPlan.backupNeeded,
      warnings: durabilityPlan.warnings,
      recommendations: durabilityPlan.recommendations
    },
    inventoryManagement: {
      slotsNeeded: inventoryRequirements.totalSlotsNeeded,
      breakdown: inventoryRequirements.breakdown,
      warnings: inventoryRequirements.warnings,
      recommendations: inventoryRequirements.recommendations,
      organization: inventoryOrganization
    },
    automation: automation.available ? {
      available: automation.available,
      recommended: automation.recommended,
      reasoning: automation.reasoning,
      methods: automation.methods.map(m => ({
        name: m.name,
        type: m.type,
        laborSavings: m.laborSavings,
        effort: m.effort
      })),
      breakEvenPoint: automation.breakEvenPoint
    } : null,
    yieldPrediction: {
      baseYield: yieldPrediction.baseYield,
      modifiedYield: yieldPrediction.modifiedYield,
      multiplier: yieldPrediction.multiplier,
      enchantments: yieldPrediction.enchantments,
      modifiers: yieldPrediction.modifiers,
      recommendations: yieldPrediction.recommendations
    },
    multiResource: multiResource.nearby.length > 0 || multiResource.compatible.length > 0 ? {
      nearbyTasks: multiResource.nearby.length,
      compatibleTasks: multiResource.compatible.length,
      recommendations: multiResource.recommendations,
      routeOptimization: multiResource.routeOptimization
    } : null
  };

  return plan;
}
