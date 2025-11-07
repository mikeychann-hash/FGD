// ai/learning_engine.js
// Persistent learning and progression system for NPCs

import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { Traits } from "./traits.js";

const SKILL_INCREMENT = 0.1;
const XP_PER_TASK = 1;
const MOTIVATION_CHANGE = 0.05;
const MAX_SKILL_LEVEL = 100;
const SAVE_DEBOUNCE_MS = 500;

const VALID_SKILLS = ["mining", "building", "gathering", "exploring", "guard"];
const ALLOWED_ROLES = ["miner", "builder", "scout", "guard"];

const SKILL_MAP = {
  build: "building",
  mine: "mining",
  explore: "exploring",
  gather: "gathering",
  guard: "guard"
};

/**
 * Persistent learning and progression system for NPCs
 * Manages NPC profiles, skills, experience, and personality traits
 */
export class LearningEngine {
  /**
   * Creates a new LearningEngine instance
   * @param {string} filePath - Path to the NPC profiles JSON file
   */
  constructor(filePath = "./data/npc_profiles.json") {
    this.path = filePath;
    this.traits = new Traits();
    this.profiles = {};
    this.saveQueue = null;
    this.initialized = false;
  }

  /**
   * Initializes the learning engine by loading existing profiles
   * Must be called after construction before using other methods
   * @returns {Promise<void>}
   * @throws {Error} If profiles cannot be loaded
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      await this.loadProfiles();
      this.initialized = true;
    } catch (err) {
      console.error("❌ Error initializing learning engine:", err.message);
      throw new Error(`Failed to initialize learning engine: ${err.message}`);
    }
  }

  /**
   * Loads NPC profiles from disk
   * @private
   * @returns {Promise<void>}
   */
  async loadProfiles() {
    try {
      // Check if file exists using async method
      await fs.access(this.path);
      const data = await fs.readFile(this.path, "utf-8");

      try {
        this.profiles = JSON.parse(data);
        Object.entries(this.profiles).forEach(([npcId, profile]) => {
          if (!profile || typeof profile !== "object") {
            return;
          }
          profile.role = this.normalizeRole(profile.role, npcId);
        });
        console.log(`📚 Loaded ${Object.keys(this.profiles).length} NPC profiles`);
      } catch (parseErr) {
        console.error("❌ Error parsing profiles JSON, backing up corrupt file");
        // Backup corrupt file
        const backupPath = `${this.path}.corrupt.${Date.now()}`;
        try {
          await fs.copyFile(this.path, backupPath);
          console.log(`💾 Corrupt file backed up to ${backupPath}`);
        } catch (backupErr) {
          console.error("❌ Could not backup corrupt file:", backupErr.message);
        }
        this.profiles = {};
        // Save empty profiles to fix the file
        await this.forceSave();
      }
    } catch (err) {
      if (err.code === "ENOENT") {
        this.profiles = {};
        console.log("📝 Starting with empty profile database");
      } else {
        console.error("❌ Error loading profiles:", err.message);
        throw err;
      }
    }
  }

  /**
   * Saves profiles to disk with debouncing to prevent excessive I/O
   * @returns {Promise<void>}
   */
  async saveProfiles() {
    // Debounce saves to prevent excessive I/O
    if (this.saveQueue) {
      clearTimeout(this.saveQueue);
    }

    return new Promise((resolve, reject) => {
      this.saveQueue = setTimeout(async () => {
        try {
          await this.forceSave();
          resolve();
        } catch (err) {
          reject(err);
        }
      }, SAVE_DEBOUNCE_MS);
    });
  }

  /**
   * Forces an immediate save without debouncing
   * @private
   * @returns {Promise<void>}
   * @throws {Error} If save operation fails
   */
  async forceSave() {
    try {
      const dir = path.dirname(this.path);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        this.path,
        JSON.stringify(this.profiles, null, 2),
        "utf-8"
      );
      console.log("💾 Profiles saved successfully");
    } catch (err) {
      console.error("❌ Error saving profiles:", err.message);
      throw new Error(`Failed to save profiles: ${err.message}`);
    }
  }

  /**
   * Validates an NPC name
   * @private
   * @param {string} npcName - The name to validate
   * @throws {TypeError} If name is invalid
   */
  validateNpcName(npcName) {
    if (!npcName || typeof npcName !== "string" || npcName.trim() === "") {
      throw new TypeError("npcName must be a non-empty string");
    }
  }

  /**
   * Validates a skill type
   * @private
   * @param {string} skillType - The skill type to validate
   * @returns {string} The validated skill type
   * @throws {TypeError} If skill type is invalid
   */
  validateSkillType(skillType) {
    if (!skillType || typeof skillType !== "string") {
      throw new TypeError("skillType must be a non-empty string");
    }

    const normalizedSkill = SKILL_MAP[skillType] || skillType;

    if (!VALID_SKILLS.includes(normalizedSkill)) {
      throw new TypeError(
        `Invalid skill type: ${skillType}. Valid skills: ${VALID_SKILLS.join(", ")}`
      );
    }

    return normalizedSkill;
  }

  /**
   * Ensures a profile exists for the given NPC, creating one if necessary
   * @param {string} npcName - The name of the NPC
   * @returns {Object} The NPC profile
   * @throws {TypeError} If npcName is invalid
   */
  ensureProfile(npcName) {
    this.validateNpcName(npcName);

    if (!this.profiles[npcName]) {
      this.profiles[npcName] = {
        role: this.normalizeRole("builder", npcName),
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

  /**
   * Records a task completion or failure for an NPC
   * Updates skills, XP, motivation, and task counters
   * @param {string} npcName - The name of the NPC
   * @param {string} taskType - The type of task (build, mine, explore, gather, guard)
   * @param {boolean} success - Whether the task was successful
   * @returns {Promise<Object>} The updated profile
   * @throws {TypeError} If parameters are invalid
   * @throws {Error} If save fails
   */
  async recordTask(npcName, taskType, success = true) {
    this.validateNpcName(npcName);

    if (typeof success !== "boolean") {
      throw new TypeError("success must be a boolean");
    }

    const profile = this.ensureProfile(npcName);

    // Validate and normalize skill type
    const skillType = this.validateSkillType(taskType);

    if (success) {
      // Increase skill with maximum cap
      if (profile.skills.hasOwnProperty(skillType)) {
        profile.skills[skillType] = Math.min(
          MAX_SKILL_LEVEL,
          profile.skills[skillType] + SKILL_INCREMENT
        );
      } else {
        // Initialize skill if somehow missing
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

    try {
      await this.saveProfiles();
    } catch (err) {
      console.error("⚠️  Failed to save profile after recording task:", err.message);
      throw err;
    }

    return profile;
  }

  /**
   * Retrieves an NPC profile, creating one if it doesn't exist
   * @param {string} npcName - The name of the NPC
   * @returns {Object} The NPC profile
   * @throws {TypeError} If npcName is invalid
   */
  getProfile(npcName) {
    this.validateNpcName(npcName);
    return this.ensureProfile(npcName);
  }

  /**
   * Gets or creates an NPC profile with a specific role
   * @param {string} npcName - The name of the NPC
   * @param {string} role - The role for the NPC (miner, builder, scout, guard)
   * @returns {Object} The NPC profile
   * @throws {TypeError} If npcName or role is invalid
   */
  getOrCreateProfile(npcName, role) {
    this.validateNpcName(npcName);

    if (!this.profiles[npcName]) {
      const normalizedRole = this.normalizeRole(role, npcName);
      this.profiles[npcName] = {
        role: normalizedRole,
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
      console.log(`✨ Created new profile for ${npcName} with role ${normalizedRole}`);
    }
    return this.profiles[npcName];
  }

  /**
   * Returns a deep copy of all profiles
   * @returns {Object} Deep copy of all NPC profiles
   */
  getAllProfiles() {
    return JSON.parse(JSON.stringify(this.profiles));
  }

  /**
   * Gets a leaderboard sorted by XP or specific skill
   * @param {string|null} skillType - Optional skill type to sort by
   * @returns {Array<Object>} Sorted array of NPC stats
   * @throws {TypeError} If skillType is invalid
   */
  getLeaderboard(skillType = null) {
    if (skillType !== null) {
      const normalizedSkill = this.validateSkillType(skillType);

      const npcs = Object.entries(this.profiles).map(([name, profile]) => ({
        name,
        xp: profile.xp,
        tasksCompleted: profile.tasksCompleted,
        skill: profile.skills[normalizedSkill] || 0
      }));

      return npcs.sort((a, b) => b.skill - a.skill);
    }

    const npcs = Object.entries(this.profiles).map(([name, profile]) => ({
      name,
      xp: profile.xp,
      tasksCompleted: profile.tasksCompleted
    }));

    return npcs.sort((a, b) => b.xp - a.xp);
  }

  normalizeRole(role, npcId = "") {
    if (!role || typeof role !== "string" || role.trim().length === 0) {
      throw new Error(
        `Invalid role${npcId ? ` for ${npcId}` : ""}: role must be one of ${ALLOWED_ROLES.join(", ")}`
      );
    }

    const normalized = role.trim().toLowerCase();
    if (!ALLOWED_ROLES.includes(normalized)) {
      throw new Error(
        `Invalid role${npcId ? ` for ${npcId}` : ""}: ${role}. Valid roles: ${ALLOWED_ROLES.join(", ")}`
      );
    }

    return normalized;
  }

  /**
   * Deletes an NPC profile
   * @param {string} npcName - The name of the NPC to delete
   * @returns {Promise<boolean>} True if deleted, false if profile didn't exist
   * @throws {TypeError} If npcName is invalid
   * @throws {Error} If save fails
   */
  async deleteProfile(npcName) {
    this.validateNpcName(npcName);

    if (this.profiles[npcName]) {
      delete this.profiles[npcName];

      try {
        await this.saveProfiles();
      } catch (err) {
        console.error("⚠️  Failed to save after deleting profile:", err.message);
        throw err;
      }

      console.log(`🗑️  Deleted profile for ${npcName}`);
      return true;
    }
    return false;
  }

  /**
   * Cleans up resources and forces a final save
   * Should be called before the application exits
   * @returns {Promise<void>}
   */
  async destroy() {
    if (this.saveQueue) {
      clearTimeout(this.saveQueue);
      this.saveQueue = null;
    }

    try {
      await this.forceSave();
      console.log("✅ Learning engine shutdown complete");
    } catch (err) {
      console.error("❌ Error during shutdown:", err.message);
      throw err;
    }
  }
}
