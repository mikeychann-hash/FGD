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

// Building Templates & Blueprints
const BUILDING_TEMPLATES = {
  // Residential structures
  basic_house: {
    name: "Basic House",
    category: "residential",
    dimensions: { length: 7, width: 7, height: 5 },
    materials: {
      oak_planks: 220,
      glass_pane: 16,
      oak_door: 1,
      torch: 12,
      crafting_table: 1,
      bed: 1
    },
    difficulty: "easy",
    estimatedDuration: 18000, // ms
    roofStyle: "pitched",
    interior: true,
    features: ["lighting", "basic_furnishings"]
  },

  cottage: {
    name: "Cottage",
    category: "residential",
    dimensions: { length: 9, width: 7, height: 6 },
    materials: {
      spruce_planks: 280,
      cobblestone: 120,
      glass_pane: 20,
      spruce_door: 1,
      torch: 16,
      furnace: 1,
      chest: 3
    },
    difficulty: "easy",
    estimatedDuration: 24000,
    roofStyle: "pitched",
    interior: true,
    foundation: "stone",
    features: ["chimney", "storage", "lighting"]
  },

  starter_house: {
    name: "Starter House",
    category: "residential",
    dimensions: { length: 5, width: 5, height: 4 },
    materials: {
      oak_planks: 100,
      glass_pane: 6,
      oak_door: 1,
      torch: 8,
      crafting_table: 1,
      furnace: 1,
      bed: 1,
      chest: 2
    },
    difficulty: "easy",
    estimatedDuration: 12000,
    roofStyle: "flat",
    interior: true,
    features: ["basic_survival", "minimal_materials"]
  },

  modern_house: {
    name: "Modern House",
    category: "residential",
    dimensions: { length: 12, width: 10, height: 6 },
    materials: {
      quartz_block: 350,
      white_concrete: 200,
      glass_pane: 45,
      iron_door: 1,
      torch: 20,
      glowstone: 12,
      oak_planks: 80
    },
    difficulty: "medium",
    estimatedDuration: 45000,
    roofStyle: "flat",
    interior: true,
    features: ["modern_design", "large_windows", "open_floor_plan"]
  },

  medieval_house: {
    name: "Medieval House",
    category: "residential",
    dimensions: { length: 8, width: 7, height: 7 },
    materials: {
      oak_planks: 250,
      cobblestone: 180,
      oak_log: 45,
      glass_pane: 14,
      oak_door: 1,
      torch: 12,
      oak_stairs: 30
    },
    difficulty: "medium",
    estimatedDuration: 32000,
    roofStyle: "steep",
    interior: true,
    foundation: "stone",
    features: ["timber_frame", "authentic_medieval", "thatched_roof_style"]
  },

  log_cabin: {
    name: "Log Cabin",
    category: "residential",
    dimensions: { length: 10, width: 8, height: 5 },
    materials: {
      oak_log: 320,
      spruce_log: 100,
      glass_pane: 12,
      oak_door: 1,
      torch: 14,
      furnace: 1,
      chest: 4,
      crafting_table: 1
    },
    difficulty: "easy",
    estimatedDuration: 28000,
    roofStyle: "pitched",
    interior: true,
    terrain: "forest",
    features: ["rustic", "natural_materials", "cozy"]
  },

  two_story_house: {
    name: "Two Story House",
    category: "residential",
    dimensions: { length: 11, width: 9, height: 9 },
    materials: {
      oak_planks: 420,
      cobblestone: 150,
      glass_pane: 28,
      oak_door: 2,
      ladder: 8,
      torch: 24,
      chest: 5,
      bed: 2
    },
    difficulty: "medium",
    estimatedDuration: 50000,
    roofStyle: "pitched",
    interior: true,
    foundation: "stone",
    features: ["multiple_floors", "stairs", "bedrooms"]
  },

  mansion: {
    name: "Mansion",
    category: "residential",
    dimensions: { length: 25, width: 20, height: 12 },
    materials: {
      quartz_block: 1200,
      oak_planks: 800,
      stone_bricks: 600,
      glass_pane: 120,
      iron_door: 3,
      chandelier: 8,
      carpet: 250,
      torch: 50,
      chest: 15
    },
    difficulty: "hard",
    estimatedDuration: 180000,
    roofStyle: "pitched",
    interior: true,
    foundation: "stone",
    features: ["multiple_rooms", "grand_entrance", "luxurious", "balconies"]
  },

  underground_bunker: {
    name: "Underground Bunker",
    category: "residential",
    dimensions: { length: 12, width: 10, height: 4 },
    materials: {
      stone_bricks: 450,
      iron_door: 2,
      redstone_torch: 8,
      torch: 20,
      iron_bars: 16,
      chest: 10,
      bed: 2,
      ladder: 10
    },
    difficulty: "medium",
    estimatedDuration: 55000,
    terrain: "underground",
    levelGround: true,
    features: ["secure", "hidden", "self_sufficient"]
  },

  treehouse: {
    name: "Treehouse",
    category: "residential",
    dimensions: { length: 8, width: 8, height: 6 },
    materials: {
      oak_planks: 280,
      oak_log: 60,
      oak_fence: 40,
      ladder: 15,
      glass_pane: 12,
      oak_trapdoor: 4,
      torch: 10
    },
    difficulty: "medium",
    estimatedDuration: 38000,
    requiresScaffolding: true,
    terrain: "forest",
    features: ["elevated", "nature_integration", "ladder_access"]
  },

  // Defensive structures
  watchtower: {
    name: "Watchtower",
    category: "defensive",
    dimensions: { length: 5, width: 5, height: 15 },
    materials: {
      stone_bricks: 450,
      ladder: 14,
      torch: 20,
      fence: 16
    },
    difficulty: "medium",
    estimatedDuration: 45000,
    requiresScaffolding: true,
    threatLevel: "medium",
    features: ["elevated_platform", "perimeter_fence"]
  },

  castle_tower: {
    name: "Castle Tower",
    category: "defensive",
    dimensions: { length: 9, width: 9, height: 20 },
    materials: {
      stone_bricks: 900,
      cobblestone: 400,
      oak_planks: 120,
      iron_door: 1,
      ladder: 18,
      torch: 30
    },
    difficulty: "hard",
    estimatedDuration: 90000,
    requiresScaffolding: true,
    foundation: "stone",
    roofStyle: "battlements",
    features: ["arrow_slits", "spiral_stairs", "battlements"]
  },

  fortress_wall: {
    name: "Fortress Wall",
    category: "defensive",
    dimensions: { length: 30, width: 3, height: 8 },
    materials: {
      stone_bricks: 720,
      cobblestone: 200,
      torch: 15
    },
    difficulty: "medium",
    estimatedDuration: 50000,
    features: ["battlements", "guard_posts"]
  },

  // Agricultural structures
  basic_farm: {
    name: "Basic Farm",
    category: "agricultural",
    dimensions: { length: 9, width: 9, height: 0 },
    materials: {
      dirt: 81,
      water_bucket: 1,
      fence: 36,
      fence_gate: 1,
      hoe: 1,
      seeds: 64
    },
    difficulty: "easy",
    estimatedDuration: 15000,
    terrain: "flat",
    levelGround: true,
    features: ["irrigation", "fencing"]
  },

  redstone_farm: {
    name: "Automated Redstone Farm",
    category: "agricultural",
    dimensions: { length: 15, width: 15, height: 4 },
    materials: {
      redstone: 64,
      observer: 12,
      hopper: 8,
      dispenser: 4,
      chest: 4,
      building_blocks: 300
    },
    difficulty: "expert",
    estimatedDuration: 60000,
    includesRedstone: true,
    levelGround: true,
    features: ["automation", "collection_system", "water_distribution"]
  },

  wheat_farm: {
    name: "Wheat Farm",
    category: "agricultural",
    dimensions: { length: 20, width: 20, height: 0 },
    materials: {
      dirt: 400,
      water_bucket: 4,
      fence: 80,
      fence_gate: 2,
      hoe: 1,
      wheat_seeds: 128,
      torch: 12
    },
    difficulty: "easy",
    estimatedDuration: 20000,
    terrain: "flat",
    levelGround: true,
    features: ["irrigation", "fencing", "crop_rotation"]
  },

  pumpkin_melon_farm: {
    name: "Pumpkin and Melon Farm",
    category: "agricultural",
    dimensions: { length: 18, width: 12, height: 0 },
    materials: {
      dirt: 216,
      farmland: 108,
      water_bucket: 3,
      fence: 60,
      fence_gate: 1,
      pumpkin_seeds: 32,
      melon_seeds: 32,
      torch: 10
    },
    difficulty: "easy",
    estimatedDuration: 18000,
    terrain: "flat",
    levelGround: true,
    features: ["alternating_rows", "water_channels"]
  },

  sugar_cane_farm: {
    name: "Sugar Cane Farm",
    category: "agricultural",
    dimensions: { length: 16, width: 10, height: 0 },
    materials: {
      sand: 160,
      water_bucket: 8,
      sugar_cane: 80,
      fence: 52,
      fence_gate: 1,
      chest: 2
    },
    difficulty: "easy",
    estimatedDuration: 15000,
    terrain: "flat",
    levelGround: true,
    features: ["water_rows", "rapid_growth"]
  },

  animal_pen: {
    name: "Animal Pen",
    category: "agricultural",
    dimensions: { length: 12, width: 12, height: 2 },
    materials: {
      oak_fence: 48,
      fence_gate: 2,
      grass_block: 144,
      torch: 8,
      water_bucket: 1,
      hay_bale: 5
    },
    difficulty: "easy",
    estimatedDuration: 16000,
    terrain: "flat",
    levelGround: true,
    features: ["fencing", "water_trough", "feeding_area"]
  },

  chicken_farm: {
    name: "Chicken Farm",
    category: "agricultural",
    dimensions: { length: 10, width: 8, height: 3 },
    materials: {
      oak_planks: 180,
      oak_fence: 36,
      fence_gate: 1,
      hopper: 4,
      chest: 2,
      torch: 10,
      egg: 16
    },
    difficulty: "easy",
    estimatedDuration: 22000,
    terrain: "flat",
    features: ["egg_collection", "breeding_area", "enclosed"]
  },

  cow_ranch: {
    name: "Cow Ranch",
    category: "agricultural",
    dimensions: { length: 16, width: 14, height: 2 },
    materials: {
      oak_fence: 60,
      fence_gate: 2,
      grass_block: 224,
      water_bucket: 2,
      hay_bale: 8,
      torch: 12,
      chest: 2
    },
    difficulty: "easy",
    estimatedDuration: 25000,
    terrain: "flat",
    levelGround: true,
    features: ["grazing_area", "breeding_pen", "water_access"]
  },

  mob_farm: {
    name: "Mob Spawner Farm",
    category: "agricultural",
    dimensions: { length: 9, width: 9, height: 12 },
    materials: {
      cobblestone: 600,
      water_bucket: 4,
      hopper: 6,
      chest: 3,
      ladder: 10,
      torch: 20,
      sign: 8
    },
    difficulty: "hard",
    estimatedDuration: 70000,
    requiresScaffolding: true,
    terrain: "underground",
    features: ["spawner_based", "collection_system", "item_sorting"]
  },

  iron_farm: {
    name: "Iron Farm",
    category: "agricultural",
    dimensions: { length: 12, width: 12, height: 20 },
    materials: {
      building_blocks: 800,
      glass: 120,
      bed: 10,
      villager_workstation: 10,
      hopper: 8,
      chest: 4,
      water_bucket: 4,
      lava_bucket: 1,
      ladder: 18
    },
    difficulty: "expert",
    estimatedDuration: 120000,
    requiresScaffolding: true,
    includesRedstone: true,
    features: ["villager_mechanics", "automation", "high_yield"]
  },

  villager_trading_hall: {
    name: "Villager Trading Hall",
    category: "agricultural",
    dimensions: { length: 20, width: 8, height: 4 },
    materials: {
      stone_bricks: 500,
      glass_pane: 60,
      iron_bars: 40,
      villager_workstation: 15,
      oak_trapdoor: 15,
      chest: 10,
      torch: 24,
      carpet: 80
    },
    difficulty: "medium",
    estimatedDuration: 55000,
    interior: true,
    features: ["organized_stalls", "job_stations", "easy_access"]
  },

  tree_farm: {
    name: "Tree Farm",
    category: "agricultural",
    dimensions: { length: 24, width: 24, height: 0 },
    materials: {
      dirt: 144,
      sapling: 144,
      fence: 96,
      fence_gate: 2,
      axe: 1,
      chest: 3,
      torch: 16
    },
    difficulty: "easy",
    estimatedDuration: 30000,
    terrain: "flat",
    levelGround: true,
    features: ["organized_rows", "replanting_area", "log_storage"]
  },

  // Storage & utility
  warehouse: {
    name: "Warehouse",
    category: "storage",
    dimensions: { length: 15, width: 12, height: 6 },
    materials: {
      oak_planks: 450,
      stone: 200,
      chest: 27,
      torch: 24,
      oak_door: 2
    },
    difficulty: "medium",
    estimatedDuration: 55000,
    interior: true,
    roofStyle: "flat",
    features: ["organized_storage", "lighting", "large_entrance"]
  },

  enchanting_room: {
    name: "Enchanting Room",
    category: "utility",
    dimensions: { length: 7, width: 7, height: 5 },
    materials: {
      obsidian: 4,
      diamond: 2,
      book: 15,
      bookshelf: 15,
      carpet: 30,
      torch: 8
    },
    difficulty: "medium",
    estimatedDuration: 35000,
    interior: true,
    features: ["bookshelves", "enchanting_table", "ambient_lighting"]
  },

  // Advanced structures
  nether_portal_hub: {
    name: "Nether Portal Hub",
    category: "transport",
    dimensions: { length: 11, width: 11, height: 8 },
    materials: {
      obsidian: 40,
      stone_bricks: 400,
      nether_bricks: 100,
      torch: 20,
      flint_and_steel: 1
    },
    difficulty: "hard",
    estimatedDuration: 65000,
    environment: "overworld_nether",
    features: ["multiple_portals", "safe_room", "storage"]
  },

  sky_bridge: {
    name: "Sky Bridge",
    category: "transport",
    dimensions: { length: 100, width: 3, height: 0 },
    materials: {
      cobblestone: 300,
      fence: 200,
      torch: 25
    },
    difficulty: "medium",
    estimatedDuration: 40000,
    requiresScaffolding: true,
    threatLevel: "low",
    features: ["safety_railings", "lighting"]
  },

  // Specialty structures
  barn: {
    name: "Barn",
    category: "specialty",
    dimensions: { length: 16, width: 12, height: 10 },
    materials: {
      oak_planks: 550,
      oak_log: 80,
      cobblestone: 192,
      oak_fence: 40,
      fence_gate: 3,
      glass_pane: 12,
      hay_bale: 20,
      chest: 6,
      torch: 18,
      ladder: 8
    },
    difficulty: "medium",
    estimatedDuration: 60000,
    roofStyle: "steep",
    interior: true,
    foundation: "stone",
    features: ["storage_loft", "animal_stalls", "large_doors"]
  },

  stable: {
    name: "Stable",
    category: "specialty",
    dimensions: { length: 14, width: 8, height: 5 },
    materials: {
      oak_planks: 320,
      oak_fence: 56,
      fence_gate: 6,
      hay_bale: 12,
      water_bucket: 2,
      chest: 4,
      torch: 14,
      carpet: 30
    },
    difficulty: "easy",
    estimatedDuration: 35000,
    roofStyle: "pitched",
    interior: true,
    features: ["horse_stalls", "saddle_storage", "feeding_area"]
  },

  windmill: {
    name: "Windmill",
    category: "specialty",
    dimensions: { length: 9, width: 9, height: 18 },
    materials: {
      stone_bricks: 500,
      oak_planks: 280,
      oak_fence: 64,
      glass_pane: 16,
      ladder: 16,
      chest: 8,
      torch: 20,
      wheat: 64
    },
    difficulty: "hard",
    estimatedDuration: 85000,
    requiresScaffolding: true,
    roofStyle: "pitched",
    interior: true,
    features: ["rotating_blades", "grain_storage", "multi_level"]
  },

  lighthouse: {
    name: "Lighthouse",
    category: "specialty",
    dimensions: { length: 7, width: 7, height: 25 },
    materials: {
      stone_bricks: 650,
      white_concrete: 200,
      glass: 40,
      glowstone: 30,
      sea_lantern: 16,
      ladder: 23,
      iron_door: 1,
      torch: 15
    },
    difficulty: "hard",
    estimatedDuration: 95000,
    requiresScaffolding: true,
    terrain: "coastal",
    features: ["beacon_light", "observation_deck", "spiral_stairs"]
  },

  blacksmith: {
    name: "Blacksmith",
    category: "specialty",
    dimensions: { length: 10, width: 8, height: 6 },
    materials: {
      stone_bricks: 280,
      cobblestone: 150,
      oak_planks: 120,
      glass_pane: 10,
      anvil: 1,
      furnace: 3,
      lava_bucket: 1,
      chest: 6,
      torch: 16,
      iron_bars: 12
    },
    difficulty: "medium",
    estimatedDuration: 42000,
    roofStyle: "pitched",
    interior: true,
    foundation: "stone",
    features: ["forge", "anvil_station", "tool_storage", "chimney"]
  },

  well: {
    name: "Village Well",
    category: "specialty",
    dimensions: { length: 5, width: 5, height: 8 },
    materials: {
      cobblestone: 180,
      oak_planks: 40,
      oak_fence: 12,
      water_bucket: 1,
      chain: 4,
      bucket: 1
    },
    difficulty: "easy",
    estimatedDuration: 18000,
    foundation: "stone",
    features: ["water_source", "decorative", "functional"]
  },

  bridge: {
    name: "Stone Bridge",
    category: "specialty",
    dimensions: { length: 30, width: 5, height: 3 },
    materials: {
      stone_bricks: 450,
      stone_brick_stairs: 60,
      cobblestone: 150,
      torch: 15,
      iron_bars: 20
    },
    difficulty: "medium",
    estimatedDuration: 38000,
    foundation: "stone",
    terrain: "river_crossing",
    features: ["arched_design", "railings", "decorative"]
  },

  mine_entrance: {
    name: "Mine Entrance",
    category: "specialty",
    dimensions: { length: 8, width: 8, height: 6 },
    materials: {
      stone_bricks: 250,
      oak_planks: 120,
      oak_log: 30,
      rail: 16,
      minecart: 1,
      torch: 24,
      chest: 4,
      ladder: 20,
      iron_door: 1
    },
    difficulty: "medium",
    estimatedDuration: 45000,
    terrain: "underground",
    features: ["minecart_system", "storage_room", "lighting", "support_beams"]
  },

  smelting_array: {
    name: "Smelting Array",
    category: "specialty",
    dimensions: { length: 12, width: 8, height: 4 },
    materials: {
      stone_bricks: 280,
      furnace: 16,
      hopper: 32,
      chest: 16,
      torch: 12,
      oak_planks: 60,
      comparator: 8,
      redstone: 32
    },
    difficulty: "hard",
    estimatedDuration: 50000,
    includesRedstone: true,
    interior: true,
    features: ["auto_smelting", "bulk_processing", "item_sorting"]
  },

  greenhouse: {
    name: "Greenhouse",
    category: "specialty",
    dimensions: { length: 14, width: 10, height: 6 },
    materials: {
      oak_planks: 200,
      glass: 280,
      dirt: 140,
      water_bucket: 4,
      torch: 16,
      glowstone: 8,
      chest: 4,
      sapling: 20,
      bone_meal: 64
    },
    difficulty: "medium",
    estimatedDuration: 48000,
    roofStyle: "pitched",
    interior: true,
    features: ["all_weather_growing", "glass_walls", "lighting_system"]
  },

  market_stall: {
    name: "Market Stall",
    category: "specialty",
    dimensions: { length: 8, width: 6, height: 4 },
    materials: {
      oak_planks: 150,
      oak_fence: 24,
      oak_stairs: 16,
      carpet: 48,
      chest: 6,
      torch: 8,
      item_frame: 12
    },
    difficulty: "easy",
    estimatedDuration: 22000,
    roofStyle: "flat",
    features: ["display_area", "storage", "canopy"]
  },

  // Advanced/Monument structures
  cathedral: {
    name: "Cathedral",
    category: "monument",
    dimensions: { length: 30, width: 20, height: 25 },
    materials: {
      stone_bricks: 2400,
      stained_glass: 180,
      quartz_block: 600,
      oak_planks: 400,
      carpet: 400,
      torch: 60,
      chandelier: 12,
      bell: 3
    },
    difficulty: "expert",
    estimatedDuration: 240000,
    requiresScaffolding: true,
    roofStyle: "steep",
    interior: true,
    foundation: "stone",
    features: ["vaulted_ceiling", "stained_glass_windows", "bell_tower", "pews"]
  },

  castle_keep: {
    name: "Castle Keep",
    category: "monument",
    dimensions: { length: 20, width: 20, height: 18 },
    materials: {
      stone_bricks: 2200,
      cobblestone: 800,
      oak_planks: 500,
      iron_door: 3,
      glass_pane: 60,
      torch: 80,
      ladder: 16,
      chest: 20,
      bed: 4
    },
    difficulty: "expert",
    estimatedDuration: 200000,
    requiresScaffolding: true,
    roofStyle: "battlements",
    interior: true,
    foundation: "stone",
    threatLevel: "low",
    features: ["throne_room", "battlements", "multiple_floors", "dungeons"]
  },

  library: {
    name: "Grand Library",
    category: "monument",
    dimensions: { length: 18, width: 14, height: 12 },
    materials: {
      oak_planks: 650,
      bookshelf: 120,
      oak_stairs: 80,
      carpet: 200,
      glass_pane: 50,
      torch: 40,
      enchanting_table: 1,
      lectern: 12,
      chest: 10
    },
    difficulty: "hard",
    estimatedDuration: 120000,
    roofStyle: "pitched",
    interior: true,
    features: ["multiple_levels", "reading_areas", "enchanting_section", "storage"]
  },

  workshop: {
    name: "Workshop",
    category: "utility",
    dimensions: { length: 16, width: 12, height: 6 },
    materials: {
      stone_bricks: 400,
      oak_planks: 320,
      glass_pane: 24,
      crafting_table: 4,
      furnace: 6,
      anvil: 2,
      chest: 15,
      barrel: 8,
      torch: 24,
      tool_rack: 8
    },
    difficulty: "medium",
    estimatedDuration: 55000,
    roofStyle: "flat",
    interior: true,
    features: ["crafting_stations", "organized_storage", "tool_area", "smelting"]
  },

  town_hall: {
    name: "Town Hall",
    category: "monument",
    dimensions: { length: 20, width: 16, height: 10 },
    materials: {
      stone_bricks: 900,
      oak_planks: 600,
      glass_pane: 80,
      oak_door: 3,
      carpet: 250,
      torch: 40,
      lectern: 6,
      bell: 1,
      banner: 8,
      chest: 8
    },
    difficulty: "hard",
    estimatedDuration: 110000,
    roofStyle: "steep",
    interior: true,
    foundation: "stone",
    features: ["meeting_hall", "bell_tower", "storage_rooms", "decorative"]
  }
};

// Material Calculator - Advanced estimation utilities
const MATERIAL_CALCULATOR = {
  /**
   * Calculate materials needed for walls
   * @param {number} length - Building length
   * @param {number} width - Building width
   * @param {number} height - Wall height
   * @param {Object} options - Configuration options
   * @returns {Object} Material breakdown
   */
  estimateForWalls(length, width, height, options = {}) {
    const {
      hollowInterior = true,
      includeCorners = true,
      doorCount = 1,
      windowCount = null
    } = options;

    const perimeter = 2 * (length + width);
    const wallArea = perimeter * height;

    // Account for hollow interior (subtract inner layer)
    const wallBlocks = hollowInterior
      ? wallArea - (2 * (length - 2) + 2 * (width - 2)) * height
      : wallArea;

    // Calculate openings
    const doorBlocks = doorCount * 2; // Standard door is 2 blocks tall
    const calculatedWindows = windowCount ?? Math.floor(perimeter / 4);
    const windowBlocks = calculatedWindows * 2; // 2 blocks per window

    const netBlocks = Math.max(0, wallBlocks - doorBlocks - windowBlocks);

    return {
      walls: netBlocks,
      doors: doorCount,
      windows: calculatedWindows,
      corners: includeCorners ? height * 4 : 0,
      totalBlocks: netBlocks
    };
  },

  /**
   * Calculate materials for roof
   * @param {number} length - Building length
   * @param {number} width - Building width
   * @param {string} style - Roof style
   * @returns {number} Block count
   */
  estimateForRoof(length, width, style = "flat") {
    const styles = {
      flat: length * width,
      pitched: Math.ceil(length * width * 1.5), // Pitched roof uses ~50% more
      steep: Math.ceil(length * width * 1.8),
      dome: Math.ceil(Math.PI * Math.pow(Math.max(length, width) / 2, 2) * 1.2),
      battlements: Math.ceil(perimeter => perimeter * 1.5)(2 * (length + width))
    };

    return styles[style] || styles.flat;
  },

  /**
   * Calculate foundation materials
   * @param {number} length - Building length
   * @param {number} width - Building width
   * @param {number} depth - Foundation depth
   * @returns {number} Block count
   */
  estimateForFoundation(length, width, depth = 1) {
    return length * width * depth;
  },

  /**
   * Calculate floor materials
   * @param {number} length - Building length
   * @param {number} width - Building width
   * @param {number} floors - Number of floors
   * @returns {number} Block count
   */
  estimateForFloors(length, width, floors = 1) {
    // Interior floor space (exclude walls)
    const interiorLength = Math.max(1, length - 2);
    const interiorWidth = Math.max(1, width - 2);
    return interiorLength * interiorWidth * floors;
  },

  /**
   * Add material overhead buffer
   * @param {number} baseAmount - Base material count
   * @param {number} buffer - Buffer percentage (0.1 = 10%)
   * @returns {number} Adjusted amount with buffer
   */
  calculateOverhead(baseAmount, buffer = 0.1) {
    return Math.ceil(baseAmount * (1 + buffer));
  },

  /**
   * Estimate lighting requirements
   * @param {number} length - Building length
   * @param {number} width - Building width
   * @param {number} height - Building height
   * @returns {number} Torch count
   */
  estimateLighting(length, width, height = 1) {
    const floorArea = length * width;
    const floors = Math.max(1, Math.floor(height / 4)); // One set per 4 blocks height
    // One torch per 8 blocks of floor area, times number of floors
    return Math.ceil((floorArea / 8) * floors);
  },

  /**
   * Generate complete material estimate from dimensions
   * @param {Object} dimensions - {length, width, height}
   * @param {Object} buildOptions - Building configuration
   * @returns {Object} Complete material breakdown
   */
  generateEstimate(dimensions, buildOptions = {}) {
    const { length, width, height = 5 } = dimensions;
    const {
      roofStyle = "pitched",
      foundation = true,
      floors = 1,
      materialType = "oak_planks",
      roofMaterial = "oak_planks",
      foundationMaterial = "cobblestone",
      includeInterior = true
    } = buildOptions;

    if (!length || !width || length <= 0 || width <= 0) {
      return null;
    }

    const walls = this.estimateForWalls(length, width, height, {
      hollowInterior: true,
      doorCount: 2,
      windowCount: Math.floor((length + width) / 3)
    });

    const roof = this.estimateForRoof(length, width, roofStyle);
    const foundationBlocks = this.estimateForFoundation(length, width, 1);
    const flooring = this.estimateForFloors(length, width, Math.max(1, floors - 1));
    const lighting = this.estimateLighting(length, width, height);

    const materials = {};

    // Main building material (walls)
    materials[materialType] = this.calculateOverhead(walls.totalBlocks);

    // Roof material
    if (roofMaterial !== materialType) {
      materials[roofMaterial] = this.calculateOverhead(roof);
    } else {
      materials[materialType] += this.calculateOverhead(roof);
    }

    // Foundation
    if (foundation && foundationMaterial) {
      materials[foundationMaterial] = this.calculateOverhead(foundationBlocks);
    }

    // Interior flooring
    if (includeInterior && flooring > 0) {
      const floorMaterial = materialType;
      materials[floorMaterial] = (materials[floorMaterial] || 0) + this.calculateOverhead(flooring);
    }

    // Lighting and fixtures
    materials.torch = lighting;
    materials.glass_pane = walls.windows;
    materials[`${materialType.split('_')[0]}_door`] = walls.doors;

    return {
      materials,
      breakdown: {
        walls: walls.totalBlocks,
        roof,
        foundation: foundationBlocks,
        flooring,
        lighting
      }
    };
  }
};

// Terrain Analysis Profiles
const TERRAIN_PROFILES = {
  flat_plains: {
    name: "Flat Plains",
    preparation: "minimal",
    difficulty: "easy",
    clearanceTime: 60000, // ms
    timeMultiplier: 1.0,
    tools: ["shovel"],
    materials: [],
    considerations: ["Ideal building terrain", "May need basic leveling"],
    risks: []
  },

  rolling_hills: {
    name: "Rolling Hills",
    preparation: "light",
    difficulty: "easy",
    clearanceTime: 120000,
    timeMultiplier: 1.15,
    tools: ["shovel", "dirt"],
    materials: ["dirt:32"],
    considerations: ["Minor elevation changes", "Light terraforming needed"],
    risks: ["Uneven foundation may require adjustment"]
  },

  hilly: {
    name: "Hilly Terrain",
    preparation: "moderate",
    difficulty: "medium",
    clearanceTime: 300000,
    timeMultiplier: 1.3,
    tools: ["shovel", "pickaxe", "dirt"],
    materials: ["dirt:64", "cobblestone:32"],
    considerations: ["May need retaining walls", "Uneven foundation", "Terracing recommended"],
    risks: ["Water drainage issues", "Foundation instability"]
  },

  mountainside: {
    name: "Mountainside",
    preparation: "extensive",
    difficulty: "hard",
    clearanceTime: 900000,
    timeMultiplier: 1.8,
    tools: ["pickaxe", "shovel", "scaffolding", "cobblestone"],
    materials: ["cobblestone:128", "scaffolding:64"],
    considerations: ["Steep drops", "Rockslides possible", "Platform building required", "Extensive excavation"],
    risks: ["Fall damage from heights", "Unstable terrain", "Difficult material transport"]
  },

  mountain_peak: {
    name: "Mountain Peak",
    preparation: "extreme",
    difficulty: "expert",
    clearanceTime: 1200000,
    timeMultiplier: 2.0,
    tools: ["pickaxe", "shovel", "scaffolding", "ladder"],
    materials: ["stone:256", "scaffolding:128", "ladder:32"],
    considerations: ["Extreme elevation", "Weather exposure", "Limited flat space", "Platform construction essential"],
    risks: ["Fatal falls", "Limited escape routes", "Phantom spawns at height", "Lightning strikes"]
  },

  forest: {
    name: "Forest",
    preparation: "moderate",
    difficulty: "medium",
    clearanceTime: 240000,
    timeMultiplier: 1.25,
    tools: ["axe", "shovel", "sapling"],
    materials: ["torch:16"],
    considerations: ["Tree removal required", "Keep saplings for replanting", "Root removal"],
    risks: ["Mob spawning in shadows", "Fire hazard from lightning"]
  },

  dense_forest: {
    name: "Dense Forest",
    preparation: "extensive",
    difficulty: "hard",
    clearanceTime: 480000,
    timeMultiplier: 1.5,
    tools: ["axe", "shovel", "torch", "sapling"],
    materials: ["torch:32", "sapling:16"],
    considerations: ["Extensive clearing needed", "Dark environment", "Difficult navigation", "Replanting encouraged"],
    risks: ["High mob spawn rate", "Easy to get lost", "Fire spread risk"]
  },

  jungle: {
    name: "Jungle",
    preparation: "extreme",
    difficulty: "expert",
    clearanceTime: 600000,
    timeMultiplier: 1.7,
    tools: ["axe", "machete", "torch", "ladder"],
    materials: ["torch:48", "vine:32"],
    considerations: ["Dense vegetation", "Tall trees", "Vines everywhere", "Uneven terrain"],
    risks: ["Very high mob spawn rate", "Ocelots and parrots", "Easy to fall", "Poor visibility"]
  },

  swamp: {
    name: "Swamp",
    preparation: "extensive",
    difficulty: "hard",
    clearanceTime: 420000,
    timeMultiplier: 1.6,
    tools: ["shovel", "dirt", "lily_pad"],
    materials: ["dirt:128", "gravel:64", "lily_pad:16"],
    considerations: ["Waterlogged terrain", "Slime spawns", "Poor footing", "Foundation reinforcement critical"],
    risks: ["Drowning hazard", "Slime attacks", "Witch huts nearby", "Difficult material transport"]
  },

  desert: {
    name: "Desert",
    preparation: "light",
    difficulty: "easy",
    clearanceTime: 90000,
    timeMultiplier: 1.1,
    tools: ["shovel", "water_bucket"],
    materials: ["water_bucket:2"],
    considerations: ["Sand removal easy", "No water sources", "Hot and dry", "Sandstone foundation recommended"],
    risks: ["Husks spawn at night", "Limited resources", "No natural shade"]
  },

  beach: {
    name: "Beach/Coastal",
    preparation: "moderate",
    difficulty: "medium",
    clearanceTime: 180000,
    timeMultiplier: 1.2,
    tools: ["shovel", "cobblestone", "torch"],
    materials: ["cobblestone:64", "gravel:32"],
    considerations: ["Sand foundation unstable", "Water proximity", "Drowned spawns", "Tide considerations"],
    risks: ["Drowned attacks", "Trident damage", "Foundation erosion", "Limited building space"]
  },

  underwater: {
    name: "Underwater",
    preparation: "extreme",
    difficulty: "expert",
    clearanceTime: 1800000,
    timeMultiplier: 2.5,
    tools: ["conduit", "sponge", "prismarine", "water_breathing_potion"],
    materials: ["sponge:64", "glass:128", "prismarine:256"],
    potions: ["water_breathing", "night_vision"],
    considerations: ["Water removal essential", "Conduit power needed", "Sponge drying", "Limited visibility"],
    risks: ["Drowning", "Guardians and elder guardians", "Slow movement", "Mining fatigue curse"]
  },

  underground: {
    name: "Underground",
    preparation: "extensive",
    difficulty: "hard",
    clearanceTime: 720000,
    timeMultiplier: 1.9,
    tools: ["pickaxe", "torch", "ladder", "bucket"],
    materials: ["torch:128", "ladder:32", "cobblestone:64"],
    considerations: ["Excavation required", "Cave-ins possible", "Constant lighting needed", "Ventilation shafts"],
    risks: ["Cave-ins", "Lava pockets", "Hostile mobs", "Getting lost", "Suffocation"]
  },

  cavern: {
    name: "Cavern",
    preparation: "moderate",
    difficulty: "medium",
    clearanceTime: 300000,
    timeMultiplier: 1.4,
    tools: ["torch", "cobblestone", "ladder"],
    materials: ["torch:64", "cobblestone:128"],
    considerations: ["Pre-existing space", "Wall reinforcement", "Floor leveling", "Mob-proofing essential"],
    risks: ["Mob spawns from dark areas", "Unstable ceiling", "Lava flows", "Water seepage"]
  },

  ravine: {
    name: "Ravine",
    preparation: "extreme",
    difficulty: "expert",
    clearanceTime: 960000,
    timeMultiplier: 2.2,
    tools: ["pickaxe", "cobblestone", "scaffolding", "water_bucket"],
    materials: ["cobblestone:256", "scaffolding:128"],
    considerations: ["Extreme vertical depth", "Bridge building required", "Wall stabilization", "Multi-level platforms"],
    risks: ["Fatal falls", "Lava at bottom", "Mob spawns on ledges", "Difficult escape"]
  },

  nether_wastes: {
    name: "Nether Wastes",
    preparation: "extreme",
    difficulty: "expert",
    clearanceTime: 600000,
    timeMultiplier: 2.0,
    tools: ["fire_resistance_potion", "cobblestone", "building_blocks"],
    materials: ["cobblestone:256", "building_blocks:128"],
    potions: ["fire_resistance"],
    considerations: ["Lava everywhere", "No water available", "Ghast attacks", "Fire spread", "Piglin aggression"],
    risks: ["Lava burns", "Ghast fireballs", "Falling into lava", "Piglin attacks if no gold", "Accidental portal destruction"]
  },

  nether_fortress: {
    name: "Nether Fortress Area",
    preparation: "extreme",
    difficulty: "expert",
    clearanceTime: 720000,
    timeMultiplier: 2.3,
    tools: ["fire_resistance_potion", "building_blocks", "bow"],
    materials: ["cobblestone:256", "building_blocks:192"],
    potions: ["fire_resistance", "strength"],
    considerations: ["Blaze spawners", "Wither skeletons", "Narrow bridges", "Lava moats"],
    risks: ["Blaze attacks", "Wither effect", "Knocked off bridges", "Continuous spawns"]
  },

  basalt_deltas: {
    name: "Basalt Deltas",
    preparation: "extreme",
    difficulty: "expert",
    clearanceTime: 840000,
    timeMultiplier: 2.4,
    tools: ["fire_resistance_potion", "pickaxe", "building_blocks"],
    materials: ["basalt:256", "building_blocks:128"],
    potions: ["fire_resistance", "slow_falling"],
    considerations: ["Uneven basalt pillars", "Magma cubes", "Lava rivers", "Difficult terrain navigation"],
    risks: ["Magma cube attacks", "Lava pockets", "Fall damage from pillars", "Ghast spawns"]
  },

  soul_sand_valley: {
    name: "Soul Sand Valley",
    preparation: "extreme",
    difficulty: "expert",
    clearanceTime: 660000,
    timeMultiplier: 2.1,
    tools: ["fire_resistance_potion", "soul_sand", "soul_soil"],
    materials: ["building_blocks:192", "soul_sand:64"],
    potions: ["fire_resistance", "speed"],
    considerations: ["Soul sand slows movement", "Skeletons everywhere", "Blue fire", "Ghast spawns"],
    risks: ["Skeleton ambush", "Ghast attacks", "Slow escape", "Blue fire damage"]
  },

  crimson_forest: {
    name: "Crimson Forest",
    preparation: "extreme",
    difficulty: "hard",
    clearanceTime: 540000,
    timeMultiplier: 1.8,
    tools: ["axe", "fire_resistance_potion", "warped_fungus"],
    materials: ["crimson_planks:128"],
    potions: ["fire_resistance"],
    considerations: ["Crimson trees", "Hoglins", "Piglins", "Dense fungus", "Gold armor required"],
    risks: ["Hoglin charges", "Piglin aggression", "Ghasts from distance"]
  },

  warped_forest: {
    name: "Warped Forest",
    preparation: "extreme",
    difficulty: "hard",
    clearanceTime: 540000,
    timeMultiplier: 1.75,
    tools: ["axe", "fire_resistance_potion"],
    materials: ["warped_planks:128"],
    potions: ["fire_resistance"],
    considerations: ["Warped trees", "Endermen everywhere", "Fewer hostile mobs", "Eerie particles"],
    risks: ["Enderman aggression", "Teleportation surprises", "Disorientation from particles"]
  },

  the_end: {
    name: "The End",
    preparation: "extreme",
    difficulty: "expert",
    clearanceTime: 900000,
    timeMultiplier: 2.5,
    tools: ["building_blocks", "ender_pearl", "slow_falling_potion"],
    materials: ["building_blocks:512", "end_stone:256"],
    potions: ["slow_falling", "strength"],
    considerations: ["Void below", "Endermen everywhere", "Shulkers", "Dragon may still be alive", "Limited resources"],
    risks: ["Falling into void (instant death)", "Enderman swarms", "Shulker levitation", "Dragon attacks", "No escape without portal"]
  },

  end_islands: {
    name: "End Outer Islands",
    preparation: "extreme",
    difficulty: "expert",
    clearanceTime: 1080000,
    timeMultiplier: 2.7,
    tools: ["building_blocks", "ender_pearl", "elytra", "slow_falling_potion"],
    materials: ["building_blocks:768", "chorus_fruit:32"],
    potions: ["slow_falling", "strength", "regeneration"],
    considerations: ["Islands separated by void", "Shulker cities", "Chorus plants", "End ships", "Bridge building essential"],
    risks: ["Void falls", "Shulker levitation into void", "Enderman knockback", "Running out of blocks", "Elytra malfunction"]
  },

  mushroom_island: {
    name: "Mushroom Island",
    preparation: "minimal",
    difficulty: "easy",
    clearanceTime: 75000,
    timeMultiplier: 0.9,
    tools: ["shovel", "shears"],
    materials: [],
    considerations: ["No hostile mob spawns", "Mycelium ground", "Giant mushrooms", "Mooshrooms only"],
    risks: []
  },

  ice_plains: {
    name: "Ice Plains",
    preparation: "moderate",
    difficulty: "medium",
    clearanceTime: 210000,
    timeMultiplier: 1.3,
    tools: ["pickaxe", "shovel", "silk_touch"],
    materials: ["packed_ice:64", "blue_ice:32"],
    considerations: ["Ice removal or preservation", "Cold environment", "Polar bears", "Frozen water sources"],
    risks: ["Strays spawn", "Polar bear aggression", "Slippery surfaces"]
  },

  snowy_tundra: {
    name: "Snowy Tundra",
    preparation: "moderate",
    difficulty: "medium",
    clearanceTime: 180000,
    timeMultiplier: 1.25,
    tools: ["shovel", "torch"],
    materials: ["torch:24"],
    considerations: ["Snow layer removal", "Cold biome", "Snow accumulation", "Limited visibility in snowstorms"],
    risks: ["Strays spawn", "Snowstorms reduce visibility", "Ice hazards"]
  },

  frozen_ocean: {
    name: "Frozen Ocean",
    preparation: "extreme",
    difficulty: "expert",
    clearanceTime: 1200000,
    timeMultiplier: 2.4,
    tools: ["pickaxe", "water_breathing_potion", "silk_touch", "conduit"],
    materials: ["packed_ice:256", "blue_ice:128", "prismarine:128"],
    potions: ["water_breathing", "night_vision", "water_resistance"],
    considerations: ["Ice ceiling", "Underwater building", "Polar bears on ice", "Drowned spawns"],
    risks: ["Drowning", "Polar bear attacks", "Drowned with tridents", "Trapped under ice", "Guardians"]
  },

  mesa_badlands: {
    name: "Mesa/Badlands",
    preparation: "moderate",
    difficulty: "medium",
    clearanceTime: 240000,
    timeMultiplier: 1.35,
    tools: ["shovel", "pickaxe"],
    materials: ["terracotta:64", "red_sand:32"],
    considerations: ["Terracotta layers", "Red sand", "Extreme elevation changes", "Abandoned mineshafts"],
    risks: ["Cave spider spawns", "Unstable overhangs", "Fall damage from cliffs"]
  },

  savanna: {
    name: "Savanna",
    preparation: "light",
    difficulty: "easy",
    clearanceTime: 120000,
    timeMultiplier: 1.1,
    tools: ["axe", "shovel"],
    materials: ["acacia_log:16"],
    considerations: ["Sparse trees", "Mostly flat", "Acacia wood available", "Villages common"],
    risks: ["Limited shade", "Hostile mobs at night"]
  }
};

// Progressive Build System - Phase-based construction planning
const PROGRESSIVE_BUILD_PHASES = {
  site_preparation: {
    name: "Site Preparation",
    order: 1,
    timePercentage: 0.10, // 10% of total build time
    criticalPath: true,
    blockers: [],
    canParallel: [],
    description: "Clear area, level ground, mark foundation boundaries",
    checkpoints: ["Area cleared", "Ground leveled", "Corners marked"],
    skillLevel: "basic"
  },

  foundation: {
    name: "Foundation",
    order: 2,
    timePercentage: 0.15, // 15% of total
    criticalPath: true,
    blockers: ["site_preparation"],
    canParallel: [],
    description: "Lay foundation blocks, ensure level base, reinforce corners",
    checkpoints: ["Foundation outlined", "Base blocks placed", "Level verified"],
    skillLevel: "basic"
  },

  framework: {
    name: "Framework & Structure",
    order: 3,
    timePercentage: 0.10,
    criticalPath: true,
    blockers: ["foundation"],
    canParallel: [],
    description: "Build corner pillars, place support beams, establish structure",
    checkpoints: ["Corner posts erected", "Support beams placed", "Framework stable"],
    skillLevel: "intermediate"
  },

  walls: {
    name: "Walls",
    order: 4,
    timePercentage: 0.25, // 25% of total
    criticalPath: true,
    blockers: ["framework"],
    canParallel: [],
    description: "Construct exterior walls, install doors, place windows",
    checkpoints: ["First wall complete", "Half walls done", "All walls erected", "Openings placed"],
    skillLevel: "basic"
  },

  floors: {
    name: "Interior Floors",
    order: 5,
    timePercentage: 0.08,
    criticalPath: false,
    blockers: ["foundation"],
    canParallel: ["walls"],
    description: "Lay interior flooring for all levels",
    checkpoints: ["Ground floor done", "Upper floors complete"],
    skillLevel: "basic"
  },

  roof: {
    name: "Roof",
    order: 6,
    timePercentage: 0.18, // 18% of total
    criticalPath: true,
    blockers: ["walls"],
    canParallel: ["floors"],
    description: "Construct roof structure, add roofing material, ensure water-tight",
    checkpoints: ["Roof frame built", "Roofing halfway", "Roof complete"],
    skillLevel: "intermediate"
  },

  weatherproofing: {
    name: "Weatherproofing",
    order: 7,
    timePercentage: 0.05,
    criticalPath: true,
    blockers: ["roof"],
    canParallel: [],
    description: "Seal gaps, add overhangs, install drainage",
    checkpoints: ["Gaps sealed", "Water tested"],
    skillLevel: "intermediate"
  },

  interior_walls: {
    name: "Interior Walls & Rooms",
    order: 8,
    timePercentage: 0.10,
    criticalPath: false,
    blockers: ["walls", "floors"],
    canParallel: ["weatherproofing"],
    description: "Build interior room dividers, install interior doors",
    checkpoints: ["Room divisions marked", "Interior walls built", "Doors placed"],
    skillLevel: "basic"
  },

  lighting: {
    name: "Lighting System",
    order: 9,
    timePercentage: 0.06,
    criticalPath: false,
    blockers: ["walls", "roof"],
    canParallel: ["interior_walls", "exterior_decoration"],
    description: "Place torches, lanterns, and lighting fixtures throughout",
    checkpoints: ["Exterior lit", "Interior lit", "No dark spots"],
    skillLevel: "basic"
  },

  redstone: {
    name: "Redstone Systems",
    order: 10,
    timePercentage: 0.12,
    criticalPath: false,
    blockers: ["walls", "interior_walls"],
    canParallel: [],
    description: "Install redstone circuits, wire mechanisms, test automation",
    checkpoints: ["Wiring complete", "Circuits tested", "All systems operational"],
    skillLevel: "advanced"
  },

  furnishing: {
    name: "Furnishing & Interior",
    order: 11,
    timePercentage: 0.08,
    criticalPath: false,
    blockers: ["interior_walls", "lighting"],
    canParallel: ["exterior_decoration"],
    description: "Place furniture, storage, decorative items",
    checkpoints: ["Essential furniture placed", "Storage organized", "Decorations added"],
    skillLevel: "basic"
  },

  exterior_decoration: {
    name: "Exterior Decoration",
    order: 12,
    timePercentage: 0.05,
    criticalPath: false,
    blockers: ["walls", "roof"],
    canParallel: ["furnishing", "lighting"],
    description: "Add external decorative elements, landscaping touches",
    checkpoints: ["Decorative blocks placed", "Landscaping done"],
    skillLevel: "intermediate"
  },

  final_inspection: {
    name: "Final Inspection & Cleanup",
    order: 13,
    timePercentage: 0.05,
    criticalPath: true,
    blockers: ["weatherproofing", "lighting", "furnishing"],
    canParallel: [],
    description: "Verify all systems, remove scaffolding, cleanup site",
    checkpoints: ["Structure inspected", "Scaffolding removed", "Site cleaned"],
    skillLevel: "basic"
  }
};

/**
 * Calculate phase timings based on total build duration
 * @param {number} totalDuration - Total build time in ms
 * @param {Object} options - Build options (includesRedstone, includeInterior, etc.)
 * @returns {Array} Array of phases with calculated times
 */
function calculateBuildPhases(totalDuration, options = {}) {
  const {
    includesRedstone = false,
    includeInterior = true,
    requiresScaffolding = false,
    complexity = "medium"
  } = options;

  const phases = [];
  let activePhases = { ...PROGRESSIVE_BUILD_PHASES };

  // Filter out phases based on build options
  if (!includesRedstone) {
    delete activePhases.redstone;
  }

  if (!includeInterior) {
    delete activePhases.interior_walls;
    delete activePhases.furnishing;
  }

  // Calculate total percentage
  let totalPercentage = Object.values(activePhases).reduce((sum, phase) => sum + phase.timePercentage, 0);

  // Normalize percentages if needed
  const normalizer = totalPercentage > 0 ? 1.0 / totalPercentage : 1.0;

  // Build phases array with calculated times
  let accumulatedTime = 0;

  for (const [phaseKey, phaseData] of Object.entries(activePhases)) {
    const normalizedPercentage = phaseData.timePercentage * normalizer;
    const phaseTime = Math.ceil(totalDuration * normalizedPercentage);
    const startTime = accumulatedTime;
    const endTime = accumulatedTime + phaseTime;

    phases.push({
      key: phaseKey,
      name: phaseData.name,
      order: phaseData.order,
      startTime,
      endTime,
      duration: phaseTime,
      percentage: Math.round(normalizedPercentage * 100),
      criticalPath: phaseData.criticalPath,
      blockers: phaseData.blockers,
      canParallel: phaseData.canParallel,
      description: phaseData.description,
      checkpoints: phaseData.checkpoints,
      skillLevel: phaseData.skillLevel
    });

    accumulatedTime = endTime;
  }

  // Sort by order
  phases.sort((a, b) => a.order - b.order);

  return phases;
}

/**
 * Generate milestones from build phases
 * @param {Array} phases - Array of build phases
 * @param {number} totalDuration - Total build time
 * @returns {Array} Array of milestone objects
 */
function generateMilestones(phases, totalDuration) {
  const milestones = [];

  // Major milestones based on critical path phases
  const criticalPhases = phases.filter(p => p.criticalPath);

  for (const phase of criticalPhases) {
    milestones.push({
      name: `${phase.name} Complete`,
      time: phase.endTime,
      percentage: Math.round((phase.endTime / totalDuration) * 100),
      type: "phase_complete",
      critical: true,
      description: `${phase.name} phase finished`,
      checkpoints: phase.checkpoints
    });
  }

  // Add quarter milestones
  const quarterTime = totalDuration / 4;
  for (let i = 1; i <= 3; i++) {
    const time = quarterTime * i;
    milestones.push({
      name: `${i * 25}% Complete`,
      time,
      percentage: i * 25,
      type: "progress_marker",
      critical: false,
      description: `Build is ${i * 25}% complete`
    });
  }

  // Add start and end milestones
  milestones.unshift({
    name: "Construction Start",
    time: 0,
    percentage: 0,
    type: "start",
    critical: true,
    description: "Begin construction"
  });

  milestones.push({
    name: "Construction Complete",
    time: totalDuration,
    percentage: 100,
    type: "completion",
    critical: true,
    description: "Build finished and inspected"
  });

  // Sort by time
  milestones.sort((a, b) => a.time - b.time);

  // Remove duplicate percentages (keep critical ones)
  const seen = new Set();
  const uniqueMilestones = milestones.filter(m => {
    const key = m.percentage;
    if (seen.has(key)) {
      return m.critical; // Keep critical if duplicate
    }
    seen.add(key);
    return true;
  });

  return uniqueMilestones;
}

/**
 * Determine critical path through build phases
 * @param {Array} phases - Array of build phases
 * @returns {Array} Array of phase keys on critical path
 */
function determineCriticalPath(phases) {
  const criticalPath = [];
  const phaseMap = new Map(phases.map(p => [p.key, p]));

  // Start with phases that have no blockers
  let currentPhases = phases.filter(p => p.blockers.length === 0 && p.criticalPath);

  while (currentPhases.length > 0) {
    // Add current critical phases to path
    for (const phase of currentPhases) {
      if (phase.criticalPath) {
        criticalPath.push(phase.key);
      }
    }

    // Find next phases that are blocked by current ones
    const currentKeys = currentPhases.map(p => p.key);
    currentPhases = phases.filter(p =>
      p.criticalPath &&
      !criticalPath.includes(p.key) &&
      p.blockers.some(blocker => currentKeys.includes(blocker))
    );
  }

  return criticalPath;
}

/**
 * Calculate parallel work opportunities
 * @param {Array} phases - Array of build phases
 * @returns {Array} Array of parallel phase groups
 */
function calculateParallelWork(phases) {
  const parallelGroups = [];
  const processed = new Set();

  for (const phase of phases) {
    if (processed.has(phase.key) || phase.canParallel.length === 0) {
      continue;
    }

    const group = {
      primary: phase.key,
      parallel: [],
      description: `${phase.name} can be done in parallel with:`
    };

    // Find phases that can be done in parallel
    for (const parallelKey of phase.canParallel) {
      const parallelPhase = phases.find(p => p.key === parallelKey);
      if (parallelPhase) {
        group.parallel.push(parallelKey);
        processed.add(parallelKey);
      }
    }

    if (group.parallel.length > 0) {
      parallelGroups.push(group);
      processed.add(phase.key);
    }
  }

  return parallelGroups;
}

// Safety & Fall Protection System
const FALL_PROTECTION_OPTIONS = {
  water_bucket: {
    name: "Water Bucket",
    effectiveness: "excellent",
    cost: "low",
    minHeight: 4,
    description: "Place water at bottom to negate fall damage",
    materials: ["water_bucket:1"],
    skillLevel: "basic",
    limitations: ["Doesn't work in Nether", "Can freeze in cold biomes"]
  },

  scaffolding: {
    name: "Scaffolding",
    effectiveness: "excellent",
    cost: "medium",
    minHeight: 6,
    description: "Climbable blocks for safe vertical access",
    materials: ["scaffolding:64"],
    skillLevel: "basic",
    limitations: []
  },

  ladder: {
    name: "Ladder",
    effectiveness: "good",
    cost: "low",
    minHeight: 6,
    description: "Wall-mounted climbing aid",
    materials: ["ladder:32"],
    skillLevel: "basic",
    limitations: ["Requires wall support", "Slower than scaffolding"]
  },

  hay_bale: {
    name: "Hay Bale",
    effectiveness: "good",
    cost: "low",
    minHeight: 4,
    description: "Reduces fall damage by 80% when landed on",
    materials: ["hay_bale:4"],
    skillLevel: "basic",
    limitations: ["Must land directly on hay"]
  },

  slime_block: {
    name: "Slime Block",
    effectiveness: "excellent",
    cost: "high",
    minHeight: 4,
    description: "Bounces player, negating fall damage",
    materials: ["slime_block:4"],
    skillLevel: "intermediate",
    limitations: ["Expensive", "Bounces player"]
  },

  powder_snow: {
    name: "Powder Snow",
    effectiveness: "good",
    cost: "medium",
    minHeight: 4,
    description: "Negates fall damage but causes freezing",
    materials: ["powder_snow_bucket:2", "leather_boots:1"],
    skillLevel: "intermediate",
    limitations: ["Causes freezing damage", "Requires leather boots"]
  },

  vines: {
    name: "Vines",
    effectiveness: "moderate",
    cost: "low",
    minHeight: 6,
    description: "Climbable plants, slow descent",
    materials: ["vine:32"],
    skillLevel: "basic",
    limitations: ["Slow", "Can be hard to grab"]
  },

  feather_falling_boots: {
    name: "Feather Falling Boots",
    effectiveness: "good",
    cost: "high",
    minHeight: 10,
    description: "Enchanted boots reduce fall damage significantly",
    materials: ["diamond_boots:1", "enchanted_book:1"],
    skillLevel: "advanced",
    limitations: ["Requires enchanting", "Doesn't eliminate all damage"]
  },

  elytra: {
    name: "Elytra",
    effectiveness: "excellent",
    cost: "very_high",
    minHeight: 20,
    description: "Glide to safety from any height",
    materials: ["elytra:1", "firework_rocket:16"],
    skillLevel: "expert",
    limitations: ["Requires End access", "Durability concerns"]
  },

  slow_falling_potion: {
    name: "Slow Falling Potion",
    effectiveness: "excellent",
    cost: "medium",
    minHeight: 10,
    description: "Negates all fall damage while active",
    materials: ["slow_falling_potion:2"],
    skillLevel: "intermediate",
    limitations: ["Limited duration", "Requires brewing"]
  }
};

const SAFETY_HEIGHT_THRESHOLDS = {
  caution: 4,        // Start warning about falls
  elevated: 10,      // Moderate fall risk
  dangerous: 20,     // High fall risk
  extreme: 50,       // Extreme fall risk
  lethal: 100        // Certain death without protection
};

const ENVIRONMENT_HAZARDS = {
  overworld: {
    primary: ["fall_damage", "mob_spawns"],
    secondary: ["weather"],
    severity: "low"
  },
  nether: {
    primary: ["lava", "fire", "ghasts", "fall_into_lava"],
    secondary: ["hoglins", "piglins"],
    severity: "extreme"
  },
  the_end: {
    primary: ["void", "endermen", "shulkers"],
    secondary: ["dragon"],
    severity: "extreme"
  },
  underground: {
    primary: ["cave_ins", "lava_pockets", "mob_spawns", "getting_lost"],
    secondary: ["suffocation"],
    severity: "high"
  },
  underwater: {
    primary: ["drowning", "guardians"],
    secondary: ["mining_fatigue", "low_visibility"],
    severity: "high"
  },
  sky: {
    primary: ["fall_damage", "phantoms", "lightning"],
    secondary: ["wind"],
    severity: "high"
  }
};

/**
 * Assess safety risk based on build parameters
 * @param {Object} params - Build parameters {height, environment, terrain, weather}
 * @returns {Object} Risk assessment with level and factors
 */
function assessSafetyRisk(params = {}) {
  const {
    height = 0,
    environment = "overworld",
    terrain = null,
    weather = null,
    hasMobs = true,
    proximity = {} // {lava: boolean, water: boolean, void: boolean}
  } = params;

  let riskScore = 0;
  const riskFactors = [];

  // Height-based risk
  if (height >= SAFETY_HEIGHT_THRESHOLDS.caution) {
    riskScore += 1;
    riskFactors.push(`Working at ${height} blocks height`);
  }
  if (height >= SAFETY_HEIGHT_THRESHOLDS.elevated) {
    riskScore += 2;
    riskFactors.push("Elevated work area");
  }
  if (height >= SAFETY_HEIGHT_THRESHOLDS.dangerous) {
    riskScore += 3;
    riskFactors.push("Dangerous height - lethal falls possible");
  }
  if (height >= SAFETY_HEIGHT_THRESHOLDS.extreme) {
    riskScore += 4;
    riskFactors.push("Extreme height - certain death from falls");
  }

  // Environment-based risk
  const envHazards = ENVIRONMENT_HAZARDS[environment] || ENVIRONMENT_HAZARDS.overworld;
  if (envHazards.severity === "high") {
    riskScore += 3;
  } else if (envHazards.severity === "extreme") {
    riskScore += 5;
  }

  // Add environment hazards to factors
  if (envHazards.primary.length > 0) {
    riskFactors.push(`Environment hazards: ${envHazards.primary.join(', ')}`);
  }

  // Proximity hazards
  if (proximity.void) {
    riskScore += 5;
    riskFactors.push("Void proximity - instant death if fall");
  }
  if (proximity.lava) {
    riskScore += 3;
    riskFactors.push("Lava proximity - fire damage risk");
  }

  // Terrain-specific risks
  if (terrain) {
    const terrainRisks = {
      mountainside: 2,
      mountain_peak: 3,
      ravine: 4,
      underwater: 2,
      underground: 1,
      nether_wastes: 3,
      the_end: 4,
      end_islands: 5
    };

    const terrainRisk = terrainRisks[terrain] || 0;
    if (terrainRisk > 0) {
      riskScore += terrainRisk;
    }
  }

  // Weather hazards
  if (weather === "stormy") {
    riskScore += 1;
    riskFactors.push("Stormy weather - lightning risk");
  }

  // Mob hazards
  if (hasMobs && environment !== "mushroom_island") {
    riskScore += 1;
    riskFactors.push("Hostile mob presence");
  }

  // Determine risk level
  let riskLevel = "low";
  if (riskScore >= 12) {
    riskLevel = "extreme";
  } else if (riskScore >= 8) {
    riskLevel = "high";
  } else if (riskScore >= 4) {
    riskLevel = "medium";
  }

  return {
    level: riskLevel,
    score: riskScore,
    factors: riskFactors,
    environmentHazards: envHazards
  };
}

/**
 * Generate safety recommendations based on risk assessment
 * @param {Object} riskAssessment - Risk assessment object
 * @param {Object} buildParams - Build parameters
 * @returns {Array} Array of safety recommendations
 */
function generateSafetyRecommendations(riskAssessment, buildParams = {}) {
  const recommendations = [];
  const { level, factors, environmentHazards } = riskAssessment;
  const { height = 0, environment = "overworld" } = buildParams;

  // Fall protection recommendations
  if (height >= SAFETY_HEIGHT_THRESHOLDS.caution) {
    const protectionOptions = [];

    if (height >= SAFETY_HEIGHT_THRESHOLDS.extreme && environment !== "nether") {
      protectionOptions.push(FALL_PROTECTION_OPTIONS.slow_falling_potion);
      protectionOptions.push(FALL_PROTECTION_OPTIONS.elytra);
    } else if (height >= SAFETY_HEIGHT_THRESHOLDS.dangerous) {
      protectionOptions.push(FALL_PROTECTION_OPTIONS.scaffolding);
      protectionOptions.push(FALL_PROTECTION_OPTIONS.feather_falling_boots);
      if (environment !== "nether") {
        protectionOptions.push(FALL_PROTECTION_OPTIONS.water_bucket);
      }
    } else if (height >= SAFETY_HEIGHT_THRESHOLDS.elevated) {
      protectionOptions.push(FALL_PROTECTION_OPTIONS.scaffolding);
      protectionOptions.push(FALL_PROTECTION_OPTIONS.ladder);
      if (environment !== "nether") {
        protectionOptions.push(FALL_PROTECTION_OPTIONS.water_bucket);
      }
    } else {
      protectionOptions.push(FALL_PROTECTION_OPTIONS.hay_bale);
      protectionOptions.push(FALL_PROTECTION_OPTIONS.ladder);
    }

    if (protectionOptions.length > 0) {
      recommendations.push({
        type: "fall_protection",
        priority: "high",
        title: "Fall Protection Required",
        description: `Working at ${height} blocks requires fall protection`,
        options: protectionOptions.map(opt => ({
          name: opt.name,
          effectiveness: opt.effectiveness,
          cost: opt.cost,
          materials: opt.materials
        }))
      });
    }
  }

  // Environment-specific recommendations
  if (environment === "nether") {
    recommendations.push({
      type: "environment",
      priority: "critical",
      title: "Nether Safety Essentials",
      description: "Building in the Nether requires special precautions",
      requirements: [
        "Fire Resistance potions (essential)",
        "Building blocks for lava barriers",
        "Bow for ghast defense",
        "Avoid water placement (evaporates)"
      ]
    });
  }

  if (environment === "the_end" || buildParams.terrain?.includes("end")) {
    recommendations.push({
      type: "environment",
      priority: "critical",
      title: "End Dimension Safety",
      description: "The void is instant death - extreme caution required",
      requirements: [
        "Slow Falling potions mandatory",
        "Ender pearls for emergency escapes",
        "Building blocks in hotbar at all times",
        "Never dig straight down"
      ]
    });
  }

  if (environment === "underwater" || buildParams.terrain === "underwater") {
    recommendations.push({
      type: "environment",
      priority: "high",
      title: "Underwater Construction Safety",
      description: "Drowning and guardians are primary threats",
      requirements: [
        "Water Breathing potions",
        "Conduit for underwater breathing",
        "Night Vision potions for visibility",
        "Depth Strider boots for mobility"
      ]
    });
  }

  // Risk level-based recommendations
  if (level === "extreme") {
    recommendations.push({
      type: "general",
      priority: "critical",
      title: "Extreme Risk - Maximum Precautions",
      description: "This build poses extreme safety risks",
      requirements: [
        "Never work alone - have backup player nearby",
        "Keep bed/respawn point nearby",
        "Store valuables before working",
        "Plan escape routes before starting",
        "Bring extra sets of equipment"
      ]
    });
  } else if (level === "high") {
    recommendations.push({
      type: "general",
      priority: "high",
      title: "High Risk - Enhanced Safety Measures",
      description: "Significant hazards present - exercise caution",
      requirements: [
        "Establish safe work zones",
        "Mark dangerous areas clearly",
        "Keep emergency supplies accessible",
        "Test safety equipment before use"
      ]
    });
  }

  // Mob safety
  if (factors.some(f => f.includes("mob"))) {
    recommendations.push({
      type: "mob_safety",
      priority: "medium",
      title: "Mob Protection",
      description: "Prevent hostile mob interference during construction",
      requirements: [
        "Light work area to prevent spawns (light level 8+)",
        "Build perimeter fence or walls",
        "Bring weapons and armor",
        "Place torches as you build"
      ]
    });
  }

  // Weather safety
  if (buildParams.weather === "stormy" || height >= SAFETY_HEIGHT_THRESHOLDS.dangerous) {
    recommendations.push({
      type: "weather",
      priority: "medium",
      title: "Lightning Protection",
      description: "Elevated structures attract lightning",
      requirements: [
        "Avoid building during storms if possible",
        "Install lightning rods on tall structures",
        "Avoid wearing metal armor during storms",
        "Create sheltered work areas"
      ]
    });
  }

  // General safety best practices
  recommendations.push({
    type: "best_practices",
    priority: "low",
    title: "General Safety Best Practices",
    description: "Standard safety protocols for all builds",
    requirements: [
      "Keep food in inventory for health regeneration",
      "Bring extra tools as backups",
      "Mark your path for easy return",
      "Save progress frequently (bed respawn)",
      "Avoid building when tired or distracted"
    ]
  });

  return recommendations;
}

/**
 * Get recommended fall protection for given height and environment
 * @param {number} height - Build height
 * @param {string} environment - Environment type
 * @returns {Array} Recommended fall protection options
 */
function getRecommendedFallProtection(height, environment = "overworld") {
  const recommended = [];

  if (height < SAFETY_HEIGHT_THRESHOLDS.caution) {
    return recommended; // No fall protection needed
  }

  // Filter options based on environment
  const validOptions = Object.values(FALL_PROTECTION_OPTIONS).filter(option => {
    // Water buckets don't work in Nether
    if (option.name === "Water Bucket" && environment === "nether") {
      return false;
    }
    // Check minimum height requirement
    if (height < option.minHeight) {
      return false;
    }
    return true;
  });

  // Sort by effectiveness and cost
  const effectivenessOrder = { excellent: 3, good: 2, moderate: 1 };
  const costOrder = { low: 1, medium: 2, high: 3, very_high: 4 };

  validOptions.sort((a, b) => {
    const effDiff = effectivenessOrder[b.effectiveness] - effectivenessOrder[a.effectiveness];
    if (effDiff !== 0) return effDiff;
    return costOrder[a.cost] - costOrder[b.cost];
  });

  // Return top 3 options
  return validOptions.slice(0, 3);
}

// ============================================================================
// Building Validation System
// ============================================================================

/**
 * Comprehensive building validation system
 * Validates dimensions, materials, block compatibility, and game mechanics
 */
const BUILDING_VALIDATOR = {
  // World height limits by dimension
  WORLD_HEIGHT_LIMITS: {
    overworld: { min: -64, max: 320 },
    nether: { min: 0, max: 128 },
    the_end: { min: 0, max: 256 },
    underground: { min: -64, max: 64 },
    underwater: { min: -64, max: 63 },
    sky: { min: 64, max: 320 }
  },

  // Physical constants
  PLAYER_HEIGHT: 1.8,
  MIN_DOOR_HEIGHT: 2,
  MIN_COMFORTABLE_HEIGHT: 3,
  MAX_REASONABLE_LENGTH: 200,
  MAX_REASONABLE_WIDTH: 200,
  VERY_LARGE_THRESHOLD: 100,
  CRAMPED_THRESHOLD: 3,

  // Build size warnings
  BUILD_TIME_THRESHOLDS: {
    quick: 300000,      // 5 minutes
    moderate: 1800000,  // 30 minutes
    long: 3600000,      // 1 hour
    very_long: 7200000, // 2 hours
    extreme: 14400000   // 4 hours
  },

  // Block incompatibilities by environment
  INCOMPATIBLE_BLOCKS: {
    nether: ["water", "ice", "blue_ice", "packed_ice", "frosted_ice", "snow", "powder_snow"],
    the_end: ["water", "ice", "blue_ice", "packed_ice"],
    underwater: ["torch", "redstone_torch", "campfire", "soul_campfire"],
    sky: [] // Most blocks work in sky
  },

  // Blocks that have special biome behaviors
  BIOME_SENSITIVE_BLOCKS: {
    ice: {
      meltsIn: ["desert", "mesa", "savanna", "jungle", "nether"],
      warning: "Ice will melt in warm biomes"
    },
    snow: {
      meltsIn: ["desert", "mesa", "savanna", "jungle", "nether"],
      warning: "Snow will melt in warm biomes"
    },
    water: {
      freezesIn: ["ice_plains", "snowy_tundra", "frozen_ocean"],
      warning: "Water may freeze in cold biomes"
    },
    grass_block: {
      diesIn: ["nether", "the_end"],
      warning: "Grass blocks turn to dirt in Nether/End"
    },
    mycelium: {
      spreadsIn: ["mushroom_island"],
      warning: "Mycelium spreads to dirt in mushroom biomes"
    }
  },

  // Gravity-affected blocks (require support)
  GRAVITY_BLOCKS: ["sand", "red_sand", "gravel", "concrete_powder", "anvil"],

  // Blocks requiring support blocks beneath them
  REQUIRES_SUPPORT: [
    "torch", "redstone_torch", "rail", "powered_rail", "detector_rail",
    "activator_rail", "lever", "button", "pressure_plate", "carpet",
    "flower", "sapling", "mushroom", "crop", "sugar_cane"
  ],

  /**
   * Validate build dimensions
   * @param {Object} dimensions - {length, width, height}
   * @param {Object} options - Additional validation options
   * @returns {Object} Validation result with errors and warnings
   */
  checkDimensions(dimensions, options = {}) {
    const errors = [];
    const warnings = [];
    const { length = 0, width = 0, height = 0 } = dimensions || {};
    const { environment = "overworld", yPosition = 64, includesInterior = false } = options;

    // Basic dimension validation
    if (!dimensions || typeof dimensions !== 'object') {
      errors.push("Dimensions must be an object with length, width, and height");
      return { valid: false, errors, warnings };
    }

    // Check for missing or invalid dimensions
    if (!length || length <= 0) {
      errors.push("Length must be a positive number");
    }
    if (!width || width <= 0) {
      errors.push("Width must be a positive number");
    }
    if (!height || height <= 0) {
      errors.push("Height must be a positive number");
    }

    if (errors.length > 0) {
      return { valid: false, errors, warnings };
    }

    // World height limit checks
    const heightLimit = this.WORLD_HEIGHT_LIMITS[environment] || this.WORLD_HEIGHT_LIMITS.overworld;
    const buildTop = yPosition + height;
    const buildBottom = yPosition;

    if (buildTop > heightLimit.max) {
      errors.push(`Build exceeds height limit: ${buildTop} > ${heightLimit.max} (${environment})`);
    }
    if (buildBottom < heightLimit.min) {
      errors.push(`Build below minimum height: ${buildBottom} < ${heightLimit.min} (${environment})`);
    }

    // Height warnings
    if (height < this.MIN_DOOR_HEIGHT) {
      warnings.push("Too short for a door - player cannot enter");
    } else if (height < this.MIN_COMFORTABLE_HEIGHT && includesInterior) {
      warnings.push("Interior height cramped - player will bump head");
    }

    // Size warnings
    if (length < this.CRAMPED_THRESHOLD) {
      warnings.push("Very small length - cramped interior");
    }
    if (width < this.CRAMPED_THRESHOLD) {
      warnings.push("Very small width - cramped interior");
    }

    if (length > this.VERY_LARGE_THRESHOLD) {
      warnings.push(`Very large length (${length}) - may take hours to build`);
    }
    if (width > this.VERY_LARGE_THRESHOLD) {
      warnings.push(`Very large width (${width}) - may take hours to build`);
    }
    if (height > this.VERY_LARGE_THRESHOLD) {
      warnings.push(`Very tall (${height}) - requires extensive scaffolding and safety measures`);
    }

    if (length > this.MAX_REASONABLE_LENGTH) {
      warnings.push(`Extremely large length (${length}) - consider breaking into multiple builds`);
    }
    if (width > this.MAX_REASONABLE_WIDTH) {
      warnings.push(`Extremely large width (${width}) - consider breaking into multiple builds`);
    }

    // Volume warnings
    const volume = length * width * height;
    if (volume > 1000000) {
      warnings.push(`Massive volume (${volume.toLocaleString()} blocks) - extremely time consuming`);
    } else if (volume > 100000) {
      warnings.push(`Very large volume (${volume.toLocaleString()} blocks) - multi-hour project`);
    }

    // Aspect ratio warnings
    const maxDim = Math.max(length, width);
    const minDim = Math.min(length, width);
    if (maxDim / minDim > 10) {
      warnings.push("Unusual aspect ratio - very elongated structure");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      volume,
      aspectRatio: maxDim / minDim
    };
  },

  /**
   * Validate material sufficiency and compatibility
   * @param {Array|Object} materials - Materials list
   * @param {Object} dimensions - Build dimensions
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  checkMaterials(materials, dimensions, options = {}) {
    const errors = [];
    const warnings = [];
    const { length = 0, width = 0, height = 0 } = dimensions || {};
    const {
      environment = "overworld",
      biome = "plains",
      isHollow = true,
      includesRoof = true,
      includesFoundation = true
    } = options;

    if (!materials) {
      errors.push("No materials specified");
      return { sufficient: false, errors, warnings };
    }

    // Convert materials to array format if object
    let materialArray = [];
    if (Array.isArray(materials)) {
      materialArray = materials;
    } else if (typeof materials === 'object') {
      materialArray = Object.entries(materials).map(([name, count]) => ({
        name: normalizeItemName(name),
        count: parseInt(count, 10) || 0
      }));
    }

    if (materialArray.length === 0) {
      warnings.push("No materials provided - cannot validate sufficiency");
      return { sufficient: false, errors, warnings };
    }

    // Calculate total blocks needed
    const volume = length * width * height;
    let estimatedBlocksNeeded;

    if (isHollow) {
      // Hollow structure: walls, roof, foundation
      const wallBlocks = 2 * height * (length + width - 2);
      const roofBlocks = includesRoof ? length * width : 0;
      const foundationBlocks = includesFoundation ? length * width : 0;
      estimatedBlocksNeeded = wallBlocks + roofBlocks + foundationBlocks;
    } else {
      // Solid structure
      estimatedBlocksNeeded = volume;
    }

    // Count total materials
    const totalBlocks = materialArray.reduce((sum, mat) => {
      const count = parseInt(mat.count, 10) || 0;
      return sum + count;
    }, 0);

    // Material sufficiency check
    const sufficiencyRatio = totalBlocks / estimatedBlocksNeeded;

    if (sufficiencyRatio < 0.1) {
      errors.push(`Severely insufficient materials: ${totalBlocks} blocks for ~${estimatedBlocksNeeded} needed`);
    } else if (sufficiencyRatio < 0.5) {
      errors.push(`Insufficient materials: ${totalBlocks} blocks for ~${estimatedBlocksNeeded} needed`);
    } else if (sufficiencyRatio < 0.9) {
      warnings.push(`Low materials: ${totalBlocks} blocks for ~${estimatedBlocksNeeded} needed (${Math.round(sufficiencyRatio * 100)}%)`);
    } else if (sufficiencyRatio > 3) {
      warnings.push(`Excess materials: ${totalBlocks} blocks for ~${estimatedBlocksNeeded} needed`);
    }

    // Check block compatibility with environment
    const compatibilityIssues = this.checkBlockCompatibility(materialArray, environment, biome);
    errors.push(...compatibilityIssues.errors);
    warnings.push(...compatibilityIssues.warnings);

    return {
      sufficient: errors.length === 0 && sufficiencyRatio >= 0.5,
      sufficiencyRatio,
      totalBlocks,
      estimatedBlocksNeeded,
      errors,
      warnings
    };
  },

  /**
   * Check if blocks are compatible with environment and biome
   * @param {Array} materials - Materials list
   * @param {string} environment - Environment type
   * @param {string} biome - Biome type
   * @returns {Object} Compatibility issues
   */
  checkBlockCompatibility(materials, environment = "overworld", biome = "plains") {
    const errors = [];
    const warnings = [];

    if (!Array.isArray(materials)) {
      return { errors, warnings };
    }

    const incompatibleBlocks = this.INCOMPATIBLE_BLOCKS[environment] || [];

    materials.forEach(material => {
      const blockName = normalizeItemName(material.name || material);

      // Check environment incompatibilities
      incompatibleBlocks.forEach(incompatible => {
        if (blockName.includes(incompatible)) {
          errors.push(`${material.name || material} cannot be placed in ${environment}`);
        }
      });

      // Check biome-specific issues
      Object.entries(this.BIOME_SENSITIVE_BLOCKS).forEach(([block, behavior]) => {
        if (blockName.includes(normalizeItemName(block))) {
          if (behavior.meltsIn && behavior.meltsIn.includes(biome)) {
            warnings.push(`${material.name || material}: ${behavior.warning}`);
          }
          if (behavior.freezesIn && behavior.freezesIn.includes(biome)) {
            warnings.push(`${material.name || material}: ${behavior.warning}`);
          }
          if (behavior.diesIn && behavior.diesIn.includes(environment)) {
            warnings.push(`${material.name || material}: ${behavior.warning}`);
          }
        }
      });

      // Check gravity-affected blocks
      this.GRAVITY_BLOCKS.forEach(gravityBlock => {
        if (blockName.includes(gravityBlock)) {
          warnings.push(`${material.name || material} is affected by gravity - requires support or will fall`);
        }
      });
    });

    return { errors, warnings };
  },

  /**
   * Validate world height limits for build
   * @param {Object} dimensions - Build dimensions
   * @param {number} yPosition - Starting Y position
   * @param {string} environment - Environment type
   * @returns {Object} Validation result
   */
  checkWorldLimits(dimensions, yPosition = 64, environment = "overworld") {
    const errors = [];
    const warnings = [];
    const { height = 0 } = dimensions || {};

    const limits = this.WORLD_HEIGHT_LIMITS[environment] || this.WORLD_HEIGHT_LIMITS.overworld;
    const buildTop = yPosition + height;
    const buildBottom = yPosition;

    if (buildTop > limits.max) {
      errors.push(`Build top (Y=${buildTop}) exceeds height limit (Y=${limits.max})`);
    }
    if (buildBottom < limits.min) {
      errors.push(`Build bottom (Y=${buildBottom}) below height limit (Y=${limits.min})`);
    }

    // Warnings for near-limit builds
    if (buildTop > limits.max - 10 && buildTop <= limits.max) {
      warnings.push(`Build approaches height limit - only ${limits.max - buildTop} blocks clearance`);
    }
    if (buildBottom < limits.min + 10 && buildBottom >= limits.min) {
      warnings.push(`Build near bedrock - only ${buildBottom - limits.min} blocks clearance`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      buildTop,
      buildBottom,
      clearanceAbove: limits.max - buildTop,
      clearanceBelow: buildBottom - limits.min
    };
  },

  /**
   * Check structural integrity considerations
   * @param {Object} dimensions - Build dimensions
   * @param {Array} materials - Materials list
   * @returns {Object} Structural warnings
   */
  checkStructuralIntegrity(dimensions, materials) {
    const warnings = [];
    const { length = 0, width = 0, height = 0 } = dimensions || {};

    // Large unsupported roofs
    const roofSpan = Math.max(length, width);
    if (roofSpan > 20) {
      warnings.push("Large roof span - consider adding support pillars");
    }

    // Tall thin structures
    const maxHorizontal = Math.max(length, width);
    if (height > maxHorizontal * 3) {
      warnings.push("Very tall thin structure - may look unstable");
    }

    // Glass structures
    const hasGlass = materials.some(mat => {
      const name = normalizeItemName(mat.name || mat);
      return name.includes("glass");
    });
    if (hasGlass && height > 50) {
      warnings.push("Tall glass structure - consider adding support frames");
    }

    return { warnings };
  },

  /**
   * Comprehensive build plan validation
   * @param {Object} plan - Complete build plan
   * @param {Object} context - Additional context
   * @returns {Object} Full validation results
   */
  validateBuildPlan(plan, context = {}) {
    const allErrors = [];
    const allWarnings = [];
    const validationResults = {};

    // Extract plan details
    const dimensions = plan.dimensions || context.dimensions || {};
    const materials = plan.materials || context.materials || [];
    const environment = context.environment || plan.environment || "overworld";
    const biome = context.biome || plan.biome || "plains";
    const yPosition = context.yPosition || 64;
    const estimatedDuration = plan.estimatedDuration || 0;

    // Validate dimensions
    const dimValidation = this.checkDimensions(dimensions, {
      environment,
      yPosition,
      includesInterior: plan.interior || false
    });
    validationResults.dimensions = dimValidation;
    allErrors.push(...dimValidation.errors);
    allWarnings.push(...dimValidation.warnings);

    // Validate materials
    if (materials && materials.length > 0) {
      const matValidation = this.checkMaterials(materials, dimensions, {
        environment,
        biome,
        isHollow: true,
        includesRoof: plan.roofStyle !== "none",
        includesFoundation: true
      });
      validationResults.materials = matValidation;
      allErrors.push(...matValidation.errors);
      allWarnings.push(...matValidation.warnings);
    }

    // Validate world limits
    const worldValidation = this.checkWorldLimits(dimensions, yPosition, environment);
    validationResults.worldLimits = worldValidation;
    allErrors.push(...worldValidation.errors);
    allWarnings.push(...worldValidation.warnings);

    // Check structural integrity
    if (materials && materials.length > 0) {
      const structValidation = this.checkStructuralIntegrity(dimensions, materials);
      validationResults.structural = structValidation;
      allWarnings.push(...structValidation.warnings);
    }

    // Time estimation validation
    if (estimatedDuration > this.BUILD_TIME_THRESHOLDS.extreme) {
      allWarnings.push(`Estimated duration: ${Math.round(estimatedDuration / 60000)} minutes - extremely long build`);
    } else if (estimatedDuration > this.BUILD_TIME_THRESHOLDS.very_long) {
      allWarnings.push(`Estimated duration: ${Math.round(estimatedDuration / 60000)} minutes - very long build`);
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      validationResults,
      summary: {
        totalErrors: allErrors.length,
        totalWarnings: allWarnings.length,
        valid: allErrors.length === 0,
        acceptable: allErrors.length === 0 && allWarnings.length < 5
      }
    };
  }
};

// ============================================================================
// Build Cost Estimator
// ============================================================================

/**
 * Item value database - costs in emeralds
 * Based on villager trading prices and resource rarity
 */
const ITEM_VALUES = {
  // Basic building blocks (cheap)
  dirt: 0.01,
  cobblestone: 0.02,
  stone: 0.03,
  sand: 0.02,
  gravel: 0.02,
  sandstone: 0.04,
  netherrack: 0.02,
  end_stone: 0.15,

  // Wood materials
  oak_log: 0.05,
  oak_planks: 0.02,
  oak_slab: 0.01,
  oak_stairs: 0.03,
  oak_fence: 0.03,
  oak_door: 0.04,
  spruce_log: 0.05,
  spruce_planks: 0.02,
  birch_log: 0.05,
  birch_planks: 0.02,
  jungle_log: 0.06,
  jungle_planks: 0.02,
  acacia_log: 0.05,
  acacia_planks: 0.02,
  dark_oak_log: 0.06,
  dark_oak_planks: 0.02,
  crimson_planks: 0.08,
  warped_planks: 0.08,

  // Stone variants
  andesite: 0.03,
  diorite: 0.03,
  granite: 0.03,
  polished_andesite: 0.04,
  polished_diorite: 0.04,
  polished_granite: 0.04,
  stone_bricks: 0.05,
  mossy_stone_bricks: 0.06,
  cracked_stone_bricks: 0.05,
  chiseled_stone_bricks: 0.06,

  // Bricks and blocks
  bricks: 0.08,
  brick: 0.02,
  clay: 0.05,
  clay_ball: 0.01,
  terracotta: 0.06,
  white_terracotta: 0.07,
  concrete: 0.08,
  concrete_powder: 0.06,

  // Glass
  glass: 0.04,
  glass_pane: 0.02,
  stained_glass: 0.05,
  stained_glass_pane: 0.03,

  // Wool and textiles
  wool: 0.05,
  white_wool: 0.05,
  carpet: 0.02,

  // Precious blocks (expensive)
  iron_block: 3.0,
  gold_block: 5.0,
  diamond_block: 50.0,
  emerald_block: 90.0,
  netherite_block: 200.0,

  // Ores and ingots
  coal: 0.05,
  iron_ingot: 0.33,
  gold_ingot: 0.56,
  diamond: 5.5,
  emerald: 1.0,
  netherite_ingot: 22.0,
  copper_ingot: 0.15,

  // Redstone
  redstone: 0.08,
  redstone_block: 0.72,
  redstone_torch: 0.10,
  repeater: 0.30,
  comparator: 0.50,
  piston: 0.60,
  sticky_piston: 0.80,
  hopper: 1.80,
  dropper: 0.40,
  dispenser: 0.45,
  observer: 0.70,

  // Lighting
  torch: 0.02,
  lantern: 0.30,
  soul_lantern: 0.35,
  glowstone: 0.25,
  sea_lantern: 0.40,
  redstone_lamp: 0.50,

  // Decorative
  painting: 0.10,
  item_frame: 0.08,
  flower_pot: 0.05,

  // Functional blocks
  crafting_table: 0.08,
  furnace: 0.16,
  blast_furnace: 1.50,
  smoker: 1.50,
  chest: 0.16,
  barrel: 0.14,
  bed: 0.60,
  door: 0.04,
  trapdoor: 0.06,
  fence_gate: 0.08,

  // Nether materials
  nether_bricks: 0.08,
  red_nether_bricks: 0.10,
  nether_wart_block: 0.12,
  soul_sand: 0.06,
  soul_soil: 0.05,
  basalt: 0.04,
  blackstone: 0.06,
  gilded_blackstone: 0.70,

  // End materials
  purpur_block: 0.20,
  purpur_pillar: 0.22,
  end_stone_bricks: 0.18,

  // Quartz
  quartz: 0.15,
  quartz_block: 0.60,
  quartz_pillar: 0.62,
  chiseled_quartz_block: 0.65,
  smooth_quartz: 0.62,

  // Prismarine (underwater)
  prismarine: 0.40,
  prismarine_bricks: 0.45,
  dark_prismarine: 0.50,
  sea_lantern: 0.40,

  // Rare/special blocks
  sponge: 5.0,
  wet_sponge: 5.0,
  slime_block: 2.0,
  honey_block: 1.5,
  scaffolding: 0.10,
  hay_bale: 0.12,

  // Tools (depreciation cost per use)
  wooden_pickaxe: 0.10,
  stone_pickaxe: 0.20,
  iron_pickaxe: 1.50,
  diamond_pickaxe: 15.0,
  netherite_pickaxe: 120.0,
  wooden_axe: 0.10,
  stone_axe: 0.20,
  iron_axe: 1.50,
  diamond_axe: 15.0,
  netherite_axe: 120.0,
  wooden_shovel: 0.08,
  stone_shovel: 0.15,
  iron_shovel: 1.20,
  diamond_shovel: 12.0,
  netherite_shovel: 100.0,
  shears: 0.80,

  // Potions
  water_breathing_potion: 0.50,
  night_vision_potion: 0.40,
  fire_resistance_potion: 0.60,
  slow_falling_potion: 0.55,
  invisibility_potion: 0.80,
  regeneration_potion: 1.00,

  // Special items
  elytra: 50.0,
  firework_rocket: 0.20,
  ender_pearl: 0.40,
  ender_chest: 10.0,
  shulker_box: 15.0,

  // Default for unspecified items
  unspecified_item: 0.10,
  default: 0.10
};

/**
 * Labor rates and multipliers
 */
const LABOR_RATES = {
  HOURLY_RATE: 5.0,              // Base emeralds per hour
  SKILL_MULTIPLIERS: {
    basic: 1.0,
    intermediate: 1.3,
    advanced: 1.6,
    expert: 2.0
  },
  ENVIRONMENT_MULTIPLIERS: {
    overworld: 1.0,
    nether: 1.5,
    the_end: 1.8,
    underground: 1.2,
    underwater: 1.6,
    sky: 1.3
  },
  DIFFICULTY_MULTIPLIERS: {
    easy: 1.0,
    medium: 1.2,
    hard: 1.5,
    expert: 2.0
  }
};

/**
 * Build Cost Estimator system
 * Calculates comprehensive costs for construction projects
 */
const COST_ESTIMATOR = {
  /**
   * Get the value of an item in emeralds
   * @param {string} itemName - Item name
   * @returns {number} Value in emeralds
   */
  getItemValue(itemName) {
    if (!itemName) return ITEM_VALUES.default;

    const normalized = normalizeItemName(itemName);

    // Direct lookup
    if (ITEM_VALUES[itemName]) {
      return ITEM_VALUES[itemName];
    }

    // Normalized lookup
    if (ITEM_VALUES[normalized]) {
      return ITEM_VALUES[normalized];
    }

    // Partial match (e.g., "white_wool" matches "wool")
    for (const [key, value] of Object.entries(ITEM_VALUES)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }

    return ITEM_VALUES.default;
  },

  /**
   * Calculate material costs
   * @param {Array} materials - Materials list with name and count
   * @returns {Object} Material cost breakdown
   */
  calculateMaterialCost(materials) {
    if (!materials || !Array.isArray(materials)) {
      return { total: 0, breakdown: [] };
    }

    const breakdown = materials.map(mat => {
      const name = mat.name || mat;
      const count = parseInt(mat.count, 10) || 1;
      const unitCost = this.getItemValue(name);
      const totalCost = count * unitCost;

      return {
        name,
        count,
        unitCost,
        totalCost
      };
    });

    const total = breakdown.reduce((sum, item) => sum + item.totalCost, 0);

    return {
      total,
      breakdown,
      itemCount: breakdown.length,
      totalBlocks: breakdown.reduce((sum, item) => sum + item.count, 0)
    };
  },

  /**
   * Calculate labor costs
   * @param {number} laborTimeMs - Labor time in milliseconds
   * @param {Object} options - Skill level, environment, difficulty
   * @returns {Object} Labor cost details
   */
  calculateLaborCost(laborTimeMs, options = {}) {
    const {
      skillLevel = "basic",
      environment = "overworld",
      difficulty = "medium"
    } = options;

    // Convert ms to hours
    const hours = laborTimeMs / (1000 * 60 * 60);

    // Base labor cost
    const baseRate = LABOR_RATES.HOURLY_RATE;

    // Apply multipliers
    const skillMultiplier = LABOR_RATES.SKILL_MULTIPLIERS[skillLevel] || 1.0;
    const envMultiplier = LABOR_RATES.ENVIRONMENT_MULTIPLIERS[environment] || 1.0;
    const diffMultiplier = LABOR_RATES.DIFFICULTY_MULTIPLIERS[difficulty] || 1.0;

    const effectiveRate = baseRate * skillMultiplier * envMultiplier * diffMultiplier;
    const total = hours * effectiveRate;

    return {
      total,
      hours,
      baseRate,
      effectiveRate,
      multipliers: {
        skill: skillMultiplier,
        environment: envMultiplier,
        difficulty: diffMultiplier,
        combined: skillMultiplier * envMultiplier * diffMultiplier
      }
    };
  },

  /**
   * Calculate tool depreciation costs
   * @param {Array} tools - Tools list
   * @param {number} usageDuration - Expected usage time in ms
   * @returns {Object} Tool cost details
   */
  calculateToolCost(tools, usageDuration) {
    if (!tools || !Array.isArray(tools)) {
      return { total: 0, breakdown: [] };
    }

    // Tool durability (uses before breaking)
    const TOOL_DURABILITY = {
      wooden: 59,
      stone: 131,
      iron: 250,
      diamond: 1561,
      netherite: 2031
    };

    // Estimate uses based on duration (very rough estimate)
    const estimatedUses = Math.ceil(usageDuration / 5000); // ~5 seconds per action

    const breakdown = tools.map(tool => {
      const toolName = normalizeItemName(tool.name || tool);
      const toolValue = this.getItemValue(toolName);

      // Determine tool material
      let durability = 250; // default to iron
      for (const [material, dur] of Object.entries(TOOL_DURABILITY)) {
        if (toolName.includes(material)) {
          durability = dur;
          break;
        }
      }

      // Calculate depreciation (fraction of tool value used)
      const depreciationFraction = Math.min(estimatedUses / durability, 1.0);
      const depreciationCost = toolValue * depreciationFraction;

      return {
        name: toolName,
        value: toolValue,
        durability,
        estimatedUses,
        depreciationFraction,
        cost: depreciationCost
      };
    });

    const total = breakdown.reduce((sum, item) => sum + item.cost, 0);

    return {
      total,
      breakdown,
      estimatedUses
    };
  },

  /**
   * Calculate consumable costs (potions, food, etc.)
   * @param {Array} consumables - Consumables list
   * @returns {Object} Consumable cost details
   */
  calculateConsumableCost(consumables) {
    if (!consumables || !Array.isArray(consumables)) {
      return { total: 0, breakdown: [] };
    }

    const breakdown = consumables.map(item => {
      const name = item.name || item;
      const count = parseInt(item.count, 10) || 1;
      const unitCost = this.getItemValue(name);
      const totalCost = count * unitCost;

      return {
        name,
        count,
        unitCost,
        totalCost
      };
    });

    const total = breakdown.reduce((sum, item) => sum + item.totalCost, 0);

    return {
      total,
      breakdown
    };
  },

  /**
   * Calculate comprehensive build cost
   * @param {Object} buildPlan - Complete build plan
   * @param {Object} context - Additional context
   * @returns {Object} Complete cost estimate
   */
  calculateBuildCost(buildPlan, context = {}) {
    const materials = buildPlan.materials || context.materials || [];
    const laborTime = buildPlan.estimatedDuration || 0;
    const tools = context.tools || buildPlan.tools || [];
    const potions = context.potions || buildPlan.potions || [];

    const skillLevel = buildPlan.difficulty || context.skillLevel || "basic";
    const environment = context.environment || buildPlan.environment || "overworld";
    const difficulty = buildPlan.difficulty || "medium";

    // Calculate each cost component
    const materialCost = this.calculateMaterialCost(materials);
    const laborCost = this.calculateLaborCost(laborTime, {
      skillLevel,
      environment,
      difficulty
    });
    const toolCost = this.calculateToolCost(tools, laborTime);
    const consumableCost = this.calculateConsumableCost(potions);

    // Calculate totals
    const subtotal = materialCost.total + laborCost.total + toolCost.total + consumableCost.total;

    // Add contingency (10% buffer for unexpected costs)
    const contingency = subtotal * 0.10;
    const total = subtotal + contingency;

    return {
      total,
      subtotal,
      contingency,
      materials: materialCost,
      labor: laborCost,
      tools: toolCost,
      consumables: consumableCost,
      breakdown: {
        materials: materialCost.total,
        labor: laborCost.total,
        tools: toolCost.total,
        consumables: consumableCost.total,
        contingency
      },
      percentages: {
        materials: (materialCost.total / total * 100).toFixed(1),
        labor: (laborCost.total / total * 100).toFixed(1),
        tools: (toolCost.total / total * 100).toFixed(1),
        consumables: (consumableCost.total / total * 100).toFixed(1),
        contingency: (contingency / total * 100).toFixed(1)
      }
    };
  },

  /**
   * Compare costs with budget
   * @param {number} estimatedCost - Estimated cost
   * @param {number} budget - Available budget
   * @returns {Object} Budget comparison
   */
  compareToBudget(estimatedCost, budget) {
    if (!budget || budget <= 0) {
      return {
        withinBudget: true,
        difference: 0,
        percentageUsed: 0,
        status: "no_budget_set"
      };
    }

    const difference = budget - estimatedCost;
    const percentageUsed = (estimatedCost / budget * 100);
    const withinBudget = estimatedCost <= budget;

    let status;
    if (percentageUsed < 75) {
      status = "well_under_budget";
    } else if (percentageUsed < 95) {
      status = "within_budget";
    } else if (percentageUsed < 105) {
      status = "tight_budget";
    } else {
      status = "over_budget";
    }

    return {
      withinBudget,
      difference,
      percentageUsed: percentageUsed.toFixed(1),
      status,
      budget,
      estimatedCost
    };
  },

  /**
   * Suggest cost optimizations
   * @param {Object} costBreakdown - Cost breakdown
   * @returns {Array} Optimization suggestions
   */
  suggestOptimizations(costBreakdown) {
    const suggestions = [];

    // Check if materials are the biggest cost
    const materialPercentage = parseFloat(costBreakdown.percentages.materials);
    if (materialPercentage > 50) {
      suggestions.push({
        category: "materials",
        priority: "high",
        suggestion: "Materials represent >50% of cost. Consider using cheaper alternatives.",
        potentialSavings: costBreakdown.materials.total * 0.2
      });
    }

    // Check if labor is expensive
    const laborPercentage = parseFloat(costBreakdown.percentages.labor);
    if (laborPercentage > 40) {
      suggestions.push({
        category: "labor",
        priority: "medium",
        suggestion: "High labor costs. Consider using templates or breaking into smaller phases.",
        potentialSavings: costBreakdown.labor.total * 0.15
      });
    }

    // Check for expensive individual materials
    if (costBreakdown.materials.breakdown) {
      const expensiveItems = costBreakdown.materials.breakdown
        .filter(item => item.totalCost > 10.0)
        .sort((a, b) => b.totalCost - a.totalCost)
        .slice(0, 3);

      expensiveItems.forEach(item => {
        suggestions.push({
          category: "materials",
          priority: "medium",
          suggestion: `${item.name} costs ${item.totalCost.toFixed(2)} emeralds. Consider alternatives.`,
          potentialSavings: item.totalCost * 0.3,
          item: item.name
        });
      });
    }

    return suggestions;
  }
};

/**
 * Look up a terrain profile by name or normalized name
 * @param {string} terrainType - Terrain identifier
 * @returns {Object|null} Terrain profile or null
 */
function findTerrainProfile(terrainType) {
  if (!terrainType || typeof terrainType !== 'string') {
    return null;
  }

  const normalized = normalizeItemName(terrainType);

  // Direct lookup
  if (TERRAIN_PROFILES[terrainType]) {
    return TERRAIN_PROFILES[terrainType];
  }

  // Normalized lookup
  if (TERRAIN_PROFILES[normalized]) {
    return TERRAIN_PROFILES[normalized];
  }

  // Fuzzy match on profile names
  for (const [key, profile] of Object.entries(TERRAIN_PROFILES)) {
    const profileNameNormalized = normalizeItemName(profile.name);
    if (profileNameNormalized === normalized || key === normalized) {
      return profile;
    }
  }

  return null;
}

/**
 * Apply terrain profile to task, adding terrain-specific requirements
 * @param {Object} task - Task object
 * @param {Object} terrainProfile - Terrain profile object
 * @returns {Object} Task with terrain modifications
 */
function applyTerrainProfile(task, terrainProfile) {
  if (!terrainProfile) {
    return task;
  }

  const enhancedTask = { ...task };
  const metadata = { ...task.metadata };

  // Add terrain-specific tools if not already present
  if (terrainProfile.tools && terrainProfile.tools.length > 0) {
    const existingTools = metadata.requiredTools || [];
    const newTools = [...new Set([...existingTools, ...terrainProfile.tools])];
    metadata.requiredTools = newTools;
  }

  // Add terrain-specific materials
  if (terrainProfile.materials && terrainProfile.materials.length > 0) {
    const terrainMaterials = terrainProfile.materials.map(mat => {
      if (typeof mat === 'string') {
        const [name, count] = mat.includes(':') ? mat.split(':') : [mat, 1];
        return { name: normalizeItemName(name), count: parseInt(count, 10) };
      }
      return mat;
    });

    const existingMaterials = metadata.materials || [];
    metadata.terrainMaterials = terrainMaterials;

    // Merge with existing if we want combined list
    if (existingMaterials.length === 0) {
      metadata.materials = terrainMaterials;
    }
  }

  // Add potions if required
  if (terrainProfile.potions && terrainProfile.potions.length > 0) {
    metadata.requiredPotions = terrainProfile.potions;
  }

  // Store terrain info for later reference
  metadata.terrainProfile = terrainProfile.name;
  metadata.terrainDifficulty = terrainProfile.difficulty;
  metadata.terrainPreparation = terrainProfile.preparation;

  enhancedTask.metadata = metadata;
  enhancedTask.terrainUsed = terrainProfile.name;
  enhancedTask.terrainClearanceTime = terrainProfile.clearanceTime;
  enhancedTask.terrainTimeMultiplier = terrainProfile.timeMultiplier || 1.0;

  return enhancedTask;
}

/**
 * Look up a building template by name or normalized name
 * @param {string} templateName - Template identifier
 * @returns {Object|null} Template object or null
 */
function findBuildingTemplate(templateName) {
  if (!templateName || typeof templateName !== 'string') {
    return null;
  }

  const normalized = normalizeItemName(templateName);

  // Direct lookup
  if (BUILDING_TEMPLATES[templateName]) {
    return BUILDING_TEMPLATES[templateName];
  }

  // Normalized lookup
  if (BUILDING_TEMPLATES[normalized]) {
    return BUILDING_TEMPLATES[normalized];
  }

  // Fuzzy match on template names
  for (const [key, template] of Object.entries(BUILDING_TEMPLATES)) {
    const templateNameNormalized = normalizeItemName(template.name);
    if (templateNameNormalized === normalized || key === normalized) {
      return template;
    }
  }

  return null;
}

/**
 * Apply template data to task, merging with existing metadata
 * @param {Object} task - Task object
 * @param {Object} template - Template object
 * @returns {Object} Enhanced task with template data
 */
function applyTemplateToTask(task, template) {
  if (!template) {
    return task;
  }

  const enhancedTask = { ...task };
  const metadata = { ...task.metadata };

  // Apply template dimensions if not specified
  if (template.dimensions && !metadata.dimensions && !metadata.length) {
    metadata.length = template.dimensions.length;
    metadata.width = template.dimensions.width;
    if (template.dimensions.height > 0) {
      metadata.height = template.dimensions.height;
    }
  }

  // Apply template materials if not specified
  if (template.materials && !metadata.materials) {
    metadata.materials = Object.entries(template.materials).map(([name, count]) => ({
      name,
      count
    }));
  }

  // Apply template properties
  if (template.roofStyle && !metadata.roofStyle) {
    metadata.roofStyle = template.roofStyle;
  }
  if (template.foundation && !metadata.foundation) {
    metadata.foundation = template.foundation;
  }
  if (template.difficulty && !metadata.difficulty) {
    metadata.difficulty = template.difficulty;
  }
  if (template.requiresScaffolding && !metadata.requiresScaffolding) {
    metadata.requiresScaffolding = template.requiresScaffolding;
  }
  if (template.includesRedstone && !metadata.includesRedstone) {
    metadata.includesRedstone = template.includesRedstone;
  }
  if (template.interior !== undefined && metadata.interior === undefined) {
    metadata.interior = template.interior;
  }
  if (template.levelGround && !metadata.levelGround) {
    metadata.levelGround = template.levelGround;
  }
  if (template.terrain && !metadata.terrain) {
    metadata.terrain = template.terrain;
  }
  if (template.threatLevel && !metadata.threatLevel) {
    metadata.threatLevel = template.threatLevel;
  }
  if (template.environment && !metadata.environment) {
    metadata.environment = template.environment;
  }
  if (template.features && !metadata.features) {
    metadata.features = template.features;
  }

  enhancedTask.metadata = metadata;

  // Use template's estimated duration if available
  if (template.estimatedDuration && !enhancedTask.estimatedDuration) {
    enhancedTask.templateEstimatedDuration = template.estimatedDuration;
  }

  // Store template reference
  enhancedTask.templateUsed = template.name || 'unknown';

  return enhancedTask;
}

/**
 * Estimate materials using calculator when not explicitly provided
 * @param {Object} dimensions - Parsed dimensions
 * @param {Object} metadata - Task metadata
 * @returns {Array} Material requirements array
 */
function estimateMaterialsFromDimensions(dimensions, metadata = {}) {
  if (!dimensions || !dimensions.length || !dimensions.width) {
    return [];
  }

  const buildOptions = {
    roofStyle: metadata.roofStyle || "pitched",
    foundation: metadata.foundation !== false,
    floors: metadata.floors || 1,
    materialType: metadata.primaryMaterial || metadata.buildingMaterial || "oak_planks",
    roofMaterial: metadata.roofMaterial || metadata.primaryMaterial || "oak_planks",
    foundationMaterial: metadata.foundationMaterial || "cobblestone",
    includeInterior: metadata.interior !== false
  };

  const estimate = MATERIAL_CALCULATOR.generateEstimate(dimensions, buildOptions);

  if (!estimate || !estimate.materials) {
    return [];
  }

  // Convert materials object to array format
  return Object.entries(estimate.materials)
    .filter(([name, count]) => count > 0)
    .map(([name, count]) => ({
      name: normalizeItemName(name),
      count
    }));
}

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

function normalizeMaterials(task, dimensions = null) {
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

  // Try to estimate materials from dimensions if available
  if (dimensions && dimensions.length && dimensions.width) {
    const estimated = estimateMaterialsFromDimensions(dimensions, task?.metadata || {});
    if (estimated.length > 0) {
      return estimated;
    }
  }

  // Fallback to basic material specification
  const fallback = normalizeItemName(task?.metadata?.primaryMaterial || task?.details || "building blocks");
  const fallbackCount = resolveQuantity(task?.metadata?.quantity ?? task?.metadata?.blocks, null);
  return [{ name: fallback, count: fallbackCount }];
}

export function planBuildTask(task, context = {}) {
  // Validate input task
  if (!task || typeof task !== 'object') {
    throw new Error('Invalid task: task must be a non-null object');
  }

  // Check for and apply building template
  const templateName = task?.metadata?.template || task?.metadata?.blueprint || task?.metadata?.structure;
  const template = findBuildingTemplate(templateName);

  // Apply template if found, otherwise use original task
  let enhancedTask = template ? applyTemplateToTask(task, template) : task;

  // Check for and apply terrain profile
  const terrainType = enhancedTask?.metadata?.terrain || enhancedTask?.metadata?.terrainType || enhancedTask?.metadata?.biome;
  const terrainProfile = findTerrainProfile(terrainType);

  // Apply terrain profile if found
  if (terrainProfile) {
    enhancedTask = applyTerrainProfile(enhancedTask, terrainProfile);
  }

  const blueprint = normalizeItemName(
    enhancedTask?.metadata?.blueprint ||
    enhancedTask?.metadata?.structure ||
    (template ? template.name : null) ||
    enhancedTask.details
  );

  const targetDescription = describeTarget(enhancedTask.target);
  const orientation = normalizeItemName(enhancedTask?.metadata?.orientation || enhancedTask?.metadata?.facing || "");
  const height = resolveQuantity(enhancedTask?.metadata?.height ?? enhancedTask?.metadata?.floors, null);
  const inventory = extractInventory(context);
  const dimensions = parseDimensions(enhancedTask?.metadata);

  const floorArea = dimensions?.length && dimensions?.width ? dimensions.length * dimensions.width : null;
  const enclosedVolume = floorArea && (dimensions?.height || height)
    ? floorArea * (dimensions.height || height)
    : null;

  // Pass dimensions to normalizeMaterials for auto-estimation
  const materialRequirements = normalizeMaterials(enhancedTask, dimensions);
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
  if (enhancedTask?.metadata?.terrain === "rocky" || enhancedTask?.metadata?.foundation === "stone") {
    addTool("pickaxe");
  }
  if (enhancedTask?.metadata?.terrain === "forest" || enhancedTask?.metadata?.clearTrees) {
    addTool("axe");
  }
  if (enhancedTask?.metadata?.terrain === "sand" || enhancedTask?.metadata?.levelGround) {
    addTool("shovel");
  }
  if (enhancedTask?.metadata?.includesRedstone) {
    addTool("redstone toolkit");
  }
  if (enhancedTask?.metadata?.lighting || enhancedTask?.metadata?.buildAtNight) {
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

  if (enhancedTask?.metadata?.blueprintUrl || enhancedTask?.metadata?.blueprintReference) {
    const reference =
      enhancedTask?.metadata?.blueprintReference || enhancedTask?.metadata?.blueprintUrl || blueprint || "structure";
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

  // Add terrain-specific preparation step
  if (terrainProfile) {
    const terrainStepTitle = terrainProfile.preparation === "minimal" ? "Inspect terrain" : "Prepare terrain";
    const terrainStepDescription = terrainProfile.considerations && terrainProfile.considerations.length > 0
      ? `${terrainProfile.name} terrain requires ${terrainProfile.preparation} preparation. ${terrainProfile.considerations.join(' ')}`
      : `Prepare ${terrainProfile.name} terrain for construction (${terrainProfile.preparation} preparation required).`;

    steps.push(
      createStep({
        title: terrainStepTitle,
        type: "preparation",
        description: terrainStepDescription,
        metadata: {
          terrainType: terrainProfile.name,
          difficulty: terrainProfile.difficulty,
          estimatedTime: terrainProfile.clearanceTime,
          requiredTools: terrainProfile.tools,
          considerations: terrainProfile.considerations
        }
      })
    );

    // Add potion preparation step if potions are required
    if (terrainProfile.potions && terrainProfile.potions.length > 0) {
      steps.push(
        createStep({
          title: "Prepare potions",
          type: "inventory",
          description: `Brew required potions for ${terrainProfile.name}: ${terrainProfile.potions.join(', ')}. Bring extras for safety.`,
          metadata: { potions: terrainProfile.potions }
        })
      );
    }
  } else if (enhancedTask?.metadata?.terrain === "uneven" || enhancedTask?.metadata?.levelGround) {
    // Fallback for generic terrain specification
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

  if (enhancedTask?.metadata?.perimeter || enhancedTask?.metadata?.threatLevel === "high") {
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

  if (enhancedTask?.metadata?.roofStyle || enhancedTask?.metadata?.requiresRoof) {
    steps.push(
      createStep({
        title: "Install roof",
        type: "construction",
        description: `Shape the roof using the ${enhancedTask?.metadata?.roofStyle || "specified"} style, ensuring overhangs and lighting prevent mob spawns.`
      })
    );
  }

  if (enhancedTask?.metadata?.includesRedstone) {
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

  if (enhancedTask?.metadata?.interior !== false) {
    steps.push(
      createStep({
        title: "Outfit interior",
        type: "decoration",
        description: "Place furnishings, storage, and lighting, verifying accessibility and spawn-proofing inside the structure."
      })
    );
  }

  if (enhancedTask?.metadata?.cleanup !== false) {
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
  if (enhancedTask?.metadata?.environment === "nether") {
    risks.push("Building in the Nether requires fire resistance and ghast-proofing.");
  }
  if (enhancedTask?.metadata?.weather === "stormy") {
    risks.push("Stormy weather may cause lightning strikes; add lightning rods and shelter.");
  }
  if (enhancedTask?.metadata?.threatLevel === "high") {
    risks.push("Hostile mobs likely to interrupt construction; maintain perimeter defenses.");
  }
  if (floorArea && floorArea > 0) {
    risks.push(`Large footprint (~${floorArea} blocks) increases build time and supply demand.`);
  }

  // Add template-specific risks if difficulty is high
  if (template && template.difficulty === "hard") {
    risks.push(`${template.name} is rated as a hard build; expect increased complexity.`);
  }
  if (template && template.difficulty === "expert") {
    risks.push(`${template.name} is rated as expert difficulty; advanced knowledge required.`);
  }

  // Add terrain-specific risks
  if (terrainProfile && terrainProfile.risks && terrainProfile.risks.length > 0) {
    risks.push(...terrainProfile.risks);

    // Add terrain difficulty warning
    if (terrainProfile.difficulty === "hard") {
      risks.push(`${terrainProfile.name} is challenging terrain; expect ${terrainProfile.preparation} site preparation.`);
    }
    if (terrainProfile.difficulty === "expert") {
      risks.push(`${terrainProfile.name} is expert-level terrain; requires specialized equipment and experience.`);
    }
  }

  const volumeWeight = enclosedVolume && enclosedVolume > 0 ? enclosedVolume * VOLUME_TIME_MULTIPLIER : 0;

  // Use template duration if available, otherwise calculate
  let baseDuration = enhancedTask.templateEstimatedDuration || (
    BUILD_TIME_BASE +
    blockCount * BUILD_TIME_PER_BLOCK +
    (height && height > TALL_STRUCTURE_THRESHOLD ? BUILD_TIME_TALL_STRUCTURE : 0) +
    volumeWeight
  );

  // Apply terrain time multiplier if terrain profile is used
  const terrainTimeMultiplier = terrainProfile ? terrainProfile.timeMultiplier : 1.0;
  const terrainClearanceTime = terrainProfile ? terrainProfile.clearanceTime : 0;

  const estimatedDuration = Math.ceil((baseDuration * terrainTimeMultiplier) + terrainClearanceTime);

  // Calculate progressive build phases and milestones
  const buildPhases = calculateBuildPhases(estimatedDuration, {
    includesRedstone: enhancedTask?.metadata?.includesRedstone || false,
    includeInterior: enhancedTask?.metadata?.interior !== false,
    requiresScaffolding: enhancedTask?.metadata?.requiresScaffolding || (height && height > SCAFFOLDING_HEIGHT_THRESHOLD),
    complexity: template?.difficulty || "medium"
  });

  const milestones = generateMilestones(buildPhases, estimatedDuration);
  const criticalPath = determineCriticalPath(buildPhases);
  const parallelWork = calculateParallelWork(buildPhases);

  // Assess safety risks and generate recommendations
  const safetyRisk = assessSafetyRisk({
    height: height || (dimensions?.height) || 0,
    environment: enhancedTask?.metadata?.environment || "overworld",
    terrain: terrainProfile?.name || enhancedTask?.metadata?.terrain,
    weather: enhancedTask?.metadata?.weather,
    hasMobs: enhancedTask?.metadata?.threatLevel !== "none",
    proximity: {
      void: terrainProfile?.name?.includes("end") || terrainProfile?.name?.includes("ravine"),
      lava: terrainProfile?.name?.includes("nether") || enhancedTask?.metadata?.environment === "nether"
    }
  });

  const safetyRecommendations = generateSafetyRecommendations(safetyRisk, {
    height: height || (dimensions?.height) || 0,
    environment: enhancedTask?.metadata?.environment || "overworld",
    terrain: terrainProfile?.name || enhancedTask?.metadata?.terrain,
    weather: enhancedTask?.metadata?.weather
  });

  // Get fall protection recommendations
  const fallProtection = getRecommendedFallProtection(
    height || (dimensions?.height) || 0,
    enhancedTask?.metadata?.environment || "overworld"
  );

  // Validate build plan comprehensively
  const validation = BUILDING_VALIDATOR.validateBuildPlan(
    {
      dimensions,
      materials: materialRequirements,
      estimatedDuration,
      interior: enhancedTask?.metadata?.interior !== false,
      roofStyle: enhancedTask?.metadata?.roofStyle || template?.roofStyle || "flat"
    },
    {
      environment: enhancedTask?.metadata?.environment || "overworld",
      biome: enhancedTask?.metadata?.biome || terrainProfile?.name || "plains",
      yPosition: enhancedTask?.metadata?.yPosition || context.yPosition || 64
    }
  );

  // Calculate comprehensive build costs
  const costEstimate = COST_ESTIMATOR.calculateBuildCost(
    {
      materials: materialRequirements,
      estimatedDuration,
      difficulty: template?.difficulty || "medium",
      environment: enhancedTask?.metadata?.environment || "overworld"
    },
    {
      tools: toolChecklist.map(name => ({ name })),
      potions: terrainProfile?.potions || [],
      skillLevel: template?.difficulty || "basic",
      environment: enhancedTask?.metadata?.environment || "overworld"
    }
  );

  // Check budget if provided
  const budget = enhancedTask?.metadata?.budget || context.budget;
  const budgetComparison = budget ? COST_ESTIMATOR.compareToBudget(costEstimate.total, budget) : null;

  // Get cost optimization suggestions
  const costOptimizations = COST_ESTIMATOR.suggestOptimizations(costEstimate);

  const notes = [];

  // Add template usage note
  if (template) {
    notes.push(`Using template: ${template.name} (${template.category}).`);
  }

  // Add terrain profile notes
  if (terrainProfile) {
    notes.push(`Terrain: ${terrainProfile.name} (${terrainProfile.difficulty} difficulty, ${terrainProfile.preparation} preparation).`);

    if (terrainProfile.considerations && terrainProfile.considerations.length > 0) {
      notes.push(`Terrain considerations: ${terrainProfile.considerations.join(', ')}.`);
    }

    if (terrainClearanceTime > 0) {
      const clearanceMinutes = Math.ceil(terrainClearanceTime / 60000);
      notes.push(`Estimated terrain clearance time: ${clearanceMinutes} minutes.`);
    }

    if (terrainTimeMultiplier !== 1.0) {
      const percentChange = Math.round((terrainTimeMultiplier - 1.0) * 100);
      if (percentChange > 0) {
        notes.push(`Terrain increases build time by ${percentChange}%.`);
      } else {
        notes.push(`Terrain reduces build time by ${Math.abs(percentChange)}%.`);
      }
    }

    if (terrainProfile.potions && terrainProfile.potions.length > 0) {
      notes.push(`Required potions: ${terrainProfile.potions.join(', ')}.`);
    }
  }

  if (orientation) {
    notes.push(`Align entrance toward ${orientation}.`);
  }
  if (enhancedTask?.metadata?.deadline) {
    notes.push(`Requested completion before ${enhancedTask?.metadata?.deadline}.`);
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

  // Add template features as notes
  if (template && template.features && template.features.length > 0) {
    notes.push(`Key features: ${template.features.join(', ')}.`);
  }

  // Add progressive build information
  if (buildPhases && buildPhases.length > 0) {
    const phaseCount = buildPhases.length;
    const criticalPhaseCount = buildPhases.filter(p => p.criticalPath).length;
    notes.push(`Build divided into ${phaseCount} phases (${criticalPhaseCount} on critical path).`);

    // Add critical path summary
    if (criticalPath && criticalPath.length > 0) {
      const criticalPhaseNames = criticalPath
        .map(key => buildPhases.find(p => p.key === key)?.name)
        .filter(Boolean)
        .slice(0, 3); // First 3 for brevity
      notes.push(`Critical path: ${criticalPhaseNames.join(' → ')}${criticalPath.length > 3 ? '...' : ''}.`);
    }

    // Add parallel work opportunities
    if (parallelWork && parallelWork.length > 0) {
      notes.push(`${parallelWork.length} opportunities for parallel work to reduce build time.`);
    }

    // Add key milestones
    const majorMilestones = milestones.filter(m => m.critical && m.type === 'phase_complete').slice(0, 3);
    if (majorMilestones.length > 0) {
      const milestoneText = majorMilestones.map(m => `${m.name} (${m.percentage}%)`).join(', ');
      notes.push(`Key milestones: ${milestoneText}.`);
    }
  }

  // Add safety information
  if (safetyRisk && safetyRisk.level !== "low") {
    notes.push(`Safety Risk Level: ${safetyRisk.level.toUpperCase()} (score: ${safetyRisk.score}).`);

    if (safetyRisk.factors && safetyRisk.factors.length > 0) {
      const topFactors = safetyRisk.factors.slice(0, 2); // Show top 2 risk factors
      notes.push(`Primary risks: ${topFactors.join(', ')}.`);
    }
  }

  if (fallProtection && fallProtection.length > 0) {
    const protectionNames = fallProtection.map(p => p.name).join(', ');
    notes.push(`Recommended fall protection: ${protectionNames}.`);
  }

  if (safetyRecommendations && safetyRecommendations.length > 0) {
    const criticalRecs = safetyRecommendations.filter(r => r.priority === "critical" || r.priority === "high");
    if (criticalRecs.length > 0) {
      notes.push(`${criticalRecs.length} critical safety recommendations - review before starting.`);
    }
  }

  // Add validation results to risks and notes
  if (validation) {
    // Add validation errors as critical risks
    if (validation.errors && validation.errors.length > 0) {
      risks.push(...validation.errors.map(err => `VALIDATION ERROR: ${err}`));
    }

    // Add validation summary note
    if (!validation.valid) {
      notes.push(`BUILD VALIDATION FAILED: ${validation.summary.totalErrors} error(s) found.`);
    } else if (validation.warnings && validation.warnings.length > 0) {
      notes.push(`Build validation passed with ${validation.warnings.length} warning(s).`);
    } else {
      notes.push(`Build validation: PASSED (no issues).`);
    }

    // Add key warnings as notes
    if (validation.warnings && validation.warnings.length > 0) {
      const topWarnings = validation.warnings.slice(0, 3); // Show top 3 warnings
      topWarnings.forEach(warning => {
        notes.push(`Warning: ${warning}`);
      });

      if (validation.warnings.length > 3) {
        notes.push(`...and ${validation.warnings.length - 3} more warning(s).`);
      }
    }

    // Add validation summary details
    if (validation.validationResults) {
      const { dimensions: dimVal, materials: matVal, worldLimits: worldVal } = validation.validationResults;

      if (dimVal && dimVal.volume) {
        notes.push(`Validated volume: ${dimVal.volume.toLocaleString()} blocks.`);
      }

      if (matVal && matVal.sufficiencyRatio) {
        const percentage = Math.round(matVal.sufficiencyRatio * 100);
        if (percentage >= 100) {
          notes.push(`Material sufficiency: ${percentage}% (adequate).`);
        } else if (percentage >= 90) {
          notes.push(`Material sufficiency: ${percentage}% (tight but adequate).`);
        }
      }

      if (worldVal && worldVal.clearanceAbove !== undefined && worldVal.clearanceBelow !== undefined) {
        notes.push(`Height clearance: ${worldVal.clearanceBelow} blocks below, ${worldVal.clearanceAbove} blocks above.`);
      }
    }
  }

  // Add cost estimate notes
  if (costEstimate) {
    notes.push(`Estimated total cost: ${costEstimate.total.toFixed(2)} emeralds.`);

    // Add cost breakdown
    const breakdown = [];
    if (costEstimate.breakdown.materials > 0) {
      breakdown.push(`materials: ${costEstimate.breakdown.materials.toFixed(2)}`);
    }
    if (costEstimate.breakdown.labor > 0) {
      breakdown.push(`labor: ${costEstimate.breakdown.labor.toFixed(2)}`);
    }
    if (costEstimate.breakdown.tools > 0) {
      breakdown.push(`tools: ${costEstimate.breakdown.tools.toFixed(2)}`);
    }
    if (costEstimate.breakdown.consumables > 0) {
      breakdown.push(`consumables: ${costEstimate.breakdown.consumables.toFixed(2)}`);
    }

    if (breakdown.length > 0) {
      notes.push(`Cost breakdown: ${breakdown.join(', ')} emeralds.`);
    }

    // Add labor details
    if (costEstimate.labor && costEstimate.labor.hours > 0) {
      notes.push(`Labor: ${costEstimate.labor.hours.toFixed(2)} hours @ ${costEstimate.labor.effectiveRate.toFixed(2)} emeralds/hour.`);
    }

    // Add budget comparison
    if (budgetComparison) {
      if (budgetComparison.status === "over_budget") {
        notes.push(`BUDGET EXCEEDED: ${budgetComparison.percentageUsed}% of budget (over by ${Math.abs(budgetComparison.difference).toFixed(2)} emeralds).`);
      } else if (budgetComparison.status === "tight_budget") {
        notes.push(`Budget tight: ${budgetComparison.percentageUsed}% of ${budget} emerald budget used.`);
      } else if (budgetComparison.status === "within_budget") {
        notes.push(`Within budget: ${budgetComparison.percentageUsed}% of ${budget} emerald budget (${budgetComparison.difference.toFixed(2)} remaining).`);
      } else if (budgetComparison.status === "well_under_budget") {
        notes.push(`Well under budget: ${budgetComparison.percentageUsed}% of ${budget} emerald budget (${budgetComparison.difference.toFixed(2)} remaining).`);
      }
    }

    // Add cost optimization suggestions
    if (costOptimizations && costOptimizations.length > 0) {
      const highPriority = costOptimizations.filter(opt => opt.priority === "high");
      if (highPriority.length > 0) {
        notes.push(`${highPriority.length} high-priority cost optimization(s) available.`);
      }

      // Show top optimization suggestion
      if (costOptimizations[0]) {
        const topOpt = costOptimizations[0];
        notes.push(`Cost tip: ${topOpt.suggestion} (save ~${topOpt.potentialSavings.toFixed(2)} emeralds).`);
      }
    }
  }

  return createPlan({
    task: enhancedTask,
    summary: `Construct ${blueprint} at ${targetDescription}.`,
    steps,
    estimatedDuration,
    resources,
    risks,
    notes,
    // Add progressive build metadata
    buildPhases,
    milestones,
    criticalPath,
    parallelWork,
    // Add safety metadata
    safetyRisk,
    safetyRecommendations,
    fallProtection,
    // Add validation metadata
    validation,
    // Add cost estimation metadata
    costEstimate,
    budgetComparison,
    costOptimizations
  });
}
