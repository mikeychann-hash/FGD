// helpers.js
// Shared utilities for task planners, normalizing data, validating plans,
// and building structured steps for the AICraft Federation (FGD) stack.

import crypto from "crypto";

/* ---------------------------------------------
 * Item / Entity Normalization
 * --------------------------------------------- */

const ITEM_ALIASES = {
  "iron pickaxe": "iron_pickaxe",
  "stone pickaxe": "stone_pickaxe",
  "wood pickaxe": "wooden_pickaxe",
  "wood": "oak_log",
  "torchlight": "torch",
  "meat": "cooked_beef",
  "bread loaf": "bread",
  "bucket water": "water_bucket",
  "torch block": "torch"
};

export function normalizeItemName(name) {
  if (!name || typeof name !== "string") return "unspecified item";
  const trimmed = name.trim().toLowerCase();
  if (ITEM_ALIASES[trimmed]) return ITEM_ALIASES[trimmed];
  return trimmed.replace(/\s+/g, "_");
}

/* ---------------------------------------------
 * Quantity Resolution
 * --------------------------------------------- */

export function resolveQuantity(value, fallback = 1) {
  if (value == null) return fallback;
  if (typeof value === "number" && !isNaN(value)) return Math.max(value, 0);
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? fallback : Math.max(parsed, 0);
  }
  return fallback;
}

/* ---------------------------------------------
 * Target Description
 * --------------------------------------------- */

export function describeTarget(target) {
  if (!target) return "unspecified target";
  if (typeof target === "string") return target;
  if (typeof target === "object") {
    const { x, y, z, label, name } = target;
    if (label) return label;
    if (name) return name;
    if (x !== undefined && y !== undefined && z !== undefined) {
      return `(${x}, ${y}, ${z})`;
    }
  }
  return "target location";
}

/* ---------------------------------------------
 * Inventory Extraction and Helpers
 * --------------------------------------------- */

export function extractInventory(context = {}) {
  const candidates = [
    context.inventory,
    context?.npc?.inventory,
    context?.agent?.inventory,
    context?.state?.inventory
  ].filter(Boolean);

  const items = [];
  for (const inv of candidates) {
    if (Array.isArray(inv)) {
      for (const item of inv) {
        if (item && typeof item === "object" && item.name) {
          items.push({
            name: normalizeItemName(item.name),
            count: resolveQuantity(item.count ?? item.quantity ?? 1, 1),
            durability: resolveQuantity(item.durability, null),
            maxDurability: resolveQuantity(item.maxDurability, null)
          });
        } else if (typeof item === "string") {
          items.push({ name: normalizeItemName(item), count: 1 });
        }
      }
    }
  }
  return items;
}

export function mergeInventories(...inventories) {
  const merged = new Map();
  for (const inv of inventories) {
    for (const item of inv) {
      const key = normalizeItemName(item.name);
      const prev = merged.get(key) || { name: key, count: 0 };
      merged.set(key, { ...prev, count: prev.count + (item.count || 1) });
    }
  }
  return Array.from(merged.values());
}

export function hasInventoryItem(inventory, name, required = 1) {
  const normalized = normalizeItemName(name);
  const found = inventory.find(i => i.name === normalized);
  return found ? found.count >= required : false;
}

export function countInventoryItems(inventory, name) {
  const normalized = normalizeItemName(name);
  const found = inventory.find(i => i.name === normalized);
  return found ? found.count : 0;
}

/* ---------------------------------------------
 * Requirement Formatting
 * --------------------------------------------- */

export function formatRequirementList(items = []) {
  if (!Array.isArray(items) || items.length === 0) return "";
  const parts = items.map(it => {
    const c = it.count ? `${it.count} ` : "";
    return `${c}${it.name}`;
  });
  if (parts.length === 1) return parts[0];
  const last = parts.pop();
  return `${parts.join(", ")} and ${last}`;
}

/* ---------------------------------------------
 * Plan / Step Creation
 * --------------------------------------------- */

function generateStepId(title) {
  const hash = crypto.randomBytes(3).toString("hex");
  return `${normalizeItemName(title)}_${hash}`;
}

export function createStep({
  title,
  type = "action",
  description = "",
  metadata = {},
  command = null,
  order = null
}) {
  const stepId = generateStepId(title);
  return {
    id: stepId,
    title,
    type,
    description,
    command,
    metadata,
    orderIndex: order,
    createdAt: Date.now()
  };
}

export function createPlan({
  task,
  summary,
  steps,
  estimatedDuration,
  resources,
  risks,
  notes
}) {
  const planId = crypto.randomUUID();
  return {
    id: planId,
    summary,
    task,
    steps,
    estimatedDuration,
    resources,
    risks,
    notes,
    createdAt: Date.now(),
    schemaVersion: "1.2"
  };
}

/* ---------------------------------------------
 * Validation & Diagnostics
 * --------------------------------------------- */

export function validatePlan(plan) {
  if (!plan || typeof plan !== "object") {
    throw new Error("Invalid plan object");
  }
  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    throw new Error("Plan missing steps");
  }
  const invalid = plan.steps.filter(
    s => !s.title || !s.type || typeof s.description !== "string"
  );
  if (invalid.length > 0) {
    console.warn("⚠️ Invalid steps found:", invalid.map(s => s.title));
  }
  return true;
}

/* ---------------------------------------------
 * Utility Logging (optional)
 * --------------------------------------------- */

export function debugLog(tag, message, data = null) {
  const time = new Date().toISOString();
  if (data) console.log(`[${time}] [${tag}] ${message}`, data);
  else console.log(`[${time}] [${tag}] ${message}`);
}
