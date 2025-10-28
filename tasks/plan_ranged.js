// tasks/plan_ranged.js
// Ranged weapon system for bows and crossbows
// Implements shooting mechanics, charging, enchantments, and arrow types

import {
  createPlan,
  createStep,
  describeTarget,
  normalizeItemName,
  hasInventoryItem
} from "./helpers.js";

/* =====================================================
 * RANGED WEAPON DATABASE
 * Bows, crossbows, and their properties
 * ===================================================== */

const RANGED_WEAPONS = {
  bow: {
    type: "bow",
    damage: 9, // Max damage (fully charged)
    durability: 384,
    chargeTime: {
      minimum: 0.1, // seconds (not usable)
      short: 0.5, // Weak shot
      medium: 1.0, // Medium shot
      full: 1.0 // Full charge (max damage and distance)
    },
    velocity: {
      minimum: 3.0, // blocks per second
      maximum: 53.0 // Full charge
    },
    enchantments: {
      power: { maxLevel: 5, effect: "+25% damage per level" },
      punch: { maxLevel: 2, effect: "+3 blocks knockback per level" },
      flame: { maxLevel: 1, effect: "Sets target on fire for 5 seconds" },
      infinity: { maxLevel: 1, effect: "Never consumes arrows (except tipped)", incompatible: ["mending"] },
      unbreaking: { maxLevel: 3, effect: "Increases durability" },
      mending: { maxLevel: 1, effect: "Repairs with XP", incompatible: ["infinity"] }
    },
    requiresAmmo: true,
    stackSize: 1
  },

  crossbow: {
    type: "crossbow",
    damage: 9, // Base damage
    durability: 326,
    chargeTime: {
      base: 1.25, // seconds to load
      quickCharge1: 1.0,
      quickCharge2: 0.75,
      quickCharge3: 0.5
    },
    velocity: 65.0, // blocks per second (faster than bow)
    enchantments: {
      quick_charge: { maxLevel: 3, effect: "Reduces load time by 0.25s per level" },
      multishot: { maxLevel: 1, effect: "Shoots 3 arrows in spread", incompatible: ["piercing"] },
      piercing: { maxLevel: 4, effect: "Arrows pierce X entities", incompatible: ["multishot"] },
      unbreaking: { maxLevel: 3, effect: "Increases durability" },
      mending: { maxLevel: 1, effect: "Repairs with XP" }
    },
    requiresAmmo: true,
    preloadable: true, // Can be loaded and kept ready
    stackSize: 1,
    special: {
      firework: {
        enabled: true,
        damage: "varies",
        areaOfEffect: true,
        noAmmoNeeded: false
      }
    }
  }
};

/* =====================================================
 * ARROW TYPES DATABASE
 * All arrow variants and their properties
 * ===================================================== */

const ARROW_TYPES = {
  arrow: {
    type: "normal",
    damage: 2, // Base damage (modified by bow/crossbow)
    stackSize: 64,
    craftable: true,
    materials: ["flint", "stick", "feather"],
    special: false
  },

  spectral_arrow: {
    type: "spectral",
    damage: 2,
    stackSize: 64,
    craftable: true,
    materials: ["arrow", "glowstone_dust"],
    effect: "Glowing effect for 10 seconds",
    special: true
  },

  tipped_arrow: {
    type: "tipped",
    damage: 2,
    stackSize: 64,
    craftable: true,
    materials: ["arrow", "lingering_potion"],
    effect: "Applies potion effect on hit",
    special: true,
    variants: [
      "regeneration", "swiftness", "fire_resistance", "healing",
      "night_vision", "strength", "leaping", "water_breathing",
      "invisibility", "poison", "weakness", "slowness",
      "harming", "decay", "turtle_master", "slow_falling"
    ],
    cantUseWithInfinity: true
  }
};

/* =====================================================
 * RANGED COMBAT CONFIGURATION
 * Rules and mechanics for ranged combat
 * ===================================================== */

const RANGED_CONFIG = {
  // Accuracy system
  accuracy: {
    standingStill: 1.0, // Perfect accuracy
    walking: 0.95,
    sprinting: 0.85,
    jumping: 0.75,
    inAir: 0.70,
    bowFullyCharged: 1.0,
    bowPartialCharge: 0.85,
    crossbowAlways: 1.0 // Crossbow always accurate when loaded
  },

  // Damage calculations
  damage: {
    baseBowDamage: 9,
    baseCrossbowDamage: 9,
    criticalMultiplier: 1.5, // Full charge + airborne + descending
    powerEnchantMultiplier: 0.25, // 25% per level
    maxDamage: 25 // Power V bow with critical
  },

  // Distance and trajectory
  trajectory: {
    gravity: 0.05, // Blocks per tick squared
    airResistance: 0.99,
    maxRange: 120, // blocks before despawn
    effectiveRange: {
      bow: 50, // Accurate up to 50 blocks
      crossbow: 65 // Crossbow more accurate at distance
    }
  },

  // Combat tactics
  tactics: {
    strafe_shooting: {
      description: "Move side to side while shooting",
      accuracy: "95%",
      difficulty: "easy"
    },
    quick_shot: {
      description: "Rapid fire with partial charges",
      accuracy: "85%",
      dps: "high",
      difficulty: "medium"
    },
    sniper: {
      description: "Fully charged shots from distance",
      accuracy: "100%",
      damage: "maximum",
      difficulty: "hard"
    },
    multishot_crowd: {
      description: "Crossbow multishot for groups",
      accuracy: "100%",
      targets: "3",
      difficulty: "medium",
      requiresEnchant: "multishot"
    }
  }
};

/**
 * Get ranged weapon info
 * @param {string} weaponName - Weapon name
 * @returns {object|null} Weapon info or null
 */
function getRangedWeaponInfo(weaponName) {
  const normalized = normalizeItemName(weaponName);
  return RANGED_WEAPONS[normalized] || null;
}

/**
 * Get arrow type info
 * @param {string} arrowName - Arrow name
 * @returns {object|null} Arrow info or null
 */
function getArrowInfo(arrowName) {
  const normalized = normalizeItemName(arrowName);

  // Check exact match
  if (ARROW_TYPES[normalized]) {
    return ARROW_TYPES[normalized];
  }

  // Check for tipped arrow variants
  if (normalized.includes("tipped_arrow") || normalized.includes("arrow_of")) {
    return { ...ARROW_TYPES.tipped_arrow, variant: normalized };
  }

  return null;
}

/**
 * Calculate shot damage
 * @param {string} weaponType - Weapon being used
 * @param {object} shotConditions - Shot conditions
 * @returns {object} Damage calculation
 */
function calculateShotDamage(weaponType, shotConditions = {}) {
  const weapon = getRangedWeaponInfo(weaponType);

  if (!weapon) {
    return { error: "Invalid weapon" };
  }

  let baseDamage = weapon.damage;
  const arrowDamage = shotConditions.arrowType ? getArrowInfo(shotConditions.arrowType)?.damage || 2 : 2;

  // Charge modifier for bow
  let chargeModifier = 1.0;
  if (weapon.type === "bow") {
    chargeModifier = shotConditions.chargePercent || 1.0;
  }

  // Power enchantment
  const powerLevel = shotConditions.powerLevel || 0;
  const powerMultiplier = 1 + (powerLevel * RANGED_CONFIG.damage.powerEnchantMultiplier);

  // Critical hit
  const isCritical = shotConditions.critical || false;
  const criticalMultiplier = isCritical ? RANGED_CONFIG.damage.criticalMultiplier : 1.0;

  // Calculate total damage
  const totalDamage = (baseDamage + arrowDamage) * chargeModifier * powerMultiplier * criticalMultiplier;

  return {
    weapon: weaponType,
    baseDamage,
    arrowDamage,
    chargeModifier,
    powerLevel,
    powerMultiplier,
    critical: isCritical,
    criticalMultiplier,
    totalDamage: Math.round(totalDamage * 10) / 10,
    maxPossible: RANGED_CONFIG.damage.maxDamage
  };
}

/**
 * Calculate crossbow load time
 * @param {number} quickChargeLevel - Quick Charge enchantment level (0-3)
 * @returns {object} Load time calculation
 */
function calculateCrossbowLoadTime(quickChargeLevel = 0) {
  const crossbow = RANGED_WEAPONS.crossbow;
  const baseTime = crossbow.chargeTime.base;

  let loadTime;
  switch (quickChargeLevel) {
    case 1:
      loadTime = crossbow.chargeTime.quickCharge1;
      break;
    case 2:
      loadTime = crossbow.chargeTime.quickCharge2;
      break;
    case 3:
      loadTime = crossbow.chargeTime.quickCharge3;
      break;
    default:
      loadTime = baseTime;
  }

  const reduction = baseTime - loadTime;
  const reductionPercent = (reduction / baseTime) * 100;

  return {
    quickChargeLevel,
    baseLoadTime: baseTime,
    actualLoadTime: loadTime,
    reduction,
    reductionPercent: Math.round(reductionPercent),
    shotsPerMinute: Math.floor(60 / loadTime)
  };
}

/**
 * Get best ranged tactic for situation
 * @param {object} situation - Combat situation
 * @returns {object} Recommended tactic
 */
function getBestRangedTactic(situation = {}) {
  const enemyCount = situation.enemyCount || 1;
  const distance = situation.distance || 20;
  const weaponType = situation.weapon || "bow";
  const enchantments = situation.enchantments || {};

  // Multishot for crowds
  if (enemyCount >= 3 && weaponType === "crossbow" && enchantments.multishot) {
    return {
      tactic: "multishot_crowd",
      ...RANGED_CONFIG.tactics.multishot_crowd,
      reason: "Multiple enemies in range"
    };
  }

  // Sniper for long distance
  if (distance > 40) {
    return {
      tactic: "sniper",
      ...RANGED_CONFIG.tactics.sniper,
      reason: "Long range engagement"
    };
  }

  // Quick shot for close combat
  if (distance < 15) {
    return {
      tactic: "quick_shot",
      ...RANGED_CONFIG.tactics.quick_shot,
      reason: "Close range - prioritize fire rate"
    };
  }

  // Default: strafe shooting
  return {
    tactic: "strafe_shooting",
    ...RANGED_CONFIG.tactics.strafe_shooting,
    reason: "Standard engagement"
  };
}

/**
 * Check ammo requirements
 * @param {string} weaponType - Weapon type
 * @param {object} enchantments - Weapon enchantments
 * @param {string} arrowType - Arrow type
 * @returns {object} Ammo requirements
 */
function checkAmmoRequirements(weaponType, enchantments = {}, arrowType = "arrow") {
  const weapon = getRangedWeaponInfo(weaponType);
  const arrow = getArrowInfo(arrowType);

  if (!weapon) {
    return { error: "Invalid weapon" };
  }

  const hasInfinity = weapon.type === "bow" && enchantments.infinity;
  const isTippedArrow = arrow?.type === "tipped";

  // Infinity doesn't work with tipped arrows
  const consumesArrow = isTippedArrow || !hasInfinity;

  return {
    weapon: weaponType,
    arrowType,
    consumesArrow,
    hasInfinity: hasInfinity && !isTippedArrow,
    note: hasInfinity && isTippedArrow ? "Infinity doesn't work with tipped arrows" : null,
    arrowsNeeded: consumesArrow ? "1 per shot" : "1 arrow (infinite)"
  };
}

/* =====================================================
 * RANGED COMBAT TASK PLANNER
 * Main function for creating ranged combat plans
 * ===================================================== */

/**
 * Plan ranged attack task
 * @param {object} goal - Task goal
 * @param {object} context - Game context
 * @returns {object} Ranged attack plan
 */
function planRangedTask(goal = {}, context = {}) {
  const weaponType = goal.weapon || "bow";
  const target = goal.target;
  const inventory = context.inventory || {};
  const playerPos = context.playerPosition || { x: 0, y: 0, z: 0 };

  const weapon = getRangedWeaponInfo(weaponType);

  if (!weapon) {
    return {
      status: "failed",
      error: `Invalid ranged weapon: ${weaponType}`,
      suggestion: "Use bow or crossbow"
    };
  }

  const plan = createPlan("ranged_attack", `Attack with ${weaponType}`, {
    priority: goal.urgent ? "high" : "normal",
    estimatedDuration: 5,
    safety: "ranged_combat"
  });

  // Check weapon
  if (!hasInventoryItem(inventory, weaponType)) {
    plan.status = "blocked";
    plan.error = `No ${weaponType} in inventory`;
    plan.suggestion = weapon.type === "bow" ?
      "Craft bow (3 sticks + 3 string)" :
      "Craft crossbow (3 sticks + 2 string + 1 iron ingot + 1 tripwire hook)";
    return plan;
  }

  // Check ammo
  const weaponData = inventory[weaponType];
  const enchantments = weaponData?.enchantments || {};
  const ammoReq = checkAmmoRequirements(weaponType, enchantments, goal.arrowType);

  if (ammoReq.consumesArrow && !hasInventoryItem(inventory, ammoReq.arrowType)) {
    plan.status = "blocked";
    plan.error = `No ${ammoReq.arrowType} in inventory`;
    plan.suggestion = "Craft arrows (1 flint + 1 stick + 1 feather = 4 arrows)";
    return plan;
  }

  // Calculate distance to target
  let distance = null;
  let tactic = null;

  if (target) {
    const dx = target.x - playerPos.x;
    const dy = target.y - playerPos.y;
    const dz = target.z - playerPos.z;
    distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Get recommended tactic
    tactic = getBestRangedTactic({
      weapon: weaponType,
      distance,
      enemyCount: goal.enemyCount || 1,
      enchantments
    });
  }

  // Build attack steps

  // Step 1: Equip weapon
  plan.steps.push(createStep(
    "equip_weapon",
    `Equip ${weaponType}`,
    {
      weapon: weaponType,
      slot: "main_hand"
    }
  ));

  // Step 2: Load crossbow (if applicable)
  if (weapon.type === "crossbow") {
    const loadTime = calculateCrossbowLoadTime(enchantments.quick_charge || 0);

    plan.steps.push(createStep(
      "load_crossbow",
      `Load crossbow (${loadTime.actualLoadTime}s)`,
      {
        loadTime: loadTime.actualLoadTime,
        action: "hold_right_click",
        quickChargeLevel: enchantments.quick_charge || 0
      }
    ));
  }

  // Step 3: Aim at target
  if (target) {
    plan.steps.push(createStep(
      "aim_at_target",
      describeTarget(target, "Aim at"),
      {
        target,
        distance: distance ? Math.round(distance) : null,
        compensation: distance > 20 ? "Aim slightly above target for arc" : "Direct aim"
      }
    ));
  }

  // Step 4: Shoot
  if (weapon.type === "bow") {
    plan.steps.push(createStep(
      "charge_and_shoot",
      "Charge bow and release (1 second for full power)",
      {
        chargeTime: weapon.chargeTime.full,
        action: "hold_and_release",
        fullCharge: true,
        tactic: tactic?.tactic || "standard"
      }
    ));
  } else {
    plan.steps.push(createStep(
      "shoot_crossbow",
      "Fire loaded crossbow",
      {
        action: "right_click",
        multishot: enchantments.multishot ? "Fires 3 arrows" : null,
        piercing: enchantments.piercing ? `Pierces ${enchantments.piercing} entities` : null
      }
    ));
  }

  // Add tactic information
  if (tactic) {
    plan.tactic = tactic;
  }

  // Calculate expected damage
  const damage = calculateShotDamage(weaponType, {
    powerLevel: enchantments.power || 0,
    chargePercent: 1.0,
    critical: false,
    arrowType: goal.arrowType || "arrow"
  });

  plan.outcome = {
    weapon: weaponType,
    ammo: ammoReq.arrowType,
    damage: damage.totalDamage,
    distance: distance ? Math.round(distance) : null,
    tactic: tactic?.tactic || "standard"
  };

  return plan;
}

/**
 * Plan crossbow loading
 * @param {object} goal - Loading goal
 * @param {object} context - Game context
 * @returns {object} Loading plan
 */
function planCrossbowLoad(goal = {}, context = {}) {
  const inventory = context.inventory || {};

  const plan = createPlan("load_crossbow", "Load crossbow", {
    priority: "normal",
    estimatedDuration: 1.25
  });

  const crossbow = inventory.crossbow;
  if (!crossbow) {
    plan.status = "blocked";
    plan.error = "No crossbow in inventory";
    return plan;
  }

  const quickChargeLevel = crossbow.enchantments?.quick_charge || 0;
  const loadTime = calculateCrossbowLoadTime(quickChargeLevel);

  plan.steps.push(createStep(
    "hold_right_click",
    "Hold right-click to load crossbow",
    {
      duration: loadTime.actualLoadTime,
      quickChargeLevel,
      note: quickChargeLevel > 0 ? `Quick Charge ${quickChargeLevel} reduces load time by ${loadTime.reductionPercent}%` : null
    }
  ));

  plan.outcome = {
    loadTime: loadTime.actualLoadTime,
    shotsPerMinute: loadTime.shotsPerMinute
  };

  return plan;
}

/* =====================================================
 * EXPORTS
 * ===================================================== */

export default planRangedTask;
export {
  RANGED_WEAPONS,
  ARROW_TYPES,
  RANGED_CONFIG,
  getRangedWeaponInfo,
  getArrowInfo,
  calculateShotDamage,
  calculateCrossbowLoadTime,
  getBestRangedTactic,
  checkAmmoRequirements,
  planCrossbowLoad
};
