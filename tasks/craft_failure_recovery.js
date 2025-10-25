// tasks/craft_failure_recovery.js
// Error handling and failure recovery for crafting

import { normalizeItemName } from "./helpers.js";

// Error types and recovery strategies
export const FAILURE_TYPES = {
  wrong_recipe: {
    severity: "medium",
    recovery: "undo_last_craft",
    description: "Crafted wrong item or used wrong recipe",
    canReverse: true
  },
  insufficient_materials: {
    severity: "low",
    recovery: "pause_and_gather",
    description: "Ran out of ingredients mid-craft",
    canReverse: false
  },
  station_destroyed: {
    severity: "high",
    recovery: "find_alternate_station",
    description: "Crafting station was destroyed or became inaccessible",
    canReverse: false
  },
  inventory_full: {
    severity: "medium",
    recovery: "store_items",
    description: "Inventory full, cannot collect crafted items",
    canReverse: false
  },
  wrong_tool: {
    severity: "low",
    recovery: "switch_tool",
    description: "Using wrong tool for task",
    canReverse: false
  },
  automation_failure: {
    severity: "high",
    recovery: "reset_automation",
    description: "Automated system jammed or misconfigured",
    canReverse: true
  }
};

/**
 * Handle crafting error and suggest recovery
 * @param {string} errorType - Type of error
 * @param {Object} context - Error context information
 * @returns {Object} Recovery plan
 */
export function handleCraftingError(errorType, context = {}) {
  const error = FAILURE_TYPES[errorType];

  if (!error) {
    return {
      error: `Unknown error type: ${errorType}`,
      availableTypes: Object.keys(FAILURE_TYPES)
    };
  }

  const recoverySteps = [];

  switch (errorType) {
    case "wrong_recipe":
      recoverySteps.push("Stop crafting immediately");
      if (error.canReverse && context.craftedItem) {
        recoverySteps.push(`Place ${context.craftedItem} in chest for later use or recycling`);
        recoverySteps.push("Check recipe book for correct recipe");
        recoverySteps.push("Restart craft with correct ingredients");
      }
      break;

    case "insufficient_materials":
      recoverySteps.push("Pause current crafting operation");
      recoverySteps.push(`Gather missing: ${context.missing ? context.missing.join(", ") : "materials"}`);
      recoverySteps.push("Return to station and resume");
      break;

    case "station_destroyed":
      recoverySteps.push("Assess station damage");
      if (context.nearbyStations && context.nearbyStations.length > 0) {
        recoverySteps.push(`Use nearby ${context.nearbyStations[0]} instead`);
      } else {
        recoverySteps.push("Build replacement station");
        recoverySteps.push("Transfer materials to new station");
      }
      break;

    case "inventory_full":
      recoverySteps.push("Stop collecting items");
      recoverySteps.push("Move items to nearby chest");
      recoverySteps.push("Clear at least 9 inventory slots");
      recoverySteps.push("Return to collect crafted items");
      break;

    case "automation_failure":
      recoverySteps.push("Disable automation (remove redstone signal)");
      recoverySteps.push("Clear jammed items from hoppers");
      recoverySteps.push("Verify hopper connections");
      recoverySteps.push("Re-enable automation and test");
      break;

    default:
      recoverySteps.push("Assess situation");
      recoverySteps.push("Consult error handling guide");
  }

  return {
    errorType: errorType,
    severity: error.severity,
    description: error.description,
    canReverse: error.canReverse,
    recoveryStrategy: error.recovery,
    steps: recoverySteps,
    estimatedRecoveryTime: estimateRecoveryTime(errorType),
    preventionTips: getPreventionTips(errorType)
  };
}

/**
 * Estimate time to recover from error
 * @param {string} errorType - Type of error
 * @returns {string} Time estimate
 */
function estimateRecoveryTime(errorType) {
  const times = {
    wrong_recipe: "30s",
    insufficient_materials: "2-5 minutes",
    station_destroyed: "1-3 minutes",
    inventory_full: "1 minute",
    wrong_tool: "10s",
    automation_failure: "2-10 minutes"
  };

  return times[errorType] || "unknown";
}

/**
 * Get prevention tips for error type
 * @param {string} errorType - Type of error
 * @returns {Array} Prevention tips
 */
function getPreventionTips(errorType) {
  const tips = {
    wrong_recipe: [
      "Double-check recipe before starting",
      "Use recipe book for reference",
      "Enable recipe validation in settings"
    ],
    insufficient_materials: [
      "Count ingredients before starting",
      "Keep extra materials in reserve",
      "Use inventory checker tool"
    ],
    station_destroyed: [
      "Build backup stations",
      "Protect stations with walls/roof",
      "Keep station materials in storage"
    ],
    inventory_full: [
      "Clear inventory before bulk crafting",
      "Have storage chest nearby",
      "Use shulker boxes for mobile storage"
    ],
    automation_failure: [
      "Test automation with small batches first",
      "Add overflow protection",
      "Use item filters to prevent jams",
      "Regularly inspect hopper connections"
    ]
  };

  return tips[errorType] || [];
}

/**
 * Enable rollback for failed craft
 * @param {Object} craftState - State before craft
 * @returns {Object} Rollback plan
 */
export function rollbackFailedCraft(craftState) {
  if (!craftState || !craftState.ingredients) {
    return {
      error: "Cannot rollback: no craft state saved",
      recommendation: "Enable state saving before crafting"
    };
  }

  return {
    enabled: true,
    previousState: craftState,
    rollbackSteps: [
      "Retrieve crafted items from output",
      "Destroy or store unwanted items",
      "Return ingredients to inventory (if possible)",
      "Reset station to ready state"
    ],
    itemsToReturn: craftState.ingredients,
    recommendation: "Rollback will attempt to restore pre-craft state"
  };
}

/**
 * Create checkpoint before risky operation
 * @param {Object} currentState - Current game state
 * @returns {Object} Checkpoint
 */
export function createCheckpoint(currentState = {}) {
  return {
    timestamp: Date.now(),
    inventory: currentState.inventory || {},
    position: currentState.position || null,
    health: currentState.health || null,
    message: "Checkpoint created - you can restore to this state if needed"
  };
}

/**
 * Detect common crafting mistakes before they happen
 * @param {Object} plannedCraft - Planned crafting operation
 * @param {Object} inventory - Current inventory
 * @returns {Object} Risk assessment
 */
export function detectCraftingRisks(plannedCraft, inventory = {}) {
  const risks = [];

  // Check for wrong recipe
  if (plannedCraft.recipe && plannedCraft.providedIngredients) {
    const mismatch = plannedCraft.recipe.ingredients.some(required =>
      !plannedCraft.providedIngredients.find(provided => provided.name === required.name)
    );

    if (mismatch) {
      risks.push({
        type: "wrong_recipe",
        severity: "high",
        message: "Ingredients don't match recipe - verify before crafting"
      });
    }
  }

  // Check inventory space
  const emptySlots = 36 - Object.keys(inventory).length;
  if (emptySlots < 5) {
    risks.push({
      type: "inventory_full",
      severity: "medium",
      message: `Only ${emptySlots} inventory slots free - clear space before bulk crafting`
    });
  }

  // Check for expensive materials
  const expensiveItems = ["diamond", "netherite", "ancient_debris", "elytra"];
  const usesExpensive = plannedCraft.ingredients?.some(ing =>
    expensiveItems.some(exp => ing.name?.includes(exp))
  );

  if (usesExpensive) {
    risks.push({
      type: "expensive_materials",
      severity: "medium",
      message: "Using rare/expensive materials - double-check recipe"
    });
  }

  return {
    hasRisks: risks.length > 0,
    risks: risks,
    recommendation: risks.length > 0
      ? "Review risks before proceeding with craft"
      : "No significant risks detected"
  };
}
