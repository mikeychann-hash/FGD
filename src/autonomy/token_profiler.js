// src/autonomy/token_profiler.js
// Token usage profiler and metrics tracker

import EventEmitter from 'events';

/**
 * Token profiler for monitoring LLM token usage
 */
class TokenProfiler extends EventEmitter {
    constructor() {
        super();
        this.usageHistory = []; // Array of usage records
        this.botTotals = new Map(); // botId -> cumulative stats
        this.maxHistorySize = 1000; // Keep last 1000 decisions
    }

    /**
     * Log token usage for a decision
     * @param {Object} usage - Usage record
     */
    log(usage) {
        const record = {
            ...usage,
            timestamp: usage.timestamp || new Date().toISOString()
        };

        // Add to history
        this.usageHistory.push(record);
        if (this.usageHistory.length > this.maxHistorySize) {
            this.usageHistory.shift(); // Remove oldest
        }

        // Update bot totals
        const botId = usage.botId;
        if (!this.botTotals.has(botId)) {
            this.botTotals.set(botId, {
                totalTokens: 0,
                totalDecisions: 0,
                totalInputTokens: 0,
                totalOutputTokens: 0,
                totalLatency: 0,
                actionCounts: {}
            });
        }

        const stats = this.botTotals.get(botId);
        stats.totalTokens += usage.totalTokens || 0;
        stats.totalInputTokens += usage.inputTokens || 0;
        stats.totalOutputTokens += usage.outputTokens || 0;
        stats.totalLatency += usage.latency || 0;
        stats.totalDecisions += 1;

        if (usage.action) {
            stats.actionCounts[usage.action] = (stats.actionCounts[usage.action] || 0) + 1;
        }

        this.botTotals.set(botId, stats);

        // Emit metrics event for dashboard
        this.emit('usage', record);

        // Check for alerts
        this._checkAlerts(usage, stats);
    }

    /**
     * Get usage statistics for a bot
     * @param {string} botId - Bot identifier
     * @returns {Object|null} Bot statistics
     */
    getBotStats(botId) {
        const stats = this.botTotals.get(botId);
        if (!stats) return null;

        return {
            ...stats,
            avgTokensPerDecision: stats.totalDecisions > 0
                ? Math.round(stats.totalTokens / stats.totalDecisions)
                : 0,
            avgLatency: stats.totalDecisions > 0
                ? Math.round(stats.totalLatency / stats.totalDecisions)
                : 0
        };
    }

    /**
     * Get aggregate statistics across all bots
     * @returns {Object} Aggregate stats
     */
    getAggregateStats() {
        let totalTokens = 0;
        let totalDecisions = 0;
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        const actionCounts = {};

        for (const stats of this.botTotals.values()) {
            totalTokens += stats.totalTokens;
            totalDecisions += stats.totalDecisions;
            totalInputTokens += stats.totalInputTokens;
            totalOutputTokens += stats.totalOutputTokens;

            for (const [action, count] of Object.entries(stats.actionCounts)) {
                actionCounts[action] = (actionCounts[action] || 0) + count;
            }
        }

        return {
            totalBots: this.botTotals.size,
            totalTokens,
            totalDecisions,
            totalInputTokens,
            totalOutputTokens,
            avgTokensPerDecision: totalDecisions > 0
                ? Math.round(totalTokens / totalDecisions)
                : 0,
            actionCounts,
            compressionRatio: totalInputTokens > 0
                ? (1 - (totalInputTokens / (totalInputTokens + totalOutputTokens))).toFixed(2)
                : 0
        };
    }

    /**
     * Get recent usage history
     * @param {Object} options - Filter options
     * @returns {Array} Usage records
     */
    getHistory(options = {}) {
        const {
            botId,
            limit = 100,
            since
        } = options;

        let records = [...this.usageHistory];

        // Filter by botId
        if (botId) {
            records = records.filter(r => r.botId === botId);
        }

        // Filter by timestamp
        if (since) {
            const sinceTime = new Date(since).getTime();
            records = records.filter(r => new Date(r.timestamp).getTime() >= sinceTime);
        }

        // Limit results
        return records.slice(-limit);
    }

    /**
     * Export metrics in Prometheus format
     * @returns {string} Prometheus-compatible metrics
     */
    toPrometheus() {
        const lines = [];

        // Total tokens metric
        lines.push('# HELP fgd_llm_tokens_total Total LLM tokens used');
        lines.push('# TYPE fgd_llm_tokens_total counter');
        for (const [botId, stats] of this.botTotals) {
            lines.push(`fgd_llm_tokens_total{bot_id="${botId}"} ${stats.totalTokens}`);
        }

        // Decisions metric
        lines.push('# HELP fgd_llm_decisions_total Total LLM decisions made');
        lines.push('# TYPE fgd_llm_decisions_total counter');
        for (const [botId, stats] of this.botTotals) {
            lines.push(`fgd_llm_decisions_total{bot_id="${botId}"} ${stats.totalDecisions}`);
        }

        // Average tokens per decision
        lines.push('# HELP fgd_llm_avg_tokens_per_decision Average tokens per decision');
        lines.push('# TYPE fgd_llm_avg_tokens_per_decision gauge');
        for (const [botId, stats] of this.botTotals) {
            const avg = stats.totalDecisions > 0
                ? Math.round(stats.totalTokens / stats.totalDecisions)
                : 0;
            lines.push(`fgd_llm_avg_tokens_per_decision{bot_id="${botId}"} ${avg}`);
        }

        // Action counts
        lines.push('# HELP fgd_llm_action_total Total actions by type');
        lines.push('# TYPE fgd_llm_action_total counter');
        for (const [botId, stats] of this.botTotals) {
            for (const [action, count] of Object.entries(stats.actionCounts)) {
                lines.push(`fgd_llm_action_total{bot_id="${botId}",action="${action}"} ${count}`);
            }
        }

        return lines.join('\n') + '\n';
    }

    /**
     * Reset statistics for a bot or all bots
     * @param {string} [botId] - Bot ID to reset, or null for all
     */
    reset(botId = null) {
        if (botId) {
            this.botTotals.delete(botId);
            this.usageHistory = this.usageHistory.filter(r => r.botId !== botId);
        } else {
            this.botTotals.clear();
            this.usageHistory = [];
        }
    }

    /**
     * Check for usage alerts and emit warnings
     * @private
     */
    _checkAlerts(usage, stats) {
        // Alert if single decision uses >300 tokens (target is ~150)
        if (usage.totalTokens > 300) {
            this.emit('alert', {
                type: 'high_token_usage',
                botId: usage.botId,
                tokens: usage.totalTokens,
                threshold: 300,
                message: `Bot ${usage.botId} used ${usage.totalTokens} tokens in one decision (threshold: 300)`
            });
        }

        // Alert if average is drifting  up (>200 tokens per decision)
        const avg = stats.totalDecisions > 0
            ? stats.totalTokens / stats.totalDecisions
            : 0;
        if (avg > 200 && stats.totalDecisions > 10) {
            this.emit('alert', {
                type: 'high_average_usage',
                botId: usage.botId,
                average: Math.round(avg),
                threshold: 200,
                message: `Bot ${usage.botId} average usage is ${Math.round(avg)} tokens (threshold: 200)`
            });
        }

        // Alert if latency >5s
        if (usage.latency > 5000) {
            this.emit('alert', {
                type: 'high_latency',
                botId: usage.botId,
                latency: usage.latency,
                threshold: 5000,
                message: `Bot ${usage.botId} decision took ${usage.latency}ms (threshold: 5000ms)`
            });
        }
    }
}

// Singleton instance
const profiler = new TokenProfiler();

/**
 * Log token usage
 * @param {Object} usage - Usage record
 */
export function logTokenUsage(usage) {
    profiler.log(usage);
}

/**
 * Get bot statistics
 * @param {string} botId - Bot identifier
 * @returns {Object|null} Bot statistics
 */
export function getBotTokenStats(botId) {
    return profiler.getBotStats(botId);
}

/**
 * Get aggregate statistics
 * @returns {Object} Aggregate stats
 */
export function getAggregateTokenStats() {
    return profiler.getAggregateStats();
}

/**
 * Get usage history
 * @param {Object} options - Filter options
 * @returns {Array} Usage records
 */
export function getTokenUsageHistory(options) {
    return profiler.getHistory(options);
}

/**
 * Export metrics in Prometheus format
 * @returns {string} Prometheus metrics
 */
export function getPrometheusMetrics() {
    return profiler.toPrometheus();
}

/**
 * Reset token usage statistics
 * @param {string} [botId] - Bot ID to reset, or null for all
 */
export function resetTokenUsage(botId) {
    profiler.reset(botId);
}

/**
 * Get the profiler instance (for event listeners)
 * @returns {TokenProfiler} Profiler instance
 */
export function getTokenProfiler() {
    return profiler;
}

export { TokenProfiler };
