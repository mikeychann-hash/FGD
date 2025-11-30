// Food selection utilities
const FOOD_TABLE = [
  { id: 'minecraft:golden_apple', hunger: 4, saturation: 9.6, highValue: true },
  { id: 'minecraft:enchanted_golden_apple', hunger: 4, saturation: 9.6, highValue: true },
  { id: 'minecraft:cooked_beef', hunger: 8, saturation: 12.8 },
  { id: 'minecraft:cooked_porkchop', hunger: 8, saturation: 12.8 },
  { id: 'minecraft:cooked_mutton', hunger: 6, saturation: 9.6 },
  { id: 'minecraft:cooked_salmon', hunger: 6, saturation: 9.6 },
  { id: 'minecraft:cooked_cod', hunger: 5, saturation: 6 },
  { id: 'minecraft:cooked_chicken', hunger: 6, saturation: 7.2 },
  { id: 'minecraft:bread', hunger: 5, saturation: 6 },
  { id: 'minecraft:baked_potato', hunger: 5, saturation: 6 },
  { id: 'minecraft:carrot', hunger: 3, saturation: 3.6 },
  { id: 'minecraft:apple', hunger: 4, saturation: 2.4 },
  { id: 'minecraft:melon_slice', hunger: 2, saturation: 1.2 },
  { id: 'minecraft:beetroot', hunger: 1, saturation: 1.2 },
  { id: 'minecraft:dried_kelp', hunger: 1, saturation: 0.6 },
];

function normalizeName(name) {
  if (!name) return '';
  const lower = String(name).toLowerCase();
  return lower.startsWith('minecraft:') ? lower : `minecraft:${lower}`;
}

export function findBestFood(inventory = [], opts = {}) {
  const allowGoldenApple = opts.allowGoldenApple === true;
  const allowSuspicious = opts.allowSuspicious === true;

  let best = null;
  for (const item of inventory) {
    if (!item) continue;
    const id = normalizeName(item.name || item.id);
    const count = item.count ?? item.amount ?? 1;
    if (count <= 0) continue;
    if (id.includes('suspicious_stew') && !allowSuspicious) continue;
    const row = FOOD_TABLE.find((f) => f.id === id) || { id, hunger: 2, saturation: 1.2 };
    if (row.highValue && !allowGoldenApple) continue;
    const score = row.hunger * 2 + row.saturation;
    if (!best || score > best.score) {
      best = {
        ...row,
        slot: item.slot ?? item.hotbarSlot ?? null,
        count,
        score,
        itemId: id,
      };
    }
  }
  return best;
}

export default { findBestFood };
