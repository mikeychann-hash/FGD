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

export function extractEnvironmentalSignals(context = {}) {
  const rawSignals =
    context?.signals ||
    context?.bridgeSignals ||
    context?.sensorFlags ||
    {};

  const environment = context?.environment || {};
  const hazardSources = [
    environment?.hazards,
    environment?.nearbyHazards,
    context?.hazards
  ];

  const normalizedHazards = hazardSources
    .flatMap(source => {
      if (!source) return [];
      if (Array.isArray(source)) return source;
      if (typeof source === "string") return [source];
      return [];
    })
    .map(normalizeItemName)
    .filter(Boolean);

  const rawLightLevel = environment?.lightLevel;
  const lowLightFlag =
    rawSignals.lowLight ??
    rawSignals.lowLuminosity ??
    rawSignals.needsLighting ??
    (isFiniteNumber(rawLightLevel) ? rawLightLevel < 7 : null);

  const lavaDetected = Boolean(
    rawSignals.lavaDetected ??
      rawSignals.lava ??
      rawSignals.lavaFlow ??
      normalizedHazards.includes("lava") ||
      normalizedHazards.includes("lava pool")
  );

  const gravelDetected = Boolean(
    rawSignals.gravelDetected ??
      rawSignals.fallingGravel ??
      rawSignals.caveIn ??
      normalizedHazards.includes("gravel") ||
      normalizedHazards.includes("gravel pocket")
  );

  return {
    rawSignals,
    lowLight: Boolean(lowLightFlag),
    lightLevel: isFiniteNumber(rawLightLevel) ? rawLightLevel : null,
    lava: lavaDetected,
    gravel: gravelDetected,
    hazards: normalizedHazards
  };
}

export function resolveToolIntegrity(toolName, context = {}) {
  const normalizedTool = normalizeItemName(toolName);
  if (!toolName || normalizedTool === "unspecified item") {
    return null;
  }

  const entries = [];

  const npcName = context?.npc?.name || context?.agent || context?.player;
  const normalizedNpc = npcName ? normalizeItemName(npcName) : null;

  function parseToolEntry(rawEntry, origin) {
    if (rawEntry === null || rawEntry === undefined) {
      return null;
    }

    if (typeof rawEntry === "number") {
      return {
        durability: rawEntry,
        maxDurability: null,
        percent: null,
        broken: rawEntry <= 0,
        origin
      };
    }

    if (typeof rawEntry === "object") {
      const durability = rawEntry.durability ?? rawEntry.remaining ?? rawEntry.value ?? rawEntry.current;
      const maxDurability = rawEntry.maxDurability ?? rawEntry.max ?? rawEntry.total;
      const percentValue = rawEntry.percent ?? rawEntry.ratio;

      const parsedDurability = isFiniteNumber(durability) ? durability : null;
      const parsedMax = isFiniteNumber(maxDurability) ? maxDurability : null;
      let parsedPercent = isFiniteNumber(percentValue) ? percentValue : null;

      if (parsedPercent === null && parsedDurability !== null && parsedMax !== null && parsedMax > 0) {
        parsedPercent = parsedDurability / parsedMax;
      }

      const broken = Boolean(
        rawEntry.broken ??
          (parsedPercent !== null
            ? parsedPercent <= 0
            : parsedDurability !== null
            ? parsedDurability <= 0
            : false)
      );

      return {
        durability: parsedDurability,
        maxDurability: parsedMax,
        percent: parsedPercent !== null ? Math.max(0, Math.min(1, parsedPercent)) : null,
        broken,
        origin,
        metadata: rawEntry.metadata || rawEntry.note || rawEntry.source || null
      };
    }

    return null;
  }

  function addSource(source, origin) {
    if (!source) return;

    if (Array.isArray(source)) {
      source.forEach(entry => {
        const name = normalizeItemName(entry?.name || entry?.tool || entry?.id);
        if (name === normalizedTool) {
          const parsed = parseToolEntry(entry, origin);
          if (parsed) entries.push(parsed);
        }
      });
      return;
    }

    if (typeof source === "object") {
      const direct = source[normalizedTool];
      if (direct !== undefined) {
        const parsed = parseToolEntry(direct, origin);
        if (parsed) entries.push(parsed);
        return;
      }

      for (const [key, value] of Object.entries(source)) {
        if (normalizeItemName(key) === normalizedTool) {
          const parsed = parseToolEntry(value, origin);
          if (parsed) entries.push(parsed);
        }
      }
    }
  }

  addSource(context?.toolStatus, "bridge");
  addSource(context?.toolDurability, "context");
  addSource(context?.status?.tools || context?.status?.toolStatus, "status");
  addSource(context?.npc?.tools || context?.npc?.toolStatus, "npc");
  addSource(context?.equipment, "equipment");

  if (context?.knowledge?.toolDurability) {
    if (normalizedNpc && context.knowledge.toolDurability[normalizedNpc]) {
      addSource(context.knowledge.toolDurability[normalizedNpc], "knowledge_store");
    } else {
      Object.values(context.knowledge.toolDurability).forEach(toolMap => addSource(toolMap, "knowledge_store"));
    }
  }

  if (entries.length === 0) {
    return null;
  }

  const best = entries.reduce((selected, current) => {
    if (!selected) return current;

    if (current.broken && !selected.broken) return current;
    if (!current.broken && selected.broken) return selected;

    const currentPercent = isFiniteNumber(current.percent) ? current.percent : null;
    const selectedPercent = isFiniteNumber(selected.percent) ? selected.percent : null;

    if (currentPercent !== null && selectedPercent === null) return current;
    if (currentPercent === null && selectedPercent !== null) return selected;
    if (currentPercent !== null && selectedPercent !== null) {
      return currentPercent < selectedPercent ? current : selected;
    }

    const currentDurability = isFiniteNumber(current.durability) ? current.durability : null;
    const selectedDurability = isFiniteNumber(selected.durability) ? selected.durability : null;

    if (currentDurability !== null && selectedDurability === null) return current;
    if (currentDurability === null && selectedDurability !== null) return selected;
    if (currentDurability !== null && selectedDurability !== null) {
      return currentDurability < selectedDurability ? current : selected;
    }

    const currentMax = isFiniteNumber(current.maxDurability) ? current.maxDurability : null;
    const selectedMax = isFiniteNumber(selected.maxDurability) ? selected.maxDurability : null;

    if (currentMax !== null && selectedMax === null) return current;
    if (currentMax === null && selectedMax !== null) return selected;

    return selected;
  }, null);

  const percent = isFiniteNumber(best.percent)
    ? Math.max(0, Math.min(1, best.percent))
    : isFiniteNumber(best.durability) && isFiniteNumber(best.maxDurability) && best.maxDurability > 0
    ? Math.max(0, Math.min(1, best.durability / best.maxDurability))
    : null;

  return {
    name: normalizedTool,
    durability: isFiniteNumber(best.durability) ? best.durability : null,
    maxDurability: isFiniteNumber(best.maxDurability) ? best.maxDurability : null,
    percent,
    broken: Boolean(best.broken),
    origin: best.origin,
    sources: entries.map(entry => ({
      origin: entry.origin,
      durability: isFiniteNumber(entry.durability) ? entry.durability : null,
      percent: isFiniteNumber(entry.percent) ? Math.max(0, Math.min(1, entry.percent)) : null,
      broken: Boolean(entry.broken)
    }))
  };
}
