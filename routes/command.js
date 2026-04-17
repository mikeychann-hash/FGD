import express from 'express';
import { z } from 'zod';
import { botCommandManager } from '../src/services/bot_command_manager.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, validateParams } from '../src/middleware/validate.js';

const router = express.Router();

router.use(authenticate, authorize('write'));

const botIdParam = z.object({
    botId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
});

const mineSchema = z.object({
    block: z.string().min(1).max(64),
    count: z.number().int().min(1).max(1000).optional(),
});

const craftSchema = z.object({
    recipe: z.string().min(1).max(64),
    count: z.number().int().min(1).max(1000).optional(),
});

const attackSchema = z.object({
    targetId: z.string().min(1).max(64),
});

const exploreSchema = z.object({
    radius: z.number().int().min(1).max(256).optional(),
});

const placementSchema = z.object({
    x: z.number().int(),
    y: z.number().int(),
    z: z.number().int(),
    block: z.string().min(1).max(64),
});

const buildSchema = z.object({
    blueprint: z.array(placementSchema).min(1).max(1000),
});

router.post('/:botId/mine', validateParams(botIdParam), validate(mineSchema), async (req, res) => {
    const { botId } = req.params;
    const { block, count } = req.body;
    try {
        await botCommandManager.mine(botId, block, count);
        res.json({ success: true, message: `Mined ${count || 1} ${block}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/:botId/craft', validateParams(botIdParam), validate(craftSchema), async (req, res) => {
    const { botId } = req.params;
    const { recipe, count } = req.body;
    try {
        await botCommandManager.craft(botId, recipe, count);
        res.json({ success: true, message: `Crafted ${count || 1} ${recipe}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/:botId/attack', validateParams(botIdParam), validate(attackSchema), async (req, res) => {
    const { botId } = req.params;
    const { targetId } = req.body;
    try {
        await botCommandManager.attack(botId, targetId);
        res.json({ success: true, message: `Attacked target ${targetId}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/:botId/explore', validateParams(botIdParam), validate(exploreSchema), async (req, res) => {
    const { botId } = req.params;
    const { radius } = req.body;
    try {
        await botCommandManager.explore(botId, radius);
        res.json({ success: true, message: `Exploring area with radius ${radius || 20}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/:botId/build', validateParams(botIdParam), validate(buildSchema), async (req, res) => {
    const { botId } = req.params;
    const { blueprint } = req.body;
    try {
        await botCommandManager.build(botId, blueprint);
        res.json({ success: true, message: `Build executed with ${blueprint.length} steps` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
