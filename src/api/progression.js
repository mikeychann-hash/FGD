import express from 'express';
import { logger } from '../../logger.js';
import { progressionEngine } from '../../core/progression_engine.js';

/**
 * Initialize progression system routes
 */
export function initProgressionRoutes() {
  const router = express.Router();

  /**
   * GET / - Get current progression status
   */
  router.get('/', (req, res) => {
    try {
      const status = progressionEngine.getStatus();
      res.json(status);
    } catch (err) {
      logger.error('Failed to get progression status', { error: err.message });
      res.status(500).json({ error: 'Failed to get progression status' });
    }
  });

  /**
   * GET /phase - Get current phase information
   */
  router.get('/phase', (req, res) => {
    try {
      const phaseInfo = progressionEngine.getCurrentPhase();
      res.json(phaseInfo);
    } catch (err) {
      logger.error('Failed to get phase info', { error: err.message });
      res.status(500).json({ error: 'Failed to get phase info' });
    }
  });

  /**
   * PUT /phase - Manually set progression phase (admin)
   */
  router.put('/phase', async (req, res) => {
    try {
      const { phase } = req.body;

      if (typeof phase !== 'number' || phase < 1 || phase > 6) {
        return res.status(400).json({ error: 'Phase must be a number between 1 and 6' });
      }

      await progressionEngine.setPhase(phase);
      logger.info('Phase manually updated', { phase });

      res.json({
        success: true,
        phase,
        status: progressionEngine.getStatus(),
      });
    } catch (err) {
      logger.error('Failed to set phase', { error: err.message });
      res.status(500).json({ error: 'Failed to set phase' });
    }
  });

  /**
   * POST /metrics - Update progression metrics
   */
  router.post('/metrics', async (req, res) => {
    try {
      const metrics = req.body;

      if (!metrics || typeof metrics !== 'object') {
        return res.status(400).json({ error: 'Invalid metrics object' });
      }

      const phaseAdvanced = await progressionEngine.updateFederationState(metrics);
      logger.info('Progression metrics updated', { metrics, phaseAdvanced });

      res.json({
        success: true,
        phaseAdvanced,
        currentPhase: progressionEngine.currentPhase,
        metrics: progressionEngine.progressData,
      });
    } catch (err) {
      logger.error('Failed to update metrics', { error: err.message });
      res.status(500).json({ error: 'Failed to update metrics' });
    }
  });

  /**
   * POST /metric/:name - Update a specific metric
   */
  router.post('/metric/:name', (req, res) => {
    try {
      const { name } = req.params;
      const { value, increment } = req.body;

      if (increment !== undefined && typeof increment === 'number') {
        progressionEngine.incrementMetric(name, increment);
      } else if (value !== undefined) {
        progressionEngine.updateMetric(name, value);
      } else {
        return res.status(400).json({ error: 'Must provide either value or increment' });
      }

      logger.info('Metric updated', { name, value, increment });

      res.json({
        success: true,
        metric: name,
        value: progressionEngine.progressData[name],
      });
    } catch (err) {
      logger.error('Failed to update metric', { error: err.message, metric: req.params.name });
      res.status(500).json({ error: 'Failed to update metric' });
    }
  });

  /**
   * POST /reset - Reset progression to Phase 1
   */
  router.post('/reset', async (req, res) => {
    try {
      await progressionEngine.reset();
      logger.warn('Progression engine reset to Phase 1');

      res.json({
        success: true,
        message: 'Progression reset to Phase 1',
        status: progressionEngine.getStatus(),
      });
    } catch (err) {
      logger.error('Failed to reset progression', { error: err.message });
      res.status(500).json({ error: 'Failed to reset progression' });
    }
  });

  /**
   * GET /tasks - Get recommended tasks for current phase
   */
  router.get('/tasks', (req, res) => {
    try {
      const tasks = progressionEngine.getRecommendedTasks();
      const builds = progressionEngine.getRecommendedBuilds();

      res.json({
        phase: progressionEngine.currentPhase,
        recommendedTasks: tasks,
        recommendedBuilds: builds,
      });
    } catch (err) {
      logger.error('Failed to get recommended tasks', { error: err.message });
      res.status(500).json({ error: 'Failed to get recommended tasks' });
    }
  });

  return router;
}
