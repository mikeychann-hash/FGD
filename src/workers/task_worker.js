import { parentPort, workerData } from 'worker_threads';

/**
 * Worker thread for CPU-intensive tasks
 * Handles pathfinding, AI calculations, etc.
 */

const workerId = workerData.workerId;

/**
 * A* Pathfinding implementation
 */
function aStar(start, goal, obstacles) {
  // Simple A* pathfinding algorithm
  const openSet = [start];
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();

  gScore.set(keyFor(start), 0);
  fScore.set(keyFor(start), heuristic(start, goal));

  while (openSet.length > 0) {
    // Get node with lowest fScore
    const current = openSet.reduce((lowest, node) =>
      fScore.get(keyFor(node)) < fScore.get(keyFor(lowest)) ? node : lowest
    );

    // Check if goal reached
    if (current.x === goal.x && current.y === goal.y && current.z === goal.z) {
      return reconstructPath(cameFrom, current);
    }

    // Remove current from openSet
    const index = openSet.findIndex((n) => keyFor(n) === keyFor(current));
    openSet.splice(index, 1);

    // Check neighbors
    const neighbors = getNeighbors(current);
    for (const neighbor of neighbors) {
      if (isObstacle(neighbor, obstacles)) {
        continue;
      }

      const tentativeGScore = gScore.get(keyFor(current)) + 1;
      const neighborKey = keyFor(neighbor);

      if (!gScore.has(neighborKey) || tentativeGScore < gScore.get(neighborKey)) {
        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentativeGScore);
        fScore.set(neighborKey, tentativeGScore + heuristic(neighbor, goal));

        if (!openSet.find((n) => keyFor(n) === neighborKey)) {
          openSet.push(neighbor);
        }
      }
    }

    // Prevent infinite loops
    if (openSet.length > 1000) {
      return null; // Path too complex
    }
  }

  return null; // No path found
}

function heuristic(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
}

function keyFor(pos) {
  return `${pos.x},${pos.y},${pos.z}`;
}

function getNeighbors(pos) {
  return [
    { x: pos.x + 1, y: pos.y, z: pos.z },
    { x: pos.x - 1, y: pos.y, z: pos.z },
    { x: pos.x, y: pos.y + 1, z: pos.z },
    { x: pos.x, y: pos.y - 1, z: pos.z },
    { x: pos.x, y: pos.y, z: pos.z + 1 },
    { x: pos.x, y: pos.y, z: pos.z - 1 },
  ];
}

function isObstacle(pos, obstacles) {
  return obstacles.some((obs) => obs.x === pos.x && obs.y === pos.y && obs.z === pos.z);
}

function reconstructPath(cameFrom, current) {
  const path = [current];
  let currentKey = keyFor(current);

  while (cameFrom.has(currentKey)) {
    current = cameFrom.get(currentKey);
    path.unshift(current);
    currentKey = keyFor(current);
  }

  return path;
}

/**
 * Calculate optimal mining strategy
 */
function calculateMiningStrategy(resources, botPosition, efficiency) {
  const scored = resources.map((resource) => {
    const distance = heuristic(botPosition, resource.position);
    const value = resource.value || 1;
    const score = (value * efficiency) / (distance + 1);

    return {
      ...resource,
      distance,
      score,
    };
  });

  // Sort by score (highest first)
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 10); // Top 10 targets
}

/**
 * Process task based on type
 */
function processTask(task) {
  switch (task.type) {
    case 'pathfinding':
      return aStar(task.start, task.goal, task.obstacles || []);

    case 'miningStrategy':
      return calculateMiningStrategy(task.resources, task.botPosition, task.efficiency || 1.0);

    case 'calculation':
      // Generic heavy calculation
      return performCalculation(task.data);

    default:
      throw new Error(`Unknown task type: ${task.type}`);
  }
}

function performCalculation(data) {
  // Placeholder for generic calculations
  // Can be extended based on needs
  return data;
}

/**
 * Message handler
 */
parentPort.on('message', async (task) => {
  try {
    const startTime = Date.now();
    const result = processTask(task);
    const duration = Date.now() - startTime;

    parentPort.postMessage({
      success: true,
      data: result,
      taskId: task.id,
      duration,
      workerId,
    });
  } catch (error) {
    parentPort.postMessage({
      success: false,
      error: error.message,
      taskId: task.id,
      workerId,
    });
  }
});
