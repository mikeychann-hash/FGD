// tasks/plan_mine.js
// Generates a sequence for mining style tasks with hierarchical sub-planning

import {
  createPlan,
  createStep,
  describeTarget,
  normalizeItemName,
  extractInventory,
  hasInventoryItem,
  countInventoryItems,
  formatRequirementList,
  resolveQuantity,
  createTaskGraph,
  createTaskNode
} from "./helpers.js";

const DEFAULT_SUPPORT_SUPPLIES = [
  { name: "torch", count: 32 },
  { name: "wood", count: 16 },
  { name: "food", count: 8 }
];

function determineSupportSupplies(task) {
  const extras = Array.isArray(task?.metadata?.supplies) ? task.metadata.supplies : [];
  const normalizedExtras = extras
    .map(item => {
      if (typeof item === "string") {
        return { name: normalizeItemName(item) };
      }
      if (item && typeof item === "object") {
        return {
          name: normalizeItemName(item.name || item.item),
          count: resolveQuantity(item.count ?? item.quantity, null)
        };
      }
      return null;
    })
    .filter(Boolean);

  return [...DEFAULT_SUPPORT_SUPPLIES, ...normalizedExtras];
}

function invokePlanner(registry, action, task, context) {
  if (!registry?.invoke) {
    return null;
  }
  return registry.invoke(action, task, context) || null;
}

export function planMineTask(task, context = {}) {
  const targetDescription = describeTarget(task.target);
  const resource = normalizeItemName(task?.metadata?.resource || task?.metadata?.ore || task.details);
  const tool = normalizeItemName(task?.metadata?.tool || "pickaxe");
  const backupTool = normalizeItemName(task?.metadata?.backupTool || task?.metadata?.secondaryTool || "");
  const dropOff = task?.metadata?.dropOff ? normalizeItemName(task.metadata.dropOff) : null;
  const quantity = resolveQuantity(task?.metadata?.quantity ?? task?.metadata?.count, null);
  const depth = resolveQuantity(task?.metadata?.depth ?? task?.metadata?.yLevel, null);
  const hazards = Array.isArray(task?.metadata?.hazards) ? task.metadata.hazards.map(normalizeItemName) : [];
  const miningMethod = normalizeItemName(task?.metadata?.method || "branch");
  const reinforcements = Array.isArray(task?.metadata?.reinforcements)
    ? task.metadata.reinforcements
        .map(item => {
          if (typeof item === "string") {
            return { name: normalizeItemName(item) };
          }
          if (item && typeof item === "object") {
            return {
              name: normalizeItemName(item.name || item.item),
              count: resolveQuantity(item.count ?? item.quantity, null)
            };
          }
          return null;
        })
        .filter(Boolean)
    : [];
  const anchorPoint = task?.metadata?.anchorPoint || task?.metadata?.respawnAnchor;
  const escort = task?.metadata?.escort;

  const inventory = extractInventory(context);
  const supportSupplies = determineSupportSupplies(task);
  const missingSupport = supportSupplies.filter(item => {
    if (!item?.name) {
      return false;
    }
    if (item.count) {
      return !hasInventoryItem(inventory, item.name, item.count);
    }
    return !hasInventoryItem(inventory, item.name, 1);
  });

  const hasPrimaryTool = hasInventoryItem(inventory, tool);
  const hasBackupTool = backupTool ? hasInventoryItem(inventory, backupTool) : true;
  const toolStepDescription = hasPrimaryTool
    ? `Inspect ${tool} durability and equip it before entering the mine.`
    : `Retrieve or craft a suitable ${tool} before entering the mine.`;

  const steps = [];
  const taskGraph = createTaskGraph();
  const registry = context.planRegistry;

  const rootNodeId = taskGraph.addNode(
    createTaskNode({
      action: "mine",
      summary: quantity ? `Mine ${quantity} ${resource}` : `Mine ${resource}`,
      metadata: {
        target: task.target || null,
        resource,
        quantity,
        dropOff,
        method: miningMethod
      }
    })
  );
  taskGraph.setRoot(rootNodeId);

  const subTasks = [];

  const missingSupportSummary = formatRequirementList(missingSupport);
  const supportSummary = formatRequirementList(supportSupplies) || "support supplies";

  steps.push(
    createStep({
      title: "Stock supplies",
      type: "inventory",
      description:
        missingSupport.length > 0
          ? missingSupportSummary
            ? `Restock essential supplies (${missingSupportSummary}).`
            : "Restock essential supplies before descending."
          : `Confirm support supplies are packed: ${supportSummary}.`,
      metadata: { supplies: supportSupplies, missing: missingSupport }
    })
  );

  if (missingSupport.length > 0) {
    const gatherTask = {
      action: "gather",
      details: `Collect ${missingSupportSummary}`,
      priority: "high",
      metadata: {
        resources: missingSupport,
        destination: task.metadata?.stagingArea || null
      }
    };
    const gatherPlan = invokePlanner(registry, "gather", gatherTask, context);
    const gatherNodeId = taskGraph.addNode(
      createTaskNode({
        action: "gather",
        summary: `Gather ${missingSupportSummary}`,
        metadata: {
          supplies: missingSupport,
          staging: task.metadata?.stagingArea || null
        }
      })
    );
    taskGraph.addDependency(gatherNodeId, rootNodeId);
    subTasks.push({
      id: gatherNodeId,
      action: "gather",
      task: gatherTask,
      plan: gatherPlan
    });
  }

  if (reinforcements.length > 0) {
    const reinforcementSummary = formatRequirementList(reinforcements) || "reinforcement blocks";
    steps.push(
      createStep({
        title: "Stage reinforcements",
        type: "preparation",
        description: `Pack building blocks for shoring: ${reinforcementSummary}.`,
        metadata: { reinforcements }
      })
    );
  }

  steps.push(
    createStep({
      title: "Gear check",
      type: "preparation",
      description: toolStepDescription,
      metadata: {
        tool,
        backupTool: backupTool || undefined
      }
    })
  );

  if (!hasPrimaryTool) {
    const craftTask = {
      action: "craft",
      details: `Craft a ${tool}`,
      priority: "high",
      metadata: {
        item: tool,
        quantity: 1,
        workstation: task.metadata?.workstation || null
      }
    };
    const craftPlan = invokePlanner(registry, "craft", craftTask, context);
    const craftNodeId = taskGraph.addNode(
      createTaskNode({
        action: "craft",
        summary: `Craft ${tool}`,
        metadata: {
          item: tool,
          workstation: task.metadata?.workstation || null
        }
      })
    );
    taskGraph.addDependency(craftNodeId, rootNodeId);
    subTasks.push({
      id: craftNodeId,
      action: "craft",
      task: craftTask,
      plan: craftPlan
    });
  }

  steps.push(
    createStep({
      title: "Navigate",
      type: "movement",
      description: `Travel to ${targetDescription} using safe pathing, lighting dark areas en route.`
    })
  );

  if (anchorPoint || hasInventoryItem(inventory, "bed")) {
    steps.push(
      createStep({
        title: "Secure exit",
        type: "safety",
        description: anchorPoint
          ? `Set spawn or anchor at ${anchorPoint} and mark a clear return path.`
          : "Place a temporary bed near the mine entrance and mark the route back.",
        metadata: { anchor: anchorPoint || (hasInventoryItem(inventory, "bed") ? "bed" : undefined) }
      })
    );
  }

  if (escort) {
    steps.push(
      createStep({
        title: "Coordinate escort",
        type: "coordination",
        description: `Meet with ${escort} before descent and assign overwatch positions.`,
        metadata: { escort }
      })
    );
  }

  if (depth && depth < 20) {
    steps.push(
      createStep({
        title: "Stabilize shaft",
        type: "safety",
        description: `Install support beams and ladder access while descending to Y${depth}.`
      })
    );
  }

  if (hazards.includes("lava") || hazards.includes("lava pool")) {
    steps.push(
      createStep({
        title: "Mitigate lava",
        type: "safety",
        description: "Carry a water bucket or fire resistance potion and block off exposed lava before mining."
      })
    );
  }

  const miningDescription = quantity
    ? `Mine approximately ${quantity} blocks of ${resource} using ${miningMethod} tunnels.`
    : `Mine the ${resource} using ${miningMethod} tunnels, reinforcing ceilings and sealing hazards.`;

  steps.push(
    createStep({
      title: "Mine",
      type: "action",
      description: miningDescription,
      metadata: { method: miningMethod, quantity }
    })
  );

  if (reinforcements.length > 0) {
    steps.push(
      createStep({
        title: "Shore tunnels",
        type: "safety",
        description: "Place reinforcement blocks along long corridors and above exposed ceilings as you mine.",
        metadata: { reinforcements }
      })
    );
  }

  if (task?.metadata?.requiresSilkTouch) {
    steps.push(
      createStep({
        title: "Apply silk touch",
        type: "quality",
        description: `Use a silk touch tool on ${resource} blocks that should stay intact.`
      })
    );
  }

  steps.push(
    createStep({
      title: "Collect drops",
      type: "collection",
      description: `Collect the dropped items and ensure inventory space for ${resource}.`
    })
  );

  const oreCount = countInventoryItems(inventory, resource);
  const shouldSmelt = task?.metadata?.autoSmelt || resource.includes("ore");

  if (shouldSmelt) {
    steps.push(
      createStep({
        title: "Process ore",
        type: "processing",
        description: `Smelt or blast ${resource} at a furnace array before storage if time allows.`,
        metadata: { smelt: true }
      })
    );
  }

  if (dropOff) {
    steps.push(
      createStep({
        title: "Store resources",
        type: "storage",
        description: `Deliver the mined ${resource} to the ${dropOff} and tidy the mining shaft for future runs.`,
        metadata: { container: dropOff }
      })
    );

    const storeTask = {
      action: "interact",
      details: `Store ${resource} at ${dropOff}`,
      metadata: {
        target: dropOff,
        items: [{ name: resource, count: quantity || null }]
      }
    };
    const storePlan = invokePlanner(registry, "interact", storeTask, context);
    const storeNodeId = taskGraph.addNode(
      createTaskNode({
        action: "interact",
        summary: `Store ${resource}`,
        metadata: {
          dropOff,
          items: [{ name: resource, count: quantity || null }]
        }
      })
    );
    taskGraph.addDependency(rootNodeId, storeNodeId);
    subTasks.push({
      id: storeNodeId,
      action: "interact",
      task: storeTask,
      plan: storePlan
    });
  }

  steps.push(
    createStep({
      title: "Log findings",
      type: "report",
      description: `Report yields (${oreCount} currently on hand) and note any hazards or new branches discovered.`
    })
  );

  const estimatedDuration = 11000 + (quantity ? quantity * 500 : 4000);
  const resources = [resource, tool]
    .concat(supportSupplies.map(item => item.name))
    .concat(reinforcements.map(item => item.name))
    .filter(Boolean);
  const uniqueResources = [...new Set(resources.filter(name => name && name !== "unspecified item"))];

  const risks = [];
  if (hazards.includes("cave")) {
    risks.push("Unlit caves may spawn hostile mobs.");
  }
  if (hazards.includes("gravel")) {
    risks.push("Falling gravel or sand could suffocate the miner.");
  }
  if (!hasBackupTool && backupTool) {
    risks.push(`No functional backup ${backupTool} is available if the primary breaks.`);
  }
  if (reinforcements.length === 0 && (hazards.includes("ravine") || hazards.includes("unstable ceiling"))) {
    risks.push("Lack of reinforcement blocks increases collapse risk.");
  }

  const notes = [];
  if (task?.metadata?.beacon) {
    notes.push(`Activate haste beacon at ${task.metadata.beacon}.`);
  }
  if (task?.metadata?.chunkBoundary) {
    notes.push(`Stay within chunk ${task.metadata.chunkBoundary} to avoid missing the lode.`);
  }
  if (reinforcements.length > 0) {
    notes.push("Use staged reinforcements to seal side tunnels once depleted.");
  }
  if (escort) {
    notes.push(`Escort ${escort} provides backup; maintain line-of-sight while mining.`);
  }

  return createPlan({
    task,
    summary: quantity
      ? `Mine ${quantity} ${resource} near ${targetDescription}`
      : `Mine ${resource} near ${targetDescription}`,
    steps,
    estimatedDuration,
    resources: uniqueResources,
    risks,
    notes,
    taskGraph,
    subTasks
  });
}
