import { query } from '../connection.js';
import { CacheManager } from '../redis.js';
import { logger } from '../../../logger.js';

const cache = new CacheManager();
const CACHE_TTL = 600; // 10 minutes

/**
 * Learning Profile Repository
 */
export class LearningRepository {
  /**
   * Get learning profile by NPC ID
   */
  async getByNpcId(npcId) {
    const cacheKey = `learning:${npcId}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await query('SELECT * FROM learning_profiles WHERE npc_id = $1', [npcId]);
      const profile = result.rows[0] || null;

      if (profile) {
        await cache.set(cacheKey, profile, CACHE_TTL);
      }

      return profile;
    } catch (err) {
      logger.error('Failed to get learning profile', { error: err.message, npcId });
      throw err;
    }
  }

  /**
   * Create or update learning profile
   */
  async upsert(npcId, profileData) {
    try {
      const {
        role,
        experiencePoints,
        level,
        taskHistory,
        skillImprovements,
        behavioralPatterns,
        successRate,
        totalTasks,
        successfulTasks,
        failedTasks,
      } = profileData;

      const result = await query(
        `
        INSERT INTO learning_profiles (
          npc_id, role, experience_points, level, task_history,
          skill_improvements, behavioral_patterns, success_rate,
          total_tasks, successful_tasks, failed_tasks, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (npc_id) DO UPDATE SET
          role = EXCLUDED.role,
          experience_points = EXCLUDED.experience_points,
          level = EXCLUDED.level,
          task_history = EXCLUDED.task_history,
          skill_improvements = EXCLUDED.skill_improvements,
          behavioral_patterns = EXCLUDED.behavioral_patterns,
          success_rate = EXCLUDED.success_rate,
          total_tasks = EXCLUDED.total_tasks,
          successful_tasks = EXCLUDED.successful_tasks,
          failed_tasks = EXCLUDED.failed_tasks,
          updated_at = NOW()
        RETURNING *
      `,
        [
          npcId,
          role,
          experiencePoints || 0,
          level || 1,
          JSON.stringify(taskHistory || []),
          JSON.stringify(skillImprovements || {}),
          JSON.stringify(behavioralPatterns || {}),
          successRate || 0,
          totalTasks || 0,
          successfulTasks || 0,
          failedTasks || 0,
        ]
      );

      const profile = result.rows[0];

      // Invalidate cache
      await cache.del(`learning:${npcId}`);

      logger.info('Learning profile upserted', { npcId });
      return profile;
    } catch (err) {
      logger.error('Failed to upsert learning profile', { error: err.message, npcId });
      throw err;
    }
  }

  /**
   * Increment experience points
   */
  async incrementExperience(npcId, points) {
    try {
      const result = await query(
        `
        UPDATE learning_profiles
        SET experience_points = experience_points + $2,
            updated_at = NOW()
        WHERE npc_id = $1
        RETURNING *
      `,
        [npcId, points]
      );

      await cache.del(`learning:${npcId}`);
      return result.rows[0];
    } catch (err) {
      logger.error('Failed to increment experience', { error: err.message, npcId });
      throw err;
    }
  }

  /**
   * Record task completion
   */
  async recordTask(npcId, taskData, success) {
    try {
      const profile = await this.getByNpcId(npcId);
      if (!profile) {
        logger.warn('Learning profile not found for task recording', { npcId });
        return null;
      }

      const taskHistory = Array.isArray(profile.task_history) ? profile.task_history : [];
      taskHistory.push({
        ...taskData,
        success,
        timestamp: new Date().toISOString(),
      });

      // Keep last 100 tasks
      if (taskHistory.length > 100) {
        taskHistory.shift();
      }

      const totalTasks = (profile.total_tasks || 0) + 1;
      const successfulTasks = (profile.successful_tasks || 0) + (success ? 1 : 0);
      const failedTasks = (profile.failed_tasks || 0) + (success ? 0 : 1);
      const successRate = (successfulTasks / totalTasks) * 100;

      const result = await query(
        `
        UPDATE learning_profiles
        SET task_history = $2,
            total_tasks = $3,
            successful_tasks = $4,
            failed_tasks = $5,
            success_rate = $6,
            updated_at = NOW()
        WHERE npc_id = $1
        RETURNING *
      `,
        [npcId, JSON.stringify(taskHistory), totalTasks, successfulTasks, failedTasks, successRate]
      );

      await cache.del(`learning:${npcId}`);
      return result.rows[0];
    } catch (err) {
      logger.error('Failed to record task', { error: err.message, npcId });
      throw err;
    }
  }

  /**
   * Get all learning profiles
   */
  async getAll() {
    try {
      const result = await query('SELECT * FROM learning_profiles ORDER BY level DESC');
      return result.rows;
    } catch (err) {
      logger.error('Failed to get all learning profiles', { error: err.message });
      throw err;
    }
  }

  /**
   * Delete learning profile
   */
  async delete(npcId) {
    try {
      const result = await query('DELETE FROM learning_profiles WHERE npc_id = $1 RETURNING *', [
        npcId,
      ]);

      await cache.del(`learning:${npcId}`);
      logger.info('Learning profile deleted', { npcId });
      return result.rows[0];
    } catch (err) {
      logger.error('Failed to delete learning profile', { error: err.message, npcId });
      throw err;
    }
  }
}
