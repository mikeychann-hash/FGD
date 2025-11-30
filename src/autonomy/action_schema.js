// src/autonomy/action_schema.js
// Defines strict action schema for LLM responses and validation

import { z } from 'zod';

// Valid action types
export const VALID_ACTIONS = [
    'move',
    'mine',
    'craft',
    'attack',
    'gather',
    'explore',
    'deposit',
    'eat',
    'equip',
    'follow',
    'guard',
    'idle'
];

// Action-specific parameter schemas
const MoveParamsSchema = z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
    range: z.number().optional().default(1)
});

const MineParamsSchema = z.object({
    blockType: z.string(),
    count: z.number().optional().default(1),
    x: z.number().optional(),
    y: z.number().optional(),
    z: z.number().optional()
});

const CraftParamsSchema = z.object({
    item: z.string(),
    count: z.number().optional().default(1)
});

const AttackParamsSchema = z.object({
    entityType: z.string().optional(),
    entityId: z.number().optional()
});

const GatherParamsSchema = z.object({
    resource: z.string(),
    count: z.number().optional().default(1)
});

const ExploreParamsSchema = z.object({
    direction: z.enum(['north', 'south', 'east', 'west', 'random']).optional().default('random'),
    distance: z.number().optional().default(50)
});

const DepositParamsSchema = z.object({
    chestPos: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number()
    }).optional(),
    items: z.array(z.string()).optional()
});

const EatParamsSchema = z.object({
    allowGoldenApple: z.boolean().optional().default(false)
});

const EquipParamsSchema = z.object({
    item: z.string(),
    destination: z.enum(['hand', 'off-hand', 'head', 'torso', 'legs', 'feet']).optional().default('hand')
});

const FollowParamsSchema = z.object({
    targetId: z.string().optional(),
    targetPos: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number()
    }).optional(),
    range: z.number().optional().default(3)
});

const GuardParamsSchema = z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    z: z.number().optional(),
    radius: z.number().optional().default(10)
});

// Main action schema
export const ActionSchema = z.object({
    action: z.enum(VALID_ACTIONS),
    params: z.union([
        MoveParamsSchema,
        MineParamsSchema,
        CraftParamsSchema,
        AttackParamsSchema,
        GatherParamsSchema,
        ExploreParamsSchema,
        DepositParamsSchema,
        EatParamsSchema,
        EquipParamsSchema,
        FollowParamsSchema,
        GuardParamsSchema,
        z.object({}) // idle and other actions may have no params
    ]),
    reasoning: z.string().optional() // Optional brief explanation
});

/**
 * Validates an action object against the schema
 * @param {Object} action - Action to validate
 * @returns {{valid: boolean, data?: Object, errors?: Array}}
 */
export function validateAction(action) {
    try {
        const validated = ActionSchema.parse(action);
        return { valid: true, data: validated };
    } catch (err) {
        if (err instanceof z.ZodError) {
            return {
                valid: false,
                errors: err.errors.map(e => `${e.path.join('.')}: ${e.message}`)
            };
        }
        return {
            valid: false,
            errors: [err.message]
        };
    }
}

/**
 * Few-shot examples for the system prompt
 * These help the LLM understand expected format with minimal tokens
 */
export const FEW_SHOT_EXAMPLES = [
    {
        userIntent: "gather wood",
        botState: { inv: {}, blocks: [{ type: "oak_log", dist: 12 }] },
        correctResponse: {
            action: "gather",
            params: { resource: "oak_log", count: 10 }
        }
    },
    {
        userIntent: "return home",
        botState: { pos: { x: 100, y: 64, z: 50 }, health: 15 },
        correctResponse: {
            action: "move",
            params: { x: 0, y: 64, z: 0, range: 2 }
        }
    },
    {
        userIntent: "mine iron",
        botState: { inv: { "stone_pickaxe": 1 }, blocks: [{ type: "iron_ore", dist: 8 }] },
        correctResponse: {
            action: "mine",
            params: { blockType: "iron_ore", count: 3 }
        }
    },
    {
        userIntent: "defend against zombies",
        botState: { entities: [{ type: "zombie", dist: 5 }], health: 18 },
        correctResponse: {
            action: "attack",
            params: { entityType: "zombie" }
        }
    },
    {
        userIntent: "craft wooden planks",
        botState: { inv: { "oak_log": 5 } },
        correctResponse: {
            action: "craft",
            params: { item: "oak_planks", count: 4 }
        }
    }
];

/**
 * Generates the JSON schema for structured LLM output
 * Used with OpenAI's structured output feature
 */
export const ACTION_RESPONSE_FORMAT = {
    type: "json_schema",
    json_schema: {
        name: "bot_action",
        strict: true,
        schema: {
            type: "object",
            required: ["action", "params"],
            properties: {
                action: {
                    type: "string",
                    enum: VALID_ACTIONS,
                    description: "The action the bot should take"
                },
                params: {
                    type: "object",
                    description: "Action-specific parameters",
                    additionalProperties: true
                },
                reasoning: {
                    type: "string",
                    description: "Brief explanation (max 20 words)"
                }
            },
            additionalProperties: false
        }
    }
};

/**
 * Converts an action to a task object for npc_engine
 * @param {Object} action - Validated action
 * @param {string} botId - Bot ID
 * @returns {Object} Task object for npc_engine
 */
export function actionToTask(action, botId) {
    const task = {
        action: action.action,
        details: action.reasoning || `Auto-generated: ${action.action}`,
        priority: 'normal',
        metadata: {
            source: 'llm_autonomy',
            generatedAt: new Date().toISOString()
        }
    };

    // Map action params to task format
    switch (action.action) {
        case 'move':
            task.target = {
                x: action.params.x,
                y: action.params.y,
                z: action.params.z
            };
            task.metadata.range = action.params.range || 1;
            break;

        case 'mine':
            task.metadata.blockType = action.params.blockType;
            task.metadata.count = action.params.count || 1;
            if (action.params.x != null) {
                task.target = {
                    x: action.params.x,
                    y: action.params.y,
                    z: action.params.z
                };
            }
            break;

        case 'craft':
            task.metadata.item = action.params.item;
            task.metadata.count = action.params.count || 1;
            break;

        case 'gather':
            task.metadata.resource = action.params.resource;
            task.metadata.count = action.params.count || 1;
            break;

        case 'attack':
            if (action.params.entityType) {
                task.metadata.targetEntity = action.params.entityType;
            }
            if (action.params.entityId) {
                task.metadata.entityId = action.params.entityId;
            }
            break;

        case 'explore':
            task.metadata.direction = action.params.direction || 'random';
            task.metadata.distance = action.params.distance || 50;
            break;

        case 'deposit':
            if (action.params.chestPos) {
                task.target = action.params.chestPos;
            }
            task.metadata.items = action.params.items || [];
            break;

        case 'eat':
            task.metadata.allowGoldenApple = action.params.allowGoldenApple || false;
            break;

        case 'equip':
            task.metadata.item = action.params.item;
            task.metadata.destination = action.params.destination || 'hand';
            break;

        case 'follow':
            if (action.params.targetPos) {
                task.target = action.params.targetPos;
            }
            task.metadata.targetId = action.params.targetId;
            task.metadata.range = action.params.range || 3;
            break;

        case 'guard':
            if (action.params.x != null) {
                task.target = {
                    x: action.params.x,
                    y: action.params.y,
                    z: action.params.z
                };
            }
            task.metadata.radius = action.params.radius || 10;
            break;
    }

    return task;
}
