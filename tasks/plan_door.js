// tasks/plan_door.js
// Door, trapdoor, and gate interaction system
// Implements opening/closing mechanics for all door types

import {
  createPlan,
  createStep,
  describeTarget,
  normalizeItemName
} from "./helpers.js";

/* =====================================================
 * DOOR DATABASE
 * All door types, trapdoors, and gates with properties
 * ===================================================== */

const DOOR_TYPES = {
  // Wooden doors (can be opened by hand or redstone)
  oak_door: {
    type: "door",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "wooden_door_open",
    soundClose: "wooden_door_close",
    zombieBreakable: true, // On hard difficulty
    stackSize: 64
  },
  spruce_door: {
    type: "door",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "wooden_door_open",
    soundClose: "wooden_door_close",
    zombieBreakable: true,
    stackSize: 64
  },
  birch_door: {
    type: "door",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "wooden_door_open",
    soundClose: "wooden_door_close",
    zombieBreakable: true,
    stackSize: 64
  },
  jungle_door: {
    type: "door",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "wooden_door_open",
    soundClose: "wooden_door_close",
    zombieBreakable: true,
    stackSize: 64
  },
  acacia_door: {
    type: "door",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "wooden_door_open",
    soundClose: "wooden_door_close",
    zombieBreakable: true,
    stackSize: 64
  },
  dark_oak_door: {
    type: "door",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "wooden_door_open",
    soundClose: "wooden_door_close",
    zombieBreakable: true,
    stackSize: 64
  },
  mangrove_door: {
    type: "door",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "wooden_door_open",
    soundClose: "wooden_door_close",
    zombieBreakable: true,
    stackSize: 64
  },
  cherry_door: {
    type: "door",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "wooden_door_open",
    soundClose: "wooden_door_close",
    zombieBreakable: true,
    stackSize: 64
  },
  bamboo_door: {
    type: "door",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "wooden_door_open",
    soundClose: "wooden_door_close",
    zombieBreakable: true,
    stackSize: 64
  },
  crimson_door: {
    type: "door",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "wooden_door_open",
    soundClose: "wooden_door_close",
    zombieBreakable: true,
    stackSize: 64
  },
  warped_door: {
    type: "door",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "wooden_door_open",
    soundClose: "wooden_door_close",
    zombieBreakable: true,
    stackSize: 64
  },

  // Iron door (requires redstone only)
  iron_door: {
    type: "door",
    material: "iron",
    openMethod: "redstone_only",
    soundOpen: "iron_door_open",
    soundClose: "iron_door_close",
    zombieBreakable: false,
    stackSize: 64,
    requiresPower: true
  },

  // Trapdoors (wooden - can be opened by hand or redstone)
  oak_trapdoor: {
    type: "trapdoor",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "wooden_trapdoor_open",
    soundClose: "wooden_trapdoor_close",
    waterloggable: true,
    stackSize: 64
  },
  spruce_trapdoor: {
    type: "trapdoor",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "wooden_trapdoor_open",
    soundClose: "wooden_trapdoor_close",
    waterloggable: true,
    stackSize: 64
  },
  birch_trapdoor: {
    type: "trapdoor",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "wooden_trapdoor_open",
    soundClose: "wooden_trapdoor_close",
    waterloggable: true,
    stackSize: 64
  },
  jungle_trapdoor: {
    type: "trapdoor",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "wooden_trapdoor_open",
    soundClose: "wooden_trapdoor_close",
    waterloggable: true,
    stackSize: 64
  },
  acacia_trapdoor: {
    type: "trapdoor",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "wooden_trapdoor_open",
    soundClose: "wooden_trapdoor_close",
    waterloggable: true,
    stackSize: 64
  },
  dark_oak_trapdoor: {
    type: "trapdoor",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "wooden_trapdoor_open",
    soundClose: "wooden_trapdoor_close",
    waterloggable: true,
    stackSize: 64
  },
  mangrove_trapdoor: {
    type: "trapdoor",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "wooden_trapdoor_open",
    soundClose: "wooden_trapdoor_close",
    waterloggable: true,
    stackSize: 64
  },
  cherry_trapdoor: {
    type: "trapdoor",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "wooden_trapdoor_open",
    soundClose: "wooden_trapdoor_close",
    waterloggable: true,
    stackSize: 64
  },
  bamboo_trapdoor: {
    type: "trapdoor",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "wooden_trapdoor_open",
    soundClose: "wooden_trapdoor_close",
    waterloggable: true,
    stackSize: 64
  },
  crimson_trapdoor: {
    type: "trapdoor",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "wooden_trapdoor_open",
    soundClose: "wooden_trapdoor_close",
    waterloggable: true,
    stackSize: 64
  },
  warped_trapdoor: {
    type: "trapdoor",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "wooden_trapdoor_open",
    soundClose: "wooden_trapdoor_close",
    waterloggable: true,
    stackSize: 64
  },

  // Iron trapdoor (requires redstone only)
  iron_trapdoor: {
    type: "trapdoor",
    material: "iron",
    openMethod: "redstone_only",
    soundOpen: "iron_trapdoor_open",
    soundClose: "iron_trapdoor_close",
    waterloggable: true,
    requiresPower: true,
    stackSize: 64
  },

  // Fence gates (all can be opened by hand or redstone)
  oak_fence_gate: {
    type: "fence_gate",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "fence_gate_open",
    soundClose: "fence_gate_close",
    stackSize: 64
  },
  spruce_fence_gate: {
    type: "fence_gate",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "fence_gate_open",
    soundClose: "fence_gate_close",
    stackSize: 64
  },
  birch_fence_gate: {
    type: "fence_gate",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "fence_gate_open",
    soundClose: "fence_gate_close",
    stackSize: 64
  },
  jungle_fence_gate: {
    type: "fence_gate",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "fence_gate_open",
    soundClose: "fence_gate_close",
    stackSize: 64
  },
  acacia_fence_gate: {
    type: "fence_gate",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "fence_gate_open",
    soundClose: "fence_gate_close",
    stackSize: 64
  },
  dark_oak_fence_gate: {
    type: "fence_gate",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "fence_gate_open",
    soundClose: "fence_gate_close",
    stackSize: 64
  },
  mangrove_fence_gate: {
    type: "fence_gate",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "fence_gate_open",
    soundClose: "fence_gate_close",
    stackSize: 64
  },
  cherry_fence_gate: {
    type: "fence_gate",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "fence_gate_open",
    soundClose: "fence_gate_close",
    stackSize: 64
  },
  bamboo_fence_gate: {
    type: "fence_gate",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "fence_gate_open",
    soundClose: "fence_gate_close",
    stackSize: 64
  },
  crimson_fence_gate: {
    type: "fence_gate",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "fence_gate_open",
    soundClose: "fence_gate_close",
    stackSize: 64
  },
  warped_fence_gate: {
    type: "fence_gate",
    material: "wood",
    openMethod: "hand_or_redstone",
    soundOpen: "fence_gate_open",
    soundClose: "fence_gate_close",
    stackSize: 64
  }
};

/* =====================================================
 * DOOR INTERACTION CONFIG
 * Rules and mechanics for door operations
 * ===================================================== */

const DOOR_CONFIG = {
  // Interaction settings
  interaction: {
    maxDistance: 4, // blocks
    requiresLineOfSight: true,
    interactionTime: 0.15 // seconds
  },

  // Door states
  states: {
    open: {
      passable: true,
      blocksMobs: false,
      blocksProjectiles: false
    },
    closed: {
      passable: false,
      blocksMobs: true,
      blocksProjectiles: true
    }
  },

  // Redstone mechanics
  redstone: {
    activationSources: [
      "lever",
      "button",
      "pressure_plate",
      "tripwire",
      "redstone_torch",
      "redstone_block",
      "observer",
      "comparator"
    ],
    powerRequired: 1, // Minimum power level
    stayOpenDuration: {
      button: 1.0, // seconds (wooden button)
      stone_button: 1.0,
      lever: Infinity, // Until toggled
      pressure_plate: "while_pressed"
    }
  },

  // Mob interaction
  mobs: {
    zombieBreaking: {
      enabled: true,
      difficulty: "hard", // Only on hard difficulty
      breakTime: 30, // seconds
      doorTypes: ["wooden"], // Only wooden doors
      preventable: true,
      prevention: ["iron_door", "fence_gate", "proper_lighting"]
    },
    villagerOpening: {
      enabled: true,
      doorTypes: ["wooden"], // Villagers can open wooden doors
      closeBehind: true,
      onlyDuringDay: false
    }
  },

  // Usage patterns
  patterns: {
    airlock: {
      description: "Two doors with space between for mob-proof entry",
      doorCount: 2,
      spacing: 2, // blocks
      mechanism: "manual_or_pressure_plate"
    },
    piston_door: {
      description: "Hidden door using pistons and redstone",
      doorCount: 0, // No actual doors
      mechanism: "redstone_circuit",
      complexity: "advanced"
    },
    iron_door_security: {
      description: "Iron door with button/lever for secure entry",
      doorCount: 1,
      mechanism: "button_lever_or_pressure_plate",
      security: "high"
    }
  }
};

/**
 * Get door information
 * @param {string} doorName - Door/trapdoor/gate name
 * @returns {object|null} Door info or null
 */
function getDoorInfo(doorName) {
  const normalized = normalizeItemName(doorName);
  return DOOR_TYPES[normalized] || null;
}

/**
 * Check if item is a door/trapdoor/gate
 * @param {string} itemName - Item name
 * @returns {boolean} True if item is a door type
 */
function isDoor(itemName) {
  return getDoorInfo(itemName) !== null;
}

/**
 * Check if door can be opened by hand
 * @param {string} doorName - Door name
 * @returns {boolean} True if can be opened by hand
 */
function canOpenByHand(doorName) {
  const door = getDoorInfo(doorName);
  if (!door) return false;
  return door.openMethod === "hand_or_redstone";
}

/**
 * Check if door requires redstone
 * @param {string} doorName - Door name
 * @returns {boolean} True if requires redstone
 */
function requiresRedstone(doorName) {
  const door = getDoorInfo(doorName);
  if (!door) return false;
  return door.openMethod === "redstone_only";
}

/**
 * Validate door interaction
 * @param {object} doorBlock - Door block data
 * @param {object} playerPos - Player position
 * @param {object} context - Additional context
 * @returns {object} Validation result
 */
function validateDoorInteraction(doorBlock, playerPos, context = {}) {
  const validation = {
    canInteract: true,
    blockers: []
  };

  if (!doorBlock || !doorBlock.type) {
    validation.canInteract = false;
    validation.blockers.push("No door found at target location");
    return validation;
  }

  const door = getDoorInfo(doorBlock.type);
  if (!door) {
    validation.canInteract = false;
    validation.blockers.push(`${doorBlock.type} is not a valid door`);
    return validation;
  }

  // Check distance
  if (doorBlock.position) {
    const dx = doorBlock.position.x - playerPos.x;
    const dy = doorBlock.position.y - playerPos.y;
    const dz = doorBlock.position.z - playerPos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance > DOOR_CONFIG.interaction.maxDistance) {
      validation.canInteract = false;
      validation.blockers.push(`Door is too far away (${distance.toFixed(1)} blocks)`);
    }
  }

  // Check if door requires redstone
  if (requiresRedstone(doorBlock.type)) {
    validation.requiresRedstone = true;
    validation.canInteract = false;
    validation.blockers.push(`${doorBlock.type} can only be opened with redstone`);
    validation.suggestions = [
      "Place a button next to the door",
      "Use a lever for permanent opening",
      "Add a pressure plate for automatic opening"
    ];
  }

  return validation;
}

/**
 * Determine door state change
 * @param {object} doorBlock - Current door block state
 * @param {string} action - Desired action ("open", "close", "toggle")
 * @returns {object} State change info
 */
function determineDoorStateChange(doorBlock, action = "toggle") {
  const currentState = doorBlock.open ? "open" : "closed";
  let newState = currentState;

  switch (action) {
    case "open":
      newState = "open";
      break;
    case "close":
      newState = "closed";
      break;
    case "toggle":
      newState = currentState === "open" ? "closed" : "open";
      break;
  }

  return {
    currentState,
    newState,
    changed: currentState !== newState,
    action: newState === "open" ? "opening" : "closing"
  };
}

/**
 * Plan redstone activation for door
 * @param {object} doorBlock - Door block data
 * @param {string} mechanism - Redstone mechanism to use
 * @returns {object} Redstone activation plan
 */
function planRedstoneActivation(doorBlock, mechanism = "button") {
  const door = getDoorInfo(doorBlock.type);

  const plan = {
    mechanism,
    placement: null,
    duration: null,
    materials: []
  };

  switch (mechanism) {
    case "button":
      plan.placement = "adjacent_to_door";
      plan.duration = DOOR_CONFIG.redstone.stayOpenDuration.button;
      plan.materials = ["button"];
      plan.automatic = false;
      break;

    case "lever":
      plan.placement = "adjacent_to_door";
      plan.duration = "until_toggled";
      plan.materials = ["lever"];
      plan.automatic = false;
      break;

    case "pressure_plate":
      plan.placement = "in_front_of_door";
      plan.duration = "while_pressed";
      plan.materials = ["pressure_plate"];
      plan.automatic = true;
      plan.warning = "Mobs may trigger pressure plate";
      break;

    case "tripwire":
      plan.placement = "in_front_of_door_with_hooks";
      plan.duration = "while_triggered";
      plan.materials = ["tripwire_hook", "string"];
      plan.automatic = true;
      plan.complexity = "medium";
      break;
  }

  return plan;
}

/**
 * Get security assessment for door setup
 * @param {object} doorSetup - Door configuration
 * @returns {object} Security assessment
 */
function assessDoorSecurity(doorSetup = {}) {
  const assessment = {
    securityLevel: "low",
    vulnerabilities: [],
    recommendations: []
  };

  const doorType = doorSetup.doorType || "oak_door";
  const door = getDoorInfo(doorType);

  if (!door) {
    assessment.securityLevel = "none";
    assessment.vulnerabilities.push("Invalid door type");
    return assessment;
  }

  // Check door material
  if (door.material === "iron") {
    assessment.securityLevel = "high";
  } else if (door.material === "wood") {
    assessment.securityLevel = "medium";

    // Wooden doors vulnerable to zombies on hard
    if (door.zombieBreakable) {
      assessment.vulnerabilities.push("Zombies can break wooden doors on hard difficulty");
      assessment.recommendations.push("Consider using iron door or fence gate");
    }

    // Villagers can open wooden doors
    if (doorSetup.nearVillagers) {
      assessment.vulnerabilities.push("Villagers can open wooden doors");
      assessment.recommendations.push("Use iron door or fence gate to prevent villager entry");
    }
  }

  // Check for airlock
  if (doorSetup.airlockSetup) {
    assessment.securityLevel = "high";
    assessment.features = assessment.features || [];
    assessment.features.push("Airlock prevents mob entry");
  }

  // Check lighting
  if (doorSetup.lightLevel < 7) {
    assessment.vulnerabilities.push("Low light level allows mob spawning near door");
    assessment.recommendations.push("Add torches or other light sources (light level 7+)");
  }

  // Check redstone mechanism
  if (door.requiresPower) {
    if (!doorSetup.redstoneMechanism) {
      assessment.vulnerabilities.push("Iron door has no activation mechanism");
      assessment.recommendations.push("Add button, lever, or pressure plate");
    } else if (doorSetup.redstoneMechanism === "pressure_plate") {
      assessment.vulnerabilities.push("Pressure plates can be triggered by mobs");
      assessment.recommendations.push("Use button or lever for more control");
    }
  }

  return assessment;
}

/* =====================================================
 * DOOR TASK PLANNER
 * Main function for creating door interaction plans
 * ===================================================== */

/**
 * Plan door interaction task
 * @param {object} goal - Task goal with door and action
 * @param {object} context - Game context
 * @returns {object} Door interaction plan
 */
export function planDoorTask(goal = {}, context = {}) {
  const action = goal.action || "toggle"; // "open", "close", "toggle"
  const doorBlock = goal.door || context.targetDoor;
  const playerPos = context.playerPosition || { x: 0, y: 0, z: 0 };

  const plan = createPlan("door", `${action} door`, {
    priority: "normal",
    estimatedDuration: 0.5,
    safety: "normal"
  });

  if (!doorBlock) {
    plan.status = "failed";
    plan.error = "No door specified";
    plan.suggestion = "Target a door or provide door location";
    return plan;
  }

  // Validate interaction
  const validation = validateDoorInteraction(doorBlock, playerPos, context);

  if (!validation.canInteract) {
    plan.status = "blocked";
    plan.blockers = validation.blockers;

    if (validation.requiresRedstone) {
      plan.requiresRedstone = true;
      plan.suggestions = validation.suggestions;
      plan.redstonePlan = planRedstoneActivation(doorBlock, "button");
    }

    return plan;
  }

  const door = getDoorInfo(doorBlock.type);
  const stateChange = determineDoorStateChange(doorBlock, action);

  // Build interaction steps

  // Step 1: Navigate to door if needed
  if (doorBlock.position) {
    const distance = Math.sqrt(
      Math.pow(doorBlock.position.x - playerPos.x, 2) +
      Math.pow(doorBlock.position.z - playerPos.z, 2)
    );

    if (distance > 3) {
      plan.steps.push(createStep(
        "navigate_to_door",
        describeTarget(doorBlock.position, `Move to ${door.type} at`),
        {
          target: doorBlock.position,
          maxDistance: 3
        }
      ));
    }
  }

  // Step 2: Interact with door
  if (stateChange.changed) {
    plan.steps.push(createStep(
      "interact_door",
      `${stateChange.action} ${door.type}`,
      {
        door: doorBlock.position,
        currentState: stateChange.currentState,
        newState: stateChange.newState,
        interactionTime: DOOR_CONFIG.interaction.interactionTime
      }
    ));
  } else {
    plan.steps.push(createStep(
      "no_change",
      `Door is already ${stateChange.currentState}`,
      { skip: true }
    ));
  }

  // Add outcome
  plan.outcome = {
    doorType: door.type,
    previousState: stateChange.currentState,
    newState: stateChange.newState,
    changed: stateChange.changed
  };

  return plan;
}

/**
 * Plan airlock construction
 * @param {object} goal - Airlock specifications
 * @param {object} context - Game context
 * @returns {object} Airlock construction plan
 */
function planAirlockConstruction(goal = {}, context = {}) {
  const doorType = goal.doorType || "oak_door";
  const position = goal.position || context.playerPosition;

  const plan = createPlan("build_airlock", "Construct mob-proof airlock", {
    priority: "normal",
    estimatedDuration: 60,
    complexity: "medium"
  });

  const pattern = DOOR_CONFIG.patterns.airlock;

  plan.steps.push(createStep(
    "gather_materials",
    `Gather materials: ${pattern.doorCount} ${doorType}, blocks for walls`,
    {
      materials: {
        [doorType]: pattern.doorCount,
        building_blocks: 20,
        torches: 4
      }
    }
  ));

  plan.steps.push(createStep(
    "build_structure",
    `Build airlock structure (${pattern.spacing} blocks deep)`,
    {
      dimensions: { width: 3, depth: pattern.spacing + 2, height: 3 },
      position: position
    }
  ));

  plan.steps.push(createStep(
    "place_doors",
    `Place ${pattern.doorCount} doors with ${pattern.spacing} blocks between`,
    {
      doorCount: pattern.doorCount,
      spacing: pattern.spacing
    }
  ));

  plan.steps.push(createStep(
    "add_lighting",
    "Add torches inside airlock (light level 7+)",
    { torches: 4 }
  ));

  plan.outcome = {
    structure: "airlock",
    security: "high",
    mobProof: true,
    doorCount: pattern.doorCount
  };

  return plan;
}

/* =====================================================
 * EXPORTS
 * ===================================================== */

export default planDoorTask;
export {
  DOOR_TYPES,
  DOOR_CONFIG,
  getDoorInfo,
  isDoor,
  canOpenByHand,
  requiresRedstone,
  validateDoorInteraction,
  determineDoorStateChange,
  planRedstoneActivation,
  assessDoorSecurity,
  planAirlockConstruction
};
