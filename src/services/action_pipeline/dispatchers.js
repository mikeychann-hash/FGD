// Dispatchers for sending planned actions to the bridge/plugin
import { incrementAction, incrementActionFailure } from '../metrics.js';

export async function dispatchAction(npcSystem, io, plan) {
  const bridge =
    npcSystem?.minecraftBridge ||
    npcSystem?.npcEngine?.bridge ||
    npcSystem?.npcEngine?.mineflayerBridge;

  if (!bridge || typeof bridge.dispatchAction !== 'function') {
    incrementActionFailure(plan.action, plan.botId || plan.bot);
    throw new Error('Bridge dispatchAction unavailable');
  }

  try {
    // Optional navigation step before dispatching action
    if (plan.navigateTo && bridge?.navigateTo) {
      const navPos = plan.navigateTo;
      await bridge.navigateTo(plan.botId || plan.bot, navPos, plan.navigateTolerance || 2);
    }

    const result = await bridge.dispatchAction(plan);
    incrementAction(plan.action, plan.botId || plan.bot);
    if (io) {
      io.emit('bot:actionDispatched', {
        botId: plan.botId || plan.bot,
        action: plan.action,
        target: plan.target || plan.item || null,
        position: plan.position || null,
        timestamp: new Date().toISOString(),
      });
    }
    return result;
  } catch (err) {
    incrementActionFailure(plan.action, plan.botId || plan.bot);
    if (io) {
      io.emit('bot:actionFailed', {
        botId: plan.botId || plan.bot,
        action: plan.action,
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
    throw err;
  }
}

export default {
  dispatchAction,
};
