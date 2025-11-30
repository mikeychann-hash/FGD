export function planPotions({ botId, potion }) {
  return {
    action: 'potion',
    botId,
    potion,
  };
}

export default planPotions;
