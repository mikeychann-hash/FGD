/**
 * BaseTaskExecutor - Base class for all task executors
 *
 * Task executors are responsible for executing concrete tasks using the MineflayerBridge.
 * Each executor handles a specific domain (mining, building, movement, etc.).
 */

import { logger } from '../../logger.js';

export class BaseTaskExecutor {
  constructor(bridge) {
    if (!bridge) {
      throw new Error('BaseTaskExecutor requires a MineflayerBridge instance');
    }
    this.bridge = bridge;
    this.taskName = this.constructor.name;
  }

  /**
   * Execute a task - must be implemented by subclasses
   * @param {string} botId - Bot to execute task
   * @param {Object} task - Task object with action, params, etc.
   * @returns {Promise<Object>} Task result
   */
  async execute(botId, task) {
    throw new Error(`${this.taskName}.execute() must be implemented by subclass`);
  }

  /**
   * Validate task parameters
   * @param {Object} task - Task to validate
   * @returns {Object} {valid: boolean, errors: Array}
   */
  validateTask(task) {
    const errors = [];

    if (!task) {
      errors.push('Task is required');
    }

    if (task && !task.action) {
      errors.push('Task.action is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Verify bot exists and is available
   * @param {string} botId - Bot identifier
   * @throws {Error} If bot not found
   */
  _verifyBot(botId) {
    try {
      this.bridge.getPosition(botId);
    } catch (err) {
      throw new Error(`Bot ${botId} not available: ${err.message}`);
    }
  }

  /**
   * Log task execution
   * @param {string} botId - Bot identifier
   * @param {string} action - Action being performed
   * @param {Object} details - Additional details
   */
  _logAction(botId, action, details = {}) {
    logger.debug(`[${this.taskName}] ${action}`, {
      botId,
      ...details
    });
  }

  /**
   * Log task progress
   * @param {string} botId - Bot identifier
   * @param {number} progress - Progress (0-1)
   * @param {Object} details - Additional details
   */
  _logProgress(botId, progress, details = {}) {
    const percentage = Math.round(progress * 100);
    logger.debug(`[${this.taskName}] Progress: ${percentage}%`, {
      botId,
      progress: percentage,
      ...details
    });
  }

  /**
   * Handle error with logging
   * @param {string} botId - Bot identifier
   * @param {Error} error - Error object
   * @param {string} context - Error context
   * @returns {Object} Error result
   */
  _handleError(botId, error, context = 'Task execution') {
    logger.error(`[${this.taskName}] ${context} failed`, {
      botId,
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      error: error.message,
      context
    };
  }

  /**
   * Get bot state for decision making
   * @param {string} botId - Bot identifier
   * @returns {Object} Bot state
   */
  _getBotState(botId) {
    try {
      return this.bridge.getBotState(botId);
    } catch (err) {
      logger.warn('Failed to get bot state', { botId, error: err.message });
      return null;
    }
  }

  /**
   * Check if bot has space in inventory
   * @param {string} botId - Bot identifier
   * @param {number} requiredSlots - Number of slots needed
   * @returns {boolean}
   */
  _hasInventorySpace(botId, requiredSlots = 1) {
    const state = this._getBotState(botId);
    if (!state) return false;

    const maxSlots = 36; // Standard inventory
    const usedSlots = state.inventoryItems.length;
    return (maxSlots - usedSlots) >= requiredSlots;
  }

  /**
   * Wait with timeout
   * @param {Promise} promise - Promise to wait for
   * @param {number} timeout - Timeout in milliseconds
   * @param {string} message - Timeout message
   * @returns {Promise}
   */
  async _withTimeout(promise, timeout = 30000, message = 'Operation timed out') {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(message)), timeout);
      })
    ]);
  }

  /**
   * Retry logic with exponential backoff
   * @param {Function} fn - Function to retry
   * @param {number} maxRetries - Maximum retries
   * @param {number} initialDelay - Initial delay in ms
   * @returns {Promise}
   */
  async _withRetry(fn, maxRetries = 3, initialDelay = 1000) {
    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}

export default BaseTaskExecutor;
