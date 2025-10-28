// tasks/plan_trade.js
// Villager and wandering trader interaction system
// Implements trading mechanics, villager professions, and emerald economy

import {
  createPlan,
  createStep,
  describeTarget,
  normalizeItemName,
  hasInventoryItem,
  extractInventory
} from "./helpers.js";

/* =====================================================
 * VILLAGER PROFESSIONS DATABASE
 * All villager types and their trade offerings
 * ===================================================== */

const VILLAGER_PROFESSIONS = {
  armorer: {
    workstation: "blast_furnace",
    trades: {
      novice: [
        { buy: "coal", buyCount: 15, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 5, sell: "iron_helmet", sellCount: 1 },
        { buy: "emerald", buyCount: 9, sell: "iron_chestplate", sellCount: 1 },
        { buy: "emerald", buyCount: 5, sell: "iron_leggings", sellCount: 1 },
        { buy: "emerald", buyCount: 4, sell: "iron_boots", sellCount: 1 }
      ],
      apprentice: [
        { buy: "iron_ingot", buyCount: 4, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 36, sell: "bell", sellCount: 1 },
        { buy: "emerald", buyCount: 3, sell: "chainmail_leggings", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "chainmail_boots", sellCount: 1 }
      ],
      journeyman: [
        { buy: "lava_bucket", buyCount: 1, sell: "emerald", sellCount: 1 },
        { buy: "diamond", buyCount: 1, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "chainmail_helmet", sellCount: 1 },
        { buy: "emerald", buyCount: 4, sell: "chainmail_chestplate", sellCount: 1 },
        { buy: "emerald", buyCount: 5, sell: "shield", sellCount: 1 }
      ],
      expert: [
        { buy: "emerald", buyCount: 19-33, sell: "enchanted_diamond_leggings", sellCount: 1 },
        { buy: "emerald", buyCount: 13-27, sell: "enchanted_diamond_boots", sellCount: 1 }
      ],
      master: [
        { buy: "emerald", buyCount: 13-27, sell: "enchanted_diamond_helmet", sellCount: 1 },
        { buy: "emerald", buyCount: 21-35, sell: "enchanted_diamond_chestplate", sellCount: 1 }
      ]
    }
  },

  butcher: {
    workstation: "smoker",
    trades: {
      novice: [
        { buy: "chicken", buyCount: 14, sell: "emerald", sellCount: 1 },
        { buy: "porkchop", buyCount: 7, sell: "emerald", sellCount: 1 },
        { buy: "rabbit", buyCount: 4, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "rabbit_stew", sellCount: 1 }
      ],
      apprentice: [
        { buy: "coal", buyCount: 15, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "cooked_porkchop", sellCount: 5 },
        { buy: "emerald", buyCount: 1, sell: "cooked_chicken", sellCount: 8 }
      ],
      journeyman: [
        { buy: "mutton", buyCount: 7, sell: "emerald", sellCount: 1 },
        { buy: "beef", buyCount: 10, sell: "emerald", sellCount: 1 }
      ],
      expert: [
        { buy: "dried_kelp_block", buyCount: 10, sell: "emerald", sellCount: 1 }
      ],
      master: [
        { buy: "sweet_berries", buyCount: 10, sell: "emerald", sellCount: 1 }
      ]
    }
  },

  cartographer: {
    workstation: "cartography_table",
    trades: {
      novice: [
        { buy: "paper", buyCount: 24, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 7, sell: "empty_map", sellCount: 1 }
      ],
      apprentice: [
        { buy: "glass_pane", buyCount: 11, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 13, buy2: "compass", buy2Count: 1, sell: "ocean_explorer_map", sellCount: 1 }
      ],
      journeyman: [
        { buy: "compass", buyCount: 1, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 14, buy2: "compass", buy2Count: 1, sell: "woodland_explorer_map", sellCount: 1 }
      ],
      expert: [
        { buy: "emerald", buyCount: 7, sell: "item_frame", sellCount: 1 },
        { buy: "emerald", buyCount: 3, sell: "white_banner", sellCount: 1 },
        { buy: "emerald", buyCount: 3, sell: "blue_banner", sellCount: 1 }
      ],
      master: [
        { buy: "emerald", buyCount: 8, sell: "globe_banner_pattern", sellCount: 1 }
      ]
    }
  },

  cleric: {
    workstation: "brewing_stand",
    trades: {
      novice: [
        { buy: "rotten_flesh", buyCount: 32, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "redstone_dust", sellCount: 2 }
      ],
      apprentice: [
        { buy: "gold_ingot", buyCount: 3, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "lapis_lazuli", sellCount: 1 }
      ],
      journeyman: [
        { buy: "rabbit_foot", buyCount: 2, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 4, sell: "glowstone", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "ender_pearl", sellCount: 1 }
      ],
      expert: [
        { buy: "scute", buyCount: 4, sell: "emerald", sellCount: 1 },
        { buy: "glass_bottle", buyCount: 9, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 5, sell: "experience_bottle", sellCount: 1 }
      ],
      master: [
        { buy: "nether_wart", buyCount: 22, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 3, sell: "ender_pearl", sellCount: 1 }
      ]
    }
  },

  farmer: {
    workstation: "composter",
    trades: {
      novice: [
        { buy: "wheat", buyCount: 20, sell: "emerald", sellCount: 1 },
        { buy: "potato", buyCount: 26, sell: "emerald", sellCount: 1 },
        { buy: "carrot", buyCount: 22, sell: "emerald", sellCount: 1 },
        { buy: "beetroot", buyCount: 15, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "bread", sellCount: 6 }
      ],
      apprentice: [
        { buy: "pumpkin", buyCount: 6, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "pumpkin_pie", sellCount: 4 },
        { buy: "emerald", buyCount: 1, sell: "apple", sellCount: 4 }
      ],
      journeyman: [
        { buy: "melon", buyCount: 4, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 3, sell: "cookie", sellCount: 18 }
      ],
      expert: [
        { buy: "emerald", buyCount: 1, sell: "cake", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "suspicious_stew", sellCount: 1 }
      ],
      master: [
        { buy: "emerald", buyCount: 3, sell: "golden_carrot", sellCount: 3 },
        { buy: "emerald", buyCount: 4, sell: "glistering_melon_slice", sellCount: 3 }
      ]
    }
  },

  fisherman: {
    workstation: "barrel",
    trades: {
      novice: [
        { buy: "string", buyCount: 20, sell: "emerald", sellCount: 1 },
        { buy: "coal", buyCount: 10, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 5, buy2: "tropical_fish", buy2Count: 1, sell: "cooked_cod", sellCount: 6 }
      ],
      apprentice: [
        { buy: "cod", buyCount: 6, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "cooked_salmon", sellCount: 6 },
        { buy: "emerald", buyCount: 1, sell: "campfire", sellCount: 1 }
      ],
      journeyman: [
        { buy: "salmon", buyCount: 6, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 7-22, sell: "enchanted_fishing_rod", sellCount: 1 }
      ],
      expert: [
        { buy: "tropical_fish", buyCount: 6, sell: "emerald", sellCount: 1 }
      ],
      master: [
        { buy: "pufferfish", buyCount: 4, sell: "emerald", sellCount: 1 },
        { buy: "boat", buyCount: 1, sell: "emerald", sellCount: 1 }
      ]
    }
  },

  fletcher: {
    workstation: "fletching_table",
    trades: {
      novice: [
        { buy: "stick", buyCount: 32, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "arrow", sellCount: 16 },
        { buy: "emerald", buyCount: 1, buy2: "gravel", buy2Count: 10, sell: "flint", sellCount: 10 }
      ],
      apprentice: [
        { buy: "flint", buyCount: 26, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 2, sell: "bow", sellCount: 1 }
      ],
      journeyman: [
        { buy: "string", buyCount: 14, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 3, sell: "crossbow", sellCount: 1 }
      ],
      expert: [
        { buy: "feather", buyCount: 24, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 7-21, sell: "enchanted_bow", sellCount: 1 }
      ],
      master: [
        { buy: "tripwire_hook", buyCount: 8, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 8-22, sell: "enchanted_crossbow", sellCount: 1 },
        { buy: "emerald", buyCount: 2, buy2: "arrow", buy2Count: 5, sell: "tipped_arrow", sellCount: 5 }
      ]
    }
  },

  leatherworker: {
    workstation: "cauldron",
    trades: {
      novice: [
        { buy: "leather", buyCount: 6, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 3, sell: "leather_pants", sellCount: 1 },
        { buy: "emerald", buyCount: 7, sell: "leather_tunic", sellCount: 1 }
      ],
      apprentice: [
        { buy: "flint", buyCount: 26, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 5, sell: "leather_cap", sellCount: 1 },
        { buy: "emerald", buyCount: 4, sell: "leather_boots", sellCount: 1 }
      ],
      journeyman: [
        { buy: "rabbit_hide", buyCount: 9, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 7, sell: "leather_tunic", sellCount: 1 }
      ],
      expert: [
        { buy: "scute", buyCount: 4, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 6, sell: "leather_horse_armor", sellCount: 1 }
      ],
      master: [
        { buy: "emerald", buyCount: 6, sell: "saddle", sellCount: 1 },
        { buy: "emerald", buyCount: 5, sell: "leather_cap", sellCount: 1 }
      ]
    }
  },

  librarian: {
    workstation: "lectern",
    trades: {
      novice: [
        { buy: "paper", buyCount: 24, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 5-64, buy2: "book", buy2Count: 1, sell: "enchanted_book", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "bookshelf", sellCount: 1 }
      ],
      apprentice: [
        { buy: "book", buyCount: 4, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 5-64, buy2: "book", buy2Count: 1, sell: "enchanted_book", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "lantern", sellCount: 1 }
      ],
      journeyman: [
        { buy: "ink_sac", buyCount: 5, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 5-64, buy2: "book", buy2Count: 1, sell: "enchanted_book", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "glass", sellCount: 4 }
      ],
      expert: [
        { buy: "book_and_quill", buyCount: 2, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 5-64, buy2: "book", buy2Count: 1, sell: "enchanted_book", sellCount: 1 },
        { buy: "emerald", buyCount: 5, sell: "clock", sellCount: 1 },
        { buy: "emerald", buyCount: 4, sell: "compass", sellCount: 1 }
      ],
      master: [
        { buy: "emerald", buyCount: 20, sell: "name_tag", sellCount: 1 }
      ]
    }
  },

  mason: {
    workstation: "stonecutter",
    trades: {
      novice: [
        { buy: "clay_ball", buyCount: 10, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "brick", sellCount: 10 }
      ],
      apprentice: [
        { buy: "stone", buyCount: 20, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "chiseled_stone_bricks", sellCount: 4 }
      ],
      journeyman: [
        { buy: "granite", buyCount: 16, sell: "emerald", sellCount: 1 },
        { buy: "andesite", buyCount: 16, sell: "emerald", sellCount: 1 },
        { buy: "diorite", buyCount: 16, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "polished_andesite", sellCount: 4 }
      ],
      expert: [
        { buy: "nether_quartz", buyCount: 12, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "colored_terracotta", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "glazed_terracotta", sellCount: 1 }
      ],
      master: [
        { buy: "emerald", buyCount: 1, sell: "quartz_pillar", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "block_of_quartz", sellCount: 1 }
      ]
    }
  },

  shepherd: {
    workstation: "loom",
    trades: {
      novice: [
        { buy: "white_wool", buyCount: 18, sell: "emerald", sellCount: 1 },
        { buy: "brown_wool", buyCount: 18, sell: "emerald", sellCount: 1 },
        { buy: "black_wool", buyCount: 18, sell: "emerald", sellCount: 1 },
        { buy: "gray_wool", buyCount: 18, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 2, sell: "shears", sellCount: 1 }
      ],
      apprentice: [
        { buy: "dye", buyCount: 12, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "wool", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "carpet", sellCount: 4 }
      ],
      journeyman: [
        { buy: "emerald", buyCount: 3, sell: "bed", sellCount: 1 },
        { buy: "emerald", buyCount: 3, sell: "colored_bed", sellCount: 1 }
      ],
      expert: [
        { buy: "emerald", buyCount: 3, sell: "banner", sellCount: 1 }
      ],
      master: [
        { buy: "emerald", buyCount: 2, sell: "painting", sellCount: 3 }
      ]
    }
  },

  toolsmith: {
    workstation: "smithing_table",
    trades: {
      novice: [
        { buy: "coal", buyCount: 15, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "stone_axe", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "stone_shovel", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "stone_pickaxe", sellCount: 1 },
        { buy: "emerald", buyCount: 1, sell: "stone_hoe", sellCount: 1 }
      ],
      apprentice: [
        { buy: "iron_ingot", buyCount: 4, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 36, sell: "bell", sellCount: 1 }
      ],
      journeyman: [
        { buy: "flint", buyCount: 30, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 6-20, sell: "enchanted_iron_axe", sellCount: 1 },
        { buy: "emerald", buyCount: 7-21, sell: "enchanted_iron_shovel", sellCount: 1 },
        { buy: "emerald", buyCount: 8-22, sell: "enchanted_iron_pickaxe", sellCount: 1 }
      ],
      expert: [
        { buy: "diamond", buyCount: 1, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 17-31, sell: "enchanted_diamond_axe", sellCount: 1 },
        { buy: "emerald", buyCount: 10-24, sell: "enchanted_diamond_shovel", sellCount: 1 }
      ],
      master: [
        { buy: "emerald", buyCount: 18-32, sell: "enchanted_diamond_pickaxe", sellCount: 1 }
      ]
    }
  },

  weaponsmith: {
    workstation: "grindstone",
    trades: {
      novice: [
        { buy: "coal", buyCount: 15, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 3, sell: "iron_axe", sellCount: 1 },
        { buy: "emerald", buyCount: 7-21, sell: "enchanted_iron_sword", sellCount: 1 }
      ],
      apprentice: [
        { buy: "iron_ingot", buyCount: 4, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 36, sell: "bell", sellCount: 1 }
      ],
      journeyman: [
        { buy: "flint", buyCount: 24, sell: "emerald", sellCount: 1 }
      ],
      expert: [
        { buy: "diamond", buyCount: 1, sell: "emerald", sellCount: 1 },
        { buy: "emerald", buyCount: 17-31, sell: "enchanted_diamond_axe", sellCount: 1 }
      ],
      master: [
        { buy: "emerald", buyCount: 13-27, sell: "enchanted_diamond_sword", sellCount: 1 }
      ]
    }
  },

  nitwit: {
    workstation: null,
    trades: {} // Nitwits cannot trade
  }
};

/* =====================================================
 * WANDERING TRADER TRADES
 * Unique trades from wandering traders
 * ===================================================== */

const WANDERING_TRADER_TRADES = [
  { buy: "emerald", buyCount: 5, sell: "gunpowder", sellCount: 1 },
  { buy: "emerald", buyCount: 1, sell: "lily_pad", sellCount: 2 },
  { buy: "emerald", buyCount: 1, sell: "slime_ball", sellCount: 1 },
  { buy: "emerald", buyCount: 3, sell: "glowstone", sellCount: 1 },
  { buy: "emerald", buyCount: 1, sell: "nautilus_shell", sellCount: 1 },
  { buy: "emerald", buyCount: 5, sell: "coral_block", sellCount: 1 },
  { buy: "emerald", buyCount: 5, sell: "blue_ice", sellCount: 1 },
  { buy: "emerald", buyCount: 1, sell: "podzol", sellCount: 3 },
  { buy: "emerald", buyCount: 1, sell: "kelp", sellCount: 3 },
  { buy: "emerald", buyCount: 1, sell: "cactus", sellCount: 1 },
  { buy: "emerald", buyCount: 3, sell: "fern", sellCount: 1 },
  { buy: "emerald", buyCount: 5, sell: "pumpkin", sellCount: 1 },
  { buy: "emerald", buyCount: 1, sell: "vine", sellCount: 3 },
  { buy: "emerald", buyCount: 1, sell: "small_dripleaf", sellCount: 2 },
  { buy: "emerald", buyCount: 5, sell: "pointed_dripstone", sellCount: 2 }
];

/* =====================================================
 * TRADING CONFIGURATION
 * Rules and mechanics for trading
 * ===================================================== */

const TRADE_CONFIG = {
  // Trading mechanics
  mechanics: {
    maxTradesPerRestock: 2, // Trades before requiring restock
    restockFrequency: "twice_daily", // Game days
    restockTimes: ["morning", "afternoon"],
    priceFluctuations: true, // Demand affects prices
    experienceGain: true, // Villagers gain XP from trades
    gossip: true // Reputation system
  },

  // Experience levels for villagers
  levels: {
    novice: { xpRequired: 0, badge: "stone" },
    apprentice: { xpRequired: 10, badge: "iron" },
    journeyman: { xpRequired: 70, badge: "gold" },
    expert: { xpRequired: 150, badge: "emerald" },
    master: { xpRequired: 250, badge: "diamond" }
  },

  // Hero of the Village effect
  heroDiscount: {
    enabled: true,
    discountPercent: 30, // 30% off all trades
    duration: 3, // game days
    stackable: false
  },

  // Reputation system
  reputation: {
    ranges: {
      excellent: 100,
      good: 30,
      neutral: 0,
      bad: -30,
      terrible: -100
    },
    effects: {
      excellent: { discount: 0.2, ironGolemSpawn: "increased" },
      good: { discount: 0.1 },
      neutral: {},
      bad: { priceIncrease: 0.2, ironGolemAggro: true },
      terrible: { noTrades: true, ironGolemAggro: true }
    }
  },

  // Curing zombie villagers
  zombieVillagerCure: {
    discountPercent: 100, // First trade free
    permanentDiscount: 0.2, // 20% off forever
    reputationGain: 10
  }
};

/**
 * Get villager profession info
 * @param {string} profession - Villager profession
 * @returns {object|null} Profession info or null
 */
function getProfessionInfo(profession) {
  const normalized = normalizeItemName(profession);
  return VILLAGER_PROFESSIONS[normalized] || null;
}

/**
 * Get available trades for villager level
 * @param {string} profession - Villager profession
 * @param {string} level - Villager level (novice, apprentice, etc.)
 * @returns {array} Available trades
 */
function getAvailableTrades(profession, level = "novice") {
  const professionData = getProfessionInfo(profession);
  if (!professionData || !professionData.trades) {
    return [];
  }

  const levelTrades = professionData.trades[level] || [];
  return levelTrades;
}

/**
 * Calculate trade value
 * @param {object} trade - Trade data
 * @param {object} modifiers - Price modifiers (reputation, hero effect, etc.)
 * @returns {object} Calculated trade value
 */
function calculateTradeValue(trade, modifiers = {}) {
  let buyCount = trade.buyCount;
  let buy2Count = trade.buy2Count || 0;

  // Apply discounts
  if (modifiers.heroDiscount) {
    buyCount = Math.ceil(buyCount * (1 - TRADE_CONFIG.heroDiscount.discountPercent / 100));
    buy2Count = Math.ceil(buy2Count * (1 - TRADE_CONFIG.heroDiscount.discountPercent / 100));
  }

  if (modifiers.reputationDiscount) {
    buyCount = Math.ceil(buyCount * (1 - modifiers.reputationDiscount));
    buy2Count = Math.ceil(buy2Count * (1 - modifiers.reputationDiscount));
  }

  if (modifiers.curedDiscount) {
    buyCount = Math.ceil(buyCount * (1 - TRADE_CONFIG.zombieVillagerCure.discountPercent / 100));
    buy2Count = Math.ceil(buy2Count * (1 - TRADE_CONFIG.zombieVillagerCure.permanentDiscount));
  }

  // Apply price increases
  if (modifiers.reputationIncrease) {
    buyCount = Math.ceil(buyCount * (1 + modifiers.reputationIncrease));
    buy2Count = Math.ceil(buy2Count * (1 + modifiers.reputationIncrease));
  }

  return {
    buy: trade.buy,
    buyCount: Math.max(1, buyCount),
    buy2: trade.buy2,
    buy2Count: buy2Count > 0 ? Math.max(1, buy2Count) : 0,
    sell: trade.sell,
    sellCount: trade.sellCount,
    originalBuyCount: trade.buyCount,
    discount: buyCount < trade.buyCount
  };
}

/**
 * Find best trade for desired item
 * @param {string} desiredItem - Item player wants
 * @param {array} availableVillagers - List of nearby villagers
 * @returns {object|null} Best trade option or null
 */
function findBestTrade(desiredItem, availableVillagers = []) {
  const normalized = normalizeItemName(desiredItem);
  const matchingTrades = [];

  for (const villager of availableVillagers) {
    const trades = getAvailableTrades(villager.profession, villager.level);

    for (const trade of trades) {
      if (normalizeItemName(trade.sell) === normalized) {
        matchingTrades.push({
          villager: villager,
          trade: trade,
          cost: trade.buyCount,
          profession: villager.profession,
          level: villager.level
        });
      }
    }
  }

  if (matchingTrades.length === 0) {
    return null;
  }

  // Sort by cost (lowest first)
  matchingTrades.sort((a, b) => a.cost - b.cost);

  return matchingTrades[0];
}

/**
 * Calculate emerald requirements
 * @param {array} desiredTrades - List of trades player wants to make
 * @param {object} inventory - Current inventory
 * @returns {object} Emerald requirement analysis
 */
function calculateEmeraldNeeds(desiredTrades = [], inventory = {}) {
  let totalEmeraldsNeeded = 0;
  const tradeBreakdown = [];

  for (const trade of desiredTrades) {
    const emeraldCost = trade.buy === "emerald" ? trade.buyCount : 0;
    totalEmeraldsNeeded += emeraldCost;

    tradeBreakdown.push({
      trade: `${trade.buyCount} ${trade.buy}${trade.buy2 ? ` + ${trade.buy2Count} ${trade.buy2}` : ""} → ${trade.sellCount} ${trade.sell}`,
      emeraldCost: emeraldCost
    });
  }

  const currentEmeralds = inventory.emerald?.count || 0;
  const shortage = Math.max(0, totalEmeraldsNeeded - currentEmeralds);

  return {
    totalNeeded: totalEmeraldsNeeded,
    currentAmount: currentEmeralds,
    shortage: shortage,
    sufficient: shortage === 0,
    breakdown: tradeBreakdown
  };
}

/* =====================================================
 * TRADE TASK PLANNER
 * Main function for creating trading plans
 * ===================================================== */

/**
 * Plan trade task
 * @param {object} goal - Task goal with trade specifications
 * @param {object} context - Game context
 * @returns {object} Trading plan
 */
export function planTradeTask(goal = {}, context = {}) {
  const desiredItem = goal.item || goal.want;
  const villager = goal.villager || context.nearestVillager;
  const inventory = context.inventory || {};

  if (!desiredItem && !goal.trade) {
    return {
      status: "failed",
      error: "No trade or desired item specified"
    };
  }

  const plan = createPlan("trade", `Trade with villager`, {
    priority: "normal",
    estimatedDuration: 5,
    safety: "normal"
  });

  if (!villager) {
    plan.status = "blocked";
    plan.error = "No villager available";
    plan.suggestion = "Find a village or cure a zombie villager";
    return plan;
  }

  // Get villager's trades
  const availableTrades = getAvailableTrades(villager.profession, villager.level || "novice");

  if (availableTrades.length === 0) {
    plan.status = "failed";
    plan.error = `${villager.profession} villager has no trades available`;
    return plan;
  }

  // Find specific trade if item specified
  let selectedTrade = goal.trade;

  if (desiredItem && !selectedTrade) {
    selectedTrade = availableTrades.find(t =>
      normalizeItemName(t.sell) === normalizeItemName(desiredItem)
    );

    if (!selectedTrade) {
      plan.status = "failed";
      plan.error = `${villager.profession} doesn't trade ${desiredItem}`;
      plan.availableTrades = availableTrades.map(t => `${t.sell} for ${t.buyCount} ${t.buy}`);
      return plan;
    }
  }

  // Calculate trade value with modifiers
  const modifiers = {
    heroDiscount: context.hasHeroEffect || false,
    reputationDiscount: context.reputationDiscount || 0,
    curedDiscount: villager.cured || false
  };

  const tradeValue = calculateTradeValue(selectedTrade, modifiers);

  // Check if player has required items
  const hasRequiredItems = hasInventoryItem(inventory, tradeValue.buy) &&
    (inventory[tradeValue.buy]?.count || 0) >= tradeValue.buyCount;

  const hasSecondItem = !tradeValue.buy2 || (
    hasInventoryItem(inventory, tradeValue.buy2) &&
    (inventory[tradeValue.buy2]?.count || 0) >= tradeValue.buy2Count
  );

  if (!hasRequiredItems || !hasSecondItem) {
    plan.status = "blocked";
    plan.error = "Insufficient items for trade";
    plan.required = {
      [tradeValue.buy]: { need: tradeValue.buyCount, have: inventory[tradeValue.buy]?.count || 0 }
    };
    if (tradeValue.buy2) {
      plan.required[tradeValue.buy2] = { need: tradeValue.buy2Count, have: inventory[tradeValue.buy2]?.count || 0 };
    }
    return plan;
  }

  // Build trading steps

  // Step 1: Navigate to villager
  if (villager.position) {
    plan.steps.push(createStep(
      "navigate_to_villager",
      describeTarget(villager.position, `Navigate to ${villager.profession} at`),
      {
        target: villager.position,
        maxDistance: 3
      }
    ));
  }

  // Step 2: Open trading interface
  plan.steps.push(createStep(
    "open_trade_interface",
    `Open trade interface with ${villager.profession}`,
    {
      villager: villager,
      profession: villager.profession,
      level: villager.level || "novice"
    }
  ));

  // Step 3: Select trade
  plan.steps.push(createStep(
    "select_trade",
    `Select trade: ${tradeValue.buyCount} ${tradeValue.buy}${tradeValue.buy2 ? ` + ${tradeValue.buy2Count} ${tradeValue.buy2}` : ""} → ${tradeValue.sellCount} ${tradeValue.sell}`,
    {
      trade: tradeValue,
      discount: tradeValue.discount
    }
  ));

  // Step 4: Confirm trade
  plan.steps.push(createStep(
    "confirm_trade",
    `Complete trade`,
    {
      giving: {
        [tradeValue.buy]: tradeValue.buyCount,
        ...(tradeValue.buy2 ? { [tradeValue.buy2]: tradeValue.buy2Count } : {})
      },
      receiving: {
        [tradeValue.sell]: tradeValue.sellCount
      }
    }
  ));

  // Add outcome
  plan.outcome = {
    trade: tradeValue,
    villagerProfession: villager.profession,
    villagerLevel: villager.level || "novice",
    modifiers: modifiers
  };

  return plan;
}

/**
 * Plan emerald acquisition strategy
 * @param {object} goal - Goal with emerald target
 * @param {object} context - Game context
 * @returns {object} Emerald acquisition plan
 */
function planEmeraldAcquisition(goal = {}, context = {}) {
  const targetAmount = goal.amount || 10;
  const inventory = context.inventory || {};
  const availableVillagers = context.nearbyVillagers || [];

  const plan = createPlan("acquire_emeralds", `Acquire ${targetAmount} emeralds`, {
    priority: "normal",
    estimatedDuration: 60,
    complexity: "medium"
  });

  // Find villagers who buy items player has
  const inventoryItems = extractInventory(inventory);
  const possibleTrades = [];

  for (const villager of availableVillagers) {
    const trades = getAvailableTrades(villager.profession, villager.level || "novice");

    for (const trade of trades) {
      if (trade.sell === "emerald") {
        const hasItem = inventoryItems.find(i => normalizeItemName(i.name) === normalizeItemName(trade.buy));

        if (hasItem && hasItem.count >= trade.buyCount) {
          const maxTrades = Math.floor(hasItem.count / trade.buyCount);
          possibleTrades.push({
            villager: villager,
            trade: trade,
            itemNeeded: trade.buy,
            countNeeded: trade.buyCount,
            emeraldsPerTrade: trade.sellCount,
            maxTrades: maxTrades,
            totalEmeralds: maxTrades * trade.sellCount
          });
        }
      }
    }
  }

  if (possibleTrades.length === 0) {
    plan.status = "blocked";
    plan.error = "No villagers want items in inventory";
    plan.suggestion = "Gather coal, wheat, carrots, or other tradeable items";
    return plan;
  }

  // Sort by efficiency (emeralds per trade)
  possibleTrades.sort((a, b) => b.emeraldsPerTrade - a.emeraldsPerTrade);

  // Select trades to reach target
  let emeraldsAcquired = 0;
  const selectedTrades = [];

  for (const trade of possibleTrades) {
    if (emeraldsAcquired >= targetAmount) break;

    const tradesNeeded = Math.ceil((targetAmount - emeraldsAcquired) / trade.emeraldsPerTrade);
    const tradesToMake = Math.min(tradesNeeded, trade.maxTrades);

    selectedTrades.push({
      ...trade,
      tradesToMake: tradesToMake
    });

    emeraldsAcquired += tradesToMake * trade.emeraldsPerTrade;
  }

  // Add trading steps
  selectedTrades.forEach((tradeInfo, i) => {
    plan.steps.push(createStep(
      `trade_${i + 1}`,
      `Trade ${tradeInfo.tradesToMake}x ${tradeInfo.countNeeded} ${tradeInfo.itemNeeded} for ${tradeInfo.tradesToMake * tradeInfo.emeraldsPerTrade} emeralds`,
      {
        villager: tradeInfo.villager,
        trade: tradeInfo.trade,
        count: tradeInfo.tradesToMake
      }
    ));
  });

  plan.outcome = {
    targetEmeralds: targetAmount,
    emeraldsAcquired: emeraldsAcquired,
    tradesRequired: selectedTrades.length,
    surplus: emeraldsAcquired - targetAmount
  };

  return plan;
}

/* =====================================================
 * EXPORTS
 * ===================================================== */

export default planTradeTask;
export {
  VILLAGER_PROFESSIONS,
  WANDERING_TRADER_TRADES,
  TRADE_CONFIG,
  getProfessionInfo,
  getAvailableTrades,
  calculateTradeValue,
  findBestTrade,
  calculateEmeraldNeeds,
  planEmeraldAcquisition
};
