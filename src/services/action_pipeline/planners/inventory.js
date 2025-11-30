export default function planInventory({ botId, op, data = {}, slot, from, to, item, count }) {
  if (!botId) {
    throw new Error("botId is required for inventory actions");
  }
  const operation = op || data.op;
  if (!operation) {
    throw new Error("inventory action requires op");
  }

  switch (operation) {
    case "get":
      return { action: "inventory:get", botId };
    case "move":
      if (typeof from !== "number" || typeof to !== "number") {
        throw new Error("move requires from and to slots");
      }
      return { action: "inventory:move", botId, from, to };
    case "equip":
      if (!item) throw new Error("equip requires item");
      return { action: "inventory:equip", botId, item, slot: slot ?? data.slot ?? null };
    case "useSlot":
      if (typeof slot !== "number") throw new Error("useSlot requires slot");
      return { action: "inventory:useSlot", botId, slot };
    case "drop":
      if (typeof slot !== "number") throw new Error("drop requires slot");
      return { action: "inventory:drop", botId, slot, count: count ?? data.count ?? null };
    default:
      throw new Error(`Unsupported inventory op: ${operation}`);
  }
}
