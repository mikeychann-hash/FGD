// tasks/plan_guard.js
// Planning logic for guarding or defensive assignments

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

export function planGuardTask(task, context = {}) {
  const targetDescription = describeTarget(task.target);
  const patrolRoute = Array.isArray(task?.metadata?.patrol)
    ? task.metadata.patrol.map(point => describeTarget(point))
    : [];
  const shiftDuration = resolveQuantity(task?.metadata?.duration ?? task?.metadata?.shift, null);
  const backup = normalizeItemName(task?.metadata?.support || "");
  const alarm = normalizeItemName(task?.metadata?.alarm || "bell");
  const stance = normalizeItemName(task?.metadata?.stance || "defensive");

  const equipment = [
    normalizeItemName(task?.metadata?.primaryWeapon || "sword"),
    normalizeItemName(task?.metadata?.secondaryWeapon || "shield"),
    "armor"
  ].filter(Boolean);

  const inventory = extractInventory(context);
  const missingEquipment = equipment.filter(item => !hasInventoryItem(inventory, item));

  const steps = [];

  const missingEquipmentSummary = formatRequirementList(missingEquipment);
  const equipDescription = missingEquipment.length > 0
    ? missingEquipmentSummary
      ? `Acquire missing equipment (${missingEquipmentSummary}) before heading out.`
      : "Acquire missing equipment before heading out."
    : `Equip ${equipment.join(", ")} before heading out.`;

  steps.push(
    createStep({
      title: "Equip gear",
      type: "preparation",
      description: equipDescription,
      metadata: { equipment, missing: missingEquipment }
    })
  );

  if (task?.metadata?.potions) {
    const potions = Array.isArray(task.metadata.potions)
      ? task.metadata.potions.map(normalizeItemName)
      : [normalizeItemName(task.metadata.potions)];
    steps.push(
      createStep({
        title: "Brew buffs",
        type: "preparation",
        description: `Carry helpful potions (${potions.join(", ")}) for prolonged engagements.`,
        metadata: { potions }
      })
    );
  }

  steps.push(
    createStep({
      title: "Move to post",
      type: "movement",
      description: `Travel to guard position at ${targetDescription}.`,
      metadata: { stance }
    })
  );

  if (task?.metadata?.fortify) {
    steps.push(
      createStep({
        title: "Fortify area",
        type: "construction",
        description: `Place defensive blocks, lighting, and traps as requested before starting the watch.`,
        metadata: { fortify: task.metadata.fortify }
      })
    );
  }

  if (patrolRoute.length > 0) {
    steps.push(
      createStep({
        title: "Patrol",
        type: "action",
        description: `Follow patrol route: ${patrolRoute.join(" -> ")}, watching for hostile mobs.`,
        metadata: { route: patrolRoute }
      })
    );
  } else {
    steps.push(
      createStep({
        title: "Hold position",
        type: "action",
        description: `Monitor the area around ${targetDescription} and engage threats as necessary.`
      })
    );
  }

  if (shiftDuration && shiftDuration > 0) {
    steps.push(
      createStep({
        title: "Maintain watch",
        type: "timed",
        description: `Maintain ${stance} stance for ${shiftDuration} minutes, rotating patrol cycles as needed.`,
        metadata: { duration: shiftDuration }
      })
    );
  }

  if (backup && backup !== "unspecified item") {
    steps.push(
      createStep({
        title: "Coordinate backup",
        type: "communication",
        description: `Stay in contact with ${backup} for reinforcements or relief.`,
        metadata: { backup }
      })
    );
  }

  steps.push(
    createStep({
      title: "Set alarm",
      type: "preparation",
      description: `Ensure alarm mechanism (${alarm}) is functional for quick alerts.`,
      metadata: { alarm }
    })
  );

  steps.push(
    createStep({
      title: "Report",
      type: "report",
      description: `Communicate status updates or threats detected while on guard duty.`,
      metadata: { cadence: task?.metadata?.reportCadence || "regular" }
    })
  );

  const estimatedDuration = 10000 + (shiftDuration ? shiftDuration * 600 : 4000);
  const resources = [
    ...new Set(
      [...equipment, backup, alarm].filter(name => name && name !== "unspecified item")
    )
  ];

  const risks = [];
  if (missingEquipment.length > 0) {
    risks.push("Guard may be under-equipped for threats.");
  }
  if (task?.metadata?.highThreat) {
    risks.push("High threat level expected; keep escape route ready.");
  }

  const notes = [];
  if (task?.metadata?.rotation) {
    notes.push(`Guard rotation: ${task.metadata.rotation}.`);
  }
  if (task?.metadata?.safeZone) {
    notes.push(`Fallback point: ${describeTarget(task.metadata.safeZone)}.`);
  }

  return createPlan({
    task,
    summary: `Guard ${targetDescription} with regular status updates.`,
    steps,
    estimatedDuration,
    resources,
    risks,
    notes
  });
}
