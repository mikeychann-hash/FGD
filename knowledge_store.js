// knowledge_store.js
// Persistent memory for task outcomes, skills, and adaptive learning
// Refactored to emit richer telemetry and structured outcome events

import fs from "fs";
import path from "path";
import EventEmitter from "events";

// Constants for adaptive intelligence calculations
const DURATION_BASE_MODIFIER = 1.3;
const DURATION_MIN_MODIFIER = 0.5;
const DURATION_MAX_YIELD_BONUS = 0.9;
const DURATION_YIELD_DIVISOR = 200;
const RECOMMENDED_SUPPLIES_LIMIT = 5;
const DEFAULT_HISTORY_LIMIT = 20;
const DEFAULT_EXTENDED_HISTORY_LIMIT = 50;

/**
 * KnowledgeStore - Persistent storage for task outcomes and adaptive learning
 *
 * @class
 * @extends EventEmitter
 *
 * @fires KnowledgeStore#loaded - When data is successfully loaded from disk
 * @fires KnowledgeStore#saved - When data is successfully saved to disk
 * @fires KnowledgeStore#error - When an error occurs during load/save operations
 * @fires KnowledgeStore#outcome_recorded - When a new outcome is recorded
 * @fires KnowledgeStore#yield_recorded - When yield is recorded for a task
 * @fires KnowledgeStore#task_completed - When a task is successfully completed
 * @fires KnowledgeStore#hazard_encountered - When hazards are encountered during a task
 */
export class KnowledgeStore extends EventEmitter {
  /**
   * Creates a new KnowledgeStore instance
   *
   * @param {Object} options - Configuration options
   * @param {string} [options.filePath] - Path to the persistence file
   * @param {number} [options.maxRecords=2000] - Maximum number of outcome records to keep
   * @param {number} [options.saveDebounceMs=3000] - Debounce time for save operations in milliseconds
   */
  constructor(options = {}) {
    super();

    this.filePath = options.filePath || path.resolve("data", "local_knowledge.json");
    this.data = {
      version: 2,
      skills: {},
      outcomes: [],
      yields: {},
      stats: {
        tasksCompleted: 0,
        averageSuccessRate: 0,
        totalYield: 0
      },
      lastUpdated: Date.now()
    };

    this.maxRecords = options.maxRecords || 2000;
    this.saveDebounceMs = options.saveDebounceMs || 3000;
    this.lastSave = 0;
    this.pendingSave = null;

    this._ensureDirectory();
    this._cleanupTempFiles();
    this.load();
  }

  /* ---------------------------------------------
   * Core Load / Save
   * --------------------------------------------- */

  /**
   * Ensures the parent directory for the data file exists
   *
   * @private
   */
  _ensureDirectory() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (err) {
      console.error("❌ Failed to create data directory:", err.message);
      this.emit("error", { operation: "ensureDirectory", error: err });
    }
  }

  /**
   * Cleans up any orphaned temporary files from previous crashes
   *
   * @private
   */
  _cleanupTempFiles() {
    try {
      const tmpFile = `${this.filePath}.tmp`;
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    } catch (err) {
      console.error("❌ Failed to cleanup temp files:", err.message);
      this.emit("error", { operation: "cleanupTempFiles", error: err });
    }
  }

  /**
   * Validates the structure of loaded data
   *
   * @private
   * @param {Object} data - The data to validate
   * @returns {boolean} True if data is valid, false otherwise
   */
  _validateData(data) {
    if (!data || typeof data !== "object") return false;
    if (!data.version || typeof data.version !== "number") return false;
    if (!data.skills || typeof data.skills !== "object") return false;
    if (!Array.isArray(data.outcomes)) return false;
    if (!data.yields || typeof data.yields !== "object") return false;
    if (!data.stats || typeof data.stats !== "object") return false;
    return true;
  }

  /**
   * Recalculates aggregate statistics from the loaded data
   * Ensures data integrity after loading from disk
   *
   * @private
   */
  _recalculateStats() {
    // Recalculate total yield
    this.data.stats.totalYield = Object.values(this.data.yields)
      .reduce((sum, y) => sum + y.total, 0);

    // Recalculate average success rate
    const totalAttempts = Object.values(this.data.skills)
      .reduce((sum, s) => sum + s.attempts, 0);
    const totalSuccesses = Object.values(this.data.skills)
      .reduce((sum, s) => sum + s.successes, 0);
    this.data.stats.averageSuccessRate = totalAttempts
      ? totalSuccesses / totalAttempts
      : 0;

    // Recalculate tasks completed
    this.data.stats.tasksCompleted = this.data.outcomes.length;
  }

  /**
   * Loads data from the persistent file
   */
  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        const parsed = JSON.parse(raw);

        if (this._validateData(parsed)) {
          this.data = { ...this.data, ...parsed };

          // Trim outcomes to maxRecords if needed
          if (this.data.outcomes.length > this.maxRecords) {
            this.data.outcomes = this.data.outcomes.slice(-this.maxRecords);
          }

          // Recalculate stats to ensure consistency
          this._recalculateStats();

          this.emit("loaded", { file: this.filePath, records: this.data.outcomes.length });
        } else {
          console.error("❌ Invalid data structure in knowledge store file");
          this.emit("error", {
            operation: "load",
            error: new Error("Invalid data structure")
          });
        }
      }
    } catch (err) {
      console.error("❌ Knowledge store load failed:", err.message);
      this.emit("error", { operation: "load", error: err });
    }
  }

  /**
   * Saves data to the persistent file with debouncing
   * Uses atomic write pattern (write to temp file, then rename)
   */
  save() {
    if (this.pendingSave) clearTimeout(this.pendingSave);
    this.pendingSave = setTimeout(() => {
      try {
        // Update timestamp BEFORE serializing
        this.data.lastUpdated = Date.now();

        const tmp = `${this.filePath}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
        fs.renameSync(tmp, this.filePath);

        this.emit("saved", { file: this.filePath, timestamp: this.data.lastUpdated });
      } catch (err) {
        console.error("❌ Knowledge store save failed:", err.message);
        this.emit("error", { operation: "save", error: err });
      }
    }, this.saveDebounceMs);
  }

  /**
   * Performs immediate save and cleanup
   * Should be called before process exit
   *
   * @returns {Promise<void>}
   */
  async dispose() {
    return new Promise((resolve) => {
      // Clear pending save and save immediately
      if (this.pendingSave) {
        clearTimeout(this.pendingSave);
        this.pendingSave = null;
      }

      try {
        this.data.lastUpdated = Date.now();
        const tmp = `${this.filePath}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
        fs.renameSync(tmp, this.filePath);
        this.emit("saved", { file: this.filePath, timestamp: this.data.lastUpdated });
      } catch (err) {
        console.error("❌ Knowledge store dispose failed:", err.message);
        this.emit("error", { operation: "dispose", error: err });
      }

      // Remove all event listeners
      this.removeAllListeners();
      resolve();
    });
  }

  /* ---------------------------------------------
   * Recording Task Outcomes
   * --------------------------------------------- */

  /**
   * Records the outcome of a task execution
   *
   * @param {string} taskType - The type of task that was executed
   * @param {Object} result - The result of the task execution
   * @param {boolean} [result.success=false] - Whether the task succeeded
   * @param {number} [result.yield=0] - The yield/reward from the task
   * @param {string} [result.environment='unknown'] - The environment where the task was executed
   * @param {number} [result.duration=0] - Duration of the task in milliseconds
   * @param {Array<string>} [result.hazards=[]] - Hazards encountered during the task
   * @param {string|null} [result.npc=null] - NPC involved in the task
   * @param {string} [result.notes=''] - Additional notes about the task
   * @param {Object} [result.metadata={}] - Additional metadata
   *
   * @throws {TypeError} If taskType is not a string or result is not an object
   */
  recordOutcome(taskType, result = {}) {
    // Input validation
    if (typeof taskType !== "string" || !taskType) {
      throw new TypeError("taskType must be a non-empty string");
    }
    if (typeof result !== "object" || result === null) {
      throw new TypeError("result must be an object");
    }

    const outcome = {
      id: `${taskType}_${Date.now()}`,
      taskType,
      timestamp: Date.now(),
      success: !!result.success,
      yield: result.yield ?? 0,
      environment: result.environment || "unknown",
      duration: result.duration || 0,
      hazards: result.hazards || [],
      npc: result.npc || null,
      notes: result.notes || "",
      metadata: result.metadata || {}
    };

    this.data.outcomes.push(outcome);

    // Always trim to maxRecords
    if (this.data.outcomes.length > this.maxRecords) {
      this.data.outcomes = this.data.outcomes.slice(-this.maxRecords);
    }

    // Aggregate all stats in a single pass for better performance
    const yieldStats = this.data.yields[taskType] || { total: 0, count: 0 };
    yieldStats.total += outcome.yield;
    yieldStats.count += 1;
    this.data.yields[taskType] = yieldStats;

    const successStats = this.data.skills[taskType] || { successes: 0, attempts: 0 };
    successStats.attempts++;
    if (outcome.success) successStats.successes++;
    this.data.skills[taskType] = successStats;

    this.data.stats.tasksCompleted++;

    // Optimize: calculate all aggregates in one pass
    let totalYield = 0;
    let totalAttempts = 0;
    let totalSuccesses = 0;

    for (const yieldEntry of Object.values(this.data.yields)) {
      totalYield += yieldEntry.total;
    }

    for (const skillEntry of Object.values(this.data.skills)) {
      totalAttempts += skillEntry.attempts;
      totalSuccesses += skillEntry.successes;
    }

    this.data.stats.totalYield = totalYield;
    this.data.stats.averageSuccessRate = totalAttempts
      ? totalSuccesses / totalAttempts
      : 0;

    // Emit events for dashboard and other systems
    this.emit("outcome_recorded", outcome);
    if (outcome.yield > 0)
      this.emit("yield_recorded", {
        taskType,
        yield: outcome.yield,
        avgYield: this.getAverageYield(taskType)
      });
    if (outcome.success)
      this.emit("task_completed", {
        taskType,
        npc: outcome.npc,
        duration: outcome.duration,
        environment: outcome.environment
      });
    if (outcome.hazards.length)
      this.emit("hazard_encountered", {
        taskType,
        hazards: outcome.hazards,
        npc: outcome.npc
      });

    this.save();
  }

  /* ---------------------------------------------
   * Query Helpers
   * --------------------------------------------- */

  /**
   * Gets the success rate for a specific task type
   *
   * @param {string} taskType - The task type to query
   * @returns {number} Success rate between 0 and 1
   */
  getSuccessRate(taskType) {
    const entry = this.data.skills[taskType];
    if (!entry) return 0;
    return entry.attempts ? entry.successes / entry.attempts : 0;
  }

  /**
   * Gets the average yield for a specific task type
   *
   * @param {string} taskType - The task type to query
   * @returns {number} Average yield per attempt
   */
  getAverageYield(taskType) {
    const entry = this.data.yields[taskType];
    if (!entry) return 0;
    return entry.count ? entry.total / entry.count : 0;
  }

  /**
   * Gets the frequency of a specific hazard across all outcomes
   *
   * @param {string} hazardName - The hazard name to query
   * @returns {number} Number of times the hazard was encountered
   */
  getHazardFrequency(hazardName) {
    let total = 0;
    for (const o of this.data.outcomes) {
      if (Array.isArray(o.hazards) && o.hazards.includes(hazardName)) total++;
    }
    return total;
  }

  /**
   * Gets the task history for a specific task type
   *
   * @param {string} taskType - The task type to query
   * @param {number} [limit=20] - Maximum number of records to return
   * @returns {Array<Object>} Array of outcome records, most recent first
   */
  getTaskHistory(taskType, limit = DEFAULT_HISTORY_LIMIT) {
    return this.data.outcomes
      .filter(o => o.taskType === taskType)
      .slice(-limit)
      .reverse();
  }

  /* ---------------------------------------------
   * Adaptive Intelligence Hooks
   * --------------------------------------------- */

  /**
   * Calculates a dynamic duration estimate based on task success rate and yield
   *
   * @param {string} taskType - The task type to estimate for
   * @param {number} [baseMs=10000] - Base duration in milliseconds
   * @returns {number} Estimated duration in milliseconds
   */
  getDynamicDurationEstimate(taskType, baseMs = 10000) {
    const rate = this.getSuccessRate(taskType);
    const mod = rate > 0
      ? Math.max(DURATION_MIN_MODIFIER, DURATION_BASE_MODIFIER - rate)
      : 1.0;
    const avgYield = this.getAverageYield(taskType);
    const yieldBonus = avgYield > 0
      ? Math.min(DURATION_MAX_YIELD_BONUS, avgYield / DURATION_YIELD_DIVISOR)
      : 0;
    return Math.round(baseMs * (mod - yieldBonus));
  }

  /**
   * Gets recommended supplies based on frequently encountered hazards
   *
   * @param {string} taskType - The task type to get recommendations for
   * @returns {Array<string>} Array of hazard names, most frequent first
   */
  getRecommendedSupplies(taskType) {
    const history = this.getTaskHistory(taskType, DEFAULT_EXTENDED_HISTORY_LIMIT);
    const hazards = {};
    for (const h of history.flatMap(o => o.hazards || [])) {
      hazards[h] = (hazards[h] || 0) + 1;
    }
    return Object.keys(hazards)
      .sort((a, b) => hazards[b] - hazards[a])
      .slice(0, RECOMMENDED_SUPPLIES_LIMIT);
  }
}
