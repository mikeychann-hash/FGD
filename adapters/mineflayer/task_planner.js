/**
 * LLM-Safe Task Planner - Autonomous decision engine
 *
 * This module converts high-level goals into safe, structured task plans.
 * It ensures:
 *
 * 1. LLMs output only structured JSON (never raw code)
 * 2. All generated tasks are validated against schemas
 * 3. Plans respect safety policies and constraints
 * 4. Plans are atomic and resumable
 * 5. Clear attribution and audit trails
 *
 * This is used by the autonomy loop's "Decide" phase.
 */

import { logger } from '../../logger.js';

export class TaskPlanner {
  constructor(observer, registry, options = {}) {
    if (!observer || !registry) {
      throw new Error('TaskPlanner requires observer and registry');
    }

    this.observer = observer;
    this.registry = registry;
    this.options = {
      maxPlanLength: options.maxPlanLength || 20,
      maxTaskDuration: options.maxTaskDuration || 300000, // 5 minutes
      fallbackOnFailure: options.fallbackOnFailure !== false,
      planCacheTTL: options.planCacheTTL || 30000, // 30 seconds
      ...options
    };

    this.planCache = new Map(); // cacheKey -> plan
    this.goalTemplates = this._initializeGoalTemplates();

    logger.info('TaskPlanner initialized', {
      maxPlanLength: this.options.maxPlanLength,
      goalsAvailable: Object.keys(this.goalTemplates).length
    });
  }

  /**
   * Generate a task plan for a goal
   *
   * IMPORTANT: This is safe to call with LLM-generated goals because:
   * - We only use predefined templates
   * - All outputs are structured and validated
   * - LLM cannot inject arbitrary code
   *
   * @param {string} botId - Bot ID
   * @param {string} goal - High-level goal (e.g., "mine_coal", "build_house")
   * @param {Object} context - {priority?, timeout?, constraints?}
   * @returns {Promise<{success: boolean, plan?: Array, error?: string}>}
   */
  async generatePlan(botId, goal, context = {}) {
    try {
      const cacheKey = `${botId}:${goal}`;

      // Check cache
      if (this.planCache.has(cacheKey)) {
        const cached = this.planCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.options.planCacheTTL) {
          logger.debug('Returning cached plan', { botId, goal });
          return { success: true, plan: cached.plan, source: 'cache' };
        }
      }

      // Get current world state
      const worldState = this.observer.getWorldState(botId);
      if (!worldState) {
        return { success: false, error: 'No world state available' };
      }

      // Look up goal template
      const template = this.goalTemplates[goal];
      if (!template) {
        return {
          success: false,
          error: `Unknown goal: ${goal}. Available: ${Object.keys(this.goalTemplates).join(', ')}`
        };
      }

      // Generate plan from template
      let plan = template.planner(worldState, this.registry, context);

      // Validate plan structure
      const validation = this._validatePlan(plan);
      if (!validation.valid) {
        logger.warn('Generated plan failed validation', {
          botId,
          goal,
          errors: validation.errors
        });
        return {
          success: false,
          error: `Plan validation failed: ${validation.errors.join('; ')}`
        };
      }

      // Ensure plan length is within limits
      if (plan.length > this.options.maxPlanLength) {
        plan = plan.slice(0, this.options.maxPlanLength);
        logger.warn('Plan truncated to max length', { botId, goal, maxLength: this.options.maxPlanLength });
      }

      // Cache the plan
      this.planCache.set(cacheKey, {
        plan,
        timestamp: Date.now()
      });

      logger.info('Plan generated successfully', {
        botId,
        goal,
        taskCount: plan.length
      });

      return { success: true, plan };

    } catch (error) {
      logger.error('Plan generation error', { botId, goal, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Evaluate if a plan is feasible given current state
   * @param {string} botId - Bot ID
   * @param {Array} plan - Task plan to evaluate
   * @returns {Object} - {feasible: boolean, warnings: [], suggestions: []}
   */
  evaluatePlan(botId, plan) {
    const result = {
      feasible: true,
      warnings: [],
      suggestions: []
    };

    if (!Array.isArray(plan) || plan.length === 0) {
      result.feasible = false;
      result.warnings.push('Plan is empty');
      return result;
    }

    const worldState = this.observer.getWorldState(botId);
    if (!worldState) {
      result.warnings.push('No current world state');
      return result;
    }

    const botState = worldState.botState;

    // Check bot health
    if (botState.health < 5) {
      result.feasible = false;
      result.warnings.push('Bot health too low');
      result.suggestions.push('Find food or shelter');
    }

    // Check inventory space (if plan includes mining/gathering)
    const hasMiningTask = plan.some((task) => task.type === 'mine_block' || task.type === 'gather');
    if (hasMiningTask && botState.inventory.items.length > 30) {
      result.warnings.push('Inventory nearly full - may need to drop items');
      result.suggestions.push('Include drop tasks before mining');
    }

    // Check for hostile mobs if plan includes movement
    const hasMovementTask = plan.some((task) =>
      ['move_to', 'navigate', 'follow'].includes(task.type)
    );
    if (hasMovementTask && worldState.summary.nearbyHostiles > 0) {
      result.warnings.push(`${worldState.summary.nearbyHostiles} hostile mob(s) nearby`);
      result.suggestions.push('Consider engaging mobs first or finding shelter');
    }

    // Validate each task in the plan
    for (let i = 0; i < plan.length; i++) {
      const task = plan[i];
      const taskValidation = this._validateTask(task);

      if (!taskValidation.valid) {
        result.feasible = false;
        result.warnings.push(`Task ${i + 1} validation failed: ${taskValidation.errors.join('; ')}`);
      }
    }

    return result;
  }

  /**
   * Select best action from options
   * @param {string} botId - Bot ID
   * @param {Array} options - Array of {action, priority?, score?}
   * @returns {Object|null} - Selected action or null
   */
  selectBestAction(botId, options) {
    if (!Array.isArray(options) || options.length === 0) {
      return null;
    }

    const worldState = this.observer.getWorldState(botId);

    // Score each option
    const scored = options.map((option) => {
      let score = option.score || 0;

      // Apply priority multiplier
      if (option.priority === 'high') score *= 2;
      if (option.priority === 'low') score *= 0.5;

      // Consider world state factors
      if (worldState) {
        // Prefer actions that move away from hostiles
        if (option.action.type === 'move_to' && worldState.summary.nearbyHostiles > 0) {
          score += 1.5;
        }

        // Prefer mining near resources
        if (option.action.type === 'mine_block' && worldState.summary.resourceBlocks.length > 0) {
          score += 1;
        }

        // Avoid mining if health is low
        if (option.action.type === 'mine_block' && worldState.botState.health < 10) {
          score -= 3;
        }
      }

      return { ...option, finalScore: score };
    });

    // Sort by score and return top
    scored.sort((a, b) => b.finalScore - a.finalScore);
    return scored[0];
  }

  /**
   * Clear plan cache
   */
  clearCache() {
    this.planCache.clear();
    logger.debug('Plan cache cleared');
  }

  /**
   * Validate plan structure
   * @private
   */
  _validatePlan(plan) {
    const errors = [];

    if (!Array.isArray(plan)) {
      errors.push('Plan must be an array');
      return { valid: false, errors };
    }

    if (plan.length === 0) {
      errors.push('Plan cannot be empty');
    }

    for (let i = 0; i < plan.length; i++) {
      const validation = this._validateTask(plan[i]);
      if (!validation.valid) {
        errors.push(`Task ${i}: ${validation.errors.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate individual task
   * @private
   */
  _validateTask(task) {
    const errors = [];

    if (!task || typeof task !== 'object') {
      errors.push('Task must be an object');
      return { valid: false, errors };
    }

    if (!task.type) {
      errors.push('Task must have a type');
    }

    // Validate known task types
    const validTypes = [
      'move_to',
      'navigate',
      'mine_block',
      'place_block',
      'interact',
      'use_item',
      'look_at',
      'chat',
      'get_inventory',
      'equip_item',
      'drop_item'
    ];

    if (!validTypes.includes(task.type)) {
      errors.push(`Unknown task type: ${task.type}`);
    }

    // Validate task-specific parameters
    switch (task.type) {
      case 'move_to':
      case 'place_block':
        if (!task.target || typeof task.target !== 'object') {
          errors.push('move_to/place_block requires target object');
        } else if (task.target.x === undefined || task.target.y === undefined || task.target.z === undefined) {
          errors.push('Target must have x, y, z coordinates');
        }
        break;

      case 'navigate':
        if (!Array.isArray(task.waypoints) || task.waypoints.length === 0) {
          errors.push('navigate requires non-empty waypoints array');
        }
        break;

      case 'mine_block':
        if (!task.target || typeof task.target !== 'object') {
          errors.push('mine_block requires target object');
        }
        break;

      case 'chat':
        if (!task.message || typeof task.message !== 'string') {
          errors.push('chat requires message (string)');
        }
        break;

      case 'equip_item':
      case 'drop_item':
        if (!task.item && task.slot === undefined) {
          errors.push('equip_item/drop_item requires item or slot');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Initialize goal templates
   * Each template is a {name, description, planner: (worldState, registry, context) => tasks}
   * @private
   */
  _initializeGoalTemplates() {
    return {
      // Mining goals
      mine_coal: {
        name: 'Mine Coal',
        description: 'Find and mine coal ore',
        planner: (worldState, registry, context) => {
          const plan = [];

          // Look for coal ore
          const coalBlocks = worldState.blocks.filter((b) => b.name === 'coal_ore');

          if (coalBlocks.length === 0) {
            // No coal visible, explore
            plan.push({
              type: 'move_to',
              target: {
                x: worldState.botState.position.x + 20,
                y: worldState.botState.position.y,
                z: worldState.botState.position.z + 20
              },
              timeout: 30000
            });

            plan.push({
              type: 'chat',
              message: 'No coal found nearby'
            });
          } else {
            // Found coal, go mine it
            const nearestCoal = coalBlocks.reduce((a, b) =>
              a.distance < b.distance ? a : b
            );

            plan.push({
              type: 'move_to',
              target: nearestCoal.position,
              timeout: 30000
            });

            plan.push({
              type: 'mine_block',
              target: nearestCoal.position
            });
          }

          return plan;
        }
      },

      // Gathering
      gather_wood: {
        name: 'Gather Wood',
        description: 'Find and harvest wood logs',
        planner: (worldState, registry, context) => {
          const plan = [];

          // Find logs
          const logs = worldState.blocks.filter((b) => b.name.includes('_log'));

          if (logs.length === 0) {
            plan.push({
              type: 'chat',
              message: 'No trees nearby'
            });
          } else {
            // Go to nearest log and mine it
            const nearest = logs.reduce((a, b) =>
              a.distance < b.distance ? a : b
            );

            plan.push({
              type: 'move_to',
              target: nearest.position,
              timeout: 30000
            });

            // Mine multiple logs at this location
            for (let i = 0; i < Math.min(logs.length, 5); i++) {
              plan.push({
                type: 'mine_block',
                target: logs[i].position
              });
            }
          }

          return plan;
        }
      },

      // Exploration
      explore_area: {
        name: 'Explore Area',
        description: 'Explore surroundings and map out resources',
        planner: (worldState, registry, context) => {
          const plan = [];
          const currentPos = worldState.botState.position;
          const offset = context.offset || 50;

          // Create a spiral exploration pattern
          const waypoints = [
            { x: currentPos.x + offset, y: currentPos.y, z: currentPos.z },
            { x: currentPos.x + offset, y: currentPos.y, z: currentPos.z + offset },
            { x: currentPos.x, y: currentPos.y, z: currentPos.z + offset },
            { x: currentPos.x - offset, y: currentPos.y, z: currentPos.z + offset },
            { x: currentPos.x - offset, y: currentPos.y, z: currentPos.z }
          ];

          plan.push({
            type: 'navigate',
            waypoints,
            timeout: 120000
          });

          plan.push({
            type: 'chat',
            message: 'Exploration complete'
          });

          return plan;
        }
      },

      // Combat
      find_mobs: {
        name: 'Hunt Mobs',
        description: 'Find and engage hostile mobs',
        planner: (worldState, registry, context) => {
          const plan = [];

          // Check for nearby hostiles
          const hostiles = worldState.entities.filter((e) => e.type === 'hostile');

          if (hostiles.length === 0) {
            plan.push({
              type: 'chat',
              message: 'No mobs nearby'
            });
          } else {
            // Move toward nearest hostile and engage
            const nearest = hostiles.reduce((a, b) =>
              a.distance < b.distance ? a : b
            );

            plan.push({
              type: 'move_to',
              target: nearest.position,
              timeout: 30000
            });

            plan.push({
              type: 'interact',
              target: nearest.position
            });
          }

          return plan;
        }
      },

      // Safety
      find_shelter: {
        name: 'Find Shelter',
        description: 'Find safe location away from threats',
        planner: (worldState, registry, context) => {
          const plan = [];

          // If no hostiles, find any safe spot
          if (worldState.summary.nearbyHostiles === 0) {
            plan.push({
              type: 'chat',
              message: 'Already in safe area'
            });
          } else {
            // Move away from current position
            const currentPos = worldState.botState.position;
            plan.push({
              type: 'move_to',
              target: {
                x: currentPos.x + 30,
                y: currentPos.y + 2, // Move up for better visibility
                z: currentPos.z + 30
              },
              timeout: 30000
            });

            plan.push({
              type: 'chat',
              message: 'Moving to safer location'
            });
          }

          return plan;
        }
      },

      // Default fallback
      idle: {
        name: 'Idle',
        description: 'Stand still and observe',
        planner: (worldState, registry, context) => {
          return [
            {
              type: 'look_at',
              target: {
                x: worldState.botState.position.x + 10,
                y: worldState.botState.position.y + 1,
                z: worldState.botState.position.z
              }
            }
          ];
        }
      }
    };
  }
}

export default TaskPlanner;
