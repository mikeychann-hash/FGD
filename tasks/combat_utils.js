// tasks/combat_utils.js
// Shared combat utilities for plan_combat.js and plan_guard.js

import {
  normalizeItemName,
  hasInventoryItem,
  extractInventory
} from "./helpers.js";

// ============================================================================
// CONSTANTS
// ============================================================================

export const COMBAT_CONSTANTS = {
  // Durability thresholds
  DURABILITY_CRITICAL_THRESHOLD: 0.25,
  DURABILITY_LOW_THRESHOLD: 0.50,

  // Health thresholds
  HEALTH_CRITICAL_THRESHOLD: 0.25,
  HEALTH_LOW_THRESHOLD: 0.35,
  HEALTH_HEALER_THRESHOLD: 0.50,
  HEALTH_ALLY_THRESHOLD: 0.30,

  // Equipment defaults
  DEFAULT_PRIMARY_WEAPON: "sword",
  DEFAULT_SECONDARY_WEAPON: "shield",
  DEFAULT_ARMOR: "armor",

  // Stance defaults
  DEFAULT_STANCE: "defensive",

  // Unspecified item marker
  UNSPECIFIED_ITEM: "unspecified item"
};

// Enemy threat priority data
export const ENEMY_PROFILES = {
  "charged creeper": {
    priority: 1,
    reason: "Explosion is instantly lethal in close quarters.",
    dodge: "Pepper with ranged attacks and retreat before detonation.",
    risk: "Charged creeper blast radius will obliterate armor and terrain."
  },
  creeper: {
    priority: 1,
    reason: "Explodes for massive burst damage.",
    dodge: "Keep 6-block distance, strike, then backpedal to avoid the fuse.",
    risk: "Explosion can be fatal and destroy nearby structures."
  },
  "wither skeleton": {
    priority: 1,
    reason: "Inflicts wither effect and high melee damage.",
    dodge: "Use shield blocks and strafe to avoid their sweeping attacks.",
    risk: "Wither effect drains health rapidly if multiple hits land."
  },
  ghast: {
    priority: 1,
    reason: "Fireballs deal splash damage and knockback over voids.",
    dodge: "Strafe laterally and reflect fireballs with melee swings or arrows.",
    risk: "Fireball knockback can throw you into lava or off ledges."
  },
  evoker: {
    priority: 1,
    reason: "Summons vex and fang attacks if left alive.",
    dodge: "Close distance quickly, circle around fangs, and burst them down.",
    risk: "Vex summons overwhelm unprepared fighters quickly."
  },
  blaze: {
    priority: 2,
    reason: "Ranged fireballs ignite and stagger combatants.",
    dodge: "Strafe between fireball volleys and use cover while closing in.",
    risk: "Sustained fire damage requires fire resistance or constant dodging."
  },
  skeleton: {
    priority: 2,
    reason: "Ranged arrows whittle health from distance.",
    dodge: "Shield up while closing, or use cover to advance safely.",
    risk: "Skeleton swarms pin you down with overlapping volleys."
  },
  witch: {
    priority: 2,
    reason: "Throws debilitating potions that weaken and poison.",
    dodge: "Rush in, burst them down before they self-heal.",
    risk: "Poison + Slowness can render you defenseless against follow-up mobs."
  },
  pillager: {
    priority: 2,
    reason: "Rapid crossbow fire with piercing potential.",
    dodge: "Shield stance deflects bolts, then close in for melee finish.",
    risk: "Pillager patrols often outnumber you and converge fast."
  }
};

export const DEFAULT_ENEMY_PROFILE = {
  priority: 4,
  reason: "Standard hostile threat—monitor but lower urgency.",
  dodge: "Circle strafe to reduce incoming hits and retreat if pressure mounts.",
  risk: "Unknown enemy behavior—remain alert for special attacks."
};

// Enemy-specific countermeasure items
export const ENEMY_COUNTERMEASURES = {
  "charged creeper": ["blast protection armor", "bow"],
  creeper: ["blast protection armor", "shield"],
  "wither skeleton": ["milk bucket", "smite sword"],
  ghast: ["bow", "fire resistance potion"],
  evoker: ["milk bucket", "bow"],
  blaze: ["fire resistance potion", "bow"],
  "cave spider": ["milk bucket", "instant health potion"],
  enderman: ["pumpkin helmet", "looting sword"],
  wither: ["milk bucket", "regeneration potion", "smite sword"],
  "elder guardian": ["water breathing potion", "milk bucket", "doors"],
  guardian: ["depth strider boots", "water breathing potion", "doors"],
  skeleton: ["shield", "projectile protection armor"],
  pillager: ["shield", "projectile protection armor"],
  vindicator: ["shield", "strength potion"],
  witch: ["milk bucket", "instant health potion"],
  ravager: ["shield", "strength potion"],
  spider: ["sweeping edge sword"],
  zombie: ["smite sword"],
  husk: ["milk bucket"],
  drowned: ["shield", "respiration helmet"],
  stray: ["shield", "milk bucket"],
  hoglin: ["fire resistance potion", "shield"],
  "piglin brute": ["netherite armor", "shield"],
  zoglin: ["shield", "feather falling boots"],
  phantom: ["bow", "slow falling potion"]
};

// Weapon-to-enemy matchups for optimal loadout
export const WEAPON_MATCHUPS = [
  {
    enemies: ["zombie", "husk", "drowned", "skeleton", "stray", "wither skeleton", "wither"],
    weapon: "smite sword",
    reason: "Smite enchantments amplify damage to undead foes."
  },
  {
    enemies: ["spider", "cave spider"],
    weapon: "bane of arthropods sword",
    reason: "Bane of Arthropods slows and bursts spider mobs."
  },
  {
    enemies: ["creeper", "charged creeper"],
    weapon: "bow",
    reason: "Ranged focus avoids blast radius while detonating creepers safely."
  },
  {
    enemies: ["blaze", "ghast"],
    weapon: "power bow",
    reason: "Strong bows counter airborne fire mobs from range."
  },
  {
    enemies: ["guardian", "elder guardian"],
    weapon: "impaling trident",
    reason: "Impaling tridents shred aquatic guardians underwater."
  },
  {
    enemies: ["ravager", "piglin brute", "zoglin", "hoglin"],
    weapon: "netherite axe",
    reason: "High damage axes break through armored brutes quickly."
  },
  {
    enemies: ["phantom"],
    weapon: "crossbow",
    reason: "Crossbows pierce swooping phantoms during flight."
  }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Normalize optional name, returns empty string for "unspecified item"
 * @param {string} value
 * @returns {string}
 */
function normalizeOptionalName(value) {
  const normalized = normalizeItemName(value);
  return normalized === COMBAT_CONSTANTS.UNSPECIFIED_ITEM ? "" : normalized;
}

/**
 * Calculate durability ratio safely
 * @param {number} current
 * @param {number} max
 * @returns {number|null}
 */
function calculateDurabilityRatio(current, max) {
  if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) {
    return null;
  }
  return current / max;
}

// ============================================================================
// COMBAT EQUIPMENT
// ============================================================================

export const COMBAT_EQUIPMENT = {
  /**
   * Validate equipment against inventory and check for missing items
   * @param {string[]} equipment - List of required equipment items
   * @param {Object} context - Context object containing inventory
   * @returns {Object} Validation result with missing items
   */
  validateEquipment(equipment, context = {}) {
    if (!Array.isArray(equipment) || equipment.length === 0) {
      return {
        valid: false,
        missing: [],
        warnings: ["No equipment specified"]
      };
    }

    const inventory = extractInventory(context);
    const missing = equipment.filter(item => !hasInventoryItem(inventory, item));

    return {
      valid: missing.length === 0,
      missing,
      warnings: missing.length > 0
        ? [`Missing equipment: ${missing.join(", ")}`]
        : []
    };
  },

  /**
   * Suggest optimal loadout based on threat level and scenario
   * @param {Object} options
   * @param {string[]} options.enemyTypes - Types of enemies expected
   * @param {Object} options.context - Context with inventory and state
   * @param {string} options.stance - Combat stance (defensive, aggressive, ranged)
   * @param {Object} options.traits - Player traits (aggression level, etc.)
   * @returns {Object} Suggested loadout with primary/secondary weapons
   */
  suggestLoadout({ enemyTypes = [], context = {}, stance = "defensive", traits = {} }) {
    const inventory = extractInventory(context);
    const normalizedEnemies = enemyTypes.map(name => normalizeItemName(name));

    const recommendedWeapons = new Set();
    const matches = [];

    // Find weapon matchups for specific enemies
    WEAPON_MATCHUPS.forEach(matchup => {
      const hits = normalizedEnemies.filter(name => matchup.enemies.includes(name));
      if (hits.length > 0) {
        const weapon = normalizeOptionalName(matchup.weapon);
        if (weapon) {
          recommendedWeapons.add(weapon);
          matches.push({
            weapon,
            enemies: hits,
            reason: matchup.reason,
            available: hasInventoryItem(inventory, weapon)
          });
        }
      }
    });

    const aggression = typeof traits?.aggression === "number" ? traits.aggression : 0.3;
    const preferMelee = stance !== "ranged";

    // Determine primary weapon
    let primary = COMBAT_CONSTANTS.DEFAULT_PRIMARY_WEAPON;
    if (matches.length > 0) {
      const priorityMatch = matches.find(entry => entry.available) || matches[0];
      if (priorityMatch?.weapon) {
        primary = priorityMatch.weapon;
      }
    } else if (!preferMelee) {
      primary = "bow";
    } else {
      primary = aggression > 0.6 ? "axe" : "sword";
    }

    // Determine secondary weapon
    let secondary = preferMelee
      ? (aggression > 0.6 ? "sword" : "shield")
      : "sword";

    recommendedWeapons.add(primary);
    recommendedWeapons.add(secondary);

    return {
      primary,
      secondary,
      loadout: Array.from(recommendedWeapons),
      matches,
      armor: [COMBAT_CONSTANTS.DEFAULT_ARMOR]
    };
  },

  /**
   * Check combat readiness based on equipment durability and health
   * @param {Object} context - Context with durability and health data
   * @param {string[]} criticalItems - Items critical for the mission
   * @returns {Object} Readiness assessment
   */
  checkReadiness(context = {}, criticalItems = []) {
    const durabilityEntries = this.extractDurabilityEntries(context);
    const issues = [];
    const warnings = [];

    // Check durability of critical items
    durabilityEntries.forEach(entry => {
      const ratio = calculateDurabilityRatio(entry.current, entry.max);
      if (ratio !== null) {
        const isCritical = criticalItems.some(item =>
          normalizeItemName(item) === normalizeItemName(entry.name)
        );

        if (ratio < COMBAT_CONSTANTS.DURABILITY_CRITICAL_THRESHOLD) {
          issues.push(`${entry.name} durability critical (${Math.round(ratio * 100)}%)`);
        } else if (ratio < COMBAT_CONSTANTS.DURABILITY_LOW_THRESHOLD && isCritical) {
          warnings.push(`${entry.name} durability low (${Math.round(ratio * 100)}%)`);
        }
      }
    });

    // Check health status
    const health = context?.bridgeState?.health ?? context?.npc?.health;
    if (typeof health === "number" && health < COMBAT_CONSTANTS.HEALTH_LOW_THRESHOLD) {
      if (health < COMBAT_CONSTANTS.HEALTH_CRITICAL_THRESHOLD) {
        issues.push(`Health critical (${Math.round(health * 100)}%)`);
      } else {
        warnings.push(`Health low (${Math.round(health * 100)}%)`);
      }
    }

    return {
      ready: issues.length === 0,
      issues,
      warnings,
      durabilityEntries
    };
  },

  /**
   * Extract durability information from context
   * @param {Object} context - Context object with durability data
   * @returns {Array} List of durability entries
   */
  extractDurabilityEntries(context = {}) {
    const pools = [
      context?.bridgeState?.equipmentDurability,
      context?.bridgeState?.durability,
      context?.npc?.equipmentDurability,
      context?.npc?.durability,
      context?.equipmentDurability
    ];

    const entries = [];

    pools.forEach(pool => {
      if (!pool) return;

      if (Array.isArray(pool)) {
        pool.forEach(item => {
          if (item && typeof item === "object") {
            const name = normalizeOptionalName(item.name || item.item || item.id);
            const current = Number.isFinite(item.current) ? item.current
              : Number.isFinite(item.durability) ? item.durability : null;
            const max = Number.isFinite(item.max) ? item.max
              : Number.isFinite(item.maxDurability) ? item.maxDurability : null;

            if (name && (Number.isFinite(current) || Number.isFinite(max))) {
              entries.push({ name, current, max });
            }
          }
        });
      } else if (typeof pool === "object") {
        Object.entries(pool).forEach(([rawName, rawValue]) => {
          const name = normalizeOptionalName(rawName);
          if (!name) return;

          if (typeof rawValue === "object") {
            const current = Number.isFinite(rawValue.current) ? rawValue.current
              : Number.isFinite(rawValue.durability) ? rawValue.durability : null;
            const max = Number.isFinite(rawValue.max) ? rawValue.max
              : Number.isFinite(rawValue.maxDurability) ? rawValue.maxDurability : null;

            if (Number.isFinite(current) || Number.isFinite(max)) {
              entries.push({ name, current, max });
            }
          } else if (Number.isFinite(rawValue)) {
            entries.push({ name, current: rawValue, max: null });
          }
        });
      }
    });

    return entries;
  }
};

// ============================================================================
// THREAT ASSESSMENT
// ============================================================================

export const THREAT_ASSESSMENT = {
  /**
   * Evaluate risk level based on enemies and environment
   * @param {Object} options
   * @param {string[]} options.enemyTypes - Types of enemies
   * @param {string} options.environment - Environment description
   * @param {Object} options.context - Additional context
   * @returns {Object} Risk evaluation with hazards and recommendations
   */
  evaluateRisk({ enemyTypes = [], environment = "", context = {} }) {
    const hazards = new Set();
    const advice = [];
    const normalizedEnvironment = normalizeItemName(environment);
    const normalizedEnemies = enemyTypes.map(name => normalizeItemName(name));

    // Environment-based hazards
    if (normalizedEnvironment.includes("nether")) {
      hazards.add("fire");
      hazards.add("lava");
    }
    if (normalizedEnvironment.includes("end")) {
      hazards.add("void fall");
    }
    if (normalizedEnvironment.includes("ocean") || normalizedEnvironment.includes("underwater")) {
      hazards.add("drowning");
    }

    // Enemy-based hazards
    if (normalizedEnemies.includes("blaze")) {
      hazards.add("fire");
      advice.push("Keep fire resistance handy—blaze volleys stack burn damage quickly.");
    }
    if (normalizedEnemies.includes("witch")) {
      hazards.add("poison");
      advice.push("Carry milk or honey to purge poison when witches connect.");
    }
    if (normalizedEnemies.includes("guardian") || normalizedEnemies.includes("elder guardian")) {
      hazards.add("mining fatigue");
    }
    if (normalizedEnemies.includes("hoglin") || normalizedEnemies.includes("ravager")) {
      hazards.add("knockback");
      advice.push("Brace near solid walls to prevent knockback launches.");
    }

    // Weather-based hazards
    const weather = context?.weather ?? context?.bridgeState?.weather;
    if (weather && (weather.includes("storm") || weather.includes("thunder"))) {
      hazards.add("lightning");
    }

    // Get enemy priority levels
    const threatLevels = normalizedEnemies.map(enemy => {
      const profile = ENEMY_PROFILES[enemy] || DEFAULT_ENEMY_PROFILE;
      return profile.priority;
    });

    const highestThreat = threatLevels.length > 0 ? Math.min(...threatLevels) : 4;

    return {
      hazards: Array.from(hazards),
      advice,
      threatLevel: highestThreat,
      enemies: normalizedEnemies.map(enemy => ({
        name: enemy,
        profile: ENEMY_PROFILES[enemy] || DEFAULT_ENEMY_PROFILE
      }))
    };
  },

  /**
   * Calculate combat difficulty rating
   * @param {Object} options
   * @param {number} options.enemyCount - Number of enemies
   * @param {string[]} options.enemyTypes - Types of enemies
   * @param {string} options.environment - Environment description
   * @returns {Object} Difficulty assessment
   */
  calculateDifficulty({ enemyCount = 1, enemyTypes = [], environment = "" }) {
    const normalizedEnemies = enemyTypes.map(name => normalizeItemName(name));

    // Base difficulty from enemy count
    let difficulty = enemyCount;

    // Increase difficulty based on enemy threat levels
    normalizedEnemies.forEach(enemy => {
      const profile = ENEMY_PROFILES[enemy] || DEFAULT_ENEMY_PROFILE;
      if (profile.priority === 1) {
        difficulty += 2; // High priority enemies add more difficulty
      } else if (profile.priority === 2) {
        difficulty += 1;
      }
    });

    // Environment modifiers
    const normalizedEnv = normalizeItemName(environment);
    if (normalizedEnv.includes("nether") || normalizedEnv.includes("end")) {
      difficulty *= 1.5;
    }
    if (normalizedEnv.includes("underwater") || normalizedEnv.includes("ocean")) {
      difficulty *= 1.3;
    }

    // Difficulty rating: easy (< 3), medium (3-6), hard (7-10), extreme (> 10)
    let rating = "easy";
    if (difficulty > 10) rating = "extreme";
    else if (difficulty > 6) rating = "hard";
    else if (difficulty >= 3) rating = "medium";

    return {
      rating,
      score: Math.round(difficulty * 10) / 10,
      enemyCount,
      modifiers: {
        environmentMultiplier: normalizedEnv.includes("nether") || normalizedEnv.includes("end") ? 1.5
          : normalizedEnv.includes("underwater") ? 1.3 : 1.0
      }
    };
  },

  /**
   * Get countermeasures for specific enemies
   * @param {string[]} enemyTypes - Types of enemies
   * @returns {Object} Recommended countermeasures
   */
  getCountermeasures(enemyTypes = []) {
    const normalizedEnemies = enemyTypes.map(name => normalizeItemName(name));
    const allCountermeasures = new Set();
    const byEnemy = {};

    normalizedEnemies.forEach(enemy => {
      const measures = ENEMY_COUNTERMEASURES[enemy] || [];
      byEnemy[enemy] = measures;
      measures.forEach(item => allCountermeasures.add(item));
    });

    return {
      all: Array.from(allCountermeasures),
      byEnemy
    };
  }
};

// ============================================================================
// DEFENSIVE SYSTEMS
// ============================================================================

export const DEFENSIVE_SYSTEMS = {
  /**
   * Fortification options based on scenario
   */
  fortificationOptions: {
    basic: {
      materials: ["cobblestone", "wood planks"],
      description: "Simple wall or barricade for basic protection",
      time: "5-10 minutes"
    },
    reinforced: {
      materials: ["stone bricks", "iron bars", "iron door"],
      description: "Reinforced walls with secure entry points",
      time: "15-20 minutes"
    },
    advanced: {
      materials: ["obsidian", "iron blocks", "redstone", "dispensers"],
      description: "Advanced fortification with traps and automated defenses",
      time: "30+ minutes"
    },
    lighting: {
      materials: ["torches", "glowstone", "sea lanterns"],
      description: "Perimeter lighting to prevent mob spawns",
      time: "5 minutes"
    }
  },

  /**
   * Alarm system options
   */
  alarmSystems: {
    bell: {
      materials: ["bell"],
      range: "Close range audible alert",
      description: "Simple bell mechanism for manual alerts"
    },
    redstone: {
      materials: ["redstone", "note blocks", "observers"],
      range: "Configurable range with repeaters",
      description: "Automated redstone alarm triggered by movement"
    },
    tripwire: {
      materials: ["tripwire hooks", "string", "redstone"],
      range: "Perimeter detection",
      description: "Tripwire perimeter that triggers alerts on breach"
    }
  },

  /**
   * Perimeter defense configurations
   */
  perimeterDefense: {
    walls: {
      materials: ["cobblestone", "stone bricks"],
      height: "3-4 blocks minimum",
      description: "Solid walls to prevent mob entry"
    },
    moat: {
      materials: ["water buckets", "lava buckets"],
      depth: "2-3 blocks",
      description: "Liquid moat to slow or damage approaching mobs"
    },
    traps: {
      materials: ["dispensers", "arrows", "lava", "redstone"],
      description: "Automated traps for hostile mobs"
    },
    lighting: {
      materials: ["torches", "glowstone"],
      spacing: "Every 8-10 blocks",
      description: "Prevent hostile mob spawns in defended area"
    }
  },

  /**
   * Suggest defensive setup based on threat level
   * @param {Object} options
   * @param {string} options.threatLevel - Threat level (low, medium, high, extreme)
   * @param {string[]} options.availableMaterials - Materials available in inventory
   * @param {number} options.timeAvailable - Time available for setup (minutes)
   * @returns {Object} Recommended defensive setup
   */
  suggestDefensiveSetup({ threatLevel = "medium", availableMaterials = [], timeAvailable = 15 }) {
    const recommendations = [];

    // Always recommend lighting
    recommendations.push({
      type: "lighting",
      priority: 1,
      config: this.fortificationOptions.lighting
    });

    // Threat-based recommendations
    if (threatLevel === "high" || threatLevel === "extreme") {
      if (timeAvailable >= 15) {
        recommendations.push({
          type: "fortification",
          priority: 1,
          config: this.fortificationOptions.reinforced
        });
      }
      recommendations.push({
        type: "perimeter",
        priority: 2,
        config: this.perimeterDefense.walls
      });
      recommendations.push({
        type: "alarm",
        priority: 2,
        config: this.alarmSystems.redstone
      });
    } else if (threatLevel === "medium") {
      recommendations.push({
        type: "fortification",
        priority: 2,
        config: this.fortificationOptions.basic
      });
      recommendations.push({
        type: "alarm",
        priority: 3,
        config: this.alarmSystems.bell
      });
    } else {
      recommendations.push({
        type: "alarm",
        priority: 3,
        config: this.alarmSystems.bell
      });
    }

    return {
      recommendations: recommendations.sort((a, b) => a.priority - b.priority),
      estimatedTime: recommendations.reduce((sum, rec) => {
        // Parse time from config
        const timeStr = rec.config.time;
        if (timeStr) {
          const match = timeStr.match(/(\d+)/);
          return sum + (match ? parseInt(match[1], 10) : 0);
        }
        return sum;
      }, 0)
    };
  }
};
