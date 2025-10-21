// tasks/plan_gather.js
// Planning logic for gathering crops or resources

import {
  createPlan,
  createStep,
  describeTarget,
  normalizeItemName,
  extractInventory,
  hasInventoryItem,
  formatRequirementList,
  resolveQuantity
} from "./helpers.js";

export function planGatherTask(task, context = {}) {
  const resource = normalizeItemName(task?.metadata?.resource || task.details || "resources");
  const tool = normalizeItemName(task?.metadata?.tool || "axe");
  const backupTools = Array.isArray(task?.metadata?.backupTools)
    ? task.metadata.backupTools.map(normalizeItemName)
    : [];
  const targetDescription = describeTarget(task.target);
  const storage = normalizeItemName(task?.metadata?.storage || "storage chest");
  const quantity = resolveQuantity(task?.metadata?.quantity ?? task?.metadata?.count, null);
  const method = normalizeItemName(task?.metadata?.method || "manual harvest");
  const replant = task?.metadata?.replant ?? resource.includes("crop");
  const replantItem = replant
    ? normalizeItemName(task?.metadata?.replantItem || task?.metadata?.seed || `${resource} seeds`)
    : null;
  const harvestWindow = task?.metadata?.window || task?.metadata?.timing;
  const maturity = task?.metadata?.maturity || (resource.includes("crop") ? "fully grown" : null);
  const fieldSize = resolveQuantity(task?.metadata?.fieldSize, null);
  const yieldPerPlot = resolveQuantity(task?.metadata?.yieldPerPlot, null);
  const processing = Array.isArray(task?.metadata?.processing)
    ? task.metadata.processing.map(normalizeItemName)
    : [];

  const inventory = extractInventory(context);
  const hasPrimaryTool = hasInventoryItem(inventory, tool);
  const missingTools = [tool, ...backupTools].filter(name => !hasInventoryItem(inventory, name));
  const needsReplantSupplies = replant && replantItem && !hasInventoryItem(inventory, replantItem, fieldSize || 1);

  const prepDescription = missingTools.length > 0
    ? `Obtain or craft tools before departing: ${formatRequirementList(missingTools)}.`
    : `Check durability on ${[tool, ...backupTools].filter(Boolean).join(", ") || tool} before departing.`;

  const steps = [];

  steps.push(
    createStep({
      title: "Prepare gear",
      type: "preparation",
      description: prepDescription,
      metadata: { tool, backupTools }
    })
  );

  if (needsReplantSupplies) {
    steps.push(
      createStep({
        title: "Gather replanting stock",
        type: "inventory",
        description: `Restock ${replantItem} so fields can be replanted after harvesting.`,
        metadata: { item: replantItem, amount: fieldSize || quantity || undefined }
      })
    );
  }

  if (task?.metadata?.supplies) {
    const supplies = Array.isArray(task.metadata.supplies)
      ? task.metadata.supplies
      : Object.entries(task.metadata.supplies).map(([name, count]) => ({ name, count }));
    const suppliesSummary = formatRequirementList(supplies) || "supportive items";
    steps.push(
      createStep({
        title: "Pack supplies",
        type: "inventory",
        description: `Carry supportive items (${suppliesSummary}).`,
        metadata: { supplies }
      })
    );
  }

  steps.push(
    createStep({
      title: "Travel",
      type: "movement",
      description: `Head to ${targetDescription} where ${resource} can be collected.`,
      metadata: { destination: targetDescription }
    })
  );

  if (maturity || harvestWindow) {
    const readinessDescriptionParts = [];
    if (maturity) {
      readinessDescriptionParts.push(`Confirm ${resource} are ${maturity}`);
    }
    if (harvestWindow) {
      readinessDescriptionParts.push(`work within the preferred window (${harvestWindow})`);
    }
    const readinessDescription = readinessDescriptionParts.filter(Boolean).join(" and ") ||
      `Inspect ${resource} plots and confirm readiness.`;
    steps.push(
      createStep({
        title: "Inspect field",
        type: "survey",
        description: `${readinessDescription}.`,
        metadata: { maturity, window: harvestWindow }
      })
    );
  }

  const harvestDescription = quantity
    ? `Collect approximately ${quantity} ${resource} using the ${tool} via ${method}.`
    : `Collect ${resource} efficiently using the ${tool} via ${method}.`;

  steps.push(
    createStep({
      title: "Harvest",
      type: "collection",
      description: harvestDescription,
      metadata: { tool, quantity, method }
    })
  );

  if (replant) {
    steps.push(
      createStep({
        title: "Replant",
        type: "maintenance",
        description: `Replant ${replantItem || "seeds or saplings"} to sustain future ${resource} harvests.`,
        metadata: { item: replantItem || undefined }
      })
    );
  }

  if (processing.length > 0) {
    steps.push(
      createStep({
        title: "Process yield",
        type: "processing",
        description: `Process gathered items (${processing.join(", ")}), such as composting extras or crafting blocks.`,
        metadata: { processing }
      })
    );
  }

  steps.push(
    createStep({
      title: "Sort",
      type: "inventory",
      description: `Organize gathered ${resource} in inventory, converting to blocks or bundles if useful.`
    })
  );

  steps.push(
    createStep({
      title: "Store",
      type: "storage",
      description: `Deliver ${resource} to the ${storage} and update counts.`,
      metadata: { container: storage, quantity }
    })
  );

  if (task?.metadata?.compostExtras) {
    steps.push(
      createStep({
        title: "Compost surplus",
        type: "processing",
        description: `Convert excess or spoiled ${resource} into bone meal before closing out the run.`,
        metadata: { method: "compost" }
      })
    );
  }

  if (task?.metadata?.report !== false) {
    steps.push(
      createStep({
        title: "Report",
        type: "report",
        description: `Share totals gathered and note regrowth timers or hazards encountered.`
      })
    );
  }

  const estimatedDuration = 9000 + (quantity ? quantity * 250 : 3500);
  const resources = [
    resource,
    tool,
    ...backupTools.filter(Boolean),
    ...(replantItem ? [replantItem] : [])
  ];
  const uniqueResources = [...new Set(resources.filter(name => name && name !== "unspecified item"))];

  const risks = [];
  if (!hasPrimaryTool) {
    risks.push(`Missing primary tool (${tool}) could slow gathering.`);
  }
  if (needsReplantSupplies) {
    risks.push(`Insufficient ${replantItem} to fully replant after harvesting.`);
  }
  if (task?.metadata?.hostileRisk) {
    risks.push("Hostile mobs may spawn during gathering.");
  }

  const notes = [];
  if (task?.metadata?.weatherSensitive) {
    notes.push("Avoid harvesting during rain to protect crops.");
  }
  if (task?.metadata?.schedule) {
    notes.push(`Preferred harvest schedule: ${task.metadata.schedule}.`);
  }
  if (harvestWindow) {
    notes.push(`Aim to harvest during ${harvestWindow} for peak yields.`);
  }
  if (fieldSize) {
    const estimatedYield = yieldPerPlot && fieldSize && !quantity
      ? yieldPerPlot * fieldSize
      : quantity;
    if (estimatedYield) {
      notes.push(`Expect roughly ${estimatedYield} items from ${fieldSize} plots.`);
    } else {
      notes.push(`Field area covers approximately ${fieldSize} plots.`);
    }
  }

  return createPlan({
    task,
    summary: `Gather ${resource} at ${targetDescription}.`,
    steps,
    estimatedDuration,
    resources: uniqueResources,
    risks,
    notes
  });
}
