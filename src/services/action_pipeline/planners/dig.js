import { validateBlockBreakable, validatePosition } from '../validators.js';
import { getBlockInfo, requiredToolFor, isReachable } from '../blocks.js';

function computePath(current = null, target = null) {
  if (!current || !target) return [];
  const steps = [];
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const dz = target.z - current.z;
  const stepCount = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
  for (let i = 1; i <= stepCount; i++) {
    steps.push({
      x: current.x + Math.sign(dx) * Math.min(i, Math.abs(dx)),
      y: current.y + Math.sign(dy) * Math.min(i, Math.abs(dy)),
      z: current.z + Math.sign(dz) * Math.min(i, Math.abs(dz)),
    });
  }
  return steps;
}

export function planDig({ botId, block, position, inventory = [], currentPosition = null }) {
  validateBlockBreakable(block || 'block');
  validatePosition(position);
  const info = getBlockInfo(block || 'dirt');
  if (!info.breakable) {
    const err = new Error(`Block ${block} is not breakable`);
    err.code = 'unbreakable';
    throw err;
  }
  if (!isReachable(currentPosition, position)) {
    const err = new Error(`Target block is out of reach`);
    err.code = 'unreachable';
    throw err;
  }
  const requiredTool = requiredToolFor(info);
  const hasTool = Array.isArray(inventory)
    ? inventory.some((i) => (i?.name || i) === requiredTool)
    : true;
  if (!hasTool) {
    const err = new Error(`Missing required tool: ${requiredTool}`);
    err.code = 'missing_tool';
    throw err;
  }

  const path = computePath(currentPosition, position);

  return {
    action: 'dig',
    botId,
    target: block || null,
    position,
    tool: requiredTool,
    toolTier: info.tier,
    path,
  };
}

export default planDig;
