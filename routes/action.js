import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { createActionPipeline } from '../src/services/action_pipeline/index.js';
import { fail } from '../src/middleware/response.js';

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
      const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 400;
      return fail(res, status, err.message || 'Action failed');
    }
  });

  return router;
}

export default { initActionRoutes };
