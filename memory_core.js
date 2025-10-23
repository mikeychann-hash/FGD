// ai/memory_core.js
// Replay buffer that captures NPC task experiences for reinforcement and personalization

import fs from "fs/promises";
import fsSync from "fs";

const DEFAULT_MEMORY = {
  experiences: []
};

const MAX_EXPERIENCES = 5000;

export class MemoryCore {
  constructor(path = "./data/memory_buffer.json") {
    this.path = path;
    this.memory = { ...DEFAULT_MEMORY };
    this.saveQueue = null;
    this.load();
  }

  load() {
    try {
      if (fsSync.existsSync(this.path)) {
        const raw = fsSync.readFileSync(this.path, "utf-8");
        const parsed = JSON.parse(raw);
        this.memory = {
          ...DEFAULT_MEMORY,
          ...parsed,
          experiences: Array.isArray(parsed.experiences)
            ? parsed.experiences
            : []
        };
        console.log("🧠 Memory core loaded");
      } else {
        this.memory = { ...DEFAULT_MEMORY };
        console.log("📝 Starting with empty memory core");
      }
    } catch (err) {
      console.error("❌ Error loading memory core:", err.message);
      this.memory = { ...DEFAULT_MEMORY };
    }
  }

  async save() {
    if (this.saveQueue) clearTimeout(this.saveQueue);
    this.saveQueue = setTimeout(async () => {
      try {
        await fs.mkdir("./data", { recursive: true });
        await fs.writeFile(
          this.path,
          JSON.stringify(this.memory, null, 2),
          "utf-8"
        );
        console.log("💾 Memory core saved");
      } catch (err) {
        console.error("❌ Error saving memory core:", err.message);
      }
    }, 500);
  }

  logExperience({
    npc,
    task,
    success,
    reward = 0,
    metrics = {},
    notes = null,
    personality = null,
    timestamp = Date.now()
  }) {
    if (!npc || !task) {
      console.warn("⚠️  Invalid memory entry: missing npc or task");
      return null;
    }

    const entry = {
      id: `mem_${Math.random().toString(36).slice(2)}_${Date.now()}`,
      npc,
      task,
      success: Boolean(success),
      reward,
      metrics,
      notes,
      personality,
      timestamp
    };

    this.memory.experiences.push(entry);
    if (this.memory.experiences.length > MAX_EXPERIENCES) {
      this.memory.experiences.splice(0, this.memory.experiences.length - MAX_EXPERIENCES);
    }

    this.save();
    return entry;
  }

  getRecentExperiences(npc, limit = 5) {
    if (!npc) return [];
    const experiences = this.memory.experiences.filter(entry => entry.npc === npc);
    return experiences.slice(-limit);
  }

  getReplayBatch({ npc = null, limit = 20 } = {}) {
    if (!npc) {
      return this.memory.experiences.slice(-limit);
    }
    return this.getRecentExperiences(npc, limit);
  }

  summarizeNpc(npc, { limit = 5 } = {}) {
    const recent = this.getRecentExperiences(npc, limit);
    if (recent.length === 0) {
      return { npc, recent: [] };
    }

    const rewards = recent.map(item => Number(item.reward) || 0);
    const avgReward = rewards.length > 0
      ? rewards.reduce((acc, value) => acc + value, 0) / rewards.length
      : 0;

    return {
      npc,
      recent: recent.map(item => ({
        task: item.task,
        success: item.success,
        reward: item.reward,
        timestamp: item.timestamp,
        notes: item.notes,
        metrics: item.metrics
      })),
      averageRecentReward: avgReward
    };
  }
}
