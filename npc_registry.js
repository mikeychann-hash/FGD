// ai/npc_registry.js
// Centralized registry for NPC identities, roles, and persistent data

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";

import {
  applyPersonalityMetadata,
  buildPersonalityBundle,
  cloneValue,
  ensureTraitsHelper,
  serializeRegistryEntry
} from "./npc_identity.js";

const VALID_ROLES = [
  "miner",
  "builder",
  "scout",
  "explorer",
  "farmer",
  "gatherer",
  "guard",
  "fighter",
  "crafter",
  "support",
  "worker"
];

/**
 * NPC Registry - Manages NPC identities, spawning, and persistence
 * Links NPCs with their learning profiles and tracks their lifecycle
 *
 * NOTE: This implementation is currently disabled due to conflicts.
 * The active implementation is below (previously from npc_identity.js)
 */
class NPCRegistryOld {
  /**
   * Creates a new NPCRegistry instance
   * @param {Object} options - Configuration options
   * @param {string} options.registryPath - Path to the registry JSON file
   * @param {Object} options.learningEngine - Reference to LearningEngine for personality integration
   */
  constructor(options = {}) {
    this.registryPath = options.registryPath || "./data/npc_registry.json";
    this.learningEngine = options.learningEngine || null;
    this.npcs = new Map(); // npcId -> { id, name, role, personality, spawned, etc. }
    this.nameIndex = new Map(); // name -> npcId
    this.roleIndex = new Map(); // role -> Set<npcId>
    this.initialized = false;

    // Initialize role index
    VALID_ROLES.forEach(role => {
      this.roleIndex.set(role, new Set());
    });
  }

  /**
   * Initializes the registry by loading existing data
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      await this.loadRegistry();
      this.initialized = true;
      console.log(`📋 NPC Registry initialized with ${this.npcs.size} NPCs`);
    } catch (err) {
      console.error("❌ Error initializing NPC registry:", err.message);
      throw new Error(`Failed to initialize NPC registry: ${err.message}`);
    }
  }

  /**
   * Loads the registry from disk
   * @private
   * @returns {Promise<void>}
   */
  async loadRegistry() {
    try {
      await fs.access(this.registryPath);
      const data = await fs.readFile(this.registryPath, "utf-8");

      try {
        const registryData = JSON.parse(data);
        const npcs = registryData.npcs || [];

        npcs.forEach(npc => {
          this.npcs.set(npc.id, npc);
          this.nameIndex.set(npc.name.toLowerCase(), npc.id);

          if (this.roleIndex.has(npc.role)) {
            this.roleIndex.get(npc.role).add(npc.id);
          }
        });

        console.log(`📚 Loaded ${this.npcs.size} NPCs from registry`);
      } catch (parseErr) {
        console.error("❌ Error parsing registry JSON, backing up corrupt file");
        const backupPath = `${this.registryPath}.corrupt.${Date.now()}`;
        await fs.copyFile(this.registryPath, backupPath);
        console.log(`💾 Corrupt file backed up to ${backupPath}`);
        this.npcs.clear();
        await this.saveRegistry();
      }
    } catch (err) {
      if (err.code === "ENOENT") {
        console.log("📝 Starting with empty NPC registry");
        this.npcs.clear();
      } else {
        throw err;
      }
    }
  }

  /**
   * Saves the registry to disk
   * @returns {Promise<void>}
   */
  async saveRegistry() {
    try {
      const dir = path.dirname(this.registryPath);
      await fs.mkdir(dir, { recursive: true });

      const registryData = {
        version: "1.0.0",
        lastUpdated: new Date().toISOString(),
        npcs: Array.from(this.npcs.values())
      };

      await fs.writeFile(
        this.registryPath,
        JSON.stringify(registryData, null, 2),
        "utf-8"
      );
      console.log("💾 NPC registry saved successfully");
    } catch (err) {
      console.error("❌ Error saving registry:", err.message);
      throw new Error(`Failed to save registry: ${err.message}`);
    }
  }

  /**
   * Creates a new NPC with a unique identity and personality
   * @param {Object} options - NPC creation options
   * @param {string} options.name - Display name for the NPC
   * @param {string} options.role - NPC role (miner, builder, scout, etc.)
   * @param {Object} options.appearance - Optional appearance customization
   * @param {Object} options.position - Optional spawn position {x, y, z}
   * @param {Object} options.metadata - Optional additional metadata
   * @returns {Promise<Object>} The created NPC object
   */
  async createNPC(options = {}) {
    const { name, role, appearance = {}, position = null, metadata = {} } = options;

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim() === "") {
      throw new TypeError("NPC name is required and must be a non-empty string");
    }

    if (!role || !VALID_ROLES.includes(role)) {
      throw new TypeError(
        `Invalid role: ${role}. Valid roles: ${VALID_ROLES.join(", ")}`
      );
    }

    // Check for duplicate names
    const normalizedName = name.toLowerCase();
    if (this.nameIndex.has(normalizedName)) {
      throw new Error(`NPC with name "${name}" already exists`);
    }

    // Generate unique ID
    const id = `${role}_${randomUUID().split("-")[0]}`;

    // Get or create personality profile from learning engine
    let personality = null;
    let profile = null;
    if (this.learningEngine) {
      profile = this.learningEngine.getProfile(name);
      personality = profile.personality;
      console.log(
        `🧠 Generated personality for ${name}: curiosity=${personality.curiosity.toFixed(2)}, ` +
        `motivation=${personality.motivation.toFixed(2)}, patience=${personality.patience.toFixed(2)}`
      );
    }

    // Create NPC object
    const npc = {
      id,
      name,
      role,
      personality,
      appearance: {
        skin: appearance.skin || "default",
        model: appearance.model || "minecraft:villager",
        ...appearance
      },
      spawned: false,
      spawnedAt: null,
      position: position || null,
      metadata: {
        createdAt: new Date().toISOString(),
        ...metadata
      },
      stats: {
        tasksCompleted: profile?.tasksCompleted || 0,
        tasksFailed: profile?.tasksFailed || 0,
        xp: profile?.xp || 0
      }
    };

    // Add to registry
    this.npcs.set(id, npc);
    this.nameIndex.set(normalizedName, id);
    this.roleIndex.get(role).add(id);

    // Save to disk
    await this.saveRegistry();

    console.log(`✨ Created new NPC: ${name} (${role}) with ID ${id}`);
    return npc;
  }

  /**
   * Marks an NPC as spawned in the world
   * @param {string} npcId - The NPC ID or name
   * @param {Object} spawnInfo - Spawn information (position, timestamp, etc.)
   * @returns {Promise<Object>} The updated NPC object
   */
  async markSpawned(npcId, spawnInfo = {}) {
    const npc = this.getNPC(npcId);
    if (!npc) {
      throw new Error(`NPC not found: ${npcId}`);
    }

    npc.spawned = true;
    npc.spawnedAt = new Date().toISOString();
    if (spawnInfo.position) {
      npc.position = spawnInfo.position;
    }
    if (spawnInfo.entityId) {
      npc.entityId = spawnInfo.entityId;
    }

    await this.saveRegistry();
    console.log(`🌱 Marked ${npc.name} as spawned`);
    return npc;
  }

  /**
   * Marks an NPC as despawned
   * @param {string} npcId - The NPC ID or name
   * @returns {Promise<Object>} The updated NPC object
   */
  async markDespawned(npcId) {
    const npc = this.getNPC(npcId);
    if (!npc) {
      throw new Error(`NPC not found: ${npcId}`);
    }

    npc.spawned = false;
    npc.spawnedAt = null;

    await this.saveRegistry();
    console.log(`👋 Marked ${npc.name} as despawned`);
    return npc;
  }

  /**
   * Gets an NPC by ID or name
   * @param {string} npcIdOrName - The NPC ID or name
   * @returns {Object|null} The NPC object or null if not found
   */
  getNPC(npcIdOrName) {
    if (!npcIdOrName) return null;

    // Try direct ID lookup
    if (this.npcs.has(npcIdOrName)) {
      return this.npcs.get(npcIdOrName);
    }

    // Try name lookup
    const normalized = npcIdOrName.toLowerCase();
    const id = this.nameIndex.get(normalized);
    if (id) {
      return this.npcs.get(id);
    }

    return null;
  }

  /**
   * Gets all NPCs, optionally filtered by role or spawned status
   * @param {Object} filters - Optional filters
   * @param {string} filters.role - Filter by role
   * @param {boolean} filters.spawned - Filter by spawned status
   * @returns {Array<Object>} Array of NPC objects
   */
  getNPCs(filters = {}) {
    let npcs = Array.from(this.npcs.values());

    if (filters.role) {
      npcs = npcs.filter(npc => npc.role === filters.role);
    }

    if (typeof filters.spawned === "boolean") {
      npcs = npcs.filter(npc => npc.spawned === filters.spawned);
    }

    return npcs;
  }

  /**
   * Gets NPCs by role
   * @param {string} role - The role to filter by
   * @returns {Array<Object>} Array of NPC objects
   */
  getNPCsByRole(role) {
    const ids = this.roleIndex.get(role);
    if (!ids) return [];
    return Array.from(ids).map(id => this.npcs.get(id)).filter(Boolean);
  }

  /**
   * Updates an NPC's data
   * @param {string} npcId - The NPC ID or name
   * @param {Object} updates - The updates to apply
   * @returns {Promise<Object>} The updated NPC object
   */
  async updateNPC(npcId, updates = {}) {
    const npc = this.getNPC(npcId);
    if (!npc) {
      throw new Error(`NPC not found: ${npcId}`);
    }

    // Apply updates
    Object.assign(npc, updates);
    npc.metadata.lastUpdated = new Date().toISOString();

    // Update indexes if name or role changed
    if (updates.name) {
      // Remove old name index
      const oldName = Array.from(this.nameIndex.entries())
        .find(([, id]) => id === npc.id)?.[0];
      if (oldName) {
        this.nameIndex.delete(oldName);
      }
      // Add new name index
      this.nameIndex.set(updates.name.toLowerCase(), npc.id);
    }

    if (updates.role && VALID_ROLES.includes(updates.role)) {
      // Update role index
      this.roleIndex.forEach(set => set.delete(npc.id));
      this.roleIndex.get(updates.role).add(npc.id);
    }

    await this.saveRegistry();
    return npc;
  }

  /**
   * Deletes an NPC from the registry
   * @param {string} npcId - The NPC ID or name
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteNPC(npcId) {
    const npc = this.getNPC(npcId);
    if (!npc) {
      return false;
    }

    // Remove from indexes
    this.npcs.delete(npc.id);
    this.nameIndex.delete(npc.name.toLowerCase());
    this.roleIndex.forEach(set => set.delete(npc.id));

    await this.saveRegistry();
    console.log(`🗑️  Deleted NPC: ${npc.name} (${npc.id})`);
    return true;
  }

  /**
   * Syncs NPC stats from the learning engine
   * @param {string} npcId - The NPC ID or name
   * @returns {Promise<Object>} The updated NPC object
   */
  async syncStats(npcId) {
    const npc = this.getNPC(npcId);
    if (!npc) {
      throw new Error(`NPC not found: ${npcId}`);
    }

    if (!this.learningEngine) {
      console.warn("⚠️  No learning engine available for stats sync");
      return npc;
    }

    const profile = this.learningEngine.getProfile(npc.name);
    npc.stats = {
      tasksCompleted: profile.tasksCompleted,
      tasksFailed: profile.tasksFailed,
      xp: profile.xp
    };
    npc.personality = profile.personality;

    await this.saveRegistry();
    return npc;
  }

  /**
   * Gets a summary of the registry
   * @returns {Object} Registry statistics
   */
  getSummary() {
    const byRole = {};
    VALID_ROLES.forEach(role => {
      const count = this.roleIndex.get(role)?.size || 0;
      if (count > 0) {
        byRole[role] = count;
      }
    });

    return {
      total: this.npcs.size,
      spawned: Array.from(this.npcs.values()).filter(npc => npc.spawned).length,
      byRole
    };
  }

  /**
   * Generates a unique name suggestion based on role
   * @param {string} role - The role to generate a name for
   * @param {number} index - Optional index for numbered names
   * @returns {string} Suggested name
   */
  generateName(role, index = null) {
    const prefixes = {
      miner: ["Digger", "Pickaxe", "Ore", "Cave", "Stone"],
      builder: ["Architect", "Mason", "Brick", "Tower", "Builder"],
      scout: ["Scout", "Ranger", "Hawk", "Swift", "Explorer"],
      explorer: ["Wanderer", "Pathfinder", "Trek", "Quest", "Venture"],
      farmer: ["Farmer", "Harvest", "Crop", "Field", "Seed"],
      gatherer: ["Gather", "Collect", "Forage", "Berry", "Herb"],
      guard: ["Guard", "Shield", "Sentry", "Watch", "Defender"],
      fighter: ["Warrior", "Blade", "Steel", "Battle", "Knight"],
      crafter: ["Craft", "Forge", "Anvil", "Smith", "Maker"],
      support: ["Helper", "Aid", "Assist", "Support", "Medic"],
      worker: ["Worker", "Labor", "Hand", "Crew", "Guild"]
    };

    const prefix = prefixes[role]?.[Math.floor(Math.random() * prefixes[role].length)] || role;

    if (index !== null) {
      return `${prefix}_${String(index).padStart(2, "0")}`;
    }

    // Generate unique name
    let counter = 1;
    let name = `${prefix}_${String(counter).padStart(2, "0")}`;
    while (this.nameIndex.has(name.toLowerCase())) {
      counter++;
      name = `${prefix}_${String(counter).padStart(2, "0")}`;
    }

    return name;
  }

  /**
   * Cleans up resources
   * @returns {Promise<void>}
   */
  async destroy() {
    await this.saveRegistry();
    this.npcs.clear();
    this.nameIndex.clear();
    this.roleIndex.clear();
    console.log("✅ NPC Registry shutdown complete");
  }
}

// ====================================================================
// Alternative NPCRegistry implementation (from npc_identity.js)
// ====================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_REGISTRY_PATH = path.join(__dirname, "data", "npc_registry.json");

/**
 * Persistent registry for NPC identities, roles and traits.
 */
export class NPCRegistry {
  constructor(options = {}) {
    this.registryPath = options.registryPath || DEFAULT_REGISTRY_PATH;
    this.traits = ensureTraitsHelper(options.traitsGenerator);
    this.npcs = new Map();
    this.loaded = false;
    this.saveQueue = Promise.resolve();
  }

  async load() {
    if (this.loaded) {
      return this.getAll();
    }

    try {
      const data = await fs.readFile(this.registryPath, "utf8");
      const parsed = JSON.parse(data);
      const entries = Array.isArray(parsed?.npcs) ? parsed.npcs : [];
      this.npcs.clear();
      for (const entry of entries) {
        if (entry?.id) {
          this.npcs.set(entry.id, this._normalizeEntry(entry));
        }
      }
      this.loaded = true;
      return this.getAll();
    } catch (error) {
      if (error.code === "ENOENT") {
        await this.save();
        this.loaded = true;
        return this.getAll();
      }
      throw error;
    }
  }

  async save() {
    if (!this.loaded) {
      this.loaded = true;
    }
    return this._enqueueSave();
  }

  getAll() {
    return [...this.npcs.values()].map(entry => ({ ...entry }));
  }

  get(id) {
    if (!id) return null;
    const entry = this.npcs.get(id);
    return entry ? { ...entry } : null;
  }

  async ensureProfile(options = {}) {
    await this.load();

    const {
      id,
      baseName,
      role,
      npcType,
      appearance,
      personality,
      spawnPosition,
      metadata,
      description
    } = options;

    if (id && this.npcs.has(id)) {
      return this._mergeEntry(id, {
        role,
        npcType,
        appearance,
        personality,
        spawnPosition,
        metadata,
        description
      });
    }

    const generatedId = id || this._generateId(baseName || role || npcType || "NPC");
    const profile = this._buildProfile({
      id: generatedId,
      role,
      npcType,
      appearance,
      personality,
      spawnPosition,
      metadata,
      description
    });
    this.npcs.set(profile.id, profile);
    await this.save();
    return { ...profile };
  }

  async upsert(profile) {
    if (!profile?.id) {
      throw new Error("Cannot upsert NPC profile without an id");
    }
    await this.load();
    const normalized = this._buildProfile(profile, true);
    this.npcs.set(normalized.id, normalized);
    await this.save();
    return { ...normalized };
  }

  async markInactive(id) {
    if (!id) return null;
    return this.recordDespawn(id, { status: "inactive" });
  }

  async recordSpawn(id, position, options = {}) {
    if (!id) return null;
    await this.load();
    const existing = this.npcs.get(id);
    if (!existing) {
      throw new Error(`Cannot record spawn for unknown NPC id ${id}`);
    }

    const now = new Date().toISOString();
    const shouldIncrement = options.increment !== false;
    const parsedCount = Number(existing.spawnCount);
    const baseCount = Number.isFinite(parsedCount) ? parsedCount : 0;
    const updated = {
      ...existing,
      spawnCount: Math.max(0, baseCount) + (shouldIncrement ? 1 : 0),
      lastSpawnedAt: shouldIncrement ? now : existing.lastSpawnedAt || null,
      lastKnownPosition: cloneValue(position)
        || cloneValue(existing.lastKnownPosition)
        || cloneValue(existing.spawnPosition)
        || null,
      status: options.status || "active",
      updatedAt: now
    };

    this.npcs.set(id, updated);
    await this.save();
    return { ...updated };
  }

  async recordDespawn(id, options = {}) {
    if (!id) return null;
    await this.load();
    const existing = this.npcs.get(id);
    if (!existing) {
      return null;
    }

    const now = new Date().toISOString();
    const updated = {
      ...existing,
      status: options.status || "inactive",
      lastDespawnedAt: now,
      lastKnownPosition: cloneValue(options.position)
        || cloneValue(existing.lastKnownPosition)
        || cloneValue(existing.spawnPosition)
        || null,
      updatedAt: now
    };

    this.npcs.set(id, updated);
    await this.save();
    return { ...updated };
  }

  listActive() {
    return this.getAll().filter(entry => entry.status !== "inactive");
  }

  _generateId(baseName) {
    const sanitized = String(baseName || "NPC")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_{2,}/g, "_")
      .toLowerCase();

    const prefix = sanitized.length > 0 ? sanitized : "npc";
    let counter = 1;
    let candidate;
    do {
      const suffix = counter < 10 ? `0${counter}` : String(counter);
      candidate = `${prefix}_${suffix}`;
      counter++;
    } while (this.npcs.has(candidate));
    return candidate;
  }

  _buildProfile(profile, allowMissingId = false) {
    if (!allowMissingId && !profile?.id) {
      throw new Error("NPC profile must include an id");
    }

    const id = profile.id || this._generateId(profile.baseName || profile.role || profile.npcType);
    const npcType = profile.npcType || profile.type || "builder";
    const role = profile.role || npcType;

    const bundle = buildPersonalityBundle(profile.personality, this.traits);
    const existingMetadata = this.npcs.get(id)?.metadata;
    const baseMetadata =
      profile.metadata != null
        ? cloneValue(profile.metadata)
        : existingMetadata != null
          ? cloneValue(existingMetadata)
          : {};
    const metadata = applyPersonalityMetadata(baseMetadata, bundle);

    const now = new Date().toISOString();
    const existing = this.npcs.get(id);

    return {
      id,
      npcType,
      role,
      appearance: cloneValue(profile.appearance)
        || (existing ? cloneValue(existing.appearance) : {}),
      spawnPosition: cloneValue(profile.spawnPosition)
        || (existing ? cloneValue(existing.spawnPosition) : null),
      lastKnownPosition: cloneValue(profile.lastKnownPosition)
        || (existing ? cloneValue(existing.lastKnownPosition) : null),
      personality: bundle.personality,
      personalitySummary: bundle.summary,
      personalityTraits: bundle.traits,
      metadata,
      description: profile.description || existing?.description || null,
      status: profile.status || existing?.status || "active",
      spawnCount: typeof profile.spawnCount === "number"
        ? profile.spawnCount
        : typeof existing?.spawnCount === "number"
          ? existing.spawnCount
          : 0,
      lastSpawnedAt: profile.lastSpawnedAt || existing?.lastSpawnedAt || null,
      lastDespawnedAt: profile.lastDespawnedAt || existing?.lastDespawnedAt || null,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
  }

  _mergeEntry(id, updates) {
    const existing = this.npcs.get(id);
    if (!existing) {
      throw new Error(`Cannot merge NPC profile for unknown id ${id}`);
    }
    const merged = {
      ...existing,
      ...this._buildProfile({
        id,
        npcType: updates.npcType || existing.npcType,
        role: updates.role || existing.role,
        appearance: updates.appearance || existing.appearance,
        spawnPosition: updates.spawnPosition || existing.spawnPosition,
        personality: updates.personality || existing.personality,
        metadata: updates.metadata || existing.metadata,
        description: updates.description || existing.description,
        spawnCount: typeof updates.spawnCount === "number" ? updates.spawnCount : existing.spawnCount,
        lastSpawnedAt: updates.lastSpawnedAt || existing.lastSpawnedAt,
        lastDespawnedAt: updates.lastDespawnedAt || existing.lastDespawnedAt,
        lastKnownPosition: updates.lastKnownPosition || existing.lastKnownPosition,
        status: existing.status
      }, true)
    };
    this.npcs.set(id, merged);
    this.save().catch(err => {
      console.error(`❌ Failed to save NPC registry for ${id}:`, err.message);
    });
    return { ...merged };
  }

  _normalizeEntry(entry) {
    const bundle = buildPersonalityBundle(entry.personality, this.traits);

    return {
      id: entry.id,
      npcType: entry.npcType || entry.type || "builder",
      role: entry.role || entry.npcType || entry.type || "builder",
      appearance: cloneValue(entry.appearance) || {},
      spawnPosition: cloneValue(entry.spawnPosition) || null,
      lastKnownPosition:
        cloneValue(entry.lastKnownPosition)
        || cloneValue(entry.spawnPosition)
        || null,
      personality: bundle.personality,
      personalitySummary:
        typeof entry.personalitySummary === "string"
          ? entry.personalitySummary
          : bundle.summary,
      personalityTraits: Array.isArray(entry.personalityTraits)
        ? [...entry.personalityTraits]
        : bundle.traits,
      metadata: applyPersonalityMetadata(cloneValue(entry.metadata), {
        summary:
          typeof entry.personalitySummary === "string"
            ? entry.personalitySummary
            : bundle.summary,
        traits: Array.isArray(entry.personalityTraits)
          ? [...entry.personalityTraits]
          : bundle.traits
      }),
      description: entry.description || null,
      status: entry.status || "active",
      spawnCount: typeof entry.spawnCount === "number" ? entry.spawnCount : 0,
      lastSpawnedAt: entry.lastSpawnedAt || null,
      lastDespawnedAt: entry.lastDespawnedAt || null,
      createdAt: entry.createdAt || new Date().toISOString(),
      updatedAt: entry.updatedAt || new Date().toISOString()
    };
  }

  async _enqueueSave() {
    this.loaded = true;
    const run = async () => {
      const payload = this._serialize();
      await fs.mkdir(path.dirname(this.registryPath), { recursive: true });
      const serialized = JSON.stringify(payload, null, 2);
      await fs.writeFile(this.registryPath, serialized, "utf8");
      return payload;
    };

    const scheduled = this.saveQueue.then(run);
    this.saveQueue = scheduled.catch(() => {});
    return scheduled;
  }

  _serialize() {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      npcs: [...this.npcs.values()].map(serializeRegistryEntry)
    };
  }
}
