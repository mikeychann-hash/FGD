import express from 'express';
const router = express.Router();
import { botControlManager } from '../src/services/bot_control_manager.js';
import { authenticate, authorize } from '../middleware/auth.js';

router.use(authenticate);

// Start control session
router.post('/:botId/session/start', authorize('write'), (req, res) => {
    const { botId } = req.params;
    try {
        const io = req.app.get('io');
        if (io) {
            // Use io.emit to broadcast updates to all clients
            botControlManager.startControlSession(botId, io.emit.bind(io));
            res.json({ success: true, message: `Session started for ${botId}` });
        } else {
            res.status(500).json({ error: 'Socket.io instance not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Stop control session
router.post('/:botId/session/stop', authorize('write'), (req, res) => {
    const { botId } = req.params;
    try {
        botControlManager.stopControlSession(botId);
        res.json({ success: true, message: `Session stopped for ${botId}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get state
router.get('/:botId/state', authorize('read'), (req, res) => {
    const { botId } = req.params;
    try {
        const state = botControlManager.getState(botId);
        res.json({ success: true, state });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
