// tasks/craft_workspace_manager.js
// Workspace layout and station management system

import { normalizeItemName } from "./helpers.js";

// Workspace efficiency multipliers based on layout
export const WORKSPACE_EFFICIENCY = {
  organized: {
    name: "Organized",
    description: "All stations within 5 blocks",
    timeMultiplier: 0.8, // 20% faster
    conditions: { maxDistance: 5 },
    bonus: "Minimal travel time between stations"
  },
  compact: {
    name: "Compact",
    description: "Stations within 10 blocks",
    timeMultiplier: 0.9, // 10% faster
    conditions: { maxDistance: 10 },
    bonus: "Quick access to most stations"
  },
  scattered: {
    name: "Scattered",
    description: "Stations spread out (10-20 blocks)",
    timeMultiplier: 1.1, // 10% slower
    conditions: { maxDistance: 20 },
    penalty: "Moderate travel time"
  },
  disorganized: {
    name: "Disorganized",
    description: "Stations >20 blocks apart",
    timeMultiplier: 1.3, // 30% slower
    conditions: { maxDistance: Infinity },
    penalty: "Significant travel time between stations"
  }
};

// Optimal workshop layouts
export const WORKSHOP_LAYOUTS = {
  beginner: {
    name: "Beginner Workshop",
    stations: ["crafting_table", "furnace", "chest"],
    layout: "L-shape with chest in corner",
    footprint: "3x3 blocks",
    description: "Basic setup for early game crafting"
  },
  intermediate: {
    name: "Intermediate Workshop",
    stations: ["crafting_table", "furnace", "furnace", "anvil", "chest", "chest"],
    layout: "U-shape with storage wall",
    footprint: "5x5 blocks",
    description: "Expanded setup with dual furnaces"
  },
  advanced: {
    name: "Advanced Crafting Hall",
    stations: ["crafting_table", "furnace_array_8", "anvil", "smithing_table", "grindstone", "storage_wall"],
    layout: "Production line with input/output zones",
    footprint: "10x8 blocks",
    description: "Full crafting facility with automation support"
  },
  automated: {
    name: "Automated Factory",
    stations: ["autocrafter", "furnace_array_16", "storage_system", "sorting_system"],
    layout: "Redstone-powered assembly line",
    footprint: "15x10 blocks",
    description: "Fully automated production with hoppers and redstone"
  }
};

/**
 * Detect nearby crafting stations
 * @param {Object} playerPosition - Player's coordinates {x, y, z}
 * @param {Array} blocks - Array of nearby blocks with positions
 * @param {number} radius - Search radius (default: 50)
 * @returns {Object} Detected stations with distances
 */
export function detectNearbyStations(playerPosition, blocks = [], radius = 50) {
  if (!playerPosition || !playerPosition.x || !playerPosition.y || !playerPosition.z) {
    return { error: "Valid player position required {x, y, z}" };
  }

  if (!Number.isFinite(radius) || radius <= 0) {
    radius = 50;
  }

  const stations = {
    crafting_tables: [],
    furnaces: [],
    anvils: [],
    smithing_tables: [],
    brewing_stands: [],
    enchanting_tables: [],
    grindstones: [],
    stonecutters: [],
    looms: [],
    blast_furnaces: [],
    smokers: [],
    chests: [],
    barrels: []
  };

  // If blocks array is provided, search through it
  if (Array.isArray(blocks)) {
    for (const block of blocks) {
      if (!block.type || !block.position) continue;

      const distance = calculateDistance(playerPosition, block.position);

      if (distance > radius) continue;

      const blockType = normalizeItemName(block.type);
      const stationKey = `${blockType}s`;

      if (stations.hasOwnProperty(stationKey)) {
        stations[stationKey].push({
          position: block.position,
          distance: Math.round(distance * 10) / 10,
          active: block.active || false,
          metadata: block.metadata || {}
        });
      } else if (blockType === "crafting_table") {
        stations.crafting_tables.push({
          position: block.position,
          distance: Math.round(distance * 10) / 10
        });
      } else if (blockType === "chest") {
        stations.chests.push({
          position: block.position,
          distance: Math.round(distance * 10) / 10,
          type: block.metadata?.type || "regular"
        });
      }
    }
  }

  // Sort each station type by distance
  for (const key in stations) {
    stations[key].sort((a, b) => a.distance - b.distance);
  }

  const totalStations = Object.values(stations).reduce((sum, arr) => sum + arr.length, 0);

  return {
    playerPosition: playerPosition,
    searchRadius: radius,
    stations: stations,
    totalStations: totalStations,
    nearestStation: findNearestStation(stations),
    efficiency: assessWorkspaceEfficiency(stations)
  };
}

/**
 * Calculate 3D distance between two points
 * @param {Object} pos1 - Position {x, y, z}
 * @param {Object} pos2 - Position {x, y, z}
 * @returns {number} Distance
 */
function calculateDistance(pos1, pos2) {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Find the nearest station of any type
 * @param {Object} stations - Stations object
 * @returns {Object|null} Nearest station
 */
function findNearestStation(stations) {
  let nearest = null;
  let minDistance = Infinity;

  for (const [type, stationList] of Object.entries(stations)) {
    if (stationList.length > 0 && stationList[0].distance < minDistance) {
      minDistance = stationList[0].distance;
      nearest = {
        type: type.replace(/s$/, ""),
        ...stationList[0]
      };
    }
  }

  return nearest;
}

/**
 * Assess workspace efficiency based on station layout
 * @param {Object} stations - Detected stations
 * @returns {Object} Efficiency assessment
 */
function assessWorkspaceEfficiency(stations) {
  const allStations = [];

  for (const stationList of Object.values(stations)) {
    allStations.push(...stationList);
  }

  if (allStations.length === 0) {
    return {
      tier: "none",
      message: "No crafting stations detected nearby"
    };
  }

  // Calculate max distance between stations
  let maxDistance = 0;
  for (let i = 0; i < allStations.length; i++) {
    for (let j = i + 1; j < allStations.length; j++) {
      const dist = calculateDistance(allStations[i].position, allStations[j].position);
      maxDistance = Math.max(maxDistance, dist);
    }
  }

  let efficiency = WORKSPACE_EFFICIENCY.disorganized;

  for (const [key, effData] of Object.entries(WORKSPACE_EFFICIENCY)) {
    if (maxDistance <= effData.conditions.maxDistance) {
      efficiency = effData;
      break;
    }
  }

  return {
    tier: efficiency.name,
    maxStationDistance: Math.round(maxDistance * 10) / 10,
    timeMultiplier: efficiency.timeMultiplier,
    description: efficiency.description,
    bonus: efficiency.bonus || null,
    penalty: efficiency.penalty || null,
    recommendation: maxDistance > 10
      ? "Consider reorganizing stations closer together for faster crafting"
      : "Workspace layout is efficient"
  };
}

/**
 * Suggest optimal workspace layout
 * @param {Array} availableStations - Stations player wants to place
 * @param {string} layoutType - beginner, intermediate, advanced, automated
 * @returns {Object} Layout suggestion
 */
export function suggestWorkspaceLayout(availableStations = [], layoutType = "intermediate") {
  const layout = WORKSHOP_LAYOUTS[layoutType];

  if (!layout) {
    return {
      error: `Unknown layout type: ${layoutType}`,
      availableLayouts: Object.keys(WORKSHOP_LAYOUTS)
    };
  }

  const suggestions = [
    {
      priority: 1,
      suggestion: "Place crafting table in center for easy access",
      stations: ["crafting_table"],
      reason: "Most frequently used station"
    },
    {
      priority: 2,
      suggestion: "Group furnaces together for smelting array",
      stations: ["furnace"],
      reason: "Allows parallel processing"
    },
    {
      priority: 3,
      suggestion: "Keep storage chests accessible from all stations",
      stations: ["chest"],
      reason: "Minimizes inventory management time"
    },
    {
      priority: 4,
      suggestion: "Place anvil and grindstone near armor/tool storage",
      stations: ["anvil", "grindstone"],
      reason: "Repair tools efficiently"
    },
    {
      priority: 5,
      suggestion: "Position enchanting table with bookshelves for max level",
      stations: ["enchanting_table"],
      reason: "Requires 15 bookshelves in 5x5 area"
    }
  ];

  const hopperSuggestions = layoutType === "automated"
    ? [
        "Use hoppers to connect chests to furnaces for auto-input",
        "Connect furnace output to collection chest via hopper",
        "Add hopper filter for automatic item sorting"
      ]
    : [
        "Consider adding hoppers for future automation",
        "Hopper can collect furnace output automatically"
      ];

  return {
    layoutType: layoutType,
    layoutName: layout.name,
    description: layout.description,
    requiredStations: layout.stations,
    footprint: layout.footprint,
    layout: layout.layout,
    suggestions: suggestions,
    hopperSuggestions: hopperSuggestions,
    materialEstimate: estimateMaterialsForLayout(layout),
    recommendation: `Build a ${layout.name} with a ${layout.footprint} footprint`
  };
}

/**
 * Estimate materials needed for a workshop layout
 * @param {Object} layout - Workshop layout
 * @returns {Object} Material requirements
 */
function estimateMaterialsForLayout(layout) {
  const materials = {
    planks: 0,
    cobblestone: 0,
    iron_ingots: 0,
    obsidian: 0,
    books: 0,
    redstone: 0
  };

  for (const station of layout.stations) {
    if (station.includes("crafting_table")) {
      materials.planks += 4;
    } else if (station.includes("furnace")) {
      const count = station.match(/\d+/) ? parseInt(station.match(/\d+/)[0]) : 1;
      materials.cobblestone += 8 * count;
    } else if (station.includes("anvil")) {
      materials.iron_ingots += 31;
    } else if (station.includes("chest")) {
      materials.planks += 8;
    } else if (station.includes("enchanting_table")) {
      materials.obsidian += 4;
      materials.diamond += 2;
      materials.books += 1;
    } else if (station.includes("autocrafter")) {
      materials.iron_ingots += 2;
      materials.redstone += 5;
      materials.planks += 4;
    }
  }

  return materials;
}

/**
 * Analyze workspace for bottlenecks
 * @param {Object} stations - Detected stations
 * @param {Object} taskRequirements - Required station types for task
 * @returns {Object} Bottleneck analysis
 */
export function analyzeWorkspaceBottlenecks(stations, taskRequirements = {}) {
  const bottlenecks = [];
  const missing = [];

  for (const [stationType, required] of Object.entries(taskRequirements)) {
    const available = stations[stationType] ? stations[stationType].length : 0;

    if (available === 0) {
      missing.push({
        station: stationType,
        required: required,
        available: 0,
        severity: "critical"
      });
    } else if (available < required) {
      bottlenecks.push({
        station: stationType,
        required: required,
        available: available,
        shortage: required - available,
        severity: "medium"
      });
    }
  }

  return {
    bottlenecks: bottlenecks,
    missing: missing,
    hasIssues: bottlenecks.length > 0 || missing.length > 0,
    recommendation: missing.length > 0
      ? `Critical: Build ${missing.map(m => `${m.required}x ${m.station}`).join(", ")}`
      : bottlenecks.length > 0
      ? `Consider adding ${bottlenecks.map(b => `${b.shortage} more ${b.station}`).join(", ")}`
      : "Workspace has sufficient stations for this task"
  };
}

/**
 * Calculate time savings from workspace optimization
 * @param {Object} currentLayout - Current workspace state
 * @param {Object} optimizedLayout - Proposed optimized layout
 * @returns {Object} Time savings estimate
 */
export function calculateWorkspaceOptimizationSavings(currentLayout, optimizedLayout) {
  const currentMultiplier = currentLayout.efficiency?.timeMultiplier || 1.0;
  const optimizedMultiplier = optimizedLayout.efficiency?.timeMultiplier || 1.0;

  const baseTaskTime = 300; // 5 minutes baseline
  const currentTime = baseTaskTime * currentMultiplier;
  const optimizedTime = baseTaskTime * optimizedMultiplier;
  const timeSaved = currentTime - optimizedTime;
  const percentImprovement = ((timeSaved / currentTime) * 100).toFixed(1);

  return {
    current: {
      efficiency: currentLayout.efficiency?.tier || "unknown",
      timeMultiplier: currentMultiplier,
      estimatedTaskTime: Math.round(currentTime)
    },
    optimized: {
      efficiency: optimizedLayout.efficiency?.tier || "organized",
      timeMultiplier: optimizedMultiplier,
      estimatedTaskTime: Math.round(optimizedTime)
    },
    savings: {
      timeSavedSeconds: Math.round(timeSaved),
      percentImprovement: `${percentImprovement}%`,
      worthIt: timeSaved > 30
    },
    recommendation: timeSaved > 30
      ? `Reorganizing workspace will save ${Math.round(timeSaved)}s per crafting session (${percentImprovement}% faster)`
      : "Current workspace is already efficient"
  };
}

/**
 * Get layout suggestions for specific tasks
 * @param {string} taskType - Type of task (mass_smelting, enchanting, etc.)
 * @returns {Object} Task-specific layout advice
 */
export function getTaskSpecificLayout(taskType) {
  const layouts = {
    mass_smelting: {
      stations: ["furnace_array", "chest_input", "chest_output", "chest_fuel"],
      layout: "Linear array with hopper connections",
      tips: [
        "Build 8+ furnaces in a line",
        "Use hoppers to auto-feed fuel from below",
        "Connect output hoppers to collection chest",
        "Keep fuel chest nearby"
      ],
      efficiency: "Can smelt 8x faster with 8 furnaces"
    },
    enchanting: {
      stations: ["enchanting_table", "bookshelf_15", "anvil", "chest"],
      layout: "Enchanting room with bookshelf walls",
      tips: [
        "Place 15 bookshelves within 2 blocks of enchanting table",
        "Leave 1-block gap between table and shelves",
        "Position anvil nearby for combining books",
        "Store books and lapis in adjacent chest"
      ],
      efficiency: "Max level enchantments (level 30)"
    },
    potion_brewing: {
      stations: ["brewing_stand", "chest_ingredients", "chest_bottles", "cauldron"],
      layout: "Compact brewing station",
      tips: [
        "Place brewing stand in center",
        "Store bottles and blaze powder nearby",
        "Use cauldron for water bottles",
        "Organize ingredients by potion type"
      ],
      efficiency: "Brew 3 potions per batch"
    },
    tool_maintenance: {
      stations: ["anvil", "grindstone", "smithing_table", "chest_tools"],
      layout: "Tool workshop",
      tips: [
        "Group anvil and grindstone together",
        "Keep tool storage chest accessible",
        "Place smithing table for netherite upgrades",
        "Store repair materials nearby"
      ],
      efficiency: "Quick tool repair and upgrades"
    }
  };

  const layout = layouts[taskType];

  if (!layout) {
    return {
      error: `Unknown task type: ${taskType}`,
      availableTasks: Object.keys(layouts)
    };
  }

  return {
    taskType: taskType,
    ...layout,
    recommendation: `Set up a dedicated ${taskType.replace(/_/g, " ")} area for ${layout.efficiency}`
  };
}
