export function buildMineAction(payload: { botId: string; target?: string; position?: any }) {
  return {
    type: 'action',
    action: 'mine',
    botId: payload.botId,
    target: payload.target,
    pos: payload.position || null,
  };
}

export default buildMineAction;
