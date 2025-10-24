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
  if (expeditionRadius > 1000) {
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

  return Math.min(100, Math.round(totalScore));
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
 */
function calculateSupplies(biome, structure, strategy, radius, risks) {
  const supplies = {};

  // Calculate food
  const foodBase = SUPPLY_REQUIREMENTS.food.baseQuantity;
  const foodDistance = (radius || 1000) * SUPPLY_REQUIREMENTS.food.perBlockTraveled;
  const foodDifficulty = SUPPLY_REQUIREMENTS.food.difficultyMultiplier[biome.difficulty] || 1.0;
  supplies.food = Math.ceil((foodBase + foodDistance) * foodDifficulty);

  // Calculate torches
  const torchBase = SUPPLY_REQUIREMENTS.torches.baseQuantity;
  const torchArea = (radius || 500) * SUPPLY_REQUIREMENTS.torches.perBlockRadius;
  const torchNav = SUPPLY_REQUIREMENTS.torches.navigationMultiplier[biome.navigationComplexity] || 1.0;
  supplies.torches = Math.ceil((torchBase + torchArea) * torchNav);

  // Calculate blocks
  const blockBase = SUPPLY_REQUIREMENTS.blocks.baseQuantity;
  const blockArea = (radius || 500) * SUPPLY_REQUIREMENTS.blocks.perBlockRadius;
  const blockTerrain = SUPPLY_REQUIREMENTS.blocks.terrainMultiplier[biome.terrain] || 1.0;
  supplies.blocks = Math.ceil((blockBase + blockArea) * blockTerrain);

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
  if (risks.riskScore >= 60) {
    supplies.golden_apples = 6;
    supplies.healing_potion = 4;
  } else if (risks.riskScore >= 40) {
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
 * WAYPOINT/MAPPING SYSTEM
 * Navigation aids and location tracking
 * ===================================================== */

const WAYPOINT_TYPES = {
  // Base Waypoints
  HOME_BASE: {
    symbol: "🏠",
    priority: "critical",
    description: "Main base location",
    markerType: "beacon",
    recommendedHeight: 256,
    lightRequired: true,
    purpose: "Primary return point and spawn location"
  },
  SPAWN_POINT: {
    symbol: "🛏️",
    priority: "critical",
    description: "Bed/respawn location",
    markerType: "bed",
    recommendedHeight: 0,
    lightRequired: true,
    purpose: "Respawn anchor if death occurs"
  },

  // Navigation Waypoints
  PORTAL: {
    symbol: "🌀",
    priority: "high",
    description: "Nether/End portal location",
    markerType: "tall_pillar",
    recommendedHeight: 100,
    lightRequired: true,
    purpose: "Dimension travel checkpoint"
  },
  JUNCTION: {
    symbol: "🔀",
    priority: "medium",
    description: "Path intersection or decision point",
    markerType: "torch_arrow",
    recommendedHeight: 5,
    lightRequired: true,
    purpose: "Navigation decision points"
  },
  CHECKPOINT: {
    symbol: "📍",
    priority: "medium",
    description: "Progress marker along route",
    markerType: "small_pillar",
    recommendedHeight: 10,
    lightRequired: false,
    purpose: "Track progress and mark safe route"
  },

  // Points of Interest
  STRUCTURE_FOUND: {
    symbol: "🏛️",
    priority: "high",
    description: "Discovered structure location",
    markerType: "beacon",
    recommendedHeight: 50,
    lightRequired: true,
    purpose: "Mark valuable structures for revisiting"
  },
  RESOURCE_DEPOSIT: {
    symbol: "💎",
    priority: "medium",
    description: "Valuable resource location",
    markerType: "sign",
    recommendedHeight: 5,
    lightRequired: false,
    purpose: "Mark resource-rich areas"
  },
  DANGER_ZONE: {
    symbol: "⚠️",
    priority: "high",
    description: "Hazardous area to avoid",
    markerType: "warning_pillar",
    recommendedHeight: 20,
    lightRequired: true,
    purpose: "Mark dangerous locations to avoid"
  },

  // Utility Waypoints
  SAFE_SHELTER: {
    symbol: "⛺",
    priority: "medium",
    description: "Emergency shelter location",
    markerType: "enclosed_structure",
    recommendedHeight: 5,
    lightRequired: true,
    purpose: "Safe rest and recovery point"
  },
  WATER_SOURCE: {
    symbol: "💧",
    priority: "low",
    description: "Water access point",
    markerType: "sign",
    recommendedHeight: 0,
    lightRequired: false,
    purpose: "Mark water sources in dry biomes"
  },
  FOOD_SOURCE: {
    symbol: "🍖",
    priority: "low",
    description: "Renewable food location",
    markerType: "sign",
    recommendedHeight: 0,
    lightRequired: false,
    purpose: "Mark farms or passive mob areas"
  }
};

const MAPPING_METHODS = {
  // In-Game Methods
  locator_map: {
    name: "Locator Map",
    accuracy: "high",
    range: 2048,
    requirements: ["map", "cartography_table"],
    advantages: ["Real-time position tracking", "Permanent record", "Shareable"],
    disadvantages: ["Limited range per map", "Requires multiple maps", "No vertical info"],
    bestFor: ["small_area", "detailed_mapping", "sharing_locations"]
  },

  coordinates: {
    name: "F3 Coordinates",
    accuracy: "exact",
    range: "unlimited",
    requirements: ["F3_debug_screen"],
    advantages: ["Exact position", "3D coordinates", "Always available", "Free"],
    disadvantages: ["Requires manual recording", "Not visible in-game", "Easy to forget"],
    bestFor: ["precise_navigation", "long_distance", "any_situation"]
  },

  compass: {
    name: "Compass Navigation",
    accuracy: "medium",
    range: "unlimited",
    requirements: ["compass"],
    advantages: ["Always points to spawn", "Simple to use", "No recording needed"],
    disadvantages: ["Only points to one location", "No distance info", "Limited utility"],
    bestFor: ["returning_to_spawn", "basic_navigation"]
  },

  lodestone_compass: {
    name: "Lodestone Compass",
    accuracy: "high",
    range: "unlimited",
    requirements: ["compass", "lodestone", "netherite"],
    advantages: ["Points to custom location", "Cross-dimension", "Multiple can be made"],
    disadvantages: ["Expensive (netherite)", "Breaks if lodestone removed", "One target per compass"],
    bestFor: ["important_locations", "nether_portals", "bases"]
  },

  // Physical Markers
  beacon: {
    name: "Beacon Marker",
    accuracy: "high",
    range: 256,
    requirements: ["beacon", "pyramid", "iron/gold/diamond/emerald"],
    advantages: ["Visible from far", "Provides buffs", "Permanent", "Light source"],
    disadvantages: ["Very expensive", "Requires pyramid", "Limited range"],
    bestFor: ["home_base", "major_structures", "permanent_locations"]
  },

  pillar: {
    name: "Tall Pillar",
    accuracy: "medium",
    range: 100,
    requirements: ["blocks"],
    advantages: ["Easy to build", "Visible from distance", "Cheap", "Quick"],
    disadvantages: ["Ugly", "Can be destroyed", "Limited visibility range"],
    bestFor: ["temporary_markers", "quick_navigation", "emergency"]
  },

  torch_trail: {
    name: "Torch Trail",
    accuracy: "high",
    range: 10,
    requirements: ["torches"],
    advantages: ["Easy to follow", "Lights path", "Prevents mob spawns"],
    disadvantages: ["Only close range", "Uses many torches", "Can be confusing"],
    bestFor: ["caves", "dark_areas", "short_routes"],
    technique: "Place torches on RIGHT when going out, LEFT on return"
  }
};

/**
 * Generate waypoint placement plan
 */
function generateWaypointPlan(biome, structure, radius, strategy) {
  const waypoints = [];

  // Always mark home base
  waypoints.push({
    type: "HOME_BASE",
    ...WAYPOINT_TYPES.HOME_BASE,
    placement: "Before departure",
    coordinates: "Record starting position (F3)"
  });

  // Mark spawn point
  waypoints.push({
    type: "SPAWN_POINT",
    ...WAYPOINT_TYPES.SPAWN_POINT,
    placement: "Before departure",
    coordinates: "Place bed and record coordinates"
  });

  // Dimension-specific waypoints
  if (biome.dimension === "nether" || biome.dimension === "end") {
    waypoints.push({
      type: "PORTAL",
      ...WAYPOINT_TYPES.PORTAL,
      placement: "At portal entrance",
      coordinates: "Critical - portal is only way back"
    });
  }

  // Navigation complexity based waypoints
  const complexity = biome.navigationComplexity;
  if (complexity === "very_high" || complexity === "extreme") {
    const checkpointInterval = complexity === "extreme" ? 100 : 200;
    waypoints.push({
      type: "CHECKPOINT",
      ...WAYPOINT_TYPES.CHECKPOINT,
      placement: `Every ${checkpointInterval} blocks`,
      quantity: Math.ceil((radius || 1000) / checkpointInterval),
      coordinates: "Record each checkpoint for return navigation"
    });
  } else if (complexity === "high") {
    waypoints.push({
      type: "CHECKPOINT",
      ...WAYPOINT_TYPES.CHECKPOINT,
      placement: "Every 300 blocks",
      quantity: Math.ceil((radius || 1000) / 300),
      coordinates: "Regular markers for safe return"
    });
  }

  // Junction waypoints for complex strategies
  if (strategy.name === "Grid Search" || strategy.name === "Spiral Search") {
    waypoints.push({
      type: "JUNCTION",
      ...WAYPOINT_TYPES.JUNCTION,
      placement: "At each turn/corner in pattern",
      quantity: "As needed",
      coordinates: "Mark direction changes clearly"
    });
  }

  // Structure waypoint
  if (structure) {
    waypoints.push({
      type: "STRUCTURE_FOUND",
      ...WAYPOINT_TYPES.STRUCTURE_FOUND,
      placement: "Upon finding structure",
      coordinates: `Mark ${structure.name} for future visits`
    });
  }

  // Emergency shelter for long expeditions
  if ((radius || 1000) > 2000) {
    waypoints.push({
      type: "SAFE_SHELTER",
      ...WAYPOINT_TYPES.SAFE_SHELTER,
      placement: "Midpoint of journey",
      coordinates: "Build safe shelter for night/emergencies"
    });
  }

  // Danger zones in hazardous biomes
  if (biome.difficulty === "very_hard" || biome.difficulty === "extreme") {
    waypoints.push({
      type: "DANGER_ZONE",
      ...WAYPOINT_TYPES.DANGER_ZONE,
      placement: "At any major hazards encountered",
      coordinates: "Mark lava lakes, ravines, spawners, etc."
    });
  }

  return waypoints;
}

/**
 * Select best mapping method for context
 */
function selectMappingMethod(biome, structure, radius) {
  const methods = [];

  // Coordinates always recommended
  methods.push({
    method: "coordinates",
    ...MAPPING_METHODS.coordinates,
    priority: "critical",
    usage: "Record all important locations (F3 → F2 screenshot or write down)"
  });

  // Locator maps for detailed area mapping
  if ((radius || 1000) <= 2048) {
    methods.push({
      method: "locator_map",
      ...MAPPING_METHODS.locator_map,
      priority: "high",
      usage: "Fill out maps to chart explored area systematically"
    });
  }

  // Lodestone compass for important locations
  if (structure || biome.dimension !== "overworld") {
    methods.push({
      method: "lodestone_compass",
      ...MAPPING_METHODS.lodestone_compass,
      priority: "high",
      usage: "Link to portal or structure for easy return navigation"
    });
  }

  // Physical markers based on biome
  if (biome.navigationComplexity === "very_high" || biome.navigationComplexity === "extreme") {
    methods.push({
      method: "torch_trail",
      ...MAPPING_METHODS.torch_trail,
      priority: "high",
      usage: "Torches on RIGHT going out - critical for return path"
    });

    methods.push({
      method: "pillar",
      ...MAPPING_METHODS.pillar,
      priority: "medium",
      usage: "Build tall pillars every 200-500 blocks for visibility"
    });
  }

  // Beacon for permanent base
  methods.push({
    method: "beacon",
    ...MAPPING_METHODS.beacon,
    priority: "low",
    usage: "Build at home base if resources available (visible from 256 blocks)"
  });

  return methods;
}

/* =====================================================
 * RETURN PATH PLANNING
 * Complete missions with safe return
 * ===================================================== */

const RETURN_STRATEGIES = {
  // Direct Return
  retrace_steps: {
    name: "Retrace Steps",
    reliability: "high",
    speed: "slow",
    safety: "high",
    description: "Follow exact path back using markers",
    requirements: ["waypoints", "torch_trail", "coordinates"],
    steps: [
      "Follow torch trail (torches on LEFT when returning)",
      "Check waypoints in reverse order",
      "Verify coordinates match outbound path",
      "Stop at checkpoints to reorient"
    ],
    bestFor: ["complex_terrain", "first_time_exploration", "valuable_cargo"],
    risks: ["Slow if path was indirect", "Markers may be destroyed"]
  },

  direct_navigation: {
    name: "Direct Navigation",
    reliability: "medium",
    speed: "fast",
    safety: "medium",
    description: "Navigate directly to home using coordinates/compass",
    requirements: ["coordinates", "compass_or_lodestone"],
    steps: [
      "Open F3 and note current position",
      "Calculate bearing to home base",
      "Navigate in straight line using F3",
      "Build bridges/tunnels as needed for obstacles"
    ],
    bestFor: ["open_terrain", "experienced_players", "emergency_return"],
    risks: ["May encounter unexpected hazards", "Can get stuck at obstacles"]
  },

  // Dimension-Specific
  nether_highway_return: {
    name: "Nether Highway Return",
    reliability: "very_high",
    speed: "very_fast",
    safety: "high",
    description: "Use protected nether highway for rapid return",
    requirements: ["nether_portal", "protected_path", "fire_resistance"],
    steps: [
      "Return to nether portal via marked path",
      "Navigate nether highway to home portal",
      "Verify portal coordinates before entering",
      "Prepare for overworld exit location"
    ],
    bestFor: ["long_distance_overworld", "established_highways", "fast_travel"],
    risks: ["Portal linking can be tricky", "Ghasts can damage highways"]
  },

  end_gateway_return: {
    name: "End Gateway Return",
    reliability: "high",
    speed: "instant",
    safety: "medium",
    description: "Use end gateway teleportation to return",
    requirements: ["ender_pearls", "end_gateway"],
    steps: [
      "Throw ender pearl through gateway",
      "Teleport to main island",
      "Use return portal to overworld",
      "Respawn at bed if needed"
    ],
    bestFor: ["end_exploration", "outer_islands", "emergency"],
    risks: ["Gateway must be accessible", "Ender pearl accuracy required"]
  },

  // Emergency Returns
  death_return: {
    name: "Death Return (Emergency)",
    reliability: "guaranteed",
    speed: "instant",
    safety: "low",
    description: "Intentional death to respawn at bed",
    requirements: ["bed_spawn_set", "acceptable_item_loss"],
    steps: [
      "Empty inventory into ender chest if available",
      "Store valuables in nearby chest (note coordinates!)",
      "Jump into void/lava or use /kill",
      "Respawn and prepare for item recovery"
    ],
    bestFor: ["stuck_situations", "lost_without_supplies", "dimension_stranded"],
    risks: ["Lose all items not stored", "Items despawn in 5 minutes", "Last resort only"]
  },

  ender_pearl_escape: {
    name: "Ender Pearl Escape",
    reliability: "high",
    speed: "fast",
    safety: "medium",
    description: "Use ender pearls to bypass obstacles quickly",
    requirements: ["ender_pearls", "moderate_throwing_skill"],
    steps: [
      "Identify safe landing spots",
      "Throw ender pearl while moving",
      "Chain multiple pearls for long distance",
      "Watch health (2.5 hearts damage per pearl)"
    ],
    bestFor: ["obstacle_bypass", "emergency_escape", "rapid_movement"],
    risks: ["Fall damage", "Can teleport into walls", "Limited by pearl count"]
  }
};

/**
 * Plan return path strategy
 */
function planReturnPath(biome, structure, strategy, radius, waypoints) {
  const returnPlan = {
    primaryStrategy: null,
    backupStrategies: [],
    estimatedReturnTime: 0,
    safeguards: [],
    prerequisites: []
  };

  // Select primary return strategy
  if (biome.dimension === "nether" && strategy.name.includes("Highway")) {
    returnPlan.primaryStrategy = RETURN_STRATEGIES.nether_highway_return;
  } else if (biome.dimension === "end") {
    returnPlan.primaryStrategy = RETURN_STRATEGIES.end_gateway_return;
  } else if (biome.navigationComplexity === "very_high" || biome.navigationComplexity === "extreme") {
    returnPlan.primaryStrategy = RETURN_STRATEGIES.retrace_steps;
  } else {
    returnPlan.primaryStrategy = RETURN_STRATEGIES.direct_navigation;
  }

  // Add backup strategies
  if (returnPlan.primaryStrategy.name !== "Retrace Steps") {
    returnPlan.backupStrategies.push(RETURN_STRATEGIES.retrace_steps);
  }
  if (returnPlan.primaryStrategy.name !== "Direct Navigation") {
    returnPlan.backupStrategies.push(RETURN_STRATEGIES.direct_navigation);
  }

  // Emergency backup
  returnPlan.backupStrategies.push(RETURN_STRATEGIES.ender_pearl_escape);

  // Estimate return time (usually faster than outbound)
  const outboundTime = (radius || 1000) / (biome.traversalSpeed * 4.3); // 4.3 m/s walking speed
  returnPlan.estimatedReturnTime = Math.floor(outboundTime * 0.7); // 30% faster return

  // Add safeguards
  returnPlan.safeguards = [
    "Check coordinates before leaving structure/POI",
    "Mark return path with torches/blocks",
    "Screenshot important locations",
    "Keep ender pearls in hotbar for emergencies",
    "Monitor time to avoid night travel if possible"
  ];

  // Prerequisites for return
  returnPlan.prerequisites = [
    "Home base coordinates recorded",
    "Bed spawn point set and verified",
    "Return supplies reserved (food, torches, blocks)",
    waypoints.length > 0 ? "Waypoints placed during outbound journey" : null,
    biome.dimension !== "overworld" ? "Portal coordinates confirmed" : null
  ].filter(Boolean);

  return returnPlan;
}

/* =====================================================
 * PROGRESS TRACKING
 * Monitoring and milestone tracking
 * ===================================================== */

const PROGRESS_MILESTONES = {
  // Preparation Milestones
  SUPPLIES_GATHERED: {
    phase: "preparation",
    importance: "critical",
    description: "All required supplies collected",
    verification: "Check inventory against calculated supplies list",
    blocksNext: true
  },
  SPAWN_SET: {
    phase: "preparation",
    importance: "critical",
    description: "Bed placed and spawn point set",
    verification: "Sleep in bed to confirm spawn point",
    blocksNext: true
  },
  COORDINATES_RECORDED: {
    phase: "preparation",
    importance: "high",
    description: "Home base coordinates documented",
    verification: "Screenshot or write down X Y Z coordinates",
    blocksNext: false
  },

  // Journey Milestones
  DEPARTED_BASE: {
    phase: "journey",
    importance: "medium",
    description: "Left home base and started expedition",
    verification: "Visual confirmation or distance check",
    blocksNext: false
  },
  FIRST_CHECKPOINT: {
    phase: "journey",
    importance: "medium",
    description: "Reached first waypoint/checkpoint",
    verification: "Waypoint placed and coordinates recorded",
    blocksNext: false
  },
  HALFWAY_POINT: {
    phase: "journey",
    importance: "medium",
    description: "Reached halfway to destination",
    verification: "Check coordinates - 50% of radius traveled",
    blocksNext: false
  },
  TARGET_AREA_REACHED: {
    phase: "journey",
    importance: "high",
    description: "Arrived at target exploration area",
    verification: "Coordinates match destination or biome entered",
    blocksNext: false
  },

  // Exploration Milestones
  SEARCH_STARTED: {
    phase: "exploration",
    importance: "medium",
    description: "Began systematic search of area",
    verification: "Navigation strategy initiated",
    blocksNext: false
  },
  STRUCTURE_LOCATED: {
    phase: "exploration",
    importance: "high",
    description: "Target structure found",
    verification: "Visual confirmation and coordinates recorded",
    blocksNext: false
  },
  STRUCTURE_EXPLORED: {
    phase: "exploration",
    importance: "high",
    description: "Structure fully explored and looted",
    verification: "All rooms cleared, loot collected",
    blocksNext: false
  },
  AREA_MAPPED: {
    phase: "exploration",
    importance: "medium",
    description: "Target area fully surveyed",
    verification: "Map filled or grid search complete",
    blocksNext: false
  },

  // Return Milestones
  RETURN_INITIATED: {
    phase: "return",
    importance: "medium",
    description: "Started journey back to base",
    verification: "Moving toward home coordinates",
    blocksNext: false
  },
  PORTAL_REACHED: {
    phase: "return",
    importance: "high",
    description: "Returned to portal (if applicable)",
    verification: "Portal visible and accessible",
    blocksNext: false
  },
  SAFE_ZONE_ENTERED: {
    phase: "return",
    importance: "medium",
    description: "Entered familiar/safe territory",
    verification: "Recognize landmarks or within 500 blocks of home",
    blocksNext: false
  },
  MISSION_COMPLETE: {
    phase: "completion",
    importance: "critical",
    description: "Returned to base safely",
    verification: "At home base with loot secured",
    blocksNext: false
  }
};

const TRACKING_METRICS = {
  // Distance Metrics
  distance: {
    name: "Distance Traveled",
    unit: "blocks",
    calculation: "Track via F3 coordinates",
    important: true,
    targets: {
      short: 500,
      medium: 1000,
      long: 2000,
      extreme: 5000
    }
  },

  // Time Metrics
  duration: {
    name: "Time Elapsed",
    unit: "minutes",
    calculation: "Real-time or in-game time",
    important: true,
    targets: {
      quick: 10,
      normal: 30,
      extended: 60,
      marathon: 120
    }
  },

  // Resource Metrics
  supplies_remaining: {
    name: "Supplies Remaining",
    unit: "percentage",
    calculation: "Current vs starting inventory",
    important: true,
    criticalThreshold: 25, // Return when below 25%
    items: ["food", "torches", "blocks", "arrows"]
  },

  // Safety Metrics
  health_status: {
    name: "Health Status",
    unit: "hearts",
    calculation: "Current health vs max health",
    important: true,
    criticalThreshold: 10, // Concern below 10 hearts
    warningThreshold: 15
  },

  // Exploration Metrics
  structures_found: {
    name: "Structures Discovered",
    unit: "count",
    calculation: "Increment for each structure",
    important: false,
    tracking: ["villages", "temples", "mansions", "monuments", "fortresses"]
  },

  area_covered: {
    name: "Area Explored",
    unit: "square blocks",
    calculation: "Estimated from coordinates",
    important: false
  }
};

/**
 * Generate progress tracking checklist
 */
function generateProgressChecklist(biome, structure, radius, estimatedDuration) {
  const checklist = [];

  // Preparation phase
  checklist.push({
    milestone: "SUPPLIES_GATHERED",
    ...PROGRESS_MILESTONES.SUPPLIES_GATHERED,
    checkTime: "Before departure",
    critical: true
  });

  checklist.push({
    milestone: "SPAWN_SET",
    ...PROGRESS_MILESTONES.SPAWN_SET,
    checkTime: "Before departure",
    critical: true
  });

  checklist.push({
    milestone: "COORDINATES_RECORDED",
    ...PROGRESS_MILESTONES.COORDINATES_RECORDED,
    checkTime: "Before departure",
    critical: false
  });

  // Journey phase
  checklist.push({
    milestone: "DEPARTED_BASE",
    ...PROGRESS_MILESTONES.DEPARTED_BASE,
    checkTime: "0 minutes",
    estimatedTime: 0
  });

  if ((radius || 1000) > 500) {
    checklist.push({
      milestone: "FIRST_CHECKPOINT",
      ...PROGRESS_MILESTONES.FIRST_CHECKPOINT,
      checkTime: `${Math.floor(estimatedDuration * 0.15)} seconds`,
      estimatedTime: Math.floor(estimatedDuration * 0.15)
    });
  }

  checklist.push({
    milestone: "TARGET_AREA_REACHED",
    ...PROGRESS_MILESTONES.TARGET_AREA_REACHED,
    checkTime: `${Math.floor(estimatedDuration * 0.4)} seconds`,
    estimatedTime: Math.floor(estimatedDuration * 0.4)
  });

  // Exploration phase
  checklist.push({
    milestone: "SEARCH_STARTED",
    ...PROGRESS_MILESTONES.SEARCH_STARTED,
    checkTime: `${Math.floor(estimatedDuration * 0.45)} seconds`,
    estimatedTime: Math.floor(estimatedDuration * 0.45)
  });

  if (structure) {
    checklist.push({
      milestone: "STRUCTURE_LOCATED",
      ...PROGRESS_MILESTONES.STRUCTURE_LOCATED,
      checkTime: `${Math.floor(estimatedDuration * 0.6)} seconds (variable)`,
      estimatedTime: Math.floor(estimatedDuration * 0.6)
    });

    checklist.push({
      milestone: "STRUCTURE_EXPLORED",
      ...PROGRESS_MILESTONES.STRUCTURE_EXPLORED,
      checkTime: `${Math.floor(estimatedDuration * 0.75)} seconds`,
      estimatedTime: Math.floor(estimatedDuration * 0.75)
    });
  }

  // Return phase
  checklist.push({
    milestone: "RETURN_INITIATED",
    ...PROGRESS_MILESTONES.RETURN_INITIATED,
    checkTime: `${Math.floor(estimatedDuration * 0.8)} seconds`,
    estimatedTime: Math.floor(estimatedDuration * 0.8)
  });

  if (biome.dimension !== "overworld") {
    checklist.push({
      milestone: "PORTAL_REACHED",
      ...PROGRESS_MILESTONES.PORTAL_REACHED,
      checkTime: `${Math.floor(estimatedDuration * 0.9)} seconds`,
      estimatedTime: Math.floor(estimatedDuration * 0.9)
    });
  }

  checklist.push({
    milestone: "MISSION_COMPLETE",
    ...PROGRESS_MILESTONES.MISSION_COMPLETE,
    checkTime: `${estimatedDuration} seconds (target)`,
    estimatedTime: estimatedDuration
  });

  return checklist;
}

/**
 * Generate tracking metrics to monitor
 */
function generateTrackingMetrics(radius, estimatedDuration, calculatedSupplies) {
  const metrics = [];

  // Distance tracking
  metrics.push({
    metric: "distance",
    ...TRACKING_METRICS.distance,
    target: radius || 1000,
    checkpoints: [
      { at: Math.floor((radius || 1000) * 0.25), label: "25% distance" },
      { at: Math.floor((radius || 1000) * 0.5), label: "Halfway point" },
      { at: Math.floor((radius || 1000) * 0.75), label: "75% distance" },
      { at: radius || 1000, label: "Target reached" }
    ]
  });

  // Time tracking
  const timeMinutes = Math.floor(estimatedDuration / 60);
  metrics.push({
    metric: "duration",
    ...TRACKING_METRICS.duration,
    target: timeMinutes,
    checkpoints: [
      { at: Math.floor(timeMinutes * 0.33), label: "First third elapsed" },
      { at: Math.floor(timeMinutes * 0.66), label: "Two thirds elapsed" },
      { at: timeMinutes, label: "Target time reached" }
    ]
  });

  // Supply tracking
  metrics.push({
    metric: "supplies_remaining",
    ...TRACKING_METRICS.supplies_remaining,
    startingSupplies: {
      food: calculatedSupplies.food || 16,
      torches: calculatedSupplies.torches || 64,
      blocks: calculatedSupplies.blocks || 64
    },
    warnings: [
      { threshold: 50, message: "Halfway through supplies - monitor usage" },
      { threshold: 25, message: "⚠️ LOW SUPPLIES - Consider returning soon" },
      { threshold: 10, message: "🚨 CRITICAL - Return immediately or resupply" }
    ]
  });

  // Health tracking
  metrics.push({
    metric: "health_status",
    ...TRACKING_METRICS.health_status,
    maxHealth: 20,
    warnings: [
      { threshold: 15, message: "Health moderate - eat if needed" },
      { threshold: 10, message: "⚠️ LOW HEALTH - Heal immediately" },
      { threshold: 5, message: "🚨 CRITICAL HEALTH - Retreat and heal" }
    ]
  });

  return metrics;
}

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

  // ===== WAYPOINT/MAPPING SYSTEM - Navigation Aids =====
  const waypointPlan = generateWaypointPlan(biome, structure, radius, strategy);
  const mappingMethods = selectMappingMethod(biome, structure, radius);

  // ===== RETURN PATH PLANNING - Complete Missions =====
  const returnPath = planReturnPath(biome, structure, strategy, radius, waypointPlan);

  // ===== PROGRESS TRACKING - Monitoring =====
  const estimatedDuration = calculateExplorationDuration(radius, biome, strategy);
  const progressChecklist = generateProgressChecklist(biome, structure, radius, estimatedDuration);
  const trackingMetrics = generateTrackingMetrics(radius, estimatedDuration, calculatedSupplies);

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
  const riskLevel = riskScore >= 70 ? "EXTREME" : riskScore >= 50 ? "HIGH" : riskScore >= 30 ? "MEDIUM" : "LOW";
  const riskColor = riskScore >= 70 ? "🔴" : riskScore >= 50 ? "🟠" : riskScore >= 30 ? "🟡" : "🟢";

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

  // WAYPOINT PLACEMENT PLAN - Navigation Aids
  if (waypointPlan && waypointPlan.length > 0) {
    const criticalWaypoints = waypointPlan.filter(w => w.priority === "critical");
    const waypointSummary = waypointPlan.map(w => `${w.symbol} ${w.type}`).slice(0, 5).join(", ");

    steps.push(
      createStep({
        title: "Plan waypoint placement",
        type: "navigation",
        description: `Place ${waypointPlan.length} waypoints: ${waypointSummary}${waypointPlan.length > 5 ? "..." : ""}. Critical waypoints: ${criticalWaypoints.length}.`,
        metadata: {
          waypoints: waypointPlan,
          criticalCount: criticalWaypoints.length
        }
      })
    );
  }

  // MAPPING METHOD SELECTION - Navigation Aids
  if (mappingMethods && mappingMethods.length > 0) {
    const primaryMethod = mappingMethods.find(m => m.priority === "critical") || mappingMethods[0];
    const methodNames = mappingMethods.map(m => m.name).slice(0, 3).join(", ");

    steps.push(
      createStep({
        title: "Setup mapping system",
        type: "preparation",
        description: `Primary: ${primaryMethod.name} - ${primaryMethod.usage}. Also use: ${methodNames}.`,
        metadata: {
          methods: mappingMethods,
          primaryMethod: primaryMethod.name
        }
      })
    );
  }

  // RETURN PATH STRATEGY - Complete Missions
  if (returnPath) {
    const backupCount = returnPath.backupStrategies?.length || 0;

    steps.push(
      createStep({
        title: "Plan return strategy",
        type: "navigation",
        description: `Primary return: ${returnPath.primaryStrategy.name} (${returnPath.primaryStrategy.reliability} reliability, ${returnPath.primaryStrategy.speed} speed). ${backupCount} backup strategies available. Estimated return time: ${Math.floor(returnPath.estimatedReturnTime / 60)} minutes.`,
        metadata: {
          returnPath,
          estimatedReturnTime: returnPath.estimatedReturnTime
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

  // PROGRESS TRACKING - Monitor Mission
  if (progressChecklist && progressChecklist.length > 0) {
    const criticalMilestones = progressChecklist.filter(m => m.critical);
    const phases = [...new Set(progressChecklist.map(m => m.phase))];

    steps.push(
      createStep({
        title: "Track expedition progress",
        type: "monitoring",
        description: `Monitor ${progressChecklist.length} milestones across ${phases.length} phases (${phases.join(", ")}). Critical checkpoints: ${criticalMilestones.length}. Check progress regularly against timeline.`,
        metadata: {
          checklist: progressChecklist,
          phases,
          criticalCount: criticalMilestones.length
        }
      })
    );
  }

  // TRACKING METRICS - Monitor Resources
  if (trackingMetrics && trackingMetrics.length > 0) {
    const criticalMetrics = trackingMetrics.filter(m => m.important);
    const metricNames = trackingMetrics.map(m => m.name).join(", ");

    steps.push(
      createStep({
        title: "Monitor key metrics",
        type: "monitoring",
        description: `Track ${trackingMetrics.length} metrics: ${metricNames}. Monitor supplies, health, distance, and time. Alert at critical thresholds.`,
        metadata: {
          metrics: trackingMetrics,
          criticalCount: criticalMetrics.length
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
  if (riskScore >= 60) {
    notes.push(`⚠️ HIGH RISK EXPEDITION - Extra caution required. Backup gear essential.`);
  } else if (riskScore >= 40) {
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

  // Waypoint and mapping notes
  if (waypointPlan && waypointPlan.length > 0) {
    const criticalWaypoints = waypointPlan.filter(w => w.priority === "critical").length;
    notes.push(`📍 Waypoints: ${waypointPlan.length} planned (${criticalWaypoints} critical) for navigation safety.`);
  }

  if (mappingMethods && mappingMethods.length > 0) {
    const primaryMethod = mappingMethods.find(m => m.priority === "critical") || mappingMethods[0];
    notes.push(`🗺️ Mapping: Primary method ${primaryMethod.name} + ${mappingMethods.length - 1} backup methods.`);
  }

  // Return path notes
  if (returnPath) {
    notes.push(`🔙 Return: ${returnPath.primaryStrategy.name} (~${Math.floor(returnPath.estimatedReturnTime / 60)} min, ${returnPath.primaryStrategy.reliability} reliability).`);
    if (returnPath.backupStrategies.length > 0) {
      notes.push(`🔄 Backup routes: ${returnPath.backupStrategies.length} alternative return strategies prepared.`);
    }
  }

  // Progress tracking notes
  if (progressChecklist && progressChecklist.length > 0) {
    const phases = [...new Set(progressChecklist.map(m => m.phase))].length;
    notes.push(`📊 Progress: ${progressChecklist.length} milestones tracked across ${phases} mission phases.`);
  }

  if (trackingMetrics && trackingMetrics.length > 0) {
    notes.push(`📈 Metrics: Monitoring ${trackingMetrics.length} key indicators (distance, time, supplies, health).`);
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
