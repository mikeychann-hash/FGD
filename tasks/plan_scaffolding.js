// tasks/plan_scaffolding.js
// Advanced scaffolding system
// Implements scaffolding construction techniques, safety features, and building strategies

import {
  createPlan,
  createStep,
  describeTarget,
  normalizeItemName,
  hasInventoryItem
} from "./helpers.js";

/* =====================================================
 * SCAFFOLDING CONFIGURATION
 * Complete scaffolding mechanics and properties
 * ===================================================== */

const SCAFFOLDING_CONFIG = {
  // Basic properties
  properties: {
    stackSize: 64,
    climbSpeed: 0.2, // blocks per tick (faster than ladders)
    maxUnsupportedHeight: 6, // blocks from nearest support
    waterloggable: true,
    transparent: true,
    collisionBox: "partial" // Can walk through sides
  },

  // Crafting
  crafting: {
    materials: ["bamboo", "string"],
    recipe: "6 bamboo + 1 string",
    yield: 6
  },

  // Climbing mechanics
  climbing: {
    ascendSpeed: 0.2, // Faster than ladders (0.15)
    descendSpeed: 0.2,
    sneakDescendSpeed: 0.3, // Very fast descent
    jumpHeight: 1, // Can jump up scaffolding
    fallDamage: false // Scaffolding negates fall damage when descending
  },

  // Placement mechanics
  placement: {
    autoExtend: true, // Can place in air if within 6 blocks of support
    sidePlacement: true, // Can be placed on side of existing scaffolding
    bottomPlacement: true, // Can be placed below existing scaffolding
    supportTypes: ["solid_block", "scaffolding"],
    supportRange: 6 // Horizontal distance from support
  },

  // Breaking mechanics
  breaking: {
    cascadeBreak: true, // Breaking bottom destroys all above
    breakSpeed: "instant", // Any tool breaks instantly
    dropRate: 1.0, // Always drops
    fallsWhenUnsupported: true
  },

  // Safety features
  safety: {
    bottomPlacement: "Prevents fall damage when descending",
    sideProtection: "Can build walls without falling",
    quickEscape: "Sneak to descend rapidly",
    visibleGaps: "Partial blocks make gaps obvious"
  },

  // Building techniques
  techniques: {
    tower: {
      name: "Vertical Tower",
      description: "Build straight up by looking up and placing",
      speed: "very_fast",
      scaffoldingNeeded: "height",
      safety: "high"
    },
    platform: {
      name: "Horizontal Platform",
      description: "Extend outward up to 6 blocks from support",
      speed: "fast",
      scaffoldingNeeded: "area",
      safety: "medium"
    },
    bridge: {
      name: "Bridge",
      description: "Build across gaps with support columns every 6 blocks",
      speed: "medium",
      scaffoldingNeeded: "length + supports",
      safety: "medium"
    },
    spiral: {
      name: "Spiral Staircase",
      description: "Circular ascending scaffolding",
      speed: "slow",
      scaffoldingNeeded: "height × 4",
      safety: "high"
    },
    cage: {
      name: "Protective Cage",
      description: "Full enclosure for mob protection",
      speed: "slow",
      scaffoldingNeeded: "perimeter × height",
      safety: "very_high"
    }
  }
};

/* =====================================================
 * BUILDING PATTERNS
 * Predefined scaffolding structures
 * ===================================================== */

const SCAFFOLDING_PATTERNS = {
  simple_tower: {
    type: "vertical",
    dimensions: { width: 1, length: 1, height: "variable" },
    scaffoldingPerHeight: 1,
    buildTime: 0.5, // seconds per block
    difficulty: "easy",
    steps: [
      "Look straight up",
      "Hold jump and place scaffolding rapidly",
      "Scaffolding will stack automatically",
      "Sneak to descend quickly"
    ]
  },

  working_platform: {
    type: "horizontal",
    dimensions: { width: "3-6", length: "3-6", height: 1 },
    scaffoldingFormula: "width × length",
    buildTime: 1, // seconds per block
    difficulty: "easy",
    steps: [
      "Build central tower to working height",
      "Place scaffolding outward in all directions",
      "Maximum 6 blocks from nearest support",
      "Add support columns if extending further"
    ]
  },

  bridge_with_supports: {
    type: "bridge",
    dimensions: { width: 2, length: "variable", height: 1 },
    scaffoldingFormula: "(length × 2) + (supports × height)",
    supportSpacing: 6,
    buildTime: 2, // seconds per block
    difficulty: "medium",
    steps: [
      "Build support column every 6 blocks",
      "Each column should reach bridge height",
      "Connect columns with horizontal scaffolding",
      "Build 2-wide for comfortable passage"
    ]
  },

  spiral_staircase: {
    type: "spiral",
    dimensions: { radius: 2, height: "variable" },
    scaffoldingFormula: "height × 8", // 8 blocks per rotation
    buildTime: 3, // seconds per block
    difficulty: "hard",
    steps: [
      "Build center column",
      "Place scaffolding in spiral pattern around center",
      "Each rotation should gain 2-3 blocks height",
      "Add railings for safety"
    ]
  },

  mob_proof_cage: {
    type: "cage",
    dimensions: { width: 3, length: 3, height: 3 },
    scaffoldingFormula: "(perimeter × height) + (roof area)",
    buildTime: 5, // seconds per block
    difficulty: "medium",
    steps: [
      "Build 4 corner towers to full height",
      "Connect corners with scaffolding walls",
      "Add roof using scaffolding",
      "Leave entrance gap with scaffolding door",
      "Mobs cannot spawn on scaffolding"
    ]
  },

  waterlogged_column: {
    type: "water",
    dimensions: { width: 1, length: 1, height: "variable" },
    scaffoldingFormula: "height",
    waterBuckets: 1,
    buildTime: 1, // seconds per block
    difficulty: "easy",
    special: "Creates water elevator",
    steps: [
      "Place scaffolding column from bottom to top",
      "Pour water bucket at top",
      "Water flows down through scaffolding",
      "Creates climbable water column"
    ]
  }
};

/**
 * Calculate scaffolding requirements
 * @param {string} patternName - Pattern name
 * @param {object} dimensions - Structure dimensions
 * @returns {object} Scaffolding calculation
 */
function calculateScaffoldingNeeds(patternName, dimensions = {}) {
  const pattern = SCAFFOLDING_PATTERNS[patternName];

  if (!pattern) {
    return {
      error: "Unknown pattern",
      availablePatterns: Object.keys(SCAFFOLDING_PATTERNS)
    };
  }

  const calc = {
    pattern: patternName,
    type: pattern.type,
    difficulty: pattern.difficulty,
    scaffoldingNeeded: 0,
    buildTime: 0
  };

  // Calculate based on pattern type
  switch (patternName) {
    case "simple_tower":
      calc.scaffoldingNeeded = dimensions.height || 10;
      calc.buildTime = calc.scaffoldingNeeded * pattern.buildTime;
      break;

    case "working_platform":
      const width = dimensions.width || 3;
      const length = dimensions.length || 3;
      calc.scaffoldingNeeded = width * length;
      calc.buildTime = calc.scaffoldingNeeded * pattern.buildTime;
      break;

    case "bridge_with_supports":
      const bridgeLength = dimensions.length || 20;
      const bridgeHeight = dimensions.height || 10;
      const supports = Math.ceil(bridgeLength / pattern.supportSpacing);
      calc.scaffoldingNeeded = (bridgeLength * 2) + (supports * bridgeHeight);
      calc.buildTime = calc.scaffoldingNeeded * pattern.buildTime;
      calc.supports = supports;
      break;

    case "spiral_staircase":
      const spiralHeight = dimensions.height || 20;
      calc.scaffoldingNeeded = spiralHeight * 8;
      calc.buildTime = calc.scaffoldingNeeded * pattern.buildTime;
      break;

    case "mob_proof_cage":
      const cageWidth = dimensions.width || 3;
      const cageLength = dimensions.length || 3;
      const cageHeight = dimensions.height || 3;
      const perimeter = 2 * (cageWidth + cageLength);
      const roofArea = cageWidth * cageLength;
      calc.scaffoldingNeeded = (perimeter * cageHeight) + roofArea;
      calc.buildTime = calc.scaffoldingNeeded * pattern.buildTime;
      break;

    case "waterlogged_column":
      calc.scaffoldingNeeded = dimensions.height || 10;
      calc.buildTime = calc.scaffoldingNeeded * pattern.buildTime;
      calc.waterBuckets = 1;
      break;
  }

  return calc;
}

/**
 * Validate scaffolding placement
 * @param {object} position - Target position
 * @param {object} worldData - Surrounding data
 * @returns {object} Validation result
 */
function validateScaffoldingPlacement(position, worldData = {}) {
  const validation = {
    valid: true,
    warnings: [],
    suggestions: []
  };

  // Check for nearby support
  const nearbyScaffolding = worldData.nearbyScaffolding || [];
  const solidBlocks = worldData.nearbySolidBlocks || [];

  const hasSupport = nearbyScaffolding.length > 0 || solidBlocks.length > 0;

  if (!hasSupport) {
    validation.valid = false;
    validation.warnings.push("No support within 6 blocks - scaffolding will fall");
    validation.suggestions.push("Place scaffolding adjacent to solid block or existing scaffolding");
  }

  // Check distance from support
  if (nearbyScaffolding.length > 0) {
    const distances = nearbyScaffolding.map(s => s.distance);
    const minDistance = Math.min(...distances);

    if (minDistance > SCAFFOLDING_CONFIG.placement.supportRange) {
      validation.valid = false;
      validation.warnings.push(`Too far from support (${minDistance} blocks, max ${SCAFFOLDING_CONFIG.placement.supportRange})`);
    } else if (minDistance >= SCAFFOLDING_CONFIG.placement.supportRange - 1) {
      validation.warnings.push(`Near edge of support range (${minDistance}/${SCAFFOLDING_CONFIG.placement.supportRange} blocks)`);
      validation.suggestions.push("Add support column soon");
    }
  }

  // Check height from base
  const heightFromGround = worldData.heightFromGround || 0;
  if (heightFromGround > 20) {
    validation.warnings.push("Building at high altitude - be careful");
    validation.suggestions.push("Consider using safety cage or water bucket for emergency");
  }

  return validation;
}

/**
 * Design scaffolding structure
 * @param {string} purpose - Building purpose
 * @param {object} requirements - Structure requirements
 * @returns {object} Structure design
 */
function designScaffoldingStructure(purpose, requirements = {}) {
  const designs = {
    quick_ascent: {
      pattern: "simple_tower",
      height: requirements.height || 20,
      description: "Fastest way to build up"
    },
    work_platform: {
      pattern: "working_platform",
      area: requirements.area || 9,
      description: "Stable platform for building"
    },
    bridge: {
      pattern: "bridge_with_supports",
      length: requirements.length || 20,
      description: "Cross gaps safely"
    },
    safe_ascent: {
      pattern: "spiral_staircase",
      height: requirements.height || 20,
      description: "Safest way up with gradual climb"
    },
    mob_shelter: {
      pattern: "mob_proof_cage",
      dimensions: { width: 3, length: 3, height: 3 },
      description: "Temporary shelter from mobs"
    }
  };

  const design = designs[purpose];
  if (!design) {
    return {
      error: "Unknown purpose",
      availablePurposes: Object.keys(designs)
    };
  }

  const pattern = SCAFFOLDING_PATTERNS[design.pattern];
  const needs = calculateScaffoldingNeeds(design.pattern, design.dimensions || design);

  return {
    purpose,
    pattern: design.pattern,
    description: design.description,
    scaffoldingNeeded: needs.scaffoldingNeeded,
    buildTime: needs.buildTime,
    difficulty: pattern.difficulty,
    steps: pattern.steps,
    dimensions: design.dimensions || design,
    additionalMaterials: needs.waterBuckets ? { water_bucket: needs.waterBuckets } : {}
  };
}

/* =====================================================
 * SCAFFOLDING TASK PLANNER
 * Main function for creating scaffolding plans
 * ===================================================== */

/**
 * Plan scaffolding construction
 * @param {object} goal - Task goal
 * @param {object} context - Game context
 * @returns {object} Scaffolding plan
 */
function planScaffoldingTask(goal = {}, context = {}) {
  const purpose = goal.purpose || "quick_ascent";
  const pattern = goal.pattern;
  const inventory = context.inventory || {};

  // Get or design structure
  let design;
  if (pattern) {
    const needs = calculateScaffoldingNeeds(pattern, goal.dimensions || {});
    const patternData = SCAFFOLDING_PATTERNS[pattern];
    design = {
      purpose: "custom",
      pattern,
      scaffoldingNeeded: needs.scaffoldingNeeded,
      buildTime: needs.buildTime,
      difficulty: patternData.difficulty,
      steps: patternData.steps
    };
  } else {
    design = designScaffoldingStructure(purpose, goal.requirements || {});
    if (design.error) {
      return {
        status: "failed",
        error: design.error,
        availableOptions: design.availablePurposes || design.availablePatterns
      };
    }
  }

  const plan = createPlan("build_scaffolding", `Build ${design.pattern} scaffolding`, {
    priority: "normal",
    estimatedDuration: design.buildTime,
    complexity: design.difficulty
  });

  // Check materials
  const scaffoldingAvailable = inventory.scaffolding?.count || 0;
  const scaffoldingNeeded = design.scaffoldingNeeded;

  if (scaffoldingAvailable < scaffoldingNeeded) {
    plan.status = "blocked";
    plan.error = `Insufficient scaffolding (need ${scaffoldingNeeded}, have ${scaffoldingAvailable})`;

    // Calculate crafting needs
    const scaffoldingToCraft = scaffoldingNeeded - scaffoldingAvailable;
    const bambooNeeded = Math.ceil(scaffoldingToCraft / 6) * 6;
    const stringNeeded = Math.ceil(scaffoldingToCraft / 6);

    plan.suggestion = `Craft more scaffolding: need ${bambooNeeded} bamboo + ${stringNeeded} string`;
    return plan;
  }

  // Build steps from design
  design.steps.forEach((step, i) => {
    plan.steps.push(createStep(
      `build_step_${i + 1}`,
      step,
      { stepNumber: i + 1, totalSteps: design.steps.length }
    ));
  });

  // Add safety reminder
  plan.steps.push(createStep(
    "safety_check",
    "Remember: Hold sneak to descend quickly without fall damage",
    {
      safety: "Always have water bucket as backup",
      removal: "Break bottom scaffolding to remove entire structure"
    }
  ));

  plan.outcome = {
    structure: design.pattern,
    scaffoldingUsed: design.scaffoldingNeeded,
    buildTime: design.buildTime,
    purpose: design.purpose
  };

  return plan;
}

/* =====================================================
 * EXPORTS
 * ===================================================== */

export default planScaffoldingTask;
export {
  SCAFFOLDING_CONFIG,
  SCAFFOLDING_PATTERNS,
  calculateScaffoldingNeeds,
  validateScaffoldingPlacement,
  designScaffoldingStructure
};
