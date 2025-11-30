export function buildInventoryAction(payload: { botId: string; target?: string }) {
  return {
    type: 'action',
    action: 'openInventory',
    botId: payload.botId,
    target: payload.target || null,
  };
}

export default buildInventoryAction;
