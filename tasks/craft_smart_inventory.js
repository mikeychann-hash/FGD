// tasks/craft_smart_inventory.js
// Smart inventory management and prediction system

import { normalizeItemName, countInventoryItems } from "./helpers.js";

// Stock alert thresholds
export const RESTOCK_ALERTS = {
  critical: { threshold: 0.05, action: "urgent_restock", priority: "high" },
  low: { threshold: 0.20, action: "warn", priority: "medium" },
  adequate: { threshold: 0.50, action: "monitor", priority: "low" },
  good: { threshold: 1.0, action: "none", priority: "none" }
};

/**
 * Check inventory levels and generate alerts
 * @param {Object} inventory - Current inventory
 * @param {Object} stockTargets - Target quantities {item: quantity}
 * @returns {Object} Stock alerts and recommendations
 */
export function checkInventoryLevels(inventory = {}, stockTargets = {}) {
  const alerts = [];
  const warnings = [];
  const adequate = [];

  for (const [item, targetQty] of Object.entries(stockTargets)) {
    const currentQty = countInventoryItems(inventory, item);
    const percentOfTarget = currentQty / targetQty;

    let status = "good";
    let alert = null;

    if (percentOfTarget <= RESTOCK_ALERTS.critical.threshold) {
      status = "critical";
      alert = RESTOCK_ALERTS.critical;
      alerts.push({
        item: item,
        current: currentQty,
        target: targetQty,
        deficit: targetQty - currentQty,
        status: status,
        priority: alert.priority,
        action: alert.action
      });
    } else if (percentOfTarget <= RESTOCK_ALERTS.low.threshold) {
      status = "low";
      alert = RESTOCK_ALERTS.low;
      warnings.push({
        item: item,
        current: currentQty,
        target: targetQty,
        deficit: targetQty - currentQty,
        status: status,
        priority: alert.priority
      });
    } else if (percentOfTarget <= RESTOCK_ALERTS.adequate.threshold) {
      status = "adequate";
      adequate.push({ item: item, current: currentQty, target: targetQty });
    }
  }

  return {
    criticalAlerts: alerts,
    warnings: warnings,
    adequate: adequate,
    totalIssues: alerts.length + warnings.length,
    recommendation: alerts.length > 0
      ? `URGENT: Restock ${alerts.map(a => a.item).join(", ")}`
      : warnings.length > 0
      ? `Low stock: ${warnings.map(w => w.item).join(", ")}`
      : "All inventory levels adequate"
  };
}

/**
 * Predict future inventory needs based on usage patterns
 * @param {Array} usageHistory - Array of {item, quantity, timestamp}
 * @param {number} daysToPredict - Days to predict ahead
 * @returns {Object} Predicted needs
 */
export function predictFutureNeeds(usageHistory = [], daysToPredict = 7) {
  if (!Array.isArray(usageHistory) || usageHistory.length === 0) {
    return { error: "Usage history required" };
  }

  const itemUsage = {};

  // Aggregate usage by item
  for (const entry of usageHistory) {
    const item = normalizeItemName(entry.item);
    if (!itemUsage[item]) {
      itemUsage[item] = { total: 0, entries: 0 };
    }
    itemUsage[item].total += entry.quantity || 0;
    itemUsage[item].entries += 1;
  }

  // Calculate predictions
  const predictions = [];

  for (const [item, usage] of Object.entries(itemUsage)) {
    const avgPerDay = usage.total / Math.max(1, usage.entries);
    const predicted = Math.ceil(avgPerDay * daysToPredict);
    const recommendedStock = Math.ceil(predicted * 1.2); // 20% buffer

    predictions.push({
      item: item,
      averageUsagePerDay: Math.round(avgPerDay),
      predictedNeed: predicted,
      recommendedStock: recommendedStock,
      confidence: usage.entries >= 7 ? "high" : usage.entries >= 3 ? "medium" : "low"
    });
  }

  // Sort by predicted need
  predictions.sort((a, b) => b.predictedNeed - a.predictedNeed);

  return {
    predictionPeriod: daysToPredict,
    predictions: predictions,
    topNeeds: predictions.slice(0, 5),
    recommendation: `Stock up on: ${predictions.slice(0, 3).map(p => `${p.recommendedStock}x ${p.item}`).join(", ")}`
  };
}

/**
 * Suggest smart sorting organization
 * @param {Object} inventory - Current inventory
 * @param {Array} usageFrequency - Items with usage counts
 * @returns {Object} Sorting recommendations
 */
export function suggestSmartSorting(inventory = {}, usageFrequency = []) {
  const methods = {
    byFrequency: {
      name: "Sort by Frequency",
      description: "Most-used items in hotbar slots",
      slots: {
        hotbar: [],
        main: [],
        storage: []
      }
    },
    byCategory: {
      name: "Sort by Category",
      categories: {
        tools: [],
        weapons: [],
        food: [],
        blocks: [],
        redstone: [],
        misc: []
      }
    },
    byCraftingChain: {
      name: "Sort by Crafting Chain",
      description: "Group items by crafting dependencies"
    }
  };

  // Sort by frequency
  if (Array.isArray(usageFrequency) && usageFrequency.length > 0) {
    const sorted = [...usageFrequency].sort((a, b) => (b.count || 0) - (a.count || 0));

    methods.byFrequency.slots.hotbar = sorted.slice(0, 9).map(i => i.item);
    methods.byFrequency.slots.main = sorted.slice(9, 36).map(i => i.item);
    methods.byFrequency.slots.storage = sorted.slice(36).map(i => i.item);
  }

  return {
    methods: methods,
    recommendedMethod: "byFrequency",
    recommendation: "Keep frequently used items in hotbar for quick access"
  };
}

/**
 * Optimize inventory for specific task
 * @param {string} taskType - Type of task (mining, combat, building)
 * @param {Object} inventory - Current inventory
 * @returns {Object} Optimized loadout
 */
export function optimizeInventoryForTask(taskType, inventory = {}) {
  const loadouts = {
    mining: {
      essential: ["pickaxe", "torches", "food"],
      recommended: ["water_bucket", "blocks", "sword"],
      optional: ["crafting_table", "furnace", "chest"]
    },
    combat: {
      essential: ["sword", "bow", "arrows", "food", "shield"],
      recommended: ["armor", "potions", "golden_apples"],
      optional: ["water_bucket", "blocks", "ender_pearls"]
    },
    building: {
      essential: ["blocks", "tools", "scaffolding"],
      recommended: ["water_bucket", "food", "torches"],
      optional: ["crafting_table", "chest"]
    },
    exploring: {
      essential: ["food", "torches", "weapon", "tools"],
      recommended: ["bed", "crafting_table", "chest"],
      optional: ["maps", "compass", "boat"]
    }
  };

  const loadout = loadouts[taskType];

  if (!loadout) {
    return {
      error: `Unknown task type: ${taskType}`,
      availableTasks: Object.keys(loadouts)
    };
  }

  return {
    taskType: taskType,
    loadout: loadout,
    recommendation: `Bring ${loadout.essential.join(", ")} as essentials`
  };
}
