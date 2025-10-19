// ai/learning_engine.js
// Persistent learning and progression system for NPCs

import fs from "fs/promises";
import fsSync from "fs";
import { Traits } from "./traits.js";

const SKILL_INCREMENT = 0.1;
const XP_PER_TASK = 1;
const MOTIVATION_CHANGE = 0.05;

export class LearningEngine {
  constructor(path = "./data/npc_profiles.json") {
    this.path = path;
    this.traits = new Traits();
    this.profiles = {};
    this.saveQueue = null;
    this.loadProfiles();
  }

  loadProfiles() {
    try {
      if (fsSync.existsSync(this.path)) {
        const data = fsSync.readFileSync(this.path, "utf-8");
        this.profiles = JSON.parse(data);
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
    // Debounce saves to prevent excessive I/O
    if (this.saveQueue) {
      clearTimeout(this.saveQueue);
    }

    this.saveQueue = setTimeout(async () => {
      try {
        await fs.mkdir("./data", { recursive: true });
        await fs.writeFile(
          this.path,
          JSON.stringify(this.profiles, null, 2),
          "utf-8"
        );
        console.log("💾 Profiles saved successfully");
      } catch (err) {
        console.error("❌ Error saving profiles:", err.message);
      }
    }, 500); // Save after 500ms of no activity
  }

  ensureProfile(npcName) {
    if (!this.profiles[npcName]) {
      this.profiles[npcName] = {
        skills: {
          mining: 1,
          building: 1,
          gathering: 1,
          exploring: 1,
          guard: 1
        },
        personality: this.traits.generate(),
        xp: 0,
        tasksCompleted: 0,
        tasksFailed: 0,
        createdAt: new Date().toISOString()
      };
      console.log(`✨ Created new profile for ${npcName}`);
    }
    return this.profiles[npcName];
  }

  recordTask(npcName, taskType, success = true) {
    const profile = this.ensureProfile(npcName);

    // Normalize task type to match skill names
    const skillMap = {
      build: "building",
      mine: "mining",
      explore: "exploring",
      gather: "gathering",
      guard: "guard"
    };
    const skillType = skillMap[taskType] || taskType;

    if (success) {
      // Increase skill if it exists
      if (profile.skills.hasOwnProperty(skillType)) {
        profile.skills[skillType] += SKILL_INCREMENT;
      } else {
        console.warn(`⚠️  Unknown skill type: ${skillType}, adding it`);
        profile.skills[skillType] = 1 + SKILL_INCREMENT;
      }

      profile.xp += XP_PER_TASK;
      profile.tasksCompleted += 1;

      // Clamp motivation between 0 and 1
      profile.personality.motivation = Math.min(
        1,
        profile.personality.motivation + MOTIVATION_CHANGE
      );
    } else {
      profile.tasksFailed += 1;
      profile.personality.motivation = Math.max(
        0,
        profile.personality.motivation - MOTIVATION_CHANGE
      );
    }

    profile.lastActivity = new Date().toISOString();
    this.saveProfiles();
    
    return profile;
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