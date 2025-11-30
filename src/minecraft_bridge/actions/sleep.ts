export function buildSleepAction(payload: { botId: string; position?: any }) {
  return {
    type: 'action',
    action: 'sleep',
    botId: payload.botId,
    pos: payload.position || null,
  };
}

export default buildSleepAction;
