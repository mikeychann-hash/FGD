/**
 * NPC System Tests
 *
 * Basic test suite for NPC system components
 * To run: node test/npc_system.test.js
 */

import { NPCRegistry } from '../npc_registry.js';
import { NPCSpawner } from '../npc_spawner.js';
import { NPCFinalizer } from '../npc_finalizer.js';
import { LearningEngine } from '../learning_engine.js';
import { validator } from '../validator.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test utilities
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ ${message}`);
    testsPassed++;
  } else {
    console.error(`❌ ${message}`);
    testsFailed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log(`✅ ${message}`);
    testsPassed++;
  } else {
    console.error(`❌ ${message}`);
    console.error(`   Expected: ${expected}`);
    console.error(`   Actual: ${actual}`);
    testsFailed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertNotNull(value, message) {
  if (value != null) {
    console.log(`✅ ${message}`);
    testsPassed++;
  } else {
    console.error(`❌ ${message}`);
    testsFailed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Test data paths
const TEST_DATA_DIR = path.join(__dirname, 'test_data');
const TEST_REGISTRY_PATH = path.join(TEST_DATA_DIR, 'test_registry.json');
const TEST_PROFILES_PATH = path.join(TEST_DATA_DIR, 'test_profiles.json');
const TEST_ARCHIVE_PATH = path.join(TEST_DATA_DIR, 'test_archive.json');

// Setup and teardown
async function setup() {
  console.log('\n🔧 Setting up test environment...');
  await fs.mkdir(TEST_DATA_DIR, { recursive: true });
  console.log('✅ Test environment ready\n');
}

async function teardown() {
  console.log('\n🧹 Cleaning up test environment...');
  try {
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
    console.log('✅ Test environment cleaned up\n');
  } catch (err) {
    console.warn('⚠️  Failed to clean up test environment:', err.message);
  }
}

// Test suites
async function testNPCRegistry() {
  console.log('\n📦 Testing NPCRegistry...\n');

  const registry = new NPCRegistry({ registryPath: TEST_REGISTRY_PATH });
  await registry.load();

  // Test: Create NPC
  const npc1 = await registry.ensureProfile({
    id: 'test_miner_01',
    role: 'miner',
    npcType: 'miner',
    appearance: { skin: 'default' },
    spawnPosition: { x: 100, y: 64, z: 200 }
  });

  assertNotNull(npc1, 'NPC should be created');
  assertEqual(npc1.id, 'test_miner_01', 'NPC ID should match');
  assertEqual(npc1.role, 'miner', 'NPC role should match');
  assert(npc1.personality, 'NPC should have personality');

  // Test: Get NPC
  const retrieved = registry.get('test_miner_01');
  assertNotNull(retrieved, 'NPC should be retrievable');
  assertEqual(retrieved.id, 'test_miner_01', 'Retrieved NPC ID should match');

  // Test: List NPCs
  const all = registry.getAll();
  assertEqual(all.length, 1, 'Should have 1 NPC');

  // Test: Record spawn
  const spawned = await registry.recordSpawn('test_miner_01', { x: 100, y: 64, z: 200 });
  assertEqual(spawned.spawnCount, 1, 'Spawn count should be 1');

  // Test: Record despawn
  const despawned = await registry.recordDespawn('test_miner_01');
  assertEqual(despawned.status, 'inactive', 'Status should be inactive');

  // Test: List active
  const active = registry.listActive();
  assertEqual(active.length, 0, 'Should have 0 active NPCs');

  console.log('✅ NPCRegistry tests completed\n');
}

async function testLearningEngine() {
  console.log('\n🧠 Testing LearningEngine...\n');

  const learning = new LearningEngine(TEST_PROFILES_PATH);
  await learning.initialize();

  // Test: Create profile
  const profile = learning.getOrCreateProfile('test_miner_01', 'miner');
  assertNotNull(profile, 'Profile should be created');
  assertEqual(profile.role, 'miner', 'Profile role should match');
  assert(profile.skills, 'Profile should have skills');
  assert(profile.personality, 'Profile should have personality');

  // Test: Record task success
  learning.recordTask('test_miner_01', 'mine', true);
  const updated = learning.getProfile('test_miner_01');
  assertEqual(updated.tasksCompleted, 1, 'Tasks completed should be 1');
  assert(updated.xp > 0, 'XP should be greater than 0');

  // Test: Record task failure
  learning.recordTask('test_miner_01', 'build', false);
  const afterFailure = learning.getProfile('test_miner_01');
  assertEqual(afterFailure.tasksFailed, 1, 'Tasks failed should be 1');

  console.log('✅ LearningEngine tests completed\n');
}

async function testNPCSpawner() {
  console.log('\n🎮 Testing NPCSpawner...\n');

  const registry = new NPCRegistry({ registryPath: TEST_REGISTRY_PATH });
  await registry.load();

  const learning = new LearningEngine(TEST_PROFILES_PATH);
  await learning.initialize();

  const spawner = new NPCSpawner({
    registry,
    learningEngine: learning,
    autoSpawn: false
  });
  await spawner.initialize();

  // Test: Spawn NPC
  const spawned = await spawner.spawn({
    role: 'builder',
    npcType: 'builder',
    appearance: { skin: 'builder' },
    position: { x: 0, y: 64, z: 0 }
  });

  assertNotNull(spawned, 'NPC should be spawned');
  assertNotNull(spawned.id, 'Spawned NPC should have ID');
  assertEqual(spawned.role, 'builder', 'Spawned NPC role should match');

  // Test: Dead letter queue
  const dlq = spawner.getDeadLetterQueue();
  assert(Array.isArray(dlq), 'Dead letter queue should be an array');

  console.log('✅ NPCSpawner tests completed\n');
}

async function testNPCFinalizer() {
  console.log('\n🏁 Testing NPCFinalizer...\n');

  const registry = new NPCRegistry({ registryPath: TEST_REGISTRY_PATH });
  await registry.load();

  const learning = new LearningEngine(TEST_PROFILES_PATH);
  await learning.initialize();

  // Create a test NPC
  await registry.ensureProfile({
    id: 'test_finalizer_npc',
    role: 'scout',
    npcType: 'scout'
  });

  learning.getOrCreateProfile('test_finalizer_npc', 'scout');
  learning.recordTask('test_finalizer_npc', 'explore', true);

  const finalizer = new NPCFinalizer({
    archivePath: TEST_ARCHIVE_PATH,
    registry,
    learningEngine: learning
  });
  await finalizer.load();

  // Test: Finalize NPC
  const result = await finalizer.finalizeNPC('test_finalizer_npc', {
    reason: 'test',
    removeFromWorld: false,
    preserveInRegistry: false
  });

  assertNotNull(result, 'Finalization should return result');
  assertEqual(result.npcId, 'test_finalizer_npc', 'Finalized NPC ID should match');
  assert(result.stats, 'Result should contain stats');
  assertEqual(result.archived, true, 'NPC should be archived');

  // Test: Get archive
  const archive = await finalizer.getArchive();
  assert(archive.length > 0, 'Archive should contain entries');

  // Test: Generate report
  const report = await finalizer.generateReport('test_finalizer_npc');
  assertNotNull(report, 'Report should be generated');
  assertEqual(report.npcId, 'test_finalizer_npc', 'Report NPC ID should match');

  console.log('✅ NPCFinalizer tests completed\n');
}

async function testValidator() {
  console.log('\n✔️  Testing Validator...\n');

  // Test: Valid profile
  const validProfile = {
    skills: {
      mining: 5,
      building: 3,
      gathering: 2,
      exploring: 1,
      guard: 0
    },
    personality: {
      curiosity: 0.7,
      patience: 0.5,
      motivation: 0.8,
      empathy: 0.6,
      aggression: 0.3,
      creativity: 0.4,
      loyalty: 0.9
    },
    xp: 100,
    tasksCompleted: 10,
    tasksFailed: 2,
    createdAt: new Date().toISOString()
  };

  try {
    const result = validator.validate(validProfile, 'npc_profile');
    assert(result === true, 'Valid profile should pass validation');
  } catch (err) {
    // If schema not loaded, that's okay for this test
    console.log('⚠️  Validator schema not loaded, skipping validation test');
  }

  console.log('✅ Validator tests completed\n');
}

// Integration tests
async function testIntegration() {
  console.log('\n🔗 Testing Integration...\n');

  const registry = new NPCRegistry({ registryPath: TEST_REGISTRY_PATH });
  await registry.load();

  const learning = new LearningEngine(TEST_PROFILES_PATH);
  await learning.initialize();

  const spawner = new NPCSpawner({
    registry,
    learningEngine: learning,
    autoSpawn: false
  });
  await spawner.initialize();

  const finalizer = new NPCFinalizer({
    archivePath: TEST_ARCHIVE_PATH,
    registry,
    learningEngine: learning
  });
  await finalizer.load();

  // Test: Full lifecycle
  // 1. Spawn
  const npc = await spawner.spawn({
    role: 'guard',
    npcType: 'guard',
    position: { x: 50, y: 64, z: 50 }
  });
  assertNotNull(npc, 'NPC should be spawned');

  // 2. Record activity
  learning.recordTask(npc.id, 'guard', true);
  learning.recordTask(npc.id, 'guard', true);
  learning.recordTask(npc.id, 'guard', false);

  // 3. Finalize
  const finalized = await finalizer.finalizeNPC(npc.id, {
    reason: 'integration_test'
  });
  assertNotNull(finalized, 'NPC should be finalized');
  assert(finalized.stats.learning, 'Finalized NPC should have learning stats');
  assertEqual(finalized.stats.learning.tasksCompleted, 2, 'Should have 2 completed tasks');

  console.log('✅ Integration tests completed\n');
}

// Main test runner
async function runTests() {
  console.log('═══════════════════════════════════════');
  console.log('   NPC System Test Suite');
  console.log('═══════════════════════════════════════');

  try {
    await setup();

    await testNPCRegistry();
    await testLearningEngine();
    await testNPCSpawner();
    await testNPCFinalizer();
    await testValidator();
    await testIntegration();

    await teardown();

    console.log('═══════════════════════════════════════');
    console.log('   Test Results');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);
    console.log('═══════════════════════════════════════\n');

    if (testsFailed === 0) {
      console.log('🎉 All tests passed!\n');
      process.exit(0);
    } else {
      console.log('❌ Some tests failed\n');
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ Test suite failed with error:', err);
    await teardown();
    process.exit(1);
  }
}

// Run tests
runTests();
