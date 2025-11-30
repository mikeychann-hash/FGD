import { jest } from '@jest/globals';
import { interpretCommand } from '../../interpreter.js';

// Mock logger
jest.mock('../../logger.js', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

// Mock constants
jest.mock('../../constants.js', () => ({
    SYSTEM_PROMPT: 'You are a bot.',
    DEFAULT_MODEL_CONTROL_RATIO: 0.5
}));

// Mock llm_bridge
jest.mock('../../llm_bridge.js', () => ({
    queryLLM: jest.fn(() => Promise.resolve(JSON.stringify({
        action: 'mine',
        target: 'iron_ore'
    })))
}));

describe('Interpreter', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('interpretCommand accepts context and passes it to LLM', async () => {
        const context = { inventory: ['pickaxe'] };
        const result = await interpretCommand('mine iron', { context });

        expect(result).toBeDefined();
        expect(result.action).toBe('mine');
    });

    test('interpretCommand handles empty context gracefully', async () => {
        const result = await interpretCommand('mine iron');
        expect(result).toBeDefined();
    });
});
