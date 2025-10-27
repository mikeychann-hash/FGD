// fusion/fusion_core.js
// Intelligent knowledge fusion across distributed nodes

import fs from "fs/promises";
import fsSync from "fs";
import { KnowledgeStore } from "./knowledge_store.js";
import EventEmitter from "events";

const DEFAULT_FUSION_DATA = {
  skills: {},
  dialogues: {},
  outcomes: [],
  metadata: {
    version: "2.0.0",
    lastMerge: null,
    mergeCount: 0,
    sources: [],
    lastMergeDuration: null,
    mergeDurations: []
  }
};

export class FusionCore extends EventEmitter {
  constructor(path = "./data/fused_knowledge.json") {
    super();
    this.path = path;
    this.store = new KnowledgeStore();
    this.fusionData = { ...DEFAULT_FUSION_DATA };
    this.saveQueue = null;
    this.mergeHistory = [];
    this.loadFusion();
  }

  loadFusion() {
    try {
      if (fsSync.existsSync(this.path)) {
        const rawData = fsSync.readFileSync(this.path, "utf-8");
        const loaded = JSON.parse(rawData);
        this.fusionData = {
          ...DEFAULT_FUSION_DATA,
          ...loaded,
          metadata: { ...DEFAULT_FUSION_DATA.metadata, ...loaded.metadata }
        };
        console.log("🔮 Fusion data loaded successfully");
        this.emit("loaded");
      } else {
        console.log("📝 Starting with empty fusion data");
      }
    } catch (err) {
      console.error("❌ Error loading fusion data:", err.message);
      this.fusionData = { ...DEFAULT_FUSION_DATA };
    }
  }

  async saveFusion() {
    if (this.saveQueue) clearTimeout(this.saveQueue);
    this.saveQueue = setTimeout(async () => {
      try {
        await fs.mkdir("./data", { recursive: true });
        await fs.writeFile(this.path, JSON.stringify(this.fusionData, null, 2), "utf-8");
        console.log("💾 Fusion data saved successfully");
        this.emit("saved");
      } catch (err) {
        console.error("❌ Error saving fusion data:", err.message);
        this.emit("save_error", err);
      }
    }, 1000);
  }

  async mergeKnowledge(localNodeData, sourceNode = "unknown") {
    if (!localNodeData || typeof localNodeData !== "object") {
      console.warn("⚠️  Invalid node data for merge");
      return this.fusionData;
    }
    const mergeStartTime = Date.now();
    const mergeId = this.generateMergeId();
    console.log(`🔄 Starting knowledge merge from ${sourceNode}`);

    try {
      if (localNodeData.skills) this.mergeSkills(localNodeData.skills, sourceNode);
      if (localNodeData.dialogues) this.mergeDialogues(localNodeData.dialogues, sourceNode);
      if (localNodeData.outcomes) this.mergeOutcomes(localNodeData.outcomes, sourceNode);

      this.fusionData.metadata.lastMerge = new Date().toISOString();
      this.fusionData.metadata.mergeCount++;
      if (!this.fusionData.metadata.sources.includes(sourceNode)) {
        this.fusionData.metadata.sources.push(sourceNode);
      }

      const mergeRecord = {
        id: mergeId,
        source: sourceNode,
        timestamp: Date.now(),
        duration: Date.now() - mergeStartTime
      };

      this.fusionData.metadata.lastMergeDuration = mergeRecord.duration;
      if (!Array.isArray(this.fusionData.metadata.mergeDurations)) {
        this.fusionData.metadata.mergeDurations = [];
      }
      this.fusionData.metadata.mergeDurations.push(mergeRecord.duration);
      if (this.fusionData.metadata.mergeDurations.length > 100) {
        this.fusionData.metadata.mergeDurations.shift();
      }
      this.mergeHistory.push(mergeRecord);
      if (this.mergeHistory.length > 100) this.mergeHistory.shift();

      await this.saveFusion();
      console.log(`✅ Merge completed in ${mergeRecord.duration}ms`);
      this.emit("merge_completed", mergeRecord);
      return this.fusionData;
    } catch (err) {
      console.error("❌ Merge failed:", err.message);
      this.emit("merge_error", err);
      throw err;
    }
  }

  mergeSkills(incomingSkills, sourceNode) {
    for (const [npcName, skills] of Object.entries(incomingSkills)) {
      if (!this.fusionData.skills[npcName]) {
        this.fusionData.skills[npcName] = { ...skills, _source: sourceNode };
      } else {
        for (const [skillName, newValue] of Object.entries(skills)) {
          const oldValue = this.fusionData.skills[npcName][skillName];
          if (oldValue === undefined) {
            this.fusionData.skills[npcName][skillName] = newValue;
          } else {
            const merged = (oldValue * 0.6) + (newValue * 0.4);
            this.fusionData.skills[npcName][skillName] = Math.round(merged * 100) / 100;
          }
        }
      }
    }
  }

  mergeDialogues(incomingDialogues, sourceNode) {
    const existingIds = new Set(Object.keys(this.fusionData.dialogues));
    let added = 0;
    for (const dialogue of incomingDialogues) {
      if (!dialogue.id) continue;
      if (!existingIds.has(dialogue.id)) {
        this.fusionData.dialogues[dialogue.id] = {
          ...dialogue,
          _mergedFrom: sourceNode,
          _mergedAt: Date.now()
        };
        added++;
      }
    }
    if (added > 0) console.log(`💬 Dialogues: ${added} added`);
  }

  mergeOutcomes(incomingOutcomes, sourceNode) {
    const cutoffTime = Date.now() - (90 * 24 * 60 * 60 * 1000);
    const recentOutcomes = incomingOutcomes
      .filter(o => o.timestamp && o.timestamp > cutoffTime)
      .map(o => ({ ...o, _mergedFrom: sourceNode }));
    this.fusionData.outcomes.push(...recentOutcomes);
    this.fusionData.outcomes = this.fusionData.outcomes
      .filter(o => o.timestamp > cutoffTime)
      .slice(-50000);
    if (recentOutcomes.length > 0) console.log(`📊 Outcomes: ${recentOutcomes.length} merged`);
  }

  exportForSync(targetNode = null) {
    const exportData = {
      skills: this.fusionData.skills,
      dialogues: Object.values(this.fusionData.dialogues),
      outcomes: this.fusionData.outcomes.slice(-1000),
      metadata: {
        exportedAt: new Date().toISOString(),
        exportedFor: targetNode,
        version: this.fusionData.metadata.version
      }
    };
    this.emit("exported", { targetNode });
    return JSON.stringify(exportData);
  }

  getSkillAggregates() {
    const aggregates = {};
    for (const [npcName, skills] of Object.entries(this.fusionData.skills)) {
      for (const [skillName, value] of Object.entries(skills)) {
        if (skillName.startsWith("_")) continue;
        if (!aggregates[skillName]) {
          aggregates[skillName] = { total: 0, count: 0, avg: 0, max: 0, min: Infinity };
        }
        aggregates[skillName].total += value;
        aggregates[skillName].count++;
        aggregates[skillName].max = Math.max(aggregates[skillName].max, value);
        aggregates[skillName].min = Math.min(aggregates[skillName].min, value);
      }
    }
    for (const skill of Object.values(aggregates)) {
      skill.avg = skill.count > 0 ? skill.total / skill.count : 0;
    }
    return aggregates;
  }

  getSuccessRates() {
    const rates = {};
    for (const outcome of this.fusionData.outcomes) {
      const key = `${outcome.npc}:${outcome.task}`;
      if (!rates[key]) {
        rates[key] = { npc: outcome.npc, task: outcome.task, total: 0, successes: 0 };
      }
      rates[key].total++;
      if (outcome.success) rates[key].successes++;
    }
    for (const rate of Object.values(rates)) {
      rate.rate = rate.total > 0 ? rate.successes / rate.total : 0;
    }
    return Object.values(rates);
  }

  getStatus() {
    return {
      metadata: this.fusionData.metadata,
      counts: {
        npcs: Object.keys(this.fusionData.skills).length,
        dialogues: Object.keys(this.fusionData.dialogues).length,
        outcomes: this.fusionData.outcomes.length
      },
      recentMerges: this.mergeHistory.slice(-10)
    };
  }

  generateMergeId() {
    return `merge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getMergeStats() {
    const history = [...this.mergeHistory];
    if (history.length === 0) {
      return {
        mergeCount: this.fusionData.metadata.mergeCount || 0,
        averageDuration: this.fusionData.metadata.lastMergeDuration || null,
        averageInterval: null,
        lastMerge: this.fusionData.metadata.lastMerge,
        mergesPerHour: 0
      };
    }

    const durations = history.map(entry => entry.duration);
    const averageDuration = durations.reduce((sum, value) => sum + value, 0) / durations.length;

    const intervals = [];
    for (let i = 1; i < history.length; i++) {
      intervals.push(history[i].timestamp - history[i - 1].timestamp);
    }
    const averageInterval = intervals.length > 0
      ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length
      : null;

    const timespan = history.length > 1
      ? history[history.length - 1].timestamp - history[0].timestamp
      : 0;
    const mergesPerHour = timespan > 0
      ? (history.length / timespan) * 3600000
      : 0;

    return {
      mergeCount: this.fusionData.metadata.mergeCount || history.length,
      averageDuration,
      averageInterval,
      lastMerge: this.fusionData.metadata.lastMerge,
      mergesPerHour
    };
  }
}