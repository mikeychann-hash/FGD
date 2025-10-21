// tasks/helpers.js
// Shared helper utilities for task planning modules

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function describeTarget(target) {
  if (!target) {
    return "current position";
  }

  if (typeof target === "string") {
    return target;
  }

  if (typeof target !== "object") {
    return "target location";
  }

  const { name, label, dimension } = target;
  const coords = [target.x, target.y, target.z]
    .map(value => (isFiniteNumber(value) ? value.toFixed(1) : null))
    .filter(value => value !== null);

  const parts = [];
  if (name || label) {
    parts.push(name || label);
  }
  if (coords.length === 3) {
    parts.push(`(${coords.join(", ")})`);
  }
  if (dimension) {
    parts.push(dimension);
  }

  return parts.length > 0 ? parts.join(" ") : "target location";
}

export function normalizeItemName(item) {
  if (!item || typeof item !== "string") {
    return "unspecified item";
  }
  return item
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function resolveQuantity(value, fallback = null) {
  if (isFiniteNumber(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

export function createPlan({
  task,
  summary,
  steps,
  estimatedDuration = 8000,
  resources = [],
  risks = [],
  notes = []
}) {
  return {
    action: task.action,
    summary,
    estimatedDuration,
    resources,
    steps: Array.isArray(steps) ? steps : [],
    risks: Array.isArray(risks) ? risks : [],
    notes: Array.isArray(notes) ? notes : []
  };
}

export function createStep({ title, description, command = null, type = "generic", metadata = {} }) {
  return {
    title,
    description,
    command,
    type,
    metadata
  };
}

export function extractInventory(context = {}) {
  const rawInventory = context.inventory || context?.npc?.inventory || [];
  if (!Array.isArray(rawInventory)) {
    return [];
  }

  return rawInventory
    .map(entry => {
      if (entry && typeof entry === "object") {
        const name = normalizeItemName(entry.name || entry.item || entry.id || entry.type);
        const count = resolveQuantity(entry.count ?? entry.quantity ?? entry.amount, 1);
        return { name, count: count ?? 1 };
      }
      if (typeof entry === "string") {
        return { name: normalizeItemName(entry), count: 1 };
      }
      return null;
    })
    .filter(Boolean);
}

export function countInventoryItems(inventory, itemName) {
  if (!Array.isArray(inventory) || !itemName) {
    return 0;
  }
  const normalized = normalizeItemName(itemName);
  return inventory.reduce((total, entry) => {
    if (entry?.name === normalized) {
      return total + (entry.count ?? 0);
    }
    return total;
  }, 0);
}

export function hasInventoryItem(inventory, itemName, count = 1) {
  if (!Array.isArray(inventory) || !itemName) {
    return false;
  }
  const required = resolveQuantity(count, 1) ?? 1;
  if (required <= 0) {
    return true;
  }
  return countInventoryItems(inventory, itemName) >= required;
}

export function formatRequirementList(requirements = []) {
  if (!Array.isArray(requirements) || requirements.length === 0) {
    return "";
  }

  return requirements
    .map(req => {
      const name = normalizeItemName(req?.name || req?.item || req);
      const count = resolveQuantity(req?.count ?? req?.quantity, null);
      if (count && count > 0) {
        return `${count} ${name}`;
      }
      return name;
    })
    .filter(Boolean)
    .join(", ");
}
