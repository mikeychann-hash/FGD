// tasks/plan_explore.js
// Planning logic for exploration or scouting tasks
// Refactored with Biome Profile System, Structure Finding System, and Navigation Strategies

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
 * BIOME PROFILE SYSTEM
 * Foundation for understanding biome characteristics
 * ===================================================== */

const BIOME_PROFILES = {
  // Overworld - Temperate Biomes
  plains: {
    dimension: "overworld",
    category: "temperate",
    terrain: "flat",
    difficulty: "easy",
    visibility: "excellent",
    hostileMobs: ["zombie", "skeleton", "creeper", "spider"],
    passiveMobs: ["cow", "sheep", "pig", "chicken", "horse"],
    resources: ["grass", "flowers", "villages"],
    structures: ["village", "pillager_outpost", "ruined_portal"],
    traversalSpeed: 1.0,
    navigationComplexity: "low",
    supplies: ["food", "torches", "bed"],
    specialConsiderations: ["Ideal for horse travel", "Villages common", "Flat terrain good for mapping"],
    weatherHazards: ["thunderstorm"]
  },
  forest: {
    dimension: "overworld",
    category: "temperate",
    terrain: "varied",
    difficulty: "medium",
    visibility: "limited",
    hostileMobs: ["zombie", "skeleton", "creeper", "spider", "witch"],
    passiveMobs: ["cow", "sheep", "pig", "chicken", "wolf"],
    resources: ["oak_log", "birch_log", "flowers", "mushrooms"],
    structures: ["woodland_mansion", "ruined_portal"],
    traversalSpeed: 0.7,
    navigationComplexity: "medium",
    supplies: ["food", "torches", "bed", "axe"],
    specialConsiderations: ["Dense trees limit visibility", "Easy to get lost", "Abundant wood resources"],
    weatherHazards: ["thunderstorm", "darkness"]
  },
  taiga: {
    dimension: "overworld",
    category: "cold",
    terrain: "hilly",
    difficulty: "medium",
    visibility: "moderate",
    hostileMobs: ["zombie", "skeleton", "creeper", "spider", "wolf"],
    passiveMobs: ["wolf", "fox", "rabbit"],
    resources: ["spruce_log", "ferns", "sweet_berries"],
    structures: ["village", "pillager_outpost", "igloo"],
    traversalSpeed: 0.8,
    navigationComplexity: "medium",
    supplies: ["food", "torches", "bed", "warm_clothing"],
    specialConsiderations: ["Wolves can be hostile", "Sweet berries useful", "Cold climate"],
    weatherHazards: ["snow", "freezing"]
  },
  desert: {
    dimension: "overworld",
    category: "dry",
    terrain: "flat_sandy",
    difficulty: "medium",
    visibility: "excellent",
    hostileMobs: ["zombie", "skeleton", "creeper", "spider", "husk"],
    passiveMobs: ["rabbit"],
    resources: ["sand", "sandstone", "cactus", "dead_bush"],
    structures: ["desert_temple", "village", "desert_well", "ruined_portal"],
    traversalSpeed: 0.9,
    navigationComplexity: "low",
    supplies: ["food", "water_bucket", "torches", "bed"],
    specialConsiderations: ["Husks don't burn in daylight", "Temples contain loot", "Limited food sources"],
    weatherHazards: ["heat", "no_water"]
  },
  jungle: {
    dimension: "overworld",
    category: "lush",
    terrain: "dense",
    difficulty: "hard",
    visibility: "very_limited",
    hostileMobs: ["zombie", "skeleton", "creeper", "spider", "ocelot"],
    passiveMobs: ["parrot", "ocelot", "panda"],
    resources: ["jungle_log", "bamboo", "cocoa_beans", "melons"],
    structures: ["jungle_temple", "ruined_portal"],
    traversalSpeed: 0.5,
    navigationComplexity: "very_high",
    supplies: ["food", "torches", "bed", "axe", "shears", "compass"],
    specialConsiderations: ["Extremely difficult navigation", "Jungle temples have traps", "Bamboo useful for scaffolding"],
    weatherHazards: ["heavy_rain", "darkness"]
  },
  swamp: {
    dimension: "overworld",
    category: "wet",
    terrain: "waterlogged",
    difficulty: "medium",
    visibility: "limited",
    hostileMobs: ["zombie", "skeleton", "creeper", "spider", "slime", "witch"],
    passiveMobs: ["frog"],
    resources: ["oak_log", "vines", "lily_pads", "mushrooms", "slime_balls"],
    structures: ["swamp_hut", "ruined_portal"],
    traversalSpeed: 0.6,
    navigationComplexity: "high",
    supplies: ["food", "torches", "bed", "boat", "potion_of_night_vision"],
    specialConsiderations: ["Witch huts dangerous", "Slimes spawn at night", "Water slows movement"],
    weatherHazards: ["heavy_rain", "flooding"]
  },
  mountains: {
    dimension: "overworld",
    category: "highland",
    terrain: "steep",
    difficulty: "hard",
    visibility: "excellent",
    hostileMobs: ["zombie", "skeleton", "creeper", "spider", "goat"],
    passiveMobs: ["goat", "llama"],
    resources: ["stone", "emerald_ore", "iron_ore", "coal_ore"],
    structures: ["mineshaft", "ruined_portal"],
    traversalSpeed: 0.4,
    navigationComplexity: "very_high",
    supplies: ["food", "torches", "bed", "pickaxe", "water_bucket", "blocks"],
    specialConsiderations: ["Fall damage risk", "Goats can knock you off", "Mining opportunities"],
    weatherHazards: ["height", "steep_cliffs"]
  },
  ocean: {
    dimension: "overworld",
    category: "aquatic",
    terrain: "water",
    difficulty: "hard",
    visibility: "limited_underwater",
    hostileMobs: ["drowned", "guardian", "elder_guardian"],
    passiveMobs: ["cod", "salmon", "dolphin", "turtle"],
    resources: ["kelp", "sea_grass", "prismarine", "sponge"],
    structures: ["ocean_monument", "shipwreck", "ocean_ruins", "buried_treasure"],
    traversalSpeed: 0.3,
    navigationComplexity: "very_high",
    supplies: ["food", "boat", "potion_of_water_breathing", "potion_of_night_vision", "door"],
    specialConsiderations: ["Breathing underwater critical", "Monuments very dangerous", "Dolphins help navigation"],
    weatherHazards: ["drowning", "darkness_underwater"]
  },

  // Nether Biomes
  nether_wastes: {
    dimension: "nether",
    category: "hellish",
    terrain: "varied",
    difficulty: "very_hard",
    visibility: "moderate",
    hostileMobs: ["zombie_pigman", "ghast", "magma_cube", "skeleton"],
    passiveMobs: [],
    resources: ["netherrack", "glowstone", "nether_quartz"],
    structures: ["nether_fortress", "bastion_remnant", "ruined_portal"],
    traversalSpeed: 0.7,
    navigationComplexity: "high",
    supplies: ["food", "fire_resistance_potion", "bow", "blocks", "flint_and_steel"],
    specialConsiderations: ["Ghasts destroy terrain", "Fire hazards everywhere", "No natural water"],
    weatherHazards: ["lava", "fire", "ghast_fireballs"]
  },
  crimson_forest: {
    dimension: "nether",
    category: "hellish",
    terrain: "forested",
    difficulty: "hard",
    visibility: "limited",
    hostileMobs: ["hoglin", "piglin", "zombified_piglin"],
    passiveMobs: ["strider"],
    resources: ["crimson_stem", "crimson_fungus", "weeping_vines", "shroomlight"],
    structures: ["bastion_remnant", "ruined_portal"],
    traversalSpeed: 0.6,
    navigationComplexity: "medium",
    supplies: ["food", "fire_resistance_potion", "gold_armor", "blocks"],
    specialConsiderations: ["Piglins trade gold", "Hoglins very dangerous", "Dense vegetation"],
    weatherHazards: ["lava", "hoglin_attacks"]
  },
  soul_sand_valley: {
    dimension: "nether",
    category: "hellish",
    terrain: "slow",
    difficulty: "very_hard",
    visibility: "moderate",
    hostileMobs: ["ghast", "skeleton", "enderman"],
    passiveMobs: ["strider"],
    resources: ["soul_sand", "soul_soil", "basalt", "nether_fossils"],
    structures: ["nether_fortress", "bastion_remnant"],
    traversalSpeed: 0.3,
    navigationComplexity: "high",
    supplies: ["food", "fire_resistance_potion", "bow", "soul_speed_boots", "blocks"],
    specialConsiderations: ["Soul sand drastically slows movement", "Many ghasts", "Eerie atmosphere"],
    weatherHazards: ["lava", "slow_terrain", "ghast_fireballs"]
  },

  // End Biomes
  the_end: {
    dimension: "end",
    category: "void",
    terrain: "floating",
    difficulty: "extreme",
    visibility: "good",
    hostileMobs: ["enderman", "ender_dragon", "shulker"],
    passiveMobs: [],
    resources: ["end_stone", "chorus_fruit", "purpur", "shulker_shells"],
    structures: ["end_city", "end_ship"],
    traversalSpeed: 0.8,
    navigationComplexity: "extreme",
    supplies: ["food", "ender_pearls", "bow", "blocks", "slow_falling_potion", "pumpkin"],
    specialConsiderations: ["Void death instant", "Endermen everywhere", "Shulkers levitate you"],
    weatherHazards: ["void", "enderman_aggro", "shulker_levitation"]
  },

  // Special Biomes
  mushroom_fields: {
    dimension: "overworld",
    category: "rare",
    terrain: "varied",
    difficulty: "easy",
    visibility: "excellent",
    hostileMobs: [],
    passiveMobs: ["mooshroom"],
    resources: ["mycelium", "mushrooms", "mooshroom"],
    structures: [],
    traversalSpeed: 1.0,
    navigationComplexity: "low",
    supplies: ["food", "bed"],
    specialConsiderations: ["No hostile mobs spawn", "Very rare biome", "Mushroom soup renewable"],
    weatherHazards: []
  },
  ice_spikes: {
    dimension: "overworld",
    category: "frozen",
    terrain: "spiky",
    difficulty: "medium",
    visibility: "excellent",
    hostileMobs: ["zombie", "skeleton", "creeper", "spider", "stray"],
    passiveMobs: ["polar_bear", "rabbit"],
    resources: ["packed_ice", "ice", "snow"],
    structures: ["igloo"],
    traversalSpeed: 0.9,
    navigationComplexity: "medium",
    supplies: ["food", "torches", "bed", "warm_clothing", "pickaxe"],
    specialConsiderations: ["Packed ice valuable", "Polar bears hostile if provoked", "Very cold"],
    weatherHazards: ["freezing", "ice"]
  }
};

/* =====================================================
 * STRUCTURE FINDING SYSTEM
 * Core functionality for locating structures
 * ===================================================== */

const STRUCTURE_PROFILES = {
  // Overworld Villages and Settlements
  village: {
    biomes: ["plains", "desert", "savanna", "taiga", "snowy_tundra"],
    rarity: "common",
    findingDifficulty: "easy",
    searchStrategy: "grid_search",
    visualCues: ["buildings", "paths", "farms", "lights_at_night"],
    detectableFrom: 100, // blocks
    searchRadius: 500,
    loot: ["crops", "tools", "weapons", "armor", "emeralds"],
    dangers: ["pillagers", "iron_golem"],
    preparations: ["trading_items", "defense_gear"],
    navigationTips: ["Follow paths", "Look for smoke from chimneys", "Check plains first"],
    worthRevisiting: true
  },
  pillager_outpost: {
    biomes: ["plains", "desert", "savanna", "taiga"],
    rarity: "uncommon",
    findingDifficulty: "medium",
    searchStrategy: "spiral_search",
    visualCues: ["tall_tower", "cages", "banners"],
    detectableFrom: 120,
    searchRadius: 600,
    loot: ["crossbows", "arrows", "dark_oak_logs"],
    dangers: ["pillagers", "vindicators", "ravagers"],
    preparations: ["armor", "weapons", "shields", "golden_apples"],
    navigationTips: ["Look for tall structures", "Often near villages", "Approach with caution"],
    worthRevisiting: false
  },

  // Temples
  desert_temple: {
    biomes: ["desert"],
    rarity: "uncommon",
    findingDifficulty: "medium",
    searchStrategy: "grid_search",
    visualCues: ["orange_terracotta", "pyramid_shape", "symmetrical"],
    detectableFrom: 80,
    searchRadius: 800,
    loot: ["diamonds", "emeralds", "gold", "enchanted_books", "horse_armor"],
    dangers: ["tnt_trap", "fall_damage"],
    preparations: ["shovel", "pickaxe", "torches", "caution"],
    navigationTips: ["Search flat desert areas", "Look for orange terracotta", "Disarm TNT trap"],
    worthRevisiting: false
  },
  jungle_temple: {
    biomes: ["jungle"],
    rarity: "rare",
    findingDifficulty: "hard",
    searchStrategy: "systematic_clearing",
    visualCues: ["cobblestone", "mossy_cobblestone", "vines"],
    detectableFrom: 30,
    searchRadius: 1000,
    loot: ["diamonds", "emeralds", "gold", "iron"],
    dangers: ["arrow_trap", "dispenser_trap"],
    preparations: ["axe", "shears", "torches", "caution"],
    navigationTips: ["Cut through dense jungle", "Look for moss stone", "Very hard to spot"],
    worthRevisiting: false
  },

  // Rare Structures
  woodland_mansion: {
    biomes: ["dark_forest"],
    rarity: "very_rare",
    findingDifficulty: "extreme",
    searchStrategy: "cartographer_map",
    visualCues: ["large_building", "dark_oak", "cobblestone"],
    detectableFrom: 150,
    searchRadius: 20000,
    loot: ["totems_of_undying", "diamonds", "emeralds", "enchanted_books"],
    dangers: ["vindicators", "evokers", "vexes"],
    preparations: ["full_armor", "weapons", "shields", "food", "totems"],
    navigationTips: ["Use cartographer map", "Extremely far", "Prepare for long journey"],
    worthRevisiting: true
  },
  ocean_monument: {
    biomes: ["ocean", "deep_ocean"],
    rarity: "rare",
    findingDifficulty: "hard",
    searchStrategy: "ocean_exploration",
    visualCues: ["prismarine", "large_structure", "guardians"],
    detectableFrom: 60,
    searchRadius: 1500,
    loot: ["sponges", "prismarine", "gold_blocks", "sea_lanterns"],
    dangers: ["guardians", "elder_guardians", "mining_fatigue", "drowning"],
    preparations: ["water_breathing_potions", "night_vision_potions", "armor", "food"],
    navigationTips: ["Search deep ocean", "Look for guardian spawns", "Prepare for underwater combat"],
    worthRevisiting: true
  },

  // Nether Structures
  nether_fortress: {
    biomes: ["nether_wastes", "soul_sand_valley"],
    rarity: "uncommon",
    findingDifficulty: "medium",
    searchStrategy: "nether_highway_search",
    visualCues: ["nether_brick", "bridges", "towers"],
    detectableFrom: 100,
    searchRadius: 800,
    loot: ["nether_wart", "blaze_rods", "diamonds", "horse_armor"],
    dangers: ["blazes", "wither_skeletons", "lava"],
    preparations: ["fire_resistance", "armor", "bow", "blocks"],
    navigationTips: ["Travel along Z axis", "Look for dark brick", "Build bridges"],
    worthRevisiting: true
  },
  bastion_remnant: {
    biomes: ["nether_wastes", "crimson_forest", "warped_forest", "soul_sand_valley"],
    rarity: "uncommon",
    findingDifficulty: "medium",
    searchStrategy: "random_exploration",
    visualCues: ["blackstone", "gold_blocks", "piglins"],
    detectableFrom: 80,
    searchRadius: 600,
    loot: ["ancient_debris", "gold", "enchanted_gear", "netherite_scrap"],
    dangers: ["piglins", "piglin_brutes", "magma_cubes", "lava"],
    preparations: ["gold_armor", "fire_resistance", "weapons", "blocks"],
    navigationTips: ["Wear gold armor", "Avoid piglin brutes", "Search all biomes"],
    worthRevisiting: true
  },

  // End Structures
  end_city: {
    biomes: ["the_end"],
    rarity: "uncommon",
    findingDifficulty: "medium",
    searchStrategy: "island_hopping",
    visualCues: ["purpur_blocks", "tall_towers", "shulkers"],
    detectableFrom: 120,
    searchRadius: 1000,
    loot: ["elytra", "shulker_shells", "enchanted_gear", "diamonds"],
    dangers: ["shulkers", "void", "levitation"],
    preparations: ["ender_pearls", "blocks", "slow_falling_potions", "armor"],
    navigationTips: ["Bridge between islands", "Look for tall purpur structures", "Watch for void"],
    worthRevisiting: true
  },

  // Common Structures
  mineshaft: {
    biomes: ["any_underground", "badlands"],
    rarity: "common",
    findingDifficulty: "medium",
    searchStrategy: "cave_exploration",
    visualCues: ["oak_planks", "rails", "cobwebs"],
    detectableFrom: 20,
    searchRadius: 300,
    loot: ["rails", "minecarts", "ores", "melon_seeds"],
    dangers: ["cave_spiders", "falls", "lava"],
    preparations: ["torches", "pickaxe", "armor", "food", "milk"],
    navigationTips: ["Explore caves", "Follow rail sounds", "Badlands have exposed mineshafts"],
    worthRevisiting: false
  },
  stronghold: {
    biomes: ["any_overworld"],
    rarity: "very_rare",
    findingDifficulty: "extreme",
    searchStrategy: "ender_eye_tracking",
    visualCues: ["stone_bricks", "iron_bars", "underground"],
    detectableFrom: 10,
    searchRadius: 3000,
    loot: ["end_portal", "library_books", "ores"],
    dangers: ["silverfish", "falls", "dead_ends"],
    preparations: ["ender_eyes", "pickaxe", "torches", "blocks", "food"],
    navigationTips: ["Use eyes of ender", "Dig down carefully", "Mark your path"],
    worthRevisiting: true
  },

  // Small Structures
  shipwreck: {
    biomes: ["ocean", "beach"],
    rarity: "common",
    findingDifficulty: "easy",
    searchStrategy: "ocean_scanning",
    visualCues: ["wood_planks", "broken_ship"],
    detectableFrom: 40,
    searchRadius: 400,
    loot: ["treasure_map", "iron", "gold", "emeralds"],
    dangers: ["drowned", "drowning"],
    preparations: ["boat", "water_breathing", "weapon"],
    navigationTips: ["Scan ocean floor", "Check beaches", "Often partially buried"],
    worthRevisiting: false
  },
  buried_treasure: {
    biomes: ["beach"],
    rarity: "uncommon",
    findingDifficulty: "medium",
    searchStrategy: "treasure_map",
    visualCues: ["X_marks_spot"],
    detectableFrom: 0,
    searchRadius: 50,
    loot: ["heart_of_the_sea", "diamonds", "emeralds", "iron"],
    dangers: ["drowned"],
    preparations: ["treasure_map", "shovel"],
    navigationTips: ["Get map from shipwreck", "Dig at X", "Usually 3-6 blocks deep"],
    worthRevisiting: false
  },
  ruined_portal: {
    biomes: ["any"],
    rarity: "common",
    findingDifficulty: "easy",
    searchStrategy: "random_exploration",
    visualCues: ["obsidian", "crying_obsidian", "netherrack"],
    detectableFrom: 60,
    searchRadius: 500,
    loot: ["gold", "flint_and_steel", "obsidian", "enchanted_gear"],
    dangers: ["lava", "falls"],
    preparations: ["pickaxe", "water_bucket"],
    navigationTips: ["Very common", "Can spawn anywhere", "Check chest for loot"],
    worthRevisiting: false
  }
};

/* =====================================================
 * NAVIGATION STRATEGIES
 * Actual pathfinding and exploration techniques
 * ===================================================== */

const NAVIGATION_STRATEGIES = {
  // Basic Exploration Patterns
  grid_search: {
    name: "Grid Search",
    description: "Systematic grid pattern covering area methodically",
    efficiency: 0.95,
    coverage: "complete",
    difficulty: "easy",
    bestFor: ["plains", "desert", "flat_terrain"],
    technique: "Move in parallel lines, spacing 50-100 blocks apart",
    requirements: ["compass", "coordinates"],
    tips: [
      "Mark starting point clearly",
      "Maintain consistent spacing",
      "Use F3 to track coordinates",
      "Place markers every 100 blocks"
    ]
  },
  spiral_search: {
    name: "Spiral Search",
    description: "Expanding spiral from center point",
    efficiency: 0.85,
    coverage: "complete",
    difficulty: "medium",
    bestFor: ["centered_search", "structure_hunting"],
    technique: "Start at center, move outward in expanding square spiral",
    requirements: ["compass", "starting_point"],
    tips: [
      "Mark center with beacon/tower",
      "Increase spiral size gradually",
      "Good for finding nearby structures",
      "Use coordinates to track pattern"
    ]
  },
  random_walk: {
    name: "Random Walk",
    description: "Random direction changes, exploring organically",
    efficiency: 0.4,
    coverage: "incomplete",
    difficulty: "easy",
    bestFor: ["casual_exploration", "biome_hunting"],
    technique: "Travel in random directions, following interesting features",
    requirements: ["compass", "waypoint_markers"],
    tips: [
      "Leave breadcrumb trail",
      "Note coordinates periodically",
      "Low efficiency but good for discovery",
      "Easy to get lost"
    ]
  },

  // Advanced Strategies
  nether_highway_search: {
    name: "Nether Highway Search",
    description: "Build protected pathways in Nether for fast travel",
    efficiency: 0.7,
    coverage: "linear",
    difficulty: "hard",
    bestFor: ["nether_fortress", "long_distance_travel"],
    technique: "Build enclosed tunnel along axis, search perpendicular",
    requirements: ["blocks", "pickaxe", "fire_resistance"],
    tips: [
      "Build along Z axis for fortresses",
      "Protect from ghasts with walls",
      "Branch out perpendicular every 100 blocks",
      "Light up to prevent spawns"
    ]
  },
  cartographer_map: {
    name: "Cartographer Map Tracking",
    description: "Use explorer maps from cartographer villagers",
    efficiency: 1.0,
    coverage: "targeted",
    difficulty: "easy",
    bestFor: ["woodland_mansion", "ocean_monument"],
    technique: "Trade with cartographer, follow map to structure",
    requirements: ["emeralds", "village", "map"],
    tips: [
      "Find cartographer villager",
      "Trade for explorer map",
      "Follow white marker",
      "Prepare for long journey"
    ]
  },
  ender_eye_tracking: {
    name: "Eye of Ender Tracking",
    description: "Use eyes of ender to locate stronghold",
    efficiency: 1.0,
    coverage: "targeted",
    difficulty: "medium",
    bestFor: ["stronghold"],
    technique: "Throw eyes, follow direction, triangulate position",
    requirements: ["eyes_of_ender", "blocks", "pickaxe"],
    tips: [
      "Bring 12+ eyes of ender",
      "Throw every 20 blocks when close",
      "Eyes break 20% of time",
      "Dig down when eye goes into ground"
    ]
  },

  // Terrain-Specific Strategies
  ocean_exploration: {
    name: "Ocean Exploration",
    description: "Systematic ocean floor scanning",
    efficiency: 0.6,
    coverage: "moderate",
    difficulty: "hard",
    bestFor: ["ocean_monument", "shipwreck", "ruins"],
    technique: "Boat on surface, dive periodically to scan floor",
    requirements: ["boat", "water_breathing", "night_vision"],
    tips: [
      "Use dolphin's grace for speed",
      "Night vision helps underwater",
      "Monuments visible from surface",
      "Check for guardian spawns"
    ]
  },
  cave_exploration: {
    name: "Cave Exploration",
    description: "Safe systematic cave network exploration",
    efficiency: 0.5,
    coverage: "moderate",
    difficulty: "medium",
    bestFor: ["mineshaft", "dungeons", "ores"],
    technique: "Torches on right, explore all branches",
    requirements: ["torches", "pickaxe", "armor", "food"],
    tips: [
      "Torches on right wall going in",
      "Mark dead ends with crosses",
      "Bring extra torches",
      "Listen for mob/minecart sounds"
    ]
  },
  island_hopping: {
    name: "Island Hopping",
    description: "Bridge between End islands systematically",
    efficiency: 0.7,
    coverage: "moderate",
    difficulty: "extreme",
    bestFor: ["end_city", "chorus_fruit"],
    technique: "Build bridges between outer islands",
    requirements: ["blocks", "ender_pearls", "slow_falling_potions"],
    tips: [
      "Always build with blocks beneath you",
      "Keep ender pearls for emergencies",
      "Slow falling saves from void",
      "Mark bridges for return trip"
    ]
  },
  systematic_clearing: {
    name: "Systematic Clearing",
    description: "Clear vegetation to reveal hidden structures",
    efficiency: 0.8,
    coverage: "complete",
    difficulty: "hard",
    bestFor: ["jungle_temple", "dense_forest"],
    technique: "Clear trees/vegetation in grid pattern",
    requirements: ["axe", "shears", "time"],
    tips: [
      "Work in sections",
      "Look for unnatural blocks",
      "Jungle temples have mossy cobble",
      "Very time consuming"
    ]
  },

  // Speed Strategies
  ice_highway: {
    name: "Ice Highway Travel",
    description: "Use blue ice for super fast travel",
    efficiency: 0.9,
    coverage: "linear",
    difficulty: "medium",
    bestFor: ["long_distance", "speed"],
    technique: "Build ice path, use boat for 8x speed",
    requirements: ["blue_ice", "boat"],
    tips: [
      "Blue ice fastest (boats reach 72 m/s)",
      "Build in Nether for 8x overworld distance",
      "Protect from mobs",
      "Corners slow you down"
    ]
  },
  elytra_search: {
    name: "Elytra Aerial Search",
    description: "Fly over terrain for rapid scouting",
    efficiency: 0.95,
    coverage: "high",
    difficulty: "medium",
    bestFor: ["any_overworld", "biome_hunting"],
    technique: "Fly high, scan terrain below",
    requirements: ["elytra", "rockets", "high_altitude"],
    tips: [
      "Fly at cloud level for best view",
      "Bring lots of rockets",
      "Mark locations with coordinates",
      "Watch for anti-air (phantoms)"
    ]
  }
};

/* =====================================================
 * HELPER FUNCTIONS
 * Supporting functions for exploration planning
 * ===================================================== */

/**
 * Get biome profile or return default
 */
function getBiomeProfile(biomeName) {
  const normalizedBiome = normalizeItemName(biomeName);
  return BIOME_PROFILES[normalizedBiome] || {
    dimension: "overworld",
    difficulty: "medium",
    supplies: ["food", "torches", "bed"],
    specialConsiderations: [],
    weatherHazards: []
  };
}

/**
 * Get structure profile or return default
 */
function getStructureProfile(structureName) {
  const normalizedStructure = normalizeItemName(structureName);
  return STRUCTURE_PROFILES[normalizedStructure] || {
    rarity: "unknown",
    findingDifficulty: "medium",
    searchStrategy: "random_walk",
    preparations: ["basic_supplies"],
    navigationTips: []
  };
}

/**
 * Get navigation strategy or return default
 */
function getNavigationStrategy(strategyName) {
  const normalizedStrategy = normalizeItemName(strategyName);
  return NAVIGATION_STRATEGIES[normalizedStrategy] || NAVIGATION_STRATEGIES.grid_search;
}

/**
 * Calculate estimated exploration duration
 */
function calculateExplorationDuration(radius, biome, strategy) {
  const baseTime = 10000; // Base 10 seconds
  const radiusTime = radius ? radius * 100 : 5000;
  const biomeMultiplier = biome?.traversalSpeed || 1.0;
  const strategyMultiplier = strategy?.efficiency || 0.8;

  return Math.floor(baseTime + (radiusTime / biomeMultiplier / strategyMultiplier));
}

/**
 * Determine best navigation strategy based on context
 */
function determineBestStrategy(task, biome, structure) {
  // If searching for specific structure, use its recommended strategy
  if (structure?.searchStrategy) {
    return getNavigationStrategy(structure.searchStrategy);
  }

  // If task specifies strategy, use it
  if (task?.metadata?.navigationStrategy) {
    return getNavigationStrategy(task.metadata.navigationStrategy);
  }

  // Otherwise, pick based on biome
  if (biome?.terrain === "flat" || biome?.terrain === "flat_sandy") {
    return NAVIGATION_STRATEGIES.grid_search;
  } else if (biome?.navigationComplexity === "very_high") {
    return NAVIGATION_STRATEGIES.systematic_clearing;
  } else if (biome?.dimension === "nether") {
    return NAVIGATION_STRATEGIES.nether_highway_search;
  } else if (biome?.dimension === "end") {
    return NAVIGATION_STRATEGIES.island_hopping;
  }

  // Default to spiral search
  return NAVIGATION_STRATEGIES.spiral_search;
}

export function planExploreTask(task, context = {}) {
  // ===== Extract Task Parameters =====
  const targetDescription = describeTarget(task.target);
  const biomeName = normalizeItemName(task?.metadata?.biome || context?.biome || "plains");
  const structureName = task?.metadata?.structure ? normalizeItemName(task.metadata.structure) : null;
  const radius = resolveQuantity(task?.metadata?.radius ?? task?.metadata?.range, null);
  const transport = normalizeItemName(task?.metadata?.transport || "foot");
  const preferredTool = normalizeItemName(task?.metadata?.tool || "map");

  const poi = Array.isArray(task?.metadata?.pointsOfInterest)
    ? task.metadata.pointsOfInterest.map(normalizeItemName)
    : [];

  // ===== Load Profiles =====
  const biome = getBiomeProfile(biomeName);
  const structure = structureName ? getStructureProfile(structureName) : null;
  const strategy = determineBestStrategy(task, biome, structure);

  // ===== Determine Supplies Based on Biome and Structure =====
  const suppliesRaw = Array.isArray(task?.metadata?.supplies)
    ? task.metadata.supplies
    : task?.metadata?.supplies && typeof task.metadata.supplies === "object"
    ? Object.entries(task.metadata.supplies).map(([name, count]) => ({ name, count }))
    : task?.metadata?.supplies
    ? [task.metadata.supplies]
    : [];

  // Combine biome supplies, structure preparations, and strategy requirements
  const baseSupplies = [...(biome.supplies || [])];
  const structureSupplies = structure?.preparations || [];
  const strategySupplies = strategy?.requirements || [];
  const allSupplies = [...baseSupplies, ...structureSupplies, ...strategySupplies, ...suppliesRaw];

  const inventory = extractInventory(context);
  const normalizedSupplies = allSupplies
    .map(item => {
      if (typeof item === "string") {
        return { name: normalizeItemName(item) };
      }
      if (item && typeof item === "object") {
        return {
          name: normalizeItemName(item.name || item.item || item.id || Object.keys(item)[0]),
          count: resolveQuantity(item.count ?? item.quantity ?? Object.values(item)[0], null)
        };
      }
      return null;
    })
    .filter(Boolean);

  // Remove duplicates
  const uniqueSuppliesMap = new Map();
  normalizedSupplies.forEach(supply => {
    if (!uniqueSuppliesMap.has(supply.name)) {
      uniqueSuppliesMap.set(supply.name, supply);
    }
  });
  const uniqueSupplies = Array.from(uniqueSuppliesMap.values());

  const missingSupplies = uniqueSupplies.filter(supply =>
    supply?.name ? !hasInventoryItem(inventory, supply.name) : false
  );

  // ===== Build Steps =====
  const steps = [];

  // Preparation Step - Enhanced with biome/structure awareness
  const suppliesSummary = formatRequirementList(uniqueSupplies) || "expedition supplies";
  const missingSuppliesSummary = formatRequirementList(missingSupplies);

  let prepDescription = "";
  if (structure) {
    prepDescription = `Prepare for ${structure.rarity} structure hunting in ${biome.category} biome. `;
  } else {
    prepDescription = `Prepare for ${biome.category} biome exploration. `;
  }

  if (missingSupplies.length > 0) {
    prepDescription += missingSuppliesSummary
      ? `Stock up on: ${missingSuppliesSummary}.`
      : "Stock up on missing expedition supplies.";
  } else {
    prepDescription += `Verify you have: ${suppliesSummary}.`;
  }

  steps.push(
    createStep({
      title: "Prepare expedition",
      type: "preparation",
      description: prepDescription,
      metadata: {
        biome: biomeName,
        structure: structureName,
        supplies: uniqueSupplies,
        missing: missingSupplies
      }
    })
  );

  // Biome-Specific Preparation Warnings
  if (biome.specialConsiderations && biome.specialConsiderations.length > 0) {
    steps.push(
      createStep({
        title: "Review biome hazards",
        type: "preparation",
        description: `${biome.category} biome notes: ${biome.specialConsiderations.join("; ")}.`,
        metadata: { biomeName, considerations: biome.specialConsiderations }
      })
    );
  }

  // Structure-Specific Preparation
  if (structure && structure.navigationTips.length > 0) {
    steps.push(
      createStep({
        title: `Locate ${structureName}`,
        type: "preparation",
        description: `Tips for finding ${structureName}: ${structure.navigationTips.join("; ")}.`,
        metadata: { structure: structureName, tips: structure.navigationTips }
      })
    );
  }

  // Navigation Strategy Step
  steps.push(
    createStep({
      title: `Execute ${strategy.name}`,
      type: "navigation",
      description: `${strategy.description} - ${strategy.technique}. Tips: ${strategy.tips.join("; ")}.`,
      metadata: {
        strategy: strategy.name,
        efficiency: strategy.efficiency,
        requirements: strategy.requirements
      }
    })
  );

  // Tool Calibration
  steps.push(
    createStep({
      title: "Calibrate navigation tools",
      type: "preparation",
      description: `Ensure ${preferredTool}, compass, and coordinates (F3) are ready for ${strategy.name.toLowerCase()}.`,
      metadata: { tool: preferredTool, strategy: strategy.name }
    })
  );

  // Transport Preparation
  if (transport && transport !== "foot") {
    const transportBonus = biome.traversalSpeed >= 0.8
      ? "Good terrain for fast travel."
      : "Difficult terrain may slow travel.";
    steps.push(
      createStep({
        title: "Ready transport",
        type: "preparation",
        description: `Prepare ${transport} for travel. ${transportBonus}`,
        metadata: { transport, terrainSpeed: biome.traversalSpeed }
      })
    );
  }

  // Travel Step - Enhanced with strategy and radius
  const searchRadiusDescription = structure
    ? `Search within ${structure.searchRadius} block radius`
    : radius
    ? `Explore within ${radius} block radius`
    : "Explore the region";

  const travelDescription = `${searchRadiusDescription} of ${targetDescription} using ${strategy.name}. Mark waypoints and safe routes.`;

  steps.push(
    createStep({
      title: "Travel and explore",
      type: "movement",
      description: travelDescription,
      metadata: {
        radius: structure?.searchRadius || radius,
        transport,
        strategy: strategy.name,
        biome: biomeName
      }
    })
  );

  // Structure-Specific Search Step
  if (structure) {
    const visualCues = structure.visualCues.join(", ");
    steps.push(
      createStep({
        title: `Search for ${structureName}`,
        type: "observation",
        description: `Look for visual cues: ${visualCues}. Detectable from ~${structure.detectableFrom} blocks away.`,
        metadata: {
          structure: structureName,
          visualCues: structure.visualCues,
          detectableRange: structure.detectableFrom
        }
      })
    );
  }

  // Map Chunks (if requested)
  if (task?.metadata?.mapOutChunks) {
    steps.push(
      createStep({
        title: "Map chunks",
        type: "observation",
        description: "Chart chunk boundaries and update locator maps for the region."
      })
    );
  }

  // Survey and Document
  const surveyDescription = poi.length > 0
    ? `Document specific points of interest: ${poi.join(", ")}.`
    : structure
    ? `Document ${structureName} location, loot (${structure.loot.join(", ")}), and dangers (${structure.dangers.join(", ")}).`
    : `Document notable terrain, resources (${biome.resources.join(", ")}), and any structures found.`;

  steps.push(
    createStep({
      title: "Survey and document",
      type: "observation",
      description: surveyDescription,
      metadata: {
        poi,
        structure: structureName,
        biomeResources: biome.resources
      }
    })
  );

  // Place Waypoints
  if (task?.metadata?.waypoints || biome.navigationComplexity === "very_high") {
    steps.push(
      createStep({
        title: "Place waypoints",
        type: "action",
        description: `Drop markers or beacons at strategic spots. Critical for ${biome.navigationComplexity} complexity terrain.`,
        metadata: {
          waypoints: task?.metadata?.waypoints,
          navigationComplexity: biome.navigationComplexity
        }
      })
    );
  }

  // Return Journey
  steps.push(
    createStep({
      title: "Return safely",
      type: "movement",
      description: `Follow marked waypoints back to base. Watch for ${biome.hostileMobs.slice(0, 3).join(", ")}.`,
      metadata: { biome: biomeName, hostiles: biome.hostileMobs }
    })
  );

  // Report
  const reportLoot = structure?.loot ? `Loot collected: ${structure.loot.join(", ")}.` : "";
  steps.push(
    createStep({
      title: "Report findings",
      type: "report",
      description: `Share coordinates, screenshots, and notes. ${reportLoot}`,
      metadata: {
        report: task?.metadata?.reportFormat || "summary",
        structure: structureName
      }
    })
  );

  // ===== Calculate Duration =====
  const estimatedDuration = calculateExplorationDuration(
    structure?.searchRadius || radius,
    biome,
    strategy
  );

  // ===== Compile Resources =====
  const resources = [preferredTool, transport]
    .concat(uniqueSupplies.map(supply => supply.name))
    .concat(strategy.requirements || [])
    .filter(name => name && name !== "unspecified item");
  const uniqueResources = [...new Set(resources)];

  // ===== Identify Risks =====
  const risks = [];

  // Biome-specific risks
  if (biome.weatherHazards && biome.weatherHazards.length > 0) {
    risks.push(`${biome.category} biome hazards: ${biome.weatherHazards.join(", ")}.`);
  }

  // Dimension-specific risks
  if (biome.dimension === "nether") {
    risks.push("Nether environment: fire resistance essential, no natural water, bed explosions.");
  } else if (biome.dimension === "end") {
    risks.push("End dimension: void death is permanent, endermen everywhere, bring blocks.");
  }

  // Structure-specific risks
  if (structure && structure.dangers.length > 0) {
    risks.push(`${structureName} dangers: ${structure.dangers.join(", ")}.`);
  }

  // Mob risks
  if (biome.hostileMobs && biome.hostileMobs.length > 0) {
    risks.push(`Hostile mobs in ${biomeName}: ${biome.hostileMobs.join(", ")}.`);
  }

  // Difficulty-based risk
  if (biome.difficulty === "hard" || biome.difficulty === "very_hard" || biome.difficulty === "extreme") {
    risks.push(`High difficulty (${biome.difficulty}) - bring backup supplies and armor.`);
  }

  // Night exploration
  if (task?.metadata?.nightRun) {
    risks.push("Night exploration significantly increases hostile mob encounters.");
  }

  // Navigation complexity
  if (biome.navigationComplexity === "very_high" || biome.navigationComplexity === "extreme") {
    risks.push(`${biome.navigationComplexity} navigation complexity - easy to get lost, mark paths clearly.`);
  }

  // ===== Additional Notes =====
  const notes = [];

  // Strategy efficiency note
  notes.push(`Using ${strategy.name} (${Math.round(strategy.efficiency * 100)}% efficiency, ${strategy.coverage} coverage).`);

  // Biome traversal note
  notes.push(`Terrain traversal speed: ${Math.round(biome.traversalSpeed * 100)}% of normal.`);

  // Structure rarity
  if (structure) {
    notes.push(`${structureName} rarity: ${structure.rarity}, finding difficulty: ${structure.findingDifficulty}.`);
    if (structure.worthRevisiting) {
      notes.push(`${structureName} worth marking for future visits.`);
    }
  }

  // Time constraints
  if (task?.metadata?.returnBy) {
    notes.push(`Return before ${task.metadata.returnBy}.`);
  }

  // Loot priority
  if (task?.metadata?.lootPriority) {
    notes.push(`Priority loot: ${task.metadata.lootPriority}.`);
  }

  // ===== Create and Return Plan =====
  return createPlan({
    task,
    summary: structure
      ? `Explore ${biomeName} biome to locate ${structureName} near ${targetDescription}.`
      : `Explore ${biomeName} biome near ${targetDescription} using ${strategy.name}.`,
    steps,
    estimatedDuration,
    resources: uniqueResources,
    risks,
    notes
  });
}
