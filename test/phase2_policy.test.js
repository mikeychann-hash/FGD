/**
 * Phase 2 Policy Integration Tests - SIMPLIFIED
 * Tests PolicyEngine functionality for role-based access control
 * Run: npm test -- test/phase2_policy.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { PolicyEngine } from '../adapters/mineflayer/policy_engine.js';

test('PolicyEngine - Access Control', async (t) => {
  await t.test('ADMIN can submit tasks', () => {
    const engine = new PolicyEngine();
    assert.equal(engine.canUserPerformAction('admin', 'submit_task'), true);
  });

  await t.test('AUTOPILOT can submit tasks', () => {
    const engine = new PolicyEngine();
    assert.equal(engine.canUserPerformAction('autopilot', 'submit_task'), true);
  });

  await t.test('VIEWER cannot submit tasks', () => {
    const engine = new PolicyEngine();
    assert.equal(engine.canUserPerformAction('viewer', 'submit_task'), false);
  });

  await t.test('only ADMIN can approve', () => {
    const engine = new PolicyEngine();
    assert.equal(engine.canUserPerformAction('admin', 'approve_action'), true);
    assert.equal(engine.canUserPerformAction('autopilot', 'approve_action'), false);
  });
});

test('PolicyEngine - Task Type Control', async (t) => {
  await t.test('ADMIN can execute all task types', () => {
    const engine = new PolicyEngine();
    assert.equal(engine.isTaskTypeAllowed('admin', 'move_to'), true);
    assert.equal(engine.isTaskTypeAllowed('admin', 'chat'), true);
    assert.equal(engine.isTaskTypeAllowed('admin', 'any_type'), true);
  });

  await t.test('AUTOPILOT restricted to safe types', () => {
    const engine = new PolicyEngine();
    assert.equal(engine.isTaskTypeAllowed('autopilot', 'move_to'), true);
    assert.equal(engine.isTaskTypeAllowed('autopilot', 'chat'), true);
  });

  await t.test('VIEWER cannot execute tasks', () => {
    const engine = new PolicyEngine();
    assert.equal(engine.isTaskTypeAllowed('viewer', 'chat'), false);
  });
});

test('PolicyEngine - Rate Limiting', async (t) => {
  await t.test('allows requests under limit', () => {
    const engine = new PolicyEngine();
    const check = engine.checkRateLimit('user_001', 'autopilot');
    assert.equal(check.allowed, true);
    assert.equal(check.remaining, 599);
  });

  await t.test('tracks remaining quota', () => {
    const engine = new PolicyEngine();
    for (let i = 0; i < 10; i++) {
      engine.checkRateLimit('user_001', 'autopilot');
    }
    const check = engine.checkRateLimit('user_001', 'autopilot');
    assert.equal(check.remaining, 589);
  });

  await t.test('rejects over limit', () => {
    const engine = new PolicyEngine({ global: { rateLimit: { requestsPerMinute: 3 } } });
    engine.checkRateLimit('user_001', 'autopilot');
    engine.checkRateLimit('user_001', 'autopilot');
    engine.checkRateLimit('user_001', 'autopilot');
    const check = engine.checkRateLimit('user_001', 'autopilot');
    assert.equal(check.allowed, false);
  });
});

test('PolicyEngine - Dangerous Actions', async (t) => {
  await t.test('detects TNT as dangerous', () => {
    const engine = new PolicyEngine();
    const task = { type: 'place_block', parameters: { blockType: 'tnt' } };
    const check = engine.checkDangerousAction(task);
    assert.equal(check.isDangerous, true);
  });

  await t.test('allows safe blocks', () => {
    const engine = new PolicyEngine();
    const task = { type: 'place_block', parameters: { blockType: 'stone' } };
    const check = engine.checkDangerousAction(task);
    assert.equal(check.isDangerous, false);
  });

  await t.test('case-insensitive matching', () => {
    const engine = new PolicyEngine();
    const task = { type: 'place_block', parameters: { blockType: 'TNT' } };
    const check = engine.checkDangerousAction(task);
    assert.equal(check.isDangerous, true);
  });
});

test('PolicyEngine - Concurrency', async (t) => {
  await t.test('allows under limit', () => {
    const engine = new PolicyEngine({ global: { maxTasksPerBot: 3 } });
    const check = engine.checkBotConcurrencyLimit('bot_01');
    assert.equal(check.allowed, true);
    assert.equal(check.current, 0);
  });

  await t.test('rejects over limit', () => {
    const engine = new PolicyEngine({ global: { maxTasksPerBot: 2 } });
    engine.incrementBotTaskCount('bot_01');
    engine.incrementBotTaskCount('bot_01');
    const check = engine.checkBotConcurrencyLimit('bot_01');
    assert.equal(check.allowed, false);
  });

  await t.test('decrements properly', () => {
    const engine = new PolicyEngine();
    engine.incrementBotTaskCount('bot_01');
    engine.incrementBotTaskCount('bot_01');
    engine.decrementBotTaskCount('bot_01');
    const check = engine.checkBotConcurrencyLimit('bot_01');
    assert.equal(check.current, 1);
  });
});

test('PolicyEngine - Bot Access', async (t) => {
  await t.test('ADMIN accesses all bots', () => {
    const engine = new PolicyEngine();
    assert.equal(engine.canAccessBot('admin', 'admin_001', 'any_bot'), true);
  });

  await t.test('AUTOPILOT accesses own bots', () => {
    const engine = new PolicyEngine();
    assert.equal(engine.canAccessBot('autopilot', 'user_001', 'user_001_bot'), true);
    assert.equal(engine.canAccessBot('autopilot', 'user_001', 'user_002_bot'), false);
  });

  await t.test('VIEWER reads all bots', () => {
    const engine = new PolicyEngine();
    assert.equal(engine.canAccessBot('viewer', 'viewer_001', 'any_bot'), true);
  });
});

test('PolicyEngine - Approval Workflow', async (t) => {
  await t.test('queues for approval', () => {
    const engine = new PolicyEngine();
    const task = { type: 'place_block', botId: 'bot_01' };
    const token = engine.queueForApproval(task, 'user_001');
    assert.ok(token.startsWith('approval_'));
    const approval = engine.getApprovalStatus(token);
    assert.equal(approval.status, 'pending');
  });

  await t.test('approves task', () => {
    const engine = new PolicyEngine();
    const task = { type: 'place_block', botId: 'bot_01' };
    const token = engine.queueForApproval(task, 'user_001');
    const result = engine.approveTask(token, 'admin_001');
    assert.equal(result.success, true);
    assert.equal(result.approval.status, 'approved');
  });

  await t.test('rejects task', () => {
    const engine = new PolicyEngine();
    const task = { type: 'place_block', botId: 'bot_01' };
    const token = engine.queueForApproval(task, 'user_001');
    const result = engine.rejectTask(token, 'admin_001', 'Too risky');
    assert.equal(result.success, true);
    assert.equal(result.approval.status, 'rejected');
  });
});

test('PolicyEngine - Task Validation', async (t) => {
  await t.test('validates admin tasks', () => {
    const engine = new PolicyEngine();
    const task = { type: 'mine_block', parameters: { target: { x: 0, y: 0, z: 0 } } };
    const result = engine.validateTaskPolicy(task, {
      userId: 'admin_001',
      role: 'admin',
      botId: 'bot_01'
    });
    assert.equal(result.valid, true);
  });

  await t.test('validates autopilot restrictions', () => {
    const engine = new PolicyEngine();
    const task = { type: 'move_to', parameters: { target: { x: 0, y: 0, z: 0 } } };
    const result = engine.validateTaskPolicy(task, {
      userId: 'user_001',
      role: 'autopilot',
      botId: 'other_bot'
    });
    assert.equal(result.valid, false);
  });

  await t.test('warns on dangerous actions', () => {
    const engine = new PolicyEngine();
    const task = { type: 'place_block', parameters: { blockType: 'tnt', target: { x: 0, y: 0, z: 0 } } };
    const result = engine.validateTaskPolicy(task, {
      userId: 'admin_001',
      role: 'admin',
      botId: 'bot_01'
    });
    assert.equal(result.valid, true);
    assert.ok(result.warnings.length > 0);
  });
});
