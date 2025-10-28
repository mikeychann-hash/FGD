// tasks/plan_climb.js
// Ladder, vine, and vertical movement system
// Implements climbing mechanics for ladders, vines, scaffolding, and other vertical traversal

import {
  createPlan,
  createStep,
  describeTarget,
  normalizeItemName,
  hasInventoryItem
} from "./helpers.js";

/* =====================================================
 * CLIMBABLE BLOCKS DATABASE
 * All climbable surfaces and their properties
 * ===================================================== */

const CLIMBABLE_TYPES = {
  // Ladders
  ladder: {
    type: "ladder",
    climbSpeed: 0.15, // blocks per tick (3 blocks/second)
    requiresSupport: true,
    supportSide: "back", // Must be placed against a wall
    waterloggable: true,
    stackSize: 64,
    crafting: {
      materials: ["stick"],
      quantity: { sticks: 7 },
      yield: 3
    }
  },

  // Vines (natural climbing)
  vine: {
    type: "vine",
    climbSpeed: 0.15,
    requiresSupport: false, // Can hang freely
    supportSide: "any", // Can attach to any side
    waterloggable: true,
    natural: true,
    spreads: true,
    stackSize: 64
  },

  // Weeping vines (Nether - grows downward)
  weeping_vines: {
    type: "vine",
    climbSpeed: 0.15,
    requiresSupport: false,
    supportSide: "top", // Grows from ceiling
    direction: "downward",
    dimension: "nether",
    natural: true,
    stackSize: 64
  },

  // Twisting vines (Nether - grows upward)
  twisting_vines: {
    type: "vine",
    climbSpeed: 0.15,
    requiresSupport: false,
    supportSide: "bottom", // Grows from floor
    direction: "upward",
    dimension: "nether",
    natural: true,
    stackSize: 64
  },

  // Scaffolding (temporary climbing structure)
  scaffolding: {
    type: "scaffolding",
    climbSpeed: 0.2, // Faster than ladders
    requiresSupport: false, // Self-supporting up to 6 blocks
    maxUnsupportedHeight: 6,
    waterloggable: true,
    quickDescend: true, // Sneak to descend quickly
    stackSize: 64,
    crafting: {
      materials: ["bamboo", "string"],
      quantity: { bamboo: 6, string: 1 },
      yield: 6
    }
  }
};

/* =====================================================
 * CLIMBING SYSTEM CONFIGURATION
 * Rules and mechanics for vertical movement
 * ===================================================== */

const CLIMB_CONFIG = {
  // Movement speeds (blocks per second)
  speeds: {
    climbing_up: 2.35, // Normal ladder climb
    climbing_down: 2.35,
    holding_position: 0, // Not moving on ladder
    jump_off: 0.42, // Horizontal jump speed from ladder
    scaffolding_up: 2.5,
    scaffolding_down_sneak: 6.0, // Fast descent with sneak
    water_column_up: 3.5, // Soul sand bubble column
    water_column_down: 13.0 // Magma block bubble column
  },

  // Stamina and exhaustion
  exhaustion: {
    climbing_per_block: 0.01, // Very low exhaustion
    jumping_off: 0.05
  },

  // Safety and fall protection
  safety: {
    maxSafeClimbHeight: 64, // blocks
    fallDamageIfLetGo: true,
    recommendedSafetyMeasures: [
      "water_bucket_landing",
      "hay_bale_landing",
      "slime_block_landing"
    ]
  },

  // Placement rules
  placement: {
    ladder: {
      requiresWall: true,
      minWallHeight: 1,
      canPlaceOnFence: true,
      canPlaceOnSlab: false
    },
    vine: {
      requiresWall: false,
      canSpreadHorizontally: true,
      canSpreadVertically: true,
      growthRate: "random"
    },
    scaffolding: {
      requiresWall: false,
      autoStacks: true,
      maxStackHeight: 64,
      breaksFromBottom: true, // Destroys all above when bottom removed
      supportRange: 6 // Horizontal distance from support
    }
  },

  // Alternative vertical movement
  alternatives: {
    water_column: {
      upward: {
        method: "soul_sand_bubble_column",
        speed: 3.5,
        materials: ["soul_sand", "water_bucket", "kelp"]
      },
      downward: {
        method: "magma_block_bubble_column",
        speed: 13.0,
        materials: ["magma_block", "water_bucket", "kelp"],
        damage: true,
        damagePerSecond: 1
      }
    },
    elytra: {
      method: "riptide_trident_firework_boost",
      speed: 20.0, // Very fast but requires items
      materials: ["elytra", "firework_rocket"],
      durability: true
    },
    piston_elevator: {
      method: "redstone_piston_flying_machine",
      speed: 1.5,
      materials: ["piston", "slime_block", "redstone", "observer"],
      complexity: "high"
    }
  }
};

/**
 * Get climbable block information
 * @param {string} blockName - Block name
 * @returns {object|null} Climbable info or null
 */
function getClimbableInfo(blockName) {
  const normalized = normalizeItemName(blockName);
  return CLIMBABLE_TYPES[normalized] || null;
}

/**
 * Check if block is climbable
 * @param {string} blockName - Block name
 * @returns {boolean} True if climbable
 */
function isClimbable(blockName) {
  return getClimbableInfo(blockName) !== null;
}

/**
 * Validate ladder placement
 * @param {object} position - Target position {x, y, z}
 * @param {object} worldData - Surrounding block data
 * @returns {object} Placement validation result
 */
function validateLadderPlacement(position, worldData = {}) {
  const validation = {
    valid: true,
    issues: []
  };

  const config = CLIMB_CONFIG.placement.ladder;

  // Check for wall behind placement
  if (config.requiresWall) {
    const wallBlock = worldData.behindBlock || null;

    if (!wallBlock || wallBlock === "air") {
      validation.valid = false;
      validation.issues.push("Ladders require a solid block behind them");
      return validation;
    }

    // Check if wall block is solid enough
    const invalidWallBlocks = ["carpet", "torch", "sign", "banner"];
    if (invalidWallBlocks.some(invalid => wallBlock.includes(invalid))) {
      validation.valid = false;
      validation.issues.push(`Cannot place ladder on ${wallBlock}`);
    }
  }

  // Check space at placement position
  const currentBlock = worldData.currentBlock || "air";
  if (currentBlock !== "air" && currentBlock !== "water") {
    validation.valid = false;
    validation.issues.push(`Position occupied by ${currentBlock}`);
  }

  return validation;
}

/**
 * Validate scaffolding placement
 * @param {object} position - Target position {x, y, z}
 * @param {object} worldData - Surrounding block data
 * @returns {object} Placement validation result
 */
function validateScaffoldingPlacement(position, worldData = {}) {
  const validation = {
    valid: true,
    issues: [],
    warnings: []
  };

  const config = CLIMB_CONFIG.placement.scaffolding;

  // Check if there's support nearby (within 6 blocks horizontally)
  const nearbySupports = worldData.nearbyScaffolding || [];
  const supportDistance = nearbySupports.length > 0
    ? Math.min(...nearbySupports.map(s => s.distance))
    : Infinity;

  if (supportDistance > config.supportRange && !worldData.solidBlockBelow) {
    validation.valid = false;
    validation.issues.push("No support within 6 blocks - scaffolding will fall");
  }

  // Check height from base
  const heightFromBase = worldData.scaffoldingHeightBelow || 0;
  if (heightFromBase >= config.maxStackHeight) {
    validation.valid = false;
    validation.issues.push(`Maximum scaffolding height (${config.maxStackHeight}) reached`);
  }

  // Warnings
  if (supportDistance > config.supportRange - 2) {
    validation.warnings.push(`Scaffolding near edge of support range (${supportDistance}/6 blocks)`);
  }

  return validation;
}

/**
 * Calculate climb duration
 * @param {string} climbableType - Type of climbable
 * @param {number} distance - Vertical distance in blocks
 * @param {string} direction - "up" or "down"
 * @returns {object} Time calculation
 */
function calculateClimbDuration(climbableType, distance, direction = "up") {
  const climbable = getClimbableInfo(climbableType);
  if (!climbable) {
    return { error: "Invalid climbable type" };
  }

  let speed = CLIMB_CONFIG.speeds.climbing_up;

  // Adjust for direction
  if (direction === "down") {
    speed = CLIMB_CONFIG.speeds.climbing_down;
  }

  // Special case for scaffolding
  if (climbable.type === "scaffolding") {
    if (direction === "up") {
      speed = CLIMB_CONFIG.speeds.scaffolding_up;
    } else if (direction === "down") {
      speed = CLIMB_CONFIG.speeds.scaffolding_down_sneak;
    }
  }

  const duration = distance / speed;
  const exhaustion = distance * CLIMB_CONFIG.exhaustion.climbing_per_block;

  return {
    distance,
    direction,
    speed,
    duration, // seconds
    exhaustion,
    climbableType
  };
}

/**
 * Assess vertical route options
 * @param {object} start - Start position {x, y, z}
 * @param {object} end - End position {x, y, z}
 * @param {object} inventory - Current inventory
 * @param {object} worldData - World information
 * @returns {object} Route assessment with options
 */
function assessVerticalRoute(start, end, inventory = {}, worldData = {}) {
  const verticalDistance = Math.abs(end.y - start.y);
  const direction = end.y > start.y ? "up" : "down";

  const assessment = {
    distance: verticalDistance,
    direction,
    options: []
  };

  // Option 1: Ladders
  if (hasInventoryItem(inventory, "ladder")) {
    const ladderCount = inventory.ladder?.count || 0;
    const needed = verticalDistance;

    if (ladderCount >= needed || needed <= 0) {
      const calc = calculateClimbDuration("ladder", verticalDistance, direction);
      assessment.options.push({
        method: "ladder",
        available: true,
        duration: calc.duration,
        materialsNeeded: { ladder: needed },
        materialsAvailable: { ladder: ladderCount },
        difficulty: "easy",
        safety: "high"
      });
    } else {
      assessment.options.push({
        method: "ladder",
        available: false,
        materialsNeeded: { ladder: needed },
        materialsAvailable: { ladder: ladderCount },
        shortfall: needed - ladderCount
      });
    }
  }

  // Option 2: Scaffolding
  if (hasInventoryItem(inventory, "scaffolding")) {
    const scaffoldCount = inventory.scaffolding?.count || 0;
    const needed = verticalDistance;

    if (scaffoldCount >= needed || needed <= 0) {
      const calc = calculateClimbDuration("scaffolding", verticalDistance, direction);
      assessment.options.push({
        method: "scaffolding",
        available: true,
        duration: calc.duration,
        materialsNeeded: { scaffolding: needed },
        materialsAvailable: { scaffolding: scaffoldCount },
        difficulty: "easy",
        safety: "high",
        advantages: ["Faster than ladders", "Easy to remove", "No wall required"]
      });
    }
  }

  // Option 3: Water bucket (for going down)
  if (direction === "down" && hasInventoryItem(inventory, "water_bucket")) {
    assessment.options.push({
      method: "water_bucket_landing",
      available: true,
      duration: 2, // Quick descent with water placement
      materialsNeeded: { water_bucket: 1 },
      materialsAvailable: { water_bucket: 1 },
      difficulty: "medium",
      safety: "high",
      note: "Place water at bottom, fall into it"
    });
  }

  // Option 4: Bubble column (if materials available)
  const hasSoulSand = hasInventoryItem(inventory, "soul_sand");
  const hasMagmaBlock = hasInventoryItem(inventory, "magma_block");
  const hasWaterBucket = hasInventoryItem(inventory, "water_bucket");
  const hasKelp = hasInventoryItem(inventory, "kelp");

  if (direction === "up" && hasSoulSand && hasWaterBucket && hasKelp) {
    assessment.options.push({
      method: "soul_sand_bubble_column",
      available: true,
      duration: verticalDistance / CLIMB_CONFIG.speeds.water_column_up,
      materialsNeeded: { soul_sand: 1, water_bucket: 1, kelp: verticalDistance },
      difficulty: "medium",
      safety: "very_high",
      advantages: ["Fastest upward travel", "No exhaustion", "Hands-free"]
    });
  }

  if (direction === "down" && hasMagmaBlock && hasWaterBucket && hasKelp) {
    assessment.options.push({
      method: "magma_bubble_column",
      available: true,
      duration: verticalDistance / CLIMB_CONFIG.speeds.water_column_down,
      materialsNeeded: { magma_block: 1, water_bucket: 1, kelp: verticalDistance },
      difficulty: "medium",
      safety: "medium",
      warnings: ["Causes damage without protection"],
      note: "Use boat or sneak to avoid damage"
    });
  }

  // Option 5: Vines (if in jungle/natural area)
  if (worldData.biome === "jungle" && worldData.hasNaturalVines) {
    assessment.options.push({
      method: "natural_vines",
      available: true,
      duration: verticalDistance / CLIMB_CONFIG.speeds.climbing_up,
      materialsNeeded: {},
      difficulty: "easy",
      safety: "medium",
      note: "Use existing vines in jungle"
    });
  }

  // Sort options by duration (fastest first)
  assessment.options.sort((a, b) => (a.duration || 999) - (b.duration || 999));

  // Recommend best option
  const bestOption = assessment.options.find(o => o.available);
  if (bestOption) {
    assessment.recommended = bestOption.method;
  } else {
    assessment.recommended = null;
    assessment.suggestion = "Gather materials: ladders (7 sticks = 3 ladders) or scaffolding";
  }

  return assessment;
}

/* =====================================================
 * CLIMB TASK PLANNER
 * Main function for creating climb action plans
 * ===================================================== */

/**
 * Plan climb task
 * @param {object} goal - Task goal with target height/position
 * @param {object} context - Game context (player, inventory, world state)
 * @returns {object} Climb plan
 */
export function planClimbTask(goal = {}, context = {}) {
  const targetPosition = goal.target || goal.position;
  const playerPos = context.playerPosition || { x: 0, y: 0, z: 0 };
  const inventory = context.inventory || {};

  if (!targetPosition || targetPosition.y === undefined) {
    return {
      status: "failed",
      error: "No target position specified"
    };
  }

  const verticalDistance = Math.abs(targetPosition.y - playerPos.y);
  const direction = targetPosition.y > playerPos.y ? "up" : "down";

  const plan = createPlan("climb", `Climb ${direction} ${verticalDistance} blocks`, {
    priority: "normal",
    estimatedDuration: verticalDistance / CLIMB_CONFIG.speeds.climbing_up,
    safety: verticalDistance > 20 ? "high_fall_risk" : "normal"
  });

  // Assess route options
  const assessment = assessVerticalRoute(playerPos, targetPosition, inventory, context.worldData);

  if (!assessment.recommended) {
    plan.status = "blocked";
    plan.error = "No climbing method available";
    plan.suggestion = assessment.suggestion;
    plan.materialsNeeded = assessment.options[0]?.materialsNeeded || { ladder: verticalDistance };
    return plan;
  }

  const chosenMethod = assessment.options.find(o => o.method === assessment.recommended);

  // Build climbing steps based on method
  switch (chosenMethod.method) {
    case "ladder":
      plan.steps.push(createStep(
        "place_ladders",
        `Place ${verticalDistance} ladders on wall`,
        {
          item: "ladder",
          count: verticalDistance,
          placement: "vertical_column",
          requiresWall: true
        }
      ));
      plan.steps.push(createStep(
        "climb_ladders",
        `Climb ${direction} ${verticalDistance} blocks`,
        {
          method: "ladder",
          distance: verticalDistance,
          direction: direction,
          duration: chosenMethod.duration
        }
      ));
      break;

    case "scaffolding":
      plan.steps.push(createStep(
        "place_scaffolding",
        `Place ${verticalDistance} scaffolding blocks`,
        {
          item: "scaffolding",
          count: verticalDistance,
          placement: "vertical_tower",
          requiresWall: false
        }
      ));
      plan.steps.push(createStep(
        "climb_scaffolding",
        `Climb ${direction} ${verticalDistance} blocks`,
        {
          method: "scaffolding",
          distance: verticalDistance,
          direction: direction,
          duration: chosenMethod.duration,
          note: direction === "down" ? "Hold sneak for fast descent" : null
        }
      ));
      if (goal.removeAfter) {
        plan.steps.push(createStep(
          "remove_scaffolding",
          "Remove scaffolding by breaking bottom block",
          {
            item: "scaffolding",
            recoverCount: verticalDistance
          }
        ));
      }
      break;

    case "water_bucket_landing":
      plan.steps.push(createStep(
        "prepare_water",
        "Hold water bucket",
        { item: "water_bucket" }
      ));
      plan.steps.push(createStep(
        "descend_with_water",
        `Fall ${verticalDistance} blocks and place water before landing`,
        {
          method: "water_mlg",
          distance: verticalDistance,
          timing: "critical",
          difficulty: "medium",
          duration: 2
        }
      ));
      break;

    case "soul_sand_bubble_column":
      plan.steps.push(createStep(
        "build_water_column",
        `Create water column with soul sand at bottom`,
        {
          materials: chosenMethod.materialsNeeded,
          height: verticalDistance
        }
      ));
      plan.steps.push(createStep(
        "use_bubble_column",
        `Ride bubble column ${direction} ${verticalDistance} blocks`,
        {
          method: "soul_sand_bubbles",
          distance: verticalDistance,
          duration: chosenMethod.duration,
          advantages: ["Fastest method", "No exhaustion"]
        }
      ));
      break;

    case "natural_vines":
      plan.steps.push(createStep(
        "locate_vines",
        "Find suitable vines",
        { biome: "jungle" }
      ));
      plan.steps.push(createStep(
        "climb_vines",
        `Climb ${direction} using natural vines`,
        {
          method: "vines",
          distance: verticalDistance,
          duration: chosenMethod.duration
        }
      ));
      break;
  }

  // Add safety measures for tall climbs
  if (verticalDistance > 20 && direction === "up") {
    plan.safety = {
      fallRisk: "high",
      recommendations: [
        "Place water bucket at bottom as safety net",
        "Don't look down to avoid dizziness",
        "Hold W key continuously while climbing"
      ]
    };
  }

  plan.outcome = {
    method: chosenMethod.method,
    distance: verticalDistance,
    direction: direction,
    duration: chosenMethod.duration,
    startY: playerPos.y,
    endY: targetPosition.y
  };

  return plan;
}

/**
 * Plan ladder column construction
 * @param {object} goal - Construction specifications
 * @param {object} context - Game context
 * @returns {object} Ladder construction plan
 */
function planLadderConstruction(goal = {}, context = {}) {
  const height = goal.height || 10;
  const position = goal.position || context.playerPosition;
  const inventory = context.inventory || {};

  const plan = createPlan("build_ladder_column", `Construct ${height}-block ladder`, {
    priority: "normal",
    estimatedDuration: height * 0.5,
    complexity: "easy"
  });

  const laddersNeeded = height;
  const laddersAvailable = inventory.ladder?.count || 0;

  if (laddersAvailable < laddersNeeded) {
    plan.status = "blocked";
    plan.error = `Need ${laddersNeeded} ladders, have ${laddersAvailable}`;
    plan.suggestion = `Craft ${Math.ceil((laddersNeeded - laddersAvailable) / 3)} more ladder recipes (7 sticks each)`;
    return plan;
  }

  // Validate wall exists
  const wallCheck = validateLadderPlacement(position, context.worldData);
  if (!wallCheck.valid) {
    plan.status = "blocked";
    plan.error = "Cannot place ladders here";
    plan.issues = wallCheck.issues;
    return plan;
  }

  plan.steps.push(createStep(
    "select_ladders",
    `Select ${laddersNeeded} ladders from inventory`,
    { item: "ladder", count: laddersNeeded }
  ));

  plan.steps.push(createStep(
    "place_ladder_column",
    `Place ${height} ladders vertically on wall`,
    {
      startPosition: position,
      height: height,
      direction: "upward",
      requiresWall: true
    }
  ));

  plan.outcome = {
    structure: "ladder_column",
    height: height,
    laddersUsed: laddersNeeded,
    climbDuration: calculateClimbDuration("ladder", height, "up").duration
  };

  return plan;
}

/* =====================================================
 * EXPORTS
 * ===================================================== */

export default planClimbTask;
export {
  CLIMBABLE_TYPES,
  CLIMB_CONFIG,
  getClimbableInfo,
  isClimbable,
  validateLadderPlacement,
  validateScaffoldingPlacement,
  calculateClimbDuration,
  assessVerticalRoute,
  planLadderConstruction
};
