/**
 * Minimal pathfinding helper to move a bot toward a chest position.
 * Uses bridge moveBot with simple distance check.
 */
export async function pathfindToChest(npcSystem, botId, chestPos, tolerance = 2) {
  if (!npcSystem?.minecraftBridge || !botId || !chestPos) return;
  const runtime = npcSystem?.npcEngine?.npcs?.get(botId)?.runtime || {};
  const current = runtime.position || npcSystem.minecraftBridge.botPositions?.get(botId) || null;
  if (!current) return;
  const dx = chestPos.x - current.x;
  const dy = chestPos.y - current.y;
  const dz = chestPos.z - current.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist <= tolerance) return;
  // Step toward chest in small increments to emulate walking
  const steps = Math.max(1, Math.min(10, Math.ceil(dist)));
  const stepVec = { x: dx / steps, y: dy / steps, z: dz / steps };
  let pos = { ...current };
  for (let i = 0; i < steps; i++) {
    pos = { x: pos.x + stepVec.x, y: pos.y + stepVec.y, z: pos.z + stepVec.z };
    try {
      // fire-and-forget; no await to avoid blocking planner
      npcSystem.minecraftBridge.moveBot(botId, 0, 0, 0, { nextPosition: pos });
    } catch {
      // ignore minor errors
    }
  }
}
