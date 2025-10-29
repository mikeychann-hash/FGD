// fusion/fusion_core.js
// Intelligent knowledge fusion across distributed nodes

import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { KnowledgeStore } from "./knowledge_store.js";
import EventEmitter from "events";

/**
 * Default structure for fusion data
 */
const DEFAULT_FUSION_DATA = {
  skills: {},
  dialogues: [],
  outcomes: [],
  metadata: {
    version: "2.0.0",
    lastMerge: null,
    mergeCount: 0,
    sources: []
  }
};

/**
 * Deep clone helper to prevent reference pollution
 * @param {Object} obj - Object to clone
 * @returns {Object} Deep cloned object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * FusionCore - Manages knowledge fusion across distributed nodes
 * @extends EventEmitter
 */
export class FusionCore extends EventEmitter {
  // Configuration constants
  static SAVE_DEBOUNCE_MS = 1000;
  static MAX_MERGE_HISTORY = 100;
  static SKILL_MERGE_WEIGHT_OLD = 0.6;
  static SKILL_MERGE_WEIGHT_NEW = 0.4;
  static OUTCOME_RETENTION_DAYS = 90;
  static MAX_OUTCOMES = 50000;
  static EXPORT_OUTCOMES_LIMIT = 1000;
  static MAX_FILE_SIZE_MB = 100;

  /**
   * Creates a FusionCore instance
   * Note: Use FusionCore.create() for async initialization
   * @param {string} dataPath - Path to fusion data file
   */
  constructor(dataPath = "./data/fused_knowledge.json") {
    super();
    this.setMaxListeners(20);
    this.path = path.resolve(dataPath);
    this.store = new KnowledgeStore();
    this.fusionData = deepClone(DEFAULT_FUSION_DATA);
    this.saveQueue = null;
    this.savePromise = null;
    this.mergeHistory = [];
  }

  /**
   * Factory method for async initialization
   * @param {string} dataPath - Path to fusion data file
   * @returns {Promise<FusionCore>} Initialized FusionCore instance
   */
  static async create(dataPath = "./data/fused_knowledge.json") {
    const instance = new FusionCore(dataPath);
    await instance.loadFusion();
    return instance;
  }

  /**
   * Loads fusion data from disk asynchronously
   * @returns {Promise<void>}
   */
  async loadFusion() {
    try {
      // Check if file exists
      try {
        await fs.access(this.path);
      } catch {
        this.log("Starting with empty fusion data");
        this.emit("loaded");
        return;
      }

      // Check file size
      const stats = await fs.stat(this.path);
      const sizeMB = stats.size / (1024 * 1024);
      if (sizeMB > FusionCore.MAX_FILE_SIZE_MB) {
        throw new Error(`File size ${sizeMB.toFixed(2)}MB exceeds maximum ${FusionCore.MAX_FILE_SIZE_MB}MB`);
      }

      const rawData = await fs.readFile(this.path, "utf-8");
      const loaded = JSON.parse(rawData);

      // Validate and merge loaded data
      this.fusionData = this.validateAndMergeData(loaded);

      this.log("Fusion data loaded successfully");
      this.emit("loaded");
    } catch (err) {
      this.logError("Error loading fusion data", err);
      this.fusionData = deepClone(DEFAULT_FUSION_DATA);
      this.emit("load_error", err);
      throw err;
    }
  }

  /**
   * Validates and merges loaded data with defaults
   * @param {Object} loaded - Loaded data object
   * @returns {Object} Validated and merged data
   */
  validateAndMergeData(loaded) {
    const validated = deepClone(DEFAULT_FUSION_DATA);

    if (loaded && typeof loaded === "object") {
      // Merge skills
      if (loaded.skills && typeof loaded.skills === "object") {
        validated.skills = loaded.skills;
      }

      // Merge dialogues (ensure array)
      if (Array.isArray(loaded.dialogues)) {
        validated.dialogues = loaded.dialogues;
      } else if (loaded.dialogues && typeof loaded.dialogues === "object") {
        // Convert legacy object format to array
        validated.dialogues = Object.values(loaded.dialogues);
      }

      // Merge outcomes
      if (Array.isArray(loaded.outcomes)) {
        validated.outcomes = loaded.outcomes;
      }

      // Merge metadata
      if (loaded.metadata && typeof loaded.metadata === "object") {
        validated.metadata = { ...validated.metadata, ...loaded.metadata };
      }
    }

    return validated;
  }

  /**
   * Saves fusion data to disk with debouncing
   * @returns {Promise<void>}
   */
  async saveFusion() {
    // Clear existing debounce timer
    if (this.saveQueue) {
      clearTimeout(this.saveQueue);
    }

    // Return existing save promise if one is pending
    if (this.savePromise) {
      return this.savePromise;
    }

    // Create debounced save promise
    this.savePromise = new Promise((resolve, reject) => {
      this.saveQueue = setTimeout(async () => {
        try {
          const dir = path.dirname(this.path);
          await fs.mkdir(dir, { recursive: true });
          await fs.writeFile(
            this.path,
            JSON.stringify(this.fusionData, null, 2),
            "utf-8"
          );
          this.log("Fusion data saved successfully");
          this.emit("saved");
          resolve();
        } catch (err) {
          this.logError("Error saving fusion data", err);
          this.emit("save_error", err);
          reject(err);
        } finally {
          this.savePromise = null;
          this.saveQueue = null;
        }
      }, FusionCore.SAVE_DEBOUNCE_MS);
    });

    return this.savePromise;
  }

  /**
   * Merges knowledge from a remote node
   * @param {Object} localNodeData - Data from remote node
   * @param {string} sourceNode - Identifier of source node
   * @returns {Promise<Object>} Updated fusion data
   */
  async mergeKnowledge(localNodeData, sourceNode = "unknown") {
    // Validate input
    if (!this.validateNodeData(localNodeData)) {
      this.logWarn("Invalid node data for merge");
      return this.fusionData;
    }

    const mergeStartTime = Date.now();
    const mergeId = this.generateMergeId();
    this.log(`Starting knowledge merge from ${sourceNode}`);

    try {
      // Merge each data type
      if (localNodeData.skills) {
        this.mergeSkills(localNodeData.skills, sourceNode);
      }
      if (localNodeData.dialogues) {
        this.mergeDialogues(localNodeData.dialogues, sourceNode);
      }
      if (localNodeData.outcomes) {
        this.mergeOutcomes(localNodeData.outcomes, sourceNode);
      }

      // Update metadata
      this.fusionData.metadata.lastMerge = new Date().toISOString();
      this.fusionData.metadata.mergeCount++;
      if (!this.fusionData.metadata.sources.includes(sourceNode)) {
        this.fusionData.metadata.sources.push(sourceNode);
      }

      // Record merge history
      const mergeRecord = {
        id: mergeId,
        source: sourceNode,
        timestamp: Date.now(),
        duration: Date.now() - mergeStartTime
      };
      this.mergeHistory.push(mergeRecord);
      if (this.mergeHistory.length > FusionCore.MAX_MERGE_HISTORY) {
        this.mergeHistory.shift();
      }

      await this.saveFusion();
      this.log(`Merge completed in ${mergeRecord.duration}ms`);
      this.emit("merge_completed", mergeRecord);
      return this.fusionData;
    } catch (err) {
      this.logError("Merge failed", err);
      this.emit("merge_error", err);
      throw err;
    }
  }

  /**
   * Validates node data structure
   * @param {*} data - Data to validate
   * @returns {boolean} True if valid
   */
  validateNodeData(data) {
    if (!data || typeof data !== "object") {
      return false;
    }

    // Check that at least one valid data type exists
    const hasSkills = data.skills && typeof data.skills === "object";
    const hasDialogues = Array.isArray(data.dialogues);
    const hasOutcomes = Array.isArray(data.outcomes);

    return hasSkills || hasDialogues || hasOutcomes;
  }

  /**
   * Merges skill data using weighted averaging
   * @param {Object} incomingSkills - Skills to merge
   * @param {string} sourceNode - Source identifier
   */
  mergeSkills(incomingSkills, sourceNode) {
    if (!incomingSkills || typeof incomingSkills !== "object") {
      return;
    }

    for (const [npcName, skills] of Object.entries(incomingSkills)) {
      if (!skills || typeof skills !== "object") {
        continue;
      }

      if (!this.fusionData.skills[npcName]) {
        this.fusionData.skills[npcName] = { ...skills, _source: sourceNode };
      } else {
        for (const [skillName, newValue] of Object.entries(skills)) {
          if (skillName.startsWith("_")) {
            continue; // Skip metadata fields
          }

          if (typeof newValue !== "number") {
            continue; // Skip non-numeric values
          }

          const oldValue = this.fusionData.skills[npcName][skillName];
          if (oldValue === undefined) {
            this.fusionData.skills[npcName][skillName] = newValue;
          } else if (typeof oldValue === "number") {
            // Weighted average: favor existing data slightly
            const merged =
              oldValue * FusionCore.SKILL_MERGE_WEIGHT_OLD +
              newValue * FusionCore.SKILL_MERGE_WEIGHT_NEW;
            this.fusionData.skills[npcName][skillName] =
              Math.round(merged * 100) / 100;
          }
        }
      }
    }
  }

  /**
   * Merges dialogue data (additive, no duplicates)
   * @param {Array} incomingDialogues - Dialogues to merge
   * @param {string} sourceNode - Source identifier
   */
  mergeDialogues(incomingDialogues, sourceNode) {
    if (!Array.isArray(incomingDialogues)) {
      return;
    }

    const existingIds = new Set(
      this.fusionData.dialogues
        .filter((d) => d && d.id)
        .map((d) => d.id)
    );

    let added = 0;
    for (const dialogue of incomingDialogues) {
      if (!dialogue || !dialogue.id) {
        continue;
      }

      if (!existingIds.has(dialogue.id)) {
        this.fusionData.dialogues.push({
          ...dialogue,
          _mergedFrom: sourceNode,
          _mergedAt: Date.now()
        });
        added++;
      }
    }

    if (added > 0) {
      this.log(`Dialogues: ${added} added`);
    }
  }

  /**
   * Merges outcome data with retention policy
   * @param {Array} incomingOutcomes - Outcomes to merge
   * @param {string} sourceNode - Source identifier
   */
  mergeOutcomes(incomingOutcomes, sourceNode) {
    if (!Array.isArray(incomingOutcomes)) {
      return;
    }

    const cutoffTime =
      Date.now() -
      FusionCore.OUTCOME_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    // Filter incoming outcomes first (before adding to array)
    const recentOutcomes = incomingOutcomes
      .filter((o) => o && o.timestamp && o.timestamp > cutoffTime)
      .map((o) => ({ ...o, _mergedFrom: sourceNode }));

    // Filter existing outcomes to maintain retention policy
    this.fusionData.outcomes = this.fusionData.outcomes
      .filter((o) => o && o.timestamp && o.timestamp > cutoffTime)
      .concat(recentOutcomes)
      .slice(-FusionCore.MAX_OUTCOMES);

    if (recentOutcomes.length > 0) {
      this.log(`Outcomes: ${recentOutcomes.length} merged`);
    }
  }

  /**
   * Exports data for syncing to another node
   * @param {string|null} targetNode - Target node identifier
   * @returns {string} JSON string of export data
   */
  exportForSync(targetNode = null) {
    const exportData = {
      skills: this.fusionData.skills,
      dialogues: this.fusionData.dialogues,
      outcomes: this.fusionData.outcomes.slice(
        -FusionCore.EXPORT_OUTCOMES_LIMIT
      ),
      metadata: {
        exportedAt: new Date().toISOString(),
        exportedFor: targetNode,
        version: this.fusionData.metadata.version
      }
    };
    this.emit("exported", { targetNode });
    return JSON.stringify(exportData);
  }

  /**
   * Calculates aggregate statistics for all skills
   * @returns {Object} Skill aggregates by skill name
   */
  getSkillAggregates() {
    const aggregates = {};

    for (const [npcName, skills] of Object.entries(this.fusionData.skills)) {
      if (!skills || typeof skills !== "object") {
        continue;
      }

      for (const [skillName, value] of Object.entries(skills)) {
        if (skillName.startsWith("_") || typeof value !== "number") {
          continue; // Skip metadata and non-numeric values
        }

        if (!aggregates[skillName]) {
          aggregates[skillName] = {
            total: 0,
            count: 0,
            avg: 0,
            max: -Infinity,
            min: Infinity
          };
        }

        aggregates[skillName].total += value;
        aggregates[skillName].count++;
        aggregates[skillName].max = Math.max(aggregates[skillName].max, value);
        aggregates[skillName].min = Math.min(aggregates[skillName].min, value);
      }
    }

    // Calculate averages
    for (const skill of Object.values(aggregates)) {
      skill.avg = skill.count > 0 ? skill.total / skill.count : 0;
    }

    return aggregates;
  }

  /**
   * Calculates success rates for NPC tasks
   * @returns {Array} Success rate objects
   */
  getSuccessRates() {
    const rates = {};

    for (const outcome of this.fusionData.outcomes) {
      if (!outcome || !outcome.npc || !outcome.task) {
        continue;
      }

      const key = `${outcome.npc}:${outcome.task}`;
      if (!rates[key]) {
        rates[key] = {
          npc: outcome.npc,
          task: outcome.task,
          total: 0,
          successes: 0,
          rate: 0
        };
      }

      rates[key].total++;
      if (outcome.success) {
        rates[key].successes++;
      }
    }

    // Calculate success rates
    for (const rate of Object.values(rates)) {
      rate.rate = rate.total > 0 ? rate.successes / rate.total : 0;
    }

    return Object.values(rates);
  }

  /**
   * Gets current status and statistics
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      metadata: this.fusionData.metadata,
      counts: {
        npcs: Object.keys(this.fusionData.skills).length,
        dialogues: this.fusionData.dialogues.length,
        outcomes: this.fusionData.outcomes.length
      },
      recentMerges: this.mergeHistory.slice(-10)
    };
  }

  /**
   * Generates a unique merge identifier
   * @returns {string} Merge ID
   */
  generateMergeId() {
    return `merge_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Logging helper
   * @param {string} message - Log message
   */
  log(message) {
    console.log(`[FusionCore] ${message}`);
  }

  /**
   * Warning logging helper
   * @param {string} message - Warning message
   */
  logWarn(message) {
    console.warn(`[FusionCore] WARNING: ${message}`);
  }

  /**
   * Error logging helper
   * @param {string} message - Error message
   * @param {Error} err - Error object
   */
  logError(message, err) {
    console.error(`[FusionCore] ERROR: ${message}`, err.message);
  }
}
