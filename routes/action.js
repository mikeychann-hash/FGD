import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { createActionPipeline } from '../src/services/action_pipeline/index.js';

export function initActionRoutes(npcSystem, io) {
  const router = express.Router();
  const pipeline = npcSystem.actionPipeline || createActionPipeline(npcSystem, io);
  npcSystem.actionPipeline = pipeline;

  router.post('/', authenticate, authorize('command'), async (req, res) => {
    try {
      const { botId, type, ...rest } = req.body || {};
      const result = await pipeline.run(botId, { type, ...rest });
      res.json({
        success: true,
        action: type,
        botId,
        plan: result.plan,
        result: result.result || null,
      });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Action failed' });
    }
  });

  return router;
}

export default { initActionRoutes };
