// tasks/craft_batch_optimizer.js
// Batch crafting optimization system

import { normalizeItemName, countInventoryItems, hasInventoryItem } from "./helpers.js";
import { getRecipe } from "./craft_recipe_database.js";

// Stack size constants
const STACK_SIZES = {
  default: 64,
  tool: 1,
  weapon: 1,
  armor: 1,
  potion: 1,
  bucket: 16,
  sign: 16,
  ender_pearl: 16,
  snowball: 16,
  egg: 16,
  banner: 16
};

// Efficiency multipliers for batch crafting
const BATCH_EFFICIENCY = {
  single_item: { timeMultiplier: 1.0, description: "Single craft" },
  batch_8: { timeMultiplier: 0.85, description: "Small batch (8 items)" },
  batch_16: { timeMultiplier: 0.75, description: "Medium batch (16 items)" },
  batch_32: { timeMultiplier: 0.70, description: "Large batch (32 items)" },
  batch_64: { timeMultiplier: 0.65, description: "Full stack batch (64 items)" }
};

/**
 * Get stack size for an item
 * @param {string} item - Item name
 * @returns {number} Stack size (1-64)
 */
export function getStackSize(item) {
  const normalized = normalizeItemName(item);
  const recipe = getRecipe(normalized);

  if (recipe) {
    const category = recipe.category;
    if (category === "tools" || category === "weapons" || category === "armor") {
      return 1;
    }
  }

  // Check special cases
  for (const [type, size] of Object.entries(STACK_SIZES)) {
    if (normalized.includes(type)) {
      return size;
    }
  }

  return STACK_SIZES.default;
}

/**
 * Calculate optimal batch size for crafting
 * @param {string} item - Item to craft
 * @param {number} quantity - Desired quantity
 * @param {Object} inventory - Current inventory
 * @returns {Object} Optimized batch information
 */
export function calculateOptimalBatchSize(item, quantity, inventory = {}) {
  if (!item || !Number.isFinite(quantity) || quantity <= 0) {
    return { error: "Invalid item or quantity" };
  }

  const recipe = getRecipe(item);
  if (!recipe) {
    return { error: `No recipe found for ${item}` };
  }

  const stackSize = getStackSize(item);
  const yieldPerCraft = recipe.yield || 1;

  // Calculate number of crafting operations needed
  const craftsNeeded = Math.ceil(quantity / yieldPerCraft);

  // Calculate total output (may be more than requested due to yield)
  const totalOutput = craftsNeeded * yieldPerCraft;

  // Check ingredient availability
  const ingredientConstraints = [];
  for (const ingredient of recipe.ingredients || []) {
    const available = countInventoryItems(inventory, ingredient.name);
    const totalNeeded = ingredient.count * craftsNeeded;
    const maxCrafts = Math.floor(available / ingredient.count);

    ingredientConstraints.push({
      ingredient: ingredient.name,
      needed: totalNeeded,
      available: available,
      maxCrafts: maxCrafts,
      sufficient: available >= totalNeeded
    });
  }

  // Find the limiting ingredient
  const limitingIngredient = ingredientConstraints.reduce((min, curr) =>
    curr.maxCrafts < min.maxCrafts ? curr : min
  );

  const actualCraftsAvailable = limitingIngredient.maxCrafts;

  // Determine optimal batch sizes
  const batches = [];
  let remainingCrafts = Math.min(craftsNeeded, actualCraftsAvailable);

  // Optimize for full stacks when possible
  if (stackSize === 64) {
    // Full stack batches (64 items)
    while (remainingCrafts * yieldPerCraft >= 64) {
      const craftsForStack = Math.floor(64 / yieldPerCraft);
      batches.push({
        size: craftsForStack * yieldPerCraft,
        crafts: craftsForStack,
        efficiency: "batch_64",
        timeMultiplier: BATCH_EFFICIENCY.batch_64.timeMultiplier
      });
      remainingCrafts -= craftsForStack;
    }

    // Half stack batches (32 items)
    if (remainingCrafts * yieldPerCraft >= 32) {
      const craftsForHalf = Math.floor(32 / yieldPerCraft);
      batches.push({
        size: craftsForHalf * yieldPerCraft,
        crafts: craftsForHalf,
        efficiency: "batch_32",
        timeMultiplier: BATCH_EFFICIENCY.batch_32.timeMultiplier
      });
      remainingCrafts -= craftsForHalf;
    }
  }

  // Handle remaining items
  if (remainingCrafts > 0) {
    const remainingOutput = remainingCrafts * yieldPerCraft;
    let efficiency = "single_item";

    if (remainingOutput >= 16) {
      efficiency = "batch_16";
    } else if (remainingOutput >= 8) {
      efficiency = "batch_8";
    }

    batches.push({
      size: remainingOutput,
      crafts: remainingCrafts,
      efficiency: efficiency,
      timeMultiplier: BATCH_EFFICIENCY[efficiency].timeMultiplier
    });
  }

  // Calculate time savings
  const baseTime = craftsNeeded * 1000; // 1 second per craft baseline
  let optimizedTime = 0;

  for (const batch of batches) {
    optimizedTime += batch.crafts * 1000 * batch.timeMultiplier;
  }

  const timeSaved = baseTime - optimizedTime;
  const efficiencyGain = ((timeSaved / baseTime) * 100).toFixed(1);

  return {
    item: item,
    requestedQuantity: quantity,
    totalOutput: totalOutput,
    craftsNeeded: craftsNeeded,
    actualCraftsAvailable: actualCraftsAvailable,
    canCraftAll: actualCraftsAvailable >= craftsNeeded,
    stackSize: stackSize,
    batches: batches,
    ingredientConstraints: ingredientConstraints,
    limitingIngredient: limitingIngredient.ingredient,
    timeEstimate: {
      baseTime: baseTime,
      optimizedTime: Math.ceil(optimizedTime),
      timeSaved: Math.ceil(timeSaved),
      efficiencyGain: `${efficiencyGain}%`
    },
    recommendation: batches.length > 1
      ? `Craft in ${batches.length} batches for ${efficiencyGain}% time savings`
      : `Craft as single batch`
  };
}

/**
 * Suggest optimal crafting order for multiple items based on dependencies
 * @param {Array} items - Array of items to craft
 * @param {Object} inventory - Current inventory
 * @returns {Object} Ordered crafting plan
 */
export function suggestCraftingOrder(items, inventory = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Invalid items list" };
  }

  const craftingGraph = [];
  const dependencies = new Map();

  // Build dependency graph
  for (const itemName of items) {
    const recipe = getRecipe(itemName);
    if (!recipe) {
      continue;
    }

    const itemDeps = [];

    for (const ingredient of recipe.ingredients || []) {
      // Check if this ingredient is also being crafted
      if (items.includes(ingredient.name)) {
        itemDeps.push(ingredient.name);
      }
    }

    dependencies.set(itemName, itemDeps);
    craftingGraph.push({
      item: itemName,
      recipe: recipe,
      dependencies: itemDeps,
      dependencyCount: itemDeps.length
    });
  }

  // Topological sort to determine order
  const ordered = [];
  const visited = new Set();
  const visiting = new Set();

  const visit = (itemName) => {
    if (visited.has(itemName)) {
      return true;
    }

    if (visiting.has(itemName)) {
      // Circular dependency detected
      return false;
    }

    visiting.add(itemName);

    const deps = dependencies.get(itemName) || [];
    for (const dep of deps) {
      if (!visit(dep)) {
        return false;
      }
    }

    visiting.delete(itemName);
    visited.add(itemName);
    ordered.push(itemName);

    return true;
  };

  // Visit all items
  for (const itemName of items) {
    if (!visited.has(itemName)) {
      if (!visit(itemName)) {
        return {
          error: "Circular dependency detected",
          items: items
        };
      }
    }
  }

  // Build ordered steps with explanations
  const steps = ordered.map((itemName, index) => {
    const recipe = getRecipe(itemName);
    const deps = dependencies.get(itemName) || [];

    let reason = "No dependencies";
    if (deps.length > 0) {
      reason = `Requires: ${deps.join(", ")}`;
    }

    return {
      order: index + 1,
      item: itemName,
      reason: reason,
      station: recipe.station,
      category: recipe.category
    };
  });

  return {
    success: true,
    orderedItems: ordered,
    steps: steps,
    totalItems: items.length,
    hasDependencies: craftingGraph.some(item => item.dependencyCount > 0),
    recommendation: steps.length > 1
      ? `Craft in this order to satisfy dependencies: ${ordered.join(" → ")}`
      : `Items can be crafted in any order`
  };
}

/**
 * Calculate furnace array optimization
 * @param {string} item - Item to smelt
 * @param {number} quantity - Quantity to smelt
 * @param {number} furnaceCount - Number of furnaces available
 * @returns {Object} Furnace distribution plan
 */
export function optimizeFurnaceArray(item, quantity, furnaceCount = 1) {
  const recipe = getRecipe(item);

  if (!recipe || recipe.station !== "furnace") {
    return { error: "Item cannot be smelted or recipe not found" };
  }

  if (!Number.isFinite(furnaceCount) || furnaceCount < 1) {
    furnaceCount = 1;
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    quantity = 1;
  }

  const smeltTime = recipe.smeltTime || 10; // seconds per item
  const itemsPerFurnace = Math.ceil(quantity / furnaceCount);

  // Calculate fuel needed per furnace (1 coal smelts 8 items)
  const fuelPerFurnace = Math.ceil(itemsPerFurnace / 8);
  const totalFuelNeeded = fuelPerFurnace * furnaceCount;

  // Calculate time
  const parallelTime = itemsPerFurnace * smeltTime;
  const singleFurnaceTime = quantity * smeltTime;
  const timeSaved = singleFurnaceTime - parallelTime;

  return {
    item: item,
    quantity: quantity,
    furnaceCount: furnaceCount,
    itemsPerFurnace: itemsPerFurnace,
    fuelPerFurnace: fuelPerFurnace,
    totalFuelNeeded: totalFuelNeeded,
    smeltTimePerItem: smeltTime,
    parallelTime: parallelTime,
    singleFurnaceTime: singleFurnaceTime,
    timeSaved: timeSaved,
    efficiency: `${((timeSaved / singleFurnaceTime) * 100).toFixed(1)}%`,
    distribution: Array(furnaceCount).fill(null).map((_, index) => ({
      furnace: index + 1,
      items: itemsPerFurnace,
      fuel: fuelPerFurnace
    })),
    recommendation: furnaceCount > 1
      ? `Distribute ${itemsPerFurnace} items and ${fuelPerFurnace} fuel per furnace`
      : `Use single furnace with ${totalFuelNeeded} fuel`
  };
}

/**
 * Calculate brewing stand batch optimization
 * @param {number} potionCount - Number of potions to brew
 * @returns {Object} Brewing batch plan
 */
export function optimizeBrewingBatches(potionCount) {
  if (!Number.isFinite(potionCount) || potionCount <= 0) {
    potionCount = 1;
  }

  const bottlesPerBatch = 3;
  const batchesNeeded = Math.ceil(potionCount / bottlesPerBatch);
  const totalBottles = batchesNeeded * bottlesPerBatch;
  const blazePowderNeeded = batchesNeeded; // 1 blaze powder per batch

  return {
    potionsRequested: potionCount,
    bottlesPerBatch: bottlesPerBatch,
    batchesNeeded: batchesNeeded,
    totalBottles: totalBottles,
    extraBottles: totalBottles - potionCount,
    blazePowderNeeded: blazePowderNeeded,
    waterNeeded: totalBottles,
    recommendation: `Prepare ${batchesNeeded} batches of 3 bottles each with ${blazePowderNeeded} blaze powder`
  };
}

/**
 * Minimize leftover ingredients
 * @param {string} item - Item to craft
 * @param {Object} inventory - Current inventory
 * @returns {Object} Optimization to minimize waste
 */
export function minimizeLeftovers(item, inventory = {}) {
  const recipe = getRecipe(item);

  if (!recipe) {
    return { error: `No recipe found for ${item}` };
  }

  const ingredientCounts = [];

  for (const ingredient of recipe.ingredients || []) {
    const available = countInventoryItems(inventory, ingredient.name);
    const maxCrafts = Math.floor(available / ingredient.count);

    ingredientCounts.push({
      ingredient: ingredient.name,
      available: available,
      perCraft: ingredient.count,
      maxCrafts: maxCrafts
    });
  }

  // Find the maximum number of complete crafts possible
  const maxCrafts = ingredientCounts.reduce((min, curr) =>
    curr.maxCrafts < min ? curr.maxCrafts : min
  , Infinity);

  // Calculate leftovers
  const leftovers = ingredientCounts.map(ing => ({
    ingredient: ing.ingredient,
    leftover: ing.available - (ing.perCraft * maxCrafts),
    percentageWaste: ((ing.available - (ing.perCraft * maxCrafts)) / ing.available * 100).toFixed(1)
  }));

  const totalOutput = maxCrafts * (recipe.yield || 1);

  return {
    item: item,
    maxCraftsWithoutWaste: maxCrafts,
    totalOutput: totalOutput,
    leftovers: leftovers,
    hasWaste: leftovers.some(l => l.leftover > 0),
    recommendation: leftovers.every(l => l.leftover === 0)
      ? `Perfect fit! Craft ${maxCrafts} times to use all ingredients`
      : `Craft ${maxCrafts} times to minimize waste. ${leftovers.filter(l => l.leftover > 0).map(l => `${l.leftover} ${l.ingredient}`).join(", ")} will remain`
  };
}
