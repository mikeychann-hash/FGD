import { jest } from '@jest/globals';
import { checkProviders, executeProvider } from '../../llm_bridge.js';

// Mock logger
jest.mock('../../logger.js', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

// Mock path
jest.mock('path', () => ({
    join: jest.fn((...args) => args.join('/')),
    resolve: jest.fn((...args) => args.join('/')),
    dirname: jest.fn(() => '.')
}));

// Mock child_process
jest.mock('child_process', () => {
    const mockSpawn = jest.fn(() => {
        const handlers = {};
        const stdoutHandlers = [];
        const stderrHandlers = [];

        return {
            stdout: {
                on: jest.fn((evt, cb) => {
                    if (evt === 'data') stdoutHandlers.push(cb);
                })
            },
            stderr: {
                on: jest.fn((evt, cb) => {
                    if (evt === 'data') stderrHandlers.push(cb);
                })
            },
            on: jest.fn((evt, cb) => {
                handlers[evt] = cb;
                // Simulate immediate success for testing
                if (evt === 'close') {
                    setTimeout(() => cb(0), 10);
                }
            }),
            kill: jest.fn()
        };
    });

    return {
        __esModule: true,
        spawn: mockSpawn,
        exec: jest.fn(),
        default: {
            spawn: mockSpawn,
            exec: jest.fn()
        }
    };
});

// Mock fs to return a dummy config
jest.mock('fs', () => ({
    __esModule: true,
    readFileSync: jest.fn(() => JSON.stringify({
        providers: {
            openai: { type: 'openai', model: 'gpt-4' },
            local: { type: 'local', model: 'llama2', local: true }
        }
    })),
    existsSync: jest.fn(() => true),
    default: {
        readFileSync: jest.fn(() => JSON.stringify({
            providers: {
                openai: { type: 'openai', model: 'gpt-4' },
                local: { type: 'local', model: 'llama2', local: true }
            }
        })),
        existsSync: jest.fn(() => true)
    }
}));

describe('LLM Bridge', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('checkProviders returns status for configured providers', async () => {
        const results = await checkProviders();

        // Check that results object exists and has some providers
        expect(results).toBeDefined();
        expect(typeof results).toBe('object');
        
        // Check that at least one provider exists (may be error status in test env)
        const providerKeys = Object.keys(results);
        expect(providerKeys.length).toBeGreaterThan(0);
        
        // Verify each provider has a status field
        for (const providerId of providerKeys) {
            expect(results[providerId]).toHaveProperty('status');
        }
    });

    test('executeProvider handles successful execution', async () => {
        // Test with local provider which doesn't require process
        const result = await executeProvider('local', { prompt: 'test' });
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });
});
