// tasks/helpers.js
// Shared helper utilities for task planning modules

let TASK_NODE_COUNTER = 0;

function generateTaskNodeId(prefix = "task") {
  const safePrefix = typeof prefix === "string" && prefix.trim().length > 0 ? prefix.trim() : "task";
  TASK_NODE_COUNTER += 1;
  return `${safePrefix}_${Date.now().toString(36)}_${TASK_NODE_COUNTER}`;
}

function cloneSerializable(value) {
  if (value == null) {
    return value;
  }
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

export class TaskGraph {
  constructor() {
    this.nodes = new Map();
    this.rootId = null;
  }

  addNode(nodeInput) {
    if (!nodeInput) {
      throw new Error("Cannot add empty node to TaskGraph");
    }
    const node = {
      id: nodeInput.id || generateTaskNodeId("graph"),
      action: nodeInput.action || "generic",
      summary: nodeInput.summary || nodeInput.title || nodeInput.action || "task",
      metadata: nodeInput.metadata ? { ...nodeInput.metadata } : {},
      requirements: Array.isArray(nodeInput.requirements) ? [...nodeInput.requirements] : [],
      parents: new Set(Array.isArray(nodeInput.parents) ? nodeInput.parents : []),
      children: new Set(Array.isArray(nodeInput.children) ? nodeInput.children : [])
    };

    this.nodes.set(node.id, node);
    if (!this.rootId) {
      this.rootId = node.id;
    }
    return node.id;
  }

  setRoot(nodeId) {
    if (!this.nodes.has(nodeId)) {
      throw new Error(`Unknown node "${nodeId}" cannot be set as root`);
    }
    this.rootId = nodeId;
  }

  addDependency(parentId, childId) {
    if (!this.nodes.has(parentId)) {
      throw new Error(`Unknown parent node "${parentId}"`);
    }
    if (!this.nodes.has(childId)) {
      throw new Error(`Unknown child node "${childId}"`);
    }
    if (parentId === childId) {
      return;
    }
    const parent = this.nodes.get(parentId);
    const child = this.nodes.get(childId);
    parent.children.add(childId);
    child.parents.add(parentId);
  }

  getNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return null;
    }
    return {
      id: node.id,
      action: node.action,
      summary: node.summary,
      metadata: { ...node.metadata },
      requirements: [...node.requirements],
      parents: [...node.parents],
      children: [...node.children]
    };
  }

  toJSON() {
    return {
      rootId: this.rootId,
      nodes: [...this.nodes.values()].map(node => ({
        id: node.id,
        action: node.action,
        summary: node.summary,
        metadata: { ...node.metadata },
        requirements: [...node.requirements],
        parents: [...node.parents],
        children: [...node.children]
      }))
    };
  }

  static fromJSON(payload) {
    const graph = new TaskGraph();
    if (!payload || typeof payload !== "object" || !Array.isArray(payload.nodes)) {
      return graph;
    }
    for (const node of payload.nodes) {
      const nodeId = graph.addNode({
        id: node.id,
        action: node.action,
        summary: node.summary,
        metadata: node.metadata,
        requirements: node.requirements,
        parents: node.parents,
        children: node.children
      });
      if (payload.rootId && payload.rootId === nodeId) {
        graph.setRoot(nodeId);
      }
    }
    if (payload.rootId && graph.nodes.has(payload.rootId)) {
      graph.setRoot(payload.rootId);
    }
    return graph;
  }

  getReadyNodes(completed = new Set()) {
    const ready = [];
    for (const node of this.nodes.values()) {
      if (completed.has(node.id)) {
        continue;
      }
      const unmet = [...node.parents].some(parentId => !completed.has(parentId));
      if (!unmet) {
        ready.push(node.id);
      }
    }
    return ready;
  }
}

export function createTaskGraph() {
  return new TaskGraph();
}

export function createTaskNode({
  id = null,
  action = "generic",
  summary = "task",
  metadata = {},
  requirements = []
} = {}) {
  return {
    id: id || generateTaskNodeId(action),
    action,
    summary,
    metadata: { ...metadata },
    requirements: Array.isArray(requirements) ? [...requirements] : []
  };
}

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
  notes = [],
  taskGraph = null,
  subTasks = []
}) {
  return {
    action: task.action,
    summary,
    estimatedDuration,
    resources,
    steps: Array.isArray(steps) ? steps : [],
    risks: Array.isArray(risks) ? risks : [],
    notes: Array.isArray(notes) ? notes : [],
    taskGraph: taskGraph instanceof TaskGraph ? taskGraph.toJSON() : taskGraph,
    subTasks: Array.isArray(subTasks) ? cloneSerializable(subTasks) : []
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
