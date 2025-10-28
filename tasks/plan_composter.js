// tasks/plan_composter.js
// Composter mechanics system
// Implements composting organic materials into bonemeal

import {
  createPlan,
  createStep,
  describeTarget,
  normalizeItemName,
  hasInventoryItem,
  extractInventory
} from "./helpers.js";

/* =====================================================
 * COMPOSTABLE ITEMS DATABASE
 * All items that can be composted with success rates
 * ===================================================== */

const COMPOSTABLE_ITEMS = {
  // 30% chance items
  beetroot_seeds: { chance: 0.30, category: "seeds" },
  dried_kelp: { chance: 0.30, category: "plant" },
  glow_berries: { chance: 0.30, category: "food" },
  grass: { chance: 0.30, category: "plant" },
  hanging_roots: { chance: 0.30, category: "plant" },
  kelp: { chance: 0.30, category: "plant" },
  leaves: { chance: 0.30, category: "plant" },
  melon_seeds: { chance: 0.30, category: "seeds" },
  pumpkin_seeds: { chance: 0.30, category: "seeds" },
  saplings: { chance: 0.30, category: "plant" },
  seagrass: { chance: 0.30, category: "plant" },
  small_dripleaf: { chance: 0.30, category: "plant" },
  sweet_berries: { chance: 0.30, category: "food" },
  torchflower_seeds: { chance: 0.30, category: "seeds" },
  wheat_seeds: { chance: 0.30, category: "seeds" },

  // 50% chance items
  cactus: { chance: 0.50, category: "plant" },
  dried_kelp_block: { chance: 0.50, category: "plant" },
  flowering_azalea_leaves: { chance: 0.50, category: "plant" },
  glow_lichen: { chance: 0.50, category: "plant" },
  melon_slice: { chance: 0.50, category: "food" },
  moss_carpet: { chance: 0.50, category: "plant" },
  nether_sprouts: { chance: 0.50, category: "plant" },
  sugar_cane: { chance: 0.50, category: "plant" },
  tall_grass: { chance: 0.50, category: "plant" },
  twisting_vines: { chance: 0.50, category: "plant" },
  vines: { chance: 0.50, category: "plant" },
  weeping_vines: { chance: 0.50, category: "plant" },

  // 65% chance items
  apple: { chance: 0.65, category: "food" },
  azalea: { chance: 0.65, category: "plant" },
  beetroot: { chance: 0.65, category: "food" },
  big_dripleaf: { chance: 0.65, category: "plant" },
  carrot: { chance: 0.65, category: "food" },
  cocoa_beans: { chance: 0.65, category: "food" },
  fern: { chance: 0.65, category: "plant" },
  flowers: { chance: 0.65, category: "plant" },
  lily_pad: { chance: 0.65, category: "plant" },
  melon: { chance: 0.65, category: "food" },
  moss_block: { chance: 0.65, category: "plant" },
  mushrooms: { chance: 0.65, category: "plant" },
  nether_wart: { chance: 0.65, category: "plant" },
  pitcher_pod: { chance: 0.65, category: "seeds" },
  potato: { chance: 0.65, category: "food" },
  pumpkin: { chance: 0.65, category: "food" },
  sea_pickle: { chance: 0.65, category: "plant" },
  shroomlight: { chance: 0.65, category: "plant" },
  spore_blossom: { chance: 0.65, category: "plant" },
  torchflower: { chance: 0.65, category: "plant" },
  wheat: { chance: 0.65, category: "food" },

  // 85% chance items
  baked_potato: { chance: 0.85, category: "food" },
  bread: { chance: 0.85, category: "food" },
  cookie: { chance: 0.85, category: "food" },
  flowering_azalea: { chance: 0.85, category: "plant" },
  hay_block: { chance: 0.85, category: "plant" },
  mushroom_blocks: { chance: 0.85, category: "plant" },
  nether_wart_block: { chance: 0.85, category: "plant" },
  warped_wart_block: { chance: 0.85, category: "plant" },

  // 100% chance items
  cake: { chance: 1.00, category: "food" },
  pumpkin_pie: { chance: 1.00, category: "food" }
};

/* =====================================================
 * COMPOSTER CONFIGURATION
 * Rules and mechanics for composting
 * ===================================================== */

const COMPOSTER_CONFIG = {
  // Fill levels
  fillLevels: {
    empty: 0,
    max: 7,
    ready: 7 // At level 7, next item produces bonemeal
  },

  // Mechanics
  mechanics: {
    outputItem: "bone_meal",
    outputCount: 1,
    resetAfterOutput: true, // Returns to level 0 after collecting
    canBeAutomated: true,
    hopperCompatible: true
  },

  // Automation
  automation: {
    hopperInput: {
      enabled: true,
      direction: "top",
      transferRate: 1 // items per 8 game ticks (0.4s)
    },
    hopperOutput: {
      enabled: true,
      direction: "bottom",
      collectsBonemeal: true
    },
    comparatorOutput: {
      enabled: true,
      signalStrength: "0-8", // Based on fill level
      maxSignal: 8
    }
  },

  // Efficiency
  efficiency: {
    averageItemsPerBonemeal: {
      "30%": 23, // Average items needed at 30% chance
      "50%": 14,
      "65%": 11,
      "85%": 8,
      "100%": 7
    },
    bestItems: ["cake", "pumpkin_pie", "hay_block", "bread", "baked_potato"],
    worstItems: ["seeds", "saplings", "grass"]
  },

  // Uses for bonemeal
  bonemealUses: {
    crops: "Instantly grows crops to next stage",
    saplings: "Instantly grows tree (if space available)",
    flowers: "Creates flower field",
    grass: "Creates tall grass and flowers",
    fungi: "Grows huge fungi (in Nether)",
    coral: "Spreads coral",
    seagrass: "Spreads seagrass"
  }
};

/**
 * Get compostable item info
 * @param {string} itemName - Item name
 * @returns {object|null} Compostable info or null
 */
function getCompostableInfo(itemName) {
  const normalized = normalizeItemName(itemName);

  // Check exact match
  if (COMPOSTABLE_ITEMS[normalized]) {
    return { ...COMPOSTABLE_ITEMS[normalized], itemName: normalized };
  }

  // Check partial matches for variants
  for (const [key, value] of Object.entries(COMPOSTABLE_ITEMS)) {
    if (key.includes("saplings") && normalized.includes("sapling")) {
      return { ...value, itemName: normalized };
    }
    if (key.includes("leaves") && normalized.includes("leaves")) {
      return { ...value, itemName: normalized };
    }
    if (key.includes("flowers") && normalized.includes("flower")) {
      return { ...value, itemName: normalized };
    }
    if (key.includes("mushrooms") && normalized.includes("mushroom")) {
      return { ...value, itemName: normalized };
    }
  }

  return null;
}

/**
 * Check if item is compostable
 * @param {string} itemName - Item name
 * @returns {boolean} True if compostable
 */
function isCompostable(itemName) {
  return getCompostableInfo(itemName) !== null;
}

/**
 * Calculate composting efficiency
 * @param {string} itemName - Item to compost
 * @param {number} quantity - Number of items
 * @returns {object} Efficiency calculation
 */
function calculateCompostingEfficiency(itemName, quantity = 1) {
  const item = getCompostableInfo(itemName);

  if (!item) {
    return {
      error: "Item is not compostable",
      itemName
    };
  }

  // Calculate expected bonemeal output
  const expectedFillsPerItem = item.chance;
  const totalExpectedFills = quantity * expectedFillsPerItem;
  const expectedBonemeal = Math.floor(totalExpectedFills / 7);

  // Calculate actual probability
  const itemsNeededForBonemeal = COMPOSTER_CONFIG.efficiency.averageItemsPerBonemeal[`${item.chance * 100}%`];

  return {
    item: itemName,
    quantity,
    chance: item.chance,
    category: item.category,
    expectedBonemeal,
    itemsPerBonemeal: itemsNeededForBonemeal,
    efficiency: (item.chance * 100).toFixed(0) + "%",
    rating: item.chance >= 0.85 ? "excellent" :
            item.chance >= 0.65 ? "good" :
            item.chance >= 0.50 ? "fair" : "poor"
  };
}

/**
 * Find best compostable items in inventory
 * @param {object} inventory - Current inventory
 * @returns {array} Sorted list of compostable items
 */
function findCompostableItems(inventory = {}) {
  const inventoryItems = extractInventory(inventory);
  const compostables = [];

  for (const item of inventoryItems) {
    const compostInfo = getCompostableInfo(item.name);
    if (compostInfo) {
      const efficiency = calculateCompostingEfficiency(item.name, item.count || 1);
      compostables.push({
        name: item.name,
        count: item.count || 1,
        chance: compostInfo.chance,
        efficiency,
        priority: compostInfo.chance * (item.count || 1)
      });
    }
  }

  // Sort by efficiency (highest chance first)
  compostables.sort((a, b) => b.chance - a.chance);

  return compostables;
}

/**
 * Calculate bonemeal production plan
 * @param {number} targetBonemeal - Target bonemeal amount
 * @param {object} inventory - Available materials
 * @returns {object} Production plan
 */
function planBonemealProduction(targetBonemeal, inventory = {}) {
  const compostables = findCompostableItems(inventory);

  if (compostables.length === 0) {
    return {
      achievable: false,
      error: "No compostable items in inventory",
      suggestion: "Gather crops, seeds, or plant matter"
    };
  }

  const plan = {
    targetBonemeal,
    items: [],
    totalItemsUsed: 0,
    expectedBonemeal: 0,
    achievable: false
  };

  // Use best items first
  for (const item of compostables) {
    if (plan.expectedBonemeal >= targetBonemeal) break;

    const itemsNeeded = Math.ceil((targetBonemeal - plan.expectedBonemeal) *
                                  COMPOSTER_CONFIG.efficiency.averageItemsPerBonemeal[`${item.chance * 100}%`]);
    const itemsToUse = Math.min(itemsNeeded, item.count);

    const efficiency = calculateCompostingEfficiency(item.name, itemsToUse);

    plan.items.push({
      name: item.name,
      count: itemsToUse,
      expectedBonemeal: efficiency.expectedBonemeal
    });

    plan.totalItemsUsed += itemsToUse;
    plan.expectedBonemeal += efficiency.expectedBonemeal;
  }

  plan.achievable = plan.expectedBonemeal >= targetBonemeal;

  return plan;
}

/**
 * Design automated composter system
 * @param {number} throughput - Desired bonemeal per hour
 * @returns {object} System design
 */
function designAutoComposter(throughput = 10) {
  const design = {
    throughput,
    components: [],
    dimensions: { width: 3, length: 5, height: 4 },
    buildSteps: []
  };

  // Basic automated setup
  design.components = [
    { item: "composter", count: 1 },
    { item: "hopper", count: 2 }, // Input and output
    { item: "chest", count: 2 }, // Input and output storage
    { item: "building_blocks", count: 20 }
  ];

  design.buildSteps = [
    "Place output chest on ground",
    "Place hopper on top of chest (shift-click)",
    "Place composter on top of hopper",
    "Place input hopper on top of composter",
    "Place input chest on top of input hopper",
    "Fill input chest with compostable items",
    "Bonemeal will automatically collect in output chest"
  ];

  // Calculate efficiency
  const averageChance = 0.65; // Assuming mixed items
  const itemsPerBonemeal = 11; // Average for 65% items
  const hopperTransferRate = 2.5; // items per second
  const bonemealPerSecond = hopperTransferRate / itemsPerBonemeal;
  const bonemealPerHour = bonemealPerSecond * 3600;

  design.performance = {
    itemsProcessedPerHour: hopperTransferRate * 3600,
    bonemealPerHour: Math.floor(bonemealPerHour),
    achievesThroughput: bonemealPerHour >= throughput
  };

  // Multi-composter for higher throughput
  if (throughput > bonemealPerHour) {
    const compostersNeeded = Math.ceil(throughput / bonemealPerHour);
    design.components[0].count = compostersNeeded;
    design.components[1].count = compostersNeeded * 2;
    design.multiComposter = true;
    design.buildSteps.push(`Scale to ${compostersNeeded} composters for desired throughput`);
  }

  return design;
}

/* =====================================================
 * COMPOSTER TASK PLANNER
 * Main function for creating composter plans
 * ===================================================== */

/**
 * Plan composting task
 * @param {object} goal - Task goal
 * @param {object} context - Game context
 * @returns {object} Composting plan
 */
function planComposterTask(goal = {}, context = {}) {
  const targetBonemeal = goal.bonemeal || goal.amount || 1;
  const items = goal.items || [];
  const inventory = context.inventory || {};

  const plan = createPlan("compost", `Produce ${targetBonemeal} bonemeal`, {
    priority: "normal",
    estimatedDuration: 30,
    safety: "normal"
  });

  // Find compostable items
  let itemsToCompost = items;
  if (itemsToCompost.length === 0) {
    const compostables = findCompostableItems(inventory);
    if (compostables.length === 0) {
      plan.status = "blocked";
      plan.error = "No compostable items in inventory";
      plan.suggestion = "Gather crops, seeds, saplings, or plant matter";
      return plan;
    }

    // Use production planner
    const production = planBonemealProduction(targetBonemeal, inventory);
    if (!production.achievable) {
      plan.status = "blocked";
      plan.error = `Cannot produce ${targetBonemeal} bonemeal with available items`;
      plan.available = `Can produce ~${production.expectedBonemeal} bonemeal`;
      plan.itemsNeeded = production.items;
      return plan;
    }

    itemsToCompost = production.items;
  }

  // Check for composter
  if (!hasInventoryItem(inventory, "composter") && !goal.existingComposter) {
    plan.status = "blocked";
    plan.error = "No composter available";
    plan.suggestion = "Craft composter (7 wooden slabs)";
    return plan;
  }

  // Build composting steps

  if (!goal.existingComposter) {
    plan.steps.push(createStep(
      "place_composter",
      "Place composter on ground",
      {
        item: "composter",
        requiresFlatSurface: true
      }
    ));
  }

  // Add composting items
  for (const item of itemsToCompost) {
    const itemInfo = getCompostableInfo(item.name);
    plan.steps.push(createStep(
      `compost_${item.name}`,
      `Add ${item.count} ${item.name} to composter (${itemInfo.chance * 100}% fill chance)`,
      {
        item: item.name,
        count: item.count,
        chance: itemInfo.chance,
        action: "right_click_composter"
      }
    ));
  }

  plan.steps.push(createStep(
    "collect_bonemeal",
    `Collect ${targetBonemeal} bonemeal when ready`,
    {
      output: "bone_meal",
      count: targetBonemeal,
      note: "Composter is ready when filled to top (level 7)"
    }
  ));

  plan.outcome = {
    targetBonemeal,
    itemsComposted: itemsToCompost.reduce((sum, i) => sum + i.count, 0),
    itemTypes: itemsToCompost.map(i => i.name)
  };

  return plan;
}

/**
 * Plan automated composter construction
 * @param {object} goal - Construction goal
 * @param {object} context - Game context
 * @returns {object} Auto-composter plan
 */
function planAutoComposter(goal = {}, context = {}) {
  const throughput = goal.throughput || 10;
  const inventory = context.inventory || {};

  const design = designAutoComposter(throughput);
  const plan = createPlan("build_auto_composter", `Build automated composter (${throughput} bonemeal/hour)`, {
    priority: "normal",
    estimatedDuration: 180,
    complexity: "medium"
  });

  // Check materials
  const missing = [];
  for (const component of design.components) {
    if (!hasInventoryItem(inventory, component.item) ||
        (inventory[component.item]?.count || 0) < component.count) {
      missing.push(`${component.item}: need ${component.count}, have ${inventory[component.item]?.count || 0}`);
    }
  }

  if (missing.length > 0) {
    plan.status = "blocked";
    plan.error = "Insufficient materials";
    plan.missingMaterials = missing;
    return plan;
  }

  // Add build steps from design
  design.buildSteps.forEach((step, i) => {
    plan.steps.push(createStep(
      `build_step_${i + 1}`,
      step,
      { stepNumber: i + 1, totalSteps: design.buildSteps.length }
    ));
  });

  plan.steps.push(createStep(
    "test_system",
    "Test automated composter",
    {
      testItems: "Add test items to input chest",
      verify: "Check bonemeal appears in output chest"
    }
  ));

  plan.outcome = {
    throughput: design.performance.bonemealPerHour,
    design: design
  };

  return plan;
}

/* =====================================================
 * EXPORTS
 * ===================================================== */

export default planComposterTask;
export {
  COMPOSTABLE_ITEMS,
  COMPOSTER_CONFIG,
  getCompostableInfo,
  isCompostable,
  calculateCompostingEfficiency,
  findCompostableItems,
  planBonemealProduction,
  designAutoComposter,
  planAutoComposter
};
