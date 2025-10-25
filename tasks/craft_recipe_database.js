// tasks/craft_recipe_database.js
// Comprehensive recipe database with validation

import { normalizeItemName } from "./helpers.js";

// Recipe database with detailed information
export const RECIPE_DATABASE = {
  // Tools - Diamond Tier
  diamond_pickaxe: {
    station: "crafting_table",
    ingredients: [
      { name: "diamond", count: 3 },
      { name: "stick", count: 2 }
    ],
    yield: 1,
    category: "tools",
    tier: "diamond",
    durability: 1561,
    unlockRequirement: null
  },

  diamond_sword: {
    station: "crafting_table",
    ingredients: [
      { name: "diamond", count: 2 },
      { name: "stick", count: 1 }
    ],
    yield: 1,
    category: "weapons",
    tier: "diamond",
    durability: 1561
  },

  diamond_axe: {
    station: "crafting_table",
    ingredients: [
      { name: "diamond", count: 3 },
      { name: "stick", count: 2 }
    ],
    yield: 1,
    category: "tools",
    tier: "diamond",
    durability: 1561
  },

  diamond_shovel: {
    station: "crafting_table",
    ingredients: [
      { name: "diamond", count: 1 },
      { name: "stick", count: 2 }
    ],
    yield: 1,
    category: "tools",
    tier: "diamond",
    durability: 1561
  },

  diamond_hoe: {
    station: "crafting_table",
    ingredients: [
      { name: "diamond", count: 2 },
      { name: "stick", count: 2 }
    ],
    yield: 1,
    category: "tools",
    tier: "diamond",
    durability: 1561
  },

  // Tools - Iron Tier
  iron_pickaxe: {
    station: "crafting_table",
    ingredients: [
      { name: "iron_ingot", count: 3 },
      { name: "stick", count: 2 }
    ],
    yield: 1,
    category: "tools",
    tier: "iron",
    durability: 250
  },

  iron_sword: {
    station: "crafting_table",
    ingredients: [
      { name: "iron_ingot", count: 2 },
      { name: "stick", count: 1 }
    ],
    yield: 1,
    category: "weapons",
    tier: "iron",
    durability: 250
  },

  iron_axe: {
    station: "crafting_table",
    ingredients: [
      { name: "iron_ingot", count: 3 },
      { name: "stick", count: 2 }
    ],
    yield: 1,
    category: "tools",
    tier: "iron",
    durability: 250
  },

  iron_shovel: {
    station: "crafting_table",
    ingredients: [
      { name: "iron_ingot", count: 1 },
      { name: "stick", count: 2 }
    ],
    yield: 1,
    category: "tools",
    tier: "iron",
    durability: 250
  },

  // Tools - Stone Tier
  stone_pickaxe: {
    station: "crafting_table",
    ingredients: [
      { name: "cobblestone", count: 3 },
      { name: "stick", count: 2 }
    ],
    yield: 1,
    category: "tools",
    tier: "stone",
    durability: 131
  },

  stone_sword: {
    station: "crafting_table",
    ingredients: [
      { name: "cobblestone", count: 2 },
      { name: "stick", count: 1 }
    ],
    yield: 1,
    category: "weapons",
    tier: "stone",
    durability: 131
  },

  stone_axe: {
    station: "crafting_table",
    ingredients: [
      { name: "cobblestone", count: 3 },
      { name: "stick", count: 2 }
    ],
    yield: 1,
    category: "tools",
    tier: "stone",
    durability: 131
  },

  // Tools - Wooden Tier
  wooden_pickaxe: {
    station: "crafting_table",
    ingredients: [
      { name: "planks", count: 3 },
      { name: "stick", count: 2 }
    ],
    yield: 1,
    category: "tools",
    tier: "wooden",
    durability: 59
  },

  wooden_sword: {
    station: "crafting_table",
    ingredients: [
      { name: "planks", count: 2 },
      { name: "stick", count: 1 }
    ],
    yield: 1,
    category: "weapons",
    tier: "wooden",
    durability: 59
  },

  // Basic Items
  stick: {
    station: "crafting_table",
    ingredients: [{ name: "planks", count: 2 }],
    yield: 4,
    category: "materials",
    tier: "basic"
  },

  planks: {
    station: "crafting_table",
    ingredients: [{ name: "log", count: 1 }],
    yield: 4,
    category: "materials",
    tier: "basic",
    acceptsSubstitutes: true
  },

  crafting_table: {
    station: "hand",
    ingredients: [{ name: "planks", count: 4 }],
    yield: 1,
    category: "blocks",
    tier: "basic"
  },

  torch: {
    station: "crafting_table",
    ingredients: [
      { name: "coal", count: 1 },
      { name: "stick", count: 1 }
    ],
    yield: 4,
    category: "lighting",
    tier: "basic"
  },

  // Smelting Recipes
  iron_ingot: {
    station: "furnace",
    ingredients: [{ name: "iron_ore", count: 1 }],
    fuel: ["coal", "charcoal"],
    smeltTime: 10,
    yield: 1,
    category: "materials",
    tier: "smelted",
    byproduct: { experience: 0.7 }
  },

  gold_ingot: {
    station: "furnace",
    ingredients: [{ name: "gold_ore", count: 1 }],
    fuel: ["coal", "charcoal"],
    smeltTime: 10,
    yield: 1,
    category: "materials",
    tier: "smelted",
    byproduct: { experience: 1.0 }
  },

  glass: {
    station: "furnace",
    ingredients: [{ name: "sand", count: 1 }],
    fuel: ["coal", "charcoal"],
    smeltTime: 10,
    yield: 1,
    category: "blocks",
    tier: "smelted",
    byproduct: { experience: 0.1 }
  },

  // Armor - Iron
  iron_helmet: {
    station: "crafting_table",
    ingredients: [{ name: "iron_ingot", count: 5 }],
    yield: 1,
    category: "armor",
    tier: "iron",
    durability: 165,
    armorValue: 2
  },

  iron_chestplate: {
    station: "crafting_table",
    ingredients: [{ name: "iron_ingot", count: 8 }],
    yield: 1,
    category: "armor",
    tier: "iron",
    durability: 240,
    armorValue: 6
  },

  iron_leggings: {
    station: "crafting_table",
    ingredients: [{ name: "iron_ingot", count: 7 }],
    yield: 1,
    category: "armor",
    tier: "iron",
    durability: 225,
    armorValue: 5
  },

  iron_boots: {
    station: "crafting_table",
    ingredients: [{ name: "iron_ingot", count: 4 }],
    yield: 1,
    category: "armor",
    tier: "iron",
    durability: 195,
    armorValue: 2
  },

  // Armor - Diamond
  diamond_helmet: {
    station: "crafting_table",
    ingredients: [{ name: "diamond", count: 5 }],
    yield: 1,
    category: "armor",
    tier: "diamond",
    durability: 363,
    armorValue: 3
  },

  diamond_chestplate: {
    station: "crafting_table",
    ingredients: [{ name: "diamond", count: 8 }],
    yield: 1,
    category: "armor",
    tier: "diamond",
    durability: 528,
    armorValue: 8
  },

  diamond_leggings: {
    station: "crafting_table",
    ingredients: [{ name: "diamond", count: 7 }],
    yield: 1,
    category: "armor",
    tier: "diamond",
    durability: 495,
    armorValue: 6
  },

  diamond_boots: {
    station: "crafting_table",
    ingredients: [{ name: "diamond", count: 4 }],
    yield: 1,
    category: "armor",
    tier: "diamond",
    durability: 429,
    armorValue: 3
  },

  // Utility Items
  bucket: {
    station: "crafting_table",
    ingredients: [{ name: "iron_ingot", count: 3 }],
    yield: 1,
    category: "utility",
    tier: "iron"
  },

  shears: {
    station: "crafting_table",
    ingredients: [{ name: "iron_ingot", count: 2 }],
    yield: 1,
    category: "tools",
    tier: "iron",
    durability: 238
  },

  chest: {
    station: "crafting_table",
    ingredients: [{ name: "planks", count: 8 }],
    yield: 1,
    category: "storage",
    tier: "basic"
  },

  furnace: {
    station: "crafting_table",
    ingredients: [{ name: "cobblestone", count: 8 }],
    yield: 1,
    category: "stations",
    tier: "basic"
  },

  // Food
  bread: {
    station: "crafting_table",
    ingredients: [{ name: "wheat", count: 3 }],
    yield: 1,
    category: "food",
    tier: "basic",
    nutrition: 5
  },

  cooked_beef: {
    station: "furnace",
    ingredients: [{ name: "raw_beef", count: 1 }],
    fuel: ["coal", "charcoal"],
    smeltTime: 10,
    yield: 1,
    category: "food",
    tier: "cooked",
    nutrition: 8,
    byproduct: { experience: 0.35 }
  }
};

/**
 * Get recipe for an item
 * @param {string} itemName - The item to look up
 * @returns {Object|null} Recipe object or null if not found
 */
export function getRecipe(itemName) {
  if (!itemName || typeof itemName !== "string") {
    return null;
  }

  const normalized = normalizeItemName(itemName);
  return RECIPE_DATABASE[normalized] || null;
}

/**
 * Validate if provided ingredients match the recipe
 * @param {string} item - The item being crafted
 * @param {Array} providedIngredients - Ingredients provided by user
 * @returns {Object} Validation result with matches, missing, and extra ingredients
 */
export function validateRecipe(item, providedIngredients = []) {
  const recipe = getRecipe(item);

  if (!recipe) {
    return {
      valid: false,
      error: `No recipe found for ${item}`,
      suggestion: "Check item name or recipe database"
    };
  }

  if (!Array.isArray(providedIngredients)) {
    providedIngredients = [];
  }

  const recipeIngredients = recipe.ingredients || [];
  const missing = [];
  const extra = [];
  const incorrect = [];
  let allMatch = true;

  // Check for missing or incorrect ingredients
  for (const required of recipeIngredients) {
    const provided = providedIngredients.find(
      ing => normalizeItemName(ing.name) === normalizeItemName(required.name)
    );

    if (!provided) {
      missing.push(required);
      allMatch = false;
    } else if (provided.count !== required.count) {
      incorrect.push({
        ingredient: required.name,
        expected: required.count,
        provided: provided.count
      });
      allMatch = false;
    }
  }

  // Check for extra ingredients
  for (const provided of providedIngredients) {
    const required = recipeIngredients.find(
      ing => normalizeItemName(ing.name) === normalizeItemName(provided.name)
    );

    if (!required) {
      extra.push(provided);
      allMatch = false;
    }
  }

  return {
    valid: allMatch,
    recipe: recipe,
    missing: missing,
    extra: extra,
    incorrect: incorrect,
    suggestion: missing.length > 0
      ? `Missing: ${missing.map(ing => `${ing.count}x ${ing.name}`).join(", ")}`
      : incorrect.length > 0
      ? `Wrong amounts: ${incorrect.map(i => `${i.ingredient} needs ${i.expected}, got ${i.provided}`).join("; ")}`
      : null
  };
}

/**
 * Get all items that can be crafted with a specific ingredient
 * @param {string} ingredient - The ingredient to search for
 * @returns {Array} List of items that use this ingredient
 */
export function getRecipesUsingIngredient(ingredient) {
  const normalized = normalizeItemName(ingredient);
  const results = [];

  for (const [itemName, recipe] of Object.entries(RECIPE_DATABASE)) {
    if (!recipe.ingredients) continue;

    const usesIngredient = recipe.ingredients.some(
      ing => normalizeItemName(ing.name) === normalized
    );

    if (usesIngredient) {
      results.push({
        item: itemName,
        recipe: recipe,
        category: recipe.category,
        tier: recipe.tier
      });
    }
  }

  return results;
}

/**
 * Get all recipes in a specific category
 * @param {string} category - Category to filter by
 * @returns {Array} List of recipes in category
 */
export function getRecipesByCategory(category) {
  const results = [];

  for (const [itemName, recipe] of Object.entries(RECIPE_DATABASE)) {
    if (recipe.category === category) {
      results.push({
        item: itemName,
        recipe: recipe
      });
    }
  }

  return results;
}

/**
 * Get all recipes for a specific station
 * @param {string} station - Station name to filter by
 * @returns {Array} List of recipes for this station
 */
export function getRecipesByStation(station) {
  const normalized = normalizeItemName(station);
  const results = [];

  for (const [itemName, recipe] of Object.entries(RECIPE_DATABASE)) {
    if (normalizeItemName(recipe.station) === normalized) {
      results.push({
        item: itemName,
        recipe: recipe
      });
    }
  }

  return results;
}

/**
 * Calculate total ingredients needed for multiple crafts
 * @param {string} item - Item to craft
 * @param {number} quantity - How many to craft
 * @returns {Object} Total ingredients needed
 */
export function calculateTotalIngredients(item, quantity) {
  const recipe = getRecipe(item);

  if (!recipe) {
    return { error: `No recipe found for ${item}` };
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    quantity = 1;
  }

  const craftsNeeded = Math.ceil(quantity / (recipe.yield || 1));
  const totalIngredients = [];

  for (const ingredient of recipe.ingredients || []) {
    totalIngredients.push({
      name: ingredient.name,
      count: ingredient.count * craftsNeeded,
      perCraft: ingredient.count
    });
  }

  return {
    item: item,
    quantity: quantity,
    craftsNeeded: craftsNeeded,
    yield: recipe.yield || 1,
    totalOutput: craftsNeeded * (recipe.yield || 1),
    ingredients: totalIngredients,
    station: recipe.station,
    fuel: recipe.fuel || null
  };
}
