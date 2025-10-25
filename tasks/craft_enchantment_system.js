// tasks/craft_enchantment_system.js
// Enchantment suggestions and quality tier system

import { normalizeItemName } from "./helpers.js";

// Enchantment database by item type
export const ENCHANTMENT_DATABASE = {
  pickaxe: {
    essential: ["efficiency", "unbreaking"],
    recommended: ["fortune", "mending"],
    situational: ["silk_touch"],
    conflicts: [["fortune", "silk_touch"]],
    purpose: {
      mining: ["efficiency_v", "unbreaking_iii", "fortune_iii", "mending"],
      ore_gathering: ["efficiency_v", "fortune_iii", "unbreaking_iii"],
      building: ["efficiency_v", "silk_touch", "unbreaking_iii", "mending"]
    }
  },

  sword: {
    essential: ["sharpness", "unbreaking"],
    recommended: ["mending", "looting"],
    situational: ["sweeping_edge", "fire_aspect", "knockback"],
    conflicts: [["sharpness", "smite"], ["sharpness", "bane_of_arthropods"]],
    purpose: {
      combat: ["sharpness_v", "unbreaking_iii", "mending", "looting_iii"],
      farming_mobs: ["looting_iii", "sweeping_edge_iii", "sharpness_v"],
      undead_hunting: ["smite_v", "unbreaking_iii", "mending"]
    }
  },

  axe: {
    essential: ["efficiency", "unbreaking"],
    recommended: ["mending", "sharpness"],
    situational: ["silk_touch", "fortune"],
    conflicts: [["fortune", "silk_touch"]],
    purpose: {
      woodcutting: ["efficiency_v", "unbreaking_iii", "mending"],
      combat: ["sharpness_v", "efficiency_iv", "unbreaking_iii"],
      stripping_logs: ["efficiency_v", "mending"]
    }
  },

  shovel: {
    essential: ["efficiency", "unbreaking"],
    recommended: ["mending", "silk_touch"],
    situational: ["fortune"],
    conflicts: [["fortune", "silk_touch"]],
    purpose: {
      excavation: ["efficiency_v", "unbreaking_iii", "mending"],
      path_making: ["efficiency_v", "mending"]
    }
  },

  hoe: {
    essential: ["unbreaking"],
    recommended: ["mending", "efficiency"],
    situational: ["fortune", "silk_touch"],
    conflicts: [],
    purpose: {
      farming: ["efficiency_v", "unbreaking_iii", "mending"],
      leaf_breaking: ["efficiency_v", "silk_touch"]
    }
  },

  bow: {
    essential: ["power", "unbreaking"],
    recommended: ["infinity", "mending"],
    situational: ["punch", "flame"],
    conflicts: [["infinity", "mending"]],
    purpose: {
      combat: ["power_v", "infinity", "unbreaking_iii"],
      long_range: ["power_v", "punch_ii"],
      survival: ["power_v", "mending", "unbreaking_iii"]
    }
  },

  crossbow: {
    essential: ["quick_charge", "unbreaking"],
    recommended: ["multishot", "piercing", "mending"],
    situational: [],
    conflicts: [["multishot", "piercing"]],
    purpose: {
      combat: ["quick_charge_iii", "multishot", "unbreaking_iii"],
      mob_farming: ["piercing_iv", "quick_charge_iii"]
    }
  },

  helmet: {
    essential: ["protection", "unbreaking"],
    recommended: ["mending", "respiration"],
    situational: ["aqua_affinity", "thorns"],
    conflicts: [["protection", "blast_protection"], ["protection", "fire_protection"]],
    purpose: {
      general: ["protection_iv", "unbreaking_iii", "mending"],
      underwater: ["respiration_iii", "aqua_affinity", "protection_iv"],
      combat: ["protection_iv", "thorns_iii", "mending"]
    }
  },

  chestplate: {
    essential: ["protection", "unbreaking"],
    recommended: ["mending"],
    situational: ["thorns"],
    conflicts: [["protection", "blast_protection"], ["protection", "fire_protection"]],
    purpose: {
      general: ["protection_iv", "unbreaking_iii", "mending"],
      combat: ["protection_iv", "thorns_iii", "mending"],
      explosive_defense: ["blast_protection_iv", "unbreaking_iii"]
    }
  },

  leggings: {
    essential: ["protection", "unbreaking"],
    recommended: ["mending"],
    situational: ["thorns", "swift_sneak"],
    conflicts: [["protection", "blast_protection"], ["protection", "fire_protection"]],
    purpose: {
      general: ["protection_iv", "unbreaking_iii", "mending"],
      stealth: ["swift_sneak_iii", "protection_iv"],
      combat: ["protection_iv", "thorns_iii"]
    }
  },

  boots: {
    essential: ["protection", "unbreaking"],
    recommended: ["mending", "feather_falling"],
    situational: ["depth_strider", "frost_walker", "soul_speed"],
    conflicts: [["depth_strider", "frost_walker"], ["protection", "blast_protection"]],
    purpose: {
      general: ["protection_iv", "feather_falling_iv", "mending"],
      exploration: ["feather_falling_iv", "depth_strider_iii", "unbreaking_iii"],
      nether: ["soul_speed_iii", "protection_iv", "mending"]
    }
  },

  fishing_rod: {
    essential: ["unbreaking"],
    recommended: ["luck_of_the_sea", "lure", "mending"],
    situational: [],
    conflicts: [],
    purpose: {
      fishing: ["luck_of_the_sea_iii", "lure_iii", "unbreaking_iii", "mending"]
    }
  },

  trident: {
    essential: ["unbreaking"],
    recommended: ["mending", "loyalty"],
    situational: ["riptide", "channeling", "impaling"],
    conflicts: [["loyalty", "riptide"], ["channeling", "riptide"]],
    purpose: {
      combat: ["impaling_v", "loyalty_iii", "mending"],
      travel: ["riptide_iii", "mending"],
      utility: ["channeling", "loyalty_iii", "impaling_v"]
    }
  },

  elytra: {
    essential: ["unbreaking"],
    recommended: ["mending"],
    situational: [],
    conflicts: [],
    purpose: {
      flying: ["unbreaking_iii", "mending"]
    }
  }
};

// Enchantment level costs (XP levels)
export const ENCHANTMENT_COSTS = {
  efficiency_i: 1,
  efficiency_ii: 2,
  efficiency_iii: 3,
  efficiency_iv: 4,
  efficiency_v: 5,
  unbreaking_i: 1,
  unbreaking_ii: 2,
  unbreaking_iii: 3,
  fortune_i: 2,
  fortune_ii: 3,
  fortune_iii: 4,
  silk_touch: 1,
  sharpness_i: 1,
  sharpness_ii: 2,
  sharpness_iii: 3,
  sharpness_iv: 4,
  sharpness_v: 5,
  looting_i: 2,
  looting_ii: 3,
  looting_iii: 4,
  mending: 1,
  protection_i: 1,
  protection_ii: 2,
  protection_iii: 3,
  protection_iv: 4,
  power_i: 1,
  power_ii: 2,
  power_iii: 3,
  power_iv: 4,
  power_v: 5,
  infinity: 1,
  feather_falling_i: 1,
  feather_falling_ii: 2,
  feather_falling_iii: 3,
  feather_falling_iv: 4,
  respiration_i: 2,
  respiration_ii: 3,
  respiration_iii: 4,
  aqua_affinity: 1,
  depth_strider_i: 2,
  depth_strider_ii: 3,
  depth_strider_iii: 4
};

// Lapis lazuli cost (1-3 per enchantment)
export const LAPIS_COST = {
  low: 1,
  medium: 2,
  high: 3
};

// Quality tier definitions
export const QUALITY_TIERS = {
  basic: {
    name: "Basic",
    enchantments: [],
    durability: 1.0,
    description: "Unenchanted tool, standard durability"
  },
  enhanced: {
    name: "Enhanced",
    enchantments: ["efficiency_iii", "unbreaking_i"],
    durability: 2.0,
    description: "Basic enchantments for improved performance",
    cost: { xp: 4, lapis: 2 }
  },
  superior: {
    name: "Superior",
    enchantments: ["efficiency_iv", "unbreaking_ii", "fortune_ii"],
    durability: 3.0,
    description: "Advanced enchantments for serious use",
    cost: { xp: 9, lapis: 3 }
  },
  masterwork: {
    name: "Masterwork",
    enchantments: ["efficiency_v", "unbreaking_iii", "fortune_iii", "mending"],
    durability: 4.0,
    description: "Perfect enchantments, near-infinite durability with mending",
    cost: { xp: 13, lapis: 4 }
  }
};

/**
 * Suggest enchantments for an item based on purpose
 * @param {string} item - Item name (pickaxe, sword, etc.)
 * @param {string} purpose - Intended use (mining, combat, etc.)
 * @returns {Object} Enchantment suggestions
 */
export function suggestEnchantments(item, purpose = null) {
  const normalized = normalizeItemName(item);

  // Extract item type (e.g., "diamond_pickaxe" -> "pickaxe")
  const itemType = normalized.split("_").pop();

  const enchData = ENCHANTMENT_DATABASE[itemType];

  if (!enchData) {
    return {
      error: `No enchantment data for ${normalized}`,
      availableTypes: Object.keys(ENCHANTMENT_DATABASE)
    };
  }

  let recommended = [];

  if (purpose && enchData.purpose && enchData.purpose[purpose]) {
    recommended = enchData.purpose[purpose];
  } else {
    // Default recommendation: essential + recommended
    recommended = [
      ...enchData.essential.map(e => `${e}_iii`),
      ...enchData.recommended.slice(0, 2).map(e => e === "mending" ? e : `${e}_iii`)
    ];
  }

  return {
    item: normalized,
    itemType: itemType,
    purpose: purpose || "general",
    essential: enchData.essential,
    recommended: enchData.recommended,
    situational: enchData.situational,
    conflicts: enchData.conflicts,
    suggestedSet: recommended,
    availablePurposes: enchData.purpose ? Object.keys(enchData.purpose) : [],
    warnings: generateEnchantmentWarnings(recommended, enchData.conflicts)
  };
}

/**
 * Calculate XP and lapis cost for enchantments
 * @param {string} item - Item to enchant
 * @param {Array} enchantments - List of enchantments
 * @returns {Object} Cost breakdown
 */
export function calculateEnchantmentCost(item, enchantments = []) {
  if (!Array.isArray(enchantments) || enchantments.length === 0) {
    return {
      error: "Enchantments array required",
      example: ["efficiency_v", "unbreaking_iii", "mending"]
    };
  }

  let totalXP = 0;
  let totalLapis = 0;
  const costBreakdown = [];
  const unknownEnchantments = [];

  for (const enchantment of enchantments) {
    const normalized = normalizeItemName(enchantment);
    const xpCost = ENCHANTMENT_COSTS[normalized];

    if (xpCost === undefined) {
      unknownEnchantments.push(normalized);
      continue;
    }

    // Lapis cost is typically 1-3 based on XP cost
    const lapisCost = xpCost <= 2 ? LAPIS_COST.low : xpCost <= 4 ? LAPIS_COST.medium : LAPIS_COST.high;

    totalXP += xpCost;
    totalLapis += lapisCost;

    costBreakdown.push({
      enchantment: normalized,
      xpLevels: xpCost,
      lapis: lapisCost
    });
  }

  // Prior work penalty (doubles each time, max 39 levels)
  const baseAnvilCost = 1;
  const combineCost = Math.ceil(totalXP * 0.4); // Anvil combining costs ~40% of enchantment levels

  return {
    item: item,
    enchantments: enchantments,
    totalXPLevels: totalXP,
    totalLapis: totalLapis,
    anvilCombineCost: combineCost,
    totalWithAnvil: totalXP + combineCost,
    costBreakdown: costBreakdown,
    unknownEnchantments: unknownEnchantments,
    recommendation: totalXP > 30
      ? "Very expensive! Consider getting books from villagers or fishing"
      : totalXP > 15
      ? "Moderately expensive. Ensure you have enough XP before starting."
      : "Affordable enchantment set"
  };
}

/**
 * Get quality tier for an item based on enchantments
 * @param {string} item - Item name
 * @param {Array} enchantments - Current enchantments on item
 * @returns {Object} Quality tier assessment
 */
export function assessQualityTier(item, enchantments = []) {
  if (!Array.isArray(enchantments)) {
    enchantments = [];
  }

  const enchantmentCount = enchantments.length;
  const hasMending = enchantments.some(e => normalizeItemName(e).includes("mending"));
  const hasMaxLevel = enchantments.some(e => e.includes("_v") || e.includes("_iv"));
  const hasUnbreakingIII = enchantments.some(e => normalizeItemName(e) === "unbreaking_iii");

  let tier = "basic";
  let score = 0;

  if (enchantmentCount === 0) {
    tier = "basic";
    score = 0;
  } else if (enchantmentCount <= 2 && !hasMaxLevel) {
    tier = "enhanced";
    score = 25;
  } else if (enchantmentCount >= 3 && hasMaxLevel) {
    tier = "superior";
    score = 60;
  }

  if (hasMending && hasUnbreakingIII && hasMaxLevel && enchantmentCount >= 4) {
    tier = "masterwork";
    score = 100;
  }

  const tierInfo = QUALITY_TIERS[tier];

  return {
    item: item,
    currentEnchantments: enchantments,
    tier: tier,
    tierName: tierInfo.name,
    score: score,
    description: tierInfo.description,
    durabilityMultiplier: tierInfo.durability,
    upgradePath: score < 100 ? suggestUpgrade(tier, enchantments) : null,
    isPerfect: tier === "masterwork"
  };
}

/**
 * Suggest upgrades to reach next quality tier
 * @param {string} currentTier - Current quality tier
 * @param {Array} currentEnchantments - Current enchantments
 * @returns {Object} Upgrade suggestions
 */
function suggestUpgrade(currentTier, currentEnchantments) {
  const tiers = ["basic", "enhanced", "superior", "masterwork"];
  const currentIndex = tiers.indexOf(currentTier);

  if (currentIndex === -1 || currentIndex >= tiers.length - 1) {
    return null;
  }

  const nextTier = tiers[currentIndex + 1];
  const nextTierInfo = QUALITY_TIERS[nextTier];
  const missingEnchantments = nextTierInfo.enchantments.filter(
    e => !currentEnchantments.some(ce => normalizeItemName(ce) === normalizeItemName(e))
  );

  return {
    nextTier: nextTier,
    nextTierName: nextTierInfo.name,
    missingEnchantments: missingEnchantments,
    estimatedCost: nextTierInfo.cost,
    recommendation: `Add ${missingEnchantments.join(", ")} to reach ${nextTierInfo.name} tier`
  };
}

/**
 * Check for enchantment conflicts
 * @param {Array} enchantments - Proposed enchantments
 * @param {Array} conflicts - Known conflicts
 * @returns {Array} List of warnings
 */
function generateEnchantmentWarnings(enchantments, conflicts) {
  const warnings = [];

  for (const [ench1, ench2] of conflicts) {
    const has1 = enchantments.some(e => e.includes(ench1));
    const has2 = enchantments.some(e => e.includes(ench2));

    if (has1 && has2) {
      warnings.push(`⚠️ Conflict: ${ench1} and ${ench2} cannot be combined on the same item`);
    }
  }

  return warnings;
}

/**
 * Get optimal enchantment order for anvil combining
 * @param {Array} enchantments - Enchantments to apply
 * @returns {Object} Optimal order to minimize XP cost
 */
export function optimizeEnchantmentOrder(enchantments) {
  if (!Array.isArray(enchantments) || enchantments.length === 0) {
    return { error: "Enchantments array required" };
  }

  // Sort by XP cost (apply expensive enchantments last to minimize prior work penalty)
  const sorted = enchantments
    .map(e => ({
      name: e,
      cost: ENCHANTMENT_COSTS[normalizeItemName(e)] || 0
    }))
    .sort((a, b) => a.cost - b.cost);

  const order = sorted.map((e, index) => ({
    step: index + 1,
    enchantment: e.name,
    xpCost: e.cost,
    cumulativePenalty: Math.pow(2, index) - 1,
    totalCost: e.cost + (Math.pow(2, index) - 1)
  }));

  const totalCost = order.reduce((sum, step) => sum + step.totalCost, 0);

  return {
    enchantments: enchantments,
    optimalOrder: order,
    totalXPCost: totalCost,
    recommendation: "Apply enchantments in this order to minimize XP cost",
    tip: "Combine books first, then apply to tool to save XP"
  };
}

/**
 * Suggest enchantment strategy based on resources
 * @param {Object} resources - Available resources (XP, lapis, books)
 * @returns {Object} Strategy recommendation
 */
export function suggestEnchantmentStrategy(resources = {}) {
  const xpLevels = resources.xpLevels || 0;
  const lapis = resources.lapis || 0;
  const books = resources.books || 0;
  const hasEnchantingTable = resources.enchantingTable || false;
  const hasAnvil = resources.anvil || false;
  const hasVillagers = resources.villagers || false;

  const strategies = [];

  if (xpLevels >= 30 && lapis >= 3 && hasEnchantingTable) {
    strategies.push({
      method: "enchanting_table",
      viability: "excellent",
      description: "Use enchanting table for random enchantments",
      cost: "3 lapis + 1-3 XP levels per enchantment",
      pros: ["Random but often powerful", "Can get multiple enchantments at once"],
      cons: ["RNG-based", "May need multiple attempts"]
    });
  }

  if (hasAnvil && books > 0) {
    strategies.push({
      method: "anvil_books",
      viability: "good",
      description: "Combine enchanted books using anvil",
      cost: "XP levels based on enchantments",
      pros: ["Precise control", "Combine multiple books"],
      cons: ["Expensive", "Prior work penalty", "Need books"]
    });
  }

  if (hasVillagers) {
    strategies.push({
      method: "villager_trading",
      viability: "excellent",
      description: "Trade with librarian villagers for specific books",
      cost: "Emeralds + book/lapis",
      pros: ["Guaranteed enchantments", "Renewable", "Can get Mending"],
      cons: ["Requires villager setup", "Need emeralds"]
    });
  }

  strategies.push({
    method: "fishing",
    viability: xpLevels < 10 ? "good" : "alternative",
    description: "Fish for enchanted books",
    cost: "Time + fishing rod",
    pros: ["Free", "Can get rare enchantments", "Also get other loot"],
    cons: ["Slow", "Random", "Need luck of the sea"]
  });

  const bestStrategy = strategies.reduce((best, curr) =>
    curr.viability === "excellent" ? curr : best
  , strategies[0]);

  return {
    resources: resources,
    availableStrategies: strategies,
    recommendedStrategy: bestStrategy.method,
    recommendation: bestStrategy.description,
    warning: xpLevels < 10 && !hasVillagers
      ? "Low on XP and no villagers. Consider fishing or mob farming for XP."
      : null
  };
}
