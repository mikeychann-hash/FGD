export function planDoors({ botId, target, operation }) {
  return {
    action: 'doors',
    botId,
    target: target || null,
    operation: operation || 'toggle',
  };
}

export default planDoors;
