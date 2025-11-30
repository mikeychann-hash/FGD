// tests/unit/bot_command_manager.test.js

import { jest } from '@jest/globals';
import { botCommandManager } from '../../src/services/bot_command_manager.js';
import { botControlManager } from '../../src/services/bot_control_manager.js';

// Mock dependencies
jest.mock('../../src/services/bot_control_manager.js');
jest.mock('../../logger.js', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
    },
}));

describe('BotCommandManager', () => {
    let mockBot;
    const botId = 'test_bot';

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Mock bot instance
        mockBot = {
            collectBlock: {
                collect: jest.fn().mockResolvedValue(),
            },
            craft: {
                recipe: jest.fn().mockResolvedValue(),
            },
            attack: jest.fn(),
            entities: {
                target1: { id: 'target1' },
            },
            pathfinder: {
                setMovements: jest.fn(),
                goto: jest.fn().mockResolvedValue(),
            },
            entity: {
                position: { x: 0, y: 0, z: 0 },
            },
            vec3: function (x, y, z) { return { x, y, z }; },
            blockAt: jest.fn().mockReturnValue({ name: 'stone' }),
            placeBlock: jest.fn().mockResolvedValue(),
        };

        // Mock getBotInstance
        botControlManager.getBotInstance = jest.fn().mockReturnValue(mockBot);
        // Also mock internal _getBot if needed
        botCommandManager._getBot = jest.fn().mockReturnValue(mockBot);
    });

    test('mine command should call bot.collectBlock.collect', async () => {
        const result = await botCommandManager.mine(botId, 'stone', 5);
        expect(mockBot.collectBlock.collect).toHaveBeenCalledWith('stone', 5);
        expect(result).toEqual({ success: true });
    });

    test('craft command should call bot.craft.recipe', async () => {
        const result = await botCommandManager.craft(botId, 'planks', 2);
        expect(mockBot.craft.recipe).toHaveBeenCalledWith('planks', 2);
        expect(result).toEqual({ success: true });
    });

    test('attack command should call bot.attack', async () => {
        const result = await botCommandManager.attack(botId, 'target1');
        expect(mockBot.attack).toHaveBeenCalledWith(mockBot.entities.target1);
        expect(result).toEqual({ success: true });
    });

    test('build command should call bot.placeBlock', async () => {
        const blueprint = [{ x: 1, y: 0, z: 0, blockName: 'dirt' }];
        const result = await botCommandManager.build(botId, blueprint);
        expect(mockBot.placeBlock).toHaveBeenCalled();
        expect(result).toEqual({ success: true });
    });
});
