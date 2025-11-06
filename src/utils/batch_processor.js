import { EventEmitter } from 'events';
import { logger } from '../../logger.js';

/**
 * Batch Processor for grouping operations
 * Reduces network traffic and improves performance
 */
export class BatchProcessor extends EventEmitter {
  constructor(options = {}) {
    super();

    this.batchSize = options.batchSize || 50;
    this.flushInterval = options.flushInterval || 1000; // 1 second
    this.processor = options.processor; // Function to process batch
    this.name = options.name || 'BatchProcessor';

    this.batches = new Map(); // Separate batches by type
    this.timers = new Map();
    this.stats = {
      totalItems: 0,
      totalBatches: 0,
      itemsProcessed: 0,
      errors: 0
    };

    logger.info('Batch processor initialized', {
      name: this.name,
      batchSize: this.batchSize,
      flushInterval: this.flushInterval
    });
  }

  /**
   * Add item to batch
   */
  async add(item, batchType = 'default') {
    if (!this.batches.has(batchType)) {
      this.batches.set(batchType, []);
    }

    const batch = this.batches.get(batchType);
    batch.push(item);
    this.stats.totalItems++;

    // Schedule flush if not already scheduled
    if (!this.timers.has(batchType)) {
      this.scheduleFlush(batchType);
    }

    // Flush immediately if batch is full
    if (batch.length >= this.batchSize) {
      await this.flush(batchType);
    }
  }

  /**
   * Schedule automatic flush
   */
  scheduleFlush(batchType) {
    const timer = setTimeout(() => {
      this.flush(batchType).catch(err => {
        logger.error('Scheduled flush failed', {
          name: this.name,
          batchType,
          error: err.message
        });
      });
    }, this.flushInterval);

    this.timers.set(batchType, timer);
  }

  /**
   * Flush batch immediately
   */
  async flush(batchType = 'default') {
    const batch = this.batches.get(batchType);
    const timer = this.timers.get(batchType);

    if (!batch || batch.length === 0) {
      return;
    }

    // Clear timer
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(batchType);
    }

    // Get items and clear batch
    const items = [...batch];
    this.batches.set(batchType, []);

    try {
      logger.debug('Processing batch', {
        name: this.name,
        batchType,
        size: items.length
      });

      // Process batch
      if (this.processor) {
        await this.processor(items, batchType);
      }

      this.stats.totalBatches++;
      this.stats.itemsProcessed += items.length;

      this.emit('batchProcessed', {
        batchType,
        size: items.length,
        timestamp: Date.now()
      });

      logger.debug('Batch processed successfully', {
        name: this.name,
        batchType,
        size: items.length
      });
    } catch (err) {
      this.stats.errors++;
      logger.error('Batch processing failed', {
        name: this.name,
        batchType,
        size: items.length,
        error: err.message
      });

      this.emit('batchError', {
        batchType,
        size: items.length,
        error: err,
        timestamp: Date.now()
      });

      throw err;
    }
  }

  /**
   * Flush all batches
   */
  async flushAll() {
    const flushPromises = [];
    for (const batchType of this.batches.keys()) {
      flushPromises.push(this.flush(batchType));
    }
    await Promise.all(flushPromises);
  }

  /**
   * Get statistics
   */
  getStats() {
    const pendingItems = {};
    let totalPending = 0;

    for (const [batchType, batch] of this.batches) {
      pendingItems[batchType] = batch.length;
      totalPending += batch.length;
    }

    return {
      ...this.stats,
      pendingItems,
      totalPending,
      batchTypes: Array.from(this.batches.keys())
    };
  }

  /**
   * Clear all batches and timers
   */
  clear() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }

    this.batches.clear();
    this.timers.clear();

    logger.info('Batch processor cleared', { name: this.name });
  }

  /**
   * Shutdown processor gracefully
   */
  async shutdown() {
    logger.info('Shutting down batch processor', { name: this.name });

    // Flush all pending batches
    await this.flushAll();

    // Clear timers
    this.clear();

    logger.info('Batch processor shut down', { name: this.name });
  }
}

/**
 * Position Update Batch Processor
 * Specialized for batching NPC position updates
 */
export class PositionBatchProcessor extends BatchProcessor {
  constructor(npcRepository, io) {
    super({
      name: 'PositionBatchProcessor',
      batchSize: 100,
      flushInterval: 500, // 500ms for faster position updates
      processor: async (positions) => {
        // Update database
        await npcRepository.batchUpdatePositions(positions);

        // Emit WebSocket update (single batch message)
        io.emit('npcs:positionUpdate', {
          positions: positions.map(p => ({
            id: p.id,
            position: p.position
          })),
          timestamp: Date.now()
        });
      }
    });
  }
}

/**
 * Metrics Batch Processor
 * Specialized for batching metrics writes
 */
export class MetricsBatchProcessor extends BatchProcessor {
  constructor(metricsRepository) {
    super({
      name: 'MetricsBatchProcessor',
      batchSize: 200,
      flushInterval: 5000, // 5 seconds
      processor: async (metrics) => {
        await metricsRepository.batchInsert(metrics);
      }
    });
  }
}
