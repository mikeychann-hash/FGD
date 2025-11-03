// core/progression_engine.js
// Central controller for sustainable world progression through defined phases (1-6)
// Manages objectives, required resources, recommended tasks, and unlock conditions

import EventEmitter from "events";

/**
 * Phase definitions based on Minecraft Sustainable Progression system
 */
const PHASE_DEFINITIONS = {
  1: {
    name: "Survival & Basics",
    objective: "Learn core survival mechanics and set up a functional base",
    description: "Establish basic survival infrastructure, gather initial resources, and build shelter",
    timeRange: "0-5 hours",
    milestones: [
      "Stone → Iron tool progression",
      "Basic food farm (wheat, chickens, cows, or pigs)",
      "Torch-lit shelter with bed and storage"
    ],
    recommendedTasks: [
      "plan_mine",
      "plan_build",
      "plan_gather",
      "plan_craft"
    ],
    completionMetrics: {
      food: 50,
      shelters: 1,
      ironTools: 1
    }
  },
  2: {
    name: "Resource Expansion & Early Automation",
    objective: "Scale up food and material production to save time for exploration",
    description: "Build automatic farms and resource collection systems",
    timeRange: "5-12 hours",
    milestones: [
      "Full iron gear",
      "First XP or mob farm",
      "Organized base layout and compact storage"
    ],
    recommendedTasks: [
      "plan_build",
      "plan_craft",
      "plan_redstone",
      "plan_gather"
    ],
    recommendedBuilds: [
      { type: "auto_smelter", benefit: "Continuous fuel and smelting" },
      { type: "animal_farm", benefit: "Meat + leather" },
      { type: "sugarcane_farm", benefit: "Books and trading" },
      { type: "iron_farm", benefit: "Tools and armor supply" },
      { type: "xp_farm", benefit: "Repair gear and enchanting" }
    ],
    completionMetrics: {
      automations: 3,
      ironArmor: 1,
      storage: 5
    }
  },
  3: {
    name: "Infrastructure & Mega Base Foundations",
    objective: "Build the first major base and interconnect systems",
    description: "Create a central hub with villager trading and enchanting capabilities",
    timeRange: "12-20 hours",
    milestones: [
      "Diamond tools and basic enchantments",
      "Nether portal prep zone created",
      "Food and gear sustainability achieved"
    ],
    recommendedTasks: [
      "plan_build",
      "plan_trade",
      "plan_craft",
      "plan_explore"
    ],
    recommendedBuilds: [
      { type: "central_hub", benefit: "Storage + access to farms" },
      { type: "villager_hall", benefit: "Trading for enchanted books" },
      { type: "enchanting_tower", benefit: "Connected to XP source" },
      { type: "animal_barn", benefit: "Renewable food" }
    ],
    completionMetrics: {
      villagers: 5,
      diamondTools: 1,
      netherPortal: 1
    }
  },
  4: {
    name: "Nether Expansion & Mid-Game Power",
    objective: "Enter the Nether, gather Blaze Rods, and begin potion production",
    description: "Establish Nether infrastructure and resource gathering systems",
    timeRange: "20-30 hours",
    milestones: [
      "Blaze Rods and Pearls collected",
      "Brewing system automated",
      "Overworld-Nether travel established"
    ],
    recommendedTasks: [
      "plan_explore",
      "plan_combat",
      "plan_build",
      "plan_craft"
    ],
    recommendedBuilds: [
      { type: "gold_farm", benefit: "Bartering currency" },
      { type: "potion_lab", benefit: "Fire resistance, strength, healing" },
      { type: "nether_hub", benefit: "Travel and mining access" }
    ],
    completionMetrics: {
      netherAccess: true,
      blazeRods: 10,
      enderPearls: 12,
      potions: 5
    }
  },
  5: {
    name: "Stronghold Discovery & End Prep",
    objective: "Locate and activate the End Portal safely",
    description: "Prepare max-level gear and supplies for the Dragon battle",
    timeRange: "30-40 hours",
    milestones: [
      "Max enchanted gear and potions",
      "Spawn and respawn setup near stronghold",
      "Fully stocked for the Dragon battle"
    ],
    recommendedTasks: [
      "plan_explore",
      "plan_craft",
      "plan_enchant",
      "plan_gather"
    ],
    completionMetrics: {
      portalReady: true,
      maxEnchantedGear: 1,
      enderPearls: 12,
      potions: 10
    }
  },
  6: {
    name: "The End & Post-Victory Expansion",
    objective: "Defeat the Ender Dragon and begin the late-game empire",
    description: "Explore End Cities, collect Elytra, and build advanced automation",
    timeRange: "40-50+ hours",
    milestones: [
      "Ender Dragon defeated",
      "End City raids for Elytra and Shulker boxes",
      "Mega base expansion with full automation"
    ],
    recommendedTasks: [
      "plan_combat",
      "plan_explore",
      "plan_build",
      "plan_redstone"
    ],
    recommendedBuilds: [
      { type: "end_city_raids", benefit: "Elytra wings + shulker boxes" },
      { type: "mega_base", benefit: "Large-scale empire design" },
      { type: "advanced_farms", benefit: "Wither skeleton, gold XP, raid farms" },
      { type: "redstone_empire", benefit: "Full automation and transport systems" }
    ],
    completionMetrics: {
      dragonDefeated: true,
      elytra: 1,
      shulkerBoxes: 5,
      advancedFarms: 3
    }
  }
};

/**
 * ProgressionEngine - Manages sustainable world progression through defined phases
 * Tracks objectives, monitors completion metrics, and schedules phase-appropriate tasks
 */
export class ProgressionEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.currentPhase = options.startPhase || 1;
    this.maxPhase = 6;
    this.progressData = {
      // Phase 1 metrics
      food: 0,
      shelters: 0,
      ironTools: 0,

      // Phase 2 metrics
      automations: 0,
      ironArmor: 0,
      storage: 0,

      // Phase 3 metrics
      villagers: 0,
      diamondTools: 0,
      netherPortal: 0,

      // Phase 4 metrics
      netherAccess: false,
      blazeRods: 0,
      enderPearls: 0,
      potions: 0,

      // Phase 5 metrics
      portalReady: false,
      maxEnchantedGear: 0,

      // Phase 6 metrics
      dragonDefeated: false,
      elytra: 0,
      shulkerBoxes: 0,
      advancedFarms: 0
    };
    this.phaseHistory = [];
    this.phaseStartedAt = Date.now();
    this.isInitialized = false;
  }

  /**
   * Initialize the progression engine
   * @returns {Promise<ProgressionEngine>} this instance for chaining
   */
  async init() {
    if (this.isInitialized) {
      console.warn("⚠️  Progression engine already initialized");
      return this;
    }

    console.log("🌍 [ProgressionEngine] Initialized");
    await this.loadPhase(this.currentPhase);
    this.isInitialized = true;
    return this;
  }

  /**
   * Load a specific phase and emit phase changed event
   * @param {number} phaseNumber - Phase number (1-6)
   * @returns {Promise<void>}
   */
  async loadPhase(phaseNumber) {
    if (phaseNumber < 1 || phaseNumber > this.maxPhase) {
      console.warn(`⚠️  Invalid phase number: ${phaseNumber}. Clamping to valid range.`);
      phaseNumber = Math.max(1, Math.min(this.maxPhase, phaseNumber));
    }

    const previousPhase = this.currentPhase;
    this.currentPhase = phaseNumber;
    const guide = this.getPhaseGuide(phaseNumber);

    // Record phase change in history
    const phaseChangeRecord = {
      phase: phaseNumber,
      startedAt: new Date().toISOString(),
      previousPhase,
      duration: previousPhase ? Date.now() - this.phaseStartedAt : 0
    };
    this.phaseHistory.push(phaseChangeRecord);
    this.phaseStartedAt = Date.now();

    // Emit phase changed event with full guide data
    this.emit("phaseChanged", {
      phase: phaseNumber,
      previousPhase,
      guide,
      progressData: { ...this.progressData },
      history: [...this.phaseHistory]
    });

    console.log(`🧭 Entered Phase ${phaseNumber}: ${guide.name}`);
    console.log(`   Objective: ${guide.objective}`);
    console.log(`   Recommended Tasks: ${guide.recommendedTasks.join(", ")}`);
  }

  /**
   * Get phase guide data for a specific phase
   * @param {number} phase - Phase number (1-6)
   * @returns {object} Phase guide data
   */
  getPhaseGuide(phase) {
    return PHASE_DEFINITIONS[phase] || PHASE_DEFINITIONS[this.maxPhase];
  }

  /**
   * Get current phase information
   * @returns {object} Current phase data
   */
  getCurrentPhase() {
    return {
      phase: this.currentPhase,
      guide: this.getPhaseGuide(this.currentPhase),
      progress: { ...this.progressData },
      startedAt: new Date(this.phaseStartedAt).toISOString(),
      duration: Date.now() - this.phaseStartedAt
    };
  }

  /**
   * Update federation state with new metrics and check for phase completion
   * @param {object} metrics - Updated metrics object
   * @returns {Promise<boolean>} true if phase advanced, false otherwise
   */
  async updateFederationState(metrics) {
    // Merge new metrics into progress data
    Object.assign(this.progressData, metrics);

    // Emit progress update event
    this.emit("progressUpdate", {
      phase: this.currentPhase,
      progress: { ...this.progressData },
      metrics
    });

    // Check if current phase is complete
    if (this.#checkPhaseCompletion(this.progressData)) {
      const nextPhase = Math.min(this.currentPhase + 1, this.maxPhase);
      if (nextPhase > this.currentPhase) {
        console.log(`✅ Phase ${this.currentPhase} completed!`);
        await this.loadPhase(nextPhase);
        return true;
      }
    }

    return false;
  }

  /**
   * Update a specific metric
   * @param {string} metric - Metric name
   * @param {any} value - New value
   */
  updateMetric(metric, value) {
    if (metric in this.progressData) {
      this.progressData[metric] = value;
      this.emit("metricUpdate", { metric, value, phase: this.currentPhase });
    }
  }

  /**
   * Increment a numeric metric
   * @param {string} metric - Metric name
   * @param {number} amount - Amount to increment (default: 1)
   */
  incrementMetric(metric, amount = 1) {
    if (metric in this.progressData && typeof this.progressData[metric] === "number") {
      this.progressData[metric] += amount;
      this.emit("metricUpdate", {
        metric,
        value: this.progressData[metric],
        phase: this.currentPhase,
        increment: amount
      });
    }
  }

  /**
   * Check if current phase completion criteria are met
   * @param {object} metrics - Current progress metrics
   * @returns {boolean} true if phase is complete
   * @private
   */
  #checkPhaseCompletion(metrics) {
    const guide = this.getPhaseGuide(this.currentPhase);
    if (!guide.completionMetrics) return false;

    // Check if all completion metrics are satisfied
    for (const [key, requiredValue] of Object.entries(guide.completionMetrics)) {
      const currentValue = metrics[key];

      if (typeof requiredValue === "boolean") {
        if (currentValue !== requiredValue) return false;
      } else if (typeof requiredValue === "number") {
        if (currentValue < requiredValue) return false;
      }
    }

    return true;
  }

  /**
   * Get recommended tasks for the current phase
   * @returns {Array<string>} List of recommended task names
   */
  getRecommendedTasks() {
    const guide = this.getPhaseGuide(this.currentPhase);
    return guide.recommendedTasks || [];
  }

  /**
   * Get recommended builds for the current phase
   * @returns {Array<object>} List of recommended builds
   */
  getRecommendedBuilds() {
    const guide = this.getPhaseGuide(this.currentPhase);
    return guide.recommendedBuilds || [];
  }

  /**
   * Check if a specific task is appropriate for the current phase
   * @param {string} taskName - Task name to check
   * @returns {boolean} true if task is recommended for current phase
   */
  isTaskAppropriate(taskName) {
    const recommended = this.getRecommendedTasks();
    return recommended.includes(taskName);
  }

  /**
   * Get phase completion percentage
   * @returns {number} Completion percentage (0-100)
   */
  getPhaseCompletionPercentage() {
    const guide = this.getPhaseGuide(this.currentPhase);
    if (!guide.completionMetrics) return 0;

    const metrics = guide.completionMetrics;
    const keys = Object.keys(metrics);
    if (keys.length === 0) return 0;

    let completedCount = 0;
    for (const key of keys) {
      const required = metrics[key];
      const current = this.progressData[key];

      if (typeof required === "boolean") {
        if (current === required) completedCount++;
      } else if (typeof required === "number") {
        if (current >= required) completedCount++;
      }
    }

    return Math.round((completedCount / keys.length) * 100);
  }

  /**
   * Get complete status of progression engine
   * @returns {object} Status including phase, progress, and history
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      currentPhase: this.currentPhase,
      phaseGuide: this.getPhaseGuide(this.currentPhase),
      progress: { ...this.progressData },
      completionPercentage: this.getPhaseCompletionPercentage(),
      phaseStartedAt: new Date(this.phaseStartedAt).toISOString(),
      phaseDuration: Date.now() - this.phaseStartedAt,
      history: [...this.phaseHistory],
      recommendedTasks: this.getRecommendedTasks(),
      recommendedBuilds: this.getRecommendedBuilds()
    };
  }

  /**
   * Manual phase advancement (for testing or admin control)
   * @param {number} targetPhase - Target phase number
   * @returns {Promise<void>}
   */
  async setPhase(targetPhase) {
    if (targetPhase < 1 || targetPhase > this.maxPhase) {
      throw new Error(`Invalid phase number: ${targetPhase}. Must be between 1 and ${this.maxPhase}`);
    }
    await this.loadPhase(targetPhase);
  }

  /**
   * Reset progression to Phase 1
   * @returns {Promise<void>}
   */
  async reset() {
    this.currentPhase = 1;
    this.progressData = {
      food: 0,
      shelters: 0,
      ironTools: 0,
      automations: 0,
      ironArmor: 0,
      storage: 0,
      villagers: 0,
      diamondTools: 0,
      netherPortal: 0,
      netherAccess: false,
      blazeRods: 0,
      enderPearls: 0,
      potions: 0,
      portalReady: false,
      maxEnchantedGear: 0,
      dragonDefeated: false,
      elytra: 0,
      shulkerBoxes: 0,
      advancedFarms: 0
    };
    this.phaseHistory = [];
    this.phaseStartedAt = Date.now();
    await this.loadPhase(1);
    console.log("🔄 Progression engine reset to Phase 1");
  }
}

// Singleton instance
export const progressionEngine = new ProgressionEngine();
