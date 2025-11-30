// src/services/bot_control_manager.js

/**
 * BotControlManager
 * -----------------
 * Manages per‑bot control states (forward, back, left, right, jump, sprint, sneak)
 * and provides helpers to apply those states to a Mineflayer bot via
 * `bot.setControlState(control, active)`. It also tracks active control
 * sessions so that state updates can be streamed to clients.
 */

import EventEmitter from 'events';

export class BotControlManager extends EventEmitter {
  constructor() {
    super();
    /**
     * Map of botId -> control state object.
     * Each state object contains boolean flags for the supported controls.
     */
    this.controlStates = new Map();
    /**
     * Map of botId -> interval timer for state streaming.
     */
    this.streamingIntervals = new Map();
  }

  /** Ensure a control state entry exists for the bot. */
  _ensureBotEntry(botId) {
    if (!this.controlStates.has(botId)) {
      this.controlStates.set(botId, {
        forward: false,
        back: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        sneak: false,
      });
    }
  }

  /** Set a specific control to a boolean state. */
  setControl(botId, control, active) {
    this._ensureBotEntry(botId);
    const state = this.controlStates.get(botId);
    if (!(control in state)) {
      throw new Error(`Unsupported control "${control}"`);
    }
    state[control] = !!active;
    this.emit('control:changed', { botId, control, active: !!active });
    return state;
  }

  /** Toggle a control flag. */
  toggleControl(botId, control) {
    this._ensureBotEntry(botId);
    const state = this.controlStates.get(botId);
    if (!(control in state)) {
      throw new Error(`Unsupported control "${control}"`);
    }
    state[control] = !state[control];
    this.emit('control:changed', { botId, control, active: state[control] });
    return state;
  }

  /** Reset all controls for a bot. */
  resetControls(botId) {
    this._ensureBotEntry(botId);
    const state = this.controlStates.get(botId);
    Object.keys(state).forEach((k) => (state[k] = false));
    this.emit('control:reset', { botId });
    return state;
  }

  /** Get the current control map for a bot. */
  getState(botId) {
    this._ensureBotEntry(botId);
    // Return a shallow copy to avoid external mutation.
    return { ...this.controlStates.get(botId) };
  }

  /** Start a high‑frequency state streaming session for a bot.
   *  The caller must provide a `emit` function (e.g., socket.emit) that will
   *  receive the `bot:state_update` payload.
   */
  startControlSession(botId, emitFn) {
    if (this.streamingIntervals.has(botId)) {
      // Session already active – replace the emit function.
      clearInterval(this.streamingIntervals.get(botId).interval);
    }
    const interval = setInterval(() => {
      const state = this.getState(botId);
      emitFn('bot:state_update', { botId, controls: state, timestamp: Date.now() });
    }, 100); // ~10 Hz
    this.streamingIntervals.set(botId, { interval, emitFn });
    this.emit('session:start', { botId });
  }

  /** Stop the streaming session for a bot. */
  stopControlSession(botId) {
    const entry = this.streamingIntervals.get(botId);
    if (entry) {
      clearInterval(entry.interval);
      this.streamingIntervals.delete(botId);
      this.emit('session:stop', { botId });
    }
  }
}

// Export a singleton for easy import throughout the codebase.
// Expose a method to retrieve the underlying Mineflayer bot instance.
// This is used by BotCommandManager for high‑level actions.
BotControlManager.prototype.getBotInstance = function (botId) {
  // Lazy‑require to avoid circular dependencies.
  try {
    const { npcSystem } = require('../src/services/npc_initializer');
    const bridge = npcSystem?.mineflayerBridge;
    if (bridge && bridge.bots && bridge.bots.has(botId)) {
      return bridge.bots.get(botId);
    }
    throw new Error(`Bot ${botId} not found in MineflayerBridge`);
  } catch (err) {
    // If the initializer is not available, fallback to a direct require of the bridge.
    const { MineflayerBridge } = require('../minecraft_bridge_mineflayer.js');
    // This fallback is unlikely to be used in production.
    throw err;
  }
};

export const botControlManager = new BotControlManager();
