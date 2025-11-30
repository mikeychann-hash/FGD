export function buildDigAction(payload: { botId: string; position: any }) {
  return {
    type: 'action',
    action: 'dig',
    botId: payload.botId,
    pos: payload.position,
  };
}

export default buildDigAction;
