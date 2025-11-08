// ai/npc_registry.js
// Centralized registry for NPC identities, roles, and persistent data

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import {
  applyPersonalityMetadata,
  buildPersonalityBundle,
  cloneValue,
  ensureTraitsHelper,
  serializeRegistryEntry
} from "./npc_identity.js";

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

  listActive() {
    // Return all bots that are not inactive (i.e., registered and available)
    // This includes bots with status "idle" (registered but not spawned)
    // and "active" (spawned and running)
    return this.getAll().filter(entry => {
      const status = entry.status || "idle";
      return status !== "inactive";
    });
  }

  listByStatus(status = "active") {
    if (!status) {
      return this.getAll();
    }
    return this.getAll().filter(entry => (entry.status || "idle") === status);
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
    const spawnCount = Number.isFinite(parsedCount) ? parsedCount : 0;

    const entry = {
      ...existing,
      status: options.status || "active",
      lastSpawnedAt: now,
      spawnCount: shouldIncrement ? spawnCount + 1 : spawnCount,
      lastKnownPosition: cloneValue(position)
        || cloneValue(existing.lastKnownPosition)
        || cloneValue(existing.spawnPosition),
      runtime: {
        ...(existing.runtime || {}),
        ...(options.runtime || {}),
        lastSpawnedAt: now,
        lastKnownPosition: cloneValue(position)
          || cloneValue(existing.runtime?.lastKnownPosition)
      }
    };

    this.npcs.set(id, entry);
    await this.save();
    return { ...entry };
  }

  async recordDespawn(id, options = {}) {
    if (!id) return null;
    await this.load();
    const existing = this.npcs.get(id);
    if (!existing) {
      throw new Error(`Cannot record despawn for unknown NPC id ${id}`);
    }

    const now = new Date().toISOString();
    const entry = {
      ...existing,
      status: options.status || "inactive",
      lastDespawnedAt: now,
      runtime: {
        ...(existing.runtime || {}),
        ...(options.runtime || {}),
        lastDespawnedAt: now,
        lastKnownPosition: cloneValue(options.position)
          || cloneValue(existing.lastKnownPosition)
          || cloneValue(existing.spawnPosition)
      }
    };

    this.npcs.set(id, entry);
    await this.save();
    return { ...entry };
  }

  async mergeLearningProfile(id, profile) {
    if (!id) {
      throw new Error("Cannot merge learning profile without an id");
    }
    await this.load();
    const existing = this.npcs.get(id);
    if (!existing) {
      throw new Error(`Cannot merge learning profile for unknown NPC id ${id}`);
    }

    const bundle = buildPersonalityBundle(profile.personality, this.traits);
    const existingMetadata = existing.metadata || {};
    const baseMetadata = profile.metadata || {};
    const metadata = applyPersonalityMetadata(baseMetadata, bundle);

    const entry = {
      ...existing,
      role: profile.role || existing.role,
      npcType: profile.npcType || existing.npcType,
      description: profile.description || existing.description,
      personality: profile.personality || existing.personality,
      personalitySummary: profile.personalitySummary || bundle.summary,
      personalityTraits: Array.isArray(profile.personalityTraits)
        ? [...profile.personalityTraits]
        : bundle.traits,
      appearance: cloneValue(profile.appearance)
        || cloneValue(existing.appearance),
      metadata: {
        ...cloneValue(existingMetadata),
        ...cloneValue(metadata)
      }
    };

    this.npcs.set(id, entry);
    await this.save();
    return { ...entry };
  }

  getSummary() {
    const entries = this.getAll();
    const byStatus = {};
    const byRole = {};

    for (const entry of entries) {
      const status = entry.status || "idle";
      const role = entry.role || entry.npcType || "unknown";
      byStatus[status] = (byStatus[status] || 0) + 1;
      byRole[role] = (byRole[role] || 0) + 1;
    }

    const active = byStatus.active || 0;
    const inactive = entries.length - active;

    return {
      total: entries.length,
      active,
      inactive,
      byStatus,
      byRole
    };
  }

  _generateId(base) {
    const normalized = base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!normalized) {
      return `npc_${Math.random().toString(36).slice(2, 10)}`;
    }

    let candidate = normalized;
    let index = 1;
    while (this.npcs.has(candidate)) {
      candidate = `${normalized}_${String(index++).padStart(2, "0")}`;
    }
    return candidate;
  }

  _mergeEntry(id, updates = {}) {
    const existing = this.npcs.get(id);
    if (!existing) {
      throw new Error(`Cannot merge into unknown NPC id ${id}`);
    }

    const merged = this._buildProfile({
      ...existing,
      ...updates,
      id
    }, true);

    this.npcs.set(id, merged);
    this.save();
    return { ...merged };
  }

  _buildProfile(profile = {}, preserveId = false) {
    const id = preserveId ? profile.id : profile.id || this._generateId(profile.baseName || profile.role || "npc");
    const bundle = buildPersonalityBundle(profile.personality, this.traits);
    const metadata = applyPersonalityMetadata(cloneValue(profile.metadata), bundle);

    return {
      id,
      role: profile.role || null,
      npcType: profile.npcType || profile.role || null,
      appearance: cloneValue(profile.appearance) || {},
      spawnPosition: cloneValue(profile.spawnPosition) || null,
      lastKnownPosition: cloneValue(profile.lastKnownPosition)
        || cloneValue(profile.spawnPosition)
        || null,
      metadata,
      personality: cloneValue(profile.personality) || bundle.personality,
      personalitySummary: profile.personalitySummary || bundle.summary,
      personalityTraits: Array.isArray(profile.personalityTraits)
        ? [...profile.personalityTraits]
        : bundle.traits,
      description: profile.description || null,
      status: profile.status || "idle",
      spawnCount: Number.isFinite(profile.spawnCount) ? profile.spawnCount : 0,
      lastSpawnedAt: profile.lastSpawnedAt || null,
      lastDespawnedAt: profile.lastDespawnedAt || null,
      runtime: profile.runtime ? { ...profile.runtime } : null,
      createdAt: profile.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  _normalizeEntry(entry) {
    const bundle = buildPersonalityBundle(entry.personality, this.traits);
    return {
      id: entry.id,
      role: entry.role || null,
      npcType: entry.npcType || entry.role || null,
      appearance: cloneValue(entry.appearance) || {},
      spawnPosition: cloneValue(entry.spawnPosition) || null,
      lastKnownPosition:
        cloneValue(entry.lastKnownPosition)
        || cloneValue(entry.spawnPosition)
        || null,
      metadata: applyPersonalityMetadata(cloneValue(entry.metadata), {
        personality: entry.personality || bundle.personality,
        traits: Array.isArray(entry.personalityTraits)
          ? [...entry.personalityTraits]
          : bundle.traits,
        summary: entry.personalitySummary || bundle.summary
      }),
      personality: cloneValue(entry.personality) || bundle.personality,
      personalitySummary: entry.personalitySummary || bundle.summary,
      personalityTraits: Array.isArray(entry.personalityTraits)
        ? [...entry.personalityTraits]
        : bundle.traits,
      description: entry.description || null,
      status: entry.status || "active",
      spawnCount: typeof entry.spawnCount === "number" ? entry.spawnCount : 0,
      lastSpawnedAt: entry.lastSpawnedAt || null,
      lastDespawnedAt: entry.lastDespawnedAt || null,
      runtime: entry.runtime ? { ...entry.runtime } : null,
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
