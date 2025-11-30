// src/services/action_pipeline/validators.js
// Basic validation helpers for Unified Action Framework

import { SpawnError } from '../spawn_pipeline.js';

export function validateRequest(npcSystem, { botId, type, payload }) {
  if (!botId) {
    throw new SpawnError('botId is required', 400);
  }
  if (!type) {
    throw new SpawnError('action type is required', 400);
  }
  const registry = npcSystem?.npcEngine?.registry;
  const bot = registry?.get(botId);
  if (!bot) {
    throw new SpawnError(`Bot ${botId} not found`, 404);
  }
  if (bot.status !== 'active') {
    throw new SpawnError(`Bot ${botId} is not active`, 400);
  }
  return bot;
}

export function validatePosition(pos) {
  if (!pos) return;
  const keys = ['x', 'y', 'z'];
  keys.forEach((k) => {
    if (typeof pos[k] !== 'number') {
      throw new SpawnError(`Invalid position.${k}`, 400);
    }
  });
}

export function validateBlockBreakable(blockId = '') {
  if (!blockId) {
    throw new SpawnError('block is required for mining/digging', 400);
  }
  const lower = String(blockId).toLowerCase();
  const forbidden = ['bedrock', 'barrier', 'end_portal_frame'];
  if (forbidden.some((b) => lower.includes(b))) {
    throw new SpawnError(`Block ${blockId} is not breakable`, 400);
  }
}

export default {
  validateRequest,
  validatePosition,
  validateBlockBreakable,
};
