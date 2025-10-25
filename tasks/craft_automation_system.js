// tasks/craft_automation_system.js
// Automation and redstone integration for crafting

import { normalizeItemName } from "./helpers.js";

// Autocrafter configuration
export const AUTOCRAFTER_SYSTEM = {
  setup: {
    steps: [
      "Place crafter facing output chest or hopper",
      "Configure redstone signal (1-tick pulse per craft operation)",
      "Load recipe from player inventory (shift-click to insert)",
      "Connect input hoppers from ingredient storage",
      "Add redstone clock for continuous operation"
    ],
    requirements: {
      crafter: 1,
      redstone: 10,
      repeaters: 2,
      hoppers: 3,
      chests: 2
    }
  },
  throughput: {
    items_per_minute: 40,
    items_per_hour: 2400,
    efficiency: "100% when properly supplied"
  },
  limitations: [
    "Only crafts one recipe at a time",
    "Requires continuous ingredient supply",
    "Cannot handle multi-step recipes automatically",
    "Redstone signal must be precisely timed"
  ],
  tips: [
    "Use hopper filters to prevent wrong ingredients",
    "Add buffer chests to prevent input starvation",
    "Connect multiple autocrafters for different recipes",
    "Use comparators to detect output chest fullness"
  ]
};

// Smelting array configuration
export const SMELTING_ARRAY = {
  parallel: true,
  configurations: {
    small: {
      furnaces: 4,
      throughput_per_minute: 48,
      footprint: "2x2 blocks",
      fuel_efficiency: "Use coal blocks for long runs"
    },
    medium: {
      furnaces: 8,
      throughput_per_minute: 96,
      footprint: "2x4 blocks",
      fuel_efficiency: "Lava buckets recommended"
    },
    large: {
      furnaces: 16,
      throughput_per_minute: 192,
      footprint: "4x4 blocks",
      fuel_efficiency: "Lava buckets or coal blocks"
    },
    mega: {
      furnaces: 32,
      throughput_per_minute: 384,
      footprint: "4x8 blocks",
      fuel_efficiency: "Bulk lava bucket system"
    }
  },
  automation: {
    input: "Hoppers from input chest to furnace tops",
    output: "Hoppers from furnace bottoms to collection chest",
    fuel: "Hopper from fuel chest to furnace sides",
    sorting: "Use hopper minecarts for advanced sorting"
  },
  tips: [
    "Place furnaces in rows for easy hopper connections",
    "Use chest minecarts for bulk input/output",
    "Add item filters to prevent wrong items entering",
    "Monitor fuel levels with comparator circuits"
  ]
};

// Storage system configuration
export const STORAGE_SYSTEM = {
  input_buffer: {
    type: "Double chest with hoppers",
    capacity: 54 * 64, // 3456 items
    purpose: "Holds items before processing",
    automation: "Hoppers feed into machines"
  },
  output_sorting: {
    type: "Hopper filter array",
    methods: [
      "Item-specific hoppers with 18+ items blocking overflow",
      "Hopper minecart unloading stations",
      "Comparator-based sorting",
      "Water stream item separation"
    ],
    capacity: "Unlimited with expansion",
    purpose: "Automatically sort items by type"
  },
  overflow: {
    type: "Overflow chest with alert",
    purpose: "Catch excess items",
    alert: "Comparator signal when chest is filling",
    recommendation: "Connect to indicator lamp"
  },
  bulk_storage: {
    type: "Barrel wall or chest array",
    capacity: "27 * 64 per barrel",
    organization: "Label by item type",
    automation: "Hopper loading system"
  }
};

/**
 * Calculate autocrafter throughput
 * @param {string} item - Item being crafted
 * @param {number} craftTime - Seconds per craft (default: 1.5)
 * @returns {Object} Throughput statistics
 */
export function calculateAutocrafterThroughput(item, craftTime = 1.5) {
  if (!Number.isFinite(craftTime) || craftTime <= 0) {
    craftTime = 1.5;
  }

  const craftsPerMinute = Math.floor(60 / craftTime);
  const craftsPerHour = craftsPerMinute * 60;

  return {
    item: item,
    craftTimeSeconds: craftTime,
    throughput: {
      perMinute: craftsPerMinute,
      perHour: craftsPerHour,
      perDay: craftsPerHour * 24
    },
    recommendation: craftsPerMinute < 20
      ? "Optimize redstone clock for faster crafting"
      : craftsPerMinute < 40
      ? "Good throughput, consider adding second autocrafter for redundancy"
      : "Maximum efficiency achieved"
  };
}

/**
 * Design smelting array for specific throughput needs
 * @param {number} itemsPerHour - Desired items processed per hour
 * @returns {Object} Array design recommendation
 */
export function designSmeltingArray(itemsPerHour) {
  if (!Number.isFinite(itemsPerHour) || itemsPerHour <= 0) {
    return { error: "Valid throughput target required" };
  }

  // Each furnace smelts 1 item per 10 seconds = 6 items/minute = 360 items/hour
  const itemsPerFurnacePerHour = 360;
  const furnacesNeeded = Math.ceil(itemsPerHour / itemsPerFurnacePerHour);

  // Find best configuration
  let config = "small";
  if (furnacesNeeded >= 32) config = "mega";
  else if (furnacesNeeded >= 16) config = "large";
  else if (furnacesNeeded >= 8) config = "medium";

  const arrayConfig = SMELTING_ARRAY.configurations[config];
  const actualThroughput = arrayConfig.throughput_per_minute * 60;

  // Calculate fuel needs
  const fuelPerFurnacePerHour = Math.ceil(itemsPerFurnacePerHour / 8); // 8 items per coal
  const totalFuelPerHour = fuelPerFurnacePerHour * arrayConfig.furnaces;

  return {
    targetThroughput: itemsPerHour,
    recommendedConfig: config,
    furnacesNeeded: furnacesNeeded,
    actualFurnaces: arrayConfig.furnaces,
    actualThroughput: actualThroughput,
    overcapacity: actualThroughput - itemsPerHour,
    footprint: arrayConfig.footprint,
    fuelRequirements: {
      coalPerHour: totalFuelPerHour,
      coalBlocksPerHour: Math.ceil(totalFuelPerHour / 9),
      lavaBucketsPerHour: Math.ceil(totalFuelPerHour / 12.5),
      recommendation: arrayConfig.fuel_efficiency
    },
    materials: {
      furnaces: arrayConfig.furnaces,
      hoppers: arrayConfig.furnaces * 2 + 4, // Input + output + extras
      chests: 4 // Input, output, fuel, overflow
    },
    efficiency: `${((itemsPerHour / actualThroughput) * 100).toFixed(1)}% utilization`,
    recommendation: `Build a ${config} smelting array with ${arrayConfig.furnaces} furnaces`
  };
}

/**
 * Generate storage system layout
 * @param {number} uniqueItemTypes - Number of different item types to store
 * @param {number} averageStacksPerItem - Average stacks per item type
 * @returns {Object} Storage system design
 */
export function designStorageSystem(uniqueItemTypes, averageStacksPerItem = 5) {
  if (!Number.isFinite(uniqueItemTypes) || uniqueItemTypes <= 0) {
    return { error: "Number of item types required" };
  }

  if (!Number.isFinite(averageStacksPerItem) || averageStacksPerItem <= 0) {
    averageStacksPerItem = 5;
  }

  const slotsPerChest = 27;
  const slotsPerDoubleChest = 54;

  // Calculate storage needed
  const totalSlots = uniqueItemTypes * averageStacksPerItem;
  const chestsNeeded = Math.ceil(totalSlots / slotsPerChest);
  const doubleChestsNeeded = Math.ceil(totalSlots / slotsPerDoubleChest);

  // Determine organization method
  let organizationMethod = "category";
  if (uniqueItemTypes <= 27) {
    organizationMethod = "single_chest_per_type";
  } else if (uniqueItemTypes <= 54) {
    organizationMethod = "double_chest_per_category";
  } else {
    organizationMethod = "storage_room_with_categories";
  }

  return {
    requirements: {
      uniqueItems: uniqueItemTypes,
      averageStacksPerItem: averageStacksPerItem,
      totalSlots: totalSlots
    },
    storage: {
      singleChests: chestsNeeded,
      doubleChests: doubleChestsNeeded,
      barrels: chestsNeeded, // Alternative to chests
      shulkerBoxes: Math.ceil(chestsNeeded / 27) // For mobile storage
    },
    organization: {
      method: organizationMethod,
      categories: [
        "Building blocks",
        "Tools & weapons",
        "Armor",
        "Food & farming",
        "Redstone & rails",
        "Ores & minerals",
        "Mob drops",
        "Misc items"
      ]
    },
    automation: {
      sortingHoppers: uniqueItemTypes <= 20 ? uniqueItemTypes : "Not recommended (too many types)",
      inputHoppers: 2,
      overflowChest: 1
    },
    footprint: `${Math.ceil(Math.sqrt(chestsNeeded))}x${Math.ceil(chestsNeeded / Math.ceil(Math.sqrt(chestsNeeded)))} blocks`,
    recommendation: organizationMethod === "single_chest_per_type"
      ? "Use one chest per item type for easy access"
      : organizationMethod === "double_chest_per_category"
      ? "Group items by category in double chests"
      : "Build dedicated storage room with labeled sections"
  };
}

/**
 * Optimize hopper system to reduce lag
 * @param {number} currentHoppers - Number of hoppers in use
 * @returns {Object} Optimization suggestions
 */
export function optimizeHopperSystem(currentHoppers) {
  if (!Number.isFinite(currentHoppers) || currentHoppers < 0) {
    currentHoppers = 0;
  }

  const lagThreshold = 50; // Hoppers start causing noticeable lag
  const severeThreshold = 100;

  const suggestions = [];

  if (currentHoppers > severeThreshold) {
    suggestions.push({
      priority: "critical",
      suggestion: "Use hopper minecarts instead of hoppers where possible",
      reason: "Hopper minecarts are significantly less laggy",
      savings: "~50% lag reduction"
    });
  }

  if (currentHoppers > lagThreshold) {
    suggestions.push({
      priority: "high",
      suggestion: "Add hopper filters to reduce item checking",
      reason: "Filters prevent hoppers from constantly checking for items",
      savings: "~30% lag reduction"
    });

    suggestions.push({
      priority: "high",
      suggestion: "Use water streams for bulk item transport",
      reason: "Water streams have zero lag compared to hoppers",
      savings: "Significant for long distances"
    });
  }

  suggestions.push({
    priority: "medium",
    suggestion: "Disable hoppers when not in use with redstone",
    reason: "Inactive hoppers don't process items",
    savings: "100% when disabled"
  });

  suggestions.push({
    priority: "low",
    suggestion: "Consolidate hopper lines to reduce total count",
    reason: "Fewer hoppers = less TPS impact",
    savings: "Variable"
  });

  return {
    currentHoppers: currentHoppers,
    lagStatus: currentHoppers > severeThreshold
      ? "severe"
      : currentHoppers > lagThreshold
      ? "noticeable"
      : "minimal",
    recommendations: suggestions,
    alternativeSolutions: [
      "Use droppers with redstone clocks for timed item movement",
      "Employ hopper minecarts on rails for long-distance transport",
      "Build water stream + hopper collection points",
      "Use storage minecarts with hoppers for buffer storage"
    ]
  };
}

/**
 * Calculate redstone clock timing for autocrafter
 * @param {number} desiredCraftsPerMinute - Target crafting speed
 * @returns {Object} Redstone clock configuration
 */
export function calculateRedstoneClock(desiredCraftsPerMinute) {
  if (!Number.isFinite(desiredCraftsPerMinute) || desiredCraftsPerMinute <= 0) {
    desiredCraftsPerMinute = 20;
  }

  // Max ~40 crafts/minute for autocrafters
  const actualCraftsPerMinute = Math.min(desiredCraftsPerMinute, 40);
  const ticksPerCraft = Math.floor((60 * 20) / actualCraftsPerMinute); // 20 ticks per second
  const secondsPerCraft = ticksPerCraft / 20;

  // Determine repeater configuration
  const repeatersNeeded = Math.max(2, Math.ceil(ticksPerCraft / 4));

  return {
    desiredSpeed: desiredCraftsPerMinute,
    actualSpeed: actualCraftsPerMinute,
    timing: {
      ticksPerCraft: ticksPerCraft,
      secondsPerCraft: secondsPerCraft.toFixed(2)
    },
    redstone: {
      repeatersNeeded: repeatersNeeded,
      ticksPerRepeater: Math.floor(ticksPerCraft / repeatersNeeded),
      clockType: ticksPerCraft <= 8 ? "fast_clock" : ticksPerCraft <= 40 ? "medium_clock" : "slow_clock"
    },
    setup: [
      `Use ${repeatersNeeded} repeaters in a loop`,
      `Set each repeater to ${Math.floor(ticksPerCraft / repeatersNeeded)} ticks`,
      `Connect clock output to crafter`,
      `Test with items to verify timing`
    ],
    recommendation: actualCraftsPerMinute < desiredCraftsPerMinute
      ? `Maximum speed is 40 crafts/minute. Adjusted to ${actualCraftsPerMinute}/min`
      : `Clock will produce ${actualCraftsPerMinute} crafts per minute`
  };
}
