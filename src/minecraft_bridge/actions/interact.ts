export function buildInteractAction(payload: { botId: string; target?: string }) {
  return {
    type: 'action',
    action: 'interact',
    botId: payload.botId,
    target: payload.target || null,
  };
}

export default buildInteractAction;
