// tasks/plan_sleep.js
// Bed and sleep mechanics system
// Implements sleeping, respawn points, phantom prevention, and time skipping

import {
  createPlan,
  createStep,
  describeTarget,
  normalizeItemName,
  extractInventory,
  hasInventoryItem
} from "./helpers.js";

/* =====================================================
 * BED DATABASE
 * All bed types and their properties
 * ===================================================== */

const BED_TYPES = {
  white_bed: { color: "white", durability: Infinity, stackSize: 1 },
  orange_bed: { color: "orange", durability: Infinity, stackSize: 1 },
  magenta_bed: { color: "magenta", durability: Infinity, stackSize: 1 },
  light_blue_bed: { color: "light_blue", durability: Infinity, stackSize: 1 },
  yellow_bed: { color: "yellow", durability: Infinity, stackSize: 1 },
  lime_bed: { color: "lime", durability: Infinity, stackSize: 1 },
  pink_bed: { color: "pink", durability: Infinity, stackSize: 1 },
  gray_bed: { color: "gray", durability: Infinity, stackSize: 1 },
  light_gray_bed: { color: "light_gray", durability: Infinity, stackSize: 1 },
  cyan_bed: { color: "cyan", durability: Infinity, stackSize: 1 },
  purple_bed: { color: "purple", durability: Infinity, stackSize: 1 },
  blue_bed: { color: "blue", durability: Infinity, stackSize: 1 },
  brown_bed: { color: "brown", durability: Infinity, stackSize: 1 },
  green_bed: { color: "green", durability: Infinity, stackSize: 1 },
  red_bed: { color: "red", durability: Infinity, stackSize: 1 },
  black_bed: { color: "black", durability: Infinity, stackSize: 1 }
};

/* =====================================================
 * SLEEP SYSTEM CONFIGURATION
 * Rules and mechanics for sleeping
 * ===================================================== */

const SLEEP_CONFIG = {
  // Time requirements (in ticks, 20 ticks = 1 second)
  timeOfDay: {
    sleepableStart: 12541, // Sunset (tick 12541)
    sleepableEnd: 23458, // Sunrise (tick 23458)
    thunderstormOverride: true // Can sleep during storms regardless of time
  },

  // Sleep duration and effects
  duration: {
    sleepTime: 100, // Ticks to complete sleep (5 seconds)
    wakeUpDelay: 20 // Ticks after waking (1 second)
  },

  // Phantom spawning prevention
  phantoms: {
    spawnThreshold: 3, // Days without sleep before phantoms spawn
    resetOnSleep: true, // Reset counter when sleeping
    trackInStatistics: true
  },

  // Respawn mechanics
  respawn: {
    setOnSleep: true, // Set respawn point when sleeping
    requiresClaim: false, // No claiming needed (unlike multiplayer)
    preserveOnDeath: true,
    showMessage: true,
    message: "Respawn point set"
  },

  // Sleep requirements
  requirements: {
    proximityCheck: {
      enabled: true,
      radius: 8, // blocks
      verticalRadius: 5, // blocks
      checkHostileMobs: true,
      allowedMobs: ["villager", "iron_golem", "cat", "chicken", "cow", "pig", "sheep"]
    },
    dimensionCheck: {
      enabled: true,
      allowedDimensions: ["overworld"], // Cannot sleep in Nether or End
      netherBehavior: "explode",
      endBehavior: "explode",
      explosionPower: 5.0
    },
    bedAccess: {
      requireUnobstructed: true,
      minHeightClearance: 2, // blocks above bed
      checkSuffocation: true
    }
  },

  // Multiplayer considerations
  multiplayer: {
    enabled: false, // Set to true for multiplayer
    percentRequired: 50, // % of players needed to sleep (can be adjusted)
    skipNightWhenMet: true,
    notifyPlayers: true,
    playerSleepingMessage: "{player} is now sleeping"
  }
};

/**
 * Check if item is a bed
 * @param {string} itemName - Item name
 * @returns {boolean} True if item is a bed
 */
function isBed(itemName) {
  const normalized = normalizeItemName(itemName);
  return BED_TYPES[normalized] !== undefined;
}

/**
 * Get bed type information
 * @param {string} bedName - Bed name
 * @returns {object|null} Bed info or null
 */
function getBedInfo(bedName) {
  const normalized = normalizeItemName(bedName);
  return BED_TYPES[normalized] || null;
}

/**
 * Check if it's the right time to sleep
 * @param {number} timeOfDay - Current time of day (0-24000 ticks)
 * @param {boolean} isThunderstorm - Whether it's currently a thunderstorm
 * @returns {object} Time check result
 */
function canSleepAtTime(timeOfDay, isThunderstorm = false) {
  const config = SLEEP_CONFIG.timeOfDay;

  // Thunderstorms allow sleeping anytime
  if (isThunderstorm && config.thunderstormOverride) {
    return {
      canSleep: true,
      reason: "thunderstorm",
      message: "You can sleep during thunderstorms"
    };
  }

  // Check if time is within sleeping hours
  const inSleepWindow = timeOfDay >= config.sleepableStart || timeOfDay <= config.sleepableEnd;

  if (inSleepWindow) {
    return {
      canSleep: true,
      reason: "nighttime",
      message: "Good time to sleep"
    };
  }

  return {
    canSleep: false,
    reason: "daytime",
    message: "You can only sleep at night or during thunderstorms"
  };
}

/**
 * Check for nearby hostile mobs
 * @param {object} playerPos - Player position {x, y, z}
 * @param {array} nearbyEntities - List of nearby entities
 * @returns {object} Mob check result
 */
function checkNearbyMobs(playerPos, nearbyEntities = []) {
  const config = SLEEP_CONFIG.requirements.proximityCheck;

  if (!config.enabled) {
    return { safe: true, hostileMobs: [] };
  }

  const hostileMobs = [];

  for (const entity of nearbyEntities) {
    if (!entity || !entity.type || !entity.position) continue;

    // Check if mob is allowed
    if (config.allowedMobs.includes(entity.type)) {
      continue;
    }

    // Calculate distance
    const dx = entity.position.x - playerPos.x;
    const dy = entity.position.y - playerPos.y;
    const dz = entity.position.z - playerPos.z;

    const horizontalDist = Math.sqrt(dx * dx + dz * dz);
    const verticalDist = Math.abs(dy);

    // Check if within proximity
    if (horizontalDist <= config.radius && verticalDist <= config.verticalRadius) {
      hostileMobs.push({
        type: entity.type,
        distance: horizontalDist,
        position: entity.position
      });
    }
  }

  return {
    safe: hostileMobs.length === 0,
    hostileMobs: hostileMobs,
    message: hostileMobs.length > 0
      ? `Cannot sleep - ${hostileMobs.length} hostile mob(s) nearby`
      : "Area is safe"
  };
}

/**
 * Check dimension compatibility
 * @param {string} dimension - Current dimension
 * @returns {object} Dimension check result
 */
function checkDimension(dimension = "overworld") {
  const config = SLEEP_CONFIG.requirements.dimensionCheck;

  if (!config.enabled) {
    return { allowed: true, behavior: "sleep" };
  }

  const normalizedDim = dimension.toLowerCase().replace("minecraft:", "");

  if (config.allowedDimensions.includes(normalizedDim)) {
    return {
      allowed: true,
      behavior: "sleep",
      message: "Safe to sleep in this dimension"
    };
  }

  // Determine behavior for non-sleeping dimensions
  let behavior = "block";
  let message = "Cannot sleep in this dimension";

  if (normalizedDim.includes("nether")) {
    behavior = config.netherBehavior;
    message = "Beds explode in the Nether!";
  } else if (normalizedDim.includes("end")) {
    behavior = config.endBehavior;
    message = "Beds explode in the End!";
  }

  return {
    allowed: false,
    behavior: behavior,
    explosionPower: config.explosionPower,
    message: message,
    warning: "DANGER: Attempting to sleep will cause an explosion!"
  };
}

/**
 * Check bed accessibility
 * @param {object} bedPos - Bed position {x, y, z}
 * @param {object} worldData - World block data around bed
 * @returns {object} Accessibility check result
 */
function checkBedAccessibility(bedPos, worldData = {}) {
  const config = SLEEP_CONFIG.requirements.bedAccess;

  const checks = {
    accessible: true,
    issues: []
  };

  if (!config.requireUnobstructed) {
    return checks;
  }

  // Check space above bed
  const blocksAbove = worldData.blocksAbove || [];
  let clearHeight = 0;

  for (let i = 0; i < config.minHeightClearance; i++) {
    const block = blocksAbove[i];
    if (block && block !== "air" && !block.includes("carpet")) {
      checks.accessible = false;
      checks.issues.push(`Block at +${i + 1}: ${block} is obstructing bed`);
      break;
    }
    clearHeight++;
  }

  if (clearHeight < config.minHeightClearance) {
    checks.accessible = false;
    checks.issues.push(`Insufficient clearance above bed (${clearHeight}/${config.minHeightClearance} blocks)`);
  }

  // Check for suffocation hazards
  if (config.checkSuffocation) {
    const surroundingBlocks = worldData.surrounding || [];
    const solidBlocks = surroundingBlocks.filter(b =>
      b && b !== "air" && !b.includes("carpet") && !b.includes("bed")
    );

    if (solidBlocks.length >= 8) {
      checks.accessible = false;
      checks.issues.push("Bed is too enclosed - risk of suffocation");
    }
  }

  return checks;
}

/**
 * Calculate sleep benefits
 * @param {object} playerState - Current player state
 * @returns {object} Sleep benefits
 */
function calculateSleepBenefits(playerState = {}) {
  const benefits = {
    respawnSet: SLEEP_CONFIG.respawn.setOnSleep,
    phantomCounterReset: SLEEP_CONFIG.phantoms.resetOnSleep,
    timeSkipped: true,
    newTimeOfDay: 0, // Dawn
    daysSinceRest: 0
  };

  // Calculate current phantom risk
  const daysSinceRest = playerState.daysSinceRest || 0;
  benefits.previousPhantomRisk = daysSinceRest >= SLEEP_CONFIG.phantoms.spawnThreshold;
  benefits.newPhantomRisk = false;

  // Additional benefits
  if (benefits.respawnSet) {
    benefits.messages = benefits.messages || [];
    benefits.messages.push(SLEEP_CONFIG.respawn.message);
  }

  if (benefits.phantomCounterReset && benefits.previousPhantomRisk) {
    benefits.messages = benefits.messages || [];
    benefits.messages.push("Phantom spawn timer reset");
  }

  return benefits;
}

/**
 * Validate sleep attempt
 * @param {object} context - Game context (position, dimension, time, entities)
 * @returns {object} Validation result
 */
function validateSleepAttempt(context = {}) {
  const validation = {
    allowed: true,
    blockers: [],
    warnings: []
  };

  // Check time of day
  const timeCheck = canSleepAtTime(
    context.timeOfDay || 0,
    context.isThunderstorm || false
  );

  if (!timeCheck.canSleep) {
    validation.allowed = false;
    validation.blockers.push(timeCheck.message);
  }

  // Check dimension
  const dimCheck = checkDimension(context.dimension);
  if (!dimCheck.allowed) {
    validation.allowed = false;
    validation.blockers.push(dimCheck.message);

    if (dimCheck.behavior === "explode") {
      validation.warnings.push(dimCheck.warning);
      validation.dangerous = true;
      validation.explosionPower = dimCheck.explosionPower;
    }
  }

  // Check nearby mobs
  const mobCheck = checkNearbyMobs(
    context.playerPosition || { x: 0, y: 0, z: 0 },
    context.nearbyEntities || []
  );

  if (!mobCheck.safe) {
    validation.allowed = false;
    validation.blockers.push(mobCheck.message);
    validation.hostileMobs = mobCheck.hostileMobs;
  }

  // Check bed accessibility
  if (context.bedPosition && context.worldData) {
    const accessCheck = checkBedAccessibility(context.bedPosition, context.worldData);
    if (!accessCheck.accessible) {
      validation.allowed = false;
      validation.blockers.push(...accessCheck.issues);
    }
  }

  return validation;
}

/* =====================================================
 * SLEEP TASK PLANNER
 * Main function for creating sleep action plans
 * ===================================================== */

/**
 * Plan sleep task
 * @param {object} goal - Task goal with bed specifications
 * @param {object} context - Game context (player, inventory, world state)
 * @returns {object} Sleep plan
 */
export function planSleepTask(goal = {}, context = {}) {
  const bedTarget = goal.bed;
  const inventory = context.inventory || {};
  const playerPos = context.playerPosition || { x: 0, y: 0, z: 0 };
  const playerState = context.playerState || {};

  const plan = createPlan("sleep", "Sleep in bed", {
    priority: "normal",
    estimatedDuration: 5,
    safety: "check_environment"
  });

  // Find bed to use
  let bedLocation = null;
  let bedType = null;

  if (bedTarget && bedTarget.position) {
    // Specific bed location provided
    bedLocation = bedTarget.position;
    bedType = bedTarget.type || "bed";
  } else if (goal.nearestBed) {
    // Use nearest bed
    bedLocation = context.nearestBedLocation || null;
    if (!bedLocation) {
      plan.status = "failed";
      plan.error = "No bed found nearby";
      plan.suggestion = "Place a bed or move to an existing bed";
      return plan;
    }
  } else {
    // Check inventory for bed
    const bedInInventory = Object.keys(BED_TYPES).find(bed =>
      hasInventoryItem(inventory, bed)
    );

    if (bedInInventory) {
      plan.needsPlacement = true;
      bedType = bedInInventory;
    } else {
      plan.status = "failed";
      plan.error = "No bed available";
      plan.suggestion = "Craft a bed (3 wool + 3 planks) or find one in a village";
      return plan;
    }
  }

  // Validate sleep attempt
  const validation = validateSleepAttempt({
    ...context,
    bedPosition: bedLocation
  });

  if (!validation.allowed) {
    plan.status = "blocked";
    plan.blockers = validation.blockers;

    if (validation.dangerous) {
      plan.danger = true;
      plan.warnings = validation.warnings;
    }

    // Suggest remediation
    if (validation.blockers.some(b => b.includes("time"))) {
      plan.suggestion = "Wait until nighttime (after sunset) or during a thunderstorm";
    } else if (validation.hostileMobs) {
      plan.suggestion = `Clear ${validation.hostileMobs.length} hostile mob(s) within 8 blocks of bed`;
      plan.threats = validation.hostileMobs.map(m => ({
        type: m.type,
        distance: Math.round(m.distance),
        position: m.position
      }));
    } else if (validation.dangerous) {
      plan.suggestion = "DO NOT attempt to sleep - return to the Overworld first";
    }

    return plan;
  }

  // Calculate benefits
  const benefits = calculateSleepBenefits(playerState);

  // Build sleep steps

  // Step 1: Place bed if needed
  if (plan.needsPlacement) {
    plan.steps.push(createStep(
      "place_bed",
      `Place ${bedType} on ground`,
      {
        item: bedType,
        position: goal.placePosition || "current",
        validation: {
          requireFlat: true,
          requireSupport: true,
          checkClearance: true
        }
      }
    ));
  }

  // Step 2: Navigate to bed if not adjacent
  if (bedLocation) {
    const distance = Math.sqrt(
      Math.pow(bedLocation.x - playerPos.x, 2) +
      Math.pow(bedLocation.z - playerPos.z, 2)
    );

    if (distance > 3) {
      plan.steps.push(createStep(
        "navigate_to_bed",
        describeTarget(bedLocation, "Navigate to bed at"),
        {
          target: bedLocation,
          maxDistance: 2,
          pathfinding: "direct"
        }
      ));
    }
  }

  // Step 3: Clear hostiles if any (shouldn't be any if validation passed)
  if (goal.clearHostiles && context.nearbyEntities) {
    const hostiles = context.nearbyEntities.filter(e =>
      e && e.hostile && e.distance <= 8
    );

    if (hostiles.length > 0) {
      plan.steps.push(createStep(
        "clear_hostiles",
        `Clear ${hostiles.length} hostile mob(s) before sleeping`,
        {
          targets: hostiles,
          priority: "high"
        }
      ));
    }
  }

  // Step 4: Interact with bed to sleep
  plan.steps.push(createStep(
    "sleep",
    "Lie down in bed and sleep",
    {
      bed: bedLocation || "placed_bed",
      duration: SLEEP_CONFIG.duration.sleepTime / 20, // Convert ticks to seconds
      interruptible: true,
      interruptConditions: [
        "hostile_mob_nearby",
        "player_damage",
        "bed_destroyed"
      ]
    }
  ));

  // Step 5: Wake up
  plan.steps.push(createStep(
    "wake_up",
    "Wake up at dawn",
    {
      newTimeOfDay: 0,
      wakeDelay: SLEEP_CONFIG.duration.wakeUpDelay / 20
    }
  ));

  // Add benefits information
  plan.benefits = benefits;

  // Add outcome
  plan.outcome = {
    respawnPointSet: benefits.respawnSet,
    phantomCounterReset: benefits.phantomCounterReset,
    timeSkipped: "night_to_dawn",
    newTimeOfDay: 0,
    messages: benefits.messages || []
  };

  return plan;
}

/* =====================================================
 * BED PLACEMENT PLANNER
 * Helper for placing beds
 * ===================================================== */

/**
 * Plan bed placement
 * @param {object} goal - Placement goal
 * @param {object} context - Game context
 * @returns {object} Bed placement plan
 */
function planBedPlacement(goal = {}, context = {}) {
  const bedType = goal.bedType || "white_bed";
  const position = goal.position || context.playerPosition;
  const inventory = context.inventory || {};

  const plan = createPlan("place_bed", `Place ${bedType}`, {
    priority: "normal",
    estimatedDuration: 2
  });

  // Check if player has bed
  if (!hasInventoryItem(inventory, bedType)) {
    plan.status = "failed";
    plan.error = `No ${bedType} in inventory`;
    plan.suggestion = "Craft a bed (3 wool + 3 planks)";
    return plan;
  }

  // Validate placement location
  const accessCheck = checkBedAccessibility(position, context.worldData);
  if (!accessCheck.accessible) {
    plan.status = "failed";
    plan.error = "Cannot place bed here";
    plan.issues = accessCheck.issues;
    return plan;
  }

  // Add placement steps
  plan.steps.push(createStep(
    "select_bed",
    `Select ${bedType} from inventory`,
    { item: bedType }
  ));

  plan.steps.push(createStep(
    "place_bed",
    `Place ${bedType} at ${describeTarget(position)}`,
    {
      item: bedType,
      position: position,
      direction: goal.direction || "auto"
    }
  ));

  return plan;
}

/* =====================================================
 * EXPORTS
 * ===================================================== */

export default planSleepTask;
export {
  BED_TYPES,
  SLEEP_CONFIG,
  isBed,
  getBedInfo,
  canSleepAtTime,
  checkNearbyMobs,
  checkDimension,
  checkBedAccessibility,
  validateSleepAttempt,
  calculateSleepBenefits,
  planBedPlacement
};
