// tasks/craft_recipe_discovery.js
// Recipe unlocking and discovery system

import { normalizeItemName } from "./helpers.js";
import { RECIPE_DATABASE, getRecipe } from "./craft_recipe_database.js";

/**
 * Track and suggest next recipe unlocks
 * @param {Array} unlockedRecipes - List of unlocked recipe names
 * @returns {Object} Unlock progression suggestions
 */
export function suggestNextUnlock(unlockedRecipes = []) {
  const progressionPaths = {
    early_game: ["wooden_pickaxe", "crafting_table", "furnace", "stone_pickaxe", "iron_pickaxe"],
    tools: ["wooden_pickaxe", "stone_pickaxe", "iron_pickaxe", "diamond_pickaxe"],
    armor: ["iron_helmet", "iron_chestplate", "iron_leggings", "iron_boots", "diamond_armor"],
    weapons: ["wooden_sword", "stone_sword", "iron_sword", "diamond_sword"],
    advanced: ["anvil", "enchanting_table", "brewing_stand", "smithing_table"]
  };

  const suggestions = [];

  for (const [path, recipes] of Object.entries(progressionPaths)) {
    const unlocked = recipes.filter(r => unlockedRecipes.includes(r));
    const nextUnlock = recipes.find(r => !unlockedRecipes.includes(r));

    if (nextUnlock) {
      suggestions.push({
        path: path,
        progress: `${unlocked.length}/${recipes.length}`,
        nextRecipe: nextUnlock,
        reason: `Continue ${path.replace(/_/g, " ")} progression`
      });
    }
  }

  return {
    unlockedCount: unlockedRecipes.length,
    totalRecipes: Object.keys(RECIPE_DATABASE).length,
    suggestions: suggestions,
    recommendation: suggestions.length > 0
      ? `Try unlocking: ${suggestions[0].nextRecipe}`
      : "You've unlocked all progression recipes!"
  };
}

/**
 * Find what can be crafted with current inventory
 * @param {Object} inventory - Current inventory items
 * @returns {Object} Craftable recipes
 */
export function findCraftableRecipes(inventory = {}) {
  const craftable = [];
  const almostCraftable = [];

  for (const [itemName, recipe] of Object.entries(RECIPE_DATABASE)) {
    if (!recipe.ingredients) continue;

    let canCraft = true;
    const missing = [];

    for (const ingredient of recipe.ingredients) {
      const available = inventory[ingredient.name] || 0;
      if (available < ingredient.count) {
        canCraft = false;
        missing.push({
          item: ingredient.name,
          needed: ingredient.count,
          have: available,
          deficit: ingredient.count - available
        });
      }
    }

    if (canCraft) {
      craftable.push({
        item: itemName,
        recipe: recipe,
        category: recipe.category
      });
    } else if (missing.length <= 2) {
      almostCraftable.push({
        item: itemName,
        missing: missing
      });
    }
  }

  return {
    craftable: craftable,
    almostCraftable: almostCraftable.slice(0, 10),
    summary: `You can craft ${craftable.length} items right now`,
    recommendation: almostCraftable.length > 0
      ? `Close to crafting: ${almostCraftable[0].item} (need ${almostCraftable[0].missing.map(m => m.item).join(", ")})`
      : null
  };
}

/**
 * Bookmark frequently used recipes
 * @param {Array} usageHistory - Recipe usage history
 * @returns {Object} Bookmarked favorites
 */
export function bookmarkFavorites(usageHistory = []) {
  const defaultFavorites = ["torch", "stick", "crafting_table", "chest"];

  if (usageHistory.length === 0) {
    return {
      favorites: defaultFavorites,
      source: "defaults",
      recommendation: "These are common starting recipes"
    };
  }

  // Count recipe usage
  const usage = {};
  for (const entry of usageHistory) {
    const item = normalizeItemName(entry.item || entry);
    usage[item] = (usage[item] || 0) + 1;
  }

  // Get top 10 most used
  const favorites = Object.entries(usage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([item]) => item);

  return {
    favorites: favorites,
    source: "usage_history",
    topRecipe: favorites[0],
    recommendation: `Quick access: ${favorites.slice(0, 5).join(", ")}`
  };
}
