// ai/navigation.js
// Provides navigation utilities for NPC movement including elevation, liquid, and hazard reasoning.

const DEFAULT_CELL = {
  walkable: true,
  elevation: 0,
  liquid: null,
  hazards: []
};

function coordKey(x, y, z) {
  return `${Math.trunc(x)},${Math.trunc(y)},${Math.trunc(z)}`;
}

function normalizeHazards(hazards) {
  if (!Array.isArray(hazards)) return [];
  return hazards
    .filter(h => h && typeof h === "object")
    .map(h => ({
      type: typeof h.type === "string" ? h.type : "unknown",
      severity: typeof h.severity === "string" ? h.severity : "moderate",
      description: typeof h.description === "string" ? h.description : null
    }));
}

export class NavigationGrid {
  constructor() {
    this.cells = new Map();
  }

  setCell(position, data = {}) {
    if (!position) return;
    const key = coordKey(position.x, position.y, position.z);
    const normalized = {
      ...DEFAULT_CELL,
      ...data
    };
    normalized.walkable = data.walkable !== false;
    normalized.elevation = Number.isFinite(data.elevation)
      ? data.elevation
      : position.y ?? 0;
    normalized.liquid = typeof data.liquid === "string" ? data.liquid : null;
    normalized.hazards = normalizeHazards(data.hazards);
    this.cells.set(key, normalized);
  }

  getCell(position) {
    if (!position) return DEFAULT_CELL;
    const key = coordKey(position.x, position.y, position.z);
    return this.cells.get(key) || {
      ...DEFAULT_CELL,
      elevation: position.y ?? 0
    };
  }

  markHazard(position, hazard) {
    if (!position) return;
    const cell = { ...this.getCell(position) };
    const hazards = normalizeHazards([hazard, ...cell.hazards]);
    this.setCell(position, { ...cell, hazards });
  }

  isWalkable(position) {
    const cell = this.getCell(position);
    return cell.walkable && !cell.hazards.some(h => h.severity === "critical");
  }

  getNeighbors(position) {
    const deltas = [
      { x: 1, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: -1 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: -1, z: 0 }
    ];

    return deltas
      .map(delta => ({
        x: position.x + delta.x,
        y: position.y + delta.y,
        z: position.z + delta.z
      }))
      .filter(pos => this.isWalkable(pos));
  }
}

function heuristic(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
}

function stepCost(grid, from, to) {
  const fromCell = grid.getCell(from);
  const toCell = grid.getCell(to);
  const elevationDelta = Math.abs((toCell.elevation ?? to.y) - (fromCell.elevation ?? from.y));
  let cost = 1 + elevationDelta * 0.5;

  if (toCell.liquid) {
    cost += 3;
  }

  if (toCell.hazards.length > 0) {
    cost += toCell.hazards.reduce((sum, hazard) => {
      const multiplier = hazard.severity === "critical" ? 5 : hazard.severity === "high" ? 3 : hazard.severity === "low" ? 1 : 2;
      return sum + multiplier;
    }, 0);
  }

  return cost;
}

export function planPath(grid, start, goal, { allowWater = false } = {}) {
  if (!grid || !start || !goal) {
    return null;
  }

  const startKey = coordKey(start.x, start.y, start.z);
  const goalKey = coordKey(goal.x, goal.y, goal.z);

  const openSet = new Map([[startKey, { position: start, g: 0, f: heuristic(start, goal), parent: null }]]);
  const closedSet = new Set();

  while (openSet.size > 0) {
    let currentKey = null;
    let currentNode = null;

    for (const [key, node] of openSet.entries()) {
      if (!currentNode || node.f < currentNode.f) {
        currentNode = node;
        currentKey = key;
      }
    }

    if (!currentNode) break;

    if (currentKey === goalKey) {
      const path = [];
      let node = currentNode;
      while (node) {
        const cell = grid.getCell(node.position);
        path.unshift({
          x: node.position.x,
          y: node.position.y,
          z: node.position.z,
          elevation: cell.elevation,
          liquid: cell.liquid,
          hazards: Array.isArray(cell.hazards)
            ? cell.hazards.map(hazard => ({ ...hazard }))
            : []
        });
        node = node.parent;
      }
      return path;
    }

    openSet.delete(currentKey);
    closedSet.add(currentKey);

    const neighbors = grid.getNeighbors(currentNode.position).filter(pos => {
      const cell = grid.getCell(pos);
      if (!cell.walkable) return false;
      if (!allowWater && cell.liquid) return false;
      return true;
    });

    for (const neighbor of neighbors) {
      const neighborKey = coordKey(neighbor.x, neighbor.y, neighbor.z);
      if (closedSet.has(neighborKey)) {
        continue;
      }

      const tentativeG = currentNode.g + stepCost(grid, currentNode.position, neighbor);
      const existing = openSet.get(neighborKey);

      if (!existing || tentativeG < existing.g) {
        openSet.set(neighborKey, {
          position: neighbor,
          g: tentativeG,
          f: tentativeG + heuristic(neighbor, goal),
          parent: currentNode
        });
      }
    }
  }

  return null;
}

export function analyzePath(path) {
  if (!Array.isArray(path) || path.length === 0) {
    return {
      path: [],
      elevationGain: 0,
      elevationDrop: 0,
      liquidSegments: 0,
      hazards: [],
      estimatedCost: 0
    };
  }

  let elevationGain = 0;
  let elevationDrop = 0;
  let liquidSegments = 0;
  let estimatedCost = 0;
  const hazards = [];

  for (let i = 0; i < path.length; i += 1) {
    const step = path[i];
    if (i > 0) {
      const prev = path[i - 1];
      const delta = (step.elevation ?? step.y) - (prev.elevation ?? prev.y);
      if (delta > 0) elevationGain += delta;
      if (delta < 0) elevationDrop += Math.abs(delta);
      estimatedCost += 1 + Math.abs(delta) * 0.5;
    }

    if (step.liquid) {
      liquidSegments += 1;
      estimatedCost += 3;
    }

    if (Array.isArray(step.hazards) && step.hazards.length > 0) {
      hazards.push(
        ...step.hazards.map(hazard => ({
          ...hazard,
          location: { x: step.x, y: step.y, z: step.z }
        }))
      );
      estimatedCost += step.hazards.reduce((sum, hazard) => {
        if (hazard.severity === "critical") return sum + 5;
        if (hazard.severity === "high") return sum + 3;
        if (hazard.severity === "low") return sum + 1;
        return sum + 2;
      }, 0);
    }
  }

  return {
    path,
    elevationGain,
    elevationDrop,
    liquidSegments,
    hazards,
    estimatedCost
  };
}

export function summarizeNavigation(grid, start, goal, options = {}) {
  const path = planPath(grid, start, goal, options);
  if (!path) {
    return {
      path: [],
      elevationGain: 0,
      elevationDrop: 0,
      liquidSegments: 0,
      hazards: [],
      estimatedCost: Infinity,
      viable: false
    };
  }

  const analysis = analyzePath(path);
  return {
    ...analysis,
    viable: true
  };
}
