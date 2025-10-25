// tasks/craft_substitution_system.js
// Material substitution and alternative finder system

import { normalizeItemName, countInventoryItems } from "./helpers.js";

// Fuel alternatives with burn times and efficiency
export const FUEL_ALTERNATIVES = {
  coal: {
    burnTime: 80,
    itemsPerFuel: 8,
    efficiency: 1.0,
    category: "standard",
    obtainMethod: "mining"
  },
  charcoal: {
    burnTime: 80,
    itemsPerFuel: 8,
    efficiency: 1.0,
    category: "standard",
    obtainMethod: "smelting_logs",
    renewable: true
  },
  coal_block: {
    burnTime: 800,
    itemsPerFuel: 80,
    efficiency: 1.0,
    category: "compressed",
    obtainMethod: "crafting_9_coal",
    note: "Highly efficient for large smelting jobs"
  },
  lava_bucket: {
    burnTime: 1000,
    itemsPerFuel: 100,
    efficiency: 1.0,
    category: "liquid",
    obtainMethod: "bucket_in_lava",
    reusableBucket: true,
    note: "Returns empty bucket after use"
  },
  blaze_rod: {
    burnTime: 120,
    itemsPerFuel: 12,
    efficiency: 1.5,
    category: "nether",
    obtainMethod: "killing_blazes"
  },
  dried_kelp_block: {
    burnTime: 200,
    itemsPerFuel: 20,
    efficiency: 0.25,
    category: "renewable",
    obtainMethod: "crafting_dried_kelp",
    renewable: true,
    note: "Renewable but less efficient"
  },
  bamboo: {
    burnTime: 2.5,
    itemsPerFuel: 0.25,
    efficiency: 0.05,
    category: "renewable",
    obtainMethod: "farming",
    renewable: true,
    note: "Very inefficient, use only in emergencies"
  },
  log: {
    burnTime: 15,
    itemsPerFuel: 1.5,
    efficiency: 0.19,
    category: "basic",
    obtainMethod: "chopping_trees",
    note: "Better to convert to charcoal first"
  },
  planks: {
    burnTime: 15,
    itemsPerFuel: 1.5,
    efficiency: 0.19,
    category: "basic",
    obtainMethod: "crafting_from_logs",
    note: "Wasteful - 1 log = 4 planks but same burn time"
  },
  stick: {
    burnTime: 5,
    itemsPerFuel: 0.5,
    efficiency: 0.06,
    category: "basic",
    obtainMethod: "crafting_from_planks",
    note: "Very wasteful fuel option"
  }
};

// Wood type alternatives (interchangeable in most recipes)
export const WOOD_ALTERNATIVES = {
  types: [
    "oak",
    "birch",
    "spruce",
    "jungle",
    "acacia",
    "dark_oak",
    "mangrove",
    "cherry",
    "crimson",
    "warped"
  ],
  note: "Any wood type works for most recipes",
  preferenceOrder: ["oak", "birch", "spruce", "jungle", "acacia", "dark_oak"],
  variants: {
    log: true,
    planks: true,
    slab: true,
    stairs: true,
    fence: true,
    door: true,
    trapdoor: true,
    button: true,
    pressure_plate: true,
    sign: true,
    boat: true
  }
};

// Planks substitution (for crafting recipes)
export const PLANKS_SUBSTITUTION = {
  acceptable: [
    "oak_planks",
    "birch_planks",
    "spruce_planks",
    "jungle_planks",
    "acacia_planks",
    "dark_oak_planks",
    "mangrove_planks",
    "cherry_planks",
    "crimson_planks",
    "warped_planks"
  ],
  preferenceOrder: [
    "oak_planks",
    "birch_planks",
    "spruce_planks",
    "jungle_planks"
  ],
  note: "Use any wood planks for generic recipes requiring 'planks'"
};

// Stone type alternatives
export const STONE_ALTERNATIVES = {
  types: [
    "cobblestone",
    "stone",
    "granite",
    "diorite",
    "andesite",
    "deepslate",
    "blackstone"
  ],
  toolCrafting: ["cobblestone", "blackstone"],
  note: "Only specific stone types work for tool crafting"
};

// Dye alternatives by color
export const DYE_ALTERNATIVES = {
  white: ["bone_meal", "lily_of_the_valley"],
  black: ["ink_sac", "wither_rose"],
  red: ["rose_red", "poppy", "red_tulip", "beetroot"],
  yellow: ["dandelion_yellow", "dandelion", "sunflower"],
  blue: ["lapis_lazuli", "cornflower"],
  green: ["cactus_green", "cactus"],
  brown: ["cocoa_beans"],
  orange: ["orange_tulip"],
  pink: ["pink_tulip", "peony"],
  purple: ["purple"],
  cyan: ["cyan"],
  light_blue: ["blue_orchid"],
  lime: ["lime"],
  magenta: ["magenta"],
  gray: ["gray"],
  light_gray: ["light_gray", "azure_bluet", "oxeye_daisy", "white_tulip"]
};

/**
 * Find best fuel alternative from inventory
 * @param {Object} inventory - Current inventory
 * @param {number} itemsToSmelt - Number of items to smelt
 * @returns {Object} Best fuel option and alternatives
 */
export function findBestFuel(inventory = {}, itemsToSmelt = 1) {
  if (!Number.isFinite(itemsToSmelt) || itemsToSmelt <= 0) {
    itemsToSmelt = 1;
  }

  const availableFuels = [];

  // Check what fuels are available
  for (const [fuelName, fuelData] of Object.entries(FUEL_ALTERNATIVES)) {
    const available = countInventoryItems(inventory, fuelName);

    if (available > 0) {
      const fuelNeeded = Math.ceil(itemsToSmelt / fuelData.itemsPerFuel);
      const canSmelt = available * fuelData.itemsPerFuel;

      availableFuels.push({
        fuel: fuelName,
        available: available,
        fuelNeeded: fuelNeeded,
        sufficient: available >= fuelNeeded,
        canSmelt: canSmelt,
        efficiency: fuelData.efficiency,
        burnTime: fuelData.burnTime,
        category: fuelData.category,
        renewable: fuelData.renewable || false,
        note: fuelData.note
      });
    }
  }

  if (availableFuels.length === 0) {
    return {
      error: "No fuel available in inventory",
      suggestion: "Gather coal from mining or craft charcoal from logs"
    };
  }

  // Sort by efficiency (prefer more efficient fuels)
  availableFuels.sort((a, b) => {
    // Prioritize sufficient fuel
    if (a.sufficient && !b.sufficient) return -1;
    if (!a.sufficient && b.sufficient) return 1;

    // Then by efficiency
    return b.efficiency - a.efficiency;
  });

  const bestFuel = availableFuels[0];
  const alternatives = availableFuels.slice(1, 4);

  return {
    itemsToSmelt: itemsToSmelt,
    bestFuel: bestFuel,
    alternatives: alternatives,
    totalOptions: availableFuels.length,
    recommendation: bestFuel.sufficient
      ? `Use ${bestFuel.fuelNeeded}x ${bestFuel.fuel} (efficiency: ${(bestFuel.efficiency * 100).toFixed(0)}%)`
      : `Insufficient fuel. Best available: ${bestFuel.fuel} (can smelt ${bestFuel.canSmelt} items)`,
    warning: bestFuel.efficiency < 0.5
      ? "Current fuel is inefficient. Consider using coal or charcoal instead."
      : null
  };
}

/**
 * Suggest substitute for a missing ingredient
 * @param {string} missingItem - The item that's missing
 * @param {Object} inventory - Current inventory
 * @returns {Object} Substitution suggestions
 */
export function suggestSubstitute(missingItem, inventory = {}) {
  if (!missingItem) {
    return { error: "Missing item required" };
  }

  const normalized = normalizeItemName(missingItem);
  const suggestions = [];

  // Check for wood substitutes
  if (normalized.includes("planks") || normalized === "planks") {
    for (const plankType of PLANKS_SUBSTITUTION.acceptable) {
      const available = countInventoryItems(inventory, plankType);
      if (available > 0) {
        suggestions.push({
          substitute: plankType,
          available: available,
          reason: "Any wood planks work for generic recipes"
        });
      }
    }
  }

  // Check for log substitutes
  if (normalized.includes("log") || normalized === "log") {
    for (const woodType of WOOD_ALTERNATIVES.types) {
      const logName = `${woodType}_log`;
      const available = countInventoryItems(inventory, logName);
      if (available > 0) {
        suggestions.push({
          substitute: logName,
          available: available,
          reason: "Any wood log works for generic recipes"
        });
      }
    }
  }

  // Check for fuel substitutes
  if (FUEL_ALTERNATIVES[normalized]) {
    const fuelAnalysis = findBestFuel(inventory, 8);
    if (fuelAnalysis.bestFuel) {
      suggestions.push({
        substitute: fuelAnalysis.bestFuel.fuel,
        available: fuelAnalysis.bestFuel.available,
        reason: `Alternative fuel (efficiency: ${(fuelAnalysis.bestFuel.efficiency * 100).toFixed(0)}%)`
      });
    }

    for (const alt of fuelAnalysis.alternatives || []) {
      suggestions.push({
        substitute: alt.fuel,
        available: alt.available,
        reason: `Alternative fuel (efficiency: ${(alt.efficiency * 100).toFixed(0)}%)`
      });
    }
  }

  // Check for coal/charcoal interchangeability
  if (normalized === "coal") {
    const charcoal = countInventoryItems(inventory, "charcoal");
    if (charcoal > 0) {
      suggestions.push({
        substitute: "charcoal",
        available: charcoal,
        reason: "Charcoal is functionally identical to coal"
      });
    }
  } else if (normalized === "charcoal") {
    const coal = countInventoryItems(inventory, "coal");
    if (coal > 0) {
      suggestions.push({
        substitute: "coal",
        available: coal,
        reason: "Coal is functionally identical to charcoal"
      });
    }
  }

  if (suggestions.length === 0) {
    return {
      missingItem: normalized,
      substitutes: [],
      message: `No substitutes found for ${normalized} in current inventory`,
      suggestion: `Gather or craft ${normalized} directly`
    };
  }

  return {
    missingItem: normalized,
    substitutes: suggestions,
    bestSubstitute: suggestions[0],
    totalOptions: suggestions.length,
    recommendation: `Use ${suggestions[0].substitute} instead (${suggestions[0].available} available)`
  };
}

/**
 * Get all acceptable substitutes for an item (not limited to inventory)
 * @param {string} item - The item to find substitutes for
 * @returns {Object} All possible substitutes
 */
export function getAllSubstitutes(item) {
  if (!item) {
    return { error: "Item required" };
  }

  const normalized = normalizeItemName(item);
  const substitutes = [];

  // Wood planks
  if (normalized.includes("planks") || normalized === "planks") {
    return {
      item: normalized,
      substitutes: PLANKS_SUBSTITUTION.acceptable,
      category: "wood_planks",
      note: PLANKS_SUBSTITUTION.note
    };
  }

  // Logs
  if (normalized.includes("log") || normalized === "log") {
    return {
      item: normalized,
      substitutes: WOOD_ALTERNATIVES.types.map(t => `${t}_log`),
      category: "wood_logs",
      note: WOOD_ALTERNATIVES.note
    };
  }

  // Fuel
  if (FUEL_ALTERNATIVES[normalized]) {
    const fuelAlternatives = Object.keys(FUEL_ALTERNATIVES).filter(f => f !== normalized);
    return {
      item: normalized,
      substitutes: fuelAlternatives,
      category: "fuel",
      note: "All fuels work for smelting, but efficiency varies",
      details: FUEL_ALTERNATIVES
    };
  }

  // Coal/Charcoal special case
  if (normalized === "coal" || normalized === "charcoal") {
    return {
      item: normalized,
      substitutes: normalized === "coal" ? ["charcoal"] : ["coal"],
      category: "fuel_equivalent",
      note: "Coal and charcoal are functionally identical"
    };
  }

  return {
    item: normalized,
    substitutes: [],
    message: `No known substitutes for ${normalized}`,
    note: "This item may require specific materials"
  };
}

/**
 * Compare two fuel types for efficiency
 * @param {string} fuel1 - First fuel type
 * @param {string} fuel2 - Second fuel type
 * @returns {Object} Comparison results
 */
export function compareFuels(fuel1, fuel2) {
  const f1Data = FUEL_ALTERNATIVES[normalizeItemName(fuel1)];
  const f2Data = FUEL_ALTERNATIVES[normalizeItemName(fuel2)];

  if (!f1Data || !f2Data) {
    return {
      error: "One or both fuels not recognized",
      validFuels: Object.keys(FUEL_ALTERNATIVES)
    };
  }

  const winner = f1Data.efficiency > f2Data.efficiency
    ? fuel1
    : f2Data.efficiency > f1Data.efficiency
    ? fuel2
    : "tie";

  return {
    fuel1: {
      name: fuel1,
      ...f1Data
    },
    fuel2: {
      name: fuel2,
      ...f2Data
    },
    comparison: {
      moreEfficient: winner,
      efficiencyDifference: Math.abs(f1Data.efficiency - f2Data.efficiency).toFixed(2),
      burnTimeDifference: Math.abs(f1Data.burnTime - f2Data.burnTime),
      itemsPerFuelDifference: Math.abs(f1Data.itemsPerFuel - f2Data.itemsPerFuel)
    },
    recommendation: winner === "tie"
      ? `${fuel1} and ${fuel2} are equally efficient`
      : `${winner} is more efficient (${winner === fuel1 ? f1Data.efficiency : f2Data.efficiency}x efficiency)`
  };
}

/**
 * Calculate fuel needed for a smelting job with alternatives
 * @param {number} itemsToSmelt - Number of items to smelt
 * @param {Object} inventory - Current inventory
 * @returns {Object} Fuel plan with alternatives
 */
export function calculateFuelWithAlternatives(itemsToSmelt, inventory = {}) {
  if (!Number.isFinite(itemsToSmelt) || itemsToSmelt <= 0) {
    return { error: "Valid item count required" };
  }

  const fuelAnalysis = findBestFuel(inventory, itemsToSmelt);

  if (fuelAnalysis.error) {
    return fuelAnalysis;
  }

  const mixedFuelPlan = [];
  let remainingItems = itemsToSmelt;

  // Try to use most efficient fuels first
  const allFuels = [fuelAnalysis.bestFuel, ...(fuelAnalysis.alternatives || [])];

  for (const fuel of allFuels) {
    if (remainingItems <= 0) break;

    const itemsThisFuelCanSmelt = Math.min(remainingItems, fuel.canSmelt);
    const fuelToUse = Math.ceil(itemsThisFuelCanSmelt / fuel.canSmelt * fuel.available);

    if (fuelToUse > 0) {
      mixedFuelPlan.push({
        fuel: fuel.fuel,
        amount: fuelToUse,
        willSmelt: itemsThisFuelCanSmelt
      });

      remainingItems -= itemsThisFuelCanSmelt;
    }
  }

  return {
    itemsToSmelt: itemsToSmelt,
    canSmeltAll: remainingItems <= 0,
    remainingAfterAllFuel: remainingItems,
    mixedFuelPlan: mixedFuelPlan,
    totalFuelTypes: mixedFuelPlan.length,
    recommendation: remainingItems <= 0
      ? `Use ${mixedFuelPlan.map(f => `${f.amount}x ${f.fuel}`).join(" + ")}`
      : `Insufficient fuel. Can only smelt ${itemsToSmelt - remainingItems} items`
  };
}
