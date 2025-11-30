import { findBestFood } from '../food.js';

export function planEat({ botId, inventory = [], allowGoldenApple = false, allowSuspicious = false }) {
  const bestFood = findBestFood(inventory, { allowGoldenApple, allowSuspicious });
  if (!bestFood) {
    const err = new Error('No edible food available');
    err.code = 'no_food';
    throw err;
  }
  return {
    action: 'eat',
    botId,
    food: {
      itemId: bestFood.itemId,
      slot: bestFood.slot,
      count: bestFood.count,
    },
  };
}

export default planEat;
