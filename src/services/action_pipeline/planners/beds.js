export function planBeds({ botId, position }) {
  return {
    action: 'sleep',
    botId,
    position: position || null,
  };
}

export default planBeds;
