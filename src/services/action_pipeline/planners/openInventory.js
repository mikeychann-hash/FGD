export function planOpenInventory({ botId, target }) {
  return {
    action: 'openInventory',
    botId,
    target: target || null,
  };
}

export default planOpenInventory;
