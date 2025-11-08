import { registerPlanner } from "./planner_core.js";
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
import { planRedstoneTask } from "./plan_redstone.js";
import { planThrowTask } from "./plan_throw.js";
import { planTradeTask } from "./plan_trade.js";
import { planMinecartTask } from "./plan_minecart.js";
import { planItemFrameTask } from "./plan_display.js";
import { planComposterTask } from "./plan_composter.js";
import { planScaffoldingTask } from "./plan_scaffolding.js";
import { planRangedTask } from "./plan_ranged.js";

const plannerDefinitions = [
  { action: "build", handler: planBuildTask },
  { action: "mine", handler: planMineTask },
  { action: "explore", handler: planExploreTask },
  { action: "gather", handler: planGatherTask },
  { action: "guard", handler: planGuardTask },
  { action: "craft", handler: planCraftTask },
  { action: "interact", handler: planInteractTask },
  { action: "combat", handler: planCombatTask },
  { action: "eat", handler: planEatTask },
  { action: "sleep", handler: planSleepTask },
  { action: "door", handler: planDoorTask },
  { action: "climb", handler: planClimbTask },
  { action: "redstone", handler: planRedstoneTask },
  { action: "throw", handler: planThrowTask },
  { action: "trade", handler: planTradeTask },
  { action: "minecart", handler: planMinecartTask },
  { action: "display", handler: planItemFrameTask },
  { action: "composter", handler: planComposterTask },
  { action: "scaffolding", handler: planScaffoldingTask },
  { action: "ranged", handler: planRangedTask }
];

export function initializeDefaultPlanners() {
  plannerDefinitions.forEach(definition => {
    registerPlanner(definition.action, definition.handler, {
      modulePath: new URL(`./plan_${definition.action}.js`, import.meta.url).href,
      exportName: definition.handler.name,
      parallel: ["build", "explore", "gather", "mine", "ranged"].includes(definition.action)
    });
  });
}

initializeDefaultPlanners();

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
