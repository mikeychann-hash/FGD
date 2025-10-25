// tasks/plan_interact.js
// Handles container or block interaction tasks like opening chests

import {
  createPlan,
  createStep,
  describeTarget,
  normalizeItemName,
  extractInventory,
  hasInventoryItem,
  formatRequirementList
} from "./helpers.js";

// Constants for timing and duration calculations
const DEFAULT_INTERACTION_DURATION_MS = 7000;
const INTERACTION_BUFFER_MS = 3000;

/**
 * Safely converts a value to a positive number
 * @param {*} value - Value to convert
 * @param {number|null} defaultValue - Default if conversion fails
 * @returns {number|null} Converted number or default
 */
function safeNumberConversion(value, defaultValue = null) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : defaultValue;
}

/**
 * Sanitizes coordinate strings to prevent command injection
 * @param {string} coordString - Coordinate string to sanitize
 * @returns {string} Sanitized coordinate string
 */
function sanitizeCoordinates(coordString) {
  // Only allow numbers, spaces, dots, and minus signs
  return coordString.replace(/[^0-9\s.\-]/g, "");
}

function normalizeTransferItems(transfer) {
  if (!transfer) {
    return { take: [], store: [] };
  }
  const normalizeEntry = entry => {
    if (typeof entry === "string") {
      const normalized = normalizeItemName(entry);
      return normalized && normalized !== "unspecified item"
        ? { name: normalized }
        : null;
    }
    if (entry && typeof entry === "object") {
      const name = normalizeItemName(entry.name || entry.item);
      if (!name || name === "unspecified item") {
        return null;
      }
      const count = safeNumberConversion(entry.count || entry.quantity);
      return {
        name,
        ...(count !== null && { count })
      };
    }
    return null;
  };

  const take = Array.isArray(transfer.take)
    ? transfer.take.map(normalizeEntry).filter(Boolean)
    : transfer.take
    ? [normalizeEntry(transfer.take)].filter(Boolean)
    : [];
  const store = Array.isArray(transfer.store)
    ? transfer.store.map(normalizeEntry).filter(Boolean)
    : transfer.store
    ? [normalizeEntry(transfer.store)].filter(Boolean)
    : [];

  return { take, store };
}

export function planInteractTask(task, context = {}) {
  // Input validation
  if (!task || typeof task !== "object") {
    throw new Error("planInteractTask requires a valid task object");
  }

  if (!task.target) {
    throw new Error("Task must have a target location");
  }

  const container = normalizeItemName(task?.metadata?.container || task?.metadata?.block || "chest");
  const interaction = normalizeItemName(task?.metadata?.interaction || "open_container");
  const targetDescription = describeTarget(task.target);
  const transferRaw = task?.metadata?.transfer || {};
  const transfer = normalizeTransferItems(transferRaw);
  const requiresKey = normalizeItemName(task?.metadata?.requiresKey || "");
  const holdItem = normalizeItemName(task?.metadata?.holdItem || "");

  // Safe number conversion to prevent NaN issues
  const duration = safeNumberConversion(task?.metadata?.duration);

  const inventory = extractInventory(context);
  const missingKey = requiresKey && !hasInventoryItem(inventory, requiresKey);

  const steps = [];

  if (requiresKey) {
    steps.push(
      createStep({
        title: "Prepare key",
        type: "preparation",
        description: missingKey
          ? `Retrieve the ${requiresKey} required to unlock the ${container}.`
          : `Keep the ${requiresKey} ready to unlock the ${container}.`,
        metadata: { key: requiresKey }
      })
    );
  }

  if (holdItem && holdItem !== "unspecified item") {
    steps.push(
      createStep({
        title: "Select tool",
        type: "preparation",
        description: `Hold ${holdItem} before interacting to trigger the correct behavior.`,
        metadata: { item: holdItem }
      })
    );
  }

  steps.push(
    createStep({
      title: "Approach",
      type: "movement",
      description: `Move to ${container} located at ${targetDescription}.`
    })
  );

  const interactDescription = duration
    ? `Perform ${interaction} on the ${container} and keep it open for ${duration} seconds to complete transfers.`
    : `Perform ${interaction} on the ${container}, ensuring the inventory GUI remains open long enough for transfers.`;

  // Secure command target construction to prevent command injection
  let commandTarget = null;
  if (
    task?.target &&
    typeof task.target === "object" &&
    Number.isFinite(task.target.x) &&
    Number.isFinite(task.target.y) &&
    Number.isFinite(task.target.z)
  ) {
    // Use validated numeric coordinates only
    const x = Math.floor(task.target.x);
    const y = Math.floor(task.target.y);
    const z = Math.floor(task.target.z);
    commandTarget = `${x} ${y} ${z}`;
  } else {
    // Fallback: sanitize target description to prevent injection
    commandTarget = sanitizeCoordinates(targetDescription.replace(/[()]/g, ""));
  }

  steps.push(
    createStep({
      title: "Interact",
      type: "interaction",
      description: interactDescription,
      command: `/data get block ${commandTarget} Items`
    })
  );

  if (transfer.take.length > 0 || transfer.store.length > 0) {
    const transferParts = [];
    if (transfer.take.length > 0) {
      transferParts.push(`retrieve ${formatRequirementList(transfer.take)}`);
    }
    if (transfer.store.length > 0) {
      transferParts.push(`deposit ${formatRequirementList(transfer.store)}`);
    }

    steps.push(
      createStep({
        title: "Manage inventory",
        type: "inventory",
        description: `Within the ${container}, ${transferParts.join(" and ")}. Confirm slot counts afterwards.`,
        metadata: transfer
      })
    );
  }

  if (task?.metadata?.recordContents) {
    steps.push(
      createStep({
        title: "Record contents",
        type: "report",
        description: `Log notable items inside the ${container} for tracking.`
      })
    );
  }

  steps.push(
    createStep({
      title: "Secure container",
      type: "cleanup",
      description: `Close the ${container} and ensure no items spill on the ground.`
    })
  );

  // Build resources array, filtering out unspecified/invalid items
  const resources = [];
  if (container && container !== "unspecified item") {
    resources.push(container);
  }
  if (requiresKey && requiresKey !== "unspecified item") {
    resources.push(requiresKey);
  }
  if (holdItem && holdItem !== "unspecified item") {
    resources.push(holdItem);
  }

  const risks = [];
  if (missingKey) {
    risks.push(`Missing required key item (${requiresKey}).`);
  }
  if (task?.metadata?.redstoneLinked) {
    risks.push("Redstone linkage may trigger traps when opened.");
  }

  const notes = [];
  if (task?.metadata?.ownership) {
    notes.push(`Container owned by ${task.metadata.ownership}; ensure permissions before interacting.`);
  }

  return createPlan({
    task,
    summary: `Interact with ${container} at ${targetDescription}.`,
    steps,
    estimatedDuration: duration
      ? duration * 1000 + INTERACTION_BUFFER_MS
      : DEFAULT_INTERACTION_DURATION_MS,
    resources,
    risks,
    notes
  });
}
