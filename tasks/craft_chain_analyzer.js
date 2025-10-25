// tasks/craft_chain_analyzer.js
// Crafting chain and dependency analysis system

import { normalizeItemName, countInventoryItems } from "./helpers.js";
import { getRecipe, getRecipesUsingIngredient } from "./craft_recipe_database.js";

/**
 * Analyze all dependencies for crafting an item
 * @param {string} targetItem - The item to craft
 * @param {number} quantity - How many to craft
 * @param {Object} inventory - Current inventory
 * @returns {Object} Complete dependency tree and crafting steps
 */
export function analyzeDependencies(targetItem, quantity = 1, inventory = {}) {
  if (!targetItem) {
    return { error: "Target item required" };
  }

  const normalized = normalizeItemName(targetItem);
  const recipe = getRecipe(normalized);

  if (!recipe) {
    return { error: `No recipe found for ${normalized}` };
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    quantity = 1;
  }

  const steps = [];
  const allIngredients = new Map();
  const bottlenecks = [];
  const visited = new Set();

  /**
   * Recursively analyze dependencies
   */
  const analyzeItem = (itemName, needed, depth = 0) => {
    const itemRecipe = getRecipe(itemName);

    if (!itemRecipe) {
      // This is a raw material that must be gathered
      const available = countInventoryItems(inventory, itemName);

      if (available < needed) {
        steps.push({
          item: itemName,
          action: "gather",
          quantity: needed - available,
          available: available,
          depth: depth,
          category: "resource_gathering"
        });

        if ((needed - available) > 64) {
          bottlenecks.push({
            item: itemName,
            reason: `Need to gather ${needed - available} ${itemName} (more than 1 stack)`,
            severity: "high"
          });
        }
      }

      // Track total ingredient needs
      const current = allIngredients.get(itemName) || 0;
      allIngredients.set(itemName, current + needed);

      return;
    }

    // Avoid circular dependencies
    if (visited.has(itemName)) {
      return;
    }

    visited.add(itemName);

    const available = countInventoryItems(inventory, itemName);
    const deficit = Math.max(0, needed - available);

    if (deficit === 0) {
      // We have enough, no need to craft
      return;
    }

    const yieldPerCraft = itemRecipe.yield || 1;
    const craftsNeeded = Math.ceil(deficit / yieldPerCraft);

    // Analyze sub-ingredients
    for (const ingredient of itemRecipe.ingredients || []) {
      const totalNeeded = ingredient.count * craftsNeeded;
      analyzeItem(ingredient.name, totalNeeded, depth + 1);
    }

    // Add this crafting step
    steps.push({
      item: itemName,
      action: "craft",
      quantity: craftsNeeded * yieldPerCraft,
      crafts: craftsNeeded,
      available: available,
      needed: needed,
      deficit: deficit,
      station: itemRecipe.station,
      depth: depth,
      category: itemRecipe.category,
      dependencies: itemRecipe.ingredients.map(ing => ing.name)
    });

    // Check for rare ingredients
    for (const ingredient of itemRecipe.ingredients || []) {
      if (ingredient.name.includes("diamond") || ingredient.name.includes("netherite")) {
        bottlenecks.push({
          item: itemName,
          reason: `Requires rare material: ${ingredient.name}`,
          severity: "medium"
        });
      }
    }

    visited.delete(itemName);
  };

  // Start analysis from target item
  analyzeItem(normalized, quantity, 0);

  // Sort steps by depth (deepest first - craft dependencies before dependents)
  steps.sort((a, b) => b.depth - a.depth);

  // Estimate total time
  const gatherTime = steps
    .filter(s => s.action === "gather")
    .reduce((sum, s) => sum + s.quantity * 2, 0); // 2 seconds per gather

  const craftTime = steps
    .filter(s => s.action === "craft")
    .reduce((sum, s) => sum + s.crafts * 3, 0); // 3 seconds per craft

  const smeltTime = steps
    .filter(s => s.station === "furnace")
    .reduce((sum, s) => sum + s.quantity * 10, 0); // 10 seconds per smelt

  const totalTime = gatherTime + craftTime + smeltTime;

  return {
    targetItem: normalized,
    targetQuantity: quantity,
    steps: steps,
    totalSteps: steps.length,
    allIngredients: Object.fromEntries(allIngredients),
    bottlenecks: bottlenecks,
    timeEstimate: {
      gathering: gatherTime,
      crafting: craftTime,
      smelting: smeltTime,
      total: totalTime,
      formatted: formatTime(totalTime)
    },
    canCraft: steps.filter(s => s.action === "gather" && s.quantity > 0).length === 0,
    summary: generateCraftingSummary(steps, normalized, quantity)
  };
}

/**
 * Get all items that can be crafted from a specific ingredient
 * @param {string} ingredient - The ingredient to search with
 * @returns {Object} List of craftable items
 */
export function reverseLookup(ingredient) {
  if (!ingredient) {
    return { error: "Ingredient required" };
  }

  const normalized = normalizeItemName(ingredient);
  const recipes = getRecipesUsingIngredient(normalized);

  if (recipes.length === 0) {
    return {
      ingredient: normalized,
      craftableItems: [],
      message: `No recipes found using ${normalized}`
    };
  }

  // Categorize by category
  const byCategory = {};

  for (const recipeInfo of recipes) {
    const category = recipeInfo.category || "misc";

    if (!byCategory[category]) {
      byCategory[category] = [];
    }

    byCategory[category].push({
      item: recipeInfo.item,
      station: recipeInfo.recipe.station,
      tier: recipeInfo.tier,
      yield: recipeInfo.recipe.yield || 1
    });
  }

  return {
    ingredient: normalized,
    totalRecipes: recipes.length,
    craftableItems: recipes.map(r => r.item),
    byCategory: byCategory,
    summary: `${normalized} can be used to craft ${recipes.length} different items`
  };
}

/**
 * Find the most efficient path to craft an item
 * @param {string} targetItem - Item to craft
 * @param {Object} inventory - Current inventory
 * @returns {Object} Optimized crafting path
 */
export function findOptimalCraftingPath(targetItem, inventory = {}) {
  const analysis = analyzeDependencies(targetItem, 1, inventory);

  if (analysis.error) {
    return analysis;
  }

  const paths = [];
  const currentPath = [];

  // Build crafting path from steps
  for (const step of analysis.steps) {
    if (step.action === "craft") {
      currentPath.push({
        step: currentPath.length + 1,
        action: `Craft ${step.quantity}x ${step.item}`,
        station: step.station,
        requires: step.dependencies
      });
    } else if (step.action === "gather" && step.quantity > 0) {
      currentPath.push({
        step: currentPath.length + 1,
        action: `Gather ${step.quantity}x ${step.item}`,
        station: "world",
        requires: []
      });
    }
  }

  return {
    targetItem: targetItem,
    path: currentPath,
    totalSteps: currentPath.length,
    bottlenecks: analysis.bottlenecks,
    timeEstimate: analysis.timeEstimate,
    recommendation: currentPath.length > 0
      ? `Follow ${currentPath.length} steps to craft ${targetItem}`
      : `${targetItem} can be crafted immediately with current inventory`
  };
}

/**
 * Analyze multiple items and find shared dependencies
 * @param {Array} items - List of items to analyze
 * @returns {Object} Shared dependencies and optimization opportunities
 */
export function findSharedDependencies(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Items array required" };
  }

  const dependenciesByItem = new Map();
  const ingredientUsage = new Map();

  // Analyze each item
  for (const itemName of items) {
    const analysis = analyzeDependencies(itemName, 1, {});

    if (analysis.error) {
      continue;
    }

    dependenciesByItem.set(itemName, analysis.allIngredients);

    // Track which items use which ingredients
    for (const [ingredient, count] of Object.entries(analysis.allIngredients)) {
      if (!ingredientUsage.has(ingredient)) {
        ingredientUsage.set(ingredient, []);
      }

      ingredientUsage.get(ingredient).push({
        item: itemName,
        count: count
      });
    }
  }

  // Find shared ingredients
  const sharedIngredients = [];

  for (const [ingredient, usage] of ingredientUsage.entries()) {
    if (usage.length > 1) {
      const totalNeeded = usage.reduce((sum, u) => sum + u.count, 0);

      sharedIngredients.push({
        ingredient: ingredient,
        usedBy: usage.map(u => u.item),
        itemCount: usage.length,
        totalNeeded: totalNeeded,
        details: usage
      });
    }
  }

  // Sort by most shared
  sharedIngredients.sort((a, b) => b.itemCount - a.itemCount);

  return {
    items: items,
    totalItems: items.length,
    sharedIngredients: sharedIngredients,
    totalShared: sharedIngredients.length,
    optimization: sharedIngredients.length > 0
      ? `Gather these shared ingredients in bulk: ${sharedIngredients.slice(0, 3).map(s => s.ingredient).join(", ")}`
      : "No shared ingredients found",
    bulkGatherList: sharedIngredients.map(s => ({
      ingredient: s.ingredient,
      total: s.totalNeeded
    }))
  };
}

/**
 * Predict missing tools needed for a crafting chain
 * @param {string} targetItem - Item to craft
 * @returns {Object} Required tools and their purposes
 */
export function predictRequiredTools(targetItem) {
  const analysis = analyzeDependencies(targetItem, 1, {});

  if (analysis.error) {
    return analysis;
  }

  const toolsNeeded = new Set();
  const purposes = {};

  for (const step of analysis.steps) {
    if (step.action === "gather") {
      // Determine tool based on material
      const item = step.item;

      if (item.includes("diamond")) {
        toolsNeeded.add("iron_pickaxe");
        purposes["iron_pickaxe"] = "Required to mine diamond ore";
      }

      if (item.includes("iron") || item.includes("gold")) {
        toolsNeeded.add("stone_pickaxe");
        purposes["stone_pickaxe"] = "Required to mine iron/gold ore";
      }

      if (item.includes("log") || item.includes("wood")) {
        toolsNeeded.add("axe");
        purposes["axe"] = "Efficiently gather wood";
      }

      if (item.includes("stone") || item.includes("cobblestone")) {
        toolsNeeded.add("pickaxe");
        purposes["pickaxe"] = "Required to mine stone";
      }
    }

    if (step.station === "furnace") {
      toolsNeeded.add("furnace");
      purposes["furnace"] = "Required for smelting";
    }

    if (step.station === "crafting_table" && !toolsNeeded.has("crafting_table")) {
      toolsNeeded.add("crafting_table");
      purposes["crafting_table"] = "Required for crafting";
    }
  }

  return {
    targetItem: targetItem,
    toolsNeeded: Array.from(toolsNeeded),
    purposes: purposes,
    summary: toolsNeeded.size > 0
      ? `You'll need: ${Array.from(toolsNeeded).join(", ")}`
      : "No special tools required"
  };
}

/**
 * Format time in seconds to human readable format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
function formatTime(seconds) {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`;
}

/**
 * Generate a summary of the crafting chain
 * @param {Array} steps - Crafting steps
 * @param {string} targetItem - Target item
 * @param {number} quantity - Quantity to craft
 * @returns {string} Human-readable summary
 */
function generateCraftingSummary(steps, targetItem, quantity) {
  const gatherSteps = steps.filter(s => s.action === "gather" && s.quantity > 0);
  const craftSteps = steps.filter(s => s.action === "craft");

  let summary = `To craft ${quantity}x ${targetItem}:\n`;

  if (gatherSteps.length > 0) {
    summary += `\n1. Gather Resources:\n`;
    for (const step of gatherSteps) {
      summary += `   - ${step.quantity}x ${step.item}\n`;
    }
  }

  if (craftSteps.length > 0) {
    summary += `\n2. Crafting Steps (in order):\n`;
    for (const step of craftSteps) {
      summary += `   - Craft ${step.quantity}x ${step.item} at ${step.station}\n`;
    }
  }

  if (gatherSteps.length === 0 && craftSteps.length === 0) {
    summary = `You already have enough materials to craft ${quantity}x ${targetItem}!`;
  }

  return summary;
}

/**
 * Calculate experience gain from crafting chain
 * @param {string} targetItem - Item to craft
 * @param {number} quantity - Quantity to craft
 * @returns {Object} Experience breakdown
 */
export function calculateCraftingExperience(targetItem, quantity = 1) {
  const analysis = analyzeDependencies(targetItem, quantity, {});

  if (analysis.error) {
    return analysis;
  }

  let totalXP = 0;
  const xpSources = [];

  for (const step of analysis.steps) {
    if (step.station === "furnace") {
      const recipe = getRecipe(step.item);
      if (recipe && recipe.byproduct && recipe.byproduct.experience) {
        const xpPerItem = recipe.byproduct.experience;
        const totalItemXP = xpPerItem * step.quantity;
        totalXP += totalItemXP;

        xpSources.push({
          source: `Smelting ${step.item}`,
          quantity: step.quantity,
          xpPerItem: xpPerItem,
          totalXP: totalItemXP
        });
      }
    }
  }

  return {
    targetItem: targetItem,
    quantity: quantity,
    totalExperience: totalXP.toFixed(2),
    experienceLevel: Math.floor(totalXP),
    sources: xpSources,
    summary: totalXP > 0
      ? `Crafting ${quantity}x ${targetItem} will yield approximately ${totalXP.toFixed(2)} XP`
      : `No experience gained from crafting ${targetItem}`
  };
}
