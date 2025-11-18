import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import { logger } from '../../logger.js';
import os from 'os';

/**
 * Worker Thread Pool for CPU-intensive operations
 */
export class WorkerPool extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxWorkers = options.maxWorkers || Math.max(2, os.cpus().length - 1);
    this.workerScript = options.workerScript;
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
    this.activeTasksCount = 0;
    this.totalTasksProcessed = 0;
    this.workerIdCounter = 0;
  }

  /**
   * Initialize worker pool
   */
  async init() {
    logger.info('Initializing worker pool', { maxWorkers: this.maxWorkers });

    for (let i = 0; i < this.maxWorkers; i++) {
      await this.createWorker();
    }

    console.log(`✅ Worker pool initialized (${this.maxWorkers} workers)`);
  }

  /**
   * Create a new worker
   */
  async createWorker() {
    const workerId = this.workerIdCounter++;
    const worker = new Worker(this.workerScript, {
      workerData: { workerId },
    });

    const workerInfo = {
      id: workerId,
      worker,
      busy: false,
      tasksCompleted: 0,
    };

    worker.on('message', (result) => {
      this.handleWorkerMessage(workerInfo, result);
    });

    worker.on('error', (err) => {
      logger.error('Worker error', { workerId, error: err.message });
      this.handleWorkerError(workerInfo, err);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        logger.warn('Worker exited unexpectedly', { workerId, code });
        this.handleWorkerExit(workerInfo, code);
      }
    });

    this.workers.push(workerInfo);
    this.availableWorkers.push(workerInfo);

    logger.debug('Worker created', { workerId });
  }

  /**
   * Handle worker message
   */
  handleWorkerMessage(workerInfo, result) {
    workerInfo.busy = false;
    workerInfo.tasksCompleted++;
    this.totalTasksProcessed++;
    this.activeTasksCount--;

    if (result.error) {
      logger.error('Worker task failed', {
        workerId: workerInfo.id,
        error: result.error,
      });
      this.emit('taskError', result);
    } else {
      logger.debug('Worker task completed', { workerId: workerInfo.id });
      this.emit('taskComplete', result);
    }

    // Make worker available again
    this.availableWorkers.push(workerInfo);

    // Process next task in queue
    this.processNextTask();
  }

  /**
   * Handle worker error
   */
  handleWorkerError(workerInfo, err) {
    workerInfo.busy = false;
    this.activeTasksCount--;

    // Remove from workers array
    const index = this.workers.indexOf(workerInfo);
    if (index > -1) {
      this.workers.splice(index, 1);
    }

    // Create replacement worker
    this.createWorker().catch((err) => {
      logger.error('Failed to create replacement worker', { error: err.message });
    });

    this.emit('workerError', { workerId: workerInfo.id, error: err });
  }

  /**
   * Handle worker exit
   */
  handleWorkerExit(workerInfo, code) {
    const index = this.workers.indexOf(workerInfo);
    if (index > -1) {
      this.workers.splice(index, 1);
    }

    // Create replacement worker if needed
    if (this.workers.length < this.maxWorkers) {
      this.createWorker().catch((err) => {
        logger.error('Failed to create replacement worker', { error: err.message });
      });
    }
  }

  /**
   * Execute task on worker pool
   */
  async execute(taskData, priority = 0) {
    return new Promise((resolve, reject) => {
      const task = {
        data: taskData,
        priority,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      // Add to queue
      this.taskQueue.push(task);

      // Sort by priority (higher priority first)
      this.taskQueue.sort((a, b) => b.priority - a.priority);

      // Try to process immediately
      this.processNextTask();
    });
  }

  /**
   * Process next task in queue
   */
  processNextTask() {
    if (this.taskQueue.length === 0 || this.availableWorkers.length === 0) {
      return;
    }

    const task = this.taskQueue.shift();
    const workerInfo = this.availableWorkers.shift();

    workerInfo.busy = true;
    this.activeTasksCount++;

    // Set up timeout
    const timeout = setTimeout(() => {
      logger.warn('Worker task timeout', { workerId: workerInfo.id });
      task.reject(new Error('Task timeout'));
      workerInfo.worker.terminate();
      this.handleWorkerExit(workerInfo, -1);
    }, 30000); // 30 second timeout

    // Send task to worker
    workerInfo.worker.postMessage(task.data);

    // Handle response
    const messageHandler = (result) => {
      clearTimeout(timeout);
      workerInfo.worker.off('message', messageHandler);

      if (result.error) {
        task.reject(new Error(result.error));
      } else {
        task.resolve(result.data);
      }
    };

    workerInfo.worker.once('message', messageHandler);
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      totalWorkers: this.workers.length,
      availableWorkers: this.availableWorkers.length,
      busyWorkers: this.workers.filter((w) => w.busy).length,
      queuedTasks: this.taskQueue.length,
      activeTasks: this.activeTasksCount,
      totalTasksProcessed: this.totalTasksProcessed,
      workerStats: this.workers.map((w) => ({
        id: w.id,
        busy: w.busy,
        tasksCompleted: w.tasksCompleted,
      })),
    };
  }

  /**
   * Terminate all workers
   */
  async terminate() {
    logger.info('Terminating worker pool');

    for (const workerInfo of this.workers) {
      await workerInfo.worker.terminate();
    }

    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];

    console.log('✅ Worker pool terminated');
  }
}
