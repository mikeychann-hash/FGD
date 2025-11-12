/**
 * NPC Finalization System
 * Handles proper NPC retirement, despawning, and archival with statistics collection
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ARCHIVE_PATH = path.join(__dirname, 'data', 'npc_archive.json');

/**
 * NPCFinalizer - Manages the complete lifecycle closure of NPCs
 */
export class NPCFinalizer {
  constructor(options = {}) {
    this.archivePath = options.archivePath || DEFAULT_ARCHIVE_PATH;
    this.registry = options.registry;
    this.learningEngine = options.learningEngine;
    this.bridge = options.bridge;
    this.log = logger.child({ component: 'NPCFinalizer' });
    this.archive = [];
    this.loaded = false;
  }

  /**
   * Load archive from disk
   */
  async load() {
    if (this.loaded) {
      return this.archive;
    }

    try {
      const data = await fs.readFile(this.archivePath, 'utf8');
      this.archive = JSON.parse(data);
      if (!Array.isArray(this.archive)) {
        this.archive = [];
      }
      this.loaded = true;
      this.log.info('Archive loaded', { count: this.archive.length });
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.archive = [];
        this.loaded = true;
        await this.save();
        this.log.info('Created new archive');
      } else {
        this.log.error('Failed to load archive', { error: error.message });
        throw error;
      }
    }

    return this.archive;
  }

  /**
   * Save archive to disk
   */
  async save() {
    try {
      const dir = path.dirname(this.archivePath);
      await fs.mkdir(dir, { recursive: true });
      await this.#rotateBackups();
      await fs.writeFile(
        this.archivePath,
        JSON.stringify(this.archive, null, 2),
        'utf8'
      );
      this.log.debug('Archive saved', { count: this.archive.length });
    } catch (error) {
      this.log.error('Failed to save archive', { error: error.message });
      throw error;
    }
  }

  async #rotateBackups() {
    try {
      await fs.access(this.archivePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return;
      }
      throw error;
    }

    const maxBackups = 5;
    for (let index = maxBackups - 1; index >= 0; index -= 1) {
      const source = `${this.archivePath}.bak.${index}`;
      const target = `${this.archivePath}.bak.${index + 1}`;
      try {
        await fs.access(source);
        await fs.rename(source, target);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          this.log.warn('Failed to rotate archive backup', { error: error.message, source });
        }
      }
    }

    await fs.copyFile(this.archivePath, `${this.archivePath}.bak.0`);
  }

  /**
   * Finalize an NPC - complete lifecycle closure
   * @param {string} npcId - NPC identifier
   * @param {Object} options - Finalization options
   * @returns {Object} Finalization report
   */
  async finalizeNPC(npcId, options = {}) {
    await this.load();

    const {
      reason = 'manual',
      position = null,
      removeFromWorld = true,
      preserveInRegistry = false
    } = options;

    this.log.info('Starting NPC finalization', { npcId, reason });

    try {
      // 1. Collect final statistics
      const stats = await this._collectFinalStats(npcId);

      // 2. Remove from world if requested
      if (removeFromWorld && this.bridge) {
        await this._removeFromWorld(npcId);
      }

      // 3. Update registry
      if (this.registry) {
        await this._updateRegistry(npcId, position, preserveInRegistry);
      }

      // 4. Create archive entry
      const archiveEntry = this._createArchiveEntry(npcId, stats, reason);
      this.archive.push(archiveEntry);
      await this.save();

      // 5. Clean up learning profile if not preserving
      if (!preserveInRegistry && this.learningEngine) {
        await this._cleanupLearningProfile(npcId);
      }

      const report = {
        npcId,
        reason,
        timestamp: new Date().toISOString(),
        stats,
        archived: true,
        removedFromWorld: removeFromWorld,
        preservedInRegistry: preserveInRegistry
      };

      this.log.info('NPC finalized successfully', report);
      return report;

    } catch (error) {
      this.log.error('Finalization failed', { npcId, error: error.message });
      throw new Error(`Failed to finalize NPC ${npcId}: ${error.message}`);
    }
  }

  /**
   * Collect final statistics from all sources
   */
  async _collectFinalStats(npcId) {
    const stats = {
      registry: null,
      learning: null,
      computed: {}
    };

    // Get registry data
    if (this.registry) {
      try {
        stats.registry = this.registry.get(npcId);
      } catch (error) {
        this.log.warn('Failed to get registry data', { npcId, error: error.message });
      }
    }

    // Get learning data
    if (this.learningEngine) {
      try {
        stats.learning = this.learningEngine.getProfile(npcId);
      } catch (error) {
        this.log.warn('Failed to get learning data', { npcId, error: error.message });
      }
    }

    // Compute derived statistics
    if (stats.learning) {
      const profile = stats.learning;
      stats.computed = {
        totalTasks: (profile.tasksCompleted || 0) + (profile.tasksFailed || 0),
        successRate: this._calculateSuccessRate(profile),
        dominantSkill: this._findDominantSkill(profile.skills || {}),
        totalXP: profile.xp || 0,
        averageXPPerTask: this._calculateAverageXP(profile)
      };
    }

    if (stats.registry) {
      const reg = stats.registry;
      stats.computed.totalLifetime = this._calculateLifetime(reg);
      stats.computed.totalSpawns = reg.spawnCount || 0;
    }

    return stats;
  }

  /**
   * Remove NPC from Minecraft world
   */
  async _removeFromWorld(npcId) {
    try {
      if (this.bridge && typeof this.bridge.disconnectBot === 'function') {
        await this.bridge.disconnectBot(npcId);
        this.log.debug('Mineflayer bot disconnected', { npcId });
      } else if (this.bridge && typeof this.bridge.despawnNPC === 'function') {
        await this.bridge.despawnNPC(npcId);
        this.log.debug('NPC removed from world', { npcId });
      } else if (this.bridge && typeof this.bridge.sendCommand === 'function') {
        // Fallback: try to kill the entity
        await this.bridge.sendCommand(`kill @e[name="${npcId}"]`);
        this.log.debug('NPC killed via command', { npcId });
      }
    } catch (error) {
      this.log.warn('Failed to remove NPC from world', { npcId, error: error.message });
      // Don't throw - this is non-critical
    }
  }

  /**
   * Update registry with final state
   */
  async _updateRegistry(npcId, position, preserve) {
    try {
      await this.registry.recordDespawn(npcId, {
        status: preserve ? 'retired' : 'archived',
        position: position
      });
      this.log.debug('Registry updated', { npcId, preserve });
    } catch (error) {
      this.log.warn('Failed to update registry', { npcId, error: error.message });
    }
  }

  /**
   * Create archive entry
   */
  _createArchiveEntry(npcId, stats, reason) {
    return {
      npcId,
      reason,
      finalizedAt: new Date().toISOString(),
      stats,
      registry: stats.registry,
      learning: stats.learning,
      computed: stats.computed
    };
  }

  /**
   * Clean up learning profile
   */
  async _cleanupLearningProfile(npcId) {
    try {
      if (this.learningEngine && typeof this.learningEngine.deleteProfile === 'function') {
        await this.learningEngine.deleteProfile(npcId);
        this.log.debug('Learning profile deleted', { npcId });
      }
    } catch (error) {
      this.log.warn('Failed to delete learning profile', { npcId, error: error.message });
    }
  }

  /**
   * Calculate success rate
   */
  _calculateSuccessRate(profile) {
    const completed = profile.tasksCompleted || 0;
    const failed = profile.tasksFailed || 0;
    const total = completed + failed;
    return total > 0 ? (completed / total) * 100 : 0;
  }

  /**
   * Find dominant skill
   */
  _findDominantSkill(skills) {
    let maxSkill = null;
    let maxLevel = -1;

    for (const [skill, level] of Object.entries(skills)) {
      if (level > maxLevel) {
        maxLevel = level;
        maxSkill = skill;
      }
    }

    return maxSkill ? { skill: maxSkill, level: maxLevel } : null;
  }

  /**
   * Calculate average XP per task
   */
  _calculateAverageXP(profile) {
    const total = (profile.tasksCompleted || 0) + (profile.tasksFailed || 0);
    const xp = profile.xp || 0;
    return total > 0 ? xp / total : 0;
  }

  /**
   * Calculate total lifetime (in milliseconds)
   */
  _calculateLifetime(registry) {
    if (!registry.createdAt) return 0;

    const created = new Date(registry.createdAt);
    const ended = registry.lastDespawnedAt
      ? new Date(registry.lastDespawnedAt)
      : new Date();

    return ended - created;
  }

  /**
   * Get archive entries (all or filtered)
   */
  async getArchive(filter = {}) {
    await this.load();

    if (Object.keys(filter).length === 0) {
      return [...this.archive];
    }

    return this.archive.filter(entry => {
      for (const [key, value] of Object.entries(filter)) {
        if (entry[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Get statistics for an archived NPC
   */
  async getArchivedStats(npcId) {
    await this.load();
    const entry = this.archive.find(e => e.npcId === npcId);
    return entry ? { ...entry } : null;
  }

  /**
   * Bulk finalize multiple NPCs
   */
  async finalizeMultiple(npcIds, options = {}) {
    const results = [];
    const errors = [];

    for (const npcId of npcIds) {
      try {
        const result = await this.finalizeNPC(npcId, options);
        results.push(result);
      } catch (error) {
        errors.push({ npcId, error: error.message });
      }
    }

    return { results, errors };
  }

  /**
   * Generate finalization report
   */
  async generateReport(npcId) {
    const archived = await this.getArchivedStats(npcId);
    if (!archived) {
      throw new Error(`No archive entry found for NPC ${npcId}`);
    }

    const report = {
      npcId: archived.npcId,
      finalizedAt: archived.finalizedAt,
      reason: archived.reason,
      summary: {
        role: archived.registry?.role || 'unknown',
        totalLifetime: this._formatDuration(archived.computed?.totalLifetime || 0),
        totalSpawns: archived.computed?.totalSpawns || 0,
        totalTasks: archived.computed?.totalTasks || 0,
        successRate: `${(archived.computed?.successRate || 0).toFixed(1)}%`,
        totalXP: archived.computed?.totalXP || 0,
        dominantSkill: archived.computed?.dominantSkill
      },
      personality: archived.registry?.personalitySummary || 'unknown',
      skills: archived.learning?.skills || {}
    };

    return report;
  }

  /**
   * Format duration in human-readable form
   */
  _formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

export default NPCFinalizer;
