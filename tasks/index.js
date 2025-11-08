// tasks/index.js
// Central registry and planning utilities for Minecraft NPC tasks

import { executePlanner, hasPlanner as coreHasPlanner, registerPlanner, listRegisteredPlanners } from "./planner_core.js";
import { applyPersonalityBias } from "./planner_ai.js";
import {
  planBuildTask,
  planMineTask,
  planExploreTask,
  planGatherTask,
  planGuardTask,
  planCraftTask,
  planInteractTask,
  planCombatTask,
  planEatTask,
  planSleepTask,
  planDoorTask,
  planClimbTask,
  planRedstoneTask,
  planThrowTask,
  planTradeTask,
  planMinecartTask,
  planItemFrameTask,
  planComposterTask,
  planScaffoldingTask,
  planRangedTask
} from "./planner_actions.js";

import {
  describeTarget,
  normalizeItemName,
  createPlan,
  createStep,
  resolveQuantity,
  extractInventory,
  hasInventoryItem,
  countInventoryItems,
  formatRequirementList
} from "./helpers.js";

export {
  describeTarget,
  normalizeItemName,
  createPlan,
  createStep,
  resolveQuantity,
  extractInventory,
  hasInventoryItem,
  countInventoryItems,
  formatRequirementList
} from "./helpers.js";

export function planTask(task, context = {}) {
  try {
    const plan = executePlanner(task, context);
    return applyPersonalityBias(plan, context);
  } catch (err) {
    console.error(`❌ Failed to plan task for action "${task?.action}":`, err.message);
    return null;
  }
}

export function hasPlanner(action) {
  return coreHasPlanner(action);
}

export { registerPlanner, listRegisteredPlanners };

// Export individual task planners
export {
  planBuildTask,
  planMineTask,
  planExploreTask,
  planGatherTask,
  planGuardTask,
  planCraftTask,
  planInteractTask,
  planCombatTask,
  planEatTask,
  planSleepTask,
  planDoorTask,
  planClimbTask,
  planRedstoneTask,
  planThrowTask,
  planTradeTask,
  planMinecartTask,
  planItemFrameTask,
  planComposterTask,
  planScaffoldingTask,
  planRangedTask
};
