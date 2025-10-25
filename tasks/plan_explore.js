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
 * CONSTANTS
 * ===================================================== */

// Risk thresholds for categorization
const RISK_THRESHOLD_HIGH = 60;
const RISK_THRESHOLD_MODERATE = 40;

// Risk levels
const RISK_LEVEL_LOW = "Low Risk";
const RISK_LEVEL_MODERATE = "Moderate Risk";
const RISK_LEVEL_HIGH = "High Risk";
const RISK_LEVEL_EXTREME = "Extreme Risk";

// Supply multipliers for long expeditions
const EXPEDITION_LONG_DISTANCE = 1000; // blocks

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
    hostileMobs: ["zombie", "skeleton", "creeper", "spider"],
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
 * RISK ASSESSMENT SYSTEM
 * Safety critical risk analysis and mitigation
 * ===================================================== */

const RISK_CATEGORIES = {
  // Environmental Risks
  VOID_DEATH: {
    severity: "critical",
    likelihood: "high",
    category: "environmental",
    description: "Fall into void results in instant death and loss of all items",
    mitigation: [
      "Bring ender pearls for emergency teleport",
      "Use slow falling potions near edges",
      "Build with blocks beneath you at all times",
      "Keep totem of undying in off-hand"
    ],
    preventable: true,
    requiredItems: ["ender_pearls", "slow_falling_potion", "blocks", "totem_of_undying"]
  },
  LAVA_DEATH: {
    severity: "critical",
    likelihood: "high",
    category: "environmental",
    description: "Lava causes rapid death and destroys items",
    mitigation: [
      "Drink fire resistance potion before travel",
      "Carry water bucket for emergencies",
      "Wear full armor with fire protection",
      "Avoid digging straight down"
    ],
    preventable: true,
    requiredItems: ["fire_resistance_potion", "water_bucket", "armor"]
  },
  DROWNING: {
    severity: "high",
    likelihood: "medium",
    category: "environmental",
    description: "Running out of air underwater",
    mitigation: [
      "Use water breathing potions",
      "Bring doors or signs for air pockets",
      "Wear turtle shell helmet (+10 seconds)",
      "Use respiration enchantment"
    ],
    preventable: true,
    requiredItems: ["water_breathing_potion", "door", "turtle_helmet"]
  },
  FALL_DAMAGE: {
    severity: "medium",
    likelihood: "high",
    category: "environmental",
    description: "High falls cause significant damage or death",
    mitigation: [
      "Use slow falling potions in mountains",
      "Carry water bucket for MLG water",
      "Wear feather falling boots",
      "Build scaffolding carefully"
    ],
    preventable: true,
    requiredItems: ["slow_falling_potion", "water_bucket", "feather_falling_boots"]
  },
  GETTING_LOST: {
    severity: "medium",
    likelihood: "very_high",
    category: "navigation",
    description: "Unable to find way back to base",
    mitigation: [
      "Note coordinates at regular intervals (F3)",
      "Place torches/markers on right side going out",
      "Use compass or lodestone compass",
      "Build tall pillars as landmarks",
      "Take screenshots of important locations"
    ],
    preventable: true,
    requiredItems: ["compass", "torches", "blocks"]
  },

  // Combat Risks
  MOB_OVERWHELM: {
    severity: "high",
    likelihood: "medium",
    category: "combat",
    description: "Surrounded by hostile mobs",
    mitigation: [
      "Light up area with torches constantly",
      "Carry ender pearls for escape",
      "Keep golden apples for emergency healing",
      "Bring shield for blocking",
      "Don't explore at night without preparation"
    ],
    preventable: true,
    requiredItems: ["torches", "ender_pearls", "golden_apples", "shield", "armor"]
  },
  WITHER_EFFECT: {
    severity: "critical",
    likelihood: "low",
    category: "combat",
    description: "Wither skeletons inflict deadly wither effect",
    mitigation: [
      "Bring milk buckets to cure wither",
      "Wear full armor",
      "Keep health topped up with golden apples",
      "Use shield to block hits"
    ],
    preventable: true,
    requiredItems: ["milk_bucket", "armor", "golden_apples", "shield"]
  },
  MINING_FATIGUE: {
    severity: "high",
    likelihood: "medium",
    category: "combat",
    description: "Elder guardians inflict mining fatigue III",
    mitigation: [
      "Kill elder guardians first with TNT or bow",
      "Drink milk to clear effect temporarily",
      "Use night vision to see underwater",
      "Bring multiple pickaxes"
    ],
    preventable: false,
    requiredItems: ["milk_bucket", "bow", "arrows", "tnt"]
  },
  EVOKER_VEXES: {
    severity: "high",
    likelihood: "medium",
    category: "combat",
    description: "Vexes pass through blocks and swarm",
    mitigation: [
      "Kill evoker immediately to stop spawns",
      "Use shield to block vex attacks",
      "Bring totems of undying",
      "Keep armor in good repair"
    ],
    preventable: true,
    requiredItems: ["shield", "totem_of_undying", "armor"]
  },

  // Resource Risks
  HUNGER_DEPLETION: {
    severity: "medium",
    likelihood: "high",
    category: "resource",
    description: "Running out of food during long expeditions",
    mitigation: [
      "Bring 2x expected food for journey",
      "Carry high-saturation food (golden carrots, steak)",
      "Bring fishing rod for emergency food",
      "Note food sources in biome"
    ],
    preventable: true,
    requiredItems: ["food", "fishing_rod"]
  },
  TOOL_BREAKAGE: {
    severity: "medium",
    likelihood: "medium",
    category: "resource",
    description: "Tools breaking mid-exploration",
    mitigation: [
      "Bring backup tools",
      "Use mending enchantment",
      "Carry materials to craft replacements",
      "Monitor durability regularly"
    ],
    preventable: true,
    requiredItems: ["backup_tools", "crafting_materials"]
  },
  OUT_OF_BLOCKS: {
    severity: "high",
    likelihood: "medium",
    category: "resource",
    description: "Running out of blocks for bridging/pillaring",
    mitigation: [
      "Bring at least 5 stacks of cheap blocks (dirt/cobble)",
      "Collect blocks while exploring",
      "Use ender pearls as backup",
      "Don't over-commit to dangerous bridges"
    ],
    preventable: true,
    requiredItems: ["blocks", "ender_pearls"]
  },

  // Weather/Time Risks
  NIGHT_AMBUSH: {
    severity: "medium",
    likelihood: "high",
    category: "time",
    description: "Caught in darkness with increased mob spawns",
    mitigation: [
      "Bring bed to sleep through night",
      "Carry extra torches",
      "Build temporary shelter if needed",
      "Watch in-game time"
    ],
    preventable: true,
    requiredItems: ["bed", "torches", "blocks"]
  },
  THUNDERSTORM_HAZARD: {
    severity: "low",
    likelihood: "low",
    category: "weather",
    description: "Lightning strikes and skeleton horse traps",
    mitigation: [
      "Avoid high ground during storms",
      "Sleep in bed to skip storm",
      "Don't stand near tall structures"
    ],
    preventable: true,
    requiredItems: ["bed"]
  }
};

/**
 * Assess risks for given exploration context
 * @param {Object} biome - Biome profile with terrain and danger information
 * @param {Object|null} structure - Optional structure profile
 * @param {Object} strategy - Navigation strategy
 * @param {Object} task - Task with metadata
 * @returns {Object} Risk assessment with activeRisks, criticalRisks, requiredMitigation, and riskScore (0-100)
 */
function assessRisks(biome, structure, strategy, task) {
  const activeRisks = [];
  const criticalRisks = [];
  const requiredMitigation = new Set();

  // Dimension-specific risks
  if (biome.dimension === "end") {
    activeRisks.push({
      ...RISK_CATEGORIES.VOID_DEATH,
      reason: "End dimension has void on all sides"
    });
    RISK_CATEGORIES.VOID_DEATH.requiredItems.forEach(item => requiredMitigation.add(item));
    criticalRisks.push("VOID_DEATH");
  }

  if (biome.dimension === "nether") {
    activeRisks.push({
      ...RISK_CATEGORIES.LAVA_DEATH,
      reason: "Nether has extensive lava lakes and falls"
    });
    RISK_CATEGORIES.LAVA_DEATH.requiredItems.forEach(item => requiredMitigation.add(item));
    criticalRisks.push("LAVA_DEATH");
  }

  // Biome terrain risks
  if (biome.terrain === "steep" || biome.terrain === "floating") {
    activeRisks.push({
      ...RISK_CATEGORIES.FALL_DAMAGE,
      reason: `${biome.terrain} terrain increases fall risk`
    });
    RISK_CATEGORIES.FALL_DAMAGE.requiredItems.forEach(item => requiredMitigation.add(item));
  }

  if (biome.category === "aquatic" || biome.terrain === "water") {
    activeRisks.push({
      ...RISK_CATEGORIES.DROWNING,
      reason: "Aquatic biome requires underwater exploration"
    });
    RISK_CATEGORIES.DROWNING.requiredItems.forEach(item => requiredMitigation.add(item));
  }

  // Navigation complexity
  if (biome.navigationComplexity === "very_high" || biome.navigationComplexity === "extreme") {
    activeRisks.push({
      ...RISK_CATEGORIES.GETTING_LOST,
      reason: `${biome.navigationComplexity} navigation complexity`,
      likelihood: "critical"
    });
    RISK_CATEGORIES.GETTING_LOST.requiredItems.forEach(item => requiredMitigation.add(item));
  }

  // Structure-specific risks
  if (structure) {
    if (structure.dangers.includes("elder_guardians")) {
      activeRisks.push({
        ...RISK_CATEGORIES.MINING_FATIGUE,
        reason: "Ocean monuments have elder guardians"
      });
      RISK_CATEGORIES.MINING_FATIGUE.requiredItems.forEach(item => requiredMitigation.add(item));
    }

    if (structure.dangers.includes("wither_skeletons")) {
      activeRisks.push({
        ...RISK_CATEGORIES.WITHER_EFFECT,
        reason: "Nether fortresses spawn wither skeletons"
      });
      RISK_CATEGORIES.WITHER_EFFECT.requiredItems.forEach(item => requiredMitigation.add(item));
    }

    if (structure.dangers.includes("evokers") || structure.dangers.includes("vexes")) {
      activeRisks.push({
        ...RISK_CATEGORIES.EVOKER_VEXES,
        reason: "Woodland mansions have evokers"
      });
      RISK_CATEGORIES.EVOKER_VEXES.requiredItems.forEach(item => requiredMitigation.add(item));
    }
  }

  // Mob density
  if (biome.hostileMobs && biome.hostileMobs.length >= 5) {
    activeRisks.push({
      ...RISK_CATEGORIES.MOB_OVERWHELM,
      reason: `High mob variety (${biome.hostileMobs.length} types)`
    });
    RISK_CATEGORIES.MOB_OVERWHELM.requiredItems.forEach(item => requiredMitigation.add(item));
  }

  // Resource depletion - always a risk on long expeditions
  const expeditionRadius = structure?.searchRadius || task?.metadata?.radius || 1000;
  if (expeditionRadius > EXPEDITION_LONG_DISTANCE) {
    activeRisks.push({
      ...RISK_CATEGORIES.HUNGER_DEPLETION,
      reason: `Long expedition (${expeditionRadius}+ blocks)`,
      likelihood: "very_high"
    });
    activeRisks.push({
      ...RISK_CATEGORIES.TOOL_BREAKAGE,
      reason: "Extended exploration time"
    });
    activeRisks.push({
      ...RISK_CATEGORIES.OUT_OF_BLOCKS,
      reason: "Long-distance travel requires building"
    });
  }

  // Night exploration
  if (task?.metadata?.nightRun) {
    activeRisks.push({
      ...RISK_CATEGORIES.NIGHT_AMBUSH,
      reason: "Intentional night exploration",
      likelihood: "critical"
    });
  }

  return {
    activeRisks,
    criticalRisks,
    requiredMitigation: Array.from(requiredMitigation),
    riskScore: calculateRiskScore(activeRisks)
  };
}

/**
 * Calculate overall risk score (0-100)
 */
function calculateRiskScore(risks) {
  if (!risks || !Array.isArray(risks) || risks.length === 0) {
    return 0; // No risks = no risk score
  }

  const severityScores = {
    critical: 40,
    high: 25,
    medium: 15,
    low: 5
  };

  const likelihoodMultipliers = {
    critical: 2.0,
    very_high: 1.5,
    high: 1.2,
    medium: 1.0,
    low: 0.7
  };

  let totalScore = 0;
  risks.forEach(risk => {
    const baseScore = severityScores[risk.severity] || 10;
    const multiplier = likelihoodMultipliers[risk.likelihood] || 1.0;
    totalScore += baseScore * multiplier;
  });

  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, Math.round(totalScore)));
}

/* =====================================================
 * SUPPLY CALCULATION SYSTEM
 * Mission planning with accurate supply quantities
 * ===================================================== */

const SUPPLY_REQUIREMENTS = {
  // Food - based on distance and difficulty
  food: {
    baseQuantity: 16, // Half a stack
    perBlockTraveled: 0.01, // 1 food per 100 blocks
    difficultyMultiplier: {
      easy: 0.8,
      medium: 1.0,
      hard: 1.3,
      very_hard: 1.6,
      extreme: 2.0
    },
    recommendedTypes: ["golden_carrots", "cooked_beef", "cooked_porkchop", "bread"]
  },

  // Torches - based on area and strategy
  torches: {
    baseQuantity: 64, // One stack
    perBlockRadius: 0.2, // More for larger areas
    navigationMultiplier: {
      low: 0.8,
      medium: 1.0,
      high: 1.5,
      very_high: 2.0,
      extreme: 3.0
    }
  },

  // Blocks - based on strategy and terrain
  blocks: {
    baseQuantity: 64, // One stack
    perBlockRadius: 0.15,
    terrainMultiplier: {
      flat: 0.5,
      flat_sandy: 0.5,
      varied: 1.0,
      hilly: 1.5,
      steep: 2.5,
      water: 2.0,
      floating: 3.0,
      slow: 1.2
    },
    recommendedTypes: ["cobblestone", "dirt", "netherrack", "end_stone"]
  },

  // Weapons and Combat
  weapons: {
    sword: { quantity: 1, backup: true },
    bow: { quantity: 1, backup: false },
    arrows: {
      baseQuantity: 64,
      structureMultiplier: {
        peaceful: 0.5,
        low_combat: 1.0,
        medium_combat: 2.0,
        high_combat: 3.0
      }
    },
    shield: { quantity: 1, backup: false }
  },

  // Tools - based on task needs
  tools: {
    pickaxe: { quantity: 1, backup: true },
    axe: { quantity: 1, backup: false },
    shovel: { quantity: 1, backup: false },
    hoe: { quantity: 0, backup: false }
  },

  // Potions - dimension and structure specific
  potions: {
    fire_resistance: {
      baseQuantity: 0,
      netherRequired: 3, // 8 minutes each = 24 min
      lavaRiskRequired: 2
    },
    water_breathing: {
      baseQuantity: 0,
      oceanRequired: 3,
      underwaterRequired: 3
    },
    night_vision: {
      baseQuantity: 0,
      underwaterRequired: 2,
      caveRequired: 1
    },
    slow_falling: {
      baseQuantity: 0,
      endRequired: 3,
      mountainsRequired: 1
    },
    healing: {
      baseQuantity: 0,
      combatRequired: 4
    },
    regeneration: {
      baseQuantity: 0,
      highRiskRequired: 2
    }
  },

  // Utility items
  utility: {
    bed: { quantity: 1, purpose: "set spawn and sleep" },
    compass: { quantity: 1, purpose: "navigation" },
    map: { quantity: 1, purpose: "charting" },
    ender_pearls: {
      baseQuantity: 4,
      endRequired: 16,
      emergencyRequired: 8
    },
    water_bucket: { quantity: 1, purpose: "MLG water and lava control" },
    milk_bucket: {
      baseQuantity: 0,
      witherRequired: 2,
      miningFatigueRequired: 3
    },
    golden_apples: {
      baseQuantity: 2,
      combatRequired: 4,
      highRiskRequired: 6
    },
    totem_of_undying: {
      baseQuantity: 0,
      extremeRiskRequired: 1,
      endRequired: 1
    }
  }
};

/**
 * Calculate required supplies for expedition
 * @param {Object} biome - Biome profile
 * @param {Object|null} structure - Optional structure profile
 * @param {Object} strategy - Navigation strategy
 * @param {number} radius - Exploration radius in blocks
 * @param {Object} risks - Risk assessment results
 * @returns {Object} Supply quantities with minimum safe values guaranteed
 */
function calculateSupplies(biome, structure, strategy, radius, risks) {
  const supplies = {};

  // Validate inputs
  if (!biome) {
    console.warn("No biome provided to calculateSupplies, using defaults");
    return { food: 16, torches: 64, blocks: 64, bed: 1, compass: 1, water_bucket: 1 };
  }

  const safeRadius = Math.max(0, radius || 500); // Ensure non-negative

  // Calculate food
  const foodBase = SUPPLY_REQUIREMENTS.food.baseQuantity;
  const foodDistance = safeRadius * SUPPLY_REQUIREMENTS.food.perBlockTraveled;
  const foodDifficulty = SUPPLY_REQUIREMENTS.food.difficultyMultiplier[biome.difficulty] || 1.0;
  supplies.food = Math.max(8, Math.ceil((foodBase + foodDistance) * foodDifficulty)); // At least 8 food

  // Calculate torches
  const torchBase = SUPPLY_REQUIREMENTS.torches.baseQuantity;
  const torchArea = safeRadius * SUPPLY_REQUIREMENTS.torches.perBlockRadius;
  const torchNav = SUPPLY_REQUIREMENTS.torches.navigationMultiplier[biome.navigationComplexity] || 1.0;
  supplies.torches = Math.max(16, Math.ceil((torchBase + torchArea) * torchNav)); // At least 16 torches

  // Calculate blocks
  const blockBase = SUPPLY_REQUIREMENTS.blocks.baseQuantity;
  const blockArea = safeRadius * SUPPLY_REQUIREMENTS.blocks.perBlockRadius;
  const blockTerrain = SUPPLY_REQUIREMENTS.blocks.terrainMultiplier[biome.terrain] || 1.0;
  supplies.blocks = Math.max(32, Math.ceil((blockBase + blockArea) * blockTerrain)); // At least 32 blocks

  // Combat supplies
  supplies.arrows = 64;
  if (structure?.findingDifficulty === "hard" || structure?.findingDifficulty === "extreme") {
    supplies.arrows = 128;
  }

  // Dimension-specific potions
  if (biome.dimension === "nether") {
    supplies.fire_resistance_potion = 3;
  }
  if (biome.category === "aquatic") {
    supplies.water_breathing_potion = 3;
    supplies.night_vision_potion = 2;
  }
  if (biome.dimension === "end") {
    supplies.slow_falling_potion = 3;
    supplies.ender_pearls = 16;
  }

  // Risk-based supplies
  if (risks.criticalRisks.includes("VOID_DEATH")) {
    supplies.ender_pearls = (supplies.ender_pearls || 0) + 8;
  }
  if (risks.criticalRisks.includes("LAVA_DEATH")) {
    supplies.fire_resistance_potion = (supplies.fire_resistance_potion || 0) + 2;
  }

  // Structure-specific
  if (structure) {
    if (structure.dangers.includes("elder_guardians")) {
      supplies.milk_bucket = 3;
    }
    if (structure.dangers.includes("wither_skeletons")) {
      supplies.milk_bucket = (supplies.milk_bucket || 0) + 2;
    }
  }

  // High-risk expeditions
  if (risks.riskScore >= RISK_THRESHOLD_HIGH) {
    supplies.golden_apples = 6;
    supplies.healing_potion = 4;
  } else if (risks.riskScore >= RISK_THRESHOLD_MODERATE) {
    supplies.golden_apples = 4;
    supplies.healing_potion = 2;
  } else {
    supplies.golden_apples = 2;
  }

  // Always bring basics
  supplies.bed = 1;
  supplies.compass = 1;
  supplies.water_bucket = 1;

  return supplies;
}

/* =====================================================
 * EMERGENCY PROTOCOLS
 * Failure recovery and contingency planning
 * ===================================================== */

const EMERGENCY_PROTOCOLS = {
  // Life-threatening emergencies
  IMMINENT_DEATH: {
    priority: "critical",
    triggers: ["low_health", "surrounded", "falling_into_void"],
    immediateActions: [
      "Use totem of undying if available",
      "Eat golden apple immediately",
      "Throw ender pearl to escape",
      "Build emergency pillar/wall with blocks",
      "Use slow falling potion if falling"
    ],
    fallbackActions: [
      "Accept death and note coordinates for item recovery",
      "Take screenshot of death location (F2)",
      "Log coordinates in chat before death"
    ]
  },

  LOST_NAVIGATION: {
    priority: "high",
    triggers: ["unknown_location", "out_of_markers", "disoriented"],
    immediateActions: [
      "STOP MOVING - don't make it worse",
      "Open F3 and note current coordinates",
      "Check compass direction to original spawn",
      "Look for sun/moon position (East/West)",
      "Build tall pillar and scan horizon"
    ],
    recoverySteps: [
      "If you have bed coordinates, navigate by F3",
      "Follow compass to spawn, then navigate from there",
      "Use lodestone compass if available",
      "Build temporary shelter and wait for sunrise",
      "Place torches in arrow pattern pointing home"
    ],
    prevention: [
      "Mark coordinates every 200 blocks",
      "Place torches on RIGHT going out",
      "Build tall pillars every 500 blocks",
      "Take regular screenshots"
    ]
  },

  OUT_OF_SUPPLIES: {
    priority: "high",
    triggers: ["no_food", "no_torches", "no_blocks", "broken_tools"],
    immediateActions: [
      "Assess what resources are available in area",
      "If starving: hunt animals, fish, or eat emergency food",
      "If no torches: craft from coal/wood or use bed to skip night",
      "If no blocks: mine stone/dirt/netherrack",
      "If tools broken: craft new from gathered materials"
    ],
    resourceGathering: {
      food: ["Kill passive mobs", "Fish with rod", "Harvest crops if near village"],
      torches: ["Mine coal", "Craft from wood + coal", "Use glowstone/lanterns"],
      blocks: ["Mine any breakable block", "Collect dirt", "Cut trees"],
      tools: ["Craft from gathered materials", "Find in structures"]
    },
    lastResort: [
      "Navigate back without supplies if close to home",
      "Build shelter and establish mini-base",
      "Use /kill if in creative/admin to reset (loses items)"
    ]
  },

  HOSTILE_MOB_SWARM: {
    priority: "high",
    triggers: ["surrounded_by_mobs", "night_caught", "spawner_nearby"],
    immediateActions: [
      "Pillar up 3 blocks immediately",
      "Eat golden apple for absorption",
      "Use shield to block attacks",
      "Place torches to stop spawns",
      "Throw ender pearl to escape if desperate"
    ],
    combatStrategy: [
      "Fight from high ground",
      "Bottleneck mobs into narrow space",
      "Use bow for ranged elimination",
      "Block with shield, attack during cooldown",
      "Retreat if health below 50%"
    ],
    prevention: [
      "Light up area constantly",
      "Don't explore at night unprepared",
      "Listen for mob sounds",
      "Check spawner locations before approaching"
    ]
  },

  STRUCTURE_TRAP: {
    priority: "medium",
    triggers: ["tnt_trap", "arrow_trap", "lava_trap", "fall_trap"],
    immediateActions: [
      "FREEZE - don't trigger pressure plates",
      "Look for tripwires before moving",
      "Disarm TNT by breaking connection",
      "Block arrow dispensers with blocks",
      "Fill lava with blocks"
    ],
    structureSpecific: {
      desert_temple: "TNT under pressure plate in center, disarm before looting",
      jungle_temple: "Arrow dispenser trap, approach from side",
      woodland_mansion: "Various traps, move slowly and check floors"
    }
  },

  DIMENSION_STRANDED: {
    priority: "critical",
    triggers: ["nether_portal_destroyed", "end_platform_destroyed", "lost_in_end"],
    netherRecovery: [
      "Rebuild portal with obsidian (10 minimum)",
      "If no obsidian: find ruined portal or fortress",
      "Trade with piglins for obsidian",
      "Use water + lava to create obsidian",
      "Light with fire charge or flint & steel"
    ],
    endRecovery: [
      "Bridge back to main island if on outer islands",
      "Kill ender dragon if not defeated",
      "Use ender pearls to traverse void",
      "Throw item through return portal to test",
      "Jump through end gateway to return"
    ],
    prevention: [
      "Never destroy your only portal",
      "Mark portal coordinates",
      "Bring portal-building materials",
      "Have backup flint & steel"
    ]
  },

  ITEM_LOSS_MITIGATION: {
    priority: "medium",
    triggers: ["death_occurred", "items_despawning"],
    immediateActions: [
      "Respawn and note death coordinates immediately",
      "Items despawn after 5 minutes - hurry",
      "Bring empty inventory for recovery",
      "Prepare for return journey with minimal supplies",
      "Mark route to death location"
    ],
    recoveryStrategy: [
      "Travel light - only bring necessities",
      "Avoid same death scenario (prepare differently)",
      "Bring ender chest to store valuables",
      "Have backup gear ready",
      "If items despawned, accept loss and move on"
    ],
    prevention: [
      "Use Keep Inventory if available (gamerule)",
      "Store valuables in ender chest before risky activities",
      "Have backup gear sets at base",
      "Don't carry unnecessary valuables during exploration"
    ]
  }
};

/**
 * Generate emergency protocol checklist
 */
function generateEmergencyChecklist(biome, structure, risks) {
  const protocols = [];

  // Add relevant emergency protocols based on risks
  risks.activeRisks.forEach(risk => {
    if (risk.severity === "critical") {
      if (risk.category === "environmental") {
        protocols.push({
          name: "Environmental Emergency",
          protocol: EMERGENCY_PROTOCOLS.IMMINENT_DEATH,
          relevance: risk.description
        });
      }
    }
  });

  // Add navigation protocol for complex biomes
  if (biome.navigationComplexity === "very_high" || biome.navigationComplexity === "extreme") {
    protocols.push({
      name: "Lost Navigation Recovery",
      protocol: EMERGENCY_PROTOCOLS.LOST_NAVIGATION,
      relevance: "High complexity terrain makes getting lost likely"
    });
  }

  // Add dimension-specific protocols
  if (biome.dimension !== "overworld") {
    protocols.push({
      name: "Dimension Stranded Recovery",
      protocol: EMERGENCY_PROTOCOLS.DIMENSION_STRANDED,
      relevance: `${biome.dimension} dimension requires portal knowledge`
    });
  }

  // Add structure trap protocol if exploring structures
  if (structure && (structure.dangers.includes("tnt_trap") ||
                    structure.dangers.includes("arrow_trap") ||
                    structure.dangers.includes("dispenser_trap"))) {
    protocols.push({
      name: "Structure Trap Handling",
      protocol: EMERGENCY_PROTOCOLS.STRUCTURE_TRAP,
      relevance: `${structure.navigationTips.join(", ")}`
    });
  }

  // Always include mob swarm and supply depletion
  protocols.push({
    name: "Hostile Mob Swarm",
    protocol: EMERGENCY_PROTOCOLS.HOSTILE_MOB_SWARM,
    relevance: "Standard combat emergency"
  });

  protocols.push({
    name: "Supply Depletion",
    protocol: EMERGENCY_PROTOCOLS.OUT_OF_SUPPLIES,
    relevance: "Resource management emergency"
  });

  return protocols;
}

/* =====================================================
 * DYNAMIC WEATHER SYSTEM
 * Environmental conditions affecting exploration
 * ===================================================== */

const WEATHER_SYSTEM = {
  conditions: {
    clear: {
      visibility: 1.0,
      mobSpawns: 1.0,
      traversalSpeed: 1.0,
      lightLevel: "bright",
      effects: ["optimal_visibility", "standard_mob_spawns"],
      description: "Perfect conditions for exploration",
      recommendations: ["Ideal for mapping", "Good for structure hunting", "Safe for long journeys"]
    },
    rain: {
      visibility: 0.8,
      mobSpawns: 1.2,
      traversalSpeed: 0.95,
      lightLevel: "reduced",
      effects: ["reduced_visibility", "increased_spawns", "fills_cauldrons"],
      description: "Wet conditions with slightly reduced visibility",
      recommendations: ["Bring extra torches", "Watch for mob spawns", "Good for water collection"],
      duration: { min: 12000, max: 24000 } // ticks (10-20 minutes)
    },
    thunderstorm: {
      visibility: 0.6,
      mobSpawns: 1.5,
      traversalSpeed: 0.9,
      lightLevel: "dark",
      lightningRisk: true,
      effects: ["poor_visibility", "heavy_mob_spawns", "lightning_strikes", "skeleton_horse_traps"],
      description: "Dangerous storm conditions with lightning",
      recommendations: [
        "Avoid high ground and tall structures",
        "Sleep in bed if possible",
        "Watch for skeleton horse traps",
        "Bring shield and armor"
      ],
      duration: { min: 12000, max: 180000 } // ticks (10-150 minutes)
    },
    snow: {
      visibility: 0.7,
      mobSpawns: 1.1,
      traversalSpeed: 0.85,
      lightLevel: "reduced",
      effects: ["reduced_visibility", "snow_accumulation", "ice_formation"],
      description: "Cold snowy conditions affecting movement",
      recommendations: [
        "Slower travel on snow layers",
        "Ice useful for fast travel",
        "Visibility reduced in heavy snow",
        "Bring leather boots to avoid powder snow"
      ],
      duration: { min: 12000, max: 24000 } // ticks (10-20 minutes)
    },
    fog: {
      visibility: 0.5,
      mobSpawns: 1.0,
      traversalSpeed: 1.0,
      lightLevel: "normal",
      effects: ["very_poor_visibility", "easy_to_get_lost"],
      description: "Dense fog severely limiting visibility",
      recommendations: [
        "Place extra waypoint markers",
        "Use compass constantly",
        "Easy to get disoriented",
        "Good for sneaking past mobs"
      ],
      duration: { min: 6000, max: 12000 } // ticks (5-10 minutes)
    }
  },

  biomeWeatherPatterns: {
    desert: {
      commonWeather: ["clear"],
      rareWeather: [],
      canRain: false,
      canSnow: false,
      canThunder: false,
      notes: "Desert biomes never experience rain"
    },
    plains: {
      commonWeather: ["clear", "rain"],
      rareWeather: ["thunderstorm"],
      canRain: true,
      canSnow: false,
      canThunder: true,
      notes: "Standard weather patterns with occasional storms"
    },
    taiga: {
      commonWeather: ["clear", "snow"],
      rareWeather: ["thunderstorm"],
      canRain: false,
      canSnow: true,
      canThunder: true,
      notes: "Cold biome with snow instead of rain"
    },
    jungle: {
      commonWeather: ["rain", "thunderstorm"],
      rareWeather: ["clear"],
      canRain: true,
      canSnow: false,
      canThunder: true,
      notes: "Frequent heavy rainfall"
    },
    swamp: {
      commonWeather: ["rain", "fog"],
      rareWeather: ["clear"],
      canRain: true,
      canSnow: false,
      canThunder: true,
      notes: "Misty and wet conditions common"
    },
    ocean: {
      commonWeather: ["clear", "rain"],
      rareWeather: ["thunderstorm"],
      canRain: true,
      canSnow: false,
      canThunder: true,
      notes: "Storms can be dangerous at sea"
    },
    mountains: {
      commonWeather: ["clear", "snow"],
      rareWeather: ["thunderstorm"],
      canRain: true,
      canSnow: true,
      canThunder: true,
      notes: "Weather changes with altitude, snow at peaks"
    },
    ice_spikes: {
      commonWeather: ["clear", "snow"],
      rareWeather: [],
      canRain: false,
      canSnow: true,
      canThunder: false,
      notes: "Frozen biome with frequent snow"
    },
    nether_wastes: {
      commonWeather: [],
      rareWeather: [],
      canRain: false,
      canSnow: false,
      canThunder: false,
      notes: "No weather in Nether dimension"
    },
    the_end: {
      commonWeather: [],
      rareWeather: [],
      canRain: false,
      canSnow: false,
      canThunder: false,
      notes: "No weather in End dimension"
    }
  },

  /**
   * Forecast weather conditions for expedition
   * @param {string} biome - Biome name
   * @param {number} duration - Expected expedition duration in ticks
   * @returns {Object} Weather forecast with expected conditions
   */
  forecast: (biome, duration) => {
    const pattern = WEATHER_SYSTEM.biomeWeatherPatterns[biome] ||
                    WEATHER_SYSTEM.biomeWeatherPatterns.plains;

    if (!pattern.canRain && !pattern.canSnow) {
      return {
        expectedWeather: ["clear"],
        weatherChanges: 0,
        warnings: [],
        recommendations: ["No weather concerns in this biome"]
      };
    }

    const avgWeatherDuration = 18000; // ~15 minutes
    const expectedChanges = Math.floor(duration / avgWeatherDuration);

    const warnings = [];
    const recommendations = [];

    if (pattern.canThunder) {
      warnings.push("Thunderstorms possible - avoid high ground");
      recommendations.push("Bring bed to skip storms");
    }

    if (pattern.commonWeather.includes("rain") || pattern.commonWeather.includes("snow")) {
      warnings.push(`${pattern.canSnow ? "Snow" : "Rain"} likely during expedition`);
      recommendations.push("Expect reduced visibility and increased mob spawns");
    }

    if (pattern.commonWeather.includes("fog")) {
      warnings.push("Dense fog common - easy to get lost");
      recommendations.push("Place extra waypoint markers");
    }

    return {
      expectedWeather: pattern.commonWeather,
      rareWeather: pattern.rareWeather,
      weatherChanges: expectedChanges,
      warnings,
      recommendations,
      pattern
    };
  },

  /**
   * Adjust supplies based on weather conditions
   * @param {Object} baseSupplies - Base supply requirements
   * @param {string} weatherCondition - Current/expected weather
   * @returns {Object} Adjusted supplies
   */
  adjustSuppliesForWeather: (baseSupplies, weatherCondition) => {
    const weather = WEATHER_SYSTEM.conditions[weatherCondition];
    if (!weather) return baseSupplies;

    const adjusted = { ...baseSupplies };

    // Reduced visibility = more torches needed
    if (weather.visibility < 0.8) {
      adjusted.torches = Math.ceil((adjusted.torches || 64) * (1 / weather.visibility));
    }

    // Increased mob spawns = more combat supplies
    if (weather.mobSpawns > 1.0) {
      adjusted.arrows = Math.ceil((adjusted.arrows || 64) * weather.mobSpawns);
      adjusted.golden_apples = Math.ceil((adjusted.golden_apples || 2) * weather.mobSpawns);
    }

    // Lightning risk = need bed
    if (weather.lightningRisk) {
      adjusted.bed = Math.max(adjusted.bed || 0, 1);
    }

    // Slower travel = more food
    if (weather.traversalSpeed < 1.0) {
      adjusted.food = Math.ceil((adjusted.food || 16) * (1 / weather.traversalSpeed));
    }

    return adjusted;
  },

  /**
   * Get weather-specific risks
   * @param {string} weatherCondition - Weather condition name
   * @returns {Array} Array of weather risks
   */
  getWeatherRisks: (weatherCondition) => {
    const weather = WEATHER_SYSTEM.conditions[weatherCondition];
    if (!weather) return [];

    const risks = [];

    if (weather.lightningRisk) {
      risks.push({
        type: "LIGHTNING_STRIKE",
        severity: "medium",
        description: "Lightning can strike during thunderstorms",
        mitigation: ["Avoid high ground", "Stay away from tall structures", "Sleep in bed to skip storm"]
      });
    }

    if (weather.visibility < 0.7) {
      risks.push({
        type: "POOR_VISIBILITY",
        severity: "medium",
        description: `Visibility reduced to ${Math.round(weather.visibility * 100)}%`,
        mitigation: ["Bring extra torches", "Place frequent waypoints", "Use compass constantly"]
      });
    }

    if (weather.mobSpawns > 1.2) {
      risks.push({
        type: "INCREASED_MOB_SPAWNS",
        severity: "medium",
        description: `Mob spawns increased by ${Math.round((weather.mobSpawns - 1) * 100)}%`,
        mitigation: ["Light up area aggressively", "Bring extra combat supplies", "Avoid night exploration"]
      });
    }

    return risks;
  }
};

/* =====================================================
 * TIME-OF-DAY OPTIMIZER
 * Optimal timing for exploration missions
 * ===================================================== */

const TIME_OPTIMIZER = {
  timeOfDay: {
    dawn: {
      startTick: 23000,
      endTick: 1000,
      lightLevel: "increasing",
      mobBehavior: "burning",
      description: "Early morning as sun rises",
      advantages: [
        "Hostile mobs start burning",
        "Full day ahead for exploration",
        "Good visibility starting",
        "Safest time to leave base"
      ],
      disadvantages: [
        "Some mobs still active briefly",
        "Light level still increasing"
      ],
      bestFor: ["long_expeditions", "structure_hunting", "safe_travel"]
    },
    day: {
      startTick: 1000,
      endTick: 12000,
      lightLevel: "maximum",
      mobBehavior: "passive_only",
      description: "Bright daylight hours",
      advantages: [
        "Maximum visibility",
        "No hostile mob spawns (except caves)",
        "Safest exploration time",
        "Easy navigation and mapping"
      ],
      disadvantages: [
        "Harder to spot structure lights",
        "No enderman spawns in overworld"
      ],
      bestFor: ["general_exploration", "mapping", "building", "resource_gathering"]
    },
    dusk: {
      startTick: 12000,
      endTick: 13000,
      lightLevel: "decreasing",
      mobBehavior: "starting_to_spawn",
      description: "Evening as sun sets",
      advantages: [
        "Can spot structure lights easier",
        "Still relatively safe"
      ],
      disadvantages: [
        "Time pressure to return/shelter",
        "Mobs will spawn soon",
        "Light decreasing rapidly"
      ],
      bestFor: ["final_push_to_base", "short_tasks"]
    },
    night: {
      startTick: 13000,
      endTick: 23000,
      lightLevel: "minimum",
      mobBehavior: "active_spawning",
      description: "Dangerous nighttime hours",
      advantages: [
        "Easy to spot structure lights",
        "Enderman spawn in overworld",
        "Less competition for resources",
        "Phantoms spawn after 3 nights (membrane farm)"
      ],
      disadvantages: [
        "Heavy hostile mob spawns",
        "Poor visibility without torches",
        "Increased danger significantly",
        "Easy to get ambushed"
      ],
      bestFor: ["enderman_hunting", "structure_light_spotting", "experienced_players_only"]
    },
    midnight: {
      startTick: 18000,
      endTick: 19000,
      lightLevel: "darkest",
      mobBehavior: "peak_spawning",
      description: "Darkest and most dangerous hour",
      advantages: [
        "Maximum structure visibility",
        "Peak spawning for mob farms"
      ],
      disadvantages: [
        "Highest danger level",
        "Maximum mob spawns",
        "Worst visibility"
      ],
      bestFor: ["mob_farming", "desperate_situations_only"]
    }
  },

  moonPhases: {
    full_moon: {
      phase: 0,
      lightLevel: 0.25,
      mobSpawns: 1.5,
      slimeSpawns: true,
      description: "Brightest night, most dangerous",
      effects: [
        "50% more mob spawns",
        "Slimes spawn in swamps",
        "Better night visibility",
        "Cats more likely to spawn"
      ],
      recommendations: [
        "Avoid night exploration if possible",
        "Good for slime farming in swamps",
        "Extra combat preparation needed"
      ]
    },
    waning_gibbous: {
      phase: 1,
      lightLevel: 0.19,
      mobSpawns: 1.25,
      slimeSpawns: true,
      description: "Still relatively bright",
      effects: ["25% more mob spawns", "Slimes still spawn"],
      recommendations: ["Caution during night travel"]
    },
    last_quarter: {
      phase: 2,
      lightLevel: 0.12,
      mobSpawns: 1.0,
      slimeSpawns: true,
      description: "Half moon waning",
      effects: ["Standard mob spawns", "Slimes spawn"],
      recommendations: ["Normal night precautions"]
    },
    waning_crescent: {
      phase: 3,
      lightLevel: 0.06,
      mobSpawns: 0.9,
      slimeSpawns: true,
      description: "Dark crescent moon",
      effects: ["10% fewer mob spawns", "Slimes spawn"],
      recommendations: ["Slightly safer nights"]
    },
    new_moon: {
      phase: 4,
      lightLevel: 0.0,
      mobSpawns: 0.8,
      slimeSpawns: false,
      description: "Darkest night, safest",
      effects: [
        "20% fewer mob spawns",
        "No slimes in swamps",
        "Darkest night visibility",
        "Safest night phase"
      ],
      recommendations: [
        "Best night for exploration",
        "Still dangerous without light",
        "Reduced mob pressure"
      ]
    },
    waxing_crescent: {
      phase: 5,
      lightLevel: 0.06,
      mobSpawns: 0.9,
      slimeSpawns: false,
      description: "Growing crescent moon",
      effects: ["10% fewer mob spawns", "No slimes"],
      recommendations: ["Safer night travel"]
    },
    first_quarter: {
      phase: 6,
      lightLevel: 0.12,
      mobSpawns: 1.0,
      slimeSpawns: false,
      description: "Half moon waxing",
      effects: ["Standard mob spawns", "No slimes"],
      recommendations: ["Normal precautions"]
    },
    waxing_gibbous: {
      phase: 7,
      lightLevel: 0.19,
      mobSpawns: 1.25,
      slimeSpawns: false,
      description: "Nearly full moon",
      effects: ["25% more mob spawns", "No slimes yet"],
      recommendations: ["Increased danger approaching"]
    }
  },

  /**
   * Calculate optimal start time for expedition
   * @param {string} taskType - Type of task (exploration, combat, building, etc.)
   * @param {string} biome - Biome name
   * @param {number} expectedDuration - Expected duration in ticks
   * @returns {Object} Optimal timing recommendation
   */
  calculateOptimalStartTime: (taskType, biome, expectedDuration) => {
    const dayLength = 24000; // ticks (20 minutes)
    const daylightDuration = 12000; // ticks (10 minutes)

    const recommendations = {
      exploration: {
        optimalStart: "dawn",
        reason: "Start at dawn to maximize daylight hours",
        startTick: 23000,
        allowsReturn: true
      },
      structure_hunting: {
        optimalStart: "dawn",
        reason: "Need full day of light to search effectively",
        startTick: 23000,
        allowsReturn: true
      },
      combat: {
        optimalStart: "day",
        reason: "Fight in daylight when most mobs burn",
        startTick: 1000,
        allowsReturn: true
      },
      mining: {
        optimalStart: "any",
        reason: "Underground activities not affected by time",
        startTick: 0,
        allowsReturn: true
      },
      enderman_hunting: {
        optimalStart: "night",
        reason: "Enderman only spawn at night in overworld",
        startTick: 13000,
        allowsReturn: false,
        warning: "Dangerous night operation"
      },
      mob_farming: {
        optimalStart: "night",
        reason: "Maximum mob spawns during night",
        startTick: 13000,
        allowsReturn: false,
        warning: "Combat-intensive"
      }
    };

    const rec = recommendations[taskType] || recommendations.exploration;

    // Calculate if expedition can complete in daylight
    const timeUntilNight = daylightDuration;
    const canCompleteInDaylight = expectedDuration < timeUntilNight;

    // Adjust recommendation based on duration
    if (!canCompleteInDaylight && rec.optimalStart === "dawn") {
      rec.warning = `Expedition may extend into night. Expected duration: ${Math.round(expectedDuration / 1200)} minutes. Bring bed and night gear.`;
    }

    return {
      ...rec,
      expectedDuration,
      canCompleteInDaylight,
      nightPrepRequired: !canCompleteInDaylight,
      estimatedCompletionTime: (rec.startTick + expectedDuration) % dayLength
    };
  },

  /**
   * Get moon phase information
   * @param {number} worldTime - Current world time (in ticks)
   * @returns {Object} Moon phase data
   */
  getMoonPhase: (worldTime) => {
    const daysSinceStart = Math.floor(worldTime / 24000);
    const phase = daysSinceStart % 8;

    const phases = Object.values(TIME_OPTIMIZER.moonPhases);
    return phases[phase] || phases[0];
  },

  /**
   * Get time-based supply adjustments
   * @param {string} timeOfDay - Time period (dawn, day, dusk, night)
   * @param {Object} baseSupplies - Base supply requirements
   * @returns {Object} Adjusted supplies
   */
  adjustSuppliesForTime: (timeOfDay, baseSupplies) => {
    const time = TIME_OPTIMIZER.timeOfDay[timeOfDay];
    if (!time) return baseSupplies;

    const adjusted = { ...baseSupplies };

    if (timeOfDay === "night" || timeOfDay === "midnight") {
      // Night requires more torches and combat supplies
      adjusted.torches = Math.ceil((adjusted.torches || 64) * 2);
      adjusted.arrows = Math.ceil((adjusted.arrows || 64) * 1.5);
      adjusted.golden_apples = Math.ceil((adjusted.golden_apples || 2) * 1.5);
      adjusted.bed = Math.max(adjusted.bed || 0, 1); // Always bring bed at night
    }

    if (timeOfDay === "dusk") {
      // Dusk requires bed to skip night
      adjusted.bed = Math.max(adjusted.bed || 0, 1);
    }

    return adjusted;
  },

  /**
   * Determine if it's safe to start expedition now
   * @param {number} currentTick - Current time tick (0-23999)
   * @param {number} expeditionDuration - Expected duration in ticks
   * @param {boolean} nightCapable - Whether player is equipped for night
   * @returns {Object} Safety assessment
   */
  assessDepartureTime: (currentTick, expeditionDuration, nightCapable = false) => {
    const timeInDay = currentTick % 24000;
    const timeUntilNight = timeInDay < 13000 ? 13000 - timeInDay : 24000 + 13000 - timeInDay;
    const willHitNight = expeditionDuration > timeUntilNight;

    let status = "safe";
    let warning = null;
    let recommendation = null;

    if (timeInDay >= 13000 && timeInDay < 23000) {
      // Currently night
      if (!nightCapable) {
        status = "dangerous";
        warning = "Currently night time. Not recommended without night gear.";
        recommendation = "Sleep in bed and depart at dawn (tick 23000)";
      } else {
        status = "risky";
        warning = "Night departure. Ensure combat readiness.";
        recommendation = "Proceed with caution. Full armor and weapons required.";
      }
    } else if (willHitNight && !nightCapable) {
      status = "concerning";
      warning = `Expedition will extend into night. ${Math.round(timeUntilNight / 1200)} minutes until nightfall.`;
      recommendation = "Bring bed, extra torches, and combat supplies. Or wait for dawn.";
    } else if (timeInDay < 1000) {
      status = "optimal";
      recommendation = "Excellent time for departure. Full day ahead.";
    } else if (timeInDay < 11000) {
      status = "good";
      recommendation = "Good departure time. Plenty of daylight remaining.";
    } else {
      status = "fair";
      warning = "Late day departure. May need to rush back before dark.";
      recommendation = "Consider waiting until dawn for long expeditions.";
    }

    return {
      status,
      warning,
      recommendation,
      currentTick: timeInDay,
      timeUntilNight,
      willHitNight,
      nightCapable
    };
  }
};

/* =====================================================
 * COMPANION/TEAM SYSTEM
 * Ally and multiplayer coordination
 * ===================================================== */

const TEAM_PROFILES = {
  wolf_pack: {
    type: "animal_companion",
    quantity: { min: 2, max: 10, recommended: 4 },
    tameRequirements: ["bones"],
    healthPerWolf: 20, // 10 hearts
    damagePerWolf: 4, // 2 hearts
    benefits: [
      "Combat support against hostile mobs",
      "Hostile mob detection and alerts",
      "Teleport to player when far",
      "Pack hunting advantage",
      "Can be healed with meat"
    ],
    risks: [
      "Friendly fire from splash potions",
      "Wolves attack skeletons automatically (can be unwanted)",
      "Can fall into lava or void",
      "Need food to heal injuries",
      "Can get lost or stuck"
    ],
    supplies: ["bones (for taming)", "meat (for healing)", "collars/dye (optional)"],
    maintenance: {
      food: "cooked_meat",
      healingMethod: "feed_meat",
      canSitStay: true
    },
    combatEffectiveness: "medium",
    bestFor: ["overworld_exploration", "mob_combat", "night_protection"],
    notRecommendedFor: ["nether (ghast_fireballs)", "end (void_falls)", "ocean (drowning)"],
    specialConsiderations: [
      "Make wolves sit before dangerous areas",
      "Don't bring to Nether (ghasts will kill them)",
      "Keep them away from creepers",
      "Wolves deal more damage when in pack"
    ]
  },

  iron_golem: {
    type: "constructed_companion",
    quantity: { min: 1, max: 5, recommended: 1 },
    buildRequirements: ["4 iron_blocks", "1 pumpkin or carved_pumpkin"],
    health: 100, // 50 hearts
    damage: 21, // 10.5 hearts (massive damage)
    benefits: [
      "Village defense and protection",
      "Very high damage output",
      "Can tank many hits",
      "Knocks back enemies",
      "Regenerates health naturally in villages"
    ],
    risks: [
      "Slow movement speed",
      "Cannot enter small spaces or caves",
      "Expensive to build (36 iron ingots)",
      "Cannot be commanded or controlled",
      "Will attack player if provoked",
      "Can't teleport to player"
    ],
    supplies: ["iron_blocks", "pumpkin"],
    maintenance: {
      healing: "natural_regeneration (in villages only)",
      canSitStay: false,
      controllable: false
    },
    combatEffectiveness: "very_high",
    bestFor: ["village_defense", "stationary_protection", "mob_farming"],
    notRecommendedFor: ["exploration (too slow)", "cave_systems", "long_journeys"],
    specialConsiderations: [
      "Best used for base defense, not exploration",
      "Will protect villages from raids",
      "Useful for mob farming setups",
      "Cannot follow you on adventures"
    ]
  },

  cat: {
    type: "animal_companion",
    quantity: { min: 1, max: 5, recommended: 2 },
    tameRequirements: ["raw_cod or raw_salmon"],
    healthPerCat: 10, // 5 hearts
    damagePerCat: 3, // 1.5 hearts
    benefits: [
      "Creepers and phantoms avoid cats (9 block radius)",
      "Can scare away creepers from base",
      "Morning gifts (string, rabbit hide, phantom membrane)",
      "Teleport to player when far",
      "Sit on chests and beds (cute but blocks access)"
    ],
    risks: [
      "Low health, easily killed",
      "Will sit on chests and block access",
      "Can fall into hazards",
      "Limited combat utility"
    ],
    supplies: ["raw_cod", "raw_salmon"],
    maintenance: {
      food: "raw_fish",
      healingMethod: "feed_fish",
      canSitStay: true
    },
    combatEffectiveness: "low",
    bestFor: ["creeper_defense", "phantom_prevention", "base_protection"],
    notRecommendedFor: ["combat", "dangerous_exploration"],
    specialConsiderations: [
      "Excellent for preventing creeper ambushes",
      "Keep at base to prevent phantom spawns",
      "Morning gifts can be valuable",
      "Black cats spawn in witch huts"
    ]
  },

  horse: {
    type: "mount",
    quantity: { min: 1, max: 2, recommended: 1 },
    tameRequirements: ["empty_hand (repeated mounting)"],
    health: { min: 15, max: 30 }, // 7.5-15 hearts (varies)
    speed: { min: 0.1125, max: 0.3375 }, // blocks per tick (varies by horse)
    benefits: [
      "Fast overworld travel",
      "Can equip horse armor for protection",
      "Can equip saddle for riding",
      "Jump height varies (useful for terrain)",
      "Can carry player quickly"
    ],
    risks: [
      "Can be killed in combat",
      "Cannot teleport to player",
      "Requires saddle to ride",
      "Can get stuck or lost",
      "Difficult to use in caves/tight spaces"
    ],
    supplies: ["saddle (required)", "horse_armor (recommended)", "golden_apple (breeding)"],
    maintenance: {
      food: "golden_apple, golden_carrot (healing/breeding)",
      healingMethod: "feed_golden_items",
      canSitStay: false
    },
    combatEffectiveness: "none",
    bestFor: ["long_distance_travel", "plains_exploration", "speed"],
    notRecommendedFor: ["caves", "mountains", "nether", "end"],
    specialConsiderations: [
      "Best for flat terrain travel",
      "Speed and jump varies per horse (check stats)",
      "Tie to fence post or keep in boat when not riding",
      "Diamond horse armor provides best protection"
    ]
  },

  llama_caravan: {
    type: "pack_animal",
    quantity: { min: 1, max: 10, recommended: 3 },
    tameRequirements: ["empty_hand (repeated mounting)"],
    healthPerLlama: { min: 15, max: 30 },
    chestSlots: 15, // per llama with chest
    benefits: [
      "Carry extra supplies with chests",
      "Form caravans (follow lead llama)",
      "Spit at hostile mobs (weak ranged attack)",
      "Can be decorated with carpets",
      "Useful for long expeditions needing supplies"
    ],
    risks: [
      "Slower than horses",
      "Spit at player if provoked",
      "Can be killed",
      "Caravan can break if too spread out"
    ],
    supplies: ["chest (to equip storage)", "carpet (decoration)", "lead (caravan)"],
    maintenance: {
      food: "wheat, hay_bale",
      healingMethod: "feed_wheat",
      canSitStay: false
    },
    combatEffectiveness: "very_low",
    bestFor: ["supply_transport", "long_expeditions", "resource_gathering"],
    notRecommendedFor: ["fast_travel", "combat_situations"],
    specialConsiderations: [
      "Perfect for gathering expeditions needing storage",
      "Lead llama with lead, others follow in caravan",
      "Can carry 15 item stacks each (with chest)",
      "Found in mountain biomes"
    ]
  },

  multiplayer_team: {
    type: "human_players",
    quantity: { min: 2, max: 10, recommended: 3 },
    requirements: ["multiplayer_server or realm", "coordination"],
    benefits: [
      "Resource sharing and pooling",
      "Simultaneous exploration (cover more ground)",
      "Specialized roles (combat, building, gathering)",
      "Shared knowledge and waypoints",
      "Rescue and revival assistance",
      "Combined combat power",
      "Social experience and fun"
    ],
    risks: [
      "Need coordination (voice chat recommended)",
      "Friendly fire with splash potions/arrows",
      "Can get separated",
      "Loot distribution disputes",
      "Different skill levels",
      "Griefers on public servers"
    ],
    supplies: ["voice_chat (Discord, etc.)", "shared_resources", "waypoint_system"],
    coordination: {
      communication: ["voice_chat", "text_chat", "signs", "books"],
      waypointSharing: "coordinates in chat, maps, lodestone compasses",
      roleDivision: ["tank (armor)", "DPS (damage)", "support (supplies)", "scout (navigation)"]
    },
    combatEffectiveness: "very_high",
    bestFor: ["dangerous_structures", "raids", "boss_fights", "large_projects"],
    notRecommendedFor: ["solo_challenges", "peaceful_building (can be chaotic)"],
    specialConsiderations: [
      "Designate leader for coordination",
      "Share coordinates constantly",
      "Assign roles based on player strengths",
      "Use voice chat for real-time communication",
      "Establish loot distribution rules beforehand",
      "Keep extra supplies for teammates",
      "Mark meeting points and rally locations"
    ],
    recommendedRoles: {
      tank: {
        equipment: ["full_armor", "shield", "sword", "golden_apples"],
        role: "Front line combat, draw aggro, protect team"
      },
      dps: {
        equipment: ["bow", "arrows", "sword", "strength_potions"],
        role: "Maximum damage output, eliminate threats quickly"
      },
      support: {
        equipment: ["healing_potions", "food", "extra_supplies", "ender_chest"],
        role: "Keep team supplied, heal injured, backup gear"
      },
      scout: {
        equipment: ["elytra", "rockets", "compass", "maps", "ender_pearls"],
        role: "Navigate, find structures, mark waypoints, scout ahead"
      }
    }
  },

  fox: {
    type: "animal_companion",
    quantity: { min: 1, max: 3, recommended: 2 },
    tameRequirements: ["breed_two_foxes_with_sweet_berries (baby_fox_will_trust_player)"],
    healthPerFox: 20, // 10 hearts
    damagePerFox: 2, // 1 heart
    benefits: [
      "Picks up items in mouth",
      "Can pick up and hold food/weapons",
      "Will eat food to heal",
      "Adorable companion",
      "Attacks small mobs (chickens, rabbits)"
    ],
    risks: [
      "Not directly tameable (must breed)",
      "Will eat dropped food immediately",
      "Can pick up valuable items and run",
      "Nocturnal (sleeps during day)",
      "Low combat effectiveness"
    ],
    supplies: ["sweet_berries (for breeding)"],
    maintenance: {
      food: "sweet_berries",
      healingMethod: "feed_berries_or_will_eat_dropped_food",
      canSitStay: false
    },
    combatEffectiveness: "very_low",
    bestFor: ["item_collection", "companion", "taiga_biomes"],
    notRecommendedFor: ["combat", "serious_exploration"],
    specialConsiderations: [
      "Must breed two wild foxes for trusted baby",
      "Will pick up and hold items (can be useful or annoying)",
      "Sleeps during day in shaded areas",
      "Can jump over fences"
    ]
  },

  parrot: {
    type: "decorative_companion",
    quantity: { min: 1, max: 5, recommended: 2 },
    tameRequirements: ["seeds (wheat, melon, pumpkin, beetroot)"],
    healthPerParrot: 6, // 3 hearts
    benefits: [
      "Sits on player shoulder (cosmetic)",
      "Mimics nearby mob sounds (early warning)",
      "Can dance to music from jukebox",
      "Five color varieties (aesthetic)"
    ],
    risks: [
      "Very fragile (6 HP only)",
      "Falls off shoulder during jumps/falls",
      "Can die very easily",
      "Limited practical use"
    ],
    supplies: ["seeds"],
    maintenance: {
      food: "seeds",
      healingMethod: "feed_seeds",
      canSitStay: true
    },
    combatEffectiveness: "none",
    bestFor: ["aesthetic", "mob_detection", "base_decoration"],
    notRecommendedFor: ["exploration", "combat", "dangerous_areas"],
    specialConsiderations: [
      "NEVER feed chocolate cookies (instant death)",
      "Mimics can warn of nearby mobs",
      "Mostly decorative, not practical for exploration",
      "Can be left sitting at base"
    ]
  }
};

/**
 * Recommend team composition for expedition
 * @param {string} taskType - Type of expedition (exploration, combat, gathering)
 * @param {string} biome - Biome name
 * @param {number} riskScore - Risk score from assessment
 * @returns {Object} Team recommendations
 */
function recommendTeamComposition(taskType, biome, riskScore) {
  const recommendations = [];

  // High risk = bring wolf pack for combat
  if (riskScore >= RISK_THRESHOLD_HIGH) {
    recommendations.push({
      companion: "wolf_pack",
      quantity: 4,
      reason: "High risk expedition needs combat support",
      priority: "high"
    });
  }

  // Overworld exploration = consider horse for speed
  if (biome === "plains" || biome === "desert") {
    recommendations.push({
      companion: "horse",
      quantity: 1,
      reason: "Flat terrain ideal for mounted travel",
      priority: "medium"
    });
  }

  // Gathering expedition = bring llama caravan
  if (taskType === "gathering" || taskType === "resource_collection") {
    recommendations.push({
      companion: "llama_caravan",
      quantity: 3,
      reason: "Extra storage capacity for gathering resources",
      priority: "high"
    });
  }

  // Long expeditions = cats at base for creeper protection
  recommendations.push({
    companion: "cat",
    quantity: 2,
    reason: "Leave at base to prevent creeper damage and phantoms",
    priority: "low",
    location: "keep_at_base"
  });

  // Multiplayer available = strongest option
  recommendations.push({
    companion: "multiplayer_team",
    quantity: 3,
    reason: "Human teammates provide best support and coordination",
    priority: "highest",
    note: "Only if multiplayer is available"
  });

  // Dangerous structures = definitely bring help
  if (riskScore >= 70) {
    recommendations.push({
      companion: "multiplayer_team",
      quantity: 3,
      reason: "Extreme danger - strongly recommend human teammates",
      priority: "critical",
      note: "Solo not recommended"
    });
  }

  return {
    recommendations,
    soloViable: riskScore < RISK_THRESHOLD_HIGH,
    stronglyRecommendTeam: riskScore >= 70
  };
}

/**
 * Calculate team supply adjustments
 * @param {Object} baseSupplies - Base supply requirements
 * @param {Array} companions - Array of companion types
 * @returns {Object} Adjusted supplies including companion needs
 */
function calculateTeamSupplies(baseSupplies, companions = []) {
  const adjusted = { ...baseSupplies };
  const companionSupplies = [];

  companions.forEach(companion => {
    const profile = TEAM_PROFILES[companion.type];
    if (!profile) return;

    // Add taming/building requirements
    if (profile.tameRequirements) {
      profile.tameRequirements.forEach(item => {
        const normalized = normalizeItemName(item);
        adjusted[normalized] = (adjusted[normalized] || 0) + (companion.quantity || 1);
      });
    }

    if (profile.buildRequirements) {
      profile.buildRequirements.forEach(item => {
        const [count, name] = item.split(" ");
        const normalized = normalizeItemName(name);
        adjusted[normalized] = (adjusted[normalized] || 0) +
                                (parseInt(count) || 1) * (companion.quantity || 1);
      });
    }

    // Add maintenance supplies
    if (profile.maintenance?.food) {
      const food = normalizeItemName(profile.maintenance.food);
      // Bring enough to heal companions during expedition
      adjusted[food] = (adjusted[food] || 0) + 8 * (companion.quantity || 1);
    }

    companionSupplies.push({
      companion: companion.type,
      quantity: companion.quantity,
      supplies: profile.supplies || []
    });
  });

  return {
    adjusted,
    companionSupplies
  };
}

/* =====================================================
 * RESOURCE COLLECTION OPTIMIZER
 * Opportunistic resource gathering during exploration
 * ===================================================== */

const RESOURCE_OPTIMIZER = {
  biomeOpportunities: {
    plains: {
      primaryResources: ["tall_grass", "flowers", "villages"],
      secondaryResources: ["horses", "passive_mobs", "hay_bales"],
      gatheringStrategies: {
        tall_grass: {
          tool: "shears or hand",
          yield: "seeds, wheat_seeds",
          effort: "low",
          worthwhile: "early_game",
          tips: ["Use shears for guaranteed seeds", "Useful for wheat farm"]
        },
        villages: {
          tool: "none",
          yield: "crops, tools, emeralds, resources",
          effort: "low",
          worthwhile: "always",
          tips: ["Harvest crops but replant", "Trade with villagers", "Loot chests carefully"]
        },
        horses: {
          tool: "saddle (optional)",
          yield: "tamed_horse",
          effort: "medium",
          worthwhile: "if_need_transport",
          tips: ["Bring golden apples for breeding", "Check stats before committing"]
        }
      }
    },
    forest: {
      primaryResources: ["oak_log", "birch_log", "dark_oak_log", "mushrooms"],
      secondaryResources: ["flowers", "vines", "wolf"],
      gatheringStrategies: {
        wood: {
          tool: "axe (any tier)",
          yield: "logs, sticks, planks",
          effort: "low",
          worthwhile: "always",
          tips: ["Replant saplings for sustainability", "Birch fastest to chop", "Dark oak requires 2x2 saplings"]
        },
        mushrooms: {
          tool: "hand",
          yield: "mushrooms for stew",
          effort: "very_low",
          worthwhile: "if_low_food",
          tips: ["Brown + red = mushroom stew", "Grow on mycelium/podzol"]
        }
      }
    },
    jungle: {
      primaryResources: ["bamboo", "jungle_log", "cocoa_beans", "melons"],
      secondaryResources: ["parrots", "ocelots", "jungle_temple_loot"],
      gatheringStrategies: {
        bamboo: {
          tool: "sword (fastest) or hand",
          yield: "bamboo",
          effort: "very_low",
          worthwhile: "very_high",
          tips: [
            "Bamboo = best scaffolding material",
            "Grows incredibly fast",
            "Use sword for instant break",
            "Bring several stacks - very useful"
          ]
        },
        cocoa_beans: {
          tool: "hand",
          yield: "cocoa_beans",
          effort: "low",
          worthwhile: "medium",
          tips: ["Found on jungle log sides", "Used for brown dye and cookies"]
        },
        melons: {
          tool: "axe (fastest) or hand",
          yield: "melon_slices",
          effort: "low",
          worthwhile: "medium",
          tips: ["Quick food source", "Used for potions", "Silk touch for whole melon"]
        }
      }
    },
    desert: {
      primaryResources: ["sand", "sandstone", "cactus", "dead_bush"],
      secondaryResources: ["desert_temple_loot", "rabbit", "husk"],
      gatheringStrategies: {
        sand: {
          tool: "shovel (any tier)",
          yield: "sand",
          effort: "very_low",
          worthwhile: "high",
          tips: [
            "Essential for glass, concrete",
            "Very abundant in deserts",
            "Use efficiency enchant for bulk",
            "Mark sand quarry location"
          ]
        },
        cactus: {
          tool: "hand (careful!)",
          yield: "cactus",
          effort: "low",
          worthwhile: "medium",
          tips: ["Used for green dye, mob farms", "Damages player on contact", "Grows on sand only"]
        }
      }
    },
    mountains: {
      primaryResources: ["stone", "iron_ore", "coal_ore", "emerald_ore"],
      secondaryResources: ["goat_horn", "snow", "packed_ice"],
      gatheringStrategies: {
        exposed_ores: {
          tool: "pickaxe (stone+)",
          yield: "iron, coal, emeralds",
          effort: "low",
          worthwhile: "very_high",
          tips: [
            "Mountains have BEST ore exposure",
            "Mine visible ores along route",
            "Emeralds exclusive to mountains",
            "Bring fortune pickaxe for max yield",
            "Watch for fall damage while mining"
          ]
        },
        coal: {
          tool: "pickaxe (any tier)",
          yield: "coal",
          effort: "very_low",
          worthwhile: "high",
          tips: ["Super abundant in mountains", "Essential for torches", "Fortune III recommended"]
        }
      }
    },
    ocean: {
      primaryResources: ["kelp", "sea_grass", "cod", "salmon"],
      secondaryResources: ["shipwreck_loot", "buried_treasure", "prismarine"],
      gatheringStrategies: {
        kelp: {
          tool: "hand or shears",
          yield: "kelp",
          effort: "very_low",
          worthwhile: "medium",
          tips: ["Useful for food (dried kelp)", "XP farm material", "Fast growth"]
        },
        fish: {
          tool: "fishing_rod or bucket",
          yield: "cod, salmon",
          effort: "low",
          worthwhile: "if_low_food",
          tips: ["Quick food source", "Bucket for live fish", "Can trade with cats"]
        }
      }
    },
    swamp: {
      primaryResources: ["slime_balls", "lily_pads", "vines", "mushrooms"],
      secondaryResources: ["witch_hut_loot", "blue_orchid", "frog"],
      gatheringStrategies: {
        slime_balls: {
          tool: "sword",
          yield: "slime_balls",
          effort: "medium",
          worthwhile: "very_high",
          tips: [
            "Only spawn on full moon in swamps",
            "Essential for sticky pistons, leads",
            "Very valuable - prioritize collection",
            "Check moon phase before hunting"
          ]
        },
        lily_pads: {
          tool: "hand",
          yield: "lily_pads",
          effort: "very_low",
          worthwhile: "low",
          tips: ["Used for decoration, water walking"]
        }
      }
    },
    nether_wastes: {
      primaryResources: ["netherrack", "glowstone", "nether_quartz", "gravel"],
      secondaryResources: ["magma_cream", "ghast_tear"],
      gatheringStrategies: {
        nether_quartz: {
          tool: "pickaxe (any tier)",
          yield: "nether_quartz",
          effort: "low",
          worthwhile: "high",
          tips: [
            "Very abundant in Nether",
            "Used for redstone components",
            "Fortune III increases yield",
            "XP from mining"
          ]
        },
        glowstone: {
          tool: "pickaxe or hand",
          yield: "glowstone_dust",
          effort: "medium",
          worthwhile: "high",
          tips: ["Found on ceiling", "Use silk touch for whole block", "Provides light level 15"]
        }
      }
    },
    crimson_forest: {
      primaryResources: ["crimson_stem", "crimson_fungus", "weeping_vines", "shroomlight"],
      secondaryResources: ["nether_wart", "hoglin"],
      gatheringStrategies: {
        crimson_stem: {
          tool: "axe (any tier)",
          yield: "crimson_stem",
          effort: "low",
          worthwhile: "medium",
          tips: ["Fire-proof wood", "Good for Nether builds", "Unique aesthetic"]
        },
        shroomlight: {
          tool: "hoe (fastest) or hand",
          yield: "shroomlight",
          effort: "low",
          worthwhile: "high",
          tips: ["Excellent light source (level 15)", "Hoe breaks fastest", "Looks great in builds"]
        }
      }
    },
    the_end: {
      primaryResources: ["chorus_fruit", "end_stone", "purpur", "shulker_shells"],
      secondaryResources: ["ender_pearls", "dragon_egg"],
      gatheringStrategies: {
        chorus_fruit: {
          tool: "any (breaks instantly)",
          yield: "chorus_fruit",
          effort: "very_low",
          worthwhile: "high",
          tips: [
            "Teleportation food",
            "Smelt for popped chorus (purpur)",
            "Grows only in End",
            "Breaking bottom breaks all above"
          ]
        },
        shulker_shells: {
          tool: "sword, bow",
          yield: "shulker_shells",
          effort: "high",
          worthwhile: "very_high",
          tips: [
            "ESSENTIAL for shulker boxes",
            "Only from shulkers in End cities",
            "2 shells = 1 shulker box",
            "Most valuable End resource"
          ]
        }
      }
    }
  },

  secondaryObjectives: {
    collect_wood: {
      priority: "high",
      condition: "inventory_space_available && biome_has_trees",
      effort: "low",
      tools: ["axe"],
      tips: [
        "Always useful for crafting, building, fuel",
        "Quick to gather",
        "Replant saplings for sustainability"
      ]
    },
    mine_exposed_ores: {
      priority: "very_high",
      condition: "pickaxe_available && ores_visible",
      effort: "low_to_medium",
      tools: ["pickaxe (stone+)", "torch"],
      tips: [
        "Free resources along exploration route",
        "Mountains have best ore exposure",
        "Prioritize: diamonds > emeralds > iron > coal",
        "Watch for lava when mining"
      ]
    },
    loot_chests: {
      priority: "very_high",
      condition: "structure_found",
      effort: "very_low",
      tools: ["none"],
      tips: [
        "Always loot structure chests",
        "Check for hidden chest rooms",
        "Mark looted structures to avoid revisits",
        "Bring ender chest to store valuables"
      ]
    },
    tame_animals: {
      priority: "medium",
      condition: "taming_items_available && animals_present",
      effort: "medium",
      tools: ["bones (wolves)", "raw_fish (cats)", "seeds (parrots)"],
      tips: [
        "Opportunistic - only if encounter suitable animals",
        "Wolves useful for combat",
        "Cats prevent creepers/phantoms",
        "Parrots mostly decorative"
      ]
    },
    harvest_crops: {
      priority: "medium",
      condition: "village_found",
      effort: "very_low",
      tools: ["none or hoe"],
      tips: [
        "Villages have free crops",
        "ALWAYS replant after harvesting",
        "Carrots, potatoes, wheat, beetroot",
        "Don't anger villagers by stealing without replanting"
      ]
    },
    collect_rare_items: {
      priority: "high",
      condition: "rare_items_spotted",
      effort: "varies",
      tools: ["appropriate_tools"],
      examples: [
        "Sponges from ocean monuments",
        "Totems from woodland mansions",
        "Elytra from end ships",
        "Ancient debris in Nether"
      ],
      tips: [
        "These are main expedition goals often",
        "Plan whole trip around acquisition",
        "Bring appropriate safety gear"
      ]
    },
    gather_flowers: {
      priority: "low",
      condition: "flowers_present && dye_needed",
      effort: "very_low",
      tools: ["hand"],
      tips: [
        "Used for dyes, decoration, suspicious stew",
        "Different biomes have unique flowers",
        "Low priority unless building/decorating"
      ]
    }
  },

  /**
   * Identify resource opportunities along exploration route
   * @param {string} biomeName - Biome being explored
   * @param {Object} route - Route information
   * @param {Array} inventory - Current player inventory
   * @returns {Object} Resource gathering opportunities
   */
  identifyOpportunities: (biomeName, route, inventory = []) => {
    const biomeData = RESOURCE_OPTIMIZER.biomeOpportunities[biomeName];
    if (!biomeData) {
      return {
        opportunities: [],
        recommendations: ["No specific resource data for this biome"],
        priorityTargets: []
      };
    }

    const opportunities = [];
    const priorityTargets = [];

    // Analyze primary resources
    Object.entries(biomeData.gatheringStrategies).forEach(([resource, strategy]) => {
      const opportunity = {
        resource,
        tool: strategy.tool,
        yield: strategy.yield,
        effort: strategy.effort,
        worthwhile: strategy.worthwhile,
        tips: strategy.tips
      };

      opportunities.push(opportunity);

      // Mark high-priority targets
      if (strategy.worthwhile === "very_high" || strategy.worthwhile === "always") {
        priorityTargets.push(resource);
      }
    });

    // Add secondary objectives that make sense for this context
    const applicableObjectives = [];
    Object.entries(RESOURCE_OPTIMIZER.secondaryObjectives).forEach(([objective, data]) => {
      if (data.priority === "very_high" || data.priority === "high") {
        applicableObjectives.push({
          objective,
          priority: data.priority,
          effort: data.effort,
          tools: data.tools,
          tips: data.tips
        });
      }
    });

    const recommendations = [
      `Primary resources in ${biomeName}: ${biomeData.primaryResources.join(", ")}`,
      `Secondary resources: ${biomeData.secondaryResources.join(", ")}`,
      ...priorityTargets.map(target => `HIGH PRIORITY: Collect ${target} while exploring`)
    ];

    return {
      opportunities,
      priorityTargets,
      applicableObjectives,
      recommendations,
      biomeResources: {
        primary: biomeData.primaryResources,
        secondary: biomeData.secondaryResources
      }
    };
  },

  /**
   * Calculate expected resource yield from expedition
   * @param {string} biomeName - Biome name
   * @param {number} duration - Expedition duration in ticks
   * @param {number} focusLevel - How much time devoted to gathering (0.0-1.0)
   * @returns {Object} Expected resource yields
   */
  estimateYield: (biomeName, duration, focusLevel = 0.3) => {
    const biomeData = RESOURCE_OPTIMIZER.biomeOpportunities[biomeName];
    if (!biomeData) {
      return { estimatedYield: {}, notes: "No yield data for this biome" };
    }

    const gatheringTime = duration * focusLevel;
    const minutes = Math.round(gatheringTime / 1200);

    const estimatedYield = {};
    const notes = [];

    // Rough estimates based on typical gathering rates
    if (biomeName === "mountains") {
      estimatedYield.iron_ore = Math.floor(minutes * 5); // ~5 ore per minute exposed
      estimatedYield.coal_ore = Math.floor(minutes * 10); // ~10 coal per minute
      estimatedYield.emerald_ore = Math.floor(minutes * 0.5); // rare
      notes.push(`Excellent ore exposure in mountains. Expected: ${estimatedYield.iron_ore} iron, ${estimatedYield.coal_ore} coal`);
    }

    if (biomeName === "jungle") {
      estimatedYield.bamboo = Math.floor(minutes * 64); // Very fast to collect
      estimatedYield.jungle_log = Math.floor(minutes * 32);
      notes.push(`Bamboo is VERY abundant. Expect ${estimatedYield.bamboo}+ bamboo with minimal effort`);
    }

    if (biomeName === "desert") {
      estimatedYield.sand = Math.floor(minutes * 100); // Very fast with shovel
      estimatedYield.cactus = Math.floor(minutes * 16);
      notes.push(`Sand collection is very fast. Can easily gather ${estimatedYield.sand}+ sand`);
    }

    if (biomeName === "swamp") {
      // Slimes only on full moon
      estimatedYield.slime_balls = 0; // conditional
      notes.push("Slime balls only available on full moon phase - check moon!");
    }

    notes.push(`Estimated gathering time: ${minutes} minutes (${Math.round(focusLevel * 100)}% of expedition)`);

    return {
      estimatedYield,
      notes,
      gatheringTime: minutes
    };
  },

  /**
   * Generate resource collection checklist
   * @param {string} biomeName - Biome name
   * @returns {Array} Checklist of resources to watch for
   */
  generateChecklist: (biomeName) => {
    const biomeData = RESOURCE_OPTIMIZER.biomeOpportunities[biomeName];
    if (!biomeData) return [];

    const checklist = [];

    Object.entries(biomeData.gatheringStrategies).forEach(([resource, strategy]) => {
      checklist.push({
        item: resource,
        tool: strategy.tool,
        priority: strategy.worthwhile === "very_high" ? "HIGH" :
                 strategy.worthwhile === "high" ? "MEDIUM" : "LOW",
        notes: strategy.tips[0] || `Gather ${resource}`
      });
    });

    return checklist;
  }
};

/* =====================================================
 * EXPERIENCE & LEARNING SYSTEM
 * Track expeditions and adjust based on player skill
 * ===================================================== */

const EXPERIENCE_TRACKER = {
  playerSkillLevels: {
    novice: {
      level: 1,
      description: "New to Minecraft, learning the basics",
      riskMultiplier: 1.5, // Perceive 50% more risk
      supplyMultiplier: 1.3, // Need 30% more supplies
      recommendedTasks: ["plains_exploration", "village_finding", "basic_mining"],
      avoidTasks: ["nether_exploration", "end_exploration", "ocean_monument"],
      adjustments: {
        extraTorches: 64,
        extraFood: 16,
        requiredBed: true,
        avoidNight: true
      },
      tips: [
        "Always bring bed to skip night",
        "Mark coordinates frequently (every 50 blocks)",
        "Don't venture too far from base initially",
        "Practice combat in safe areas first",
        "Use shields to block attacks"
      ]
    },
    intermediate: {
      level: 2,
      description: "Comfortable with basics, ready for challenges",
      riskMultiplier: 1.0, // Standard risk assessment
      supplyMultiplier: 1.0, // Standard supply needs
      recommendedTasks: ["structure_hunting", "nether_exploration", "cave_exploration"],
      avoidTasks: ["end_exploration (until better gear)", "hardcore_challenges"],
      adjustments: {
        extraTorches: 0,
        extraFood: 0,
        requiredBed: false,
        avoidNight: false
      },
      tips: [
        "Start exploring Nether with fire resistance",
        "Practice elytra flying in safe areas",
        "Learn redstone basics for automation",
        "Enchant gear before dangerous expeditions"
      ]
    },
    expert: {
      level: 3,
      description: "Experienced player, can handle extreme challenges",
      riskMultiplier: 0.7, // Perceive 30% less risk due to skill
      supplyMultiplier: 0.8, // Need 20% fewer supplies
      recommendedTasks: ["end_exploration", "ocean_monument", "woodland_mansion", "hardcore_challenges"],
      avoidTasks: [], // Can handle anything
      adjustments: {
        extraTorches: -32, // Can bring less
        extraFood: -8,
        requiredBed: false,
        avoidNight: false,
        efficientGathering: true
      },
      tips: [
        "Optimize supply loadouts for efficiency",
        "Use advanced strategies (ice highways, elytra)",
        "Farm rare resources efficiently",
        "Tackle multiple objectives per expedition"
      ]
    },
    master: {
      level: 4,
      description: "Master player, speedrunner level",
      riskMultiplier: 0.5, // Perceive 50% less risk
      supplyMultiplier: 0.6, // Need 40% fewer supplies
      recommendedTasks: ["speedrun_challenges", "hardcore_mode", "self_imposed_challenges"],
      avoidTasks: [], // Nothing is too dangerous
      adjustments: {
        extraTorches: -48,
        extraFood: -12,
        requiredBed: false,
        avoidNight: false,
        efficientGathering: true,
        minimalSupplies: true
      },
      tips: [
        "Focus on speedrun techniques",
        "Memorize optimal routes and strategies",
        "Practice hardcore survival",
        "Create personal challenges"
      ]
    }
  },

  expeditionHistory: {
    // This would be populated from actual gameplay data
    // For now, we define the structure
    records: [],

    addRecord: (record) => {
      EXPERIENCE_TRACKER.expeditionHistory.records.push({
        timestamp: record.timestamp || Date.now(),
        biome: record.biome,
        structure: record.structure || null,
        success: record.success, // true/false
        deaths: record.deaths || 0,
        duration: record.duration,
        resourcesGathered: record.resourcesGathered || {},
        lessonsLearned: record.lessonsLearned || [],
        notes: record.notes || ""
      });
    },

    getSuccessRate: (biome = null) => {
      const records = biome
        ? EXPERIENCE_TRACKER.expeditionHistory.records.filter(r => r.biome === biome)
        : EXPERIENCE_TRACKER.expeditionHistory.records;

      if (records.length === 0) return 0;

      const successes = records.filter(r => r.success).length;
      return (successes / records.length) * 100;
    },

    getTotalDeaths: () => {
      return EXPERIENCE_TRACKER.expeditionHistory.records.reduce((sum, r) => sum + (r.deaths || 0), 0);
    }
  },

  /**
   * Determine player skill level based on history
   * @param {Object} history - Player expedition history
   * @returns {Object} Skill level data
   */
  assessSkillLevel: (history = {}) => {
    // Criteria for skill assessment
    const totalExpeditions = history.totalExpeditions || 0;
    const successRate = history.successRate || 0;
    const deaths = history.totalDeaths || 0;
    const structuresFound = history.structuresFound || 0;
    const hasNetherExperience = history.netherExpeditions || 0;
    const hasEndExperience = history.endExpeditions || 0;

    // Determine skill level based on criteria
    let skillLevel = "novice";

    if (totalExpeditions >= 50 && successRate >= 90 && deaths < 5 && hasEndExperience >= 3) {
      skillLevel = "master";
    } else if (totalExpeditions >= 20 && successRate >= 75 && hasNetherExperience >= 5) {
      skillLevel = "expert";
    } else if (totalExpeditions >= 5 && successRate >= 60) {
      skillLevel = "intermediate";
    }

    return EXPERIENCE_TRACKER.playerSkillLevels[skillLevel];
  },

  /**
   * Adjust supplies based on player skill
   * @param {Object} baseSupplies - Base supply requirements
   * @param {string} skillLevel - Player skill level
   * @returns {Object} Adjusted supplies
   */
  adjustSuppliesForSkill: (baseSupplies, skillLevel = "intermediate") => {
    const skill = EXPERIENCE_TRACKER.playerSkillLevels[skillLevel];
    if (!skill) return baseSupplies;

    const adjusted = {};

    Object.entries(baseSupplies).forEach(([item, quantity]) => {
      // Apply skill multiplier
      let adjustedQty = Math.ceil(quantity * skill.supplyMultiplier);

      // Apply specific adjustments
      if (item === "torches" && skill.adjustments.extraTorches) {
        adjustedQty += skill.adjustments.extraTorches;
      }
      if (item === "food" && skill.adjustments.extraFood) {
        adjustedQty += skill.adjustments.extraFood;
      }

      // Ensure minimum quantities
      adjustedQty = Math.max(1, adjustedQty);

      adjusted[item] = adjustedQty;
    });

    // Ensure bed for novices
    if (skill.level === 1 && skill.adjustments.requiredBed) {
      adjusted.bed = Math.max(adjusted.bed || 0, 1);
    }

    return adjusted;
  },

  /**
   * Adjust risk score based on player skill
   * @param {number} baseRiskScore - Base risk score (0-100)
   * @param {string} skillLevel - Player skill level
   * @returns {number} Adjusted risk score
   */
  adjustRiskForSkill: (baseRiskScore, skillLevel = "intermediate") => {
    const skill = EXPERIENCE_TRACKER.playerSkillLevels[skillLevel];
    if (!skill) return baseRiskScore;

    const adjustedScore = Math.round(baseRiskScore * skill.riskMultiplier);
    return Math.max(0, Math.min(100, adjustedScore)); // Clamp 0-100
  },

  /**
   * Get recommendations based on skill level
   * @param {string} skillLevel - Player skill level
   * @param {string} taskType - Type of task
   * @returns {Object} Recommendations
   */
  getSkillRecommendations: (skillLevel, taskType) => {
    const skill = EXPERIENCE_TRACKER.playerSkillLevels[skillLevel];
    if (!skill) return { warnings: [], tips: [] };

    const warnings = [];
    const tips = skill.tips || [];

    // Check if task is recommended
    if (skill.avoidTasks.includes(taskType)) {
      warnings.push(`⚠️ WARNING: ${taskType} not recommended for ${skillLevel} players`);
      warnings.push(`Recommended skill level: ${skill.level >= 3 ? "expert" : "intermediate"} or higher`);
    }

    if (skill.recommendedTasks.includes(taskType)) {
      tips.push(`✓ ${taskType} is well-suited for ${skillLevel} players`);
    }

    return {
      warnings,
      tips,
      skillLevel: skill.level,
      description: skill.description
    };
  },

  /**
   * Track expedition results and learn
   * @param {Object} results - Expedition results
   */
  trackExploration: (results) => {
    const record = {
      timestamp: Date.now(),
      biome: results.biome,
      structure: results.structure,
      success: results.success || false,
      deaths: results.deaths || 0,
      duration: results.duration || 0,
      resourcesGathered: results.resourcesGathered || {},
      lessonsLearned: [],
      notes: results.notes || ""
    };

    // Analyze results and extract lessons
    if (!results.success && results.deaths > 0) {
      record.lessonsLearned.push("Need better combat preparation");
      if (results.causeOfDeath) {
        record.lessonsLearned.push(`Died to: ${results.causeOfDeath} - bring appropriate countermeasures`);
      }
    }

    if (results.ranOutOfSupplies) {
      record.lessonsLearned.push(`Ran out of ${results.ranOutOfSupplies} - bring more next time`);
    }

    if (results.gotLost) {
      record.lessonsLearned.push("Navigation failed - use more waypoints and mark coordinates");
    }

    if (results.success && results.structureFound) {
      record.lessonsLearned.push(`Successfully found ${results.structure} in ${results.biome}`);
    }

    EXPERIENCE_TRACKER.expeditionHistory.addRecord(record);

    return {
      recorded: true,
      lessons: record.lessonsLearned,
      recommendation: record.lessonsLearned.length > 0
        ? "Learn from this expedition and adjust strategy"
        : "Successful expedition - keep up the good work!"
    };
  }
};

/* =====================================================
 * ROUTE OPTIMIZATION & PATHFINDING
 * Advanced routing algorithms and path planning
 * ===================================================== */

const ADVANCED_PATHFINDING = {
  algorithms: {
    a_star: {
      name: "A* Pathfinding",
      description: "Most efficient path avoiding obstacles",
      efficiency: 0.95,
      coverage: "targeted",
      difficulty: "automatic",
      bestFor: ["point_to_point_travel", "known_destination"],
      technique: "Calculates shortest safe path considering obstacles and terrain cost",
      advantages: [
        "Guaranteed shortest path",
        "Avoids dangerous areas",
        "Accounts for terrain difficulty",
        "Optimal travel time"
      ],
      disadvantages: [
        "Requires known destination",
        "May miss exploration opportunities",
        "Computationally intensive"
      ]
    },
    scenic_route: {
      name: "Scenic/Exploration Route",
      description: "Maximize exploration coverage and discovery",
      efficiency: 0.6,
      coverage: "maximum",
      difficulty: "easy",
      bestFor: ["general_exploration", "structure_hunting", "mapping"],
      technique: "Prioritizes unexplored areas and points of interest",
      advantages: [
        "Maximum area coverage",
        "High chance of finding structures",
        "Discover biome transitions",
        "Good for mapping"
      ],
      disadvantages: [
        "Takes longer",
        "Uses more supplies",
        "Can be inefficient"
      ]
    },
    safe_route: {
      name: "Safe Route Planning",
      description: "Avoid all dangerous areas and threats",
      efficiency: 0.7,
      coverage: "moderate",
      difficulty: "easy",
      bestFor: ["novice_players", "high_value_cargo", "low_risk_travel"],
      technique: "Routes around hazards with large safety margins",
      advantages: [
        "Minimizes danger",
        "Avoids mob spawners, ravines, lava",
        "Good for valuable cargo",
        "Stress-free travel"
      ],
      disadvantages: [
        "Longer routes",
        "May miss resources in dangerous areas",
        "Less exciting"
      ]
    },
    speed_route: {
      name: "Speed Route",
      description: "Absolute fastest route regardless of danger",
      efficiency: 1.0,
      coverage: "minimal",
      difficulty: "hard",
      bestFor: ["speedruns", "experienced_players", "emergency_travel"],
      technique: "Direct line, use elytra/ice highways, accept risks",
      advantages: [
        "Fastest possible travel",
        "Minimal time waste",
        "Direct to destination"
      ],
      disadvantages: [
        "High risk",
        "May encounter many dangers",
        "Requires good gear and skill",
        "Not suitable for novices"
      ]
    },
    resource_route: {
      name: "Resource Collection Route",
      description: "Optimize for resource gathering along path",
      efficiency: 0.5,
      coverage: "high",
      difficulty: "medium",
      bestFor: ["mining_expeditions", "resource_gathering", "farming_runs"],
      technique: "Routes through resource-rich areas",
      advantages: [
        "Maximize resource collection",
        "Efficient gathering",
        "Multi-purpose expedition"
      ],
      disadvantages: [
        "Slower travel",
        "May detour significantly",
        "Requires inventory space"
      ]
    }
  },

  obstacles: {
    lava_lakes: {
      dangerLevel: "critical",
      detourRecommended: true,
      costMultiplier: 50,
      mitigationOptions: ["fire_resistance_potion", "bridge_over", "detour_around"],
      notes: "Lava is instant death without fire resistance"
    },
    ravines: {
      dangerLevel: "high",
      detourRecommended: true,
      costMultiplier: 30,
      mitigationOptions: ["bridge_across", "climb_down_and_up", "detour_around"],
      notes: "Fall damage risk, can bridge or descend carefully"
    },
    mob_spawners: {
      dangerLevel: "high",
      detourRecommended: true,
      costMultiplier: 100,
      mitigationOptions: ["fight_through", "disable_spawner", "wide_detour"],
      notes: "Continuous mob spawning, dangerous without good gear"
    },
    ocean: {
      dangerLevel: "medium",
      detourRecommended: false,
      costMultiplier: 20,
      mitigationOptions: ["boat", "swim", "detour_around_coast"],
      notes: "Slow swimming, use boat for efficiency"
    },
    mountains: {
      dangerLevel: "medium",
      detourRecommended: false,
      costMultiplier: 40,
      mitigationOptions: ["climb_over", "tunnel_through", "go_around"],
      notes: "Slow traversal, fall risk, but often has good ores"
    },
    dense_forest: {
      dangerLevel: "low",
      detourRecommended: false,
      costMultiplier: 15,
      mitigationOptions: ["cut_path", "navigate_through"],
      notes: "Reduced visibility, slower movement"
    },
    swamp: {
      dangerLevel: "medium",
      detourRecommended: false,
      costMultiplier: 25,
      mitigationOptions: ["boat", "lily_pad_path", "detour"],
      notes: "Water slows movement, witches spawn"
    },
    desert: {
      dangerLevel: "low",
      detourRecommended: false,
      costMultiplier: 5,
      mitigationOptions: ["walk_through", "use_horse"],
      notes: "Fast travel, husks don't burn in day"
    },
    soul_sand: {
      dangerLevel: "medium",
      detourRecommended: true,
      costMultiplier: 60,
      mitigationOptions: ["soul_speed_boots", "ice_highway", "detour"],
      notes: "Drastically slows movement without soul speed"
    }
  },

  checkpoints: {
    safe_houses: {
      type: "player_built",
      purpose: "Emergency shelter, supply cache",
      recommended_spacing: 500, // blocks
      should_contain: [
        "bed",
        "crafting_table",
        "furnace",
        "chest with backup supplies",
        "food cache",
        "torches"
      ],
      notes: "Build safe houses every 500 blocks on long routes"
    },
    portal_locations: {
      type: "nether_portal",
      purpose: "Fast travel network",
      recommended_spacing: 1000, // blocks (8000 in nether)
      should_contain: [
        "protected_portal",
        "coordinates_marked",
        "obsidian_backup",
        "flint_and_steel"
      ],
      notes: "Nether travel is 8x faster - build portal network"
    },
    villages: {
      type: "natural_structure",
      purpose: "Trading, shelter, resources",
      should_mark: true,
      notes: "Always mark village coordinates for future trading"
    },
    biome_transitions: {
      type: "landmark",
      purpose: "Navigation reference",
      should_mark: true,
      notes: "Biome borders are good navigation landmarks"
    },
    tall_structures: {
      type: "landmark",
      purpose: "Visual navigation aid",
      examples: ["tall_pillars", "beacon_towers", "mountain_peaks"],
      notes: "Build tall pillars (100+ blocks) as visual waypoints"
    }
  },

  /**
   * Calculate optimal route between two points
   * @param {Object} start - Starting coordinates {x, y, z}
   * @param {Object} destination - Destination coordinates {x, y, z}
   * @param {string} algorithm - Routing algorithm to use
   * @param {Array} knownObstacles - Known obstacles to avoid
   * @returns {Object} Route plan with waypoints and estimates
   */
  calculateRoute: (start, destination, algorithm = "a_star", knownObstacles = []) => {
    const algo = ADVANCED_PATHFINDING.algorithms[algorithm];
    if (!algo) {
      return { error: "Unknown algorithm", suggestion: "Use: a_star, scenic_route, safe_route, or speed_route" };
    }

    // Calculate straight-line distance
    const dx = destination.x - start.x;
    const dz = destination.z - start.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    // Estimate travel time based on algorithm efficiency
    const baseTime = distance * 100; // ticks per block
    const adjustedTime = baseTime / algo.efficiency;

    // Generate waypoints (simplified - would be more complex in real implementation)
    const waypoints = [];
    const numWaypoints = Math.floor(distance / 200); // Every 200 blocks

    for (let i = 1; i <= numWaypoints; i++) {
      const ratio = i / (numWaypoints + 1);
      waypoints.push({
        x: Math.round(start.x + dx * ratio),
        z: Math.round(start.z + dz * ratio),
        checkpoint: i % 2 === 0 // Mark every other as recommended checkpoint
      });
    }

    // Analyze route for obstacles
    const routeWarnings = [];
    knownObstacles.forEach(obstacle => {
      const obstacleData = ADVANCED_PATHFINDING.obstacles[obstacle];
      if (obstacleData && obstacleData.detourRecommended) {
        routeWarnings.push(`⚠️ ${obstacle} detected on route - ${obstacleData.notes}`);
        routeWarnings.push(`  Mitigation: ${obstacleData.mitigationOptions.join(" OR ")}`);
      }
    });

    return {
      algorithm: algo.name,
      distance: Math.round(distance),
      estimatedTime: Math.round(adjustedTime / 1200), // convert to minutes
      waypoints,
      routeWarnings,
      recommendations: [
        `Using ${algo.name} for ${algo.bestFor.join(", ")}`,
        `Coverage: ${algo.coverage}, Efficiency: ${Math.round(algo.efficiency * 100)}%`,
        ...algo.advantages.map(adv => `✓ ${adv}`)
      ],
      disadvantages: algo.disadvantages
    };
  },

  /**
   * Suggest checkpoint locations along route
   * @param {number} distance - Total route distance
   * @param {string} routeType - Type of route
   * @returns {Array} Suggested checkpoint locations
   */
  suggestCheckpoints: (distance, routeType = "standard") => {
    const checkpoints = [];
    const spacing = ADVANCED_PATHFINDING.checkpoints.safe_houses.recommended_spacing;

    const numCheckpoints = Math.floor(distance / spacing);

    for (let i = 1; i <= numCheckpoints; i++) {
      const location = i * spacing;
      checkpoints.push({
        distance: location,
        type: i % 2 === 0 ? "safe_house" : "waypoint_marker",
        recommended_contents: i % 2 === 0
          ? ADVANCED_PATHFINDING.checkpoints.safe_houses.should_contain
          : ["torches", "sign_with_coordinates"],
        priority: i % 2 === 0 ? "high" : "medium"
      });
    }

    return {
      checkpoints,
      recommendations: [
        `Build ${Math.ceil(numCheckpoints / 2)} safe houses at ${spacing} block intervals`,
        `Place ${Math.floor(numCheckpoints / 2)} marker waypoints between safe houses`,
        "Each safe house should have bed, supplies, and crafting facilities"
      ]
    };
  },

  /**
   * Choose best algorithm for task
   * @param {string} taskType - Type of expedition task
   * @param {string} skillLevel - Player skill level
   * @param {number} riskScore - Risk score of expedition
   * @returns {Object} Recommended algorithm
   */
  recommendAlgorithm: (taskType, skillLevel = "intermediate", riskScore = 50) => {
    // Novice players should use safe routes
    if (skillLevel === "novice") {
      return {
        algorithm: "safe_route",
        reason: "Novice players benefit from safer routing"
      };
    }

    // High risk = safe route recommended
    if (riskScore >= 70) {
      return {
        algorithm: "safe_route",
        reason: "High risk expedition requires safer routing"
      };
    }

    // Speed tasks = speed route
    if (taskType === "speedrun" || taskType === "emergency") {
      return {
        algorithm: "speed_route",
        reason: "Speed is priority for this task type"
      };
    }

    // Exploration = scenic route
    if (taskType === "exploration" || taskType === "structure_hunting") {
      return {
        algorithm: "scenic_route",
        reason: "Exploration benefits from maximum coverage"
      };
    }

    // Resource gathering = resource route
    if (taskType === "gathering" || taskType === "mining") {
      return {
        algorithm: "resource_route",
        reason: "Optimize for resource collection"
      };
    }

    // Default to A*
    return {
      algorithm: "a_star",
      reason: "Efficient pathfinding for general tasks"
    };
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
  const safeRadius = Math.max(0, radius || 500); // Ensure non-negative
  const radiusTime = safeRadius * 100;
  const biomeMultiplier = Math.max(0.1, biome?.traversalSpeed || 1.0); // Prevent division by zero
  const strategyMultiplier = Math.max(0.1, strategy?.efficiency || 0.8); // Prevent division by zero

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

/**
 * Plan an exploration or scouting task
 * @param {Object} task - The exploration task to plan
 * @param {Object} task.target - Target location for exploration
 * @param {Object} [task.metadata] - Additional task configuration
 * @param {string} [task.metadata.biome] - Biome to explore
 * @param {string} [task.metadata.structure] - Structure to find
 * @param {number} [task.metadata.radius] - Exploration radius in blocks
 * @param {string} [task.metadata.transport] - Mode of transport
 * @param {Array} [task.metadata.supplies] - Additional supplies to bring
 * @param {Object} [context={}] - Execution context with inventory and biome info
 * @returns {Object} Exploration plan with steps, resources, risks, and notes
 * @throws {Error} If task or task.target is missing
 * @throws {Error} If biome is unknown
 * @throws {Error} If navigation strategy is invalid
 */
export function planExploreTask(task, context = {}) {
  // ===== Input Validation =====
  if (!task) {
    throw new Error("Task parameter is required for exploration planning");
  }
  
  if (!task.target) {
    throw new Error("Task must have a target location for exploration");
  }

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
  if (!biome) {
    throw new Error(`Unknown biome: ${biomeName}. Cannot create exploration plan.`);
  }
  
  const structure = structureName ? getStructureProfile(structureName) : null;
  if (structureName && !structure) {
    console.warn(`Unknown structure: ${structureName}. Continuing with general exploration.`);
  }
  
  const strategy = determineBestStrategy(task, biome, structure);
  if (!strategy || !strategy.efficiency || strategy.efficiency <= 0) {
    throw new Error("Invalid navigation strategy selected");
  }

  // ===== RISK ASSESSMENT - Safety Critical =====
  const riskAssessment = assessRisks(biome, structure, strategy, task);
  const { activeRisks, criticalRisks, requiredMitigation, riskScore } = riskAssessment;

  // ===== SUPPLY CALCULATION - Mission Planning =====
  const calculatedSupplies = calculateSupplies(biome, structure, strategy, radius, riskAssessment);

  // Merge calculated supplies with user-specified supplies
  const suppliesRaw = Array.isArray(task?.metadata?.supplies)
    ? task.metadata.supplies
    : task?.metadata?.supplies && typeof task.metadata.supplies === "object"
    ? Object.entries(task.metadata.supplies).map(([name, count]) => ({ name, count }))
    : task?.metadata?.supplies
    ? [task.metadata.supplies]
    : [];

  // Convert calculated supplies to array format
  const calculatedSuppliesArray = Object.entries(calculatedSupplies).map(([name, count]) => ({
    name: normalizeItemName(name),
    count
  }));

  // Combine all supplies
  const allSupplies = [...calculatedSuppliesArray, ...suppliesRaw];

  const inventory = extractInventory(context);
  const normalizedSupplies = allSupplies
    .map(item => {
      if (typeof item === "string") {
        return { name: normalizeItemName(item), count: 1 };
      }
      if (item && typeof item === "object") {
        return {
          name: normalizeItemName(item.name || item.item || item.id || Object.keys(item)[0]),
          count: resolveQuantity(item.count ?? item.quantity ?? Object.values(item)[0], 1)
        };
      }
      return null;
    })
    .filter(Boolean);

  // Remove duplicates, keeping highest count
  const uniqueSuppliesMap = new Map();
  normalizedSupplies.forEach(supply => {
    const existing = uniqueSuppliesMap.get(supply.name);
    if (!existing || (supply.count && supply.count > (existing.count || 0))) {
      uniqueSuppliesMap.set(supply.name, supply);
    }
  });
  const uniqueSupplies = Array.from(uniqueSuppliesMap.values());

  const missingSupplies = uniqueSupplies.filter(supply =>
    supply?.name ? !hasInventoryItem(inventory, supply.name) : false
  );

  // ===== EMERGENCY PROTOCOLS - Failure Recovery =====
  const emergencyProtocols = generateEmergencyChecklist(biome, structure, riskAssessment);

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

  // RISK ASSESSMENT WARNING - Safety Critical
  const riskLevel = riskScore >= 70 
    ? RISK_LEVEL_EXTREME 
    : riskScore >= RISK_THRESHOLD_HIGH 
    ? RISK_LEVEL_HIGH 
    : riskScore >= RISK_THRESHOLD_MODERATE 
    ? RISK_LEVEL_MODERATE 
    : RISK_LEVEL_LOW;
  const riskColor = riskScore >= 70 ? "🔴" : riskScore >= RISK_THRESHOLD_HIGH ? "🟠" : riskScore >= RISK_THRESHOLD_MODERATE ? "🟡" : "🟢";

  steps.push(
    createStep({
      title: `${riskColor} Risk Assessment: ${riskLevel} (Score: ${riskScore}/100)`,
      type: "safety",
      description: `Mission risk level: ${riskLevel}. Critical risks: ${criticalRisks.length > 0 ? criticalRisks.join(", ") : "None"}. Active hazards: ${activeRisks.length}. Required safety items: ${requiredMitigation.join(", ") || "Standard gear"}.`,
      metadata: {
        riskScore,
        riskLevel,
        criticalRisks,
        activeRisks: activeRisks.map(r => r.description),
        requiredMitigation
      }
    })
  );

  // DETAILED SUPPLY BREAKDOWN - Mission Planning
  const criticalSupplies = [];
  if (calculatedSupplies.food) criticalSupplies.push(`${calculatedSupplies.food} food`);
  if (calculatedSupplies.torches) criticalSupplies.push(`${calculatedSupplies.torches} torches`);
  if (calculatedSupplies.blocks) criticalSupplies.push(`${calculatedSupplies.blocks} blocks`);
  if (calculatedSupplies.arrows) criticalSupplies.push(`${calculatedSupplies.arrows} arrows`);
  if (calculatedSupplies.fire_resistance_potion) criticalSupplies.push(`${calculatedSupplies.fire_resistance_potion} fire resistance`);
  if (calculatedSupplies.water_breathing_potion) criticalSupplies.push(`${calculatedSupplies.water_breathing_potion} water breathing`);
  if (calculatedSupplies.slow_falling_potion) criticalSupplies.push(`${calculatedSupplies.slow_falling_potion} slow falling`);
  if (calculatedSupplies.ender_pearls) criticalSupplies.push(`${calculatedSupplies.ender_pearls} ender pearls`);
  if (calculatedSupplies.golden_apples) criticalSupplies.push(`${calculatedSupplies.golden_apples} golden apples`);

  steps.push(
    createStep({
      title: "Gather calculated supplies",
      type: "preparation",
      description: `Mission-critical supplies: ${criticalSupplies.join(", ")}. Total unique items needed: ${uniqueSupplies.length}. Missing from inventory: ${missingSupplies.length}.`,
      metadata: {
        calculatedSupplies,
        criticalSupplies,
        allSupplies: uniqueSupplies,
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

  // EMERGENCY PROTOCOLS BRIEFING - Failure Recovery
  if (emergencyProtocols && emergencyProtocols.length > 0) {
    const protocolNames = emergencyProtocols.map(p => p.name).join(", ");
    const criticalProtocols = emergencyProtocols.filter(p => p.protocol.priority === "critical");

    steps.push(
      createStep({
        title: "Review emergency protocols",
        type: "safety",
        description: `${emergencyProtocols.length} emergency protocols active: ${protocolNames}. Critical protocols: ${criticalProtocols.length}. Know your escape routes and recovery procedures.`,
        metadata: {
          protocols: emergencyProtocols,
          criticalCount: criticalProtocols.length
        }
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

  // ===== Identify Risks - Using Risk Assessment System =====
  const risks = [];

  // Add risk score overview
  risks.push(`🎯 Risk Score: ${riskScore}/100 (${riskLevel}). ${activeRisks.length} active hazards identified.`);

  // Add critical risks with mitigation
  if (criticalRisks.length > 0) {
    risks.push(`⚠️ CRITICAL RISKS: ${criticalRisks.join(", ")}. Mitigation required before departure.`);
  }

  // Add detailed risk descriptions
  activeRisks.forEach(risk => {
    if (risk.severity === "critical" || risk.severity === "high") {
      const mitigationSummary = risk.mitigation?.slice(0, 2).join("; ") || "Use caution";
      risks.push(`${risk.description} - ${risk.reason}. Mitigation: ${mitigationSummary}.`);
    }
  });

  // Add emergency protocol count
  if (emergencyProtocols.length > 0) {
    risks.push(`📋 ${emergencyProtocols.length} emergency protocols prepared for failure scenarios.`);
  }

  // ===== Additional Notes =====
  const notes = [];

  // Strategy efficiency note
  notes.push(`🧭 Navigation: ${strategy.name} (${Math.round(strategy.efficiency * 100)}% efficiency, ${strategy.coverage} coverage).`);

  // Biome traversal note
  notes.push(`🏃 Movement: Terrain traversal at ${Math.round(biome.traversalSpeed * 100)}% speed (${biome.terrain} terrain).`);

  // Supply calculation summary
  const totalFood = calculatedSupplies.food || 0;
  const totalBlocks = calculatedSupplies.blocks || 0;
  notes.push(`📦 Supplies: ${totalFood} food, ${totalBlocks} blocks calculated for ${radius || "standard"} block journey.`);

  // Structure rarity
  if (structure) {
    notes.push(`🏛️ Structure: ${structureName} (${structure.rarity} rarity, ${structure.findingDifficulty} difficulty).`);
    if (structure.worthRevisiting) {
      notes.push(`⭐ ${structureName} worth marking for future visits.`);
    }
  }

  // Emergency protocols summary
  const criticalProtocolNames = emergencyProtocols
    .filter(p => p.protocol.priority === "critical")
    .map(p => p.name);
  if (criticalProtocolNames.length > 0) {
    notes.push(`🚨 Critical protocols: ${criticalProtocolNames.join(", ")}.`);
  }

  // Risk-based notes
  if (riskScore >= RISK_THRESHOLD_HIGH) {
    notes.push(`⚠️ HIGH RISK EXPEDITION - Extra caution required. Backup gear essential.`);
  } else if (riskScore >= RISK_THRESHOLD_MODERATE) {
    notes.push(`⚡ Moderate risk - Stay alert and follow safety protocols.`);
  }

  // Required mitigation items
  if (requiredMitigation.length > 0) {
    notes.push(`🛡️ Safety gear mandatory: ${requiredMitigation.slice(0, 5).join(", ")}${requiredMitigation.length > 5 ? "..." : ""}.`);
  }

  // Time constraints
  if (task?.metadata?.returnBy) {
    notes.push(`⏰ Deadline: Return before ${task.metadata.returnBy}.`);
  }

  // Loot priority
  if (task?.metadata?.lootPriority) {
    notes.push(`💎 Priority loot: ${task.metadata.lootPriority}.`);
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
