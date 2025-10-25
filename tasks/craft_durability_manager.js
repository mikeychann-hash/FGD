// tasks/craft_durability_manager.js
// Tool durability tracking and management system

import { normalizeItemName } from "./helpers.js";
import { getRecipe } from "./craft_recipe_database.js";

// Comprehensive tool durability values
export const TOOL_DURABILITIES = {
  // Pickaxes
  wooden_pickaxe: 59,
  stone_pickaxe: 131,
  iron_pickaxe: 250,
  golden_pickaxe: 32,
  diamond_pickaxe: 1561,
  netherite_pickaxe: 2031,

  // Swords
  wooden_sword: 59,
  stone_sword: 131,
  iron_sword: 250,
  golden_sword: 32,
  diamond_sword: 1561,
  netherite_sword: 2031,

  // Axes
  wooden_axe: 59,
  stone_axe: 131,
  iron_axe: 250,
  golden_axe: 32,
  diamond_axe: 1561,
  netherite_axe: 2031,

  // Shovels
  wooden_shovel: 59,
  stone_shovel: 131,
  iron_shovel: 250,
  golden_shovel: 32,
  diamond_shovel: 1561,
  netherite_shovel: 2031,

  // Hoes
  wooden_hoe: 59,
  stone_hoe: 131,
  iron_hoe: 250,
  golden_hoe: 32,
  diamond_hoe: 1561,
  netherite_hoe: 2031,

  // Other Tools
  shears: 238,
  fishing_rod: 64,
  flint_and_steel: 64,
  bow: 384,
  crossbow: 326,
  trident: 250,
  elytra: 432,
  shield: 336,
  carrot_on_a_stick: 25,
  warped_fungus_on_a_stick: 100,

  // Armor - Leather
  leather_helmet: 55,
  leather_chestplate: 80,
  leather_leggings: 75,
  leather_boots: 65,

  // Armor - Chainmail
  chainmail_helmet: 165,
  chainmail_chestplate: 240,
  chainmail_leggings: 225,
  chainmail_boots: 195,

  // Armor - Iron
  iron_helmet: 165,
  iron_chestplate: 240,
  iron_leggings: 225,
  iron_boots: 195,

  // Armor - Golden
  golden_helmet: 77,
  golden_chestplate: 112,
  golden_leggings: 105,
  golden_boots: 91,

  // Armor - Diamond
  diamond_helmet: 363,
  diamond_chestplate: 528,
  diamond_leggings: 495,
  diamond_boots: 429,

  // Armor - Netherite
  netherite_helmet: 407,
  netherite_chestplate: 592,
  netherite_leggings: 555,
  netherite_boots: 481
};

// Tool tier progression
export const TOOL_TIERS = {
  wooden: { durability: 59, efficiency: 2.0, level: 0 },
  stone: { durability: 131, efficiency: 4.0, level: 1 },
  iron: { durability: 250, efficiency: 6.0, level: 2 },
  golden: { durability: 32, efficiency: 12.0, level: 0, note: "Fast but fragile" },
  diamond: { durability: 1561, efficiency: 8.0, level: 3 },
  netherite: { durability: 2031, efficiency: 9.0, level: 4 }
};

// Enchantment durability bonuses
export const UNBREAKING_BONUS = {
  1: 2.0,  // Average durability x2
  2: 3.0,  // Average durability x3
  3: 4.0   // Average durability x4
};

/**
 * Get maximum durability for a tool
 * @param {string} tool - Tool name
 * @returns {number} Maximum durability
 */
export function getMaxDurability(tool) {
  const normalized = normalizeItemName(tool);
  return TOOL_DURABILITIES[normalized] || 0;
}

/**
 * Check if tool can complete a number of operations
 * @param {Object} tool - Tool object with name and current durability
 * @param {number} operations - Number of operations needed
 * @returns {Object} Durability check results
 */
export function checkToolDurability(tool, operations) {
  if (!tool || !tool.name) {
    return { error: "Valid tool object required with name property" };
  }

  if (!Number.isFinite(operations) || operations <= 0) {
    operations = 1;
  }

  const normalized = normalizeItemName(tool.name);
  const maxDurability = getMaxDurability(normalized);

  if (maxDurability === 0) {
    return {
      error: `Unknown tool: ${normalized}`,
      suggestion: "Check tool name or add to durability database"
    };
  }

  const currentDurability = tool.durability || maxDurability;
  const unbreakingLevel = tool.unbreaking || 0;

  // Calculate effective durability with Unbreaking enchantment
  const effectiveDurability = unbreakingLevel > 0
    ? currentDurability * (UNBREAKING_BONUS[unbreakingLevel] || 1)
    : currentDurability;

  const canComplete = effectiveDurability >= operations;
  const needsRepair = currentDurability < operations * 1.2; // 20% buffer
  const backupNeeded = currentDurability < operations * 0.5; // 50% threshold
  const remainingAfter = Math.max(0, currentDurability - operations);
  const remainingPercentage = (remainingAfter / maxDurability * 100).toFixed(1);

  return {
    tool: normalized,
    currentDurability: currentDurability,
    maxDurability: maxDurability,
    operations: operations,
    unbreakingLevel: unbreakingLevel,
    effectiveDurability: Math.floor(effectiveDurability),
    canComplete: canComplete,
    needsRepair: needsRepair,
    backupNeeded: backupNeeded,
    remainingAfter: remainingAfter,
    remainingPercentage: `${remainingPercentage}%`,
    status: canComplete
      ? backupNeeded
        ? "caution"
        : "ok"
      : "insufficient",
    recommendation: canComplete
      ? backupNeeded
        ? `Tool will survive but consider having a backup (${remainingPercentage}% remaining after)`
        : `Tool is sufficient (${remainingPercentage}% remaining after)`
      : `Tool will break before completion. Need ${operations - currentDurability} more durability`
  };
}

/**
 * Get repair options for a tool
 * @param {string} tool - Tool name
 * @returns {Object} Available repair methods
 */
export function getRepairOptions(tool) {
  const normalized = normalizeItemName(tool);
  const maxDurability = getMaxDurability(normalized);

  if (maxDurability === 0) {
    return { error: `Unknown tool: ${normalized}` };
  }

  const options = [];

  // Anvil repair with same item
  options.push({
    method: "anvil_combine",
    description: "Combine with another tool of the same type",
    cost: "XP levels (varies with damage)",
    preservesEnchantments: true,
    durabilityGain: "Sum of both tools + 12% bonus",
    materials: `1x ${normalized}`,
    pros: ["Preserves enchantments", "Can add enchantments", "Bonus durability"],
    cons: ["Costs XP", "Damages anvil", "Prior Work Penalty increases cost"]
  });

  // Crafting table repair
  options.push({
    method: "crafting_table",
    description: "Combine two identical tools",
    cost: "None",
    preservesEnchantments: false,
    durabilityGain: "Sum of both tools + 5% bonus",
    materials: `1x ${normalized}`,
    pros: ["Free (no XP)", "Simple"],
    cons: ["Loses all enchantments", "Only 5% bonus"]
  });

  // Grindstone repair
  options.push({
    method: "grindstone",
    description: "Combine two items and remove enchantments",
    cost: "None (recovers some XP from enchantments)",
    preservesEnchantments: false,
    durabilityGain: "Sum of both tools + 5% bonus",
    materials: `1x ${normalized}`,
    pros: ["Free", "Recovers some XP", "Removes curses"],
    cons: ["Removes all enchantments"]
  });

  // Mending repair
  if (true) { // Potentially available
    options.push({
      method: "mending",
      description: "Repair using XP orbs",
      cost: "XP orbs (2 durability per orb)",
      preservesEnchantments: true,
      durabilityGain: "2 points per XP orb",
      materials: "None (requires Mending enchantment)",
      pros: ["Convenient", "Preserves enchantments", "No materials needed"],
      cons: ["Requires Mending enchantment", "Uses XP orbs", "Can't repair while stored"],
      requirement: "Tool must have Mending enchantment"
    });
  }

  // Material repair (anvil with raw materials)
  const recipe = getRecipe(normalized);
  if (recipe && recipe.ingredients) {
    const primaryMaterial = recipe.ingredients[0]?.name || "material";
    options.push({
      method: "anvil_material",
      description: "Repair with raw materials",
      cost: "XP levels (cheaper than combining tools)",
      preservesEnchantments: true,
      durabilityGain: "25% of max durability per material",
      materials: primaryMaterial,
      pros: ["Preserves enchantments", "More efficient than tool combining"],
      cons: ["Costs XP", "Damages anvil", "Needs raw materials"]
    });
  }

  return {
    tool: normalized,
    maxDurability: maxDurability,
    repairOptions: options,
    totalOptions: options.length,
    bestOption: options[0], // Anvil combine is generally best for enchanted items
    recommendation: "Use anvil repair for enchanted tools, crafting table for unenchanted tools"
  };
}

/**
 * Calculate XP cost for anvil repair
 * @param {Object} tool - Tool with durability and prior work count
 * @param {string} repairMethod - 'tool' or 'material'
 * @returns {Object} XP cost calculation
 */
export function calculateRepairCost(tool, repairMethod = "tool") {
  if (!tool || !tool.name) {
    return { error: "Valid tool object required" };
  }

  const normalized = normalizeItemName(tool.name);
  const maxDurability = getMaxDurability(normalized);
  const currentDurability = tool.durability || maxDurability;
  const damage = maxDurability - currentDurability;
  const priorWork = tool.priorWork || 0;

  // Prior Work Penalty: Cost doubles each time (capped at 39 levels making it "Too Expensive")
  const baseCost = repairMethod === "material" ? 1 : 2;
  const priorWorkPenalty = Math.pow(2, priorWork) - 1;
  const totalCost = baseCost + priorWorkPenalty;

  // Check if "Too Expensive"
  const tooExpensive = totalCost >= 40;

  const materialsNeeded = repairMethod === "material"
    ? Math.ceil(damage / (maxDurability * 0.25))
    : 1;

  return {
    tool: normalized,
    currentDurability: currentDurability,
    maxDurability: maxDurability,
    damage: damage,
    damagePercentage: ((damage / maxDurability) * 100).toFixed(1) + "%",
    priorWorkCount: priorWork,
    repairMethod: repairMethod,
    baseCost: baseCost,
    priorWorkPenalty: priorWorkPenalty,
    totalXPCost: totalCost,
    materialsNeeded: materialsNeeded,
    tooExpensive: tooExpensive,
    recommendation: tooExpensive
      ? "Too expensive to repair! Consider crafting a new tool or using grindstone to reset"
      : `Repair will cost ${totalCost} XP levels${repairMethod === "material" ? ` and ${materialsNeeded} materials` : ""}`
  };
}

/**
 * Predict when tool will break based on usage
 * @param {Object} tool - Tool with durability info
 * @param {number} usageRate - Operations per day/session
 * @returns {Object} Lifespan prediction
 */
export function predictToolLifespan(tool, usageRate = 100) {
  if (!tool || !tool.name) {
    return { error: "Valid tool object required" };
  }

  const normalized = normalizeItemName(tool.name);
  const maxDurability = getMaxDurability(normalized);
  const currentDurability = tool.durability || maxDurability;
  const unbreakingLevel = tool.unbreaking || 0;

  if (!Number.isFinite(usageRate) || usageRate <= 0) {
    usageRate = 100;
  }

  // Calculate effective usage rate with Unbreaking
  const effectiveUsageRate = unbreakingLevel > 0
    ? usageRate / (UNBREAKING_BONUS[unbreakingLevel] || 1)
    : usageRate;

  const operationsRemaining = Math.floor(currentDurability / (1 / (UNBREAKING_BONUS[unbreakingLevel] || 1)));
  const sessionsRemaining = Math.floor(operationsRemaining / usageRate);
  const percentageRemaining = (currentDurability / maxDurability * 100).toFixed(1);

  return {
    tool: normalized,
    currentDurability: currentDurability,
    maxDurability: maxDurability,
    percentageRemaining: `${percentageRemaining}%`,
    unbreakingLevel: unbreakingLevel,
    usageRate: usageRate,
    effectiveUsageRate: Math.floor(effectiveUsageRate),
    operationsRemaining: operationsRemaining,
    sessionsRemaining: sessionsRemaining,
    status: sessionsRemaining > 5
      ? "healthy"
      : sessionsRemaining > 2
      ? "monitor"
      : "critical",
    recommendation: sessionsRemaining <= 2
      ? `Tool is near breaking point. Repair soon or prepare backup.`
      : `Tool will last approximately ${sessionsRemaining} more sessions`
  };
}

/**
 * Suggest tools needed for a task
 * @param {string} task - Task type (mining, woodcutting, etc.)
 * @param {number} quantity - Amount of work
 * @returns {Object} Tool recommendations
 */
export function suggestToolsForTask(task, quantity = 100) {
  const taskTools = {
    mining: {
      primary: ["diamond_pickaxe", "iron_pickaxe", "stone_pickaxe"],
      backup: ["iron_pickaxe", "stone_pickaxe"],
      operationsPerItem: 1
    },
    woodcutting: {
      primary: ["diamond_axe", "iron_axe", "stone_axe"],
      backup: ["iron_axe", "stone_axe"],
      operationsPerItem: 1
    },
    digging: {
      primary: ["diamond_shovel", "iron_shovel"],
      backup: ["iron_shovel", "stone_shovel"],
      operationsPerItem: 1
    },
    combat: {
      primary: ["diamond_sword", "iron_sword"],
      backup: ["iron_sword", "stone_sword"],
      operationsPerItem: 3  // Multiple hits per enemy
    },
    farming: {
      primary: ["diamond_hoe", "iron_hoe"],
      backup: ["iron_hoe", "stone_hoe"],
      operationsPerItem: 1
    }
  };

  const taskInfo = taskTools[task];

  if (!taskInfo) {
    return {
      error: `Unknown task: ${task}`,
      validTasks: Object.keys(taskTools)
    };
  }

  const operations = quantity * taskInfo.operationsPerItem;
  const toolRecommendations = [];

  for (const toolName of taskInfo.primary) {
    const durability = getMaxDurability(toolName);
    const canComplete = durability >= operations;
    const toolsNeeded = Math.ceil(operations / durability);

    toolRecommendations.push({
      tool: toolName,
      durability: durability,
      canComplete: canComplete,
      toolsNeeded: toolsNeeded,
      tier: toolName.split("_")[0]
    });
  }

  const bestTool = toolRecommendations.find(t => t.canComplete) || toolRecommendations[0];

  return {
    task: task,
    quantity: quantity,
    operations: operations,
    recommendations: toolRecommendations,
    bestTool: bestTool.tool,
    toolsNeeded: bestTool.toolsNeeded,
    backupOptions: taskInfo.backup,
    recommendation: bestTool.canComplete
      ? `Use ${bestTool.tool} (will survive with durability to spare)`
      : `Bring ${bestTool.toolsNeeded}x ${bestTool.tool} or use higher tier tool`
  };
}

/**
 * Compare tool efficiency for a task
 * @param {Array} tools - Array of tool names
 * @param {number} operations - Number of operations
 * @returns {Object} Tool comparison
 */
export function compareTools(tools, operations = 100) {
  if (!Array.isArray(tools) || tools.length === 0) {
    return { error: "Array of tools required" };
  }

  const comparison = [];

  for (const toolName of tools) {
    const normalized = normalizeItemName(toolName);
    const durability = getMaxDurability(normalized);
    const tier = normalized.split("_")[0];
    const tierInfo = TOOL_TIERS[tier];

    if (durability === 0) {
      continue;
    }

    const canComplete = durability >= operations;
    const toolsNeeded = Math.ceil(operations / durability);
    const efficiency = tierInfo ? tierInfo.efficiency : 1.0;

    comparison.push({
      tool: normalized,
      tier: tier,
      durability: durability,
      efficiency: efficiency,
      canComplete: canComplete,
      toolsNeeded: toolsNeeded,
      totalDurabilityAvailable: durability * toolsNeeded
    });
  }

  // Sort by efficiency (higher is better)
  comparison.sort((a, b) => b.efficiency - a.efficiency);

  const mostEfficient = comparison[0];
  const mostDurable = comparison.reduce((max, curr) =>
    curr.durability > max.durability ? curr : max
  );

  return {
    operations: operations,
    tools: comparison,
    mostEfficient: mostEfficient.tool,
    mostDurable: mostDurable.tool,
    recommendation: mostEfficient.tool === mostDurable.tool
      ? `${mostEfficient.tool} is both most efficient and durable`
      : `${mostEfficient.tool} is fastest, but ${mostDurable.tool} lasts longest`
  };
}
