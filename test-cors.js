/**
 * CORS Configuration Test Script
 * Tests the security of CORS configuration with allowed and disallowed origins
 */

import { createAppServer } from './src/config/server.js';
import http from 'http';

const PORT = 3001; // Use different port for testing

// Test configuration
const tests = [];
let passed = 0;
let failed = 0;

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[type]}${message}${colors.reset}`);
}

function testResult(name, success, message) {
  if (success) {
    passed++;
    log(`✓ ${name}: ${message}`, 'success');
  } else {
    failed++;
    log(`✗ ${name}: ${message}`, 'error');
  }
}

// Helper function to make HTTP requests with custom origin
function makeRequest(origin, path = '/', method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: origin ? {
        'Origin': origin,
        'Content-Type': 'application/json'
      } : {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  log('\n=== CORS Security Test Suite ===\n', 'info');

  // Set up test environment
  process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:8080';
  process.env.NODE_ENV = 'development';

  const { app, httpServer, io } = createAppServer();

  // Add a test endpoint
  app.get('/api/test', (req, res) => {
    res.json({ message: 'Test endpoint working' });
  });

  await new Promise((resolve) => {
    httpServer.listen(PORT, () => {
      log(`Test server started on port ${PORT}`, 'info');
      resolve();
    });
  });

  try {
    // Test 1: Request with allowed origin (localhost:3000)
    log('\nTest 1: Request with allowed origin (http://localhost:3000)', 'info');
    try {
      const res1 = await makeRequest('http://localhost:3000', '/api/test');
      const allowedOrigin = res1.headers['access-control-allow-origin'];
      testResult(
        'Allowed origin test',
        res1.statusCode === 200 && allowedOrigin === 'http://localhost:3000',
        `Status: ${res1.statusCode}, CORS header: ${allowedOrigin}`
      );
    } catch (err) {
      testResult('Allowed origin test', false, err.message);
    }

    // Test 2: Request with another allowed origin (localhost:8080)
    log('\nTest 2: Request with allowed origin (http://localhost:8080)', 'info');
    try {
      const res2 = await makeRequest('http://localhost:8080', '/api/test');
      const allowedOrigin = res2.headers['access-control-allow-origin'];
      testResult(
        'Second allowed origin test',
        res2.statusCode === 200 && allowedOrigin === 'http://localhost:8080',
        `Status: ${res2.statusCode}, CORS header: ${allowedOrigin}`
      );
    } catch (err) {
      testResult('Second allowed origin test', false, err.message);
    }

    // Test 3: Request with disallowed origin
    log('\nTest 3: Request with disallowed origin (http://malicious-site.com)', 'info');
    try {
      const res3 = await makeRequest('http://malicious-site.com', '/api/test');
      const allowedOrigin = res3.headers['access-control-allow-origin'];
      testResult(
        'Disallowed origin test',
        res3.statusCode === 403 && !allowedOrigin,
        `Status: ${res3.statusCode}, No CORS header set (secure)`
      );
    } catch (err) {
      testResult('Disallowed origin test', false, err.message);
    }

    // Test 4: Request with another disallowed origin
    log('\nTest 4: Request with disallowed origin (https://evil.com)', 'info');
    try {
      const res4 = await makeRequest('https://evil.com', '/api/test');
      testResult(
        'Second disallowed origin test',
        res4.statusCode === 403,
        `Status: ${res4.statusCode}, Request properly rejected`
      );
    } catch (err) {
      testResult('Second disallowed origin test', false, err.message);
    }

    // Test 5: Request with no origin (e.g., curl, mobile apps)
    log('\nTest 5: Request with no origin header (curl-like request)', 'info');
    try {
      const res5 = await makeRequest(null, '/api/test');
      testResult(
        'No origin test',
        res5.statusCode === 200,
        `Status: ${res5.statusCode}, Request allowed (for mobile apps/curl)`
      );
    } catch (err) {
      testResult('No origin test', false, err.message);
    }

    // Test 6: OPTIONS preflight request with allowed origin
    log('\nTest 6: OPTIONS preflight with allowed origin', 'info');
    try {
      const res6 = await makeRequest('http://localhost:3000', '/api/test', 'OPTIONS');
      const allowedMethods = res6.headers['access-control-allow-methods'];
      testResult(
        'Preflight request test',
        res6.statusCode === 204 && allowedMethods,
        `Status: ${res6.statusCode}, Methods: ${allowedMethods}`
      );
    } catch (err) {
      testResult('Preflight request test', false, err.message);
    }

    // Test 7: Credentials support
    log('\nTest 7: Credentials support verification', 'info');
    try {
      const res7 = await makeRequest('http://localhost:3000', '/api/test');
      const allowCredentials = res7.headers['access-control-allow-credentials'];
      testResult(
        'Credentials support test',
        allowCredentials === 'true',
        `Credentials allowed: ${allowCredentials}`
      );
    } catch (err) {
      testResult('Credentials support test', false, err.message);
    }

  } catch (error) {
    log(`\nTest error: ${error.message}`, 'error');
  } finally {
    httpServer.close();
    io.close();

    // Print summary
    log('\n=== Test Summary ===', 'info');
    log(`Total tests: ${passed + failed}`, 'info');
    log(`Passed: ${passed}`, 'success');
    log(`Failed: ${failed}`, failed > 0 ? 'error' : 'info');

    if (failed === 0) {
      log('\n✓ All CORS security tests passed!', 'success');
      process.exit(0);
    } else {
      log('\n✗ Some tests failed. Please review the configuration.', 'error');
      process.exit(1);
    }
  }
}

runTests().catch(err => {
  log(`Fatal error: ${err.message}`, 'error');
  console.error(err);
  process.exit(1);
});
