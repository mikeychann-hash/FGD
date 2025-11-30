import { ensureWithinDistance } from '../../utils/chest_utils.js';

export default function planChestInteract({ botId, mode, chestPos, items = [], op, fromSlot, toSlot, count }) {
  const actionMode = mode || op;
  if (!botId) throw new Error('botId required for chest interaction');
  if (!actionMode) throw new Error('mode required for chest interaction');

  const pos = chestPos || null;
  if (actionMode !== 'close' && !pos) {
    throw new Error('chestPos is required for open/loot/deposit/transfer');
  }

  if (pos) {
    ensureWithinDistance(pos, 1000); // sanity limit for coordinates
  }

  switch (actionMode) {
    case 'open':
      return { action: 'chestOpen', botId, chestPos: pos };
    case 'loot':
      return { action: 'chestLoot', botId, chestPos: pos, items };
    case 'deposit':
      return { action: 'chestDeposit', botId, chestPos: pos, items };
    case 'transfer':
      if (typeof fromSlot !== 'number' || typeof toSlot !== 'number') {
        throw new Error('transfer requires fromSlot and toSlot');
      }
      return { action: 'chestTransfer', botId, chestPos: pos, fromSlot, toSlot, count };
    case 'close':
      return { action: 'chestClose', botId };
    default:
      throw new Error(`Unsupported chest interaction mode: ${actionMode}`);
  }
}
