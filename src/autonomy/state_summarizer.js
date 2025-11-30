// src/autonomy/state_summarizer.js
// Compresses bot state to minimize LLM token usage

/**
 * Summarizes bot state into a compact representation
 * Target: ~50-100 tokens instead of 500+
 * 
 * @param {Object} botState - Full bot state from npc_engine or bridge
 * @param {Object} options - Summarization options
 * @returns {Object} Compressed state suitable for LLM context
 */
export function summarizeBotState(botState, options = {}) {
    const {
        maxNearbyEntities = 5,
        maxNearbyBlocks = 10,
        includeInventory = true,
        includeGoal = true,
        entityDistanceThreshold = 32,
        blockDistanceThreshold = 16
    } = options;

    const summary = {
        id: botState.id || botState.botId,
        health: Math.round(botState.health ?? 20),
        hunger: Math.round(botState.food ?? botState.hunger ?? 20),
    };

    // Position (rounded to save tokens)
    if (botState.position) {
        summary.pos = {
            x: Math.round(botState.position.x),
            y: Math.round(botState.position.y),
            z: Math.round(botState.position.z)
        };
    }

    // Inventory summary - just counts, not full metadata
    if (includeInventory && botState.inventory) {
        summary.inv = summarizeInventory(botState.inventory);
    } else if (includeInventory && botState.inventoryItems) {
        summary.inv = summarizeInventory(botState.inventoryItems);
    }

    // Nearby entities - top N by distance/importance
    if (botState.nearby?.entities || botState.entities) {
        const entities = botState.nearby?.entities || botState.entities || [];
        summary.entities = summarizeEntities(entities, maxNearbyEntities, entityDistanceThreshold);
    }

    // Nearby blocks - resources only
    if (botState.nearby?.blocks || botState.blocks) {
        const blocks = botState.nearby?.blocks || botState.blocks || [];
        summary.blocks = summarizeBlocks(blocks, maxNearbyBlocks, blockDistanceThreshold);
    }

    // Current goal/task (if any)
    if (includeGoal && botState.task) {
        summary.task = {
            action: botState.task.action,
            target: botState.task.target ? formatPosition(botState.task.target) : null
        };
    }

    // Goal distance (if pathfinding)
    if (botState.goalDistance != null) {
        summary.goalDist = Math.round(botState.goalDistance);
    }

    return summary;
}

/**
 * Summarizes inventory to item counts only
 * @param {Array} inventory - Full inventory array
 * @returns {Object} Item name -> count mapping
 */
function summarizeInventory(inventory) {
    if (!Array.isArray(inventory)) return {};

    const counts = {};
    for (const item of inventory) {
        if (!item || !item.name) continue;
        const name = item.name;
        counts[name] = (counts[name] || 0) + (item.count || 1);
    }

    // Only return top 15 most abundant items to save tokens
    return Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 15)
        .reduce((acc, [name, count]) => {
            acc[name] = count;
            return acc;
        }, {});
}

/**
 * Summarizes nearby entities - closest N only
 * @param {Array} entities - Full entity list
 * @param {number} maxCount - Max entities to include
 * @param {number} distanceThreshold - Max distance to consider
 * @returns {Array} Compressed entity list
 */
function summarizeEntities(entities, maxCount, distanceThreshold) {
    if (!Array.isArray(entities)) return [];

    return entities
        .filter(e => {
            if (!e || !e.type) return false;
            // Filter by distance if available
            if (e.distance != null && e.distance > distanceThreshold) return false;
            return true;
        })
        .sort((a, b) => {
            // Sort by importance: hostile > passive > other
            const getPriority = (e) => {
                const type = (e.type || '').toLowerCase();
                if (type.includes('zombie') || type.includes('skeleton') || type.includes('creeper') || type.includes('spider')) return 3;
                if (type.includes('cow') || type.includes('sheep') || type.includes('pig') || type.includes('chicken')) return 2;
                return 1;
            };
            const priorityDiff = getPriority(b) - getPriority(a);
            if (priorityDiff !== 0) return priorityDiff;

            // Then by distance
            return (a.distance || 999) - (b.distance || 999);
        })
        .slice(0, maxCount)
        .map(e => ({
            type: e.type,
            dist: e.distance != null ? Math.round(e.distance) : null
        }));
}

/**
 * Summarizes nearby blocks - resources only (no air, stone, dirt)
 * @param {Array} blocks - Full block list
 * @param {number} maxCount - Max blocks to include
 * @param {number} distanceThreshold - Max distance to consider
 * @returns {Array} Compressed block list
 */
function summarizeBlocks(blocks, maxCount, distanceThreshold) {
    if (!Array.isArray(blocks)) return [];

    // Resource blocks we care about
    const resourceTypes = new Set([
        'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'emerald_ore', 'redstone_ore', 'lapis_ore',
        'oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log',
        'oak_leaves', 'wheat', 'carrots', 'potatoes', 'beetroots',
        'chest', 'furnace', 'crafting_table', 'anvil'
    ]);

    return blocks
        .filter(b => {
            if (!b || !b.type) return false;
            const type = b.type || b.name || '';
            // Only include resource blocks
            if (!resourceTypes.has(type) && !type.includes('ore') && !type.includes('log')) return false;
            // Filter by distance if available
            if (b.distance != null && b.distance > distanceThreshold) return false;
            return true;
        })
        .sort((a, b) => {
            // Sort by value: ores > logs > crops
            const getValue = (b) => {
                const type = (b.type || b.name || '').toLowerCase();
                if (type.includes('diamond')) return 5;
                if (type.includes('emerald')) return 4;
                if (type.includes('gold') || type.includes('iron')) return 3;
                if (type.includes('coal') || type.includes('ore')) return 2;
                return 1;
            };
            const valueDiff = getValue(b) - getValue(a);
            if (valueDiff !== 0) return valueDiff;

            return (a.distance || 999) - (b.distance || 999);
        })
        .slice(0, maxCount)
        .map(b => ({
            type: b.type || b.name,
            dist: b.distance != null ? Math.round(b.distance) : null
        }));
}

/**
 * Formats position to compact string
 * @param {Object} pos - Position {x, y, z}
 * @returns {string} Compact position string
 */
function formatPosition(pos) {
    if (!pos) return null;
    return `${Math.round(pos.x)},${Math.round(pos.y)},${Math.round(pos.z)}`;
}

/**
 * Estimates token count for summarized state
 * Rough approximation: 1 token ≈ 4 characters
 * @param {Object} summary - Summarized state
 * @returns {number} Estimated token count
 */
export function estimateTokenCount(summary) {
    const jsonString = JSON.stringify(summary);
    return Math.ceil(jsonString.length / 4);
}

/**
 * Creates a delta update between two state summaries
 * Only includes what changed to minimize tokens
 * @param {Object} previousSummary - Previous state summary
 * @param {Object} currentSummary - Current state summary
 * @returns {Object} Delta containing only changes
 */
export function createDeltaUpdate(previousSummary, currentSummary) {
    if (!previousSummary) return currentSummary;

    const delta = { id: currentSummary.id };
    let hasChanges = false;

    // Check health/hunger changes
    if (previousSummary.health !== currentSummary.health) {
        delta.health = currentSummary.health;
        hasChanges = true;
    }
    if (previousSummary.hunger !== currentSummary.hunger) {
        delta.hunger = currentSummary.hunger;
        hasChanges = true;
    }

    // Check position changes (significant movement only)
    if (currentSummary.pos && previousSummary.pos) {
        const distMoved = Math.sqrt(
            Math.pow(currentSummary.pos.x - previousSummary.pos.x, 2) +
            Math.pow(currentSummary.pos.z - previousSummary.pos.z, 2)
        );
        if (distMoved > 5) { // Only report if moved >5 blocks
            delta.pos = currentSummary.pos;
            hasChanges = true;
        }
    } else if (currentSummary.pos) {
        delta.pos = currentSummary.pos;
        hasChanges = true;
    }

    // Inventory changes
    if (currentSummary.inv && JSON.stringify(previousSummary.inv) !== JSON.stringify(currentSummary.inv)) {
        delta.inv = currentSummary.inv;
        hasChanges = true;
    }

    // Entity changes (if entity types changed)
    if (currentSummary.entities && JSON.stringify(previousSummary.entities) !== JSON.stringify(currentSummary.entities)) {
        delta.entities = currentSummary.entities;
        hasChanges = true;
    }

    // Block changes
    if (currentSummary.blocks && JSON.stringify(previousSummary.blocks) !== JSON.stringify(currentSummary.blocks)) {
        delta.blocks = currentSummary.blocks;
        hasChanges = true;
    }

    // Task changes
    if (currentSummary.task && JSON.stringify(previousSummary.task) !== JSON.stringify(currentSummary.task)) {
        delta.task = currentSummary.task;
        hasChanges = true;
    }

    return hasChanges ? delta : null;
}
