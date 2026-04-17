import express from 'express';
const router = express.Router();
import { botCommandManager } from '../src/services/bot_command_manager.js';
import { authenticate, authorize } from '../middleware/auth.js';

router.use(authenticate, authorize('write'));

// Mine command
router.post('/:botId/mine', async (req, res) => {
    const { botId } = req.params;
    const { block, count } = req.body;
    try {
        await botCommandManager.mine(botId, block, count);
        res.json({ success: true, message: `Mined ${count || 1} ${block}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Craft command
router.post('/:botId/craft', async (req, res) => {
    const { botId } = req.params;
    const { recipe, count } = req.body;
    try {
        await botCommandManager.craft(botId, recipe, count);
        res.json({ success: true, message: `Crafted ${count || 1} ${recipe}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Attack command
router.post('/:botId/attack', async (req, res) => {
    const { botId } = req.params;
    const { targetId } = req.body;
    try {
        await botCommandManager.attack(botId, targetId);
        res.json({ success: true, message: `Attacked target ${targetId}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Explore command
router.post('/:botId/explore', async (req, res) => {
    const { botId } = req.params;
    const { radius } = req.body;
    try {
        await botCommandManager.explore(botId, radius);
        res.json({ success: true, message: `Exploring area with radius ${radius || 20}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Build command
router.post('/:botId/build', async (req, res) => {
    const { botId } = req.params;
    const { blueprint } = req.body; // Expected array of placements
    try {
        await botCommandManager.build(botId, blueprint);
        res.json({ success: true, message: `Build executed with ${blueprint?.length || 0} steps` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
