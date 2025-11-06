import { EventEmitter } from 'events';
import { logger } from '../../logger.js';

/**
 * Circuit Breaker State
 */
const State = {
  CLOSED: 'CLOSED',     // Normal operation
  OPEN: 'OPEN',         // Failing, reject requests
  HALF_OPEN: 'HALF_OPEN' // Testing if service recovered
};

/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascade failures when external services are unresponsive
 */
export class CircuitBreaker extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration
    this.name = options.name || 'CircuitBreaker';
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 5000;
    this.resetTimeout = options.resetTimeout || 60000;
    this.monitoringPeriod = options.monitoringPeriod || 10000;

    // State
    this.state = State.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;

    // Statistics
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      timeouts: 0,
      stateChanges: []
    };

    logger.info('Circuit breaker initialized', {
      name: this.name,
      failureThreshold: this.failureThreshold,
      timeout: this.timeout
    });
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute(fn, ...args) {
    this.stats.totalCalls++;

    // Check if circuit is open
    if (this.state === State.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        this.stats.rejectedCalls++;
        logger.warn('Circuit breaker is OPEN - request rejected', {
          name: this.name
        });
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }

      // Time to try again
      this.setState(State.HALF_OPEN);
    }

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn, ...args);

      // Success
      this.onSuccess();
      return result;
    } catch (err) {
      // Failure
      this.onFailure(err);
      throw err;
    }
  }

  /**
   * Execute function with timeout
   */
  async executeWithTimeout(fn, ...args) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.stats.timeouts++;
        reject(new Error(`Circuit breaker timeout after ${this.timeout}ms`));
      }, this.timeout);

      Promise.resolve(fn(...args))
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(err => {
          clearTimeout(timeoutId);
          reject(err);
        });
    });
  }

  /**
   * Handle successful execution
   */
  onSuccess() {
    this.failureCount = 0;
    this.stats.successfulCalls++;

    if (this.state === State.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.successThreshold) {
        this.setState(State.CLOSED);
        this.successCount = 0;
      }
    }
  }

  /**
   * Handle failed execution
   */
  onFailure(err) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.stats.failedCalls++;

    logger.error('Circuit breaker recorded failure', {
      name: this.name,
      failureCount: this.failureCount,
      error: err.message
    });

    if (this.state === State.HALF_OPEN) {
      // Go back to open immediately
      this.setState(State.OPEN);
      this.scheduleNextAttempt();
    } else if (this.failureCount >= this.failureThreshold) {
      // Open the circuit
      this.setState(State.OPEN);
      this.scheduleNextAttempt();
    }
  }

  /**
   * Set circuit breaker state
   */
  setState(newState) {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;

      this.stats.stateChanges.push({
        from: oldState,
        to: newState,
        timestamp: new Date().toISOString()
      });

      logger.warn('Circuit breaker state changed', {
        name: this.name,
        from: oldState,
        to: newState
      });

      this.emit('stateChange', {
        name: this.name,
        oldState,
        newState,
        timestamp: Date.now()
      });

      // Keep last 100 state changes
      if (this.stats.stateChanges.length > 100) {
        this.stats.stateChanges.shift();
      }
    }
  }

  /**
   * Schedule next retry attempt
   */
  scheduleNextAttempt() {
    this.nextAttemptTime = Date.now() + this.resetTimeout;

    logger.info('Circuit breaker will retry in', {
      name: this.name,
      retryAfter: this.resetTimeout
    });
  }

  /**
   * Manually reset circuit breaker
   */
  reset() {
    this.setState(State.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;

    logger.info('Circuit breaker manually reset', { name: this.name });
  }

  /**
   * Force open circuit breaker
   */
  forceOpen() {
    this.setState(State.OPEN);
    this.scheduleNextAttempt();

    logger.warn('Circuit breaker manually opened', { name: this.name });
  }

  /**
   * Get current state
   */
  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      isOpen: this.state === State.OPEN,
      stats: this.stats
    };
  }

  /**
   * Check if circuit is healthy
   */
  isHealthy() {
    return this.state === State.CLOSED;
  }
}

/**
 * Circuit Breaker Manager
 * Manages multiple circuit breakers for different services
 */
export class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
  }

  /**
   * Create or get circuit breaker for a service
   */
  getBreaker(name, options = {}) {
    if (!this.breakers.has(name)) {
      const breaker = new CircuitBreaker({ ...options, name });
      this.breakers.set(name, breaker);
    }
    return this.breakers.get(name);
  }

  /**
   * Get all circuit breaker states
   */
  getAllStates() {
    const states = {};
    for (const [name, breaker] of this.breakers) {
      states[name] = breaker.getState();
    }
    return states;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    logger.info('All circuit breakers reset');
  }

  /**
   * Get health summary
   */
  getHealthSummary() {
    const summary = {
      total: this.breakers.size,
      healthy: 0,
      degraded: 0,
      failed: 0
    };

    for (const breaker of this.breakers.values()) {
      const state = breaker.getState();
      if (state.state === State.CLOSED) {
        summary.healthy++;
      } else if (state.state === State.HALF_OPEN) {
        summary.degraded++;
      } else {
        summary.failed++;
      }
    }

    return summary;
  }
}
