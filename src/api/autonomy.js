// src/api/autonomy.js
// API routes for LLM-driven bot autonomy

import express from 'express';
import { getLLMController } from '../autonomy/llm_controller.js';
import { fail } from '../middleware/response.js';
import {
    getBotTokenStats,
    getAggregateTokenStats,
    getTokenUsageHistory,
    getPrometheusMetrics,
    resetTokenUsage
} from '../autonomy/token_profiler.js';

export function initAutonomyRoutes(npcEngine, bridge) {
    const router = express.Router();

    // Initialize LLM controller with engine and bridge
    const llmController = getLLMController({ npcEngine, bridge });

    /**
     * POST /api/autonomy/goal
     * Set a goal for a bot (makes a single decision)
     */
    router.post('/goal', async (req, res) => {
        try {
            const { botId, goal, options } = req.body;

            if (!botId || typeof botId !== 'string') {
                return fail(res, 400, 'botId is required');
            }

            if (!goal || typeof goal !== 'string') {
                return fail(res, 400, 'goal is required');
            }

            const result = await llmController.executeDecision(botId, goal, options || {});

            if (!result.success) {
                return fail(res, 500, result.error || 'LLM decision failed');
            }

            res.json({
                success: true,
                botId,
                goal,
                action: result.action,
                taskId: result.taskId,
                tokens: result.tokens
            });

        } catch (err) {
            console.error('Autonomy goal error:', err);
            return fail(res, 500, err.message);
        }
    });

    /**
     * POST /api/autonomy/start
     * Start autonomous loop for a bot
     */
    router.post('/start', async (req, res) => {
        try {
            const { botId, goal, interval, options } = req.body;

            if (!botId || typeof botId !== 'string') {
                return fail(res, 400, 'botId is required');
            }

            llmController.startAutonomousLoop(botId, {
                goal: goal || "survive and gather resources",
                interval: interval || 10000,
                ...options
            });

            res.json({
                success: true,
                botId,
                message: `Autonomous loop started for ${botId}`,
                interval: interval || 10000
            });

        } catch (err) {
            console.error('Start autonomy error:', err);
            return fail(res, 500, err.message);
        }
    });

    /**
     * POST /api/autonomy/stop
     * Stop autonomous loop for a bot
     */
    router.post('/stop', async (req, res) => {
        try {
            const { botId } = req.body;

            if (!botId || typeof botId !== 'string') {
                return fail(res, 400, 'botId is required');
            }

            llmController.stopAutonomousLoop(botId);

            res.json({
                success: true,
                botId,
                message: `Autonomous loop stopped for ${botId}`
            });

        } catch (err) {
            console.error('Stop autonomy error:', err);
            return fail(res, 500, err.message);
        }
    });

    /**
     * GET /api/autonomy/stats
     * Get autonomy statistics
     */
    router.get('/stats', (req, res) => {
        try {
            const controllerStats = llmController.getStats();
            const tokenStats = getAggregateTokenStats();

            res.json({
                controller: controllerStats,
                tokens: tokenStats
            });

        } catch (err) {
            console.error('Get stats error:', err);
            return fail(res, 500, err.message);
        }
    });

    /**
     * GET /api/autonomy/stats/:botId
     * Get token statistics for a specific bot
     */
    router.get('/stats/:botId', (req, res) => {
        try {
            const { botId } = req.params;
            const stats = getBotTokenStats(botId);

            if (!stats) {
                return fail(res, 404, `No statistics found for bot ${botId}`);
            }

            res.json({
                botId,
                ...stats
            });

        } catch (err) {
            console.error('Get bot stats error:', err);
            return fail(res, 500, err.message);
        }
    });

    /**
     * GET /api/autonomy/history
     * Get token usage history
     */
    router.get('/history', (req, res) => {
        try {
            const { botId, limit, since } = req.query;

            const history = getTokenUsageHistory({
                botId,
                limit: limit ? parseInt(limit, 10) : 100,
                since
            });

            res.json({
                count: history.length,
                history
            });

        } catch (err) {
            console.error('Get history error:', err);
            return fail(res, 500, err.message);
        }
    });

    /**
     * GET /api/autonomy/metrics
     * Get Prometheus-format metrics
     */
    router.get('/metrics', (req, res) => {
        try {
            const metrics = getPrometheusMetrics();
            res.type('text/plain').send(metrics);

        } catch (err) {
            console.error('Get metrics error:', err);
            return fail(res, 500, err.message);
        }
    });

    /**
     * DELETE /api/autonomy/stats
     * Reset token usage statistics
     */
    router.delete('/stats', (req, res) => {
        try {
            const { botId } = req.query;
            resetTokenUsage(botId);

            res.json({
                success: true,
                message: botId ? `Stats reset for ${botId}` : 'All stats reset'
            });

        } catch (err) {
            console.error('Reset stats error:', err);
            return fail(res, 500, err.message);
        }
    });

    return router;
}
