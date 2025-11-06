import { query, transaction } from '../connection.js';
import { CacheManager } from '../redis.js';
import { logger } from '../../../logger.js';

const cache = new CacheManager();
const CACHE_TTL = 300; // 5 minutes

/**
 * NPC Repository - handles all NPC database operations
 */
export class NPCRepository {
  /**
   * Get all NPCs with optional filtering
   */
  async getAll(filters = {}) {
    const cacheKey = `npcs:all:${JSON.stringify(filters)}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    try {
      let sql = 'SELECT * FROM npcs';
      const params = [];
      const conditions = [];

      if (filters.status) {
        conditions.push(`status = $${params.length + 1}`);
        params.push(filters.status);
      }

      if (filters.role) {
        conditions.push(`role = $${params.length + 1}`);
        params.push(filters.role);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ' ORDER BY created_at DESC';

      if (filters.limit) {
        sql += ` LIMIT $${params.length + 1}`;
        params.push(filters.limit);
      }

      if (filters.offset) {
        sql += ` OFFSET $${params.length + 1}`;
        params.push(filters.offset);
      }

      const result = await query(sql, params);
      const npcs = result.rows;

      await cache.set(cacheKey, npcs, CACHE_TTL);
      return npcs;
    } catch (err) {
      logger.error('Failed to get NPCs', { error: err.message, filters });
      throw err;
    }
  }

  /**
   * Get NPC by ID
   */
  async getById(id) {
    const cacheKey = `npc:${id}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await query('SELECT * FROM npcs WHERE id = $1', [id]);
      const npc = result.rows[0] || null;

      if (npc) {
        await cache.set(cacheKey, npc, CACHE_TTL);
      }

      return npc;
    } catch (err) {
      logger.error('Failed to get NPC', { error: err.message, id });
      throw err;
    }
  }

  /**
   * Create new NPC
   */
  async create(npcData) {
    try {
      const {
        id, role, npcType, status, appearance, personality,
        spawnPosition, metadata, description
      } = npcData;

      const result = await query(`
        INSERT INTO npcs (
          id, role, npc_type, status, appearance, personality,
          spawn_position, last_known_position, metadata, description,
          created_at, updated_at, last_active_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), NOW())
        RETURNING *
      `, [
        id, role, npcType || role, status || 'idle',
        JSON.stringify(appearance || {}),
        JSON.stringify(personality || {}),
        JSON.stringify(spawnPosition || {}),
        JSON.stringify(spawnPosition || {}),
        JSON.stringify(metadata || {}),
        description || null
      ]);

      const npc = result.rows[0];

      // Invalidate cache
      await cache.delPattern('npcs:*');
      await cache.set(`npc:${npc.id}`, npc, CACHE_TTL);

      logger.info('NPC created', { npcId: npc.id });
      return npc;
    } catch (err) {
      logger.error('Failed to create NPC', { error: err.message, npcData });
      throw err;
    }
  }

  /**
   * Update NPC
   */
  async update(id, updates) {
    try {
      const updateFields = [];
      const params = [id];
      let paramIndex = 2;

      const allowedFields = [
        'role', 'status', 'appearance', 'personality',
        'last_known_position', 'metadata', 'description'
      ];

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          const dbField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
          const value = typeof updates[field] === 'object'
            ? JSON.stringify(updates[field])
            : updates[field];
          updateFields.push(`${dbField} = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }
      }

      if (updateFields.length === 0) {
        return await this.getById(id);
      }

      updateFields.push('updated_at = NOW()');
      updateFields.push('last_active_at = NOW()');

      const sql = `
        UPDATE npcs
        SET ${updateFields.join(', ')}
        WHERE id = $1
        RETURNING *
      `;

      const result = await query(sql, params);
      const npc = result.rows[0];

      // Invalidate cache
      await cache.del(`npc:${id}`);
      await cache.delPattern('npcs:*');

      logger.info('NPC updated', { npcId: id });
      return npc;
    } catch (err) {
      logger.error('Failed to update NPC', { error: err.message, id, updates });
      throw err;
    }
  }

  /**
   * Delete NPC
   */
  async delete(id) {
    try {
      const result = await query('DELETE FROM npcs WHERE id = $1 RETURNING *', [id]);

      // Invalidate cache
      await cache.del(`npc:${id}`);
      await cache.delPattern('npcs:*');

      logger.info('NPC deleted', { npcId: id });
      return result.rows[0];
    } catch (err) {
      logger.error('Failed to delete NPC', { error: err.message, id });
      throw err;
    }
  }

  /**
   * Get NPCs by status
   */
  async getByStatus(status) {
    return this.getAll({ status });
  }

  /**
   * Update NPC position
   */
  async updatePosition(id, position) {
    try {
      const result = await query(`
        UPDATE npcs
        SET last_known_position = $2, updated_at = NOW(), last_active_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [id, JSON.stringify(position)]);

      // Invalidate cache
      await cache.del(`npc:${id}`);

      return result.rows[0];
    } catch (err) {
      logger.error('Failed to update NPC position', { error: err.message, id });
      throw err;
    }
  }

  /**
   * Batch update NPC positions (optimized)
   */
  async batchUpdatePositions(updates) {
    try {
      const client = await transaction(async (client) => {
        for (const { id, position } of updates) {
          await client.query(`
            UPDATE npcs
            SET last_known_position = $2, updated_at = NOW(), last_active_at = NOW()
            WHERE id = $1
          `, [id, JSON.stringify(position)]);
        }
      });

      // Invalidate cache for all updated NPCs
      for (const { id } of updates) {
        await cache.del(`npc:${id}`);
      }

      logger.debug('Batch position update completed', { count: updates.length });
    } catch (err) {
      logger.error('Failed batch position update', { error: err.message });
      throw err;
    }
  }
}
