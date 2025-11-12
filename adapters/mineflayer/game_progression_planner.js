/**
 * Game Progression Planner - Goals for Minecraft Speedrun/Completion
 *
 * Extends TaskPlanner with goals focused on:
 * 1. Resource gathering for game progression
 * 2. Combat objectives (mob farming, dragon fight)
 * 3. Dimensional travel (nether, end)
 * 4. Boss fights and endgame content
 *
 * All goals are designed for autonomous execution without approval
 */

import { TaskPlanner } from './task_planner.js';

export class GameProgressionPlanner extends TaskPlanner {
  constructor(observer, registry, options = {}) {
    super(observer, registry, options);
    this.goalTemplates = { ...this.goalTemplates, ...this._initializeGameGoals() };
  }

  /**
   * Initialize speedrun/progression-focused goals
   * @private
   */
  _initializeGameGoals() {
    return {
      // Tier 1: Early game resource gathering
      gather_stone: {
        name: 'Gather Stone',
        description: 'Mine stone for tools and building',
        priority: 1,
        planner: (worldState, registry, context) => {
          const plan = [];
          const stoneBlocks = worldState.blocks.filter((b) => b.name === 'stone' || b.name === 'cobblestone');

          if (stoneBlocks.length === 0) {
            plan.push({ type: 'chat', message: 'No stone nearby' });
            return plan;
          }

          const nearest = stoneBlocks.reduce((a, b) => (a.distance < b.distance ? a : b));

          plan.push({
            type: 'move_to',
            target: nearest.position,
            timeout: 30000
          });

          // Mine 5 stone blocks
          for (let i = 0; i < Math.min(5, stoneBlocks.length); i++) {
            plan.push({
              type: 'mine_block',
              target: stoneBlocks[i].position
            });
          }

          return plan;
        }
      },

      gather_wood: {
        name: 'Gather Wood',
        description: 'Harvest wood from trees for crafting',
        priority: 1,
        planner: (worldState, registry, context) => {
          const plan = [];
          const logs = worldState.blocks.filter((b) => b.name.includes('_log'));

          if (logs.length === 0) {
            plan.push({ type: 'chat', message: 'No trees nearby' });
            return plan;
          }

          const nearest = logs.reduce((a, b) => (a.distance < b.distance ? a : b));

          plan.push({
            type: 'move_to',
            target: nearest.position,
            timeout: 30000
          });

          // Mine up to 10 logs
          for (let i = 0; i < Math.min(10, logs.length); i++) {
            plan.push({
              type: 'mine_block',
              target: logs[i].position
            });
          }

          return plan;
        }
      },

      // Tier 2: Mining for progression
      find_coal: {
        name: 'Find Coal',
        description: 'Locate and mine coal ore',
        priority: 2,
        planner: (worldState, registry, context) => {
          const plan = [];
          const coal = worldState.blocks.filter((b) => b.name === 'coal_ore');

          if (coal.length === 0) {
            plan.push({ type: 'move_to', target: { x: 100, y: 64, z: 100 }, timeout: 60000 });
            return plan;
          }

          const nearest = coal.reduce((a, b) => (a.distance < b.distance ? a : b));

          plan.push({ type: 'move_to', target: nearest.position, timeout: 30000 });
          plan.push({ type: 'mine_block', target: nearest.position });

          return plan;
        }
      },

      find_iron: {
        name: 'Find Iron Ore',
        description: 'Mine iron ore for tools and armor',
        priority: 2,
        planner: (worldState, registry, context) => {
          const plan = [];
          const iron = worldState.blocks.filter((b) =>
            b.name === 'iron_ore' || b.name === 'deepslate_iron_ore'
          );

          if (iron.length === 0) {
            plan.push({ type: 'move_to', target: { x: 150, y: 32, z: 150 }, timeout: 60000 });
            return plan;
          }

          for (let i = 0; i < Math.min(5, iron.length); i++) {
            plan.push({
              type: 'move_to',
              target: iron[i].position,
              timeout: 30000
            });
            plan.push({
              type: 'mine_block',
              target: iron[i].position
            });
          }

          return plan;
        }
      },

      find_diamonds: {
        name: 'Find Diamonds',
        description: 'Mine diamond ore for best tools and armor',
        priority: 3,
        planner: (worldState, registry, context) => {
          const plan = [];
          const diamonds = worldState.blocks.filter((b) =>
            b.name === 'diamond_ore' || b.name === 'deepslate_diamond_ore'
          );

          if (diamonds.length === 0) {
            // Go deep mining
            plan.push({
              type: 'move_to',
              target: { x: 200, y: 10, z: 200 },
              timeout: 120000
            });
            return plan;
          }

          for (let i = 0; i < Math.min(10, diamonds.length); i++) {
            plan.push({
              type: 'move_to',
              target: diamonds[i].position,
              timeout: 30000
            });
            plan.push({
              type: 'mine_block',
              target: diamonds[i].position
            });
          }

          return plan;
        }
      },

      // Tier 3: Dimensional travel
      find_nether_portal: {
        name: 'Find Nether Portal',
        description: 'Locate nether portal or build one',
        priority: 3,
        planner: (worldState, registry, context) => {
          const plan = [];

          // Check for existing obsidian (portal frame)
          const obsidian = worldState.blocks.filter((b) => b.name === 'obsidian');

          if (obsidian.length > 0) {
            const nearest = obsidian.reduce((a, b) => (a.distance < b.distance ? a : b));
            plan.push({
              type: 'move_to',
              target: nearest.position,
              timeout: 30000
            });
            plan.push({ type: 'chat', message: 'Found obsidian!' });
          } else {
            // Build portal with placement blocks
            plan.push({ type: 'chat', message: 'Need to gather obsidian for portal' });
            plan.push({ type: 'move_to', target: { x: -200, y: 100, z: -200 }, timeout: 60000 });
          }

          return plan;
        }
      },

      enter_nether: {
        name: 'Enter Nether',
        description: 'Travel through nether portal to The Nether',
        priority: 3,
        planner: (worldState, registry, context) => {
          const plan = [];

          if (worldState.botState.dimension === 'minecraft:the_nether') {
            plan.push({ type: 'chat', message: 'Already in the nether!' });
          } else {
            plan.push({
              type: 'move_to',
              target: context.portalLocation || { x: 0, y: 64, z: 0 },
              timeout: 60000
            });
            plan.push({ type: 'interact', target: { x: 0, y: 0, z: 0 } });
          }

          return plan;
        }
      },

      find_stronghold: {
        name: 'Find Stronghold',
        description: 'Locate stronghold entrance for end portal',
        priority: 4,
        planner: (worldState, registry, context) => {
          const plan = [];

          // Throw eye of ender to find stronghold
          plan.push({
            type: 'use_item',
            item: 'ender_eye'
          });

          // Follow direction for 500 blocks
          plan.push({
            type: 'navigate',
            waypoints: [
              { x: 500, y: 64, z: 500 },
              { x: 1000, y: 64, z: 1000 }
            ],
            timeout: 300000
          });

          return plan;
        }
      },

      // Tier 4: Boss fight preparation
      prepare_for_dragon: {
        name: 'Prepare for Dragon Fight',
        description: 'Gather supplies and gear for Ender Dragon battle',
        priority: 4,
        planner: (worldState, registry, context) => {
          const plan = [];

          // Check inventory for supplies
          const hasFood = worldState.botState.inventory.items.some(
            (item) => item.name.includes('cooked') || item.name.includes('apple')
          );
          const hasWeapon = worldState.botState.inventory.items.some(
            (item) => item.name.includes('sword') || item.name.includes('axe')
          );
          const hasBlock = worldState.botState.inventory.items.some(
            (item) => item.name.includes('block') || item.name.includes('wood')
          );

          if (!hasFood) {
            plan.push({ type: 'chat', message: 'Need food for dragon fight' });
          }
          if (!hasWeapon) {
            plan.push({ type: 'chat', message: 'Need sword for dragon fight' });
          }
          if (!hasBlock) {
            plan.push({ type: 'chat', message: 'Need blocks for pillar climbing' });
          }

          plan.push({
            type: 'move_to',
            target: { x: 0, y: 64, z: 0 }, // Spawn island
            timeout: 120000
          });

          return plan;
        }
      },

      fight_ender_dragon: {
        name: 'Fight Ender Dragon',
        description: 'Engage and defeat the Ender Dragon',
        priority: 5,
        planner: (worldState, registry, context) => {
          const plan = [];

          // Find dragon
          const dragon = worldState.entities.find((e) => e.type === 'ender_dragon');

          if (!dragon) {
            plan.push({ type: 'chat', message: 'Dragon not found' });
            return plan;
          }

          // Move to dragon
          plan.push({
            type: 'move_to',
            target: dragon.position,
            timeout: 60000
          });

          // Attack dragon
          for (let i = 0; i < 10; i++) {
            plan.push({
              type: 'interact',
              target: dragon.position
            });
          }

          // Climb pillars to damage dragon
          plan.push({
            type: 'move_to',
            target: { x: 0, y: 200, z: 0 },
            timeout: 60000
          });

          return plan;
        }
      },

      // Tier 5: Endgame
      reach_end: {
        name: 'Reach The End',
        description: 'Enter and survive in The End dimension',
        priority: 4,
        planner: (worldState, registry, context) => {
          const plan = [];

          if (worldState.botState.dimension === 'minecraft:the_end') {
            plan.push({ type: 'chat', message: 'Already in the end!' });
          } else {
            plan.push({
              type: 'move_to',
              target: context.endPortalLocation || { x: 0, y: 50, z: 0 },
              timeout: 120000
            });
            plan.push({ type: 'interact', target: { x: 0, y: 0, z: 0 } });
          }

          return plan;
        }
      },

      escape_end: {
        name: 'Escape The End',
        description: 'Return from The End after dragon defeat',
        priority: 5,
        planner: (worldState, registry, context) => {
          const plan = [];

          // Look for exit portal
          plan.push({
            type: 'move_to',
            target: { x: 0, y: 0, z: 0 },
            timeout: 120000
          });

          plan.push({
            type: 'interact',
            target: { x: 0, y: 0, z: 0 }  // Jump into exit portal
          });

          return plan;
        }
      },

      // Utility
      build_shelter: {
        name: 'Build Shelter',
        description: 'Construct basic shelter for safety',
        priority: 2,
        planner: (worldState, registry, context) => {
          const plan = [];
          const botPos = worldState.botState.position;

          // Build 5x5 box
          for (let x = -2; x <= 2; x++) {
            for (let z = -2; z <= 2; z++) {
              plan.push({
                type: 'place_block',
                target: {
                  x: botPos.x + x,
                  y: botPos.y,
                  z: botPos.z + z
                },
                blockType: 'oak_wood'
              });
            }
          }

          // Build roof
          for (let x = -2; x <= 2; x++) {
            for (let z = -2; z <= 2; z++) {
              plan.push({
                type: 'place_block',
                target: {
                  x: botPos.x + x,
                  y: botPos.y + 3,
                  z: botPos.z + z
                },
                blockType: 'oak_wood'
              });
            }
          }

          return plan;
        }
      },

      farm_mobs: {
        name: 'Farm Mobs',
        description: 'Hunt mobs for drops and experience',
        priority: 2,
        planner: (worldState, registry, context) => {
          const plan = [];

          const hostiles = worldState.entities.filter((e) => e.type === 'hostile');

          if (hostiles.length === 0) {
            plan.push({ type: 'chat', message: 'No mobs nearby' });
            return plan;
          }

          // Hunt nearest 5 mobs
          for (let i = 0; i < Math.min(5, hostiles.length); i++) {
            plan.push({
              type: 'move_to',
              target: hostiles[i].position,
              timeout: 30000
            });

            plan.push({
              type: 'interact',
              target: hostiles[i].position
            });
          }

          return plan;
        }
      }
    };
  }

  /**
   * Get recommended goal sequence for speedrun completion
   * @returns {Array<string>} Suggested goal order
   */
  getSpeedrunSequence() {
    return [
      'gather_wood',
      'gather_stone',
      'find_coal',
      'find_iron',
      'find_diamonds',
      'find_nether_portal',
      'enter_nether',
      'find_stronghold',
      'reach_end',
      'prepare_for_dragon',
      'fight_ender_dragon',
      'escape_end'
    ];
  }

  /**
   * Get all available goals
   * @returns {Array<{name, priority, description}>}
   */
  getAvailableGoals() {
    return Object.entries(this.goalTemplates).map(([key, template]) => ({
      id: key,
      name: template.name,
      description: template.description,
      priority: template.priority || 0
    }));
  }
}

export default GameProgressionPlanner;
