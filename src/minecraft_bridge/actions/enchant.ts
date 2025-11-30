export function buildEnchantAction(payload: { botId: string; item?: string; enchantment?: string }) {
  return {
    type: 'action',
    action: 'enchant',
    botId: payload.botId,
    item: payload.item || null,
    enchantment: payload.enchantment || null,
  };
}

export default buildEnchantAction;
