// ============================================================================
// BUILD COST ESTIMATOR SYSTEM - MANUAL INSTALLATION GUIDE
// ============================================================================
//
// INSTALLATION INSTRUCTIONS:
// 1. Add Part 1 (Constants and COST_ESTIMATOR) AFTER the BUILDING_VALIDATOR closing brace (};)
// 2. Add Part 2 (Integration Code) in planBuildTask function AFTER the validation section
// 3. Add Part 3 (Return Statement Updates) to the createPlan return statement
//
// ============================================================================

// ============================================================================
// PART 1: Add this AFTER BUILDING_VALIDATOR closes (after line ~2818: };)
// ============================================================================

// ============================================================================
// Build Cost Estimator
// ============================================================================

/**
 * Item value database - costs in emeralds
 * Based on villager trading prices and resource rarity
 */
const ITEM_VALUES = {
  // Basic building blocks (cheap)
  dirt: 0.01,
  cobblestone: 0.02,
  stone: 0.03,
  sand: 0.02,
  gravel: 0.02,
  sandstone: 0.04,
  netherrack: 0.02,
  end_stone: 0.15,

  // Wood materials
  oak_log: 0.05,
  oak_planks: 0.02,
  oak_slab: 0.01,
  oak_stairs: 0.03,
  oak_fence: 0.03,
  oak_door: 0.04,
  spruce_log: 0.05,
  spruce_planks: 0.02,
  birch_log: 0.05,
  birch_planks: 0.02,
  jungle_log: 0.06,
  jungle_planks: 0.02,
  acacia_log: 0.05,
  acacia_planks: 0.02,
  dark_oak_log: 0.06,
  dark_oak_planks: 0.02,
  crimson_planks: 0.08,
  warped_planks: 0.08,

  // Stone variants
  andesite: 0.03,
  diorite: 0.03,
  granite: 0.03,
  polished_andesite: 0.04,
  polished_diorite: 0.04,
  polished_granite: 0.04,
  stone_bricks: 0.05,
  mossy_stone_bricks: 0.06,
  cracked_stone_bricks: 0.05,
  chiseled_stone_bricks: 0.06,

  // Bricks and blocks
  bricks: 0.08,
  brick: 0.02,
  clay: 0.05,
  clay_ball: 0.01,
  terracotta: 0.06,
  white_terracotta: 0.07,
  concrete: 0.08,
  concrete_powder: 0.06,

  // Glass
  glass: 0.04,
  glass_pane: 0.02,
  stained_glass: 0.05,
  stained_glass_pane: 0.03,

  // Wool and textiles
  wool: 0.05,
  white_wool: 0.05,
  carpet: 0.02,

  // Precious blocks (expensive)
  iron_block: 3.0,
  gold_block: 5.0,
  diamond_block: 50.0,
  emerald_block: 90.0,
  netherite_block: 200.0,

  // Ores and ingots
  coal: 0.05,
  iron_ingot: 0.33,
  gold_ingot: 0.56,
  diamond: 5.5,
  emerald: 1.0,
  netherite_ingot: 22.0,
  copper_ingot: 0.15,

  // Redstone
  redstone: 0.08,
  redstone_block: 0.72,
  redstone_torch: 0.10,
  repeater: 0.30,
  comparator: 0.50,
  piston: 0.60,
  sticky_piston: 0.80,
  hopper: 1.80,
  dropper: 0.40,
  dispenser: 0.45,
  observer: 0.70,

  // Lighting
  torch: 0.02,
  lantern: 0.30,
  soul_lantern: 0.35,
  glowstone: 0.25,
  sea_lantern: 0.40,
  redstone_lamp: 0.50,

  // Decorative
  painting: 0.10,
  item_frame: 0.08,
  flower_pot: 0.05,

  // Functional blocks
  crafting_table: 0.08,
  furnace: 0.16,
  blast_furnace: 1.50,
  smoker: 1.50,
  chest: 0.16,
  barrel: 0.14,
  bed: 0.60,
  door: 0.04,
  trapdoor: 0.06,
  fence_gate: 0.08,

  // Nether materials
  nether_bricks: 0.08,
  red_nether_bricks: 0.10,
  nether_wart_block: 0.12,
  soul_sand: 0.06,
  soul_soil: 0.05,
  basalt: 0.04,
  blackstone: 0.06,
  gilded_blackstone: 0.70,

  // End materials
  purpur_block: 0.20,
  purpur_pillar: 0.22,
  end_stone_bricks: 0.18,

  // Quartz
  quartz: 0.15,
  quartz_block: 0.60,
  quartz_pillar: 0.62,
  chiseled_quartz_block: 0.65,
  smooth_quartz: 0.62,

  // Prismarine (underwater)
  prismarine: 0.40,
  prismarine_bricks: 0.45,
  dark_prismarine: 0.50,
  sea_lantern: 0.40,

  // Rare/special blocks
  sponge: 5.0,
  wet_sponge: 5.0,
  slime_block: 2.0,
  honey_block: 1.5,
  scaffolding: 0.10,
  hay_bale: 0.12,

  // Tools (depreciation cost per use)
  wooden_pickaxe: 0.10,
  stone_pickaxe: 0.20,
  iron_pickaxe: 1.50,
  diamond_pickaxe: 15.0,
  netherite_pickaxe: 120.0,
  wooden_axe: 0.10,
  stone_axe: 0.20,
  iron_axe: 1.50,
  diamond_axe: 15.0,
  netherite_axe: 120.0,
  wooden_shovel: 0.08,
  stone_shovel: 0.15,
  iron_shovel: 1.20,
  diamond_shovel: 12.0,
  netherite_shovel: 100.0,
  shears: 0.80,

  // Potions
  water_breathing_potion: 0.50,
  night_vision_potion: 0.40,
  fire_resistance_potion: 0.60,
  slow_falling_potion: 0.55,
  invisibility_potion: 0.80,
  regeneration_potion: 1.00,

  // Special items
  elytra: 50.0,
  firework_rocket: 0.20,
  ender_pearl: 0.40,
  ender_chest: 10.0,
  shulker_box: 15.0,

  // Default for unspecified items
  unspecified_item: 0.10,
  default: 0.10
};

/**
 * Labor rates and multipliers
 */
const LABOR_RATES = {
  HOURLY_RATE: 5.0,              // Base emeralds per hour
  SKILL_MULTIPLIERS: {
    basic: 1.0,
    intermediate: 1.3,
    advanced: 1.6,
    expert: 2.0
  },
  ENVIRONMENT_MULTIPLIERS: {
    overworld: 1.0,
    nether: 1.5,
    the_end: 1.8,
    underground: 1.2,
    underwater: 1.6,
    sky: 1.3
  },
  DIFFICULTY_MULTIPLIERS: {
    easy: 1.0,
    medium: 1.2,
    hard: 1.5,
    expert: 2.0
  }
};

/**
 * Build Cost Estimator system
 * Calculates comprehensive costs for construction projects
 */
const COST_ESTIMATOR = {
  /**
   * Get the value of an item in emeralds
   * @param {string} itemName - Item name
   * @returns {number} Value in emeralds
   */
  getItemValue(itemName) {
    if (!itemName) return ITEM_VALUES.default;

    const normalized = normalizeItemName(itemName);

    // Direct lookup
    if (ITEM_VALUES[itemName]) {
      return ITEM_VALUES[itemName];
    }

    // Normalized lookup
    if (ITEM_VALUES[normalized]) {
      return ITEM_VALUES[normalized];
    }

    // Partial match (e.g., "white_wool" matches "wool")
    for (const [key, value] of Object.entries(ITEM_VALUES)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }

    return ITEM_VALUES.default;
  },

  /**
   * Calculate material costs
   * @param {Array} materials - Materials list with name and count
   * @returns {Object} Material cost breakdown
   */
  calculateMaterialCost(materials) {
    if (!materials || !Array.isArray(materials)) {
      return { total: 0, breakdown: [] };
    }

    const breakdown = materials.map(mat => {
      const name = mat.name || mat;
      const count = parseInt(mat.count, 10) || 1;
      const unitCost = this.getItemValue(name);
      const totalCost = count * unitCost;

      return {
        name,
        count,
        unitCost,
        totalCost
      };
    });

    const total = breakdown.reduce((sum, item) => sum + item.totalCost, 0);

    return {
      total,
      breakdown,
      itemCount: breakdown.length,
      totalBlocks: breakdown.reduce((sum, item) => sum + item.count, 0)
    };
  },

  /**
   * Calculate labor costs
   * @param {number} laborTimeMs - Labor time in milliseconds
   * @param {Object} options - Skill level, environment, difficulty
   * @returns {Object} Labor cost details
   */
  calculateLaborCost(laborTimeMs, options = {}) {
    const {
      skillLevel = "basic",
      environment = "overworld",
      difficulty = "medium"
    } = options;

    // Convert ms to hours
    const hours = laborTimeMs / (1000 * 60 * 60);

    // Base labor cost
    const baseRate = LABOR_RATES.HOURLY_RATE;

    // Apply multipliers
    const skillMultiplier = LABOR_RATES.SKILL_MULTIPLIERS[skillLevel] || 1.0;
    const envMultiplier = LABOR_RATES.ENVIRONMENT_MULTIPLIERS[environment] || 1.0;
    const diffMultiplier = LABOR_RATES.DIFFICULTY_MULTIPLIERS[difficulty] || 1.0;

    const effectiveRate = baseRate * skillMultiplier * envMultiplier * diffMultiplier;
    const total = hours * effectiveRate;

    return {
      total,
      hours,
      baseRate,
      effectiveRate,
      multipliers: {
        skill: skillMultiplier,
        environment: envMultiplier,
        difficulty: diffMultiplier,
        combined: skillMultiplier * envMultiplier * diffMultiplier
      }
    };
  },

  /**
   * Calculate tool depreciation costs
   * @param {Array} tools - Tools list
   * @param {number} usageDuration - Expected usage time in ms
   * @returns {Object} Tool cost details
   */
  calculateToolCost(tools, usageDuration) {
    if (!tools || !Array.isArray(tools)) {
      return { total: 0, breakdown: [] };
    }

    // Tool durability (uses before breaking)
    const TOOL_DURABILITY = {
      wooden: 59,
      stone: 131,
      iron: 250,
      diamond: 1561,
      netherite: 2031
    };

    // Estimate uses based on duration (very rough estimate)
    const estimatedUses = Math.ceil(usageDuration / 5000); // ~5 seconds per action

    const breakdown = tools.map(tool => {
      const toolName = normalizeItemName(tool.name || tool);
      const toolValue = this.getItemValue(toolName);

      // Determine tool material
      let durability = 250; // default to iron
      for (const [material, dur] of Object.entries(TOOL_DURABILITY)) {
        if (toolName.includes(material)) {
          durability = dur;
          break;
        }
      }

      // Calculate depreciation (fraction of tool value used)
      const depreciationFraction = Math.min(estimatedUses / durability, 1.0);
      const depreciationCost = toolValue * depreciationFraction;

      return {
        name: toolName,
        value: toolValue,
        durability,
        estimatedUses,
        depreciationFraction,
        cost: depreciationCost
      };
    });

    const total = breakdown.reduce((sum, item) => sum + item.cost, 0);

    return {
      total,
      breakdown,
      estimatedUses
    };
  },

  /**
   * Calculate consumable costs (potions, food, etc.)
   * @param {Array} consumables - Consumables list
   * @returns {Object} Consumable cost details
   */
  calculateConsumableCost(consumables) {
    if (!consumables || !Array.isArray(consumables)) {
      return { total: 0, breakdown: [] };
    }

    const breakdown = consumables.map(item => {
      const name = item.name || item;
      const count = parseInt(item.count, 10) || 1;
      const unitCost = this.getItemValue(name);
      const totalCost = count * unitCost;

      return {
        name,
        count,
        unitCost,
        totalCost
      };
    });

    const total = breakdown.reduce((sum, item) => sum + item.totalCost, 0);

    return {
      total,
      breakdown
    };
  },

  /**
   * Calculate comprehensive build cost
   * @param {Object} buildPlan - Complete build plan
   * @param {Object} context - Additional context
   * @returns {Object} Complete cost estimate
   */
  calculateBuildCost(buildPlan, context = {}) {
    const materials = buildPlan.materials || context.materials || [];
    const laborTime = buildPlan.estimatedDuration || 0;
    const tools = context.tools || buildPlan.tools || [];
    const potions = context.potions || buildPlan.potions || [];

    const skillLevel = buildPlan.difficulty || context.skillLevel || "basic";
    const environment = context.environment || buildPlan.environment || "overworld";
    const difficulty = buildPlan.difficulty || "medium";

    // Calculate each cost component
    const materialCost = this.calculateMaterialCost(materials);
    const laborCost = this.calculateLaborCost(laborTime, {
      skillLevel,
      environment,
      difficulty
    });
    const toolCost = this.calculateToolCost(tools, laborTime);
    const consumableCost = this.calculateConsumableCost(potions);

    // Calculate totals
    const subtotal = materialCost.total + laborCost.total + toolCost.total + consumableCost.total;

    // Add contingency (10% buffer for unexpected costs)
    const contingency = subtotal * 0.10;
    const total = subtotal + contingency;

    return {
      total,
      subtotal,
      contingency,
      materials: materialCost,
      labor: laborCost,
      tools: toolCost,
      consumables: consumableCost,
      breakdown: {
        materials: materialCost.total,
        labor: laborCost.total,
        tools: toolCost.total,
        consumables: consumableCost.total,
        contingency
      },
      percentages: {
        materials: (materialCost.total / total * 100).toFixed(1),
        labor: (laborCost.total / total * 100).toFixed(1),
        tools: (toolCost.total / total * 100).toFixed(1),
        consumables: (consumableCost.total / total * 100).toFixed(1),
        contingency: (contingency / total * 100).toFixed(1)
      }
    };
  },

  /**
   * Compare costs with budget
   * @param {number} estimatedCost - Estimated cost
   * @param {number} budget - Available budget
   * @returns {Object} Budget comparison
   */
  compareToBudget(estimatedCost, budget) {
    if (!budget || budget <= 0) {
      return {
        withinBudget: true,
        difference: 0,
        percentageUsed: 0,
        status: "no_budget_set"
      };
    }

    const difference = budget - estimatedCost;
    const percentageUsed = (estimatedCost / budget * 100);
    const withinBudget = estimatedCost <= budget;

    let status;
    if (percentageUsed < 75) {
      status = "well_under_budget";
    } else if (percentageUsed < 95) {
      status = "within_budget";
    } else if (percentageUsed < 105) {
      status = "tight_budget";
    } else {
      status = "over_budget";
    }

    return {
      withinBudget,
      difference,
      percentageUsed: percentageUsed.toFixed(1),
      status,
      budget,
      estimatedCost
    };
  },

  /**
   * Suggest cost optimizations
   * @param {Object} costBreakdown - Cost breakdown
   * @returns {Array} Optimization suggestions
   */
  suggestOptimizations(costBreakdown) {
    const suggestions = [];

    // Check if materials are the biggest cost
    const materialPercentage = parseFloat(costBreakdown.percentages.materials);
    if (materialPercentage > 50) {
      suggestions.push({
        category: "materials",
        priority: "high",
        suggestion: "Materials represent >50% of cost. Consider using cheaper alternatives.",
        potentialSavings: costBreakdown.materials.total * 0.2
      });
    }

    // Check if labor is expensive
    const laborPercentage = parseFloat(costBreakdown.percentages.labor);
    if (laborPercentage > 40) {
      suggestions.push({
        category: "labor",
        priority: "medium",
        suggestion: "High labor costs. Consider using templates or breaking into smaller phases.",
        potentialSavings: costBreakdown.labor.total * 0.15
      });
    }

    // Check for expensive individual materials
    if (costBreakdown.materials.breakdown) {
      const expensiveItems = costBreakdown.materials.breakdown
        .filter(item => item.totalCost > 10.0)
        .sort((a, b) => b.totalCost - a.totalCost)
        .slice(0, 3);

      expensiveItems.forEach(item => {
        suggestions.push({
          category: "materials",
          priority: "medium",
          suggestion: `${item.name} costs ${item.totalCost.toFixed(2)} emeralds. Consider alternatives.`,
          potentialSavings: item.totalCost * 0.3,
          item: item.name
        });
      });
    }

    return suggestions;
  }
};

// ============================================================================
// PART 2: Add this in planBuildTask AFTER validation section
// Find the line that says: const validation = BUILDING_VALIDATOR.validateBuildPlan(...)
// After the closing ); add this code:
// ============================================================================

  // Calculate comprehensive build costs
  const costEstimate = COST_ESTIMATOR.calculateBuildCost(
    {
      materials: materialRequirements,
      estimatedDuration,
      difficulty: template?.difficulty || "medium",
      environment: enhancedTask?.metadata?.environment || "overworld"
    },
    {
      tools: toolChecklist.map(name => ({ name })),
      potions: terrainProfile?.potions || [],
      skillLevel: template?.difficulty || "basic",
      environment: enhancedTask?.metadata?.environment || "overworld"
    }
  );

  // Check budget if provided
  const budget = enhancedTask?.metadata?.budget || context.budget;
  const budgetComparison = budget ? COST_ESTIMATOR.compareToBudget(costEstimate.total, budget) : null;

  // Get cost optimization suggestions
  const costOptimizations = COST_ESTIMATOR.suggestOptimizations(costEstimate);

// ============================================================================
// PART 3: Add cost notes section
// Find where validation notes end (after the "Height clearance:" note)
// Then add this entire section BEFORE the "return createPlan({" line:
// ============================================================================

  // Add cost estimate notes
  if (costEstimate) {
    notes.push(`Estimated total cost: ${costEstimate.total.toFixed(2)} emeralds.`);

    // Add cost breakdown
    const breakdown = [];
    if (costEstimate.breakdown.materials > 0) {
      breakdown.push(`materials: ${costEstimate.breakdown.materials.toFixed(2)}`);
    }
    if (costEstimate.breakdown.labor > 0) {
      breakdown.push(`labor: ${costEstimate.breakdown.labor.toFixed(2)}`);
    }
    if (costEstimate.breakdown.tools > 0) {
      breakdown.push(`tools: ${costEstimate.breakdown.tools.toFixed(2)}`);
    }
    if (costEstimate.breakdown.consumables > 0) {
      breakdown.push(`consumables: ${costEstimate.breakdown.consumables.toFixed(2)}`);
    }

    if (breakdown.length > 0) {
      notes.push(`Cost breakdown: ${breakdown.join(', ')} emeralds.`);
    }

    // Add labor details
    if (costEstimate.labor && costEstimate.labor.hours > 0) {
      notes.push(`Labor: ${costEstimate.labor.hours.toFixed(2)} hours @ ${costEstimate.labor.effectiveRate.toFixed(2)} emeralds/hour.`);
    }

    // Add budget comparison
    if (budgetComparison) {
      if (budgetComparison.status === "over_budget") {
        notes.push(`BUDGET EXCEEDED: ${budgetComparison.percentageUsed}% of budget (over by ${Math.abs(budgetComparison.difference).toFixed(2)} emeralds).`);
      } else if (budgetComparison.status === "tight_budget") {
        notes.push(`Budget tight: ${budgetComparison.percentageUsed}% of ${budget} emerald budget used.`);
      } else if (budgetComparison.status === "within_budget") {
        notes.push(`Within budget: ${budgetComparison.percentageUsed}% of ${budget} emerald budget (${budgetComparison.difference.toFixed(2)} remaining).`);
      } else if (budgetComparison.status === "well_under_budget") {
        notes.push(`Well under budget: ${budgetComparison.percentageUsed}% of ${budget} emerald budget (${budgetComparison.difference.toFixed(2)} remaining).`);
      }
    }

    // Add cost optimization suggestions
    if (costOptimizations && costOptimizations.length > 0) {
      const highPriority = costOptimizations.filter(opt => opt.priority === "high");
      if (highPriority.length > 0) {
        notes.push(`${highPriority.length} high-priority cost optimization(s) available.`);
      }

      // Show top optimization suggestion
      if (costOptimizations[0]) {
        const topOpt = costOptimizations[0];
        notes.push(`Cost tip: ${topOpt.suggestion} (save ~${topOpt.potentialSavings.toFixed(2)} emeralds).`);
      }
    }
  }

// ============================================================================
// PART 4: Update the return statement
// Find the "return createPlan({" section and ADD these three lines
// AFTER "validation" and BEFORE the closing "});"
// ============================================================================

    // Add validation metadata
    validation,
    // Add cost estimation metadata
    costEstimate,
    budgetComparison,
    costOptimizations
  });

// ============================================================================
// END OF MANUAL INSTALLATION CODE
// ============================================================================
