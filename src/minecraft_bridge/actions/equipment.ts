export function buildEquipmentAction(payload: { botId: string; target?: string }) {
  return {
    type: 'action',
    action: 'weapon',
    botId: payload.botId,
    target: payload.target || null,
  };
}

export default buildEquipmentAction;
