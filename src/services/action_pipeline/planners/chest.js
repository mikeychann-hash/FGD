import { validatePosition } from '../validators.js';
import { pathfindToChest } from '../../chest_utils.js';

/**
 * Plan chest interaction actions.
 */
export default function planChest({ botId, mode, chestPos, items = [], fromSlot, toSlot, count, npcSystem }) {
  if (!botId) throw new Error('botId is required for chest interaction');
  const normalizedMode = mode || 'open';
  if (normalizedMode !== 'close') {
    validatePosition(chestPos);
  }

  // Optionally pre-pathfind before issuing action
  if (npcSystem && normalizedMode !== 'close') {
    pathfindToChest(npcSystem, botId, chestPos);
  }

  switch (normalizedMode) {
    case 'open':
      return { action: 'chestOpen', botId, chestPos, navigateTo: chestPos };
    case 'loot':
      return { action: 'chestLoot', botId, chestPos, items, navigateTo: chestPos };
    case 'deposit':
      return { action: 'chestDeposit', botId, chestPos, items, navigateTo: chestPos };
    case 'transfer':
      if (typeof fromSlot !== 'number' || typeof toSlot !== 'number') {
        throw new Error('transfer requires fromSlot and toSlot');
      }
      return { action: 'chestTransfer', botId, chestPos, fromSlot, toSlot, count: count ?? null, navigateTo: chestPos };
    case 'close':
      return { action: 'chestClose', botId };
    default:
      throw new Error(`Unsupported chest mode: ${normalizedMode}`);
  }
}
