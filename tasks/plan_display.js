// tasks/plan_display.js
// Item frame and armor stand display system
// Implements decorative displays, item showcasing, and armor stand posing

import {
  createPlan,
  createStep,
  describeTarget,
  normalizeItemName,
  hasInventoryItem
} from "./helpers.js";

/* =====================================================
 * DISPLAY ITEM DATABASE
 * All displayable items and their properties
 * ===================================================== */

const DISPLAY_ITEMS = {
  item_frame: {
    type: "wall_display",
    stackSize: 64,
    canContain: "any_item",
    rotations: 8, // 45-degree increments
    canGlow: false,
    canBeInvisible: false,
    placement: ["wall", "floor", "ceiling"],
    crafting: {
      materials: ["stick", "leather"],
      pattern: "8 sticks + 1 leather",
      yield: 1
    }
  },

  glow_item_frame: {
    type: "wall_display",
    stackSize: 64,
    canContain: "any_item",
    rotations: 8,
    canGlow: true,
    glowEffect: "illuminates_item",
    canBeInvisible: false,
    placement: ["wall", "floor", "ceiling"],
    crafting: {
      materials: ["item_frame", "glow_ink_sac"],
      pattern: "1 item frame + 1 glow ink sac",
      yield: 1
    }
  },

  armor_stand: {
    type: "entity_display",
    stackSize: 16,
    canContain: {
      helmet: true,
      chestplate: true,
      leggings: true,
      boots: true,
      mainHand: true,
      offHand: true
    },
    hasArms: false,
    hasBasePlate: true,
    canPose: true,
    poses: ["default", "walking", "running", "sneaking", "blocking", "pointing", "saluting", "dabbing", "sitting"],
    canBeInvisible: true,
    canShowName: true,
    placement: ["floor"],
    crafting: {
      materials: ["stick", "stone_slab"],
      pattern: "6 sticks + 1 stone slab",
      yield: 1
    }
  }
};

/* =====================================================
 * ARMOR STAND POSES DATABASE
 * Predefined poses with rotation values
 * ===================================================== */

const ARMOR_STAND_POSES = {
  default: {
    head: { x: 0, y: 0, z: 0 },
    body: { x: 0, y: 0, z: 0 },
    leftArm: { x: -10, y: 0, z: -10 },
    rightArm: { x: -15, y: 0, z: 10 },
    leftLeg: { x: -1, y: 0, z: -1 },
    rightLeg: { x: 1, y: 0, z: 1 }
  },

  walking: {
    head: { x: 0, y: 10, z: 0 },
    body: { x: 0, y: 0, z: 0 },
    leftArm: { x: -20, y: 0, z: 0 },
    rightArm: { x: 20, y: 0, z: 0 },
    leftLeg: { x: 30, y: 0, z: 0 },
    rightLeg: { x: -30, y: 0, z: 0 }
  },

  running: {
    head: { x: 10, y: 0, z: 0 },
    body: { x: 10, y: 0, z: 0 },
    leftArm: { x: -40, y: 0, z: 0 },
    rightArm: { x: 40, y: 0, z: 0 },
    leftLeg: { x: 50, y: 0, z: 0 },
    rightLeg: { x: -50, y: 0, z: 0 }
  },

  sneaking: {
    head: { x: 20, y: 0, z: 0 },
    body: { x: 20, y: 0, z: 0 },
    leftArm: { x: -10, y: 0, z: -5 },
    rightArm: { x: -10, y: 0, z: 5 },
    leftLeg: { x: 40, y: 0, z: -5 },
    rightLeg: { x: 40, y: 0, z: 5 }
  },

  blocking: {
    head: { x: 0, y: 0, z: 0 },
    body: { x: 0, y: 0, z: 0 },
    leftArm: { x: -90, y: 45, z: 0 },
    rightArm: { x: -90, y: 0, z: 0 },
    leftLeg: { x: 0, y: 0, z: 0 },
    rightLeg: { x: 0, y: 0, z: 0 }
  },

  pointing: {
    head: { x: 0, y: 20, z: 0 },
    body: { x: 0, y: 10, z: 0 },
    leftArm: { x: -10, y: 0, z: 0 },
    rightArm: { x: -90, y: 0, z: 0 },
    leftLeg: { x: 0, y: 0, z: 0 },
    rightLeg: { x: 5, y: 0, z: 0 }
  },

  saluting: {
    head: { x: 0, y: 0, z: 0 },
    body: { x: 0, y: 0, z: 0 },
    leftArm: { x: -10, y: 0, z: 0 },
    rightArm: { x: -110, y: 30, z: 0 },
    leftLeg: { x: 0, y: 0, z: 0 },
    rightLeg: { x: 0, y: 0, z: 0 }
  },

  dabbing: {
    head: { x: 0, y: -20, z: 0 },
    body: { x: 0, y: -10, z: 0 },
    leftArm: { x: -10, y: 180, z: 0 },
    rightArm: { x: -110, y: 20, z: 0 },
    leftLeg: { x: 0, y: 0, z: 0 },
    rightLeg: { x: 0, y: 0, z: 0 }
  },

  sitting: {
    head: { x: 0, y: 0, z: 0 },
    body: { x: 0, y: 0, z: 0 },
    leftArm: { x: -80, y: -10, z: 0 },
    rightArm: { x: -80, y: 10, z: 0 },
    leftLeg: { x: 90, y: 10, z: 0 },
    rightLeg: { x: 90, y: -10, z: 0 }
  }
};

/* =====================================================
 * DISPLAY CONFIGURATION
 * Rules and mechanics for displays
 * ===================================================== */

const DISPLAY_CONFIG = {
  // Item frame mechanics
  itemFrame: {
    rotationDegrees: 45, // Degrees per rotation step
    totalRotations: 8,
    removeMethod: "punch_or_right_click",
    dropOnBreak: true,
    protectedByInvisibility: false
  },

  // Armor stand mechanics
  armorStand: {
    equipSlots: ["head", "chest", "legs", "feet", "mainHand", "offHand"],
    interactions: {
      right_click: "swap_armor",
      right_click_with_armor: "equip_armor",
      shift_right_click: "pose_menu",
      punch: "break"
    },
    hasGravity: true,
    canBeInvisible: true,
    canShowArms: true, // Requires NBT edit or command
    canHaveBasePlate: true,
    canBeSmall: true // Requires NBT edit or command
  },

  // Display uses
  useCases: {
    item_showcase: {
      display: "item_frame",
      purpose: "Show off rare items, tools, or trophies",
      placement: "wall",
      lighting: "recommended"
    },
    map_wall: {
      display: "item_frame",
      purpose: "Create large map displays",
      placement: "wall_grid",
      items: "maps"
    },
    armor_display: {
      display: "armor_stand",
      purpose: "Showcase armor sets",
      placement: "floor",
      items: "armor_pieces"
    },
    statue: {
      display: "armor_stand",
      purpose: "Create decorative statues",
      placement: "floor",
      pose: "custom"
    },
    shop_display: {
      display: "both",
      purpose: "Display items for trading",
      placement: "mixed"
    }
  }
};

/**
 * Get display item info
 * @param {string} itemName - Display item name
 * @returns {object|null} Display info or null
 */
function getDisplayInfo(itemName) {
  const normalized = normalizeItemName(itemName);
  return DISPLAY_ITEMS[normalized] || null;
}

/**
 * Check if item can be displayed
 * @param {string} itemName - Item name
 * @returns {boolean} True if displayable
 */
function isDisplayable(itemName) {
  // Most items can be displayed in item frames
  // Only certain items can be equipped on armor stands
  return true; // Simplified - in reality would check item type
}

/**
 * Get armor stand pose
 * @param {string} poseName - Pose name
 * @returns {object|null} Pose data or null
 */
function getArmorStandPose(poseName) {
  const normalized = normalizeItemName(poseName);
  return ARMOR_STAND_POSES[normalized] || null;
}

/**
 * Calculate item frame grid
 * @param {number} rows - Number of rows
 * @param {number} columns - Number of columns
 * @param {object} startPos - Starting position
 * @returns {object} Grid layout
 */
function calculateItemFrameGrid(rows, columns, startPos) {
  const frames = [];
  const totalFrames = rows * columns;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      frames.push({
        position: {
          x: startPos.x + col,
          y: startPos.y - row,
          z: startPos.z
        },
        row,
        column: col,
        index: row * columns + col
      });
    }
  }

  return {
    rows,
    columns,
    totalFrames,
    frames,
    dimensions: {
      width: columns,
      height: rows
    },
    materials: {
      item_frame: totalFrames
    }
  };
}

/**
 * Design display showcase
 * @param {string} showcaseType - Type of showcase
 * @param {object} items - Items to display
 * @returns {object} Showcase design
 */
function designDisplayShowcase(showcaseType, items = []) {
  const useCase = DISPLAY_CONFIG.useCases[showcaseType];

  if (!useCase) {
    return {
      error: "Unknown showcase type",
      availableTypes: Object.keys(DISPLAY_CONFIG.useCases)
    };
  }

  const design = {
    type: showcaseType,
    purpose: useCase.purpose,
    displayType: useCase.display,
    placement: useCase.placement,
    items: items.length,
    buildSteps: []
  };

  switch (showcaseType) {
    case "item_showcase":
      design.buildSteps = [
        "Choose wall location with good lighting",
        "Place item frames in desired pattern",
        "Right-click frames to add items",
        "Right-click to rotate items to desired angle"
      ];
      design.materials = {
        item_frame: items.length,
        torches: Math.ceil(items.length / 4)
      };
      break;

    case "map_wall":
      const gridSize = Math.ceil(Math.sqrt(items.length));
      design.grid = calculateItemFrameGrid(gridSize, gridSize, { x: 0, y: 0, z: 0 });
      design.buildSteps = [
        `Place ${design.grid.totalFrames} item frames in ${gridSize}x${gridSize} grid`,
        "Fill frames with maps in correct order",
        "Maps should be numbered/connected for large display"
      ];
      design.materials = design.grid.materials;
      break;

    case "armor_display":
      design.buildSteps = [
        "Place armor stand on floor",
        "Right-click with helmet to equip head",
        "Right-click with chestplate to equip chest",
        "Right-click with leggings to equip legs",
        "Right-click with boots to equip feet",
        "Optional: Add weapon to hand"
      ];
      design.materials = {
        armor_stand: 1,
        armor_pieces: 4,
        weapon: 1
      };
      break;

    case "statue":
      design.buildSteps = [
        "Place armor stand on floor",
        "Equip armor/items as desired",
        "Use pose editor or commands to set pose",
        "Optional: Make invisible (requires commands)",
        "Add lighting or pedestal"
      ];
      design.materials = {
        armor_stand: 1,
        building_blocks: 4,
        torches: 2
      };
      design.poses = Object.keys(ARMOR_STAND_POSES);
      break;

    case "shop_display":
      design.buildSteps = [
        "Place item frames for product display",
        "Place armor stands for armor showcase",
        "Add signs with prices",
        "Add chest for purchases",
        "Light area well"
      ];
      design.materials = {
        item_frame: Math.ceil(items.length * 0.7),
        armor_stand: Math.ceil(items.length * 0.3),
        sign: items.length,
        chest: 1,
        torches: 4
      };
      break;
  }

  return design;
}

/* =====================================================
 * DISPLAY TASK PLANNERS
 * Main functions for creating display plans
 * ===================================================== */

/**
 * Plan item frame placement
 * @param {object} goal - Task goal
 * @param {object} context - Game context
 * @returns {object} Item frame plan
 */
export function planItemFrameTask(goal = {}, context = {}) {
  const item = goal.item;
  const position = goal.position || context.targetPosition;
  const inventory = context.inventory || {};

  const plan = createPlan("place_item_frame", "Place and fill item frame", {
    priority: "normal",
    estimatedDuration: 5,
    safety: "normal"
  });

  // Check materials
  if (!hasInventoryItem(inventory, "item_frame")) {
    plan.status = "blocked";
    plan.error = "No item frame in inventory";
    plan.suggestion = "Craft item frame (8 sticks + 1 leather)";
    return plan;
  }

  if (item && !hasInventoryItem(inventory, item)) {
    plan.status = "blocked";
    plan.error = `No ${item} to display`;
    return plan;
  }

  // Build steps
  plan.steps.push(createStep(
    "place_frame",
    `Place item frame ${position ? `at ${describeTarget(position)}` : "on wall"}`,
    {
      item: "item_frame",
      surface: "wall_floor_or_ceiling",
      requiresSolidBlock: true
    }
  ));

  if (item) {
    plan.steps.push(createStep(
      "add_item",
      `Right-click frame with ${item}`,
      {
        item: item,
        action: "right_click"
      }
    ));

    if (goal.rotation !== undefined) {
      plan.steps.push(createStep(
        "rotate_item",
        `Rotate item ${goal.rotation * 45} degrees`,
        {
          rotations: goal.rotation,
          action: "right_click_empty_hand"
        }
      ));
    }
  }

  plan.outcome = {
    display: "item_frame",
    item: item || "empty",
    rotation: goal.rotation || 0
  };

  return plan;
}

/**
 * Plan armor stand setup
 * @param {object} goal - Task goal
 * @param {object} context - Game context
 * @returns {object} Armor stand plan
 */
function planArmorStandTask(goal = {}, context = {}) {
  const position = goal.position || context.targetPosition;
  const armor = goal.armor || {};
  const pose = goal.pose || "default";
  const inventory = context.inventory || {};

  const plan = createPlan("setup_armor_stand", "Place and configure armor stand", {
    priority: "normal",
    estimatedDuration: 15,
    safety: "normal"
  });

  // Check materials
  if (!hasInventoryItem(inventory, "armor_stand")) {
    plan.status = "blocked";
    plan.error = "No armor stand in inventory";
    plan.suggestion = "Craft armor stand (6 sticks + 1 stone slab)";
    return plan;
  }

  // Check armor pieces
  const armorPieces = ["helmet", "chestplate", "leggings", "boots"];
  const missingArmor = [];

  for (const piece of armorPieces) {
    if (armor[piece] && !hasInventoryItem(inventory, armor[piece])) {
      missingArmor.push(armor[piece]);
    }
  }

  if (missingArmor.length > 0) {
    plan.warnings = [`Missing armor: ${missingArmor.join(", ")}`];
  }

  // Build steps
  plan.steps.push(createStep(
    "place_armor_stand",
    `Place armor stand ${position ? `at ${describeTarget(position)}` : "on floor"}`,
    {
      item: "armor_stand",
      requiresFlatSurface: true
    }
  ));

  // Equip armor
  if (armor.helmet) {
    plan.steps.push(createStep(
      "equip_helmet",
      `Right-click with ${armor.helmet}`,
      { slot: "head", item: armor.helmet }
    ));
  }

  if (armor.chestplate) {
    plan.steps.push(createStep(
      "equip_chestplate",
      `Right-click with ${armor.chestplate}`,
      { slot: "chest", item: armor.chestplate }
    ));
  }

  if (armor.leggings) {
    plan.steps.push(createStep(
      "equip_leggings",
      `Right-click with ${armor.leggings}`,
      { slot: "legs", item: armor.leggings }
    ));
  }

  if (armor.boots) {
    plan.steps.push(createStep(
      "equip_boots",
      `Right-click with ${armor.boots}`,
      { slot: "feet", item: armor.boots }
    ));
  }

  // Add weapon/item to hand
  if (goal.mainHand) {
    plan.steps.push(createStep(
      "equip_weapon",
      `Right-click with ${goal.mainHand}`,
      { slot: "mainHand", item: goal.mainHand }
    ));
  }

  // Set pose
  if (pose !== "default") {
    const poseData = getArmorStandPose(pose);
    if (poseData) {
      plan.steps.push(createStep(
        "set_pose",
        `Set armor stand to '${pose}' pose`,
        {
          pose: pose,
          poseData: poseData,
          note: "Requires commands or pose editor tool"
        }
      ));
    }
  }

  plan.outcome = {
    display: "armor_stand",
    armor: armor,
    pose: pose,
    equipped: Object.keys(armor).length
  };

  return plan;
}

/**
 * Plan display showcase
 * @param {object} goal - Showcase goal
 * @param {object} context - Game context
 * @returns {object} Showcase plan
 */
function planDisplayShowcase(goal = {}, context = {}) {
  const showcaseType = goal.type || "item_showcase";
  const items = goal.items || [];
  const position = goal.position || context.targetPosition;
  const inventory = context.inventory || {};

  const design = designDisplayShowcase(showcaseType, items);

  if (design.error) {
    return {
      status: "failed",
      error: design.error,
      availableTypes: design.availableTypes
    };
  }

  const plan = createPlan("build_showcase", `Build ${showcaseType} display`, {
    priority: "normal",
    estimatedDuration: items.length * 10,
    complexity: showcaseType === "map_wall" ? "medium" : "easy"
  });

  // Check materials
  const missing = [];
  for (const [material, count] of Object.entries(design.materials)) {
    if (!hasInventoryItem(inventory, material) || (inventory[material]?.count || 0) < count) {
      missing.push(`${material}: need ${count}, have ${inventory[material]?.count || 0}`);
    }
  }

  if (missing.length > 0) {
    plan.status = "blocked";
    plan.error = "Insufficient materials";
    plan.missingMaterials = missing;
    return plan;
  }

  // Add build steps from design
  design.buildSteps.forEach((step, i) => {
    plan.steps.push(createStep(
      `showcase_step_${i + 1}`,
      step,
      { stepNumber: i + 1, totalSteps: design.buildSteps.length }
    ));
  });

  plan.outcome = {
    showcaseType,
    itemsDisplayed: items.length,
    design: design
  };

  return plan;
}

/* =====================================================
 * EXPORTS
 * ===================================================== */

export default planItemFrameTask;
export {
  DISPLAY_ITEMS,
  ARMOR_STAND_POSES,
  DISPLAY_CONFIG,
  getDisplayInfo,
  isDisplayable,
  getArmorStandPose,
  calculateItemFrameGrid,
  designDisplayShowcase,
  planArmorStandTask,
  planDisplayShowcase
};
