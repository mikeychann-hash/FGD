// tasks/plan_minecart.js
// Minecart and rail transportation system
// Implements minecart riding, rail networks, powered rails, and automated transportation

import {
  createPlan,
  createStep,
  describeTarget,
  normalizeItemName,
  hasInventoryItem,
  extractInventory
} from "./helpers.js";

/* =====================================================
 * MINECART TYPES DATABASE
 * All minecart variants and their properties
 * ===================================================== */

const MINECART_TYPES = {
  minecart: {
    type: "passenger",
    capacity: 1, // One player or mob
    stackSize: 1,
    speed: {
      unpowered: 0.4, // blocks per tick on flat ground
      powered: 0.4, // blocks per tick on powered rails
      maxSpeed: 8.0 // blocks per second
    },
    durability: Infinity,
    canContainItems: false,
    canContainEntities: true
  },

  chest_minecart: {
    type: "storage",
    capacity: 27, // Same as single chest
    stackSize: 1,
    speed: {
      unpowered: 0.4,
      powered: 0.4,
      maxSpeed: 8.0
    },
    durability: Infinity,
    canContainItems: true,
    canContainEntities: false,
    hopperInteraction: true
  },

  furnace_minecart: {
    type: "powered",
    capacity: 0,
    stackSize: 1,
    speed: {
      unpowered: 0.4,
      powered: 0.4,
      maxSpeed: 4.0, // Slower than powered rails
      fuelBoost: 0.2 // Additional speed when fueled
    },
    durability: Infinity,
    requiresFuel: true,
    fuelTypes: ["coal", "charcoal"],
    fuelDuration: 3, // minutes per coal
    canPush: true // Can push other minecarts
  },

  hopper_minecart: {
    type: "hopper",
    capacity: 5, // Same as hopper
    stackSize: 1,
    speed: {
      unpowered: 0.4,
      powered: 0.4,
      maxSpeed: 8.0
    },
    durability: Infinity,
    canContainItems: true,
    canContainEntities: false,
    autoCollect: true,
    transferRate: 1, // items per 0.4 seconds
    hopperInteraction: true
  },

  tnt_minecart: {
    type: "explosive",
    capacity: 0,
    stackSize: 1,
    speed: {
      unpowered: 0.4,
      powered: 0.4,
      maxSpeed: 8.0
    },
    durability: 1, // Explodes on destruction
    explosive: true,
    explosionPower: 4.0,
    activators: ["activator_rail", "fire", "lava", "explosion", "fall_damage"]
  },

  command_block_minecart: {
    type: "command",
    capacity: 0,
    stackSize: 1,
    speed: {
      unpowered: 0.4,
      powered: 0.4,
      maxSpeed: 8.0
    },
    durability: Infinity,
    requiresOp: true,
    activators: ["activator_rail"],
    commandExecution: true
  }
};

/* =====================================================
 * RAIL TYPES DATABASE
 * All rail variants and their properties
 * ===================================================== */

const RAIL_TYPES = {
  rail: {
    type: "normal",
    powered: false,
    stackSize: 64,
    maxSlope: 1, // Can go up/down 1 block
    turnRadius: 1, // 90-degree turns
    speedModifier: 1.0,
    crafting: {
      materials: ["iron_ingot", "stick"],
      yield: 16
    }
  },

  powered_rail: {
    type: "powered",
    powered: true,
    stackSize: 64,
    maxSlope: 1,
    turnRadius: 0, // Cannot turn (straight only)
    speedModifier: 1.0,
    acceleration: 0.06, // blocks per tick when powered
    requiresRedstone: true,
    powerRange: 9, // blocks from power source
    crafting: {
      materials: ["gold_ingot", "stick", "redstone_dust"],
      yield: 6
    }
  },

  detector_rail: {
    type: "detector",
    powered: false,
    stackSize: 64,
    maxSlope: 1,
    turnRadius: 0,
    speedModifier: 1.0,
    detectsMinecarts: true,
    outputPower: 15,
    outputDuration: 0.2, // seconds (4 ticks)
    crafting: {
      materials: ["iron_ingot", "stone_pressure_plate", "redstone_dust"],
      yield: 6
    }
  },

  activator_rail: {
    type: "activator",
    powered: true,
    stackSize: 64,
    maxSlope: 1,
    turnRadius: 0,
    speedModifier: 1.0,
    requiresRedstone: true,
    activates: ["hopper_minecart", "tnt_minecart", "command_block_minecart"],
    effects: {
      hopper_minecart: "disable_hopper",
      tnt_minecart: "prime_tnt",
      command_block_minecart: "execute_command",
      player: "eject"
    },
    crafting: {
      materials: ["iron_ingot", "stick", "redstone_torch"],
      yield: 6
    }
  }
};

/* =====================================================
 * MINECART SYSTEM CONFIGURATION
 * Rules and mechanics for minecart transportation
 * ===================================================== */

const MINECART_CONFIG = {
  // Movement mechanics
  movement: {
    maxSpeed: 8.0, // blocks per second on powered rails
    friction: 0.95, // Velocity multiplier per tick
    gravityAcceleration: 0.04, // Downhill acceleration
    uphillSlowdown: 0.08, // Uphill deceleration
    turnSpeed: 0.7, // Speed on curves (70% of straight)
    minPushSpeed: 0.1 // Minimum speed to push another cart
  },

  // Powered rail mechanics
  poweredRails: {
    accelerationRate: 0.06, // blocks/tick added when powered
    maxBoostSpeed: 8.0,
    powerSpacing: {
      flat: 38, // blocks between powered rails on flat
      uphill: 1, // Every block needs power going uphill
      optimal: 8 // Optimal spacing for speed/cost balance
    },
    powerSources: ["redstone_torch", "lever", "redstone_block", "detector_rail"]
  },

  // Station mechanics
  stations: {
    types: {
      loading: "Player/items enter minecart",
      unloading: "Player/items exit minecart",
      junction: "Rails split to multiple destinations",
      booster: "Speed boost station"
    },
    components: {
      loading: ["powered_rail", "button", "lever"],
      unloading: ["powered_rail", "activator_rail"],
      junction: ["detector_rail", "powered_rail", "lever"],
      booster: ["powered_rail", "redstone_block"]
    }
  },

  // Safety mechanics
  safety: {
    collisionDamage: true,
    maxCollisionSpeed: 4.0, // blocks/sec before damage
    derailmentCauses: ["missing_rail", "destroyed_rail", "entity_collision"],
    entityCollision: {
      player: "damage_both",
      mob: "damage_both",
      minecart: "transfer_momentum"
    }
  },

  // Network planning
  network: {
    maxDistance: 1000, // Practical max for single route
    recommendedStationDistance: 100-200, // blocks
    junctionTypes: ["T_junction", "cross_junction", "roundabout"],
    signaling: ["detector_rail", "comparator", "hopper_clock"]
  }
};

/**
 * Get minecart type info
 * @param {string} minecartType - Minecart type
 * @returns {object|null} Minecart info or null
 */
function getMinecartInfo(minecartType) {
  const normalized = normalizeItemName(minecartType);
  return MINECART_TYPES[normalized] || null;
}

/**
 * Get rail type info
 * @param {string} railType - Rail type
 * @returns {object|null} Rail info or null
 */
function getRailInfo(railType) {
  const normalized = normalizeItemName(railType);
  return RAIL_TYPES[normalized] || null;
}

/**
 * Check if item is a minecart
 * @param {string} itemName - Item name
 * @returns {boolean} True if minecart
 */
function isMinecart(itemName) {
  return getMinecartInfo(itemName) !== null;
}

/**
 * Check if item is a rail
 * @param {string} itemName - Item name
 * @returns {boolean} True if rail
 */
function isRail(itemName) {
  return getRailInfo(itemName) !== null;
}

/**
 * Calculate powered rail requirements
 * @param {number} distance - Track distance in blocks
 * @param {object} terrain - Terrain profile
 * @returns {object} Rail requirements
 */
function calculateRailRequirements(distance, terrain = {}) {
  const elevation = terrain.elevation || 0; // Net elevation change
  const uphillSections = terrain.uphillBlocks || 0;
  const downhillSections = terrain.downhillBlocks || 0;
  const flatSections = distance - uphillSections - downhillSections;

  // Calculate powered rail needs
  let poweredRailsNeeded = 0;

  // Uphill: every block needs powered rail
  poweredRailsNeeded += uphillSections;

  // Flat: one powered rail every 38 blocks (or 8 for optimal)
  const flatSpacing = terrain.optimal ? MINECART_CONFIG.poweredRails.powerSpacing.optimal :
                                        MINECART_CONFIG.poweredRails.powerSpacing.flat;
  poweredRailsNeeded += Math.ceil(flatSections / flatSpacing);

  // Downhill: minimal powered rails needed
  poweredRailsNeeded += Math.ceil(downhillSections / 38);

  // Calculate regular rails
  const regularRailsNeeded = distance - poweredRailsNeeded;

  // Calculate materials
  const ironIngots = Math.ceil(regularRailsNeeded / 16) * 6; // 6 iron per 16 rails
  const goldIngots = Math.ceil(poweredRailsNeeded / 6) * 6; // 6 gold per 6 powered rails
  const sticks = Math.ceil(distance / 16); // 1 stick per 16 rails
  const redstoneDust = Math.ceil(poweredRailsNeeded / 6) * 1; // 1 redstone per 6 powered rails

  return {
    distance,
    elevation,
    regularRails: regularRailsNeeded,
    poweredRails: poweredRailsNeeded,
    totalRails: distance,
    materials: {
      iron_ingot: ironIngots,
      gold_ingot: goldIngots,
      stick: sticks,
      redstone_dust: redstoneDust
    },
    estimatedCost: {
      iron: ironIngots,
      gold: goldIngots,
      totalValue: `${ironIngots} iron + ${goldIngots} gold`
    }
  };
}

/**
 * Calculate travel time
 * @param {number} distance - Distance in blocks
 * @param {object} options - Travel options
 * @returns {object} Travel time calculation
 */
function calculateTravelTime(distance, options = {}) {
  const poweredRailSpacing = options.poweredRailSpacing || 8;
  const uphillBlocks = options.uphillBlocks || 0;
  const downhillBlocks = options.downhillBlocks || 0;

  // Average speed calculation (simplified)
  const avgSpeed = MINECART_CONFIG.movement.maxSpeed * 0.8; // 80% of max due to acceleration/deceleration
  const travelTime = distance / avgSpeed;

  return {
    distance,
    averageSpeed: avgSpeed,
    maxSpeed: MINECART_CONFIG.movement.maxSpeed,
    travelTime: travelTime, // seconds
    travelTimeFormatted: `${Math.floor(travelTime / 60)}m ${Math.floor(travelTime % 60)}s`
  };
}

/**
 * Design minecart station
 * @param {string} stationType - Type of station
 * @param {object} requirements - Station requirements
 * @returns {object} Station design
 */
function designMinecartStation(stationType, requirements = {}) {
  const stationTypes = MINECART_CONFIG.stations.types;
  const components = MINECART_CONFIG.stations.components;

  if (!stationTypes[stationType]) {
    return {
      error: "Unknown station type",
      availableTypes: Object.keys(stationTypes)
    };
  }

  const design = {
    type: stationType,
    description: stationTypes[stationType],
    components: components[stationType] || [],
    dimensions: null,
    buildSteps: []
  };

  switch (stationType) {
    case "loading":
      design.dimensions = { width: 3, length: 5, height: 3 };
      design.buildSteps = [
        "Place powered rails at loading position",
        "Add button or lever next to rails for activation",
        "Build platform for player access",
        "Add redstone torch underneath for constant power (optional)",
        "Place minecart on rails"
      ];
      design.materials = {
        powered_rail: 3,
        button: 1,
        building_blocks: 15,
        redstone_torch: 1
      };
      break;

    case "unloading":
      design.dimensions = { width: 3, length: 5, height: 3 };
      design.buildSteps = [
        "Place powered rails leading to station",
        "Add unpowered powered rails to stop minecart",
        "Place activator rail to eject passenger (optional)",
        "Build platform for player exit",
        "Add storage for minecart (optional)"
      ];
      design.materials = {
        powered_rail: 5,
        activator_rail: 1,
        building_blocks: 15
      };
      break;

    case "junction":
      design.dimensions = { width: 5, length: 7, height: 3 };
      design.buildSteps = [
        "Place detector rail before junction",
        "Build rail split using regular rails",
        "Add powered rails on each branch",
        "Install levers to control rail direction",
        "Add redstone wiring from detector to levers",
        "Test both paths"
      ];
      design.materials = {
        rail: 10,
        powered_rail: 6,
        detector_rail: 2,
        lever: 2,
        redstone_dust: 10,
        building_blocks: 20
      };
      design.complexity = "medium";
      break;

    case "booster":
      design.dimensions = { width: 1, length: 8, height: 2 };
      design.buildSteps = [
        "Place 8 powered rails in a line",
        "Place redstone block underneath middle rail",
        "Power will spread to all 8 rails",
        "Minecart will reach max speed"
      ];
      design.materials = {
        powered_rail: 8,
        redstone_block: 1
      };
      design.speedBoost = "Accelerates to 8 blocks/second";
      break;
  }

  return design;
}

/**
 * Plan rail network route
 * @param {object} start - Start position
 * @param {object} end - End position
 * @param {object} options - Route options
 * @returns {object} Route plan
 */
function planRailRoute(start, end, options = {}) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;

  const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
  const totalDistance = Math.ceil(horizontalDistance);
  const elevation = dy;

  // Determine terrain profile
  const uphillBlocks = elevation > 0 ? Math.abs(elevation) : 0;
  const downhillBlocks = elevation < 0 ? Math.abs(elevation) : 0;

  const terrain = {
    elevation,
    uphillBlocks,
    downhillBlocks,
    optimal: options.optimal !== false
  };

  const railReqs = calculateRailRequirements(totalDistance, terrain);
  const travelTime = calculateTravelTime(totalDistance, {
    uphillBlocks,
    downhillBlocks
  });

  return {
    start,
    end,
    distance: totalDistance,
    elevation,
    railRequirements: railReqs,
    travelTime,
    stations: {
      start: { type: "loading", position: start },
      end: { type: "unloading", position: end }
    },
    recommendations: [
      elevation > 0 ? "Route goes uphill - requires more powered rails" : null,
      elevation < 0 ? "Route goes downhill - use brakes at destination" : null,
      totalDistance > 500 ? "Long route - consider mid-point station" : null,
      options.optimal ? "Using optimal powered rail spacing (every 8 blocks)" : "Using minimal powered rails (every 38 blocks)"
    ].filter(Boolean)
  };
}

/* =====================================================
 * MINECART TASK PLANNER
 * Main function for creating minecart action plans
 * ===================================================== */

/**
 * Plan minecart ride task
 * @param {object} goal - Task goal with destination
 * @param {object} context - Game context
 * @returns {object} Minecart ride plan
 */
export function planMinecartTask(goal = {}, context = {}) {
  const destination = goal.destination || goal.target;
  const minecartType = goal.minecart || "minecart";
  const playerPos = context.playerPosition || { x: 0, y: 0, z: 0 };
  const inventory = context.inventory || {};

  if (!destination) {
    return {
      status: "failed",
      error: "No destination specified for minecart ride"
    };
  }

  const minecart = getMinecartInfo(minecartType);
  if (!minecart) {
    return {
      status: "failed",
      error: `Invalid minecart type: ${minecartType}`,
      suggestion: "Try: minecart, chest_minecart, hopper_minecart"
    };
  }

  const plan = createPlan("ride_minecart", `Ride minecart to ${describeTarget(destination)}`, {
    priority: "normal",
    estimatedDuration: 60,
    safety: "normal"
  });

  // Check if player has minecart
  if (!hasInventoryItem(inventory, minecartType)) {
    plan.status = "blocked";
    plan.error = `No ${minecartType} in inventory`;
    plan.suggestion = `Craft ${minecartType} (5 iron ingots)`;
    return plan;
  }

  // Calculate route
  const route = planRailRoute(playerPos, destination, { optimal: true });

  // Build riding steps

  // Step 1: Place minecart on rails
  plan.steps.push(createStep(
    "place_minecart",
    `Place ${minecartType} on rails`,
    {
      item: minecartType,
      requiresRails: true
    }
  ));

  // Step 2: Enter minecart
  plan.steps.push(createStep(
    "enter_minecart",
    "Right-click minecart to enter",
    {
      action: "right_click",
      controls: {
        forward: "W key to accelerate",
        backward: "S key to brake",
        exit: "Shift to exit"
      }
    }
  ));

  // Step 3: Travel to destination
  plan.steps.push(createStep(
    "travel",
    `Travel ${route.distance} blocks to destination`,
    {
      distance: route.distance,
      travelTime: route.travelTime.travelTime,
      averageSpeed: route.travelTime.averageSpeed
    }
  ));

  // Step 4: Exit minecart
  plan.steps.push(createStep(
    "exit_minecart",
    "Exit minecart at destination",
    {
      action: "press_shift",
      collectMinecart: true
    }
  ));

  plan.outcome = {
    minecartType,
    destination,
    route,
    travelTime: route.travelTime.travelTimeFormatted
  };

  return plan;
}

/**
 * Plan rail construction
 * @param {object} goal - Construction goal
 * @param {object} context - Game context
 * @returns {object} Rail construction plan
 */
function planRailConstruction(goal = {}, context = {}) {
  const start = goal.start || context.playerPosition;
  const end = goal.end || goal.destination;
  const inventory = context.inventory || {};

  if (!start || !end) {
    return {
      status: "failed",
      error: "Need both start and end positions for rail construction"
    };
  }

  const route = planRailRoute(start, end, { optimal: goal.optimal !== false });
  const plan = createPlan("build_rail_network", `Build ${route.distance}-block rail line`, {
    priority: "normal",
    estimatedDuration: route.distance * 2, // 2 seconds per block
    complexity: route.elevation !== 0 ? "medium" : "easy"
  });

  // Check materials
  const materials = route.railRequirements.materials;
  const missing = [];

  for (const [item, count] of Object.entries(materials)) {
    if (!hasInventoryItem(inventory, item) || (inventory[item]?.count || 0) < count) {
      missing.push(`${item}: need ${count}, have ${inventory[item]?.count || 0}`);
    }
  }

  if (missing.length > 0) {
    plan.status = "blocked";
    plan.error = "Insufficient materials";
    plan.missingMaterials = missing;
    plan.materialSummary = route.railRequirements.materials;
    return plan;
  }

  // Build construction steps
  plan.steps.push(createStep(
    "build_loading_station",
    "Build loading station at start",
    {
      station: designMinecartStation("loading"),
      position: start
    }
  ));

  plan.steps.push(createStep(
    "lay_rails",
    `Lay ${route.distance} blocks of rails`,
    {
      regularRails: route.railRequirements.regularRails,
      poweredRails: route.railRequirements.poweredRails,
      spacing: "powered rail every 8 blocks"
    }
  ));

  if (route.elevation > 0) {
    plan.steps.push(createStep(
      "place_uphill_powered_rails",
      `Place powered rails for ${route.elevation}-block climb`,
      {
        uphillBlocks: route.railRequirements.elevation,
        note: "Every uphill block needs a powered rail"
      }
    ));
  }

  plan.steps.push(createStep(
    "add_redstone_power",
    "Add redstone power sources",
    {
      redstoneTorches: Math.ceil(route.railRequirements.poweredRails / 9),
      placement: "underneath or beside powered rails"
    }
  ));

  plan.steps.push(createStep(
    "build_unloading_station",
    "Build unloading station at destination",
    {
      station: designMinecartStation("unloading"),
      position: end
    }
  ));

  plan.steps.push(createStep(
    "test_route",
    "Test minecart route",
    {
      testRide: true,
      checkSpeed: true
    }
  ));

  plan.outcome = {
    routeLength: route.distance,
    elevation: route.elevation,
    travelTime: route.travelTime.travelTimeFormatted,
    materialsUsed: route.railRequirements.materials
  };

  return plan;
}

/* =====================================================
 * EXPORTS
 * ===================================================== */

export default planMinecartTask;
export {
  MINECART_TYPES,
  RAIL_TYPES,
  MINECART_CONFIG,
  getMinecartInfo,
  getRailInfo,
  isMinecart,
  isRail,
  calculateRailRequirements,
  calculateTravelTime,
  designMinecartStation,
  planRailRoute,
  planRailConstruction
};
