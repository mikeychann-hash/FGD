export function planEnchant({ botId, item, enchantment }) {
  return {
    action: 'enchant',
    botId,
    item,
    enchantment,
  };
}

export default planEnchant;
