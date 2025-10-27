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

import {
  COMBAT_CONSTANTS,
  COMBAT_EQUIPMENT,
  DEFENSIVE_SYSTEMS
} from "./combat_utils.js";

// Default equipment and configuration constants (using shared constants)
const DEFAULT_PRIMARY_WEAPON = COMBAT_CONSTANTS.DEFAULT_PRIMARY_WEAPON;
const DEFAULT_SECONDARY_WEAPON = COMBAT_CONSTANTS.DEFAULT_SECONDARY_WEAPON;
const DEFAULT_ARMOR = COMBAT_CONSTANTS.DEFAULT_ARMOR;
const DEFAULT_STANCE = COMBAT_CONSTANTS.DEFAULT_STANCE;
const UNSPECIFIED_ITEM = COMBAT_CONSTANTS.UNSPECIFIED_ITEM;
const DEFAULT_ALARM = "bell";

// Duration constants (in milliseconds)
const BASE_DURATION_MS = 10000;
const SHIFT_DURATION_MULTIPLIER_MS = 600; // Multiplier per minute of shift
const DEFAULT_SHIFT_DURATION_MS = 4000;

// Report cadence default
const DEFAULT_REPORT_CADENCE = "regular";

/**
 * Plans a guard task with equipment preparation, positioning, and patrol logic.
 * Uses shared combat utilities from combat_utils.js for equipment validation and defensive systems.
 *
 * @param {Object} task - The guard task to plan
 * @param {Object} task.target - The target location to guard (required)
 * @param {Object} [task.metadata] - Optional metadata for the guard task
 * @param {Array} [task.metadata.patrol] - Patrol route waypoints
 * @param {number|string} [task.metadata.duration] - Shift duration in minutes
 * @param {number|string} [task.metadata.shift] - Alternative shift duration
 * @param {string} [task.metadata.support] - Backup/support unit name
 * @param {string} [task.metadata.alarm] - Alarm mechanism type
 * @param {string} [task.metadata.stance] - Guard stance (defensive, aggressive, etc.)
 * @param {string} [task.metadata.primaryWeapon] - Primary weapon type
 * @param {string} [task.metadata.secondaryWeapon] - Secondary weapon type
 * @param {Array|string} [task.metadata.potions] - Potions to carry
 * @param {boolean} [task.metadata.fortify] - Whether to fortify the area
 * @param {string} [task.metadata.threatLevel] - Threat level (low, medium, high, extreme)
 * @param {boolean} [task.metadata.highThreat] - High threat level indicator
 * @param {string} [task.metadata.rotation] - Guard rotation schedule
 * @param {Object} [task.metadata.safeZone] - Fallback safe zone location
 * @param {string} [task.metadata.reportCadence] - Reporting frequency
 * @param {Object} [context={}] - Context including inventory and other state
 * @returns {Object} A complete guard plan with steps, resources, and risks
 * @throws {Error} If task or task.target is missing
 */
export function planGuardTask(task, context = {}) {
  // Input validation
  if (!task) {
    throw new Error("Task is required for guard planning");
  }
  if (!task.target) {
    throw new Error("Task target is required for guard planning");
  }
  const targetDescription = describeTarget(task.target);
  const patrolRoute = Array.isArray(task?.metadata?.patrol)
    ? task.metadata.patrol.map(point => describeTarget(point))
    : [];
  const shiftDurationMinutes = resolveQuantity(task?.metadata?.duration ?? task?.metadata?.shift, null);
  const backup = normalizeItemName(task?.metadata?.support ?? "");
  const alarm = normalizeItemName(task?.metadata?.alarm ?? DEFAULT_ALARM);
  const stance = normalizeItemName(task?.metadata?.stance ?? DEFAULT_STANCE);

  const equipment = [
    normalizeItemName(task?.metadata?.primaryWeapon ?? DEFAULT_PRIMARY_WEAPON),
    normalizeItemName(task?.metadata?.secondaryWeapon ?? DEFAULT_SECONDARY_WEAPON),
    DEFAULT_ARMOR
  ].filter(Boolean);

  // Ensure at least one piece of equipment is present
  if (equipment.length === 0) {
    equipment.push(DEFAULT_PRIMARY_WEAPON);
  }

  // Use shared equipment validation
  const equipmentValidation = COMBAT_EQUIPMENT.validateEquipment(equipment, context);
  const missingEquipment = equipmentValidation.missing;

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
      metadata: { equipment, missing: missingEquipment, validation: equipmentValidation }
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
    // Use shared defensive systems for fortification recommendations
    const threatLevel = task?.metadata?.threatLevel || "medium";
    const timeAvailable = shiftDurationMinutes ? Math.min(shiftDurationMinutes * 0.3, 20) : 15;
    const defensiveSetup = DEFENSIVE_SYSTEMS.suggestDefensiveSetup({
      threatLevel,
      availableMaterials: extractInventory(context),
      timeAvailable
    });

    const fortifyDescription = defensiveSetup.recommendations.length > 0
      ? `Fortify area: ${defensiveSetup.recommendations.map(r => r.type).join(", ")}. Estimated setup: ${defensiveSetup.estimatedTime} minutes.`
      : "Place defensive blocks, lighting, and traps as requested before starting the watch.";

    steps.push(
      createStep({
        title: "Fortify area",
        type: "construction",
        description: fortifyDescription,
        metadata: {
          fortify: task.metadata.fortify,
          defensiveSetup,
          recommendations: defensiveSetup.recommendations
        }
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

  if (shiftDurationMinutes && shiftDurationMinutes > 0) {
    steps.push(
      createStep({
        title: "Maintain watch",
        type: "timed",
        description: `Maintain ${stance} stance for ${shiftDurationMinutes} minutes, rotating patrol cycles as needed.`,
        metadata: { duration: shiftDurationMinutes }
      })
    );
  }

  if (backup && backup !== UNSPECIFIED_ITEM) {
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
      metadata: { cadence: task?.metadata?.reportCadence ?? DEFAULT_REPORT_CADENCE }
    })
  );

  // Calculate estimated duration in milliseconds
  const estimatedDurationMs = BASE_DURATION_MS +
    (shiftDurationMinutes ? shiftDurationMinutes * SHIFT_DURATION_MULTIPLIER_MS : DEFAULT_SHIFT_DURATION_MS);

  const resources = [
    ...new Set(
      [...equipment, backup, alarm].filter(name => name && name !== UNSPECIFIED_ITEM)
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
    estimatedDuration: estimatedDurationMs,
    resources,
    risks,
    notes
  });
}
