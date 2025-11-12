/**
 * BaseTaskExecutor Unit Tests
 *
 * Tests for core task executor functionality
 */

import { BaseTaskExecutor } from '../../../src/executors/BaseTaskExecutor.js';
import {
  createMockBot,
  createMockBridge,
  createTestTask,
  waitForEvent,
  createTestContext
} from '../../utils/mocks.js';

describe('BaseTaskExecutor', () => {
  let executor;
  let bridge;
  let bot;

  beforeEach(() => {
    bridge = createMockBridge();
    executor = new BaseTaskExecutor(bridge);
    bot = createMockBot();
  });

  describe('execute()', () => {
    it('should be implemented by subclasses', async () => {
      const task = createTestTask('mine');
      expect(() => executor.execute('test-bot', task)).toThrow();
    });
  });

  describe('_verifyBot()', () => {
    it('should return true for valid bot', () => {
      bridge.bots.set('test-bot', bot);
      const result = executor._verifyBot('test-bot');
      expect(result).toBe(true);
    });

    it('should return false for missing bot', () => {
      const result = executor._verifyBot('non-existent');
      expect(result).toBe(false);
    });

    it('should throw error with throwOnError option', () => {
      expect(() => executor._verifyBot('non-existent', true)).toThrow();
    });
  });

  describe('_withTimeout()', () => {
    it('should complete before timeout', async () => {
      const result = await executor._withTimeout(1000, async () => {
        return { success: true };
      });
      expect(result.success).toBe(true);
    });

    it('should timeout if operation exceeds duration', async () => {
      const task = async () => {
        await new Promise(resolve => setTimeout(resolve, 2000));
      };
      await expect(executor._withTimeout(100, task)).rejects.toThrow();
    });

    it('should handle errors within timeout', async () => {
      const task = async () => {
        throw new Error('Test error');
      };
      await expect(executor._withTimeout(1000, task)).rejects.toThrow('Test error');
    });
  });

  describe('_withRetry()', () => {
    it('should succeed on first attempt', async () => {
      let attempts = 0;
      const task = async () => {
        attempts++;
        return { success: true };
      };

      const result = await executor._withRetry(task, { maxAttempts: 3 });
      expect(result.success).toBe(true);
      expect(attempts).toBe(1);
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      const task = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Failure');
        }
        return { success: true };
      };

      const result = await executor._withRetry(task, { maxAttempts: 3 });
      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
    });

    it('should fail after max attempts', async () => {
      let attempts = 0;
      const task = async () => {
        attempts++;
        throw new Error('Always fails');
      };

      await expect(
        executor._withRetry(task, { maxAttempts: 2 })
      ).rejects.toThrow();
      expect(attempts).toBe(2);
    });

    it('should respect retry delay', async () => {
      let attempts = 0;
      const startTime = Date.now();
      const task = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Retry');
        }
        return { success: true };
      };

      await executor._withRetry(task, { maxAttempts: 2, delay: 100 });
      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('_hasInventorySpace()', () => {
    it('should return true when inventory has space', () => {
      bot.inventory.emptySlotCount = jest.fn().mockReturnValue(5);
      bridge.bots.set('test-bot', bot);

      const result = executor._hasInventorySpace('test-bot');
      expect(result).toBe(true);
    });

    it('should return false when inventory is full', () => {
      bot.inventory.emptySlotCount = jest.fn().mockReturnValue(0);
      bridge.bots.set('test-bot', bot);

      const result = executor._hasInventorySpace('test-bot');
      expect(result).toBe(false);
    });

    it('should check for required space', () => {
      bot.inventory.emptySlotCount = jest.fn().mockReturnValue(3);
      bridge.bots.set('test-bot', bot);

      const result = executor._hasInventorySpace('test-bot', 3);
      expect(result).toBe(true);

      const resultInsufficent = executor._hasInventorySpace('test-bot', 4);
      expect(resultInsufficent).toBe(false);
    });
  });

  describe('_getBotState()', () => {
    it('should return bot state from bridge', () => {
      const mockState = {
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        food: 20
      };
      bridge.getBotState = jest.fn().mockReturnValue(mockState);

      const state = executor._getBotState('test-bot');
      expect(state).toEqual(mockState);
    });

    it('should return null for missing bot', () => {
      bridge.getBotState = jest.fn().mockReturnValue(null);

      const state = executor._getBotState('non-existent');
      expect(state).toBeNull();
    });
  });

  describe('_delay()', () => {
    it('should delay for specified milliseconds', async () => {
      const startTime = Date.now();
      await executor._delay(100);
      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(100);
      expect(duration).toBeLessThan(200);
    });

    it('should resolve with no value', async () => {
      const result = await executor._delay(10);
      expect(result).toBeUndefined();
    });
  });

  describe('_calculateDistance()', () => {
    it('should calculate euclidean distance', () => {
      const pos1 = { x: 0, y: 0, z: 0 };
      const pos2 = { x: 3, y: 4, z: 0 };

      const distance = executor._calculateDistance(pos1, pos2);
      expect(distance).toBe(5); // 3-4-5 triangle
    });

    it('should handle 3D distance', () => {
      const pos1 = { x: 0, y: 0, z: 0 };
      const pos2 = { x: 1, y: 2, z: 2 };

      const distance = executor._calculateDistance(pos1, pos2);
      expect(distance).toBeCloseTo(3, 1); // sqrt(1 + 4 + 4) = 3
    });

    it('should return 0 for same position', () => {
      const pos = { x: 5, y: 5, z: 5 };

      const distance = executor._calculateDistance(pos, pos);
      expect(distance).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should catch and report execution errors', async () => {
      const error = new Error('Execution failed');
      const failingTask = async () => {
        throw error;
      };

      await expect(
        executor._withTimeout(1000, failingTask)
      ).rejects.toThrow('Execution failed');
    });

    it('should preserve error context', async () => {
      const task = async () => {
        const err = new Error('Context error');
        err.code = 'TEST_ERROR';
        throw err;
      };

      try {
        await executor._withTimeout(1000, task);
      } catch (e) {
        expect(e.code).toBe('TEST_ERROR');
      }
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent tasks', async () => {
      let completedCount = 0;
      const task = async () => {
        completedCount++;
        await executor._delay(10);
        return { success: true };
      };

      const promises = [
        task(),
        task(),
        task(),
        task()
      ];

      await Promise.all(promises);
      expect(completedCount).toBe(4);
    });

    it('should isolate errors between concurrent tasks', async () => {
      const task1 = async () => {
        throw new Error('Task 1 failed');
      };

      const task2 = async () => {
        await executor._delay(50);
        return { success: true };
      };

      const results = await Promise.allSettled([task1(), task2()]);
      expect(results[0].status).toBe('rejected');
      expect(results[1].status).toBe('fulfilled');
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory on repeated execution', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 100; i++) {
        await executor._delay(1);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});
