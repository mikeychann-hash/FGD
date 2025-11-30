export function buildChestAction(payload: { botId: string; target?: string; operation?: string }) {
  return {
    type: 'action',
    action: 'chest',
    botId: payload.botId,
    target: payload.target || null,
    operation: payload.operation || 'open',
  };
}

export default buildChestAction;
