// tasks/plan_mine.js
// Generates a detailed plan for mining-style tasks
// Integrates environment scanning, safety logic, durability checks, and outcome awareness

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
  debugLog
} from "./helpers.js";

import { KnowledgeStore } from "../knowledge_store.js";
const knowledge = new KnowledgeStore();

const DEFAULT_SUPPORT_SUPPLIES = [
  { name: "torch", count: 32 },
  { name: "wood", count: 16 },
  { name: "food", count: 8 }
];

const MINING_STYLES = {
  strip_mine: {
    id: "strip_mine",
    label: "Strip Mine",
    description: "Carve a central tunnel with 1x2 branches every few blocks.",
    setup: "Lay out a 3-wide corridor, torch every 5 blocks, branch every 3.",
    recommendedSupplies: [{ name: "ladder", count: 8 }, { name: "chest", count: 2 }]
  },
  staircase: {
    id: "staircase",
    label: "Staircase",
    description: "Dig a descending stairwell with headroom and safety rails.",
    setup: "2-wide descent, torch every landing, seal caverns.",
    recommendedSupplies: [{ name: "stairs", count: 32 }, { name: "fence", count: 16 }]
  },
  quarry: {
    id: "quarry",
    label: "Quarry",
    description: "Excavate a layered open pit in concentric rings.",
    setup: "Mark perimeter, dig layer by layer, ladder access on each face.",
    recommendedSupplies: [{ name: "scaffolding", count: 32 }, { name: "ladder", count: 32 }]
  },
  vertical_shaft: {
    id: "vertical_shaft",
    label: "Vertical Shaft",
    description: "Drill straight down with ladder or water elevator.",
    setup: "Pair shafts, ladders or water column, safety shelf every 10 blocks.",
    recommendedSupplies: [{ name: "ladder", count: 48 }, { name: "water_bucket", count: 1 }]
  }
};

const STYLE_ALIASES = {
  strip: "strip_mine",
  "branch mine": "strip_mine",
  "branch": "strip_mine",
  "staircase mine": "staircase",
  stairs: "staircase",
  quarry: "quarry",
  shaft: "vertical_shaft"
};

/* ---------------------------------------------
 * Style Resolution
 * --------------------------------------------- */
function selectMiningStyle(task, context) {
  const request = normalizeItemName(task?.metadata?.style || task?.metadata?.method);
  const alias = STYLE_ALIASES[request];
  if (MINING_STYLES[alias]) return MINING_STYLES[alias];
  if (MINING_STYLES[request]) return MINING_STYLES[request];

  // Fallback heuristics
  const hazards = (task?.metadata?.hazards || []).map(normalizeItemName);
  const quantity = resolveQuantity(task?.metadata?.quantity, null);
  if (hazards.includes("lava")) return MINING_STYLES.staircase;
  if (quantity && quantity >= 128) return MINING_STYLES.quarry;
  return MINING_STYLES.strip_mine;
}

/* ---------------------------------------------
 * Environmental Extraction (simplified)
 * --------------------------------------------- */
function extractEnvironment(context = {}) {
  const env = (context.environment || "").toLowerCase();
  return {
    isCave: env.includes("cave") || env.includes("mine"),
    isLava: env.includes("lava"),
    isLowLight: context?.lightLevel && context.lightLevel < 8
  };
}

/* ---------------------------------------------
 * Main Planner
 * --------------------------------------------- */
export async function planMineTask(task, context = {}) {
  const targetDescription = describeTarget(task.target);
  const resource = normalizeItemName(task?.metadata?.resource || task?.metadata?.ore || task.details);
  const tool = normalizeItemName(task?.metadata?.tool || "pickaxe");
  const backupTool = normalizeItemName(task?.metadata?.backupTool || "");
  const dropOff = task?.metadata?.dropOff ? normalizeItemName(task.metadata.dropOff) : null;
  const quantity = resolveQuantity(task?.metadata?.quantity, null);
  const depth = resolveQuantity(task?.metadata?.depth, null);
  const reinforcements = Array.isArray(task?.metadata?.reinforcements)
    ? task.metadata.reinforcements.map(i => ({ name: normalizeItemName(i.name || i), count: resolveQuantity(i.count, 1) }))
    : [];

  const inventory = extractInventory(context);
  const style = selectMiningStyle(task, context);
  const env = extractEnvironment(context);

  const supportSupplies = [
    ...DEFAULT_SUPPORT_SUPPLIES,
    ...(style.recommendedSupplies || [])
  ];

  // Check inventory sufficiency
  const missingSupplies = supportSupplies.filter(i => !hasInventoryItem(inventory, i.name, i.count));
  const hasTool = hasInventoryItem(inventory, tool);
  const hasBackup = backupTool ? hasInventoryItem(inventory, backupTool) : true;

  const steps = [];

  /* Preparation Phase */
  steps.push(
    createStep({
      title: "Stock supplies",
      type: "inventory",
      description: missingSupplies.length
        ? `Acquire missing supplies: ${formatRequirementList(missingSupplies)}.`
        : `Ensure supplies ready: ${formatRequirementList(supportSupplies)}.`,
      metadata: { supplies: supportSupplies }
    })
  );

  steps.push(
    createStep({
      title: "Tool readiness",
      type: "preparation",
      description: hasTool
        ? `Inspect ${tool} durability before mining.`
        : `Obtain or craft a ${tool} before mining.`,
      metadata: { tool, backupTool }
    })
  );

  if (!hasBackup && backupTool) {
    steps.push(
      createStep({
        title: "Prepare backup tool",
        type: "maintenance",
        description: `No backup ${backupTool} found; craft or retrieve one.`,
        metadata: { backupTool }
      })
    );
  }

  /* Environmental Preparation */
  if (env.isLowLight) {
    steps.push(
      createStep({
        title: "Restore lighting",
        type: "safety",
        description: "Low light detected — place torches every 5 blocks.",
        command: "place torch"
      })
    );
  }

  if (env.isLava) {
    steps.push(
      createStep({
        title: "Lava safety",
        type: "safety",
        description: "Carry a water bucket or fire resistance potion; block off exposed lava.",
        command: "carry water_bucket"
      })
    );
  }

  /* Structural Layout */
  steps.push(
    createStep({
      title: `${style.label} layout`,
      type: "planning",
      description: style.setup,
      metadata: { style: style.id }
    })
  );

  /* Mining Execution */
  const yieldRate = knowledge.getSuccessRate("mining", "yield") || 0.85;
  const durationMod = Math.max(0.5, 1.2 - yieldRate); // smarter miners take less time

  const estimatedDuration = 10000 + (quantity ? quantity * 400 * durationMod : 6000);

  steps.push(
    createStep({
      title: "Excavate resource",
      type: "action",
      description: quantity
        ? `Mine approximately ${quantity} blocks of ${resource} using ${style.label.toLowerCase()} method.`
        : `Mine ${resource} using the ${style.label.toLowerCase()} pattern.`,
      metadata: { resource, style: style.id, quantity }
    })
  );

  if (reinforcements.length) {
    steps.push(
      createStep({
        title: "Shore tunnels",
        type: "safety",
        description: `Use ${formatRequirementList(reinforcements)} to reinforce ceilings and walls.`,
        metadata: { reinforcements }
      })
    );
  }

  if (dropOff) {
    steps.push(
      createStep({
        title: "Deliver resources",
        type: "storage",
        description: `Deposit mined ${resource} into ${dropOff}.`,
        command: `store ${resource} in ${dropOff}`
      })
    );
  }

  /* Logging / Completion */
  steps.push(
    createStep({
      title: "Report findings",
      type: "report",
      description: "Summarize yield, hazards, and equipment wear.",
      metadata: { reportType: "mining_summary" }
    })
  );

  const risks = [];
  if (env.isLava) risks.push("Lava exposure hazard");
  if (env.isLowLight) risks.push("Hostile mob spawns in dark tunnels");
  if (!hasBackup && backupTool) risks.push(`No backup ${backupTool} available`);

  const plan = createPlan({
    task,
    summary: `Mine ${resource} at ${targetDescription} using ${style.label} technique.`,
    steps,
    estimatedDuration,
    resources: [...supportSupplies.map(i => i.name), tool, resource],
    risks,
    notes: [`Mining style selected: ${style.label}.`, `Yield rate modifier: ${yieldRate.toFixed(2)}`]
  });

  debugLog("plan_mine", "Plan generated successfully", { style: style.id, steps: steps.length });

  return plan;
}
