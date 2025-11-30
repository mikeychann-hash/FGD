// src/autonomy/llm_controller.js
// High-level LLM controller for bot autonomy with token efficiency

import { queryLLM } from '../../llm_bridge.js';
import { summarizeBotState, estimateTokenCount, createDeltaUpdate } from './state_summarizer.js';
import { validateAction, actionToTask, FEW_SHOT_EXAMPLES, ACTION_RESPONSE_FORMAT } from './action_schema.js';
import { logTokenUsage } from './token_profiler.js';

// Cached system prompt - loaded once, reused for all decisions
const SYSTEM_PROMPT = [
    "You control a Minecraft bot. Reply ONLY with JSON matching the schema.",
    "Valid actions: move, mine, craft, attack, gather, explore, deposit, eat, equip, follow, guard, idle.",
    "Use pathfinding for movement. Prioritize survival (health, hunger) then goals.",
    "Keep reasoning under 20 words.",
    "",
    "Examples:",
    ...FEW_SHOT_EXAMPLES.map((ex, i) =>
        `${i + 1}. Intent: "${ex.userIntent}" State: ${JSON.stringify(ex.botState)} → ${JSON.stringify(ex.correctResponse)}`
    )
].join("\n");

/**
 * LLM Controller for autonomous bot decisions
 */
export class LLMController {
    constructor(options = {}) {
        this.npcEngine = options.npcEngine || null;
        this.bridge = options.bridge || null;
        this.temperature = options.temperature ?? 0.2; // Low temp for consistency
        this.maxTokens = options.maxTokens ?? 200; // Keep responses short
        this.useDeltaUpdates = options.useDeltaUpdates ?? true;
        this.previousStates = new Map(); // botId -> last summary
        this.decisionInterval = options.decisionInterval ?? 10000; // 10s between decisions
        this.activeTimers = new Map(); // botId -> intervalId
    }

    /**
     * Make a single autonomous decision for a bot
     * @param {string} botId - Bot identifier
            // Check if we can use delta update
            let contextSummary = summary;
            if (this.useDeltaUpdates && this.previousStates.has(botId)) {
                const delta = createDeltaUpdate(this.previousStates.get(botId), summary);
                if (delta) {
                    contextSummary = delta;
                }
            }

            // Store current summary for next delta
            this.previousStates.set(botId, summary);

            // Build LLM request
            const messages = [
                { role: "system", content: SYSTEM_PROMPT },
                {
                    role: "user",
                    content: `Goal: "${goal}"\nState: ${JSON.stringify(contextSummary)}`
                }
            ];

            // Query LLM
            const startTime = Date.now();
            const rawResponse = await queryLLM({
                messages,
                response_format: ACTION_RESPONSE_FORMAT,
                temperature: this.temperature,
                max_tokens: this.maxTokens
            });

            if (!rawResponse) {
                throw new Error('LLM returned no response');
            }

            // Parse response
            let actionData;
            if (typeof rawResponse === 'string') {
                actionData = JSON.parse(rawResponse);
            } else {
                actionData = rawResponse;
            }

            // Validate action
            const validation = validateAction(actionData);
            if (!validation.valid) {
                throw new Error(`Invalid action: ${validation.errors.join(', ')}`);
            }

            const action = validation.data;

            // Convert to task for npc_engine
            const task = actionToTask(action, botId);

            // Log token usage
            const estimatedOutputTokens = Math.ceil(JSON.stringify(actionData).length / 4);
            const totalTokens = estimatedInputTokens + estimatedOutputTokens;
            const latency = Date.now() - startTime;

            logTokenUsage({
                botId,
                goal,
                inputTokens: estimatedInputTokens,
                outputTokens: estimatedOutputTokens,
                totalTokens,
                latency,
                action: action.action,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                action,
                task,
                tokens: totalTokens,
                latency
            };

        } catch (err) {
            console.error(`❌ LLM decision failed for ${botId}:`, err.message);
            return {
                success: false,
                error: err.message
            };
        }
    }

    /**
     * Execute a decision and enqueue the task
     * @param {string} botId - Bot identifier
     * @param {string} goal - High-level goal
     * @param {Object} options - Execution options
     * @returns {Promise<{success: boolean, taskId?: string}>}
     */
    async executeDecision(botId, goal, options = {}) {
        const decision = await this.makeDecision(botId, goal, options);

        if (!decision.success) {
            return decision;
        }

        // Enqueue task in npc_engine
        if (this.npcEngine && typeof this.npcEngine.queueTask === 'function') {
            try {
                const taskId = await this.npcEngine.queueTask(decision.task, {
                    preferredNpc: botId,
                    priority: decision.task.priority || 'normal'
                });

                return {
                    success: true,
                    taskId,
                    action: decision.action,
                    tokens: decision.tokens
                };
            } catch (err) {
                return {
                    success: false,
                    error: `Failed to queue task: ${err.message}`
                };
            }
        }

        return {
            success: true,
            task: decision.task,
            action: decision.action,
            tokens: decision.tokens
        };
    }

    /**
     * Start autonomous loop for a bot
     * Makes periodic decisions based on current state
     * @param {string} botId - Bot identifier
     * @param {Object} options - Loop options
     */
    startAutonomousLoop(botId, options = {}) {
        // Stop existing loop if any
        this.stopAutonomousLoop(botId);

        const interval = options.interval || this.decisionInterval;
        const baseGoal = options.goal || "survive and gather resources";

        const timerId = setInterval(async () => {
            try {
                // Check if bot is idle
                const botState = await this._getBotState(botId);
                if (!botState) {
                    console.warn(`⚠️  Bot ${botId} not found, stopping autonomous loop`);
                    this.stopAutonomousLoop(botId);
                    return;
                }

                // Skip if bot is busy with a task
                if (botState.state === 'busy' || botState.task) {
                    return;
                }

                // Make autonomous decision
                await this.executeDecision(botId, baseGoal, options);

            } catch (err) {
                console.error(`❌ Autonomous loop error for ${botId}:`, err.message);
            }
        }, interval);

        this.activeTimers.set(botId, timerId);
        console.log(`✅ Started autonomous loop for ${botId} (interval: ${interval}ms)`);
    }

    /**
     * Stop autonomous loop for a bot
     * @param {string} botId - Bot identifier
     */
    stopAutonomousLoop(botId) {
        const timerId = this.activeTimers.get(botId);
        if (timerId) {
            clearInterval(timerId);
            this.activeTimers.delete(botId);
            console.log(`🛑 Stopped autonomous loop for ${botId}`);
        }
    }

    /**
     * Stop all autonomous loops
     */
    stopAll() {
        for (const [botId, timerId] of this.activeTimers) {
            clearInterval(timerId);
            console.log(`🛑 Stopped autonomous loop for ${botId}`);
        }
        this.activeTimers.clear();
    }

    /**
     * Get bot state from engine or bridge
     * @private
     */
    async _getBotState(botId) {
        // Try npc_engine first
        if (this.npcEngine && typeof this.npcEngine.getNPC === 'function') {
            const npc = this.npcEngine.getNPC(botId);
            if (npc) return npc;
        }

        // Try bridge
        if (this.bridge && typeof this.bridge.getBotState === 'function') {
            try {
                return await this.bridge.getBotState(botId);
            } catch (err) {
                console.warn(`⚠️  Failed to get bot state from bridge: ${err.message}`);
            }
        }

        return null;
    }

    /**
     * Get statistics for all autonomous bots
     * @returns {Object} Stats summary
     */
    getStats() {
        return {
            activeBots: this.activeTimers.size,
            botIds: Array.from(this.activeTimers.keys()),
            decisionInterval: this.decisionInterval,
            useDeltaUpdates: this.useDeltaUpdates
        };
    }
}

/**
 * Create a singleton instance
 */
let _instance = null;

export function getLLMController(options) {
    if (!_instance) {
        _instance = new LLMController(options);
    }
    return _instance;
}

export function resetLLMController() {
    if (_instance) {
        _instance.stopAll();
        _instance = null;
    }
}
