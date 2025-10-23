// fusion/knowledge_store.js
// Local knowledge storage with validation and cleanup

import fs from "fs/promises";
import fsSync from "fs";
import EventEmitter from "events";

function normalizeKey(value) {
  if (!value || typeof value !== "string") {
    return null;
  }
  const cleaned = value.trim().toLowerCase().replace(/[_\s]+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

const DEFAULT_DATA = {
  skills: {},
  dialogues: [],
  outcomes: [],
  toolDurability: {},
  metadata: {
    version: "1.0.0",
    created: null,
    lastUpdated: null,
    totalOperations: 0
  }
};

const MAX_OUTCOMES = 50000;
const MAX_DIALOGUES = 10000;
const OUTCOME_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const DIALOGUE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export class KnowledgeStore extends EventEmitter {
  constructor(path = "./data/local_knowledge.json") {
    super();
    this.path = path;
    this.data = { ...DEFAULT_DATA };
    this.saveQueue = null;
    this.isLoaded = false;
    this.load();
  }

  load() {
    try {
      if (fsSync.existsSync(this.path)) {
        const rawData = fsSync.readFileSync(this.path, "utf-8");
        const loaded = JSON.parse(rawData);
        this.data = {
          ...DEFAULT_DATA,
          ...loaded,
          metadata: { ...DEFAULT_DATA.metadata, ...loaded.metadata }
        };
        this.data.toolDurability = {};
        if (loaded.toolDurability && typeof loaded.toolDurability === "object") {
          for (const [npc, tools] of Object.entries(loaded.toolDurability)) {
            if (tools && typeof tools === "object") {
              this.data.toolDurability[npc] = { ...tools };
            }
          }
        }
        console.log("📚 Local knowledge loaded successfully");
        this.isLoaded = true;
        this.emit("loaded");
      } else {
        this.data = {
          ...DEFAULT_DATA,
          metadata: { ...DEFAULT_DATA.metadata, created: new Date().toISOString() }
        };
        console.log("📝 Starting with empty knowledge store");
        this.isLoaded = true;
      }
    } catch (err) {
      console.error("❌ Error loading knowledge store:", err.message);
      this.data = { ...DEFAULT_DATA };
      this.isLoaded = true;
    }
  }

  async save() {
    if (this.saveQueue) clearTimeout(this.saveQueue);
    this.saveQueue = setTimeout(async () => {
      try {
        await fs.mkdir("./data", { recursive: true });
        this.data.metadata.lastUpdated = new Date().toISOString();
        this.data.metadata.totalOperations++;
        await fs.writeFile(this.path, JSON.stringify(this.data, null, 2), "utf-8");
        console.log("💾 Knowledge store saved successfully");
        this.emit("saved");
      } catch (err) {
        console.error("❌ Error saving knowledge store:", err.message);
        this.emit("save_error", err);
      }
    }, 500);
  }

  recordOutcome(npcName, task, success, metadata = {}) {
    if (!npcName || !task) {
      console.warn("⚠️  Invalid outcome: missing npcName or task");
      return false;
    }
    const outcome = {
      npc: npcName,
      task,
      success: Boolean(success),
      timestamp: Date.now(),
      duration: metadata.duration || null,
      metadata: metadata || {}
    };
    this.data.outcomes.push(outcome);
    if (this.data.outcomes.length > MAX_OUTCOMES) this.pruneOutcomes();
    this.save();
    this.emit("outcome_recorded", outcome);
    return true;
  }

  recordDialogue(npcName, content, context = {}) {
    if (!npcName || !content) {
      console.warn("⚠️  Invalid dialogue: missing npcName or content");
      return false;
    }
    const dialogue = {
      id: `dlg_${this.generateId()}`,
      npc: npcName,
      content,
      context,
      timestamp: Date.now()
    };
    this.data.dialogues.push(dialogue);
    if (this.data.dialogues.length > MAX_DIALOGUES) this.pruneDialogues();
    this.save();
    this.emit("dialogue_recorded", dialogue);
    return dialogue.id;
  }

  updateSkills(npcName, skills) {
    if (!npcName || !skills || typeof skills !== "object") {
      console.warn("⚠️  Invalid skills update");
      return false;
    }
    if (!this.data.skills[npcName]) this.data.skills[npcName] = {};
    for (const [skillName, value] of Object.entries(skills)) {
      if (typeof value === "number" && !isNaN(value)) {
        this.data.skills[npcName][skillName] = Math.max(0, Math.min(100, value));
      }
    }
    this.save();
    this.emit("skills_updated", { npc: npcName, skills: this.data.skills[npcName] });
    return true;
  }

  recordToolDurability(npcName, toolName, durability, info = {}) {
    const npcKey = normalizeKey(npcName || info?.npc);
    const toolKey = normalizeKey(toolName || info?.tool);

    if (!npcKey || !toolKey) {
      console.warn("⚠️  Invalid tool durability update: missing npc or tool name");
      return false;
    }

    if (!this.data.toolDurability[npcKey]) {
      this.data.toolDurability[npcKey] = {};
    }

    const previous = this.data.toolDurability[npcKey][toolKey] || {};
    const numericDurability = Number.isFinite(durability)
      ? durability
      : Number.isFinite(info?.durability)
      ? info.durability
      : Number.isFinite(previous.durability)
      ? previous.durability
      : null;
    const numericMax = Number.isFinite(info?.maxDurability)
      ? info.maxDurability
      : Number.isFinite(previous.maxDurability)
      ? previous.maxDurability
      : null;

    let percent = Number.isFinite(info?.percent) ? info.percent : null;
    if (percent === null && Number.isFinite(previous.percent)) {
      percent = previous.percent;
    }
    if (percent === null && Number.isFinite(numericDurability) && Number.isFinite(numericMax) && numericMax > 0) {
      percent = numericDurability / numericMax;
    }
    percent = Number.isFinite(percent) ? Math.max(0, Math.min(1, percent)) : null;

    const broken = info?.broken ?? (percent !== null ? percent <= 0 : Number.isFinite(numericDurability) ? numericDurability <= 0 : previous.broken ?? false);

    const entry = {
      durability: Number.isFinite(numericDurability) ? numericDurability : null,
      maxDurability: Number.isFinite(numericMax) ? numericMax : null,
      percent,
      broken,
      lastUpdated: Date.now(),
      note: info?.note || info?.notes || previous.note || null
    };

    if (broken) {
      entry.brokenAt = info?.brokenAt || previous.brokenAt || Date.now();
    }

    this.data.toolDurability[npcKey][toolKey] = entry;
    this.save();

    const payload = { npc: npcKey, tool: toolKey, entry };
    this.emit("tool_durability_recorded", payload);
    if (broken) {
      this.emit("tool_broken", payload);
    }
    return entry;
  }

  getToolDurability(npcName, toolName = null) {
    if (!toolName) {
      if (!npcName) {
        return this.data.toolDurability;
      }
      const npcKey = normalizeKey(npcName);
      if (!npcKey) {
        return {};
      }
      return this.data.toolDurability[npcKey] || {};
    }

    const toolKey = normalizeKey(toolName);
    if (!toolKey) {
      return null;
    }

    if (npcName) {
      const npcKey = normalizeKey(npcName);
      if (!npcKey) {
        return null;
      }
      return this.data.toolDurability[npcKey]?.[toolKey] || null;
    }

    for (const tools of Object.values(this.data.toolDurability)) {
      if (tools && typeof tools === "object" && tools[toolKey]) {
        return tools[toolKey];
      }
    }
    return null;
  }

  getBrokenTools(npcName = null) {
    const results = [];
    const sourceEntries = npcName
      ? (() => {
          const npcKey = normalizeKey(npcName);
          if (!npcKey) return [];
          return [[npcKey, this.data.toolDurability[npcKey] || {}]];
        })()
      : Object.entries(this.data.toolDurability);

    for (const [npcKey, tools] of sourceEntries) {
      if (!tools || typeof tools !== "object") continue;
      for (const [toolKey, entry] of Object.entries(tools)) {
        if (entry?.broken) {
          results.push({ npc: npcKey, tool: toolKey, entry });
        }
      }
    }

    return results;
  }

  pruneOutcomes() {
    const cutoff = Date.now() - OUTCOME_RETENTION_MS;
    const originalLength = this.data.outcomes.length;
    this.data.outcomes = this.data.outcomes.filter(o => o.timestamp > cutoff).slice(-MAX_OUTCOMES);
    const pruned = originalLength - this.data.outcomes.length;
    if (pruned > 0) {
      console.log(`🧹 Pruned ${pruned} old outcomes`);
      this.emit("outcomes_pruned", pruned);
    }
  }

  pruneDialogues() {
    const cutoff = Date.now() - DIALOGUE_RETENTION_MS;
    const originalLength = this.data.dialogues.length;
    this.data.dialogues = this.data.dialogues.filter(d => d.timestamp > cutoff).slice(-MAX_DIALOGUES);
    const pruned = originalLength - this.data.dialogues.length;
    if (pruned > 0) {
      console.log(`🧹 Pruned ${pruned} old dialogues`);
      this.emit("dialogues_pruned", pruned);
    }
  }

  getOutcomes(npcName = null, limit = 100) {
    let outcomes = this.data.outcomes;
    if (npcName) outcomes = outcomes.filter(o => o.npc === npcName);
    return outcomes.slice(-limit);
  }

  getDialogues(npcName = null, limit = 100) {
    let dialogues = this.data.dialogues;
    if (npcName) dialogues = dialogues.filter(d => d.npc === npcName);
    return dialogues.slice(-limit);
  }

  getSkills(npcName) {
    return npcName ? this.data.skills[npcName] : this.data.skills;
  }

  getSuccessRate(npcName, taskType = null) {
    let outcomes = this.data.outcomes.filter(o => o.npc === npcName);
    if (taskType) outcomes = outcomes.filter(o => o.task === taskType);
    if (outcomes.length === 0) return null;
    const successful = outcomes.filter(o => o.success).length;
    return successful / outcomes.length;
  }

  getSummary() {
    const trackedTools = Object.values(this.data.toolDurability || {}).reduce((total, tools) => {
      if (!tools || typeof tools !== "object") {
        return total;
      }
      return total + Object.keys(tools).length;
    }, 0);
    const brokenTools = this.getBrokenTools().length;
    return {
      npcCount: Object.keys(this.data.skills).length,
      totalOutcomes: this.data.outcomes.length,
      totalDialogues: this.data.dialogues.length,
      trackedTools,
      brokenTools,
      metadata: this.data.metadata,
      oldestOutcome: this.data.outcomes.length > 0
        ? new Date(this.data.outcomes[0].timestamp).toISOString() : null,
      newestOutcome: this.data.outcomes.length > 0
        ? new Date(this.data.outcomes[this.data.outcomes.length - 1].timestamp).toISOString() : null
    };
  }

  exportData() {
    return { ...this.data, exportedAt: new Date().toISOString() };
  }

  importData(importedData) {
    if (!importedData || typeof importedData !== "object") {
      throw new Error("Invalid import data");
    }
    if (importedData.skills) this.data.skills = { ...this.data.skills, ...importedData.skills };
    if (importedData.dialogues && Array.isArray(importedData.dialogues)) {
      this.data.dialogues.push(...importedData.dialogues);
      this.pruneDialogues();
    }
    if (importedData.outcomes && Array.isArray(importedData.outcomes)) {
      this.data.outcomes.push(...importedData.outcomes);
      this.pruneOutcomes();
    }
    if (importedData.toolDurability && typeof importedData.toolDurability === "object") {
      for (const [npc, tools] of Object.entries(importedData.toolDurability)) {
        const npcKey = normalizeKey(npc);
        if (!npcKey || !tools || typeof tools !== "object") continue;
        if (!this.data.toolDurability[npcKey]) {
          this.data.toolDurability[npcKey] = {};
        }
        for (const [toolName, entry] of Object.entries(tools)) {
          const toolKey = normalizeKey(toolName);
          if (!toolKey || !entry || typeof entry !== "object") continue;
          this.data.toolDurability[npcKey][toolKey] = { ...entry };
        }
      }
    }
    this.save();
    console.log("✅ Data imported successfully");
    this.emit("data_imported");
  }

  clear() {
    this.data = {
      ...DEFAULT_DATA,
      metadata: { ...DEFAULT_DATA.metadata, created: new Date().toISOString() }
    };
    this.save();
    console.log("🗑️  Knowledge store cleared");
    this.emit("cleared");
  }

  generateId() {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }
}