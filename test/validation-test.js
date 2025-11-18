// Test validation schemas
import { createBotSchema, updateBotSchema, taskSchema } from '../src/validators/bot.schemas.js';

console.log('='.repeat(80));
console.log('VALIDATION TEST SUITE');
console.log('='.repeat(80));
console.log();

// Test 1: Valid bot creation
console.log('Test 1: Valid bot creation');
console.log('-'.repeat(40));
try {
  const validBot = {
    role: 'miner',
    name: 'TestBot',
    description: 'A test mining bot',
    personality: {
      curiosity: 0.8,
      patience: 0.6,
    },
  };
  const result = createBotSchema.parse(validBot);
  console.log('✅ PASS: Valid bot accepted');
  console.log('   Input:', JSON.stringify(validBot, null, 2));
  console.log();
} catch (error) {
  console.log('❌ FAIL: Valid bot rejected');
  console.log('   Error:', error.errors);
  console.log();
}

// Test 2: Invalid role
console.log('Test 2: Invalid role (should fail)');
console.log('-'.repeat(40));
try {
  const invalidBot = {
    role: 'hacker', // Invalid role
    name: 'BadBot',
  };
  createBotSchema.parse(invalidBot);
  console.log('❌ FAIL: Invalid role was accepted');
  console.log();
} catch (error) {
  console.log('✅ PASS: Invalid role rejected');
  console.log('   Input:', { role: 'hacker', name: 'BadBot' });
  console.log('   Error details:');
  if (error.errors) {
    error.errors.forEach((err) => {
      console.log(`     - Field: ${err.path.join('.')}`);
      console.log(`       Message: ${err.message}`);
    });
  } else {
    console.log('   Error:', error.message);
  }
  console.log();
}

// Test 3: Out of range personality values
console.log('Test 3: Out of range personality values (should fail)');
console.log('-'.repeat(40));
try {
  const invalidBot = {
    role: 'builder',
    personality: {
      curiosity: 1.5, // Out of range
      aggression: -0.2, // Out of range
    },
  };
  createBotSchema.parse(invalidBot);
  console.log('❌ FAIL: Out of range personality values accepted');
  console.log();
} catch (error) {
  console.log('✅ PASS: Out of range personality values rejected');
  console.log('   Input:', { role: 'builder', personality: { curiosity: 1.5, aggression: -0.2 } });
  console.log('   Error details:');
  if (error.errors) {
    error.errors.forEach((err) => {
      console.log(`     - Field: ${err.path.join('.')}`);
      console.log(`       Message: ${err.message}`);
    });
  } else {
    console.log('   Error:', error.message);
  }
  console.log();
}

// Test 4: Description too long
console.log('Test 4: Description exceeding max length (should fail)');
console.log('-'.repeat(40));
try {
  const invalidBot = {
    role: 'scout',
    description: 'a'.repeat(501), // Exceeds 500 char limit
  };
  createBotSchema.parse(invalidBot);
  console.log('❌ FAIL: Long description accepted');
  console.log();
} catch (error) {
  console.log('✅ PASS: Long description rejected');
  console.log('   Input: description with', 501, 'characters');
  console.log('   Error details:');
  if (error.errors) {
    error.errors.forEach((err) => {
      console.log(`     - Field: ${err.path.join('.')}`);
      console.log(`       Message: ${err.message}`);
    });
  } else {
    console.log('   Error:', error.message);
  }
  console.log();
}

// Test 5: Valid position
console.log('Test 5: Valid position');
console.log('-'.repeat(40));
try {
  const validBot = {
    role: 'guard',
    position: {
      x: 100,
      y: 64,
      z: -200,
    },
  };
  const result = createBotSchema.parse(validBot);
  console.log('✅ PASS: Valid position accepted');
  console.log('   Input:', JSON.stringify(validBot, null, 2));
  console.log();
} catch (error) {
  console.log('❌ FAIL: Valid position rejected');
  console.log('   Error:', error.errors);
  console.log();
}

// Test 6: Invalid Y coordinate (out of world bounds)
console.log('Test 6: Invalid Y coordinate (should fail)');
console.log('-'.repeat(40));
try {
  const invalidBot = {
    role: 'gatherer',
    position: {
      x: 0,
      y: 500, // Above world height limit
      z: 0,
    },
  };
  createBotSchema.parse(invalidBot);
  console.log('❌ FAIL: Out of bounds Y coordinate accepted');
  console.log();
} catch (error) {
  console.log('✅ PASS: Out of bounds Y coordinate rejected');
  console.log('   Input:', { position: { x: 0, y: 500, z: 0 } });
  console.log('   Error details:');
  if (error.errors) {
    error.errors.forEach((err) => {
      console.log(`     - Field: ${err.path.join('.')}`);
      console.log(`       Message: ${err.message}`);
    });
  } else {
    console.log('   Error:', error.message);
  }
  console.log();
}

// Test 7: Valid task assignment
console.log('Test 7: Valid task assignment');
console.log('-'.repeat(40));
try {
  const validTask = {
    action: 'mine',
    target: 'iron_ore',
    priority: 'high',
  };
  const result = taskSchema.parse(validTask);
  console.log('✅ PASS: Valid task accepted');
  console.log('   Input:', JSON.stringify(validTask, null, 2));
  console.log();
} catch (error) {
  console.log('❌ FAIL: Valid task rejected');
  console.log('   Error:', error.errors);
  console.log();
}

// Test 8: Task without required action
console.log('Test 8: Task without required action (should fail)');
console.log('-'.repeat(40));
const invalidTask = {
  target: 'diamond',
  priority: 'critical',
  // Missing required 'action' field
};
try {
  taskSchema.parse(invalidTask);
  console.log('❌ FAIL: Task without action accepted');
  console.log();
} catch (error) {
  console.log('✅ PASS: Task without action rejected');
  console.log('   Input:', invalidTask);
  console.log('   Error details:');
  if (error.errors) {
    error.errors.forEach((err) => {
      console.log(`     - Field: ${err.path.join('.')}`);
      console.log(`       Message: ${err.message}`);
    });
  } else {
    console.log('   Error:', error.message);
  }
  console.log();
}

// Test 9: Update bot with valid data
console.log('Test 9: Update bot with valid data');
console.log('-'.repeat(40));
try {
  const validUpdate = {
    description: 'Updated description',
    personality: {
      patience: 0.9,
    },
  };
  const result = updateBotSchema.parse(validUpdate);
  console.log('✅ PASS: Valid update accepted');
  console.log('   Input:', JSON.stringify(validUpdate, null, 2));
  console.log();
} catch (error) {
  console.log('❌ FAIL: Valid update rejected');
  console.log('   Error:', error.errors);
  console.log();
}

// Test 10: Empty update (should pass - all fields optional)
console.log('Test 10: Empty update object');
console.log('-'.repeat(40));
try {
  const emptyUpdate = {};
  const result = updateBotSchema.parse(emptyUpdate);
  console.log('✅ PASS: Empty update accepted (all fields optional)');
  console.log('   Input:', emptyUpdate);
  console.log();
} catch (error) {
  console.log('❌ FAIL: Empty update rejected');
  console.log('   Error:', error.errors);
  console.log();
}

console.log('='.repeat(80));
console.log('TEST SUITE COMPLETE');
console.log('='.repeat(80));
