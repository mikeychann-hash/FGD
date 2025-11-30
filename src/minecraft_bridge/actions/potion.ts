export function buildPotionAction(payload: { botId: string; potion?: string }) {
  return {
    type: 'action',
    action: 'potion',
    botId: payload.botId,
    potion: payload.potion || null,
  };
}

export default buildPotionAction;
