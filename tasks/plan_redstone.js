// tasks/plan_redstone.js
// Redstone activation and interaction system
// Implements lever, button, pressure plate, and redstone component interactions

import {
  createPlan,
  createStep,
  describeTarget,
  normalizeItemName,
  hasInventoryItem
} from "./helpers.js";

/* =====================================================
 * REDSTONE COMPONENT DATABASE
 * All interactive redstone components
 * ===================================================== */

const REDSTONE_COMPONENTS = {
  // Levers (toggle switches)
  lever: {
    type: "switch",
    activation: "toggle",
    state: "on_off",
    powerOutput: 15,
    staysActivated: true,
    canBePlacedOn: ["wall", "floor", "ceiling"],
    stackSize: 64
  },

  // Buttons (momentary switches)
  stone_button: {
    type: "button",
    activation: "press",
    state: "momentary",
    powerOutput: 15,
    activationDuration: 1.0, // seconds (10 ticks)
    staysActivated: false,
    canBePlacedOn: ["wall", "floor"],
    stackSize: 64,
    material: "stone"
  },
  oak_button: {
    type: "button",
    activation: "press",
    state: "momentary",
    powerOutput: 15,
    activationDuration: 1.5, // seconds (15 ticks) - wooden buttons last longer
    staysActivated: false,
    canBePlacedOn: ["wall", "floor"],
    stackSize: 64,
    material: "wood"
  },
  spruce_button: {
    type: "button",
    activation: "press",
    state: "momentary",
    powerOutput: 15,
    activationDuration: 1.5,
    staysActivated: false,
    canBePlacedOn: ["wall", "floor"],
    stackSize: 64,
    material: "wood"
  },
  birch_button: {
    type: "button",
    activation: "press",
    state: "momentary",
    powerOutput: 15,
    activationDuration: 1.5,
    staysActivated: false,
    canBePlacedOn: ["wall", "floor"],
    stackSize: 64,
    material: "wood"
  },
  jungle_button: {
    type: "button",
    activation: "press",
    state: "momentary",
    powerOutput: 15,
    activationDuration: 1.5,
    staysActivated: false,
    canBePlacedOn: ["wall", "floor"],
    stackSize: 64,
    material: "wood"
  },
  acacia_button: {
    type: "button",
    activation: "press",
    state: "momentary",
    powerOutput: 15,
    activationDuration: 1.5,
    staysActivated: false,
    canBePlacedOn: ["wall", "floor"],
    stackSize: 64,
    material: "wood"
  },
  dark_oak_button: {
    type: "button",
    activation: "press",
    state: "momentary",
    powerOutput: 15,
    activationDuration: 1.5,
    staysActivated: false,
    canBePlacedOn: ["wall", "floor"],
    stackSize: 64,
    material: "wood"
  },
  mangrove_button: {
    type: "button",
    activation: "press",
    state: "momentary",
    powerOutput: 15,
    activationDuration: 1.5,
    staysActivated: false,
    canBePlacedOn: ["wall", "floor"],
    stackSize: 64,
    material: "wood"
  },
  cherry_button: {
    type: "button",
    activation: "press",
    state: "momentary",
    powerOutput: 15,
    activationDuration: 1.5,
    staysActivated: false,
    canBePlacedOn: ["wall", "floor"],
    stackSize: 64,
    material: "wood"
  },
  bamboo_button: {
    type: "button",
    activation: "press",
    state: "momentary",
    powerOutput: 15,
    activationDuration: 1.5,
    staysActivated: false,
    canBePlacedOn: ["wall", "floor"],
    stackSize: 64,
    material: "wood"
  },
  crimson_button: {
    type: "button",
    activation: "press",
    state: "momentary",
    powerOutput: 15,
    activationDuration: 1.5,
    staysActivated: false,
    canBePlacedOn: ["wall", "floor"],
    stackSize: 64,
    material: "wood"
  },
  warped_button: {
    type: "button",
    activation: "press",
    state: "momentary",
    powerOutput: 15,
    activationDuration: 1.5,
    staysActivated: false,
    canBePlacedOn: ["wall", "floor"],
    stackSize: 64,
    material: "wood"
  },
  polished_blackstone_button: {
    type: "button",
    activation: "press",
    state: "momentary",
    powerOutput: 15,
    activationDuration: 1.0,
    staysActivated: false,
    canBePlacedOn: ["wall", "floor"],
    stackSize: 64,
    material: "stone"
  },

  // Pressure Plates (weight-activated)
  stone_pressure_plate: {
    type: "pressure_plate",
    activation: "step_on",
    state: "weight_activated",
    powerOutput: 15,
    activationDelay: 0,
    deactivationDelay: 0.25, // seconds (5 ticks)
    activatedBy: ["player", "mob", "item"],
    canBePlacedOn: ["floor"],
    stackSize: 64,
    material: "stone"
  },
  oak_pressure_plate: {
    type: "pressure_plate",
    activation: "step_on",
    state: "weight_activated",
    powerOutput: 15,
    activationDelay: 0,
    deactivationDelay: 0.25,
    activatedBy: ["player", "mob", "item"],
    canBePlacedOn: ["floor"],
    stackSize: 64,
    material: "wood"
  },
  spruce_pressure_plate: {
    type: "pressure_plate",
    activation: "step_on",
    state: "weight_activated",
    powerOutput: 15,
    activationDelay: 0,
    deactivationDelay: 0.25,
    activatedBy: ["player", "mob", "item"],
    canBePlacedOn: ["floor"],
    stackSize: 64,
    material: "wood"
  },
  birch_pressure_plate: {
    type: "pressure_plate",
    activation: "step_on",
    state: "weight_activated",
    powerOutput: 15,
    activationDelay: 0,
    deactivationDelay: 0.25,
    activatedBy: ["player", "mob", "item"],
    canBePlacedOn: ["floor"],
    stackSize: 64,
    material: "wood"
  },
  jungle_pressure_plate: {
    type: "pressure_plate",
    activation: "step_on",
    state: "weight_activated",
    powerOutput: 15,
    activationDelay: 0,
    deactivationDelay: 0.25,
    activatedBy: ["player", "mob", "item"],
    canBePlacedOn: ["floor"],
    stackSize: 64,
    material: "wood"
  },
  acacia_pressure_plate: {
    type: "pressure_plate",
    activation: "step_on",
    state: "weight_activated",
    powerOutput: 15,
    activationDelay: 0,
    deactivationDelay: 0.25,
    activatedBy: ["player", "mob", "item"],
    canBePlacedOn: ["floor"],
    stackSize: 64,
    material: "wood"
  },
  dark_oak_pressure_plate: {
    type: "pressure_plate",
    activation: "step_on",
    state: "weight_activated",
    powerOutput: 15,
    activationDelay: 0,
    deactivationDelay: 0.25,
    activatedBy: ["player", "mob", "item"],
    canBePlacedOn: ["floor"],
    stackSize: 64,
    material: "wood"
  },
  mangrove_pressure_plate: {
    type: "pressure_plate",
    activation: "step_on",
    state: "weight_activated",
    powerOutput: 15,
    activationDelay: 0,
    deactivationDelay: 0.25,
    activatedBy: ["player", "mob", "item"],
    canBePlacedOn: ["floor"],
    stackSize: 64,
    material: "wood"
  },
  cherry_pressure_plate: {
    type: "pressure_plate",
    activation: "step_on",
    state: "weight_activated",
    powerOutput: 15,
    activationDelay: 0,
    deactivationDelay: 0.25,
    activatedBy: ["player", "mob", "item"],
    canBePlacedOn: ["floor"],
    stackSize: 64,
    material: "wood"
  },
  bamboo_pressure_plate: {
    type: "pressure_plate",
    activation: "step_on",
    state: "weight_activated",
    powerOutput: 15,
    activationDelay: 0,
    deactivationDelay: 0.25,
    activatedBy: ["player", "mob", "item"],
    canBePlacedOn: ["floor"],
    stackSize: 64,
    material: "wood"
  },
  crimson_pressure_plate: {
    type: "pressure_plate",
    activation: "step_on",
    state: "weight_activated",
    powerOutput: 15,
    activationDelay: 0,
    deactivationDelay: 0.25,
    activatedBy: ["player", "mob", "item"],
    canBePlacedOn: ["floor"],
    stackSize: 64,
    material: "wood"
  },
  warped_pressure_plate: {
    type: "pressure_plate",
    activation: "step_on",
    state: "weight_activated",
    powerOutput: 15,
    activationDelay: 0,
    deactivationDelay: 0.25,
    activatedBy: ["player", "mob", "item"],
    canBePlacedOn: ["floor"],
    stackSize: 64,
    material: "wood"
  },
  polished_blackstone_pressure_plate: {
    type: "pressure_plate",
    activation: "step_on",
    state: "weight_activated",
    powerOutput: 15,
    activationDelay: 0,
    deactivationDelay: 0.25,
    activatedBy: ["player", "mob", "item"],
    canBePlacedOn: ["floor"],
    stackSize: 64,
    material: "stone"
  },

  // Weighted Pressure Plates (variable power output)
  light_weighted_pressure_plate: {
    type: "pressure_plate",
    activation: "step_on",
    state: "weight_sensitive",
    powerOutput: "variable", // 0-15 based on entity count
    activationDelay: 0,
    deactivationDelay: 0,
    activatedBy: ["player", "mob", "item"],
    canBePlacedOn: ["floor"],
    stackSize: 64,
    material: "gold",
    maxEntities: 15
  },
  heavy_weighted_pressure_plate: {
    type: "pressure_plate",
    activation: "step_on",
    state: "weight_sensitive",
    powerOutput: "variable", // 0-15 based on entity count
    activationDelay: 0,
    deactivationDelay: 0,
    activatedBy: ["player", "mob", "item"],
    canBePlacedOn: ["floor"],
    stackSize: 64,
    material: "iron",
    maxEntities: 150
  },

  // Tripwire hooks (with string)
  tripwire_hook: {
    type: "tripwire",
    activation: "walk_through",
    state: "triggered",
    powerOutput: 15,
    activationDelay: 0,
    deactivationDelay: 0.15,
    requiresString: true,
    maxDistance: 40, // blocks between hooks
    detects: ["player", "mob", "item"],
    canBePlacedOn: ["wall"],
    stackSize: 64
  },

  // Special blocks
  redstone_torch: {
    type: "power_source",
    activation: "always_on",
    state: "constant",
    powerOutput: 15,
    staysActivated: true,
    canBePlacedOn: ["wall", "floor"],
    stackSize: 64,
    burnout: true // Can burn out if toggled too fast
  },
  redstone_block: {
    type: "power_source",
    activation: "always_on",
    state: "constant",
    powerOutput: 15,
    staysActivated: true,
    canBePlacedOn: ["any"],
    stackSize: 64
  },
  target: {
    type: "target",
    activation: "hit_by_projectile",
    state: "momentary",
    powerOutput: "variable", // 1-15 based on hit distance from center
    activationDuration: 1.0,
    staysActivated: false,
    canBePlacedOn: ["any"],
    stackSize: 64
  },
  lectern: {
    type: "comparator_output",
    activation: "book_page_turn",
    state: "analog",
    powerOutput: "variable", // Based on page number
    requiresBook: true,
    canBePlacedOn: ["floor"],
    stackSize: 64
  },
  daylight_detector: {
    type: "sensor",
    activation: "daylight",
    state: "analog",
    powerOutput: "variable", // 0-15 based on light level
    invertible: true,
    canBePlacedOn: ["floor"],
    stackSize: 64
  },
  observer: {
    type: "sensor",
    activation: "block_update",
    state: "momentary",
    powerOutput: 15,
    activationDuration: 0.1, // 2 ticks
    detectsBlockChanges: true,
    canBePlacedOn: ["any"],
    stackSize: 64
  },
  lightning_rod: {
    type: "sensor",
    activation: "lightning_strike",
    state: "momentary",
    powerOutput: 15,
    activationDuration: 0.4, // 8 ticks
    canBePlacedOn: ["floor"],
    stackSize: 64
  },
  sculk_sensor: {
    type: "sensor",
    activation: "vibration",
    state: "momentary",
    powerOutput: "variable", // 1-15 based on vibration frequency
    activationDuration: 2.0, // 40 ticks
    detects: ["footsteps", "block_place", "block_break", "projectile", "item_drop"],
    range: 8, // blocks
    canBePlacedOn: ["any"],
    stackSize: 64,
    woolBlocks: true // Wool blocks vibrations
  }
};

/* =====================================================
 * REDSTONE CONFIGURATION
 * Rules and mechanics for redstone interactions
 * ===================================================== */

const REDSTONE_CONFIG = {
  // Interaction settings
  interaction: {
    maxDistance: 4, // blocks
    requiresLineOfSight: true,
    activationTime: 0.1 // seconds
  },

  // Power mechanics
  power: {
    maxLevel: 15,
    minLevel: 0,
    dustDecay: 1, // Power loss per block of redstone dust
    wireMaxLength: 15 // Maximum powered wire length
  },

  // Common use cases
  useCases: {
    door_opener: {
      components: ["button", "lever"],
      placement: "adjacent_to_door",
      purpose: "Open doors (especially iron doors)"
    },
    trap_trigger: {
      components: ["pressure_plate", "tripwire"],
      placement: "floor_or_passage",
      purpose: "Detect entity movement"
    },
    hidden_entrance: {
      components: ["lever", "button"],
      placement: "concealed",
      purpose: "Secret door activation"
    },
    automatic_farm: {
      components: ["observer", "redstone_torch"],
      placement: "near_crops",
      purpose: "Detect crop growth and harvest"
    },
    mob_trap: {
      components: ["pressure_plate", "piston", "redstone"],
      placement: "trap_area",
      purpose: "Activate pistons to kill mobs"
    },
    night_light: {
      components: ["daylight_detector", "redstone_lamp"],
      placement: "outdoor_or_indoor",
      purpose: "Automatic lighting at night"
    }
  },

  // Redstone dust behavior
  dust: {
    conducts: true,
    maxDistance: 15,
    crossConnection: "auto", // Automatically connects to adjacent dust
    placement: "floor_only"
  },

  // Component interactions
  canActivate: {
    lever: ["door", "trapdoor", "piston", "dispenser", "dropper", "hopper", "redstone_lamp", "tnt", "note_block"],
    button: ["door", "trapdoor", "piston", "dispenser", "dropper", "note_block"],
    pressure_plate: ["door", "trapdoor", "piston", "dispenser", "dropper", "tnt"],
    tripwire: ["dispenser", "dropper", "piston", "tnt", "note_block"]
  }
};

/**
 * Get redstone component info
 * @param {string} componentName - Component name
 * @returns {object|null} Component info or null
 */
function getComponentInfo(componentName) {
  const normalized = normalizeItemName(componentName);
  return REDSTONE_COMPONENTS[normalized] || null;
}

/**
 * Check if item is a redstone component
 * @param {string} itemName - Item name
 * @returns {boolean} True if redstone component
 */
function isRedstoneComponent(itemName) {
  return getComponentInfo(itemName) !== null;
}

/**
 * Validate component placement
 * @param {object} component - Component data
 * @param {object} position - Target position
 * @param {object} worldData - Surrounding block data
 * @returns {object} Placement validation result
 */
function validateComponentPlacement(component, position, worldData = {}) {
  const validation = {
    valid: true,
    issues: []
  };

  if (!component) {
    validation.valid = false;
    validation.issues.push("Invalid component");
    return validation;
  }

  const info = getComponentInfo(component.type);
  if (!info) {
    validation.valid = false;
    validation.issues.push(`Unknown component type: ${component.type}`);
    return validation;
  }

  // Check placement surface
  const placementSurface = component.surface || "wall";

  if (!info.canBePlacedOn.includes(placementSurface) && !info.canBePlacedOn.includes("any")) {
    validation.valid = false;
    validation.issues.push(`${component.type} cannot be placed on ${placementSurface}`);
  }

  // Check for solid block support
  if (placementSurface === "wall" || placementSurface === "floor") {
    const supportBlock = worldData.supportBlock || null;

    if (!supportBlock || supportBlock === "air") {
      validation.valid = false;
      validation.issues.push(`${component.type} requires a solid block for support`);
    }
  }

  // Special checks for tripwire
  if (info.type === "tripwire") {
    if (component.requiresString) {
      const oppositeHook = worldData.oppositeHook || null;
      const distance = worldData.distance || 0;

      if (!oppositeHook) {
        validation.warnings = validation.warnings || [];
        validation.warnings.push("Tripwire needs two hooks with string between them");
      }

      if (distance > info.maxDistance) {
        validation.valid = false;
        validation.issues.push(`Tripwire hooks too far apart (max ${info.maxDistance} blocks)`);
      }
    }
  }

  // Check current block
  const currentBlock = worldData.currentBlock || "air";
  if (currentBlock !== "air") {
    validation.valid = false;
    validation.issues.push(`Position occupied by ${currentBlock}`);
  }

  return validation;
}

/**
 * Calculate activation duration
 * @param {string} componentType - Component type
 * @returns {number|string} Duration in seconds or "indefinite"
 */
function getActivationDuration(componentType) {
  const component = getComponentInfo(componentType);
  if (!component) return 0;

  if (component.staysActivated) {
    return "indefinite";
  }

  return component.activationDuration || 0;
}

/**
 * Determine what a component can activate
 * @param {string} componentType - Component type
 * @returns {array} List of activatable blocks
 */
function getActivatableBlocks(componentType) {
  const component = getComponentInfo(componentType);
  if (!component) return [];

  const activatableList = REDSTONE_CONFIG.canActivate[component.type] || [];
  return activatableList;
}

/**
 * Design redstone circuit for a purpose
 * @param {string} purpose - Circuit purpose
 * @param {object} requirements - Specific requirements
 * @returns {object} Circuit design
 */
function designRedstoneCircuit(purpose, requirements = {}) {
  const useCase = REDSTONE_CONFIG.useCases[purpose] || null;

  if (!useCase) {
    return {
      error: "Unknown circuit purpose",
      availablePurposes: Object.keys(REDSTONE_CONFIG.useCases)
    };
  }

  const design = {
    purpose: purpose,
    description: useCase.purpose,
    components: useCase.components.map(c => ({
      type: c,
      count: 1,
      info: getComponentInfo(c)
    })),
    placement: useCase.placement,
    additionalMaterials: ["redstone_dust"],
    estimatedComplexity: "medium",
    steps: []
  };

  // Add construction steps based on purpose
  switch (purpose) {
    case "door_opener":
      design.steps.push("Place button or lever adjacent to door");
      design.steps.push("Optionally add redstone dust for remote activation");
      design.estimatedComplexity = "easy";
      break;

    case "trap_trigger":
      design.steps.push("Place pressure plate or tripwire hooks");
      design.steps.push("Connect to dispenser or piston with redstone");
      design.steps.push("Load dispenser with arrows or fill piston chamber");
      design.estimatedComplexity = "medium";
      break;

    case "hidden_entrance":
      design.steps.push("Conceal lever or button near entrance");
      design.steps.push("Run redstone behind walls to piston door");
      design.steps.push("Test activation and ensure door closes properly");
      design.estimatedComplexity = "hard";
      break;

    case "automatic_farm":
      design.steps.push("Place observers facing crops");
      design.steps.push("Connect observers to pistons with redstone");
      design.steps.push("Add water channels for crop collection");
      design.estimatedComplexity = "hard";
      break;

    case "night_light":
      design.steps.push("Place daylight detector");
      design.steps.push("Right-click to invert (optional)");
      design.steps.push("Connect to redstone lamps");
      design.estimatedComplexity = "easy";
      break;
  }

  return design;
}

/* =====================================================
 * REDSTONE ACTIVATION TASK PLANNER
 * Main function for creating activation plans
 * ===================================================== */

/**
 * Plan redstone activation task
 * @param {object} goal - Task goal with component and action
 * @param {object} context - Game context
 * @returns {object} Activation plan
 */
export function planRedstoneTask(goal = {}, context = {}) {
  const componentTarget = goal.component || context.targetComponent;
  const action = goal.action || "activate"; // "activate", "deactivate", "toggle"
  const playerPos = context.playerPosition || { x: 0, y: 0, z: 0 };

  const plan = createPlan("redstone", `${action} redstone component`, {
    priority: "normal",
    estimatedDuration: 0.5,
    safety: "normal"
  });

  if (!componentTarget) {
    plan.status = "failed";
    plan.error = "No redstone component specified";
    plan.suggestion = "Target a lever, button, or pressure plate";
    return plan;
  }

  const component = getComponentInfo(componentTarget.type || componentTarget);

  if (!component) {
    plan.status = "failed";
    plan.error = `'${componentTarget}' is not a valid redstone component`;
    return plan;
  }

  // Build interaction steps based on component type
  switch (component.type) {
    case "switch": // Levers
      plan.steps.push(createStep(
        "toggle_lever",
        `Toggle lever ${action === "activate" ? "ON" : "OFF"}`,
        {
          component: componentTarget,
          currentState: componentTarget.state || "off",
          newState: action === "activate" ? "on" : "off",
          duration: "indefinite",
          powerOutput: component.powerOutput
        }
      ));
      break;

    case "button":
      plan.steps.push(createStep(
        "press_button",
        `Press ${componentTarget.type || "button"}`,
        {
          component: componentTarget,
          activationDuration: component.activationDuration,
          powerOutput: component.powerOutput,
          note: `Button will stay activated for ${component.activationDuration}s`
        }
      ));
      break;

    case "pressure_plate":
      plan.steps.push(createStep(
        "step_on_plate",
        `Step on ${componentTarget.type || "pressure plate"}`,
        {
          component: componentTarget,
          activatedBy: component.activatedBy,
          deactivationDelay: component.deactivationDelay,
          note: "Plate will deactivate when weight is removed"
        }
      ));
      break;

    case "target":
      plan.steps.push(createStep(
        "shoot_target",
        "Hit target block with projectile",
        {
          component: componentTarget,
          powerOutput: "1-15 based on accuracy",
          note: "Closer to center = higher signal strength"
        }
      ));
      break;

    default:
      plan.steps.push(createStep(
        "interact_component",
        `Interact with ${componentTarget.type}`,
        {
          component: componentTarget,
          interactionType: component.activation
        }
      ));
  }

  // Add outcome
  plan.outcome = {
    componentType: component.type,
    activation: component.activation,
    powerOutput: component.powerOutput,
    duration: getActivationDuration(componentTarget.type || componentTarget),
    canActivate: getActivatableBlocks(componentTarget.type || componentTarget)
  };

  return plan;
}

/**
 * Plan redstone circuit construction
 * @param {object} goal - Circuit specifications
 * @param {object} context - Game context
 * @returns {object} Circuit construction plan
 */
function planRedstoneCircuit(goal = {}, context = {}) {
  const purpose = goal.purpose || "door_opener";
  const inventory = context.inventory || {};

  const design = designRedstoneCircuit(purpose, goal.requirements);

  if (design.error) {
    return {
      status: "failed",
      error: design.error,
      suggestion: `Available purposes: ${design.availablePurposes.join(", ")}`
    };
  }

  const plan = createPlan("build_redstone_circuit", `Build ${purpose} circuit`, {
    priority: "normal",
    estimatedDuration: 120,
    complexity: design.estimatedComplexity
  });

  // Check materials
  const materialsNeeded = {};
  design.components.forEach(c => {
    materialsNeeded[c.type] = (materialsNeeded[c.type] || 0) + c.count;
  });
  materialsNeeded.redstone_dust = 10; // Estimate

  const missing = [];
  for (const [item, count] of Object.entries(materialsNeeded)) {
    if (!hasInventoryItem(inventory, item) || (inventory[item]?.count || 0) < count) {
      missing.push(`${item} (need ${count}, have ${inventory[item]?.count || 0})`);
    }
  }

  if (missing.length > 0) {
    plan.status = "blocked";
    plan.error = "Missing materials";
    plan.missingMaterials = missing;
    return plan;
  }

  // Add construction steps
  design.steps.forEach((stepDesc, i) => {
    plan.steps.push(createStep(
      `circuit_step_${i + 1}`,
      stepDesc,
      { stepNumber: i + 1, totalSteps: design.steps.length }
    ));
  });

  plan.steps.push(createStep(
    "test_circuit",
    "Test circuit activation",
    { purpose: design.purpose }
  ));

  plan.outcome = {
    circuitPurpose: design.purpose,
    components: design.components.map(c => c.type),
    complexity: design.estimatedComplexity
  };

  return plan;
}

/* =====================================================
 * EXPORTS
 * ===================================================== */

export default planRedstoneTask;
export {
  REDSTONE_COMPONENTS,
  REDSTONE_CONFIG,
  getComponentInfo,
  isRedstoneComponent,
  validateComponentPlacement,
  getActivationDuration,
  getActivatableBlocks,
  designRedstoneCircuit,
  planRedstoneCircuit
};
