// tasks/plan_throw.js
// Throwing and projectile mechanics system
// Implements snowballs, eggs, ender pearls, potions, tridents, and other throwables

import {
  createPlan,
  createStep,
  describeTarget,
  normalizeItemName,
  hasInventoryItem,
  extractInventory
} from "./helpers.js";

/* =====================================================
 * THROWABLE ITEMS DATABASE
 * All throwable items and their properties
 * ===================================================== */

const THROWABLE_ITEMS = {
  // Basic throwables
  snowball: {
    type: "projectile",
    damage: 0, // No damage to most mobs
    damageToBlaze: 3,
    damageToEnderDragon: 0,
    velocity: 1.5, // blocks per tick
    gravity: true,
    stackSize: 16,
    effects: [],
    cooldown: 0,
    consumesOnThrow: true
  },
  egg: {
    type: "projectile",
    damage: 0,
    velocity: 1.5,
    gravity: true,
    stackSize: 16,
    effects: [{ type: "spawn_chicken", chance: 0.125 }],
    cooldown: 0,
    consumesOnThrow: true
  },

  // Ender pearls (teleportation)
  ender_pearl: {
    type: "teleport_projectile",
    damage: 0,
    fallDamage: 5, // Fall damage taken after teleport
    velocity: 1.5,
    gravity: true,
    stackSize: 16,
    effects: [{ type: "teleport_on_impact" }],
    cooldown: 1.0, // seconds
    consumesOnThrow: true,
    sound: "entity.enderman.teleport"
  },

  // Eyes of ender (stronghold finder)
  eye_of_ender: {
    type: "finder_projectile",
    damage: 0,
    velocity: 0.5,
    gravity: false, // Floats upward
    stackSize: 64,
    effects: [{ type: "locate_stronghold" }],
    cooldown: 0,
    consumesOnThrow: true,
    breakChance: 0.2, // 20% chance to break
    duration: 2.0 // Floats for 2 seconds
  },

  // Bottles o' enchanting (XP)
  experience_bottle: {
    type: "projectile",
    damage: 0,
    velocity: 1.5,
    gravity: true,
    stackSize: 64,
    effects: [{ type: "spawn_xp_orbs", amount: "3-11" }],
    cooldown: 0,
    consumesOnThrow: true,
    sound: "entity.experience_orb.pickup"
  },

  // Splash potions
  splash_water_bottle: {
    type: "splash_potion",
    damage: 0,
    velocity: 1.5,
    gravity: true,
    stackSize: 1,
    effects: [
      { type: "extinguish_fire", radius: 2 },
      { type: "damage_blaze", damage: 1 },
      { type: "damage_enderman", damage: 1 }
    ],
    cooldown: 0,
    consumesOnThrow: true,
    splashRadius: 4
  },
  splash_potion: {
    type: "splash_potion",
    damage: 0, // Depends on potion type
    velocity: 1.5,
    gravity: true,
    stackSize: 1,
    effects: [], // Variable based on potion
    cooldown: 0,
    consumesOnThrow: true,
    splashRadius: 4,
    variants: [
      "healing", "harming", "regeneration", "swiftness", "slowness",
      "strength", "weakness", "poison", "fire_resistance", "water_breathing",
      "invisibility", "night_vision", "leaping", "turtle_master", "slow_falling"
    ]
  },

  // Lingering potions
  lingering_potion: {
    type: "lingering_potion",
    damage: 0,
    velocity: 1.5,
    gravity: true,
    stackSize: 1,
    effects: [], // Variable based on potion
    cooldown: 0,
    consumesOnThrow: true,
    splashRadius: 3,
    lingerDuration: 30, // seconds
    cloudRadius: 3
  },

  // Trident (thrown or melee)
  trident: {
    type: "weapon_projectile",
    damage: 8, // Melee damage
    thrownDamage: 8,
    velocity: 2.5,
    gravity: true,
    stackSize: 1,
    effects: [],
    cooldown: 1.0,
    consumesOnThrow: false, // Returns to player
    durability: 250,
    enchantable: true,
    enchantments: {
      loyalty: "Returns to player after throw",
      riptide: "Launch player with trident in rain/water",
      channeling: "Summon lightning on hit during thunderstorm",
      impaling: "Extra damage to aquatic mobs"
    }
  },

  // Fire charges
  fire_charge: {
    type: "projectile",
    damage: 5, // Fire damage
    velocity: 1.0,
    gravity: false,
    stackSize: 64,
    effects: [
      { type: "set_fire", duration: 5 },
      { type: "ignite_tnt" },
      { type: "light_campfire" }
    ],
    cooldown: 0,
    consumesOnThrow: true
  }
};

/* =====================================================
 * THROWING MECHANICS CONFIGURATION
 * Rules for throwing and projectile behavior
 * ===================================================== */

const THROW_CONFIG = {
  // Throwing mechanics
  mechanics: {
    chargeTime: 0.2, // seconds to "charge" throw
    maxVelocity: 3.0, // Maximum throw speed
    minVelocity: 0.5,
    accuracy: {
      standing: 1.0, // Perfect accuracy
      moving: 0.95,
      jumping: 0.90,
      sprinting: 0.85
    }
  },

  // Projectile physics
  physics: {
    airResistance: 0.99, // Velocity multiplier per tick
    gravityStrength: 0.03, // Blocks per tick squared
    waterDrag: 0.6, // Velocity in water
    maxDistance: 120 // blocks before despawn
  },

  // Collision detection
  collision: {
    hitboxSize: 0.25, // blocks
    piercing: false, // Default: stops on first hit
    affectsEntities: true,
    affectsBlocks: true,
    affectsWater: false // Most projectiles pass through water
  },

  // Hit effects
  hitEffects: {
    snowball: {
      entity: "knockback_small",
      block: "particle_effect",
      sound: "entity.snowball.throw"
    },
    egg: {
      entity: "particle_effect",
      block: "particle_effect",
      sound: "entity.egg.throw"
    },
    ender_pearl: {
      entity: "teleport_player",
      block: "teleport_player",
      sound: "entity.enderman.teleport"
    },
    splash_potion: {
      entity: "apply_potion_effect",
      block: "splash_particles",
      sound: "entity.splash_potion.break"
    },
    trident: {
      entity: "damage_and_knockback",
      block: "stick_in_block",
      sound: "item.trident.throw"
    }
  },

  // Special mechanics
  special: {
    ender_pearl_cooldown: 1.0, // seconds
    trident_loyalty_max_level: 3,
    trident_riptide_requirement: "rain_or_water",
    splash_potion_radius: 4, // blocks
    lingering_cloud_duration: 30, // seconds
    eye_of_ender_break_chance: 0.2
  }
};

/**
 * Get throwable item info
 * @param {string} itemName - Item name
 * @returns {object|null} Throwable info or null
 */
function getThrowableInfo(itemName) {
  const normalized = normalizeItemName(itemName);

  // Check exact match
  if (THROWABLE_ITEMS[normalized]) {
    return THROWABLE_ITEMS[normalized];
  }

  // Check for splash/lingering potion variants
  if (normalized.includes("splash_potion")) {
    return THROWABLE_ITEMS.splash_potion;
  }
  if (normalized.includes("lingering_potion")) {
    return THROWABLE_ITEMS.lingering_potion;
  }

  return null;
}

/**
 * Check if item is throwable
 * @param {string} itemName - Item name
 * @returns {boolean} True if throwable
 */
function isThrowable(itemName) {
  return getThrowableInfo(itemName) !== null;
}

/**
 * Calculate throw trajectory
 * @param {object} startPos - Starting position {x, y, z}
 * @param {object} targetPos - Target position {x, y, z}
 * @param {string} itemType - Type of throwable
 * @param {object} playerState - Player movement state
 * @returns {object} Trajectory calculation
 */
function calculateTrajectory(startPos, targetPos, itemType, playerState = {}) {
  const throwable = getThrowableInfo(itemType);
  if (!throwable) {
    return { error: "Invalid throwable item" };
  }

  // Calculate distance
  const dx = targetPos.x - startPos.x;
  const dy = targetPos.y - startPos.y;
  const dz = targetPos.z - startPos.z;
  const horizontalDist = Math.sqrt(dx * dx + dz * dz);
  const totalDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Calculate required velocity and angle
  const velocity = throwable.velocity;
  const gravity = throwable.gravity ? THROW_CONFIG.physics.gravityStrength : 0;

  // Estimate flight time (simplified physics)
  const flightTime = totalDist / velocity;

  // Calculate accuracy modifier
  const movementState = playerState.movement || "standing";
  const accuracy = THROW_CONFIG.mechanics.accuracy[movementState] || 1.0;

  return {
    distance: totalDist,
    horizontalDistance: horizontalDist,
    verticalDistance: Math.abs(dy),
    velocity: velocity,
    flightTime: flightTime,
    accuracy: accuracy,
    hitChance: accuracy * 100,
    trajectory: throwable.gravity ? "arc" : "straight",
    willReach: totalDist <= THROW_CONFIG.physics.maxDistance
  };
}

/**
 * Calculate splash potion area effect
 * @param {object} impactPos - Impact position
 * @param {string} potionType - Type of splash potion
 * @returns {object} Area effect calculation
 */
function calculateSplashEffect(impactPos, potionType) {
  const throwable = getThrowableInfo(potionType);
  const radius = throwable?.splashRadius || 4;

  return {
    centerPoint: impactPos,
    radius: radius,
    affectedArea: Math.PI * radius * radius,
    potencyAtCenter: 1.0,
    potencyAtEdge: 0.25,
    lingering: throwable?.type === "lingering_potion",
    lingerDuration: throwable?.lingerDuration || 0
  };
}

/**
 * Assess throw attempt
 * @param {string} itemType - Item to throw
 * @param {object} context - Game context
 * @returns {object} Throw assessment
 */
function assessThrowAttempt(itemType, context = {}) {
  const throwable = getThrowableInfo(itemType);
  const inventory = context.inventory || {};
  const playerState = context.playerState || {};

  const assessment = {
    canThrow: true,
    blockers: [],
    warnings: []
  };

  if (!throwable) {
    assessment.canThrow = false;
    assessment.blockers.push(`${itemType} is not throwable`);
    return assessment;
  }

  // Check inventory
  if (!hasInventoryItem(inventory, itemType)) {
    assessment.canThrow = false;
    assessment.blockers.push(`No ${itemType} in inventory`);
  }

  // Check cooldown
  if (throwable.cooldown > 0 && playerState.lastThrow) {
    const timeSinceLastThrow = (Date.now() - playerState.lastThrow) / 1000;
    if (timeSinceLastThrow < throwable.cooldown) {
      assessment.canThrow = false;
      assessment.blockers.push(`Cooldown: ${(throwable.cooldown - timeSinceLastThrow).toFixed(1)}s remaining`);
    }
  }

  // Check durability for trident
  if (itemType === "trident") {
    const trident = inventory.trident;
    if (trident && trident.durability !== undefined) {
      if (trident.durability <= 0) {
        assessment.canThrow = false;
        assessment.blockers.push("Trident is broken");
      } else if (trident.durability < 10) {
        assessment.warnings.push(`Trident durability low: ${trident.durability}/${throwable.durability}`);
      }
    }
  }

  // Special checks for ender pearls
  if (itemType === "ender_pearl") {
    assessment.warnings.push(`Will take ${throwable.fallDamage} fall damage on teleport`);
  }

  // Special checks for trident with riptide
  if (itemType === "trident" && context.tridentHasRiptide) {
    const inRainOrWater = context.isRaining || context.inWater;
    if (!inRainOrWater) {
      assessment.canThrow = false;
      assessment.blockers.push("Riptide trident requires rain or water");
    } else {
      assessment.warnings.push("Will launch player with trident");
    }
  }

  return assessment;
}

/**
 * Get best throwable for situation
 * @param {object} inventory - Current inventory
 * @param {string} situation - Situation type
 * @returns {object|null} Best throwable or null
 */
function getBestThrowable(inventory = {}, situation = "combat") {
  const inventoryItems = extractInventory(inventory);
  const throwables = inventoryItems.filter(item => isThrowable(item.name));

  if (throwables.length === 0) {
    return null;
  }

  // Prioritize based on situation
  const priorities = {
    combat: ["splash_potion", "trident", "snowball"],
    teleport: ["ender_pearl"],
    xp_farming: ["experience_bottle"],
    fire_starting: ["fire_charge"],
    exploration: ["eye_of_ender"],
    distraction: ["snowball", "egg"]
  };

  const priorityList = priorities[situation] || priorities.combat;

  for (const priority of priorityList) {
    const match = throwables.find(t => t.name.includes(priority));
    if (match) {
      return {
        name: match.name,
        count: match.count || 1,
        info: getThrowableInfo(match.name),
        situation: situation
      };
    }
  }

  // Return first available if no priority match
  return {
    name: throwables[0].name,
    count: throwables[0].count || 1,
    info: getThrowableInfo(throwables[0].name),
    situation: "general"
  };
}

/* =====================================================
 * THROW TASK PLANNER
 * Main function for creating throw action plans
 * ===================================================== */

/**
 * Plan throw task
 * @param {object} goal - Task goal with item and target
 * @param {object} context - Game context
 * @returns {object} Throw plan
 */
export function planThrowTask(goal = {}, context = {}) {
  const itemType = goal.item || goal.throwable;
  const target = goal.target;
  const playerPos = context.playerPosition || { x: 0, y: 0, z: 0 };
  const inventory = context.inventory || {};

  if (!itemType) {
    return {
      status: "failed",
      error: "No throwable item specified"
    };
  }

  const throwable = getThrowableInfo(itemType);

  if (!throwable) {
    return {
      status: "failed",
      error: `${itemType} is not a throwable item`,
      suggestion: "Try: snowball, egg, ender_pearl, splash_potion, trident"
    };
  }

  const plan = createPlan("throw", `Throw ${itemType}`, {
    priority: goal.urgent ? "high" : "normal",
    estimatedDuration: 1,
    safety: itemType === "ender_pearl" ? "medium_fall_damage" : "normal"
  });

  // Assess throw attempt
  const assessment = assessThrowAttempt(itemType, context);

  if (!assessment.canThrow) {
    plan.status = "blocked";
    plan.blockers = assessment.blockers;
    return plan;
  }

  // Add warnings
  if (assessment.warnings.length > 0) {
    plan.warnings = assessment.warnings;
  }

  // Calculate trajectory if target provided
  let trajectory = null;
  if (target) {
    trajectory = calculateTrajectory(playerPos, target, itemType, context.playerState);

    if (!trajectory.willReach) {
      plan.status = "blocked";
      plan.error = `Target too far (${trajectory.distance.toFixed(1)} blocks, max ${THROW_CONFIG.physics.maxDistance})`;
      return plan;
    }
  }

  // Build throwing steps

  // Step 1: Select item
  plan.steps.push(createStep(
    "select_throwable",
    `Select ${itemType} from inventory`,
    {
      item: itemType,
      slot: "main_hand"
    }
  ));

  // Step 2: Aim (if target specified)
  if (target) {
    plan.steps.push(createStep(
      "aim_at_target",
      describeTarget(target, "Aim at"),
      {
        target: target,
        trajectory: trajectory?.trajectory || "straight",
        distance: trajectory?.distance || 0,
        accuracy: trajectory?.accuracy || 1.0
      }
    ));
  }

  // Step 3: Throw
  const throwStep = createStep(
    "throw_item",
    `Throw ${itemType}`,
    {
      item: itemType,
      velocity: throwable.velocity,
      gravity: throwable.gravity,
      consumesItem: throwable.consumesOnThrow
    }
  );

  // Add special instructions
  if (throwable.type === "teleport_projectile") {
    throwStep.note = "Will teleport to impact location";
  } else if (throwable.type === "splash_potion") {
    throwStep.note = `Affects ${THROW_CONFIG.special.splash_potion_radius}-block radius`;
  } else if (itemType === "trident" && !throwable.consumesOnThrow) {
    throwStep.note = "Trident will return if loyalty enchantment";
  }

  plan.steps.push(throwStep);

  // Step 4: Handle impact effects
  if (trajectory && target) {
    const impactStep = createStep(
      "impact",
      "Projectile impacts target",
      {
        effects: throwable.effects,
        hitEffects: THROW_CONFIG.hitEffects[itemType] || []
      }
    );

    if (throwable.type === "splash_potion" || throwable.type === "lingering_potion") {
      const splashEffect = calculateSplashEffect(target, itemType);
      impactStep.splashEffect = splashEffect;
    }

    plan.steps.push(impactStep);
  }

  // Add outcome
  plan.outcome = {
    item: itemType,
    itemType: throwable.type,
    consumed: throwable.consumesOnThrow,
    trajectory: trajectory,
    effects: throwable.effects
  };

  return plan;
}

/**
 * Plan ender pearl teleportation
 * @param {object} goal - Teleport goal
 * @param {object} context - Game context
 * @returns {object} Teleport plan
 */
function planEnderPearlTeleport(goal = {}, context = {}) {
  const destination = goal.destination || goal.target;
  const playerPos = context.playerPosition || { x: 0, y: 0, z: 0 };

  if (!destination) {
    return {
      status: "failed",
      error: "No destination specified for ender pearl teleport"
    };
  }

  const distance = Math.sqrt(
    Math.pow(destination.x - playerPos.x, 2) +
    Math.pow(destination.y - playerPos.y, 2) +
    Math.pow(destination.z - playerPos.z, 2)
  );

  const plan = createPlan("ender_pearl_teleport", `Teleport to ${describeTarget(destination)}`, {
    priority: "normal",
    estimatedDuration: 2,
    safety: "medium_fall_damage"
  });

  const throwable = getThrowableInfo("ender_pearl");

  plan.steps.push(createStep(
    "prepare_teleport",
    "Prepare ender pearl teleport",
    {
      distance: distance,
      fallDamage: throwable.fallDamage,
      warning: `Will take ${throwable.fallDamage} fall damage`
    }
  ));

  plan.steps.push(createStep(
    "throw_pearl",
    `Throw ender pearl to ${describeTarget(destination)}`,
    {
      item: "ender_pearl",
      destination: destination
    }
  ));

  plan.steps.push(createStep(
    "teleport",
    "Teleport on impact",
    {
      newPosition: destination,
      fallDamage: throwable.fallDamage
    }
  ));

  plan.outcome = {
    method: "ender_pearl",
    distance: distance,
    fallDamage: throwable.fallDamage,
    cooldown: THROW_CONFIG.special.ender_pearl_cooldown
  };

  return plan;
}

/* =====================================================
 * EXPORTS
 * ===================================================== */

export default planThrowTask;
export {
  THROWABLE_ITEMS,
  THROW_CONFIG,
  getThrowableInfo,
  isThrowable,
  calculateTrajectory,
  calculateSplashEffect,
  assessThrowAttempt,
  getBestThrowable,
  planEnderPearlTeleport
};
