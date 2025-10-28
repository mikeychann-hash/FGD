// tasks/plan_eat.js
// Food consumption and hunger management system
// Implements eating mechanics, hunger tracking, saturation, and health regeneration

import {
  createPlan,
  createStep,
  describeTarget,
  normalizeItemName,
  extractInventory,
  hasInventoryItem
} from "./helpers.js";

/* =====================================================
 * FOOD DATABASE SYSTEM
 * Complete nutrition profiles for all consumable items
 * ===================================================== */

const FOOD_DATABASE = {
  // Basic crops and vegetables
  apple: {
    hunger: 4,
    saturation: 2.4,
    eatTime: 1.6,
    effects: [],
    category: "fruit",
    stackSize: 64
  },
  golden_apple: {
    hunger: 4,
    saturation: 9.6,
    eatTime: 1.6,
    effects: [
      { type: "regeneration", duration: 5, amplifier: 1 },
      { type: "absorption", duration: 120, amplifier: 0 }
    ],
    category: "special",
    stackSize: 64,
    alwaysEdible: true
  },
  enchanted_golden_apple: {
    hunger: 4,
    saturation: 9.6,
    eatTime: 1.6,
    effects: [
      { type: "regeneration", duration: 20, amplifier: 4 },
      { type: "absorption", duration: 120, amplifier: 3 },
      { type: "resistance", duration: 300, amplifier: 0 },
      { type: "fire_resistance", duration: 300, amplifier: 0 }
    ],
    category: "legendary",
    stackSize: 64,
    alwaysEdible: true
  },
  carrot: {
    hunger: 3,
    saturation: 3.6,
    eatTime: 1.6,
    effects: [],
    category: "vegetable",
    stackSize: 64
  },
  golden_carrot: {
    hunger: 6,
    saturation: 14.4,
    eatTime: 1.6,
    effects: [],
    category: "special",
    stackSize: 64
  },
  potato: {
    hunger: 1,
    saturation: 0.6,
    eatTime: 1.6,
    effects: [],
    category: "vegetable",
    stackSize: 64
  },
  baked_potato: {
    hunger: 5,
    saturation: 6.0,
    eatTime: 1.6,
    effects: [],
    category: "cooked",
    stackSize: 64
  },
  poisonous_potato: {
    hunger: 2,
    saturation: 1.2,
    eatTime: 1.6,
    effects: [{ type: "poison", duration: 5, amplifier: 0, chance: 0.6 }],
    category: "dangerous",
    stackSize: 64
  },
  beetroot: {
    hunger: 1,
    saturation: 1.2,
    eatTime: 1.6,
    effects: [],
    category: "vegetable",
    stackSize: 64
  },
  beetroot_soup: {
    hunger: 6,
    saturation: 7.2,
    eatTime: 1.6,
    effects: [],
    category: "meal",
    stackSize: 1,
    returnItem: "bowl"
  },
  sweet_berries: {
    hunger: 2,
    saturation: 1.2,
    eatTime: 1.6,
    effects: [],
    category: "fruit",
    stackSize: 64
  },
  glow_berries: {
    hunger: 2,
    saturation: 1.2,
    eatTime: 1.6,
    effects: [],
    category: "fruit",
    stackSize: 64
  },
  melon_slice: {
    hunger: 2,
    saturation: 1.2,
    eatTime: 1.6,
    effects: [],
    category: "fruit",
    stackSize: 64
  },

  // Bread and baked goods
  bread: {
    hunger: 5,
    saturation: 6.0,
    eatTime: 1.6,
    effects: [],
    category: "baked",
    stackSize: 64
  },
  cookie: {
    hunger: 2,
    saturation: 0.4,
    eatTime: 1.6,
    effects: [],
    category: "baked",
    stackSize: 64
  },
  cake: {
    hunger: 14, // 7 slices × 2 hunger each
    saturation: 2.8,
    eatTime: 0, // Instant per slice
    effects: [],
    category: "baked",
    stackSize: 1,
    sliceable: true,
    slices: 7
  },
  pumpkin_pie: {
    hunger: 8,
    saturation: 4.8,
    eatTime: 1.6,
    effects: [],
    category: "baked",
    stackSize: 64
  },

  // Raw meats
  beef: {
    hunger: 3,
    saturation: 1.8,
    eatTime: 1.6,
    effects: [],
    category: "raw_meat",
    stackSize: 64,
    cookable: "cooked_beef"
  },
  raw_beef: {
    hunger: 3,
    saturation: 1.8,
    eatTime: 1.6,
    effects: [],
    category: "raw_meat",
    stackSize: 64,
    cookable: "cooked_beef"
  },
  porkchop: {
    hunger: 3,
    saturation: 1.8,
    eatTime: 1.6,
    effects: [],
    category: "raw_meat",
    stackSize: 64,
    cookable: "cooked_porkchop"
  },
  raw_porkchop: {
    hunger: 3,
    saturation: 1.8,
    eatTime: 1.6,
    effects: [],
    category: "raw_meat",
    stackSize: 64,
    cookable: "cooked_porkchop"
  },
  chicken: {
    hunger: 2,
    saturation: 1.2,
    eatTime: 1.6,
    effects: [{ type: "hunger", duration: 30, amplifier: 0, chance: 0.3 }],
    category: "raw_meat",
    stackSize: 64,
    cookable: "cooked_chicken"
  },
  raw_chicken: {
    hunger: 2,
    saturation: 1.2,
    eatTime: 1.6,
    effects: [{ type: "hunger", duration: 30, amplifier: 0, chance: 0.3 }],
    category: "raw_meat",
    stackSize: 64,
    cookable: "cooked_chicken"
  },
  mutton: {
    hunger: 2,
    saturation: 1.2,
    eatTime: 1.6,
    effects: [],
    category: "raw_meat",
    stackSize: 64,
    cookable: "cooked_mutton"
  },
  raw_mutton: {
    hunger: 2,
    saturation: 1.2,
    eatTime: 1.6,
    effects: [],
    category: "raw_meat",
    stackSize: 64,
    cookable: "cooked_mutton"
  },
  rabbit: {
    hunger: 3,
    saturation: 1.8,
    eatTime: 1.6,
    effects: [],
    category: "raw_meat",
    stackSize: 64,
    cookable: "cooked_rabbit"
  },
  raw_rabbit: {
    hunger: 3,
    saturation: 1.8,
    eatTime: 1.6,
    effects: [],
    category: "raw_meat",
    stackSize: 64,
    cookable: "cooked_rabbit"
  },

  // Cooked meats
  cooked_beef: {
    hunger: 8,
    saturation: 12.8,
    eatTime: 1.6,
    effects: [],
    category: "cooked_meat",
    stackSize: 64
  },
  steak: {
    hunger: 8,
    saturation: 12.8,
    eatTime: 1.6,
    effects: [],
    category: "cooked_meat",
    stackSize: 64
  },
  cooked_porkchop: {
    hunger: 8,
    saturation: 12.8,
    eatTime: 1.6,
    effects: [],
    category: "cooked_meat",
    stackSize: 64
  },
  cooked_chicken: {
    hunger: 6,
    saturation: 7.2,
    eatTime: 1.6,
    effects: [],
    category: "cooked_meat",
    stackSize: 64
  },
  cooked_mutton: {
    hunger: 6,
    saturation: 9.6,
    eatTime: 1.6,
    effects: [],
    category: "cooked_meat",
    stackSize: 64
  },
  cooked_rabbit: {
    hunger: 5,
    saturation: 6.0,
    eatTime: 1.6,
    effects: [],
    category: "cooked_meat",
    stackSize: 64
  },

  // Fish
  cod: {
    hunger: 2,
    saturation: 0.4,
    eatTime: 1.6,
    effects: [],
    category: "raw_fish",
    stackSize: 64,
    cookable: "cooked_cod"
  },
  raw_cod: {
    hunger: 2,
    saturation: 0.4,
    eatTime: 1.6,
    effects: [],
    category: "raw_fish",
    stackSize: 64,
    cookable: "cooked_cod"
  },
  salmon: {
    hunger: 2,
    saturation: 0.4,
    eatTime: 1.6,
    effects: [],
    category: "raw_fish",
    stackSize: 64,
    cookable: "cooked_salmon"
  },
  raw_salmon: {
    hunger: 2,
    saturation: 0.4,
    eatTime: 1.6,
    effects: [],
    category: "raw_fish",
    stackSize: 64,
    cookable: "cooked_salmon"
  },
  tropical_fish: {
    hunger: 1,
    saturation: 0.2,
    eatTime: 1.6,
    effects: [],
    category: "raw_fish",
    stackSize: 64
  },
  pufferfish: {
    hunger: 1,
    saturation: 0.2,
    eatTime: 1.6,
    effects: [
      { type: "poison", duration: 60, amplifier: 1 },
      { type: "hunger", duration: 15, amplifier: 2 },
      { type: "nausea", duration: 15, amplifier: 0 }
    ],
    category: "dangerous",
    stackSize: 64
  },
  cooked_cod: {
    hunger: 5,
    saturation: 6.0,
    eatTime: 1.6,
    effects: [],
    category: "cooked_fish",
    stackSize: 64
  },
  cooked_salmon: {
    hunger: 6,
    saturation: 9.6,
    eatTime: 1.6,
    effects: [],
    category: "cooked_fish",
    stackSize: 64
  },

  // Soups and stews
  mushroom_stew: {
    hunger: 6,
    saturation: 7.2,
    eatTime: 1.6,
    effects: [],
    category: "meal",
    stackSize: 1,
    returnItem: "bowl"
  },
  rabbit_stew: {
    hunger: 10,
    saturation: 12.0,
    eatTime: 1.6,
    effects: [],
    category: "meal",
    stackSize: 1,
    returnItem: "bowl"
  },
  suspicious_stew: {
    hunger: 6,
    saturation: 7.2,
    eatTime: 1.6,
    effects: [], // Variable based on flower used
    category: "special",
    stackSize: 1,
    returnItem: "bowl"
  },

  // Other foods
  rotten_flesh: {
    hunger: 4,
    saturation: 0.8,
    eatTime: 1.6,
    effects: [{ type: "hunger", duration: 30, amplifier: 0, chance: 0.8 }],
    category: "dangerous",
    stackSize: 64
  },
  spider_eye: {
    hunger: 2,
    saturation: 3.2,
    eatTime: 1.6,
    effects: [{ type: "poison", duration: 5, amplifier: 0 }],
    category: "dangerous",
    stackSize: 64
  },
  chorus_fruit: {
    hunger: 4,
    saturation: 2.4,
    eatTime: 1.6,
    effects: [{ type: "teleport", range: 8 }],
    category: "special",
    stackSize: 64,
    alwaysEdible: true
  },
  dried_kelp: {
    hunger: 1,
    saturation: 0.6,
    eatTime: 0.865,
    effects: [],
    category: "vegetable",
    stackSize: 64
  },
  honey_bottle: {
    hunger: 6,
    saturation: 1.2,
    eatTime: 2.0,
    effects: [{ type: "cure_poison" }],
    category: "special",
    stackSize: 16,
    returnItem: "glass_bottle"
  }
};

/* =====================================================
 * HUNGER SYSTEM
 * Tracks hunger, saturation, and exhaustion
 * ===================================================== */

const HUNGER_CONFIG = {
  maxHunger: 20, // 10 drumsticks × 2
  maxSaturation: 20, // Hidden saturation buffer
  exhaustionThreshold: 4.0, // Depletes 1 hunger when reached

  // Hunger depletion rates (exhaustion per action)
  depletionRates: {
    walking: 0.0,
    sprinting: 0.1,
    jumping: 0.05,
    swimming: 0.01,
    breaking_block: 0.005,
    attacking: 0.1,
    taking_damage: 0.1,
    hunger_effect: 0.1, // per second with hunger effect
    jumping_sprint: 0.2
  },

  // Health regeneration
  regeneration: {
    enabled: true,
    hungerThreshold: 18, // Need 9+ drumsticks
    saturationThreshold: 0.1, // Need some saturation
    healthPerTick: 0.5, // Heal 1 HP every 2 seconds
    exhaustionCost: 6.0 // Exhaustion per HP healed
  },

  // Starvation damage
  starvation: {
    enabled: true,
    hungerThreshold: 0, // Below 0 hunger
    damageInterval: 4.0, // seconds
    damage: {
      easy: 0, // No damage on easy
      normal: 1, // Half heart per 4s, stops at 1 HP
      hard: 1 // Half heart per 4s, can kill
    },
    minHealth: {
      easy: 10,
      normal: 1,
      hard: 0
    }
  }
};

/**
 * Get food profile
 * @param {string} foodName - Name of the food item
 * @returns {object|null} Food profile or null
 */
function getFoodProfile(foodName) {
  const normalized = normalizeItemName(foodName);
  return FOOD_DATABASE[normalized] || null;
}

/**
 * Check if item is edible
 * @param {string} itemName - Item name
 * @returns {boolean} True if item is food
 */
function isEdible(itemName) {
  return getFoodProfile(itemName) !== null;
}

/**
 * Check if food can be eaten (hunger not full or always edible)
 * @param {string} foodName - Food item name
 * @param {number} currentHunger - Current hunger level (0-20)
 * @returns {boolean} True if can be eaten
 */
function canEat(foodName, currentHunger = 20) {
  const food = getFoodProfile(foodName);
  if (!food) return false;

  // Some foods can always be eaten
  if (food.alwaysEdible) return true;

  // Normal foods require hunger < max
  return currentHunger < HUNGER_CONFIG.maxHunger;
}

/**
 * Calculate eating outcome
 * @param {string} foodName - Food being eaten
 * @param {object} hungerState - Current hunger state
 * @returns {object} Eating outcome with new state and effects
 */
function calculateEatingOutcome(foodName, hungerState = {}) {
  const food = getFoodProfile(foodName);
  if (!food) {
    return {
      success: false,
      error: "Not a valid food item"
    };
  }

  const current = {
    hunger: hungerState.hunger || 20,
    saturation: hungerState.saturation || 5,
    exhaustion: hungerState.exhaustion || 0
  };

  // Calculate new hunger and saturation
  const newHunger = Math.min(HUNGER_CONFIG.maxHunger, current.hunger + food.hunger);
  const newSaturation = Math.min(
    newHunger, // Saturation cannot exceed hunger
    current.saturation + food.saturation
  );

  // Determine status effects
  const effects = [];
  if (food.effects) {
    for (const effect of food.effects) {
      // Check chance if applicable
      if (effect.chance && Math.random() > effect.chance) {
        continue;
      }
      effects.push({
        type: effect.type,
        duration: effect.duration || 0,
        amplifier: effect.amplifier || 0
      });
    }
  }

  return {
    success: true,
    previous: {
      hunger: current.hunger,
      saturation: current.saturation
    },
    new: {
      hunger: newHunger,
      saturation: newSaturation,
      exhaustion: current.exhaustion
    },
    restored: {
      hunger: newHunger - current.hunger,
      saturation: newSaturation - current.saturation
    },
    eatTime: food.eatTime,
    effects: effects,
    returnItem: food.returnItem || null,
    category: food.category
  };
}

/**
 * Get best food to eat from inventory
 * @param {object} inventory - Current inventory
 * @param {object} hungerState - Current hunger state
 * @param {object} preferences - Eating preferences
 * @returns {object|null} Best food choice or null
 */
function getBestFoodChoice(inventory = {}, hungerState = {}, preferences = {}) {
  const current = {
    hunger: hungerState.hunger || 20,
    saturation: hungerState.saturation || 5
  };

  const prefs = {
    avoidRaw: preferences.avoidRaw !== false, // Default true
    avoidDangerous: preferences.avoidDangerous !== false, // Default true
    preferEfficiency: preferences.preferEfficiency !== false, // Default true
    preferEffects: preferences.preferEffects || false,
    ...preferences
  };

  const inventoryItems = extractInventory(inventory);
  const foodChoices = [];

  // Find all edible items
  for (const item of inventoryItems) {
    if (!item || !item.name) continue;

    const food = getFoodProfile(item.name);
    if (!food) continue;
    if (!canEat(item.name, current.hunger)) continue;

    // Apply filters
    if (prefs.avoidRaw && food.category === "raw_meat") continue;
    if (prefs.avoidDangerous && food.category === "dangerous") continue;

    // Calculate efficiency score
    const outcome = calculateEatingOutcome(item.name, hungerState);
    const hungerEfficiency = outcome.restored.hunger / food.eatTime;
    const saturationEfficiency = outcome.restored.saturation / food.eatTime;

    let score = hungerEfficiency + saturationEfficiency;

    // Bonus for beneficial effects
    if (prefs.preferEffects && outcome.effects.length > 0) {
      const beneficialEffects = outcome.effects.filter(e =>
        !["poison", "hunger", "nausea"].includes(e.type)
      );
      score += beneficialEffects.length * 5;
    }

    foodChoices.push({
      name: item.name,
      count: item.count || 1,
      food: food,
      outcome: outcome,
      score: score
    });
  }

  if (foodChoices.length === 0) {
    return null;
  }

  // Sort by score (best first)
  foodChoices.sort((a, b) => b.score - a.score);

  return foodChoices[0];
}

/**
 * Assess hunger situation
 * @param {object} hungerState - Current hunger state
 * @param {object} inventory - Current inventory
 * @returns {object} Hunger assessment with recommendations
 */
function assessHungerSituation(hungerState = {}, inventory = {}) {
  const current = {
    hunger: hungerState.hunger || 20,
    saturation: hungerState.saturation || 5,
    exhaustion: hungerState.exhaustion || 0
  };

  const assessment = {
    urgency: "none",
    hungerLevel: current.hunger,
    saturationLevel: current.saturation,
    percentFull: (current.hunger / HUNGER_CONFIG.maxHunger) * 100,
    canRegenerate: current.hunger >= HUNGER_CONFIG.regeneration.hungerThreshold &&
                   current.saturation >= HUNGER_CONFIG.regeneration.saturationThreshold,
    recommendations: []
  };

  // Determine urgency level
  if (current.hunger === 0) {
    assessment.urgency = "critical";
    assessment.recommendations.push("STARVING - Eat immediately or take damage!");
  } else if (current.hunger <= 6) {
    assessment.urgency = "high";
    assessment.recommendations.push("Very hungry - eat soon to avoid starvation");
  } else if (current.hunger <= 12) {
    assessment.urgency = "medium";
    assessment.recommendations.push("Moderately hungry - consider eating");
  } else if (current.hunger <= 17) {
    assessment.urgency = "low";
    assessment.recommendations.push("Slightly hungry - eat when convenient");
  } else {
    assessment.urgency = "none";
  }

  // Check regeneration capability
  if (!assessment.canRegenerate && current.hunger < HUNGER_CONFIG.maxHunger) {
    assessment.recommendations.push("Cannot regenerate health - hunger below threshold");
  }

  // Check available food
  const bestFood = getBestFoodChoice(inventory, hungerState);
  if (bestFood) {
    assessment.bestFood = bestFood.name;
    assessment.availableFood = true;
  } else {
    assessment.availableFood = false;
    if (assessment.urgency !== "none") {
      assessment.recommendations.push("No suitable food in inventory - gather food urgently!");
    }
  }

  // Saturation warnings
  if (current.saturation < 2 && current.hunger > 6) {
    assessment.recommendations.push("Low saturation - hunger will deplete faster");
  }

  return assessment;
}

/* =====================================================
 * EAT TASK PLANNER
 * Main function for creating eat action plans
 * ===================================================== */

/**
 * Plan eating task
 * @param {object} goal - Task goal with food specifications
 * @param {object} context - Game context (player, inventory, world state)
 * @returns {object} Eating plan
 */
export function planEatTask(goal = {}, context = {}) {
  const foodTarget = goal.food || goal.item;
  const inventory = context.inventory || {};
  const hungerState = context.hungerState || { hunger: 20, saturation: 5 };

  // Assess current situation
  const assessment = assessHungerSituation(hungerState, inventory);

  const plan = createPlan("eat", `Eat food to restore hunger`, {
    priority: assessment.urgency === "critical" ? "high" : "normal",
    estimatedDuration: 2, // seconds
    safety: assessment.urgency === "critical" ? "Find safe location first" : "normal"
  });

  // Determine what to eat
  let foodChoice = null;

  if (foodTarget) {
    // Specific food requested
    const food = getFoodProfile(foodTarget);
    if (!food) {
      plan.status = "failed";
      plan.error = `'${foodTarget}' is not a valid food item`;
      return plan;
    }

    if (!hasInventoryItem(inventory, foodTarget)) {
      plan.status = "failed";
      plan.error = `No ${foodTarget} in inventory`;
      plan.suggestion = `Gather or craft ${foodTarget} first`;
      return plan;
    }

    if (!canEat(foodTarget, hungerState.hunger)) {
      plan.status = "failed";
      plan.error = "Hunger is already full";
      return plan;
    }

    foodChoice = {
      name: foodTarget,
      food: food,
      outcome: calculateEatingOutcome(foodTarget, hungerState)
    };
  } else {
    // Auto-select best food
    const bestFood = getBestFoodChoice(inventory, hungerState, goal.preferences);

    if (!bestFood) {
      plan.status = "failed";
      plan.error = "No suitable food available in inventory";
      plan.suggestion = "Gather food: crops, hunt animals, or fish";
      return plan;
    }

    foodChoice = bestFood;
  }

  // Add eating steps
  const outcome = foodChoice.outcome;

  // Step 1: Find safe location if critical
  if (assessment.urgency === "critical") {
    plan.steps.push(createStep(
      "find_safe_location",
      "Find safe location to eat",
      {
        reason: "Critical hunger - avoid combat during eating"
      }
    ));
  }

  // Step 2: Select food
  plan.steps.push(createStep(
    "select_food",
    `Select ${foodChoice.name} from inventory`,
    {
      item: foodChoice.name,
      slot: "main_hand"
    }
  ));

  // Step 3: Eat food
  plan.steps.push(createStep(
    "eat_food",
    `Eat ${foodChoice.name}`,
    {
      item: foodChoice.name,
      duration: outcome.eatTime,
      interruptible: false,
      outcome: {
        hungerRestored: outcome.restored.hunger,
        saturationRestored: outcome.restored.saturation,
        effects: outcome.effects,
        returnItem: outcome.returnItem
      }
    }
  ));

  // Step 4: Handle return item (bowl, bottle, etc.)
  if (outcome.returnItem) {
    plan.steps.push(createStep(
      "collect_container",
      `Collect ${outcome.returnItem}`,
      {
        item: outcome.returnItem
      }
    ));
  }

  // Add outcome information
  plan.outcome = {
    food: foodChoice.name,
    previous: outcome.previous,
    new: outcome.new,
    restored: outcome.restored,
    effects: outcome.effects,
    assessment: assessment
  };

  // Add warnings for dangerous foods
  if (foodChoice.food.category === "dangerous" && outcome.effects.length > 0) {
    plan.warnings = outcome.effects.map(e =>
      `Eating ${foodChoice.name} will cause ${e.type} for ${e.duration}s`
    );
  }

  return plan;
}

/* =====================================================
 * EXPORTS
 * ===================================================== */

export default planEatTask;
export {
  FOOD_DATABASE,
  HUNGER_CONFIG,
  getFoodProfile,
  isEdible,
  canEat,
  calculateEatingOutcome,
  getBestFoodChoice,
  assessHungerSituation
};
