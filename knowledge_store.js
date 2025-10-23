// knowledge_store.js
// Persistent memory for task outcomes, skills, and adaptive learning
// Refactored to emit richer telemetry and structured outcome events

import fs from "fs";
import path from "path";
import EventEmitter from "events";

export class KnowledgeStore extends EventEmitter {
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

    this.load();
  }

  /* ---------------------------------------------
   * Core Load / Save
   * --------------------------------------------- */
  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          this.data = { ...this.data, ...parsed };
          this.emit("loaded", { file: this.filePath, records: this.data.outcomes.length });
        }
      }
    } catch (err) {
      console.error("❌ Knowledge store load failed:", err.message);
    }
  }

  async save() {
    if (this.pendingSave) clearTimeout(this.pendingSave);
    this.pendingSave = setTimeout(() => {
      try {
        const tmp = `${this.filePath}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
        fs.renameSync(tmp, this.filePath);
        this.data.lastUpdated = Date.now();
        this.emit("saved", { file: this.filePath, timestamp: this.data.lastUpdated });
      } catch (err) {
        console.error("❌ Knowledge store save failed:", err.message);
      }
    }, this.saveDebounceMs);
  }

  /* ---------------------------------------------
   * Recording Task Outcomes
   * --------------------------------------------- */
  recordOutcome(taskType, result = {}) {
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
    if (this.data.outcomes.length > this.maxRecords) {
      this.data.outcomes.splice(0, this.data.outcomes.length - this.maxRecords);
    }

    // Aggregate yield + success stats
    const yieldStats = this.data.yields[taskType] || { total: 0, count: 0 };
    yieldStats.total += outcome.yield;
    yieldStats.count += 1;
    this.data.yields[taskType] = yieldStats;

    const successStats = this.data.skills[taskType] || { successes: 0, attempts: 0 };
    successStats.attempts++;
    if (outcome.success) successStats.successes++;
    this.data.skills[taskType] = successStats;

    this.data.stats.tasksCompleted++;
    this.data.stats.totalYield = Object.values(this.data.yields)
      .reduce((sum, y) => sum + y.total, 0);

    const totalAttempts = Object.values(this.data.skills)
      .reduce((sum, s) => sum + s.attempts, 0);
    const totalSuccesses = Object.values(this.data.skills)
      .reduce((sum, s) => sum + s.successes, 0);
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

  getSuccessRate(taskType) {
    const entry = this.data.skills[taskType];
    if (!entry) return 0;
    return entry.attempts ? entry.successes / entry.attempts : 0;
  }

  getAverageYield(taskType) {
    const entry = this.data.yields[taskType];
    if (!entry) return 0;
    return entry.count ? entry.total / entry.count : 0;
  }

  getHazardFrequency(hazardName) {
    let total = 0;
    for (const o of this.data.outcomes) {
      if (Array.isArray(o.hazards) && o.hazards.includes(hazardName)) total++;
    }
    return total;
  }

  getTaskHistory(taskType, limit = 20) {
    return this.data.outcomes
      .filter(o => o.taskType === taskType)
      .slice(-limit)
      .reverse();
  }

  /* ---------------------------------------------
   * Adaptive Intelligence Hooks
   * --------------------------------------------- */

  getDynamicDurationEstimate(taskType, baseMs = 10000) {
    const rate = this.getSuccessRate(taskType);
    const mod = rate > 0 ? Math.max(0.5, 1.3 - rate) : 1.0;
    const avgYield = this.getAverageYield(taskType);
    const yieldBonus = avgYield > 0 ? Math.min(0.9, avgYield / 200) : 0;
    return Math.round(baseMs * (mod - yieldBonus));
  }

  getRecommendedSupplies(taskType) {
    const history = this.getTaskHistory(taskType, 50);
    const hazards = {};
    for (const h of history.flatMap(o => o.hazards || [])) {
      hazards[h] = (hazards[h] || 0) + 1;
    }
    return Object.keys(hazards)
      .sort((a, b) => hazards[b] - hazards[a])
      .slice(0, 5);
  }
}
