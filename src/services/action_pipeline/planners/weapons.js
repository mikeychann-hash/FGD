export function planWeapons({ botId, target }) {
  return {
    action: 'weapon',
    botId,
    target: target || null,
  };
}

export default planWeapons;
