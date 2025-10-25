// tasks/craft_analytics.js
// Performance metrics and crafting analytics

import { normalizeItemName } from "./helpers.js";

/**
 * Track and analyze crafting history
 * @param {Array} craftingHistory - Array of craft events {item, quantity, timestamp, duration}
 * @returns {Object} Analytics summary
 */
export function analyzeCraftingHistory(craftingHistory = []) {
  if (!Array.isArray(craftingHistory) || craftingHistory.length === 0) {
    return {
      error: "No crafting history available",
      recommendation: "Start tracking crafts to see analytics"
    };
  }

  const itemCounts = {};
  let totalCrafts = 0;
  let totalTime = 0;

  for (const craft of craftingHistory) {
    const item = normalizeItemName(craft.item);
    itemCounts[item] = (itemCounts[item] || 0) + (craft.quantity || 1);
    totalCrafts += 1;
    totalTime += craft.duration || 0;
  }

  // Sort by frequency
  const sorted = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([item, count]) => ({ item, count }));

  const mostCrafted = sorted[0];
  const leastCrafted = sorted[sorted.length - 1];

  return {
    totalCrafts: totalCrafts,
    uniqueItems: sorted.length,
    mostCrafted: mostCrafted,
    leastCrafted: leastCrafted,
    averageCraftTime: totalTime > 0 ? (totalTime / totalCrafts).toFixed(1) : 0,
    topItems: sorted.slice(0, 10),
    summary: `Crafted ${totalCrafts} items (${sorted.length} unique types)`
  };
}

/**
 * Calculate efficiency score
 * @param {Object} stats - Crafting statistics
 * @returns {Object} Efficiency assessment
 */
export function calculateEfficiencyScore(stats = {}) {
  let score = 0;
  const factors = [];

  // Batch crafting bonus
  const avgBatchSize = stats.avgBatchSize || 1;
  if (avgBatchSize >= 32) {
    score += 30;
    factors.push({ factor: "Large batch crafting", points: 30 });
  } else if (avgBatchSize >= 8) {
    score += 20;
    factors.push({ factor: "Medium batch crafting", points: 20 });
  } else {
    score += 5;
    factors.push({ factor: "Small batch crafting", points: 5 });
  }

  // Automation usage
  if (stats.automationUsage > 0.5) {
    score += 25;
    factors.push({ factor: "Heavy automation usage", points: 25 });
  } else if (stats.automationUsage > 0.2) {
    score += 15;
    factors.push({ factor: "Some automation", points: 15 });
  }

  // Waste reduction
  const wasteRate = stats.wasteRate || 0.15;
  if (wasteRate < 0.05) {
    score += 20;
    factors.push({ factor: "Minimal waste", points: 20 });
  } else if (wasteRate < 0.15) {
    score += 10;
    factors.push({ factor: "Low waste", points: 10 });
  }

  // Workspace organization
  if (stats.workspaceEfficiency === "organized") {
    score += 15;
    factors.push({ factor: "Organized workspace", points: 15 });
  } else if (stats.workspaceEfficiency === "compact") {
    score += 10;
    factors.push({ factor: "Compact workspace", points: 10 });
  }

  // Recipe knowledge
  const recipeSuccessRate = stats.recipeSuccessRate || 0.8;
  if (recipeSuccessRate >= 0.95) {
    score += 10;
    factors.push({ factor: "High recipe accuracy", points: 10 });
  } else if (recipeSuccessRate >= 0.85) {
    score += 5;
    factors.push({ factor: "Good recipe knowledge", points: 5 });
  }

  return {
    score: Math.min(100, score),
    grade: score >= 90 ? "S" : score >= 80 ? "A" : score >= 70 ? "B" : score >= 60 ? "C" : "D",
    factors: factors,
    strengths: factors.filter(f => f.points >= 15).map(f => f.factor),
    improvements: score < 80
      ? ["Increase batch sizes", "Add automation", "Organize workspace better"]
      : [],
    summary: `Efficiency: ${score}/100 (Grade: ${score >= 90 ? "S" : score >= 80 ? "A" : score >= 70 ? "B" : "C"})`
  };
}

/**
 * Track personal bests
 * @param {Object} currentCraft - Current craft metrics
 * @param {Object} personalBests - Existing personal bests
 * @returns {Object} Updated bests and achievements
 */
export function trackPersonalBests(currentCraft, personalBests = {}) {
  const achievements = [];
  const updated = { ...personalBests };

  // Fastest craft
  if (!updated.fastestCraft || currentCraft.duration < updated.fastestCraft.time) {
    updated.fastestCraft = {
      item: currentCraft.item,
      time: currentCraft.duration
    };
    achievements.push(`New record: Fastest craft (${currentCraft.item} in ${currentCraft.duration}s)`);
  }

  // Largest batch
  if (!updated.largestBatch || currentCraft.quantity > updated.largestBatch.quantity) {
    updated.largestBatch = {
      item: currentCraft.item,
      quantity: currentCraft.quantity
    };
    achievements.push(`New record: Largest batch (${currentCraft.quantity}x ${currentCraft.item})`);
  }

  // Most efficient (items/second)
  const efficiency = currentCraft.quantity / (currentCraft.duration || 1);
  if (!updated.mostEfficient || efficiency > updated.mostEfficient.efficiency) {
    updated.mostEfficient = {
      item: currentCraft.item,
      efficiency: efficiency.toFixed(2)
    };
    achievements.push(`New record: Most efficient (${efficiency.toFixed(2)} items/sec)`);
  }

  return {
    personalBests: updated,
    newAchievements: achievements,
    hasNewRecord: achievements.length > 0
  };
}

/**
 * Generate crafting suggestions based on analytics
 * @param {Object} analytics - Analytics data
 * @returns {Object} Personalized suggestions
 */
export function generateSuggestions(analytics = {}) {
  const suggestions = [];

  // Stock suggestions based on usage
  if (analytics.topItems && analytics.topItems.length > 0) {
    const topItem = analytics.topItems[0];
    suggestions.push({
      type: "stock_management",
      priority: "high",
      message: `You craft ${topItem.item} frequently (${topItem.count} times) - consider keeping 128+ in stock`,
      action: "increase_stock",
      item: topItem.item,
      recommendedStock: 128
    });
  }

  // Batch crafting suggestion
  if (analytics.avgBatchSize && analytics.avgBatchSize < 8) {
    suggestions.push({
      type: "efficiency",
      priority: "medium",
      message: "Batch crafting 64 items is 30% faster than crafting 8 separate times",
      action: "increase_batch_size",
      benefit: "30% time savings"
    });
  }

  // Automation suggestion
  if (analytics.totalCrafts > 100 && !analytics.hasAutomation) {
    suggestions.push({
      type: "automation",
      priority: "medium",
      message: "You've crafted 100+ items - consider setting up autocrafters",
      action: "add_automation",
      benefit: "Hands-free crafting"
    });
  }

  // Waste reduction
  if (analytics.wasteRate && analytics.wasteRate > 0.15) {
    suggestions.push({
      type: "waste_reduction",
      priority: "low",
      message: `${(analytics.wasteRate * 100).toFixed(0)}% of ingredients wasted - optimize batch sizes`,
      action: "minimize_waste",
      benefit: "Save materials"
    });
  }

  return {
    suggestions: suggestions,
    topPriority: suggestions.find(s => s.priority === "high") || suggestions[0],
    summary: suggestions.length > 0
      ? `${suggestions.length} optimization opportunities found`
      : "Crafting performance is optimal!"
  };
}

/**
 * Compare crafting performance over time
 * @param {Object} previousPeriod - Stats from previous period
 * @param {Object} currentPeriod - Stats from current period
 * @returns {Object} Trend analysis
 */
export function analyzeTrends(previousPeriod, currentPeriod) {
  const changes = {};

  // Total crafts
  const craftsDelta = (currentPeriod.totalCrafts || 0) - (previousPeriod.totalCrafts || 0);
  changes.crafts = {
    previous: previousPeriod.totalCrafts,
    current: currentPeriod.totalCrafts,
    change: craftsDelta,
    trend: craftsDelta > 0 ? "increasing" : craftsDelta < 0 ? "decreasing" : "stable"
  };

  // Efficiency
  const effDelta = (currentPeriod.efficiencyScore || 0) - (previousPeriod.efficiencyScore || 0);
  changes.efficiency = {
    previous: previousPeriod.efficiencyScore,
    current: currentPeriod.efficiencyScore,
    change: effDelta,
    trend: effDelta > 5 ? "improving" : effDelta < -5 ? "declining" : "stable"
  };

  // Waste rate
  const wasteDelta = (currentPeriod.wasteRate || 0) - (previousPeriod.wasteRate || 0);
  changes.waste = {
    previous: (previousPeriod.wasteRate * 100).toFixed(1) + "%",
    current: (currentPeriod.wasteRate * 100).toFixed(1) + "%",
    change: (wasteDelta * 100).toFixed(1) + "%",
    trend: wasteDelta < 0 ? "improving" : wasteDelta > 0 ? "worsening" : "stable"
  };

  return {
    period: "comparison",
    changes: changes,
    overallTrend: effDelta > 0 && wasteDelta < 0 ? "improving" : effDelta < 0 || wasteDelta > 0 ? "declining" : "stable",
    summary: effDelta > 0
      ? `Performance improving (+${effDelta} efficiency points)`
      : "Performance stable"
  };
}

/**
 * Generate monthly crafting report
 * @param {Array} monthlyData - Crafting data for the month
 * @returns {Object} Monthly report
 */
export function generateMonthlyReport(monthlyData = []) {
  const analytics = analyzeCraftingHistory(monthlyData);

  if (analytics.error) {
    return analytics;
  }

  const totalItems = monthlyData.reduce((sum, craft) => sum + (craft.quantity || 1), 0);
  const totalTime = monthlyData.reduce((sum, craft) => sum + (craft.duration || 0), 0);

  return {
    period: "monthly",
    totalCrafts: analytics.totalCrafts,
    totalItemsCrafted: totalItems,
    totalTimeSpent: `${Math.floor(totalTime / 60)}m ${totalTime % 60}s`,
    topItems: analytics.topItems.slice(0, 5),
    averagePerDay: Math.round(analytics.totalCrafts / 30),
    efficiency: calculateEfficiencyScore({
      avgBatchSize: totalItems / analytics.totalCrafts,
      wasteRate: 0.12 // placeholder
    }),
    summary: `Crafted ${totalItems} items across ${analytics.totalCrafts} sessions this month`
  };
}
