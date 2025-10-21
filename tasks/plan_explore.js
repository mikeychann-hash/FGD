// tasks/plan_explore.js
// Planning logic for exploration or scouting tasks

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

export function planExploreTask(task, context = {}) {
  const targetDescription = describeTarget(task.target);
  const poi = Array.isArray(task?.metadata?.pointsOfInterest)
    ? task.metadata.pointsOfInterest.map(normalizeItemName)
    : [];
  const preferredTool = normalizeItemName(task?.metadata?.tool || "map");
  const radius = resolveQuantity(task?.metadata?.radius ?? task?.metadata?.range, null);
  const transport = normalizeItemName(task?.metadata?.transport || "foot");
  const suppliesRaw = Array.isArray(task?.metadata?.supplies)
    ? task.metadata.supplies
    : task?.metadata?.supplies && typeof task.metadata.supplies === "object"
    ? Object.entries(task.metadata.supplies).map(([name, count]) => ({ name, count }))
    : task?.metadata?.supplies
    ? [task.metadata.supplies]
    : [];
  const survivalKit = ["food", "torches", "bed", ...suppliesRaw];
  const environment = normalizeItemName(task?.metadata?.environment || context?.environment || "overworld");

  const inventory = extractInventory(context);
  const normalizedSupplies = survivalKit
    .map(item => {
      if (typeof item === "string") {
        return { name: normalizeItemName(item) };
      }
      if (item && typeof item === "object") {
        return {
          name: normalizeItemName(item.name || item.item || item.id || Object.keys(item)[0]),
          count: resolveQuantity(item.count ?? item.quantity ?? Object.values(item)[0], null)
        };
      }
      return null;
    })
    .filter(Boolean);
  const missingSupplies = normalizedSupplies.filter(supply =>
    supply?.name ? !hasInventoryItem(inventory, supply.name) : false
  );

  const steps = [];

  const suppliesSummary = formatRequirementList(normalizedSupplies) || "expedition supplies";
  const missingSuppliesSummary = formatRequirementList(missingSupplies);

  steps.push(
    createStep({
      title: "Prepare expedition",
      type: "preparation",
      description:
        missingSupplies.length > 0
          ? missingSuppliesSummary
            ? `Stock up on expedition supplies (${missingSuppliesSummary}) and set spawn/bed location.`
            : "Stock up on expedition supplies and set spawn/bed location."
          : `Stock up on ${suppliesSummary} and set spawn/bed location before departure.`,
      metadata: { supplies: normalizedSupplies, missing: missingSupplies }
    })
  );

  steps.push(
    createStep({
      title: "Calibrate tools",
      type: "preparation",
      description: `Ensure ${preferredTool} and navigation aids (compass, lodestone) are synchronized.`,
      metadata: { tool: preferredTool }
    })
  );

  if (transport && transport !== "foot") {
    steps.push(
      createStep({
        title: "Ready transport",
        type: "preparation",
        description: `Prepare ${transport} for long-range travel, including fuel or feed.`,
        metadata: { transport }
      })
    );
  }

  const travelDescription = radius
    ? `Explore within ${radius} blocks of ${targetDescription}, marking safe routes back.`
    : `Explore the region around ${targetDescription}, marking safe routes back.`;

  steps.push(
    createStep({
      title: "Travel",
      type: "movement",
      description: travelDescription,
      metadata: { radius, transport }
    })
  );

  if (task?.metadata?.mapOutChunks) {
    steps.push(
      createStep({
        title: "Map chunks",
        type: "observation",
        description: `Chart chunk boundaries and update locator maps for the region.`
      })
    );
  }

  steps.push(
    createStep({
      title: "Survey",
      type: "observation",
      description: poi.length > 0
        ? `Document points of interest: ${poi.join(", ")}.`
        : "Document notable terrain, structures, and resources encountered.",
      metadata: { poi }
    })
  );

  if (task?.metadata?.waypoints) {
    steps.push(
      createStep({
        title: "Place waypoints",
        type: "action",
        description: `Drop markers or beacons at strategic spots for future travel.`,
        metadata: { waypoints: task.metadata.waypoints }
      })
    );
  }

  steps.push(
    createStep({
      title: "Report",
      type: "report",
      description: `Return to base and share coordinates, screenshots, or notes from the exploration.`,
      metadata: { report: task?.metadata?.reportFormat || "summary" }
    })
  );

  const estimatedDuration = 14000 + (radius ? radius * 120 : 5000);
  const resources = [preferredTool, transport]
    .concat(normalizedSupplies.map(supply => supply.name))
    .filter(name => name && name !== "unspecified item");
  const uniqueResources = [...new Set(resources)];

  const risks = [];
  if (environment.includes("nether")) {
    risks.push("Nether environment requires fire resistance and careful navigation.");
  }
  if (task?.metadata?.nightRun) {
    risks.push("Night exploration increases hostile mob encounters.");
  }

  const notes = [];
  if (task?.metadata?.returnBy) {
    notes.push(`Return before ${task.metadata.returnBy}.`);
  }
  if (task?.metadata?.lootPriority) {
    notes.push(`Priority loot: ${task.metadata.lootPriority}.`);
  }

  return createPlan({
    task,
    summary: `Explore area near ${targetDescription}.`,
    steps,
    estimatedDuration,
    resources: uniqueResources,
    risks,
    notes
  });
}
