// Block catalogue for mining/digging hardness and tool requirements
// Keep lightweight: id -> { breakable, tool: 'pickaxe'|'shovel', tier: 'wood'|'stone'|'iron'|'diamond', tags: [] }

const HARDNESS = {
  stone: { tool: 'pickaxe', tier: 'wood' },
  cobblestone: { tool: 'pickaxe', tier: 'wood' },
  deepslate: { tool: 'pickaxe', tier: 'stone' },
  coal_ore: { tool: 'pickaxe', tier: 'wood' },
  iron_ore: { tool: 'pickaxe', tier: 'stone' },
  copper_ore: { tool: 'pickaxe', tier: 'stone' },
  lapis_ore: { tool: 'pickaxe', tier: 'stone' },
  redstone_ore: { tool: 'pickaxe', tier: 'iron' },
  gold_ore: { tool: 'pickaxe', tier: 'iron' },
  diamond_ore: { tool: 'pickaxe', tier: 'iron' },
  emerald_ore: { tool: 'pickaxe', tier: 'iron' },
  ancient_debris: { tool: 'pickaxe', tier: 'diamond' },
  obsidian: { tool: 'pickaxe', tier: 'diamond' },
  dirt: { tool: 'shovel', tier: 'wood' },
  grass_block: { tool: 'shovel', tier: 'wood' },
  sand: { tool: 'shovel', tier: 'wood' },
  gravel: { tool: 'shovel', tier: 'wood' },
  snow: { tool: 'shovel', tier: 'wood' },
  clay: { tool: 'shovel', tier: 'wood' },
};

const UNBREAKABLE = ['bedrock', 'barrier', 'end_portal_frame'];

function normalizeId(id) {
  if (!id) return '';
  const lower = String(id).toLowerCase();
  return lower.startsWith('minecraft:') ? lower.replace('minecraft:', '') : lower;
}

export function getBlockInfo(blockId) {
  const norm = normalizeId(blockId);
  if (!norm) return { breakable: false };
  if (UNBREAKABLE.some((u) => norm.includes(u))) return { breakable: false };
  const info = HARDNESS[norm];
  if (info) return { breakable: true, ...info, id: norm };

  // Heuristic fallback
  if (norm.includes('ore') || norm.includes('stone') || norm.includes('deepslate')) {
    return { breakable: true, tool: 'pickaxe', tier: norm.includes('diamond') || norm.includes('ancient') ? 'iron' : 'stone', id: norm };
  }
  if (norm.includes('dirt') || norm.includes('sand') || norm.includes('gravel') || norm.includes('snow')) {
    return { breakable: true, tool: 'shovel', tier: 'wood', id: norm };
  }
  return { breakable: true, tool: 'pickaxe', tier: 'wood', id: norm };
}

export function requiredToolFor(info = {}) {
  const tool = info.tool || 'pickaxe';
  const tier = info.tier || 'wood';
  const prefix = tier === 'diamond' ? 'diamond' : tier === 'iron' ? 'iron' : tier === 'stone' ? 'stone' : 'wood';
  return `${prefix}_${tool}`;
}

export function isReachable(botPos, targetPos, maxReach = 128) {
  if (!botPos || !targetPos) return true;
  const dx = botPos.x - targetPos.x;
  const dy = botPos.y - targetPos.y;
  const dz = botPos.z - targetPos.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return dist <= maxReach;
}

export default {
  getBlockInfo,
  requiredToolFor,
  isReachable,
};
