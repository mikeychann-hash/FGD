// ai/learning_engine.js
// Persistent learning and progression system for NPCs

import fs from "fs/promises";
import fsSync from "fs";
import { Traits } from "./traits.js";
import { KnowledgeStore } from "./knowledge_store.js";
import { MemoryCore } from "./memory_core.js";

const SKILL_INCREMENT = 0.1;
const XP_PER_TASK = 1;
const MOTIVATION_CHANGE = 0.05;

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function normalizeTaskType(taskType) {
  if (!taskType) return "general";
  const skillMap = {
    build: "building",
    mine: "mining",
    explore: "exploring",
    gather: "gathering",
    guard: "guard",
    craft: "crafting"
  };
  return skillMap[taskType] || taskType;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class LearningEngine {
  constructor(pathOrOptions = "./data/npc_profiles.json", options = {}) {
    if (typeof pathOrOptions === "object" && pathOrOptions !== null) {
      options = pathOrOptions;
      this.path = options.path || "./data/npc_profiles.json";
    } else {
      this.path = pathOrOptions;
    }

    this.traits = options.traits || new Traits();
    this.knowledgeStore = options.knowledgeStore || new KnowledgeStore(options.knowledgeStorePath);
    this.memoryCore = options.memoryCore || new MemoryCore(options.memoryPath);

    this.profiles = {};
    this.saveQueue = null;
    this.loadProfiles();
  }

  loadProfiles() {
    try {
      if (fsSync.existsSync(this.path)) {
        const data = fsSync.readFileSync(this.path, "utf-8");
        const parsed = JSON.parse(data);
        this.profiles = parsed || {};
        console.log(`📚 Loaded ${Object.keys(this.profiles).length} NPC profiles`);
      } else {
        this.profiles = {};
        console.log("📝 Starting with empty profile database");
      }
    } catch (err) {
      console.error("❌ Error loading profiles:", err.message);
      this.profiles = {};
    }
  }

  async saveProfiles() {
    if (this.saveQueue) {
      clearTimeout(this.saveQueue);
    }

    this.saveQueue = setTimeout(async () => {
      try {
        await fs.mkdir("./data", { recursive: true });
        await fs.writeFile(this.path, JSON.stringify(this.profiles, null, 2), "utf-8");
        console.log("💾 Profiles saved successfully");
      } catch (err) {
        console.error("❌ Error saving profiles:", err.message);
      }
    }, 500);
  }

  ensureProfile(npcName) {
    if (!npcName) {
      throw new Error("NPC name is required to access a profile");
    }

    if (!this.profiles[npcName]) {
      const personality = this.traits.generate();
      this.profiles[npcName] = {
        skills: {
          mining: 1,
          building: 1,
          gathering: 1,
          exploring: 1,
          guard: 1,
          crafting: 1
        },
        personality,
        personalitySummary: this.traits.summarizeForPrompt(personality),
        performance: {},
        xp: 0,
        tasksCompleted: 0,
        tasksFailed: 0,
        createdAt: new Date().toISOString()
      };
      console.log(`✨ Created new profile for ${npcName}`);
    }

    const profile = this.profiles[npcName];
    if (!profile.performance) profile.performance = {};
    if (!profile.personalitySummary) {
      profile.personalitySummary = this.traits.summarizeForPrompt(profile.personality);
    }
    return profile;
  }

  normalizeMetrics(rawMetrics = {}) {
    if (!isObject(rawMetrics)) return {};

    const metrics = { ...rawMetrics };
    const duration = Number(metrics.duration);
    const errors = Number(metrics.errors ?? metrics.mistakes ?? 0);
    const output = Number(
      metrics.resourcesGathered ?? metrics.blocksMined ?? metrics.itemsCrafted ?? metrics.output ?? 0
    );
    let efficiency = Number(metrics.efficiency);

    if (!Number.isFinite(efficiency) || efficiency <= 0) {
      if (Number.isFinite(output) && output > 0 && Number.isFinite(duration) && duration > 0) {
        efficiency = output / duration;
      } else {
        efficiency = null;
      }
    }

    return {
      duration: Number.isFinite(duration) && duration >= 0 ? duration : null,
      errors: Number.isFinite(errors) && errors >= 0 ? errors : 0,
      output: Number.isFinite(output) && output >= 0 ? output : 0,
      efficiency,
      metadata: metrics.metadata || null
    };
  }

  updatePerformance(profile, skillType, success, metrics) {
    if (!profile.performance[skillType]) {
      profile.performance[skillType] = {
        attempts: 0,
        successes: 0,
        failures: 0,
        successRate: 0,
        totalDuration: 0,
        durationSamples: 0,
        averageDuration: null,
        totalOutput: 0,
        outputSamples: 0,
        totalErrors: 0,
        errorRate: 0,
        efficiencyTotal: 0,
        efficiencySamples: 0,
        averageEfficiency: null,
        successStreak: 0,
        bestSuccessStreak: 0,
        lastOutcome: null,
        lastMetrics: null,
        lastReward: 0
      };
    }

    const perf = profile.performance[skillType];
    perf.attempts += 1;

    if (success) {
      perf.successes += 1;
      perf.successStreak += 1;
      perf.bestSuccessStreak = Math.max(perf.bestSuccessStreak, perf.successStreak);
    } else {
      perf.failures += 1;
      perf.successStreak = 0;
    }

    if (metrics.duration != null) {
      perf.totalDuration += metrics.duration;
      perf.durationSamples += 1;
      perf.averageDuration = perf.totalDuration / perf.durationSamples;
    }

    if (metrics.output != null) {
      perf.totalOutput += metrics.output;
      perf.outputSamples += 1;
    }

    if (metrics.errors != null) {
      perf.totalErrors += metrics.errors;
    }

    if (metrics.efficiency != null) {
      perf.efficiencyTotal += metrics.efficiency;
      perf.efficiencySamples += 1;
      perf.averageEfficiency = perf.efficiencyTotal / perf.efficiencySamples;
    }

    perf.errorRate = perf.attempts > 0 ? perf.totalErrors / perf.attempts : 0;
    perf.successRate = perf.attempts > 0 ? perf.successes / perf.attempts : 0;
    perf.lastOutcome = success;
    perf.lastMetrics = metrics;

    return perf;
  }

  calculateSkillIncrement(success, performance, behaviorModifiers, metrics) {
    if (!success) {
      return 0;
    }

    let increment = SKILL_INCREMENT;
    if (performance.successRate) {
      increment *= 0.8 + performance.successRate * 0.4;
    }
    if (performance.averageEfficiency) {
      increment *= Math.min(1.5, 0.6 + performance.averageEfficiency);
    }
    if (behaviorModifiers?.efficiency) {
      increment *= clamp(behaviorModifiers.efficiency, 0.5, 1.6);
    }
    if (metrics.duration && metrics.duration < 60) {
      increment *= 1.05;
    }
    if (metrics.errors > 0) {
      increment *= Math.max(0.7, 1 - metrics.errors * 0.05);
    }

    return increment;
  }

  calculateReward(success, metrics, performance) {
    const base = success ? 5 : -3;
    const efficiencyBonus = metrics.efficiency ? Math.min(4, metrics.efficiency * 2) : 0;
    const outputBonus = metrics.output ? Math.min(3, metrics.output * 0.1) : 0;
    const streakBonus = success ? Math.min(3, (performance.successStreak || 0) * 0.5) : 0;
    const errorPenalty = (metrics.errors || 0) * 0.5;
    return Number((base + efficiencyBonus + outputBonus + streakBonus - errorPenalty).toFixed(2));
  }

  buildPerformanceSnapshot(perf) {
    return {
      attempts: perf.attempts,
      successes: perf.successes,
      failures: perf.failures,
      successRate: perf.successRate,
      totalDuration: perf.totalDuration,
      averageDuration: perf.averageDuration,
      totalOutput: perf.totalOutput,
      averageEfficiency: perf.averageEfficiency,
      totalErrors: perf.totalErrors,
      errorRate: perf.errorRate,
      successStreak: perf.successStreak,
      bestSuccessStreak: perf.bestSuccessStreak,
      lastReward: perf.lastReward
    };
  }

  buildSkillExport(skills) {
    const exported = {};
    for (const [skill, value] of Object.entries(skills || {})) {
      exported[skill] = Math.round(clamp(value * 10, 0, 100));
    }
    return exported;
  }

  recordTask(npcName, taskType, success = true, metricsInput = {}) {
    const profile = this.ensureProfile(npcName);
    const skillType = normalizeTaskType(taskType);
    const metrics = this.normalizeMetrics(metricsInput);

    if (!profile.skills.hasOwnProperty(skillType)) {
      profile.skills[skillType] = 1;
    }

    const behaviorModifiers = this.traits.getTaskModifiers(profile.personality, skillType);
    const performance = this.updatePerformance(profile, skillType, success, metrics);
    const skillIncrement = this.calculateSkillIncrement(success, performance, behaviorModifiers, metrics);

    if (success) {
      profile.skills[skillType] += skillIncrement;
      profile.xp += XP_PER_TASK;
      profile.tasksCompleted += 1;
      profile.personality.motivation = clamp(
        profile.personality.motivation + MOTIVATION_CHANGE * behaviorModifiers.efficiency,
        0,
        1
      );
    } else {
      profile.tasksFailed += 1;
      profile.personality.motivation = clamp(
        profile.personality.motivation - MOTIVATION_CHANGE * behaviorModifiers.caution,
        0,
        1
      );
    }

    const reward = this.calculateReward(success, metrics, performance);
    performance.lastReward = reward;

    profile.personalitySummary = this.traits.summarizeForPrompt(profile.personality);
    profile.lastTask = {
      type: skillType,
      success,
      timestamp: new Date().toISOString(),
      metrics,
      reward
    };
    profile.lastActivity = profile.lastTask.timestamp;

    if (this.memoryCore) {
      this.memoryCore.logExperience({
        npc: npcName,
        task: skillType,
        success,
        reward,
        metrics,
        personality: profile.personality
      });
    }

    if (this.knowledgeStore) {
      const outcomeMetadata = {
        ...metrics,
        reward,
        successStreak: performance.successStreak,
        averageEfficiency: performance.averageEfficiency,
        behaviorArchetype: profile.personalitySummary.behavior?.archetype || null,
        behaviorModifiers: behaviorModifiers
      };
      this.knowledgeStore.recordOutcome(npcName, skillType, success, outcomeMetadata);
      this.knowledgeStore.recordPerformance(npcName, skillType, this.buildPerformanceSnapshot(performance));
      this.knowledgeStore.updateSkills(npcName, this.buildSkillExport(profile.skills));
    }

    this.saveProfiles();
    return profile;
  }

  getPlannerModifiers(npcName) {
    const profile = this.ensureProfile(npcName);
    const behavior = this.traits.getBehaviorProfile(profile.personality);
    const weights = {};

    for (const [skill, value] of Object.entries(profile.skills)) {
      const perf = profile.performance[skill] || {};
      let weight = 1 + (value - 1) * 0.25;
      if (perf.successRate) {
        weight *= 0.8 + perf.successRate * 0.5;
      }
      if (perf.successStreak > 2) {
        weight *= 1 + Math.min(0.3, perf.successStreak * 0.05);
      }
      if (perf.averageEfficiency) {
        weight *= clamp(0.7 + perf.averageEfficiency, 0.7, 1.8);
      }
      weights[skill] = Number(weight.toFixed(3));
    }

    return {
      npc: npcName,
      weights,
      behavior,
      motivation: profile.personality.motivation,
      xp: profile.xp
    };
  }

  getPlanningContext(npcNames = [], { includeMemories = true, memoryLimit = 5 } = {}) {
    const targets = npcNames.length > 0 ? npcNames : Object.keys(this.profiles);
    const context = {};

    for (const npc of targets) {
      const profile = this.ensureProfile(npc);
      const performanceSummary = {};
      for (const [skill, perf] of Object.entries(profile.performance || {})) {
        performanceSummary[skill] = {
          successRate: perf.successRate,
          successStreak: perf.successStreak,
          averageEfficiency: perf.averageEfficiency,
          averageDuration: perf.averageDuration,
          bestSuccessStreak: perf.bestSuccessStreak,
          attempts: perf.attempts
        };
      }

      context[npc] = {
        summary: profile.personalitySummary.summary,
        archetype: profile.personalitySummary.archetype,
        dominantTraits: profile.personalitySummary.dominantTraits,
        behavior: profile.personalitySummary.behavior,
        motivation: profile.personality.motivation,
        xp: profile.xp,
        skillRatings: this.buildSkillExport(profile.skills),
        performance: performanceSummary,
        planner: this.getPlannerModifiers(npc),
        recentMemories:
          includeMemories && this.memoryCore
            ? this.memoryCore.getRecentExperiences(npc, memoryLimit).map(entry => ({
                task: entry.task,
                success: entry.success,
                reward: entry.reward,
                timestamp: entry.timestamp,
                metrics: entry.metrics
              }))
            : []
      };
    }

    return context;
  }

  getProfile(npcName) {
    return this.ensureProfile(npcName);
  }

  getAllProfiles() {
    return { ...this.profiles };
  }

  getLeaderboard(skillType = null) {
    const npcs = Object.entries(this.profiles).map(([name, profile]) => ({
      name,
      xp: profile.xp,
      tasksCompleted: profile.tasksCompleted,
      skill: skillType ? profile.skills[skillType] || 0 : null
    }));

    if (skillType) {
      return npcs.sort((a, b) => b.skill - a.skill);
    }
    return npcs.sort((a, b) => b.xp - a.xp);
  }

  deleteProfile(npcName) {
    if (this.profiles[npcName]) {
      delete this.profiles[npcName];
      this.saveProfiles();
      console.log(`🗑️  Deleted profile for ${npcName}`);
      return true;
    }
    return false;
  }
}
