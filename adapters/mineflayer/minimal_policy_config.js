/**
 * Minimal Safety Policy Configuration for Autonomous Minecraft Bot
 *
 * This configuration provides minimal restrictions while maintaining:
 * 1. No griefing of unrelated structures
 * 2. No server-breaking mechanics (command blocks, structures)
 * 3. Permission to pursue game objectives (mining, building, combat)
 * 4. Full access to progression activities (nether, end, dragon)
 *
 * Designed to allow bot autonomy for speedrun/completion scenarios
 */

export const MINIMAL_SAFETY_POLICIES = {
  global: {
    maxConcurrentTasks: 1000,  // High limit for active swarms
    maxTasksPerBot: 50,        // Allow many queued tasks
    rateLimit: {
      requestsPerMinute: 10000, // 166 per second
      requestsPerHour: 600000
    }
  },

  rolePermissions: {
    // AUTOPILOT: Full game access with minimal restrictions
    autopilot: {
      canSubmitTasks: true,
      canApproveActions: true,  // Can approve own risky actions
      canModifyPolicy: false,
      allowedTaskTypes: ['all'], // All task types allowed
      allowedActions: ['all'],   // All block interactions allowed
      canAccessAllBots: true,
      maxTasksPerBot: 50,
      allowedDimensions: ['overworld', 'nether', 'end'],
      canPvP: true,
      canCombat: true,
      canMine: true,
      canBuild: true,
      canExplore: true
    },

    // ADMIN: Unrestricted access
    admin: {
      canSubmitTasks: true,
      canApproveActions: true,
      canModifyPolicy: true,
      allowedTaskTypes: ['all'],
      allowedActions: ['all'],
      canAccessAllBots: true,
      maxTasksPerBot: 100,
      canPvP: true,
      canCombat: true,
      canMine: true,
      canBuild: true,
      canExplore: true
    },

    // VIEWER: Read-only (no changes)
    viewer: {
      canSubmitTasks: false,
      canApproveActions: false,
      canModifyPolicy: false,
      allowedTaskTypes: [],
      allowedActions: [],
      canAccessAllBots: true
    }
  },

  /**
   * Blocks that are truly dangerous (server-breaking or intentional griefing)
   * These are the ONLY blocks blocked - everything else is allowed
   */
  dangerousBlocks: {
    // Server mechanics (cannot use)
    serverBreaking: [
      'command_block',        // Command blocks
      'repeating_command_block',
      'chain_command_block',
      'structure_block',      // Structure blocks
      'jigsaw'                // Jigsaw blocks
    ],

    // Portal frames (must be careful with)
    portalFrames: [
      'end_portal_frame'      // Only dangerous if completing end portal
    ]
  },

  /**
   * ALLOWED blocks - bot can freely interact with these
   * This covers all game progression activities
   */
  allowedActivities: {
    mining: [
      'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'emerald_ore',
      'redstone_ore', 'lapis_ore', 'copper_ore', 'deepslate_coal_ore',
      'deepslate_iron_ore', 'deepslate_gold_ore', 'deepslate_diamond_ore',
      'stone', 'cobblestone', 'granite', 'diorite', 'andesite',
      'tuff', 'deepslate', 'obsidian', 'netherrack', 'blackstone',
      'end_stone', 'obsidian', 'crying_obsidian'
    ],

    treeHarvesting: [
      'oak_log', 'spruce_log', 'birch_log', 'jungle_log',
      'acacia_log', 'dark_oak_log', 'mangrove_log', 'cherry_log',
      'oak_leaves', 'spruce_leaves', 'birch_leaves', 'jungle_leaves',
      'acacia_leaves', 'dark_oak_leaves'
    ],

    farming: [
      'wheat', 'carrots', 'potatoes', 'beetroots', 'melon',
      'pumpkin', 'sugar_cane', 'nether_wart', 'chorus_plant'
    ],

    construction: [
      'oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks',
      'acacia_planks', 'dark_oak_planks', 'dirt', 'grass_block',
      'sand', 'gravel', 'clay', 'oak_wood', 'spruce_wood'
    ],

    redstone: [
      'redstone_wire', 'redstone_torch', 'redstone_repeater',
      'redstone_comparator', 'dispenser', 'dropper', 'piston',
      'sticky_piston', 'lever', 'button', 'tripwire_hook'
    ],

    combat: [
      // For dragon fight and mob combat
      '*'  // All blocks allowed for combat positioning
    ],

    nether: [
      'netherrack', 'soul_sand', 'soul_soil', 'nether_bricks',
      'crimson_hyphae', 'warped_hyphae', 'crimson_planks',
      'warped_planks', 'nether_gold_ore'
    ],

    end: [
      'end_stone', 'end_stone_bricks', 'purpur_block', 'purpur_pillar',
      'chorus_plant', 'chorus_flower'
    ]
  },

  /**
   * Specific permissions for game objectives
   */
  gameObjectives: {
    dragon_fight: {
      allowed: true,
      canPlace: ['oak_planks', 'oak_wood', 'scaffolding', 'dirt'],
      canBreak: ['end_stone', 'chorus_plant', 'bedrock'],  // Can break certain blocks near dragon
      canKill: ['ender_dragon', 'enderman', 'endermite'],
      approvalRequired: false  // No approval needed for combat
    },

    nether_exploration: {
      allowed: true,
      canPlace: ['netherrack', 'soul_sand', 'nether_bricks'],
      canBreak: ['netherrack', 'soul_sand', 'ancient_debris'],
      canKill: ['ghast', 'piglin', 'hoglin', 'wither_skeleton'],
      approvalRequired: false
    },

    stronghold_raid: {
      allowed: true,
      canPlace: ['oak_planks', 'dirt', 'torch'],
      canBreak: ['stone_brick', 'cracked_stone_brick', 'mossy_stone_brick'],
      canKill: ['silverfish', 'enderman'],
      approvalRequired: false
    },

    villager_trading: {
      allowed: true,
      canPlace: ['workstation_blocks'],
      canInteract: ['villager'],
      approvalRequired: false
    }
  },

  /**
   * Rate limiting (very high for autonomous play)
   */
  rateLimiting: {
    autopilot: {
      blocksPerSecond: 100,
      tasksPerSecond: 20,
      movementsPerSecond: 10
    },
    admin: {
      blocksPerSecond: 1000,
      tasksPerSecond: 100,
      movementsPerSecond: 50
    }
  },

  /**
   * World restrictions (allow all dimensions)
   */
  worldRestrictions: {
    allowedDimensions: ['overworld', 'nether', 'end'],
    forbiddenRegions: [],  // No region restrictions
    allowedYRange: [-64, 320]  // Full height range
  },

  /**
   * Safety thresholds (minimal)
   */
  safetyThresholds: {
    maxWaterBlocksAtOnce: 1000,      // Can create large water structures
    maxLavaBlocksAtOnce: 1000,       // Can use lava for construction
    maxEntityKillsPerMinute: 100,    // High combat rate
    fallDamageAllowed: true,         // Can use fall damage tactics
    fireSpreadAllowed: true,         // Can use fire
    explosionAllowed: true           // Can use TNT for mining
  },

  /**
   * Combat settings
   */
  combat: {
    enablePvE: true,              // Can fight mobs
    enablePvP: false,             // Don't fight players (unless added to whitelist)
    canUseFireAspect: true,
    canUseCriticalHits: true,
    canUseExplosives: true,
    allowedWeapons: ['all'],
    targetMobs: [
      'zombie', 'skeleton', 'creeper', 'spider', 'enderman',
      'ghast', 'piglin', 'hoglin', 'wither_skeleton', 'silverfish',
      'ender_dragon'  // Boss mob
    ]
  }
};

/**
 * Create a minimal policy engine configuration
 * Use this instead of DEFAULT_POLICIES for game progression
 * @returns {Object} Policy configuration
 */
export function getMinimalPolicyConfig() {
  return MINIMAL_SAFETY_POLICIES;
}

/**
 * Check if a block is safe to interact with
 * Returns true for almost everything except server-breaking blocks
 * @param {string} blockName - Block name
 * @returns {boolean}
 */
export function isBlockSafeToUse(blockName) {
  const dangerous = MINIMAL_SAFETY_POLICIES.dangerousBlocks.serverBreaking;
  return !dangerous.includes(blockName);
}

/**
 * Check if an activity is allowed
 * @param {string} activity - Activity type (mining, combat, building, etc.)
 * @param {string} blockName - Block name (optional)
 * @returns {boolean}
 */
export function isActivityAllowed(activity, blockName = null) {
  const objective = MINIMAL_SAFETY_POLICIES.gameObjectives[activity];
  if (!objective) return false;

  if (!objective.allowed) return false;

  // If no specific block restriction, allow it
  if (!blockName) return true;

  // Check if block is in allowed list
  const allowed = objective.canBreak || objective.canPlace || [];
  if (allowed.includes('*')) return true;
  if (allowed.includes(blockName)) return true;

  return false;
}

/**
 * Get role permissions for minimal policy
 * @param {string} role - User role
 * @returns {Object} Role permissions
 */
export function getRolePermissions(role) {
  return MINIMAL_SAFETY_POLICIES.rolePermissions[role] || {};
}

export default MINIMAL_SAFETY_POLICIES;
