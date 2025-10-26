// tasks/plan_interact.js
// Handles container or block interaction tasks like opening chests
//
// FEATURES:
// - Container interaction planning with safety checks
// - Command injection prevention and input sanitization
// - Permission and ownership verification
// - Trap detection and disarming procedures
// - Smart transfer optimization with multiple strategies
// - Inventory analysis and organization recommendations
// - Container network integration for finding alternatives
// - Upgrade suggestions based on usage patterns
// - Transaction logging for audit trails
// - Support for multiple container types (chest, barrel, shulker, ender chest, etc.)
//
// SECURITY:
// - Input validation on all parameters
// - Safe number conversion preventing NaN issues
// - Command sanitization preventing injection attacks
// - Permission checks before access
// - Trap detection for risky containers
//
// USAGE:
// const plan = planInteractTask({
//   target: { x: 100, y: 64, z: 200 },
//   metadata: {
//     container: "chest",
//     transfer: {
//       take: [{ name: "diamond", count: 5 }],
//       store: [{ name: "cobblestone", count: 64 }]
//     },
//     analyzeContents: true,
//     autoOrganize: true,
//     sortMethod: "by_category"
//   }
// }, context);
//

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

// ============================================================================
// CONTAINER TYPE PROFILES
// ============================================================================

const CONTAINER_PROFILES = {
  chest: {
    slots: 27,
    doubleSlots: 54,
    canHopper: true,
    canComparator: true,
    lockable: true,
    stackable: false,
    accessible_from_top: true
  },
  trapped_chest: {
    slots: 27,
    doubleSlots: 54,
    canHopper: true,
    canComparator: true,
    lockable: true,
    emits_redstone: true,
    trap_warning: true
  },
  barrel: {
    slots: 27,
    stackable: true,
    accessible_from_top: true,
    lockable: true,
    space_efficient: true
  },
  shulker_box: {
    slots: 27,
    portable: true,
    retains_items_when_broken: true,
    color_variants: 16,
    nestable: false,
    requires_silk_touch: false
  },
  ender_chest: {
    slots: 27,
    personal_storage: true,
    accessible_anywhere: true,
    requires: "silk_touch_to_move",
    shared_across_dimension: false
  },
  hopper: {
    slots: 5,
    auto_transfer: true,
    transfer_rate: "2.5s per item",
    can_filter: true
  },
  dropper: {
    slots: 9,
    dispenses_items: true,
    redstone_activated: true
  },
  dispenser: {
    slots: 9,
    dispenses_items: true,
    can_activate_items: true,
    redstone_activated: true
  },
  furnace: {
    slots: 3,
    processes_items: true,
    requires_fuel: true
  },
  brewing_stand: {
    slots: 5,
    brews_potions: true,
    requires_blaze_powder: true
  }
};

/**
 * Get container profile information
 * @param {string} containerType - Type of container
 * @returns {object|null} Container profile or null
 */
function getContainerProfile(containerType) {
  const normalized = normalizeItemName(containerType);
  return CONTAINER_PROFILES[normalized] || null;
}

// ============================================================================
// PERMISSION & OWNERSHIP SYSTEM
// ============================================================================

const LOCK_TYPES = {
  key_lock: { requires: "specific_key", bypass: "lockpick" },
  combination_lock: { requires: "code", bypass: "redstone_engineer" },
  redstone_lock: { requires: "lever_or_button", bypass: "wire_cutting" },
  magic_lock: { requires: "enchanted_key", bypass: "dispel_magic" }
};

/**
 * Check if player has permission to access container
 * @param {object} task - Task object with ownership metadata
 * @param {object} context - Context with player information
 * @returns {object} Permission check result
 */
function checkContainerPermissions(task, context = {}) {
  const ownership = task?.metadata?.ownership;
  const playerName = context?.playerName || context?.player?.name || "unknown";
  const isLocked = task?.metadata?.locked || task?.metadata?.requiresKey;
  const claimedLand = task?.metadata?.claimedLand;
  const isPrivate = task?.metadata?.private;

  const result = {
    hasAccess: true,
    warnings: [],
    requirements: []
  };

  // Check ownership
  if (ownership && ownership !== playerName) {
    result.warnings.push(`Container owned by ${ownership}`);
    if (isPrivate) {
      result.hasAccess = false;
      result.warnings.push("Private container - access denied");
    }
  }

  // Check claimed land
  if (claimedLand && claimedLand !== playerName) {
    result.warnings.push(`Located in ${claimedLand}'s claimed territory`);
    result.requirements.push("Verify land permissions before accessing");
  }

  // Check lock type
  if (isLocked) {
    const lockType = task?.metadata?.lockType || "key_lock";
    const lockInfo = LOCK_TYPES[lockType];
    if (lockInfo) {
      result.requirements.push(`Requires ${lockInfo.requires} to unlock`);
    }
  }

  return result;
}

// ============================================================================
// TRAP DETECTION SYSTEM
// ============================================================================

/**
 * Scan for potential traps around container
 * @param {object} task - Task object with metadata
 * @param {object} context - Context with world information
 * @returns {object} Trap detection result
 */
function detectTraps(task, context = {}) {
  const result = {
    tnt_nearby: task?.metadata?.tntNearby || false,
    redstone_connection: task?.metadata?.redstoneLinked || false,
    pressure_plates: task?.metadata?.pressurePlates || false,
    tripwires: task?.metadata?.tripwires || false,
    observers_watching: task?.metadata?.observers || false,
    lava_above: task?.metadata?.lavaAbove || false,
    risk_level: "safe",
    disarm_steps: []
  };

  // Calculate risk level
  const threats = [
    result.tnt_nearby,
    result.redstone_connection,
    result.pressure_plates,
    result.tripwires,
    result.observers_watching,
    result.lava_above
  ].filter(Boolean).length;

  if (threats === 0) {
    result.risk_level = "safe";
  } else if (threats === 1) {
    result.risk_level = "low";
  } else if (threats === 2) {
    result.risk_level = "medium";
  } else {
    result.risk_level = "high";
  }

  // Generate disarm procedure
  if (result.redstone_connection) {
    result.disarm_steps.push("Cut redstone connections or remove power source");
  }
  if (result.observers_watching) {
    result.disarm_steps.push("Block observer line of sight with solid blocks");
  }
  if (result.pressure_plates) {
    result.disarm_steps.push("Remove or disable pressure plates");
  }
  if (result.tripwires) {
    result.disarm_steps.push("Carefully break tripwire hooks");
  }
  if (result.tnt_nearby) {
    result.disarm_steps.push("Remove or waterlog TNT blocks");
  }
  if (result.lava_above) {
    result.disarm_steps.push("Place barrier blocks above container");
  }

  if (result.disarm_steps.length > 0) {
    result.disarm_steps.push("Test with throwaway item first");
  }

  return result;
}

// ============================================================================
// SMART TRANSFER SYSTEM
// ============================================================================

const TRANSFER_STRATEGIES = {
  quick_stack: {
    description: "Move all matching items to container",
    priority: "consolidation"
  },
  deposit_all: {
    description: "Empty inventory into container",
    priority: "speed"
  },
  smart_sort: {
    description: "Organize by item type",
    priority: "organization"
  },
  fill_missing: {
    description: "Top up incomplete stacks",
    priority: "efficiency"
  },
  take_needed: {
    description: "Withdraw only required items",
    priority: "precision"
  }
};

const ITEM_CATEGORIES = {
  tools: ["pickaxe", "axe", "shovel", "hoe", "sword"],
  food: ["bread", "apple", "carrot", "potato", "beef", "porkchop", "chicken", "fish"],
  blocks: ["stone", "dirt", "wood", "planks", "cobblestone", "glass"],
  ores: ["coal", "iron", "gold", "diamond", "emerald", "lapis", "redstone"],
  valuables: ["diamond", "emerald", "netherite", "ancient_debris", "elytra", "totem"],
  redstone: ["redstone", "repeater", "comparator", "piston", "observer", "hopper"]
};

/**
 * Categorize an item
 * @param {string} itemName - Item name to categorize
 * @returns {string} Category name
 */
function categorizeItem(itemName) {
  if (!itemName || typeof itemName !== "string") {
    return "misc";
  }
  
  for (const [category, items] of Object.entries(ITEM_CATEGORIES)) {
    if (items.some(item => itemName.includes(item))) {
      return category;
    }
  }
  return "misc";
}

/**
 * Optimize transfer operations
 * @param {object} transfer - Transfer object with take/store arrays
 * @param {string} strategy - Transfer strategy to use
 * @returns {object} Optimized transfer plan
 */
function optimizeTransfer(transfer, strategy = "smart_sort") {
  // Safety check for invalid transfer object
  if (!transfer || (!transfer.take && !transfer.store)) {
    return {
      take: [],
      store: [],
      strategy: null,
      estimatedTime: 0
    };
  }

  const strategyInfo = TRANSFER_STRATEGIES[strategy] || TRANSFER_STRATEGIES.smart_sort;

  const optimized = {
    take: Array.isArray(transfer.take) ? [...transfer.take] : [],
    store: Array.isArray(transfer.store) ? [...transfer.store] : [],
    strategy: strategyInfo.description,
    estimatedTime: 0
  };

  // Calculate estimated time (500ms per item operation)
  optimized.estimatedTime = (optimized.take.length + optimized.store.length) * 500;

  // Sort items by category for smart_sort
  if (strategy === "smart_sort" && optimized.store.length > 0) {
    optimized.store.sort((a, b) => {
      const catA = categorizeItem(a?.name || "");
      const catB = categorizeItem(b?.name || "");
      return catA.localeCompare(catB);
    });
  }

  return optimized;
}

// ============================================================================
// CONTAINER NETWORK SYSTEM
// ============================================================================

/**
 * Find nearest container in network
 * @param {object} playerPos - Player position {x, y, z}
 * @param {string} contentType - Type of content to find
 * @param {object} context - Context with container network data
 * @returns {object|null} Nearest container or null
 */
function findNearestContainer(playerPos, contentType, context = {}) {
  const network = context?.containerNetwork || {};
  const containers = network[contentType] || [];

  if (containers.length === 0) {
    return null;
  }

  let nearest = null;
  let minDistance = Infinity;

  for (const container of containers) {
    if (!container.location) continue;

    const [x, y, z] = container.location;
    const distance = Math.sqrt(
      Math.pow(x - playerPos.x, 2) +
      Math.pow(y - playerPos.y, 2) +
      Math.pow(z - playerPos.z, 2)
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearest = { ...container, distance };
    }
  }

  return nearest;
}

// ============================================================================
// INVENTORY ANALYSIS
// ============================================================================

/**
 * Analyze container contents
 * @param {array} contents - Array of items in container
 * @returns {object} Analysis results
 */
function analyzeInventory(contents = []) {
  const analysis = {
    totalItems: 0,
    uniqueItems: 0,
    valuableItems: [],
    emptySlots: 0,
    fullStacks: 0,
    partialStacks: 0,
    organizationScore: 0,
    recommendations: []
  };

  if (!Array.isArray(contents)) {
    return analysis;
  }

  const itemCounts = new Map();
  const maxStackSize = 64; // Most items stack to 64

  contents.forEach(item => {
    if (!item || !item.name) {
      analysis.emptySlots++;
      return;
    }

    const count = item.count || 1;
    analysis.totalItems += count;

    // Track unique items
    if (!itemCounts.has(item.name)) {
      itemCounts.set(item.name, 0);
      analysis.uniqueItems++;
    }
    itemCounts.set(item.name, itemCounts.get(item.name) + count);

    // Check for valuable items
    if (categorizeItem(item.name) === "valuables") {
      analysis.valuableItems.push(item.name);
    }

    // Count stacks
    if (count >= maxStackSize) {
      analysis.fullStacks++;
    } else if (count > 0) {
      analysis.partialStacks++;
    }
  });

  // Calculate organization score (0-100)
  const categoryMap = new Map();
  contents.forEach(item => {
    if (item && item.name) {
      const cat = categorizeItem(item.name);
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    }
  });

  // Higher score for more categorization
  analysis.organizationScore = Math.min(100, categoryMap.size * 20);

  // Generate recommendations
  if (analysis.partialStacks > 3) {
    analysis.recommendations.push("Consolidate partial stacks");
  }
  if (analysis.valuableItems.length > 0) {
    analysis.recommendations.push("Move valuables to ender chest for safety");
  }
  if (analysis.organizationScore < 50) {
    analysis.recommendations.push("Sort items by category for better organization");
  }
  if (analysis.emptySlots < 5) {
    analysis.recommendations.push("Container nearly full - consider expansion");
  }

  return analysis;
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Plan bulk container operations
 * @param {array} containers - Array of container tasks
 * @param {string} operation - Operation type
 * @returns {object} Bulk operation plan
 */
function planBulkOperation(containers, operation = "consolidate") {
  const plan = {
    totalContainers: containers.length,
    operation,
    estimatedDuration: 0,
    steps: [],
    warnings: []
  };

  const maxConcurrent = 5;
  if (containers.length > maxConcurrent) {
    plan.warnings.push(`Processing ${maxConcurrent} containers at a time to avoid overload`);
  }

  plan.estimatedDuration = containers.length * 10000; // 10s per container

  return plan;
}

// ============================================================================
// TRANSACTION HISTORY
// ============================================================================

/**
 * Record a container transaction
 * @param {string} player - Player name
 * @param {string} container - Container type
 * @param {string} action - Action performed
 * @param {array} items - Items affected
 * @param {object} location - Container location
 * @returns {object} Transaction record
 */
function recordTransaction(player, container, action, items, location) {
  return {
    timestamp: Date.now(),
    player,
    container,
    action,
    items: items.map(item => ({
      name: item.name,
      count: item.count || 1
    })),
    location: location ? `${location.x}, ${location.y}, ${location.z}` : "unknown"
  };
}

// ============================================================================
// AUTO-ORGANIZATION
// ============================================================================

const SORTING_METHODS = {
  by_category: "Tools, Food, Blocks, Ores, etc.",
  by_alphabet: "A-Z sorting",
  by_stack_size: "Full stacks first",
  by_value: "Most valuable first",
  by_rarity: "Rare items first"
};

/**
 * Sort container contents
 * @param {array} contents - Items to sort
 * @param {string} method - Sorting method
 * @returns {array} Sorted contents
 */
function sortContainer(contents, method = "by_category") {
  if (!Array.isArray(contents)) {
    return [];
  }

  const sorted = [...contents];

  switch (method) {
    case "by_category":
      sorted.sort((a, b) => {
        const catA = categorizeItem(a.name || "");
        const catB = categorizeItem(b.name || "");
        return catA.localeCompare(catB);
      });
      break;

    case "by_alphabet":
      sorted.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      break;

    case "by_stack_size":
      sorted.sort((a, b) => (b.count || 0) - (a.count || 0));
      break;

    case "by_value":
      sorted.sort((a, b) => {
        const valA = categorizeItem(a.name) === "valuables" ? 1 : 0;
        const valB = categorizeItem(b.name) === "valuables" ? 1 : 0;
        return valB - valA;
      });
      break;

    default:
      break;
  }

  return sorted;
}

// ============================================================================
// CONTAINER UPGRADES
// ============================================================================

const CONTAINER_UPGRADES = {
  chest_to_trapped_chest: {
    requires: ["tripwire_hook"],
    benefit: "Adds redstone signal capability"
  },
  chest_to_ender_chest: {
    requires: ["eye_of_ender", "obsidian"],
    benefit: "Personal storage accessible anywhere"
  },
  add_hopper: {
    requires: ["hopper"],
    benefit: "Enables automation"
  },
  add_comparator: {
    requires: ["redstone_comparator"],
    benefit: "Enables fullness detection"
  },
  chest_to_barrel: {
    requires: ["barrel"],
    benefit: "Space-efficient alternative"
  }
};

/**
 * Suggest container upgrades based on usage
 * @param {string} containerType - Current container type
 * @param {object} usageStats - Usage statistics
 * @returns {array} Upgrade suggestions
 */
function suggestUpgrades(containerType, usageStats = {}) {
  const suggestions = [];
  const accessCount = usageStats.accessCount || 0;
  const isFrequentlyUsed = accessCount > 50;

  if (containerType === "chest" && isFrequentlyUsed) {
    suggestions.push({
      upgrade: "chest_to_ender_chest",
      reason: "Frequently accessed - ender chest provides remote access",
      ...CONTAINER_UPGRADES.chest_to_ender_chest
    });
  }

  if (containerType === "chest" && usageStats.needsAutomation) {
    suggestions.push({
      upgrade: "add_hopper",
      reason: "Automation detected - hopper recommended",
      ...CONTAINER_UPGRADES.add_hopper
    });
  }

  return suggestions;
}

// ============================================================================
// MAIN PLANNING FUNCTION (ENHANCED)
// ============================================================================

/**
 * Plan a container interaction task with comprehensive safety checks and optimization
 * @param {Object} task - The interaction task to plan
 * @param {Object} task.target - Target location (coordinates or description)
 * @param {Object} [task.metadata] - Additional task configuration
 * @param {string} [task.metadata.container] - Container type (chest, barrel, etc.)
 * @param {string} [task.metadata.interaction] - Interaction type (open_container, etc.)
 * @param {Object} [task.metadata.transfer] - Transfer operations {take: [], store: []}
 * @param {string} [task.metadata.requiresKey] - Key item required to unlock
 * @param {string} [task.metadata.holdItem] - Item to hold during interaction
 * @param {number} [task.metadata.duration] - Duration to keep container open (seconds)
 * @param {boolean} [task.metadata.analyzeContents] - Enable inventory analysis
 * @param {boolean} [task.metadata.autoOrganize] - Enable auto-organization
 * @param {string} [task.metadata.sortMethod] - Sorting method (by_category, by_alphabet, etc.)
 * @param {boolean} [task.metadata.recordContents] - Enable content logging
 * @param {boolean} [task.metadata.enableTransactionLog] - Enable transaction logging
 * @param {string} [task.metadata.ownership] - Container owner name
 * @param {boolean} [task.metadata.private] - Whether container is private
 * @param {boolean} [task.metadata.locked] - Whether container is locked
 * @param {string} [task.metadata.lockType] - Type of lock (key_lock, combination_lock, etc.)
 * @param {boolean} [task.metadata.redstoneLinked] - Container has redstone connections
 * @param {boolean} [task.metadata.tntNearby] - TNT detected near container
 * @param {string} [task.metadata.transferStrategy] - Transfer optimization strategy
 * @param {Object} [context={}] - Execution context
 * @param {Object} [context.inventory] - Current inventory
 * @param {string} [context.playerName] - Player name for permissions
 * @param {Object} [context.playerPosition] - Player position {x, y, z}
 * @param {Object} [context.containerNetwork] - Network of linked containers
 * @returns {Object} Interaction plan with steps, resources, risks, and notes
 * @throws {Error} If task or task.target is missing
 */
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

  // ===== ENHANCED SYSTEMS INTEGRATION =====

  // Get container profile information
  const containerProfile = getContainerProfile(container);

  // Check permissions and ownership
  const permissionCheck = checkContainerPermissions(task, context);

  // Detect traps and security threats
  const trapDetection = detectTraps(task, context);

  // Optimize transfer operations
  const transferStrategy = task?.metadata?.transferStrategy || "smart_sort";
  const optimizedTransfer = optimizeTransfer(transfer, transferStrategy);

  // Check for container network alternatives
  let networkSuggestion = null;
  if (task.target && context?.containerNetwork) {
    const playerPos = context?.playerPosition || task.target;
    const contentType = task?.metadata?.contentType;
    if (contentType) {
      networkSuggestion = findNearestContainer(playerPos, contentType, context);
    }
  }

  // Suggest upgrades if usage stats available
  const upgradeSuggestions = suggestUpgrades(container, task?.metadata?.usageStats || {});

  const steps = [];

  // Add permission warnings if needed
  if (!permissionCheck.hasAccess) {
    steps.push(
      createStep({
        title: "Access Denied",
        type: "error",
        description: `Cannot access container: ${permissionCheck.warnings.join(", ")}`,
        metadata: { permissionCheck }
      })
    );
    // Early return if no access
    return createPlan({
      task,
      summary: `Access denied to ${container} at ${targetDescription}.`,
      steps,
      estimatedDuration: 0,
      resources: [],
      risks: permissionCheck.warnings,
      notes: ["Permission check failed - review ownership and access rights"]
    });
  }

  // Add trap disarming steps if threats detected
  if (trapDetection.risk_level !== "safe" && trapDetection.disarm_steps.length > 0) {
    steps.push(
      createStep({
        title: "Disarm traps",
        type: "security",
        description: `Threat level: ${trapDetection.risk_level}. ${trapDetection.disarm_steps.join("; ")}.`,
        metadata: { trapDetection }
      })
    );
  }

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

    const transferDescription = optimizedTransfer.strategy
      ? `Using ${optimizedTransfer.strategy}: ${transferParts.join(" and ")}. Confirm slot counts afterwards.`
      : `Within the ${container}, ${transferParts.join(" and ")}. Confirm slot counts afterwards.`;

    steps.push(
      createStep({
        title: "Manage inventory",
        type: "inventory",
        description: transferDescription,
        metadata: {
          ...transfer,
          optimized: optimizedTransfer,
          estimatedTime: `${optimizedTransfer.estimatedTime}ms`
        }
      })
    );
  }

  // Add inventory analysis step if requested
  if (task?.metadata?.analyzeContents) {
    steps.push(
      createStep({
        title: "Analyze inventory",
        type: "analysis",
        description: `Analyze container contents for organization, valuable items, and optimization opportunities.`,
        metadata: {
          analysisType: "full",
          includeRecommendations: true
        }
      })
    );
  }

  // Add auto-organization step if requested
  if (task?.metadata?.autoOrganize) {
    const sortMethod = task?.metadata?.sortMethod || "by_category";
    const sortDescription = SORTING_METHODS[sortMethod] || "Custom sorting";
    steps.push(
      createStep({
        title: "Organize container",
        type: "organization",
        description: `Sort container contents: ${sortDescription}`,
        metadata: {
          sortMethod,
          description: sortDescription
        }
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

  // Add trap-related risks
  if (trapDetection.risk_level === "high") {
    risks.push(`HIGH THREAT: Multiple traps detected (${trapDetection.risk_level})`);
  } else if (trapDetection.risk_level === "medium") {
    risks.push(`CAUTION: Moderate trap threat detected`);
  } else if (trapDetection.risk_level === "low") {
    risks.push(`Low trap threat detected - proceed carefully`);
  }

  // Add permission warnings
  if (permissionCheck.warnings.length > 0) {
    risks.push(...permissionCheck.warnings);
  }

  // Legacy trap detection
  if (task?.metadata?.redstoneLinked && trapDetection.risk_level === "safe") {
    risks.push("Redstone linkage may trigger traps when opened.");
  }

  const notes = [];

  // Container profile information
  if (containerProfile) {
    const profileInfo = [];
    if (containerProfile.slots) {
      profileInfo.push(`${containerProfile.slots} slots`);
    }
    if (containerProfile.portable) {
      profileInfo.push("portable");
    }
    if (containerProfile.personal_storage) {
      profileInfo.push("personal storage");
    }
    if (containerProfile.auto_transfer) {
      profileInfo.push(`auto-transfer (${containerProfile.transfer_rate})`);
    }
    if (profileInfo.length > 0) {
      notes.push(`Container specs: ${profileInfo.join(", ")}`);
    }
  }

  // Ownership notes
  if (task?.metadata?.ownership) {
    notes.push(`Container owned by ${task.metadata.ownership}; ensure permissions before interacting.`);
  }

  // Permission requirements
  if (permissionCheck.requirements.length > 0) {
    notes.push(...permissionCheck.requirements.map(req => `Permission: ${req}`));
  }

  // Network suggestions
  if (networkSuggestion) {
    notes.push(
      `Alternative: ${networkSuggestion.id} at distance ${Math.round(networkSuggestion.distance)} blocks`
    );
  }

  // Upgrade suggestions
  if (upgradeSuggestions.length > 0) {
    upgradeSuggestions.forEach(suggestion => {
      notes.push(
        `Upgrade suggestion: ${suggestion.upgrade} - ${suggestion.reason} (requires: ${suggestion.requires.join(", ")})`
      );
    });
  }

  // Transfer strategy note
  if (optimizedTransfer.strategy && (transfer.take.length > 0 || transfer.store.length > 0)) {
    notes.push(`Transfer strategy: ${optimizedTransfer.strategy}`);
  }

  // Transaction logging
  const playerName = context?.playerName || context?.player?.name || "player";
  const transactionItems = [...transfer.take, ...transfer.store];
  const transactionAction = transfer.take.length > 0 && transfer.store.length > 0
    ? "transfer"
    : transfer.take.length > 0
    ? "withdraw"
    : "deposit";

  if (transactionItems.length > 0 && task?.metadata?.enableTransactionLog) {
    const transaction = recordTransaction(
      playerName,
      container,
      transactionAction,
      transactionItems,
      task.target
    );
    notes.push(`Transaction logged: ${transaction.action} ${transactionItems.length} item types at ${transaction.timestamp}`);
  }

  // Calculate enhanced estimated duration
  let estimatedDuration = duration
    ? duration * 1000 + INTERACTION_BUFFER_MS
    : DEFAULT_INTERACTION_DURATION_MS;

  // Add time for trap disarming
  if (trapDetection.disarm_steps.length > 0) {
    estimatedDuration += trapDetection.disarm_steps.length * 2000; // 2s per disarm step
  }

  // Add optimized transfer time
  if (optimizedTransfer.estimatedTime > 0) {
    estimatedDuration += optimizedTransfer.estimatedTime;
  }

  return createPlan({
    task,
    summary: `Interact with ${container} at ${targetDescription}.`,
    steps,
    estimatedDuration,
    resources,
    risks,
    notes,
    metadata: {
      containerProfile,
      permissionCheck,
      trapDetection,
      optimizedTransfer,
      networkSuggestion,
      upgradeSuggestions
    }
  });
}
