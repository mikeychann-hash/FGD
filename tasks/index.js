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

import {
  describeTarget,
  normalizeItemName,
  createPlan,
  createStep,
  resolveQuantity,
  extractInventory,
  hasInventoryItem,
  countInventoryItems,
  formatRequirementList,
  createTaskGraph,
  createTaskNode,
  TaskGraph
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
  formatRequirementList,
  createTaskGraph,
  createTaskNode,
  TaskGraph
} from "./helpers.js";

class PlanRegistry {
  constructor() {
    this.planners = new Map();
  }

  register(action, planner) {
    if (!action || typeof planner !== "function") {
      return () => {};
    }
    const key = String(action).toLowerCase();
    this.planners.set(key, planner);
    return () => this.planners.delete(key);
  }

  alias(aliasAction, targetAction) {
    if (!aliasAction || !targetAction) {
      return false;
    }
    const targetPlanner = this.planners.get(String(targetAction).toLowerCase());
    if (!targetPlanner) {
      return false;
    }
    this.planners.set(String(aliasAction).toLowerCase(), targetPlanner);
    return true;
  }

  has(action) {
    if (!action) {
      return false;
    }
    return this.planners.has(String(action).toLowerCase());
  }

  invoke(action, task = {}, context = {}) {
    if (!action) {
      return null;
    }
    const key = String(action).toLowerCase();
    const planner = this.planners.get(key);
    if (!planner) {
      return null;
    }
    const normalizedTask = {
      ...(task && typeof task === "object" ? task : {}),
      action: key
    };
    const enrichedContext = {
      ...context,
      planRegistry: this
    };
    try {
      return planner(normalizedTask, enrichedContext) || null;
    } catch (err) {
      console.error(`❌ Failed to plan task for action "${key}":`, err.message);
      return null;
    }
  }

  list() {
    return [...this.planners.keys()];
  }
}

export const planRegistry = new PlanRegistry();

planRegistry.register("build", planBuildTask);
planRegistry.register("mine", planMineTask);
planRegistry.register("explore", planExploreTask);
planRegistry.register("gather", planGatherTask);
planRegistry.register("guard", planGuardTask);
planRegistry.register("craft", planCraftTask);
planRegistry.register("interact", planInteractTask);
planRegistry.register("combat", planCombatTask);

export function planTask(task, context = {}) {
  if (!task || typeof task !== "object") {
    return null;
  }
  return planRegistry.invoke(task.action, task, context);
}

export function hasPlanner(action) {
  return planRegistry.has(action);
}
