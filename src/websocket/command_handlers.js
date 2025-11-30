// src/websocket/command_handlers.js

/**
 * High‑level command handlers for Mineflayer bots.
 * Listens for `command:*` events from the client and forwards them to BotCommandManager.
 */

const { botCommandManager } = require('../src/services/bot_command_manager');

function registerCommandHandlers(io) {
    io.on('connection', (socket) => {
        // Mine a block type
        socket.on('command:mine', async ({ botId, block, count }) => {
            try {
                await botCommandManager.mine(botId, block, count);
                socket.emit('command:ack', { botId, command: 'mine', status: 'ok' });
            } catch (err) {
                socket.emit('command:error', { botId, command: 'mine', error: err.message });
            }
        });

        // Craft an item
        socket.on('command:craft', async ({ botId, recipe, count }) => {
            try {
                await botCommandManager.craft(botId, recipe, count);
                socket.emit('command:ack', { botId, command: 'craft', status: 'ok' });
            } catch (err) {
                socket.emit('command:error', { botId, command: 'craft', error: err.message });
            }
        });

        // Attack a target entity
        socket.on('command:attack', async ({ botId, targetId }) => {
            try {
                await botCommandManager.attack(botId, targetId);
                socket.emit('command:ack', { botId, command: 'attack', status: 'ok' });
            } catch (err) {
                socket.emit('command:error', { botId, command: 'attack', error: err.message });
            }
        });

        // Explore a random area
        socket.on('command:explore', async ({ botId, radius }) => {
            try {
                await botCommandManager.explore(botId, radius);
                socket.emit('command:ack', { botId, command: 'explore', status: 'ok' });
            } catch (err) {
                socket.emit('command:error', { botId, command: 'explore', error: err.message });
            }
        });

        // Build from a blueprint (array of block placements)
        socket.on('command:build', async ({ botId, blueprint }) => {
            try {
                await botCommandManager.build(botId, blueprint);
                socket.emit('command:ack', { botId, command: 'build', status: 'ok' });
            } catch (err) {
                socket.emit('command:error', { botId, command: 'build', error: err.message });
            }
        });
    });
}

module.exports = { registerCommandHandlers };
