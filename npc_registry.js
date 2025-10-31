import { promises as fs } from "fs";
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
const SAVE_DEBOUNCE_MS = 300;
const ALLOWED_ROLES = ["miner", "builder", "scout", "guard"];

/**
 * Persistent registry for NPC identities, roles and traits.
 */
export class NPCRegistry {
  constructor(options = {}) {
    this.registryPath = options.registryPath || DEFAULT_REGISTRY_PATH;
    this.traits = ensureTraitsHelper(options.traitsGenerator);
    this.npcs = new Map();
    this.loaded = false;
    this.saveScheduled = null;
    this.pendingSavePromise = null;
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
    if (this.pendingSavePromise) {
      return this.pendingSavePromise;
    }

    this.pendingSavePromise = new Promise((resolve, reject) => {
      if (this.saveScheduled) {
        clearTimeout(this.saveScheduled);
      }

      this.saveScheduled = setTimeout(async () => {
        this.saveScheduled = null;
        try {
          const payload = this._serialize();
          await fs.mkdir(path.dirname(this.registryPath), { recursive: true });
          const serialized = JSON.stringify(payload, null, 2);
          await fs.writeFile(this.registryPath, serialized, "utf8");
          resolve(payload);
        } catch (error) {
          console.error(`❌ Registry save error: ${error.message}`);
          reject(error);
        } finally {
          this.pendingSavePromise = null;
        }
      }, SAVE_DEBOUNCE_MS);
    });

    return this.pendingSavePromise;
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
    const role = this._normalizeRole(profile.role, npcType, profile.id);

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
        role: this._normalizeRole(updates.role || existing.role, existing.role, id),
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
      role: this._normalizeRole(entry.role, entry.npcType || entry.type || "builder", entry.id),
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

  _serialize() {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      npcs: [...this.npcs.values()].map(serializeRegistryEntry)
    };
  }

  _normalizeRole(roleCandidate, fallbackCandidate, contextId = "") {
    const candidates = [];

    if (typeof roleCandidate === "string" && roleCandidate.trim().length > 0) {
      candidates.push(roleCandidate.trim().toLowerCase());
    }

    if (typeof fallbackCandidate === "string" && fallbackCandidate.trim().length > 0) {
      candidates.push(fallbackCandidate.trim().toLowerCase());
    }

    if (candidates.length === 0) {
      candidates.push("builder");
    }

    for (const candidate of candidates) {
      if (ALLOWED_ROLES.includes(candidate)) {
        return candidate;
      }
    }

    const identifier = contextId ? ` for NPC ${contextId}` : "";
    throw new Error(`Invalid role${identifier}: ${roleCandidate || fallbackCandidate}`);
  }
}
