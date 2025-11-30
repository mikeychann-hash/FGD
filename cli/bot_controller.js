#!/usr/bin/env node

/**
 * Bot Controller CLI
 * ------------------
 * Connects to the FGD server via WebSocket and provides real-time control
 * for a specific bot.
 *
 * Usage: node cli/bot_controller.js <botId> [host]
 */

const io = require('socket.io-client');
const readline = require('readline');

const args = process.argv.slice(2);
if (args.length < 1) {
    console.error('Usage: node cli/bot_controller.js <botId> [host]');
    process.exit(1);
}

const botId = args[0];
const host = args[1] || 'http://localhost:3000';

console.log(`Connecting to ${host} for bot ${botId}...`);

const socket = io(host);

// State tracking
let isConnected = false;
let currentPosition = { x: 0, y: 0, z: 0 };
let currentHealth = 20;

socket.on('connect', () => {
    console.log('✅ Connected to server');
    isConnected = true;

    // Start the control session
    socket.emit('control:session:start', { botId });
});

socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
    isConnected = false;
});

socket.on('control:error', (data) => {
    console.error('⚠️ Control Error:', data.error);
});

socket.on('bot:state_update', (data) => {
    if (data.botId === botId) {
        currentPosition = data.position;
        currentHealth = data.health;
        updateDisplay();
    }
});

// Input handling
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
});

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
}

const keyMap = {
    'w': 'forward',
    's': 'back',
    'a': 'left',
    'd': 'right',
    ' ': 'jump',
    'shift': 'sneak',
    'control': 'sprint'
};

process.stdin.on('keypress', (str, key) => {
    if (key.ctrl && key.name === 'c') {
        cleanup();
        process.exit();
    }

    // Toggle controls on keypress
    if (keyMap[key.name]) {
        const control = keyMap[key.name];
        socket.emit('control:toggle', { botId, control });
    } else if (key.name === 'q') {
        // Stop all
        socket.emit('control:reset', { botId });
    }
});

function updateDisplay() {
    if (!isConnected) return;
    process.stdout.write(`\rBot: ${botId} | Pos: ${currentPosition.x.toFixed(1)}, ${currentPosition.y.toFixed(1)}, ${currentPosition.z.toFixed(1)} | Health: ${currentHealth} | Controls: [WASD] Move [Space] Jump [Shift] Sneak [Q] Stop All   `);
}

function cleanup() {
    if (isConnected) {
        socket.emit('control:session:stop', { botId });
        socket.disconnect();
    }
}

console.log('Controls:');
console.log('  W/A/S/D - Toggle movement');
console.log('  Space   - Toggle jump');
console.log('  Shift   - Toggle sneak');
console.log('  Ctrl    - Toggle sprint');
console.log('  Q       - Stop all movement');
console.log('  Ctrl+C  - Exit');
