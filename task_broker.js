// ctn/task_broker.js
// Routes and delegates tasks across cognitive network nodes

import { CognitiveLink } from "./cognitive_link.js";
import { validateTask } from "./task_schema.js";
import { planTask } from "./tasks/index.js";
import fs from "fs/promises";
import EventEmitter from "events";

// Configuration constants
const DEFAULT_MANIFEST = {
  nodeName: "Node_A",
  nodeId: "node-a-001",
  role: "general",
  specialization: [],
  peers: [],
  taskRouting: {
    strategy: "best-fit",
    fallbackToLocal: true,
    retryAttempts: 3,
    retryDelay: 1000,
    taskTimeout: 30000
  }
};

// Scoring weights for node selection
const SCORING_WEIGHTS = {
  SPECIALIZATION_MATCH: 10,
  MAX_LOAD_SCORE: 10,
  SUCCESS_RATE_WEIGHT: 10,
  DEFAULT_SUCCESS_SCORE: 5
};

// Circuit breaker configuration
const CIRCUIT_BREAKER_CONFIG = {
  FAILURE_THRESHOLD: 5,           // Failures before opening circuit
  SUCCESS_THRESHOLD: 2,            // Successes to close circuit
  HALF_OPEN_TIMEOUT: 30000,       // Time before trying half-open (ms)
  RESET_TIMEOUT: 60000            // Time to reset failure count
};

/**
 * TaskBroker - Routes and delegates tasks across cognitive network nodes
 * @extends EventEmitter
 * @emits peer_connected - When a peer successfully connects
 * @emits peer_disconnected - When a peer disconnects
 * @emits task_completed - When a task completes successfully
 * @emits task_failed - When a task fails
 * @emits local_execution - When a task is executed locally
 * @emits initialization_error - When initialization encounters errors
 * @emits circuit_breaker_opened - When a circuit breaker opens
 * @emits circuit_breaker_closed - When a circuit breaker closes
 */
export class TaskBroker extends EventEmitter {
  /**
   * Creates a TaskBroker instance
   * @param {string} configPath - Path to node manifest configuration file
   */
  constructor(configPath = "./ctn/node_manifest.json") {
    super();
    this.configPath = configPath;
    this.manifest = { ...DEFAULT_MANIFEST };
    this.links = new Map();
    this.circuitBreakers = new Map();
    this.activeTasks = new Map();
    this.initializationErrors = [];
    this.isInitialized = false;
    this.isShuttingDown = false;

    this.metrics = {
      tasksReceived: 0,
      tasksDelegated: 0,
      tasksLocal: 0,
      tasksFailed: 0,
      totalLatency: 0
    };
  }

  /**
   * Initializes the broker by loading manifest and connecting to peers
   * Must be called before using delegateTask
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      console.warn("TaskBroker already initialized");
      return;
    }

    try {
      await this.loadManifest();
      await this.initializePeers();
      this.isInitialized = true;
      console.log(`✅ TaskBroker initialized for ${this.manifest.nodeName}`);
    } catch (err) {
      console.error("❌ Failed to initialize TaskBroker:", err.message);
      this.emit("initialization_error", { error: err });
      throw err;
    }
  }

  /**
   * Loads node manifest from configuration file
   * @private
   * @returns {Promise<void>}
   */
  async loadManifest() {
    try {
      const data = await fs.readFile(this.configPath, "utf-8");
      const parsed = JSON.parse(data);

      // Validate manifest structure
      this.validateManifest(parsed);

      this.manifest = { ...DEFAULT_MANIFEST, ...parsed };
      console.log(`Loaded manifest for ${this.manifest.nodeName}`);
    } catch (err) {
      if (err.code === "ENOENT") {
        console.warn(`Manifest not found at ${this.configPath}, using defaults`);
        this.emit("initialization_error", {
          component: "manifest",
          error: err,
          severity: "warning"
        });
      } else {
        console.error("Error loading manifest:", err.message);
        this.emit("initialization_error", {
          component: "manifest",
          error: err,
          severity: "error"
        });
        this.initializationErrors.push(err);
      }
    }
  }

  /**
   * Validates manifest structure
   * @private
   * @param {Object} manifest - Manifest to validate
   * @throws {Error} If manifest is invalid
   */
  validateManifest(manifest) {
    if (!manifest.nodeName || typeof manifest.nodeName !== "string") {
      throw new Error("Manifest must have a valid nodeName");
    }
    if (!manifest.nodeId || typeof manifest.nodeId !== "string") {
      throw new Error("Manifest must have a valid nodeId");
    }
    if (manifest.peers && !Array.isArray(manifest.peers)) {
      throw new Error("Manifest peers must be an array");
    }
  }

  /**
   * Initializes connections to peer nodes
   * @private
   * @returns {Promise<void>}
   */
  async initializePeers() {
    if (!this.manifest.peers || this.manifest.peers.length === 0) {
      console.log("No peers configured");
      return;
    }

    console.log(`Initializing ${this.manifest.peers.length} cognitive peer(s)`);

    const initPromises = this.manifest.peers.map(async (peerConfig) => {
      try {
        const link = new CognitiveLink(peerConfig, {
          taskTimeout: this.manifest.taskRouting?.taskTimeout || 30000
        });

        link.on("connected", (name) => this.emit("peer_connected", name));
        link.on("disconnected", (name, reason) => {
          this.emit("peer_disconnected", name, reason);
        });

        this.links.set(link.name, link);
        this.initCircuitBreaker(link.name);

        console.log(`Peer ${link.name} initialized`);
      } catch (err) {
        console.error(`Failed to create link to ${peerConfig.name}:`, err.message);
        this.emit("initialization_error", {
          component: "peer",
          peer: peerConfig.name,
          error: err
        });
        this.initializationErrors.push(err);
      }
    });

    await Promise.allSettled(initPromises);
  }

  /**
   * Initializes circuit breaker for a peer
   * @private
   * @param {string} peerName - Name of the peer
   */
  initCircuitBreaker(peerName) {
    this.circuitBreakers.set(peerName, {
      state: "closed",              // closed, open, half-open
      failures: 0,
      successes: 0,
      lastFailureTime: null,
      lastStateChange: Date.now()
    });
  }

  /**
   * Updates circuit breaker state based on task result
   * @private
   * @param {string} peerName - Name of the peer
   * @param {boolean} success - Whether the task succeeded
   */
  updateCircuitBreaker(peerName, success) {
    const breaker = this.circuitBreakers.get(peerName);
    if (!breaker) return;

    const now = Date.now();

    if (success) {
      breaker.successes++;

      if (breaker.state === "half-open" &&
          breaker.successes >= CIRCUIT_BREAKER_CONFIG.SUCCESS_THRESHOLD) {
        breaker.state = "closed";
        breaker.failures = 0;
        breaker.successes = 0;
        breaker.lastStateChange = now;
        console.log(`Circuit breaker CLOSED for ${peerName}`);
        this.emit("circuit_breaker_closed", { peer: peerName });
      }

      // Reset failure count after timeout
      if (breaker.lastFailureTime &&
          now - breaker.lastFailureTime > CIRCUIT_BREAKER_CONFIG.RESET_TIMEOUT) {
        breaker.failures = 0;
      }
    } else {
      breaker.failures++;
      breaker.lastFailureTime = now;
      breaker.successes = 0;

      if (breaker.state === "closed" &&
          breaker.failures >= CIRCUIT_BREAKER_CONFIG.FAILURE_THRESHOLD) {
        breaker.state = "open";
        breaker.lastStateChange = now;
        console.warn(`Circuit breaker OPENED for ${peerName}`);
        this.emit("circuit_breaker_opened", {
          peer: peerName,
          failures: breaker.failures
        });
      }
    }
  }

  /**
   * Checks if a peer's circuit breaker allows requests
   * @private
   * @param {string} peerName - Name of the peer
   * @returns {boolean} True if requests are allowed
   */
  isCircuitBreakerOpen(peerName) {
    const breaker = this.circuitBreakers.get(peerName);
    if (!breaker) return false;

    const now = Date.now();

    if (breaker.state === "open") {
      // Try half-open after timeout
      if (now - breaker.lastStateChange >= CIRCUIT_BREAKER_CONFIG.HALF_OPEN_TIMEOUT) {
        breaker.state = "half-open";
        breaker.lastStateChange = now;
        console.log(`Circuit breaker HALF-OPEN for ${peerName}`);
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Delegates a task to the best available peer node or executes locally
   * @param {Object} task - Task object with action, params, and optional metadata
   * @param {string} task.action - The action to perform
   * @param {Object} task.params - Parameters for the task
   * @param {string} [task.id] - Optional task ID for tracking
   * @param {Object} [options] - Optional override settings
   * @param {number} [options.retryAttempts] - Number of retry attempts
   * @param {number} [options.retryDelay] - Base delay for exponential backoff (ms)
   * @param {number} [options.timeout] - Task timeout in milliseconds
   * @returns {Promise<Object>} Result object with data, source node, and metadata
   * @throws {Error} If broker is not initialized or shutting down
   */
  async delegateTask(task, options = {}) {
    // Check initialization state
    if (!this.isInitialized) {
      throw new Error("TaskBroker not initialized. Call initialize() first.");
    }

    if (this.isShuttingDown) {
      throw new Error("TaskBroker is shutting down, cannot accept new tasks");
    }

    // Validate task
    const validation = validateTask(task);
    if (!validation.valid) {
      this.metrics.tasksFailed++;
      const error = `Invalid task payload: ${validation.errors.join("; ")}`;
      this.emit("task_failed", { task, error, validation });
      return {
        error,
        validationErrors: validation.errors,
        from: "broker"
      };
    }

    // Generate task ID if not provided
    const taskId = task.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const taskContext = { ...task, id: taskId };

    this.metrics.tasksReceived++;
    const startTime = Date.now();

    // Track active task
    this.activeTasks.set(taskId, {
      task: taskContext,
      startTime,
      status: "processing"
    });

    try {
      const target = this.findBestNode(taskContext);

      if (!target) {
        console.log(`No suitable peer available, handling locally`);
        this.metrics.tasksLocal++;
        const result = await this.executeLocally(taskContext);
        this.activeTasks.delete(taskId);
        return result;
      }

      console.log(`Delegating "${taskContext.action}" to ${target.name}`);

      const retryAttempts = options.retryAttempts ??
                           this.manifest.taskRouting?.retryAttempts ??
                           3;
      const retryDelay = options.retryDelay ??
                        this.manifest.taskRouting?.retryDelay ??
                        1000;

      let lastError;
      for (let attempt = 0; attempt < retryAttempts; attempt++) {
        try {
          const result = await target.sendTask(taskContext);

          // Success - update metrics and circuit breaker
          this.metrics.tasksDelegated++;
          this.metrics.totalLatency += (Date.now() - startTime);
          this.updateCircuitBreaker(target.name, true);

          const duration = Date.now() - startTime;
          this.emit("task_completed", {
            task: taskContext,
            target: target.name,
            duration,
            attempts: attempt + 1
          });

          this.activeTasks.delete(taskId);
          return {
            result,
            from: target.name,
            local: false,
            duration,
            attempts: attempt + 1
          };
        } catch (err) {
          lastError = err;
          this.updateCircuitBreaker(target.name, false);

          console.warn(`Attempt ${attempt + 1}/${retryAttempts} failed for ${target.name}:`, err.message);

          // Use exponential backoff for retries
          if (attempt < retryAttempts - 1) {
            const backoffDelay = retryDelay * Math.pow(2, attempt);
            console.log(`Retrying in ${backoffDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
          }
        }
      }

      // All retries failed - check fallback
      console.error(`All ${retryAttempts} attempts failed for ${target.name}`);

      if (this.manifest.taskRouting?.fallbackToLocal) {
        console.log("Falling back to local execution");
        this.metrics.tasksLocal++;
        const result = await this.executeLocally(taskContext);
        this.activeTasks.delete(taskId);
        return result;
      }

      throw lastError;
    } catch (err) {
      this.metrics.tasksFailed++;
      this.activeTasks.delete(taskId);

      const errorContext = {
        task: taskContext,
        error: err.message,
        stack: err.stack,
        duration: Date.now() - startTime
      };

      this.emit("task_failed", errorContext);

      return {
        error: err.message,
        stack: err.stack,
        taskId: taskContext.id,
        from: "broker",
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Finds the best peer node to handle a task based on routing strategy
   * @private
   * @param {Object} task - Task to route
   * @returns {CognitiveLink|null} Best link or null if none available
   */
  findBestNode(task) {
    const strategy = this.manifest.taskRouting?.strategy || "best-fit";

    // Filter for capable and available peers
    const capable = Array.from(this.links.values()).filter(link => {
      // Check basic availability
      if (!link.enabled || !link.isConnected) return false;

      // Check if link can handle this action
      if (!link.canHandle(task.action)) return false;

      // Check circuit breaker
      if (this.isCircuitBreakerOpen(link.name)) {
        console.log(`Skipping ${link.name} - circuit breaker open`);
        return false;
      }

      return true;
    });

    if (capable.length === 0) return null;

    // Select based on strategy
    switch (strategy) {
      case "least-connections":
        return capable.reduce((best, current) => {
          const currentLoad = current.getLoad?.() ?? 0;
          const bestLoad = best.getLoad?.() ?? 0;
          return currentLoad < bestLoad ? current : best;
        });

      case "priority":
        return capable.sort((a, b) => {
          const priorityA = a.priority ?? 0;
          const priorityB = b.priority ?? 0;
          return priorityA - priorityB;
        })[0];

      case "weighted":
        return this.selectWeighted(capable);

      case "best-fit":
      default:
        return capable.reduce((best, current) => {
          const currentScore = this.calculateFitScore(current, task);
          const bestScore = this.calculateFitScore(best, task);
          return currentScore > bestScore ? current : best;
        });
    }
  }

  /**
   * Calculates a fitness score for a link handling a specific task
   * @private
   * @param {CognitiveLink} link - The link to score
   * @param {Object} task - The task to handle
   * @returns {number} Fitness score (higher is better)
   */
  calculateFitScore(link, task) {
    let score = 0;

    // Specialization match bonus
    const specialization = link.specialization ?? [];
    if (Array.isArray(specialization) && specialization.includes(task.action)) {
      score += SCORING_WEIGHTS.SPECIALIZATION_MATCH;
    }

    // Load-based score (lower load = higher score)
    const load = link.getLoad?.() ?? 0;
    score += Math.max(0, SCORING_WEIGHTS.MAX_LOAD_SCORE - load);

    // Success rate score
    const completedTasks = link.completedTasks ?? 0;
    const failedTasks = link.failedTasks ?? 0;
    const total = completedTasks + failedTasks;

    if (total > 0) {
      const successRate = completedTasks / total;
      score += successRate * SCORING_WEIGHTS.SUCCESS_RATE_WEIGHT;
    } else {
      // No history - use default score
      score += SCORING_WEIGHTS.DEFAULT_SUCCESS_SCORE;
    }

    return score;
  }

  /**
   * Selects a link using weighted random selection
   * @private
   * @param {CognitiveLink[]} capable - Array of capable links
   * @returns {CognitiveLink} Selected link
   */
  selectWeighted(capable) {
    const total = capable.reduce((sum, link) => {
      const weight = link.weight ?? 1;
      return sum + weight;
    }, 0);

    let random = Math.random() * total;

    for (const link of capable) {
      const weight = link.weight ?? 1;
      random -= weight;
      if (random <= 0) return link;
    }

    // Fallback to first if random selection fails
    return capable[0];
  }

  /**
   * Executes a task locally on this node
   * @private
   * @param {Object} task - Task to execute
   * @returns {Promise<Object>} Execution result
   */
  async executeLocally(task) {
    console.log(`Executing locally: ${task.action}`);

    try {
      const plan = planTask(task);
      this.emit("local_execution", { task, plan });

      const result = plan
        ? { summary: plan.summary, plan }
        : { summary: `Task "${task.action}" executed locally` };

      return {
        result,
        from: this.manifest.nodeName,
        local: true
      };
    } catch (err) {
      console.error("Local execution failed:", err.message);
      throw err;
    }
  }

  /**
   * Gets current broker status including metrics and peer states
   * @returns {Object} Status object
   */
  getStatus() {
    const peerStatus = {};
    const circuitBreakerStatus = {};

    for (const [name, link] of this.links.entries()) {
      peerStatus[name] = link.getStatus();

      const breaker = this.circuitBreakers.get(name);
      if (breaker) {
        circuitBreakerStatus[name] = {
          state: breaker.state,
          failures: breaker.failures,
          successes: breaker.successes
        };
      }
    }

    const avgLatency = this.metrics.tasksDelegated > 0
      ? Math.round(this.metrics.totalLatency / this.metrics.tasksDelegated)
      : 0;

    return {
      nodeName: this.manifest.nodeName,
      nodeId: this.manifest.nodeId,
      role: this.manifest.role,
      specialization: this.manifest.specialization,
      isInitialized: this.isInitialized,
      isShuttingDown: this.isShuttingDown,
      activeTasks: this.activeTasks.size,
      peers: peerStatus,
      circuitBreakers: circuitBreakerStatus,
      metrics: {
        ...this.metrics,
        averageLatency: avgLatency
      },
      initializationErrors: this.initializationErrors.length
    };
  }

  /**
   * Gracefully shuts down the broker, waiting for active tasks to complete
   * @param {number} [timeout=30000] - Maximum time to wait for tasks (ms)
   * @returns {Promise<void>}
   */
  async destroy(timeout = 30000) {
    if (this.isShuttingDown) {
      console.warn("TaskBroker already shutting down");
      return;
    }

    console.log("Initiating TaskBroker shutdown...");
    this.isShuttingDown = true;

    // Wait for active tasks to complete
    if (this.activeTasks.size > 0) {
      console.log(`Waiting for ${this.activeTasks.size} active task(s) to complete...`);

      const startTime = Date.now();
      while (this.activeTasks.size > 0 && (Date.now() - startTime) < timeout) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (this.activeTasks.size > 0) {
        console.warn(`Shutdown timeout: ${this.activeTasks.size} task(s) still active`);
        // Emit warning about incomplete tasks
        this.emit("shutdown_warning", {
          incompleteTasks: Array.from(this.activeTasks.keys())
        });
      } else {
        console.log("All active tasks completed");
      }
    }

    // Destroy all peer links
    console.log("Closing peer connections...");
    for (const link of this.links.values()) {
      try {
        link.destroy();
      } catch (err) {
        console.error(`Error destroying link ${link.name}:`, err.message);
      }
    }

    this.links.clear();
    this.circuitBreakers.clear();
    this.activeTasks.clear();
    this.removeAllListeners();

    console.log("TaskBroker shutdown complete");
  }
}