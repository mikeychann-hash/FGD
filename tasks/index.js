// tasks/index.js
// Central registry and planning utilities for Minecraft NPC tasks

import { planBuildTask } from "./plan_build.js";
import { planMineTask } from "./plan_mine.js";
import { planExploreTask } from "./plan_explore.js";
import { planGatherTask } from "./plan_gather.js";
import { planGuardTask } from "./plan_guard.js";
import { planCraftTask } from "./plan_craft.js";
import { planInteractTask } from "./plan_interact.js";
import { planCombatTask } from "./plan_combat.js";
import { planEatTask } from "./plan_eat.js";
import { planSleepTask } from "./plan_sleep.js";
import { planDoorTask } from "./plan_door.js";
import { planClimbTask } from "./plan_climb.js";

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

const TASK_PLANNERS = {
  build: planBuildTask,
  mine: planMineTask,
  explore: planExploreTask,
  gather: planGatherTask,
  guard: planGuardTask,
  craft: planCraftTask,
  interact: planInteractTask,
  combat: planCombatTask,
  eat: planEatTask,
  sleep: planSleepTask,
  door: planDoorTask,
  climb: planClimbTask
};

export function planTask(task, context = {}) {
  if (!task || typeof task !== "object") {
    return null;
  }
  const planner = TASK_PLANNERS[task.action];
  if (!planner) {
    return null;
  }
  try {
    return planner(task, context) || null;
  } catch (err) {
    console.error(`❌ Failed to plan task for action "${task.action}":`, err.message);
    return null;
  }
}

export function hasPlanner(action) {
  return Boolean(TASK_PLANNERS[action]);
}

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
  planClimbTask
};
