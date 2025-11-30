// src/websocket/control_handlers.js

/**
 * Control Handlers
 * ---------------
 * Registers WebSocket event listeners for real‑time bot control.
 * Expected events from the client:
 *   - `control:set`   { botId, control, state }
 *   - `control:toggle` { botId, control }
 *   - `control:reset`  { botId }
 *   - `control:look`   { botId, yaw, pitch }
 *   - `control:session:start` { botId }
 *   - `control:session:stop`  { botId }
 *
 * The handlers use the BotControlManager service to track control state and
 * broadcast updates, and they directly manipulate the Mineflayer bot instance
 * (retrieved from `npcSystem.mineflayerBridge`).
 */

import { botControlManager } from '../services/bot_control_manager.js';

/**
 * Helper to get the Mineflayer bot instance for a given botId.
 */
function getBotInstance(npcSystem, botId) {
    if (!npcSystem || !npcSystem.mineflayerBridge) {
        throw new Error('Mineflayer bridge not initialized');
    }
    const bot = npcSystem.mineflayerBridge.bots.get(botId);
    if (!bot) {
        throw new Error(`Bot ${botId} not found`);
    }
    return bot;
}

export function registerControlHandlers(io, npcSystem) {
    // New connection handler – we attach control listeners per socket.
    io.on('connection', (socket) => {
        // Set a specific control state (true/false).
        socket.on('control:set', ({ botId, control, state }) => {
            try {
                const bot = getBotInstance(npcSystem, botId);
                bot.setControlState(control, !!state);
                botControlManager.setControl(botId, control, !!state);
                socket.emit('control:ack', { botId, control, state: !!state });
            } catch (err) {
                socket.emit('control:error', { error: err.message });
            }
        });

        // Toggle a control flag.
        socket.on('control:toggle', ({ botId, control }) => {
            try {
                const bot = getBotInstance(npcSystem, botId);
                const current = botControlManager.getState(botId)[control] || false;
                const newState = !current;
                bot.setControlState(control, newState);
                botControlManager.toggleControl(botId, control);
                socket.emit('control:ack', { botId, control, state: newState });
            } catch (err) {
                socket.emit('control:error', { error: err.message });
            }
        });

        // Reset all controls for a bot.
        socket.on('control:reset', ({ botId }) => {
            try {
                const bot = getBotInstance(npcSystem, botId);
                const controls = [
                    'forward',
                    'back',
                    'left',
                    'right',
                    'jump',
                    'sprint',
                    'sneak',
                ];
                controls.forEach((c) => bot.setControlState(c, false));
                botControlManager.resetControls(botId);
                socket.emit('control:reset_ack', { botId });
            } catch (err) {
                socket.emit('control:error', { error: err.message });
            }
        });

        // Update the bot's look direction.
        socket.on('control:look', ({ botId, yaw, pitch }) => {
            try {
                const bot = getBotInstance(npcSystem, botId);
                // Mineflayer's look method accepts yaw, pitch (in radians) and a force flag.
                bot.look(yaw, pitch, true);
                socket.emit('control:look_ack', { botId, yaw, pitch });
            } catch (err) {
                socket.emit('control:error', { error: err.message });
            }
        });

        // Start streaming control state updates to the client.
        socket.on('control:session:start', ({ botId }) => {
            try {
                botControlManager.startControlSession(botId, io.emit.bind(io));
                socket.emit('control:session_started', { botId });
            } catch (err) {
                socket.emit('control:error', { error: err.message });
            }
        });

        // Stop the streaming session.
        socket.on('control:session:stop', ({ botId }) => {
            try {
                botControlManager.stopControlSession(botId);
                socket.emit('control:session_stopped', { botId });
            } catch (err) {
                socket.emit('control:error', { error: err.message });
            }
        });
    });
}
