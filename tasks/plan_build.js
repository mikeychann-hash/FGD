// tasks/plan_build.js
// Planning logic for construction tasks

import {
  createPlan,
  createStep,
  describeTarget,
  normalizeItemName,
  extractInventory,
  hasInventoryItem,
  formatRequirementList,
  resolveQuantity
} from "./helpers.js";

// Build estimation constants
const BUILD_TIME_BASE = 14000;  // Base construction time (ms)
const BUILD_TIME_PER_BLOCK = 90;  // Additional time per block (ms)
const BUILD_TIME_TALL_STRUCTURE = 4000;  // Extra time for tall builds (ms)
const TALL_STRUCTURE_THRESHOLD = 10;  // Height threshold for tall structures (blocks)
const VOLUME_TIME_MULTIPLIER = 5;  // Time multiplier for enclosed volume
const SCAFFOLDING_HEIGHT_THRESHOLD = 6;  // Minimum height requiring scaffolding (blocks)
const UNSPECIFIED_ITEM_NAME = "unspecified item";  // Constant for unspecified items

// Building Templates & Blueprints
const BUILDING_TEMPLATES = {
  // Residential structures
  basic_house: {
    name: "Basic House",
    category: "residential",
    dimensions: { length: 7, width: 7, height: 5 },
    materials: {
      oak_planks: 220,
      glass_pane: 16,
      oak_door: 1,
      torch: 12,
      crafting_table: 1,
      bed: 1
    },
    difficulty: "easy",
    estimatedDuration: 18000, // ms
    roofStyle: "pitched",
    interior: true,
    features: ["lighting", "basic_furnishings"]
  },

  cottage: {
    name: "Cottage",
    category: "residential",
    dimensions: { length: 9, width: 7, height: 6 },
    materials: {
      spruce_planks: 280,
      cobblestone: 120,
      glass_pane: 20,
      spruce_door: 1,
      torch: 16,
      furnace: 1,
      chest: 3
    },
    difficulty: "easy",
    estimatedDuration: 24000,
    roofStyle: "pitched",
    interior: true,
    foundation: "stone",
    features: ["chimney", "storage", "lighting"]
  },

  // Defensive structures
  watchtower: {
    name: "Watchtower",
    category: "defensive",
    dimensions: { length: 5, width: 5, height: 15 },
    materials: {
      stone_bricks: 450,
      ladder: 14,
      torch: 20,
      fence: 16
    },
    difficulty: "medium",
    estimatedDuration: 45000,
    requiresScaffolding: true,
    threatLevel: "medium",
    features: ["elevated_platform", "perimeter_fence"]
  },

  castle_tower: {
    name: "Castle Tower",
    category: "defensive",
    dimensions: { length: 9, width: 9, height: 20 },
    materials: {
      stone_bricks: 900,
      cobblestone: 400,
      oak_planks: 120,
      iron_door: 1,
      ladder: 18,
      torch: 30
    },
    difficulty: "hard",
    estimatedDuration: 90000,
    requiresScaffolding: true,
    foundation: "stone",
    roofStyle: "battlements",
    features: ["arrow_slits", "spiral_stairs", "battlements"]
  },

  fortress_wall: {
    name: "Fortress Wall",
    category: "defensive",
    dimensions: { length: 30, width: 3, height: 8 },
    materials: {
      stone_bricks: 720,
      cobblestone: 200,
      torch: 15
    },
    difficulty: "medium",
    estimatedDuration: 50000,
    features: ["battlements", "guard_posts"]
  },

  // Agricultural structures
  basic_farm: {
    name: "Basic Farm",
    category: "agricultural",
    dimensions: { length: 9, width: 9, height: 0 },
    materials: {
      dirt: 81,
      water_bucket: 1,
      fence: 36,
      fence_gate: 1,
      hoe: 1,
      seeds: 64
    },
    difficulty: "easy",
    estimatedDuration: 15000,
    terrain: "flat",
    levelGround: true,
    features: ["irrigation", "fencing"]
  },

  redstone_farm: {
    name: "Automated Redstone Farm",
    category: "agricultural",
    dimensions: { length: 15, width: 15, height: 4 },
    materials: {
      redstone: 64,
      observer: 12,
      hopper: 8,
      dispenser: 4,
      chest: 4,
      building_blocks: 300
    },
    difficulty: "expert",
    estimatedDuration: 60000,
    includesRedstone: true,
    levelGround: true,
    features: ["automation", "collection_system", "water_distribution"]
  },

  // Storage & utility
  warehouse: {
    name: "Warehouse",
    category: "storage",
    dimensions: { length: 15, width: 12, height: 6 },
    materials: {
      oak_planks: 450,
      stone: 200,
      chest: 27,
      torch: 24,
      oak_door: 2
    },
    difficulty: "medium",
    estimatedDuration: 55000,
    interior: true,
    roofStyle: "flat",
    features: ["organized_storage", "lighting", "large_entrance"]
  },

  enchanting_room: {
    name: "Enchanting Room",
    category: "utility",
    dimensions: { length: 7, width: 7, height: 5 },
    materials: {
      obsidian: 4,
      diamond: 2,
      book: 15,
      bookshelf: 15,
      carpet: 30,
      torch: 8
    },
    difficulty: "medium",
    estimatedDuration: 35000,
    interior: true,
    features: ["bookshelves", "enchanting_table", "ambient_lighting"]
  },

  // Advanced structures
  nether_portal_hub: {
    name: "Nether Portal Hub",
    category: "transport",
    dimensions: { length: 11, width: 11, height: 8 },
    materials: {
      obsidian: 40,
      stone_bricks: 400,
      nether_bricks: 100,
      torch: 20,
      flint_and_steel: 1
    },
    difficulty: "hard",
    estimatedDuration: 65000,
    environment: "overworld_nether",
    features: ["multiple_portals", "safe_room", "storage"]
  },

  sky_bridge: {
    name: "Sky Bridge",
    category: "transport",
    dimensions: { length: 100, width: 3, height: 0 },
    materials: {
      cobblestone: 300,
      fence: 200,
      torch: 25
    },
    difficulty: "medium",
    estimatedDuration: 40000,
    requiresScaffolding: true,
    threatLevel: "low",
    features: ["safety_railings", "lighting"]
  }
};

// Material Calculator - Advanced estimation utilities
const MATERIAL_CALCULATOR = {
  /**
   * Calculate materials needed for walls
   * @param {number} length - Building length
   * @param {number} width - Building width
   * @param {number} height - Wall height
   * @param {Object} options - Configuration options
   * @returns {Object} Material breakdown
   */
  estimateForWalls(length, width, height, options = {}) {
    const {
      hollowInterior = true,
      includeCorners = true,
      doorCount = 1,
      windowCount = null
    } = options;

    const perimeter = 2 * (length + width);
    const wallArea = perimeter * height;

    // Account for hollow interior (subtract inner layer)
    const wallBlocks = hollowInterior
      ? wallArea - (2 * (length - 2) + 2 * (width - 2)) * height
      : wallArea;

    // Calculate openings
    const doorBlocks = doorCount * 2; // Standard door is 2 blocks tall
    const calculatedWindows = windowCount ?? Math.floor(perimeter / 4);
    const windowBlocks = calculatedWindows * 2; // 2 blocks per window

    const netBlocks = Math.max(0, wallBlocks - doorBlocks - windowBlocks);

    return {
      walls: netBlocks,
      doors: doorCount,
      windows: calculatedWindows,
      corners: includeCorners ? height * 4 : 0,
      totalBlocks: netBlocks
    };
  },

  /**
   * Calculate materials for roof
   * @param {number} length - Building length
   * @param {number} width - Building width
   * @param {string} style - Roof style
   * @returns {number} Block count
   */
  estimateForRoof(length, width, style = "flat") {
    const styles = {
      flat: length * width,
      pitched: Math.ceil(length * width * 1.5), // Pitched roof uses ~50% more
      steep: Math.ceil(length * width * 1.8),
      dome: Math.ceil(Math.PI * Math.pow(Math.max(length, width) / 2, 2) * 1.2),
      battlements: Math.ceil(perimeter => perimeter * 1.5)(2 * (length + width))
    };

    return styles[style] || styles.flat;
  },

  /**
   * Calculate foundation materials
   * @param {number} length - Building length
   * @param {number} width - Building width
   * @param {number} depth - Foundation depth
   * @returns {number} Block count
   */
  estimateForFoundation(length, width, depth = 1) {
    return length * width * depth;
  },

  /**
   * Calculate floor materials
   * @param {number} length - Building length
   * @param {number} width - Building width
   * @param {number} floors - Number of floors
   * @returns {number} Block count
   */
  estimateForFloors(length, width, floors = 1) {
    // Interior floor space (exclude walls)
    const interiorLength = Math.max(1, length - 2);
    const interiorWidth = Math.max(1, width - 2);
    return interiorLength * interiorWidth * floors;
  },

  /**
   * Add material overhead buffer
   * @param {number} baseAmount - Base material count
   * @param {number} buffer - Buffer percentage (0.1 = 10%)
   * @returns {number} Adjusted amount with buffer
   */
  calculateOverhead(baseAmount, buffer = 0.1) {
    return Math.ceil(baseAmount * (1 + buffer));
  },

  /**
   * Estimate lighting requirements
   * @param {number} length - Building length
   * @param {number} width - Building width
   * @param {number} height - Building height
   * @returns {number} Torch count
   */
  estimateLighting(length, width, height = 1) {
    const floorArea = length * width;
    const floors = Math.max(1, Math.floor(height / 4)); // One set per 4 blocks height
    // One torch per 8 blocks of floor area, times number of floors
    return Math.ceil((floorArea / 8) * floors);
  },

  /**
   * Generate complete material estimate from dimensions
   * @param {Object} dimensions - {length, width, height}
   * @param {Object} buildOptions - Building configuration
   * @returns {Object} Complete material breakdown
   */
  generateEstimate(dimensions, buildOptions = {}) {
    const { length, width, height = 5 } = dimensions;
    const {
      roofStyle = "pitched",
      foundation = true,
      floors = 1,
      materialType = "oak_planks",
      roofMaterial = "oak_planks",
      foundationMaterial = "cobblestone",
      includeInterior = true
    } = buildOptions;

    if (!length || !width || length <= 0 || width <= 0) {
      return null;
    }

    const walls = this.estimateForWalls(length, width, height, {
      hollowInterior: true,
      doorCount: 2,
      windowCount: Math.floor((length + width) / 3)
    });

    const roof = this.estimateForRoof(length, width, roofStyle);
    const foundationBlocks = this.estimateForFoundation(length, width, 1);
    const flooring = this.estimateForFloors(length, width, Math.max(1, floors - 1));
    const lighting = this.estimateLighting(length, width, height);

    const materials = {};

    // Main building material (walls)
    materials[materialType] = this.calculateOverhead(walls.totalBlocks);

    // Roof material
    if (roofMaterial !== materialType) {
      materials[roofMaterial] = this.calculateOverhead(roof);
    } else {
      materials[materialType] += this.calculateOverhead(roof);
    }

    // Foundation
    if (foundation && foundationMaterial) {
      materials[foundationMaterial] = this.calculateOverhead(foundationBlocks);
    }

    // Interior flooring
    if (includeInterior && flooring > 0) {
      const floorMaterial = materialType;
      materials[floorMaterial] = (materials[floorMaterial] || 0) + this.calculateOverhead(flooring);
    }

    // Lighting and fixtures
    materials.torch = lighting;
    materials.glass_pane = walls.windows;
    materials[`${materialType.split('_')[0]}_door`] = walls.doors;

    return {
      materials,
      breakdown: {
        walls: walls.totalBlocks,
        roof,
        foundation: foundationBlocks,
        flooring,
        lighting
      }
    };
  }
};

/**
 * Look up a building template by name or normalized name
 * @param {string} templateName - Template identifier
 * @returns {Object|null} Template object or null
 */
function findBuildingTemplate(templateName) {
  if (!templateName || typeof templateName !== 'string') {
    return null;
  }

  const normalized = normalizeItemName(templateName);

  // Direct lookup
  if (BUILDING_TEMPLATES[templateName]) {
    return BUILDING_TEMPLATES[templateName];
  }

  // Normalized lookup
  if (BUILDING_TEMPLATES[normalized]) {
    return BUILDING_TEMPLATES[normalized];
  }

  // Fuzzy match on template names
  for (const [key, template] of Object.entries(BUILDING_TEMPLATES)) {
    const templateNameNormalized = normalizeItemName(template.name);
    if (templateNameNormalized === normalized || key === normalized) {
      return template;
    }
  }

  return null;
}

/**
 * Apply template data to task, merging with existing metadata
 * @param {Object} task - Task object
 * @param {Object} template - Template object
 * @returns {Object} Enhanced task with template data
 */
function applyTemplateToTask(task, template) {
  if (!template) {
    return task;
  }

  const enhancedTask = { ...task };
  const metadata = { ...task.metadata };

  // Apply template dimensions if not specified
  if (template.dimensions && !metadata.dimensions && !metadata.length) {
    metadata.length = template.dimensions.length;
    metadata.width = template.dimensions.width;
    if (template.dimensions.height > 0) {
      metadata.height = template.dimensions.height;
    }
  }

  // Apply template materials if not specified
  if (template.materials && !metadata.materials) {
    metadata.materials = Object.entries(template.materials).map(([name, count]) => ({
      name,
      count
    }));
  }

  // Apply template properties
  if (template.roofStyle && !metadata.roofStyle) {
    metadata.roofStyle = template.roofStyle;
  }
  if (template.foundation && !metadata.foundation) {
    metadata.foundation = template.foundation;
  }
  if (template.difficulty && !metadata.difficulty) {
    metadata.difficulty = template.difficulty;
  }
  if (template.requiresScaffolding && !metadata.requiresScaffolding) {
    metadata.requiresScaffolding = template.requiresScaffolding;
  }
  if (template.includesRedstone && !metadata.includesRedstone) {
    metadata.includesRedstone = template.includesRedstone;
  }
  if (template.interior !== undefined && metadata.interior === undefined) {
    metadata.interior = template.interior;
  }
  if (template.levelGround && !metadata.levelGround) {
    metadata.levelGround = template.levelGround;
  }
  if (template.terrain && !metadata.terrain) {
    metadata.terrain = template.terrain;
  }
  if (template.threatLevel && !metadata.threatLevel) {
    metadata.threatLevel = template.threatLevel;
  }
  if (template.environment && !metadata.environment) {
    metadata.environment = template.environment;
  }
  if (template.features && !metadata.features) {
    metadata.features = template.features;
  }

  enhancedTask.metadata = metadata;

  // Use template's estimated duration if available
  if (template.estimatedDuration && !enhancedTask.estimatedDuration) {
    enhancedTask.templateEstimatedDuration = template.estimatedDuration;
  }

  // Store template reference
  enhancedTask.templateUsed = template.name || 'unknown';

  return enhancedTask;
}

/**
 * Estimate materials using calculator when not explicitly provided
 * @param {Object} dimensions - Parsed dimensions
 * @param {Object} metadata - Task metadata
 * @returns {Array} Material requirements array
 */
function estimateMaterialsFromDimensions(dimensions, metadata = {}) {
  if (!dimensions || !dimensions.length || !dimensions.width) {
    return [];
  }

  const buildOptions = {
    roofStyle: metadata.roofStyle || "pitched",
    foundation: metadata.foundation !== false,
    floors: metadata.floors || 1,
    materialType: metadata.primaryMaterial || metadata.buildingMaterial || "oak_planks",
    roofMaterial: metadata.roofMaterial || metadata.primaryMaterial || "oak_planks",
    foundationMaterial: metadata.foundationMaterial || "cobblestone",
    includeInterior: metadata.interior !== false
  };

  const estimate = MATERIAL_CALCULATOR.generateEstimate(dimensions, buildOptions);

  if (!estimate || !estimate.materials) {
    return [];
  }

  // Convert materials object to array format
  return Object.entries(estimate.materials)
    .filter(([name, count]) => count > 0)
    .map(([name, count]) => ({
      name: normalizeItemName(name),
      count
    }));
}

function parseDimensions(metadata = {}) {
  const raw = metadata.dimensions || metadata.dimension || "";
  if (typeof raw === "string" && raw.includes("x")) {
    const parts = raw
      .split("x")
      .map(part => Number.parseInt(part.trim(), 10))
      .filter(num => Number.isFinite(num) && num > 0);

    // Validate that we have valid positive dimensions
    if (parts.some(dim => dim <= 0)) {
      return null;  // Reject non-positive dimensions
    }

    if (parts.length === 3) {
      return { length: parts[0], width: parts[1], height: parts[2] };
    }
    if (parts.length === 2) {
      const parsedHeight = metadata.height ? resolveQuantity(metadata.height, null) : null;
      // Validate height if present
      if (parsedHeight !== null && parsedHeight < 0) {
        return null;
      }
      return {
        length: parts[0],
        width: parts[1],
        height: parsedHeight
      };
    }
  }

  const length = resolveQuantity(metadata.length, null);
  const width = resolveQuantity(metadata.width, null);
  const height = resolveQuantity(metadata.height ?? metadata.floors, null);

  // Validate individual dimensions - reject negative values
  if (length !== null && length <= 0) return null;
  if (width !== null && width <= 0) return null;
  if (height !== null && height < 0) return null;  // Allow 0 height for flat structures

  if (length && width) {
    return { length, width, height };
  }
  return null;
}

function normalizeMaterials(task, dimensions = null) {
  const explicit = Array.isArray(task?.metadata?.materials) ? task?.metadata?.materials : [];
  const quantities = task?.metadata?.materialQuantities || task?.metadata?.materialCounts || {};
  const normalized = explicit
    .map(entry => {
      if (typeof entry === "string") {
        return {
          name: normalizeItemName(entry),
          count: resolveQuantity(quantities[entry], null)
        };
      }
      if (entry && typeof entry === "object") {
        const name = normalizeItemName(entry.name || entry.item);
        const count = resolveQuantity(entry.count ?? entry.quantity, null);
        return { name, count };
      }
      return null;
    })
    .filter(Boolean);

  if (normalized.length > 0) {
    return normalized;
  }

  // Try to estimate materials from dimensions if available
  if (dimensions && dimensions.length && dimensions.width) {
    const estimated = estimateMaterialsFromDimensions(dimensions, task?.metadata || {});
    if (estimated.length > 0) {
      return estimated;
    }
  }

  // Fallback to basic material specification
  const fallback = normalizeItemName(task?.metadata?.primaryMaterial || task?.details || "building blocks");
  const fallbackCount = resolveQuantity(task?.metadata?.quantity ?? task?.metadata?.blocks, null);
  return [{ name: fallback, count: fallbackCount }];
}

export function planBuildTask(task, context = {}) {
  // Validate input task
  if (!task || typeof task !== 'object') {
    throw new Error('Invalid task: task must be a non-null object');
  }

  // Check for and apply building template
  const templateName = task?.metadata?.template || task?.metadata?.blueprint || task?.metadata?.structure;
  const template = findBuildingTemplate(templateName);

  // Apply template if found, otherwise use original task
  const enhancedTask = template ? applyTemplateToTask(task, template) : task;

  const blueprint = normalizeItemName(
    enhancedTask?.metadata?.blueprint ||
    enhancedTask?.metadata?.structure ||
    (template ? template.name : null) ||
    enhancedTask.details
  );

  const targetDescription = describeTarget(enhancedTask.target);
  const orientation = normalizeItemName(enhancedTask?.metadata?.orientation || enhancedTask?.metadata?.facing || "");
  const height = resolveQuantity(enhancedTask?.metadata?.height ?? enhancedTask?.metadata?.floors, null);
  const inventory = extractInventory(context);
  const dimensions = parseDimensions(enhancedTask?.metadata);

  const floorArea = dimensions?.length && dimensions?.width ? dimensions.length * dimensions.width : null;
  const enclosedVolume = floorArea && (dimensions?.height || height)
    ? floorArea * (dimensions.height || height)
    : null;

  // Pass dimensions to normalizeMaterials for auto-estimation
  const materialRequirements = normalizeMaterials(enhancedTask, dimensions);
  const missingMaterials = materialRequirements.filter(req => {
    if (!req?.name || req.name === UNSPECIFIED_ITEM_NAME) {
      return false;
    }
    if (req.count && req.count > 0) {
      return !hasInventoryItem(inventory, req.name, req.count);
    }
    return !hasInventoryItem(inventory, req.name, 1);
  });

  const materialSummary = formatRequirementList(materialRequirements);
  const missingSummary = formatRequirementList(missingMaterials);
  const blockCount = materialRequirements.reduce((total, req) => {
    const count = resolveQuantity(req.count, 0);
    return total + (count || 0);
  }, 0);

  const toolChecklist = [];
  const addTool = tool => {
    const normalized = normalizeItemName(tool);
    if (!normalized || normalized === UNSPECIFIED_ITEM_NAME) {
      return;
    }
    if (!toolChecklist.includes(normalized)) {
      toolChecklist.push(normalized);
    }
  };

  if (height && height > SCAFFOLDING_HEIGHT_THRESHOLD) {
    addTool("scaffolding");
  }
  if (enhancedTask?.metadata?.terrain === "rocky" || enhancedTask?.metadata?.foundation === "stone") {
    addTool("pickaxe");
  }
  if (enhancedTask?.metadata?.terrain === "forest" || enhancedTask?.metadata?.clearTrees) {
    addTool("axe");
  }
  if (enhancedTask?.metadata?.terrain === "sand" || enhancedTask?.metadata?.levelGround) {
    addTool("shovel");
  }
  if (enhancedTask?.metadata?.includesRedstone) {
    addTool("redstone toolkit");
  }
  if (enhancedTask?.metadata?.lighting || enhancedTask?.metadata?.buildAtNight) {
    addTool("torches");
  }

  const missingTools = toolChecklist.filter(tool => !hasInventoryItem(inventory, tool, 1));

  const steps = [];

  if (toolChecklist.length > 0) {
    const toolDescription = missingTools.length
      ? `Gather tools before departure: ${formatRequirementList(missingTools.map(name => ({ name })))}.`
      : `Confirm required tools are on hand: ${formatRequirementList(toolChecklist.map(name => ({ name })))}.`;
    steps.push(
      createStep({
        title: missingTools.length > 0 ? "Prepare tools" : "Verify tools",
        type: "inventory",
        description: toolDescription,
        metadata: { required: toolChecklist, missing: missingTools }
      })
    );
  }

  if (enhancedTask?.metadata?.blueprintUrl || enhancedTask?.metadata?.blueprintReference) {
    const reference =
      enhancedTask?.metadata?.blueprintReference || enhancedTask?.metadata?.blueprintUrl || blueprint || "structure";
    steps.push(
      createStep({
        title: "Review blueprint",
        type: "planning",
        description: `Load ${reference} and verify dimensions before construction begins.`
      })
    );
  }

  const verifyDescription = materialSummary
    ? `Confirm required materials are ready: ${materialSummary}.`
    : "Confirm required materials are ready for the build.";
  const restockDescription = missingSummary
    ? `Obtain missing resources: ${missingSummary}. Stage extras near the build site.`
    : "Obtain missing resources before heading to the site.";

  steps.push(
    createStep({
      title: missingMaterials.length > 0 ? "Restock materials" : "Verify materials",
      type: "inventory",
      description: missingMaterials.length > 0 ? restockDescription : verifyDescription,
      metadata: { materials: materialRequirements, missing: missingMaterials }
    })
  );

  const surveyDescription = orientation
    ? `Inspect ${targetDescription} to ensure the area is clear, mark foundation corners, and align the main entrance toward ${orientation}.`
    : `Inspect ${targetDescription} to ensure the area is clear for building and mark foundation corners.`;

  steps.push(
    createStep({
      title: "Survey site",
      type: "planning",
      description: surveyDescription
    })
  );

  if (enhancedTask?.metadata?.terrain === "uneven" || enhancedTask?.metadata?.levelGround) {
    steps.push(
      createStep({
        title: "Prepare terrain",
        type: "preparation",
        description: `Clear vegetation and level ground to support the ${blueprint} footprint.`
      })
    );
  }

  steps.push(
    createStep({
      title: "Stage materials",
      type: "collection",
      description: `Move materials on-site, placing staging chests or shulker boxes for ${blueprint}.`,
      metadata: { materials: materialRequirements }
    })
  );

  if (enhancedTask?.metadata?.perimeter || enhancedTask?.metadata?.threatLevel === "high") {
    steps.push(
      createStep({
        title: "Secure perimeter",
        type: "safety",
        description: "Place perimeter lighting and temporary barricades to prevent mob interference during construction.",
        metadata: { recommended: ["torches", "fences"] }
      })
    );
  }

  steps.push(
    createStep({
      title: "Lay foundation",
      type: "construction",
      description: `Outline the ${blueprint} footprint and reinforce the base with durable blocks.`
    })
  );

  if (height && height > SCAFFOLDING_HEIGHT_THRESHOLD) {
    steps.push(
      createStep({
        title: "Place scaffolding",
        type: "safety",
        description: `Set up scaffolding and guard rails to safely build up to ${height} blocks high.`
      })
    );
  }

  steps.push(
    createStep({
      title: "Assemble structure",
      type: "construction",
      description: `Build the ${blueprint} layer by layer, checking alignment with the blueprint after each level.`
    })
  );

  if (enhancedTask?.metadata?.roofStyle || enhancedTask?.metadata?.requiresRoof) {
    steps.push(
      createStep({
        title: "Install roof",
        type: "construction",
        description: `Shape the roof using the ${enhancedTask?.metadata?.roofStyle || "specified"} style, ensuring overhangs and lighting prevent mob spawns.`
      })
    );
  }

  if (enhancedTask?.metadata?.includesRedstone) {
    steps.push(
      createStep({
        title: "Install redstone",
        type: "automation",
        description: `Wire redstone components and test circuits before sealing access panels.`
      })
    );
  }

  steps.push(
    createStep({
      title: "Finish and inspect",
      type: "inspection",
      description: `Add lighting, doors, and final touches, then verify the structure matches the blueprint and meets safety checks.`
    })
  );

  if (enhancedTask?.metadata?.interior !== false) {
    steps.push(
      createStep({
        title: "Outfit interior",
        type: "decoration",
        description: "Place furnishings, storage, and lighting, verifying accessibility and spawn-proofing inside the structure."
      })
    );
  }

  if (enhancedTask?.metadata?.cleanup !== false) {
    steps.push(
      createStep({
        title: "Cleanup site",
        type: "cleanup",
        description: `Remove scaffolding, excess materials, and restore surrounding terrain.`
      })
    );
  }

  const resources = [
    ...new Set(
      materialRequirements
        .map(req => req.name)
        .filter(name => name && name !== UNSPECIFIED_ITEM_NAME)
    )
  ];
  if (toolChecklist.length > 0) {
    for (const tool of toolChecklist) {
      if (!resources.includes(tool)) {
        resources.push(tool);
      }
    }
  }
  const risks = [];
  if (height && height > SCAFFOLDING_HEIGHT_THRESHOLD) {
    risks.push("Elevated work area increases fall damage risk.");
  }
  if (enhancedTask?.metadata?.environment === "nether") {
    risks.push("Building in the Nether requires fire resistance and ghast-proofing.");
  }
  if (enhancedTask?.metadata?.weather === "stormy") {
    risks.push("Stormy weather may cause lightning strikes; add lightning rods and shelter.");
  }
  if (enhancedTask?.metadata?.threatLevel === "high") {
    risks.push("Hostile mobs likely to interrupt construction; maintain perimeter defenses.");
  }
  if (floorArea && floorArea > 0) {
    risks.push(`Large footprint (~${floorArea} blocks) increases build time and supply demand.`);
  }

  // Add template-specific risks if difficulty is high
  if (template && template.difficulty === "hard") {
    risks.push(`${template.name} is rated as a hard build; expect increased complexity.`);
  }
  if (template && template.difficulty === "expert") {
    risks.push(`${template.name} is rated as expert difficulty; advanced knowledge required.`);
  }

  const volumeWeight = enclosedVolume && enclosedVolume > 0 ? enclosedVolume * VOLUME_TIME_MULTIPLIER : 0;

  // Use template duration if available, otherwise calculate
  const estimatedDuration = enhancedTask.templateEstimatedDuration || (
    BUILD_TIME_BASE +
    blockCount * BUILD_TIME_PER_BLOCK +
    (height && height > TALL_STRUCTURE_THRESHOLD ? BUILD_TIME_TALL_STRUCTURE : 0) +
    volumeWeight
  );

  const notes = [];

  // Add template usage note
  if (template) {
    notes.push(`Using template: ${template.name} (${template.category}).`);
  }

  if (orientation) {
    notes.push(`Align entrance toward ${orientation}.`);
  }
  if (enhancedTask?.metadata?.deadline) {
    notes.push(`Requested completion before ${enhancedTask?.metadata?.deadline}.`);
  }
  if (floorArea) {
    notes.push(`Estimated footprint area: ${floorArea} blocks.`);
  }
  if (enclosedVolume) {
    notes.push(`Approximate enclosed volume: ${enclosedVolume} blocks.`);
  }
  if (missingTools.length > 0) {
    notes.push(`Acquire missing tools: ${formatRequirementList(missingTools.map(name => ({ name })))}.`);
  }

  // Add template features as notes
  if (template && template.features && template.features.length > 0) {
    notes.push(`Key features: ${template.features.join(', ')}.`);
  }

  return createPlan({
    task: enhancedTask,
    summary: `Construct ${blueprint} at ${targetDescription}.`,
    steps,
    estimatedDuration,
    resources,
    risks,
    notes
  });
}
