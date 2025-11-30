# PRIORITIZED TODO LIST
## AICraft Cluster Dashboard - Required Updates

**Generated:** 2025-11-18
**Based On:** Comprehensive End-to-End Review (5 Autonomous Agents)

---

## 🔴 P0: CRITICAL (Must Fix Before Production)

**Blocking Issues:** 6 critical security vulnerabilities + build failures

**Total Estimated Effort:** 6 hours

### P0-1: Remove Hardcoded Credentials ⚠️ CRITICAL SECURITY RISK
**Effort:** 30 minutes
**Priority:** IMMEDIATE
**Risk:** System compromise, unauthorized access

**Files to Update:**
- [ ] `/home/user/FGD/middleware/auth.js` (lines 22-23, 35)
  - Remove hardcoded `folks123` admin password
  - Remove placeholder `llm-key-change-me` API key
  - Enforce environment variable validation

- [ ] `/home/user/FGD/src/database/connection.js` (line 13)
  - Remove default `postgres` password
  - Require DB_PASSWORD environment variable

**Implementation:**
```javascript
// middleware/auth.js
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const LLM_API_KEY = process.env.LLM_API_KEY;

if (!ADMIN_API_KEY || !LLM_API_KEY) {
  throw new Error('ADMIN_API_KEY and LLM_API_KEY must be set in environment');
}

// src/database/connection.js
const password = process.env.DB_PASSWORD;
if (!password) {
  throw new Error('DB_PASSWORD environment variable is required');
}
```

**Verification:**
```bash
# Test that server fails to start without credentials
unset DB_PASSWORD
node server.js  # Should throw error

# Test with proper credentials
export DB_PASSWORD="secure-password"
node server.js  # Should start successfully
```

---

### P0-2: Implement Password Hashing ⚠️ CRITICAL SECURITY RISK
**Effort:** 2 hours
**Priority:** IMMEDIATE
**Risk:** Password exposure in memory dumps, replay attacks

**Current Vulnerability:**
```javascript
// middleware/auth.js:263 - PLAIN TEXT COMPARISON
if (foundUser && foundUser.password === password) {
  user = foundUser;
}
```

**Fix Required:**
- [ ] Install bcrypt: `npm install bcrypt`
- [ ] Update login function to use bcrypt.compare()
- [ ] Hash all existing passwords
- [ ] Update user creation logic

**Implementation:**
```javascript
import bcrypt from 'bcrypt';

// Hash password on user creation
const SALT_ROUNDS = 12;
const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

// Compare on login
const isValid = await bcrypt.compare(password, foundUser.passwordHash);
if (foundUser && isValid) {
  user = foundUser;
}
```

**Files:**
- [ ] `/home/user/FGD/middleware/auth.js` - Update login logic
- [ ] `/home/user/FGD/middleware/auth.js` - Hash existing user passwords
- [ ] Update user object structure to use `passwordHash` instead of `password`

**Testing:**
```bash
# Test login with hashed passwords
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-secure-password"}'
```

---

### P0-3: Fix CORS Configuration ⚠️ CRITICAL SECURITY RISK
**Effort:** 1 hour
**Priority:** IMMEDIATE
**Risk:** CSRF attacks, unauthorized cross-origin requests

**Current Vulnerability:**
```javascript
// src/config/server.js - WILDCARD ORIGIN
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});
```

**Fix Required:**
- [ ] Remove wildcard origin
- [ ] Whitelist specific origins
- [ ] Add environment variable for allowed origins

**Implementation:**
```javascript
// src/config/server.js
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:8080'
];

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
```

**Files:**
- [ ] `/home/user/FGD/src/config/server.js`
- [ ] Add `ALLOWED_ORIGINS` to .env.example

**Testing:**
```bash
# Test CORS headers
curl -H "Origin: http://evil.com" http://localhost:3000/api/cluster
# Should reject

curl -H "Origin: http://localhost:3000" http://localhost:3000/api/cluster
# Should accept
```

---

### P0-4: Fix npm Security Vulnerabilities ⚠️ CRITICAL SECURITY RISK
**Effort:** 2 hours (includes testing)
**Priority:** IMMEDIATE
**Risk:** SSRF, DoS, CSRF attacks via axios dependencies

**Current Status:** 6 high-severity vulnerabilities in transitive dependencies

**Fix Required:**
```bash
# 1. Review vulnerabilities
npm audit

# 2. Attempt automatic fix
npm audit fix --force

# 3. Update axios to latest
npm install axios@latest

# 4. Test all API integrations
npm test
```

**Files to Test After Update:**
- [ ] `/home/user/FGD/llm_bridge.js` (uses axios)
- [ ] `/home/user/FGD/admin.js` (if using axios)
- [ ] All files importing axios

**Verification:**
```bash
npm audit  # Should show 0 vulnerabilities
npm run test
npm run build
```

**Fallback:** If breaking changes occur, pin to specific safe version and schedule upgrade

---

### P0-5: Install Missing devDependencies ⚠️ BLOCKS CI/CD
**Effort:** 15 minutes
**Priority:** IMMEDIATE
**Risk:** CI/CD pipeline will fail, tests cannot run

**Missing Packages:**
- jest
- @babel/core
- @babel/preset-env
- babel-jest
- eslint
- prettier

**Fix Required:**
```bash
npm install --save-dev \
  jest@^29.7.0 \
  babel-jest@^29.7.0 \
  @babel/core@^7.23.0 \
  @babel/preset-env@^7.23.0 \
  eslint@^8.54.0 \
  prettier@^3.1.0
```

**Update package.json scripts:**
- [ ] Add `"test:unit": "jest tests/unit"`
- [ ] Add `"test:integration": "jest tests/integration"`
- [ ] Add `"test:coverage": "jest --coverage"`
- [ ] Update `"lint": "eslint src/ routes/ middleware/ tests/"`

**Verification:**
```bash
npm run test:unit
npm run test:integration
npm run lint
```

---

### P0-6: Add Authentication to Debug Endpoint ⚠️ INFORMATION DISCLOSURE
**Effort:** 15 minutes
**Priority:** IMMEDIATE
**Risk:** Exposes all bot data without authentication

**Current Vulnerability:**
```javascript
// src/api/cluster.js - NO AUTHENTICATION
router.get('/debug/bot/:id/view', (req, res) => {
  // Returns all bot data including internal state
});
```

**Fix Required:**
```javascript
import { authenticate, requirePermission } from '../../middleware/auth.js';

router.get('/debug/bot/:id/view',
  authenticate,
  requirePermission('admin'),
  (req, res) => {
    // Debug view handler
});
```

**Files:**
- [ ] `/home/user/FGD/src/api/cluster.js` (add auth middleware)

**Testing:**
```bash
# Without auth - should fail
curl http://localhost:3000/debug/bot/123/view
# Expected: 401 Unauthorized

# With admin auth - should work
curl -H "X-API-Key: $ADMIN_API_KEY" http://localhost:3000/debug/bot/123/view
# Expected: 200 OK
```

---

## 🟠 P1: HIGH PRIORITY (Fix This Sprint)

**Total Estimated Effort:** 30 hours

### P1-1: Add Rate Limiting
**Effort:** 2 hours
**Priority:** High
**Impact:** Prevents DoS attacks, brute force attempts

**Implementation:**
```bash
npm install express-rate-limit
```

**Code:**
```javascript
import rateLimit from 'express-rate-limit';

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Only 5 login attempts per 15 minutes
  skipSuccessfulRequests: true,
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
```

**Files:**
- [ ] `/home/user/FGD/server.js` or `/home/user/FGD/src/config/server.js`

**Testing:**
```bash
# Send 6 requests quickly to login
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test"}'
done
# 6th request should be rate limited
```

---

### P1-2: Improve JWT Configuration
**Effort:** 6 hours
**Priority:** High
**Impact:** Shorter-lived tokens, refresh flow, logout capability

**Current Issues:**
- 24-hour token expiration (too long)
- No token refresh mechanism
- No logout/token blacklist

**Implementation:**

**Step 1: Reduce token expiration**
```javascript
// middleware/auth.js
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h'; // Changed from 24h
```

**Step 2: Implement refresh tokens**
```bash
npm install uuid
```

```javascript
// middleware/auth.js
import { v4 as uuidv4 } from 'uuid';

const refreshTokens = new Map(); // In production, use Redis

export function generateTokens(user) {
  const accessToken = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const refreshToken = uuidv4();
  refreshTokens.set(refreshToken, {
    userId: user.id,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return { accessToken, refreshToken };
}

export function refreshAccessToken(refreshToken) {
  const tokenData = refreshTokens.get(refreshToken);
  if (!tokenData || tokenData.expiresAt < Date.now()) {
    return null;
  }

  const user = USERS[tokenData.userId];
  return generateToken(user);
}
```

**Step 3: Add refresh endpoint**
```javascript
// server.js or routes file
router.post('/api/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  const newAccessToken = refreshAccessToken(refreshToken);

  if (!newAccessToken) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  res.json({ accessToken: newAccessToken });
});
```

**Step 4: Add logout with token blacklist**
```javascript
// Use Redis in production
const tokenBlacklist = new Set();

export function logout(token) {
  const decoded = verifyToken(token);
  if (decoded) {
    tokenBlacklist.add(token);
    // Set expiry in Redis: client.setex(token, decoded.exp - Math.floor(Date.now() / 1000), '1');
  }
}

// Update authenticate middleware
export function authenticateJWT(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ error: 'Token has been revoked' });
  }

  // ... rest of logic
}
```

**Files:**
- [ ] `/home/user/FGD/middleware/auth.js`
- [ ] `/home/user/FGD/server.js` (add refresh endpoint)

**Testing:**
```bash
# Login and get tokens
curl -X POST http://localhost:3000/api/auth/login \
  -d '{"username":"admin","password":"password"}' \
  -H "Content-Type: application/json"
# Response: { accessToken, refreshToken }

# Use access token (should work for 1 hour)
curl -H "Authorization: Bearer $ACCESS_TOKEN" http://localhost:3000/api/bots

# After 1 hour, refresh
curl -X POST http://localhost:3000/api/auth/refresh \
  -d '{"refreshToken":"'$REFRESH_TOKEN'"}' \
  -H "Content-Type: application/json"
# Response: { accessToken }
```

---

### P1-3: Optimize Dashboard Polling
**Effort:** 4 hours
**Priority:** High
**Impact:** Reduces server load by 91%, improves performance

**Current Issue:** 4 HTTP requests every 5 seconds = 2,880 requests/hour per user

**Option A: Switch to WebSocket Push (Recommended)**
```javascript
// dashboard.js - REMOVE polling, use WebSocket
socket.on('cluster:update', (data) => {
  renderClusterNodes(data.nodes);
});

socket.on('metrics:update', (data) => {
  updateMetricsHistory(data);
  renderCharts();
});

// Backend: Emit events on data change instead of polling
```

**Option B: Increase Polling Interval**
```javascript
// dashboard.js line 25
POLLING_INTERVAL: 30000  // Changed from 5000 (30 seconds)
```

**Files:**
- [ ] `/home/user/FGD/dashboard.js` (remove polling or increase interval)
- [ ] `/home/user/FGD/src/websocket/handlers.js` (add push events if WebSocket option)

**Testing:**
```bash
# Monitor network requests in browser DevTools
# Should see: 0 polling requests (WebSocket) OR 2 requests/minute (30s polling)
```

---

### P1-4: Implement Missing API Endpoints
**Effort:** 3 hours
**Priority:** High
**Impact:** Dashboard will load complete data

**Missing Endpoints:**
1. `/data/cluster_status.json` (called in dashboard.js:473)
2. `/data/metrics.json` (called in dashboard.js:534)

**Option A: Create Static JSON Endpoints**
```javascript
// src/api/cluster.js
router.get('/data/cluster_status.json', async (req, res) => {
  // Same logic as /api/cluster but returns specific format
  const nodes = await getClusterStatus();
  res.json({ nodes, timestamp: Date.now() });
});

router.get('/data/metrics.json', async (req, res) => {
  const metrics = await getMetrics();
  res.json(metrics);
});
```

**Option B: Update Frontend to Use Existing Endpoints**
```javascript
// dashboard.js line 473
// Change from:
const response = await fetch('/data/cluster_status.json');

// Change to:
const response = await fetch('/api/cluster');
```

**Files:**
- [ ] `/home/user/FGD/src/api/cluster.js` (add endpoints) OR
- [ ] `/home/user/FGD/dashboard.js` (update endpoint URLs)

---

### P1-5: Resolve Route Conflicts
**Effort:** 4 hours
**Priority:** High
**Impact:** Predictable API behavior, clear versioning

**Issue:** Both `mineflayer.js` and `mineflayer_v2.js` mounted at `/api/mineflayer`

**Duplicate Endpoints:**
- POST /api/mineflayer/:botId/task
- POST /api/mineflayer/:botId/move
- POST /api/mineflayer/:botId/chat
- POST /api/mineflayer/:botId/mine

**Solution Options:**

**Option A: Use Path Versioning**
```javascript
// server.js
import mineflayerV1Routes from './routes/mineflayer.js';
import mineflayerV2Routes from './routes/mineflayer_v2.js';

app.use('/api/v1/mineflayer', mineflayerV1Routes);
app.use('/api/v2/mineflayer', mineflayerV2Routes);
```

**Option B: Consolidate into Single File**
- Merge `mineflayer_v2.js` policy features into `mineflayer.js`
- Remove `mineflayer_v2.js`
- Add policy approval as optional middleware

**Recommended:** Option A (versioning)

**Files:**
- [ ] `/home/user/FGD/server.js` (update route mounting)
- [ ] `/home/user/FGD/routes/mineflayer.js` (document as v1)
- [ ] `/home/user/FGD/routes/mineflayer_v2.js` (document as v2)
- [ ] Update any frontend calls to use `/api/v2/mineflayer` for policy features

---

### P1-6: Add Input Validation
**Effort:** 8 hours
**Priority:** High
**Impact:** Prevents SQL injection, data corruption, improves error messages

**Install Zod:**
```bash
npm install zod
```

**Create Validation Schemas:**
```javascript
// src/validators/bot.schemas.js
import { z } from 'zod';

export const createBotSchema = z.object({
  name: z.string().max(100).optional(),
  role: z.enum(['miner', 'builder', 'scout', 'guard', 'gatherer']),
  description: z.string().max(500).optional(),
  personality: z.object({
    curiosity: z.number().min(0).max(1),
    patience: z.number().min(0).max(1),
    motivation: z.number().min(0).max(1),
    empathy: z.number().min(0).max(1),
    aggression: z.number().min(0).max(1),
    creativity: z.number().min(0).max(1),
    loyalty: z.number().min(0).max(1),
  }).optional()
});

export const updateBotSchema = z.object({
  name: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  personality: z.object({
    curiosity: z.number().min(0).max(1).optional(),
    // ... other fields
  }).optional()
});
```

**Create Validation Middleware:**
```javascript
// src/middleware/validate.js
export function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
  };
}
```

**Apply to Routes:**
```javascript
// routes/bot.js
import { createBotSchema, updateBotSchema } from '../src/validators/bot.schemas.js';
import { validate } from '../src/middleware/validate.js';

router.post('/api/bots',
  authenticate,
  requirePermission('write'),
  validate(createBotSchema),
  async (req, res) => {
    // req.body is now validated
  }
);
```

**Files to Update:**
- [ ] Create `/home/user/FGD/src/validators/` directory
- [ ] Create schemas for: bots, npcs, config, policy, progression
- [ ] `/home/user/FGD/routes/bot.js`
- [ ] `/home/user/FGD/routes/mineflayer.js`
- [ ] `/home/user/FGD/src/api/npcs.js`
- [ ] `/home/user/FGD/src/api/cluster.js`
- [ ] `/home/user/FGD/src/api/progression.js`

**Testing:**
```bash
# Test invalid data
curl -X POST http://localhost:3000/api/bots \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"role":"invalid-role"}'
# Expected: 400 with validation details

# Test valid data
curl -X POST http://localhost:3000/api/bots \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"role":"miner","name":"Bot1"}'
# Expected: 201 Created
```

---

### P1-7: Optimize Chart Rendering
**Effort:** 2 hours
**Priority:** High
**Impact:** Eliminates UI flicker, improves performance

**Current Issue:** Charts destroyed and recreated every 5 seconds

**Fix:**
```javascript
// dashboard.js lines 198-200
// BEFORE (destroys chart):
if (chartInstances.cpu) {
  chartInstances.cpu.destroy();
}
chartInstances.cpu = new Chart(ctx, config);

// AFTER (updates data):
if (chartInstances.cpu) {
  chartInstances.cpu.data.labels = newLabels;
  chartInstances.cpu.data.datasets[0].data = newData;
  chartInstances.cpu.update('none'); // No animation for better performance
} else {
  chartInstances.cpu = new Chart(ctx, config);
}
```

**Files:**
- [ ] `/home/user/FGD/dashboard.js` (renderCPUChart, renderMemoryChart, renderQueueChart, renderLatencyChart)
- [ ] `/home/user/FGD/fusion.js` (renderChart function)

**Testing:**
```bash
# Open dashboard in browser
# Watch for visual flicker on chart updates
# Should be smooth with no flashing
```

---

### P1-8: Add Gzip Compression
**Effort:** 30 minutes
**Priority:** High
**Impact:** 60% reduction in payload size

**Install:**
```bash
npm install compression
```

**Implementation:**
```javascript
// src/config/server.js
import compression from 'compression';

export function createAppServer() {
  const app = express();

  // Add BEFORE static file serving
  app.use(compression({
    threshold: 1024,  // Only compress files > 1KB
    level: 6,         // Compression level (0-9)
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));

  app.use(express.static(ROOT_DIR));
  // ... rest of config
}
```

**Files:**
- [ ] `/home/user/FGD/src/config/server.js`

**Testing:**
```bash
# Check compression headers
curl -H "Accept-Encoding: gzip" -I http://localhost:3000/style.css
# Should see: Content-Encoding: gzip

# Verify size reduction
curl -H "Accept-Encoding: gzip" http://localhost:3000/style.css | wc -c
# Should be ~6-7KB instead of 18KB
```

---

## 🟡 P2: MEDIUM PRIORITY (Fix Next Sprint)

**Total Estimated Effort:** 25 hours

### P2-1: Extract Shared Chart Utility
**Effort:** 3 hours
**Impact:** Eliminates 200+ lines of duplicate code

**Create Shared Module:**
```javascript
// utils/charts.js
export class ChartManager {
  static createLineChart(canvasId, label, data, color) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return null;

    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label,
          data: data.values,
          borderColor: color,
          backgroundColor: `${color}33`,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  static updateChart(chartInstance, newLabels, newData) {
    if (!chartInstance) return;
    chartInstance.data.labels = newLabels;
    chartInstance.data.datasets[0].data = newData;
    chartInstance.update('none');
  }
}
```

**Usage:**
```javascript
// dashboard.js
import { ChartManager } from './utils/charts.js';

chartInstances.cpu = ChartManager.createLineChart(
  'cpuChart',
  'CPU Utilization %',
  { labels: timestamps, values: cpuData },
  CONFIG.CHART_COLORS.cpu
);
```

**Files:**
- [ ] Create `/home/user/FGD/utils/charts.js`
- [ ] Update `/home/user/FGD/dashboard.js`
- [ ] Update `/home/user/FGD/fusion.js`

---

### P2-2: Move Admin Styles to style.css
**Effort:** 1 hour
**Impact:** Consistent theming, reduced HTML file size

**Steps:**
1. Copy all styles from `<style>` tag in admin.html
2. Append to style.css
3. Remove `<style>` tag from admin.html
4. Add `<link rel="stylesheet" href="style.css">` to admin.html

**Files:**
- [ ] `/home/user/FGD/admin.html` (remove inline styles)
- [ ] `/home/user/FGD/style.css` (add admin styles)

---

### P2-3: Standardize Error Response Format
**Effort:** 4 hours
**Impact:** Easier client-side error handling

**Standard Format:**
```javascript
{
  success: false,
  status: 400,
  error: "ValidationError",
  message: "Invalid input data",
  details: { field: "role", issue: "must be one of: miner, builder, scout" }
}
```

**Create Error Handler:**
```javascript
// src/utils/responses.js
export class ApiResponse {
  static success(data, message = 'Success') {
    return { success: true, message, data };
  }

  static error(status, error, message, details = null) {
    return { success: false, status, error, message, details };
  }
}
```

**Update All Routes:**
```javascript
// Before:
return res.status(400).json({ error: 'Invalid input' });

// After:
return res.status(400).json(
  ApiResponse.error(400, 'ValidationError', 'Invalid input', validationDetails)
);
```

**Files to Update:** All route files (15+ files)

---

### P2-4: Move API Keys to HTTP-Only Cookies
**Effort:** 3 hours
**Impact:** Protection against XSS attacks

**Backend Changes:**
```javascript
// middleware/auth.js
export function handleLogin(req, res) {
  // ... validate user
  const token = generateToken(user);

  // Set HTTP-only cookie
  res.cookie('authToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600000 // 1 hour
  });

  res.json({ success: true, user });
}
```

**Frontend Changes:**
```javascript
// admin.js
// REMOVE localStorage usage
// Browser automatically sends cookie

async function login(apiKey) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include', // Include cookies
    body: JSON.stringify({ apiKey })
  });
}
```

**Files:**
- [ ] `/home/user/FGD/middleware/auth.js`
- [ ] `/home/user/FGD/admin.js`

---

### P2-5: Create Shared Utility Modules
**Effort:** 6 hours
**Impact:** Code reusability, easier maintenance

**Create:**
- [ ] `/home/user/FGD/utils/api.js` - Centralized fetch wrapper
- [ ] `/home/user/FGD/utils/validation.js` - Client-side validation
- [ ] `/home/user/FGD/utils/formatting.js` - Format functions
- [ ] `/home/user/FGD/utils/notifications.js` - Toast system

**Example - API Utility:**
```javascript
// utils/api.js
export class ApiClient {
  static async request(endpoint, options = {}) {
    const response = await fetch(endpoint, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(data.error || 'Request failed', response.status, data);
    }

    return data;
  }

  static get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  static post(endpoint, body) {
    return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) });
  }
}

class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
```

---

### P2-6: Add Database Indexes
**Effort:** 2 hours
**Impact:** Faster queries at scale

**Review Schema and Add Indexes:**
```sql
-- src/database/schema.js or migration file
CREATE INDEX idx_npcs_status ON npcs(status);
CREATE INDEX idx_npcs_role ON npcs(role);
CREATE INDEX idx_npcs_created_at ON npcs(created_at DESC);
CREATE INDEX idx_learning_npc_id ON learning_profiles(npc_id);
CREATE INDEX idx_learning_updated_at ON learning_profiles(updated_at DESC);
```

**Files:**
- [ ] `/home/user/FGD/src/database/schema.js`

---

### P2-7: Add Client-Side Form Validation
**Effort:** 2 hours
**Impact:** Better UX, reduced invalid requests

**Example:**
```javascript
// admin.js - Create Bot Form
function validateCreateBotForm() {
  const role = document.getElementById('botRole').value;
  const name = document.getElementById('botName').value;

  const errors = [];

  if (!role) {
    errors.push('Role is required');
  }

  if (name && name.length > 100) {
    errors.push('Name must be less than 100 characters');
  }

  if (errors.length > 0) {
    showNotification(errors.join(', '), 'error');
    return false;
  }

  return true;
}

async function handleCreateBot(e) {
  e.preventDefault();

  if (!validateCreateBotForm()) {
    return;
  }

  // Proceed with API call
}
```

**Files:**
- [ ] `/home/user/FGD/admin.js`
- [ ] `/home/user/FGD/dashboard.js` (policy form)

---

### P2-8: Add Loading States
**Effort:** 2 hours
**Impact:** Better UX during API calls

**Implementation:**
```javascript
// Create loading overlay component
function showLoading(message = 'Loading...') {
  const overlay = document.createElement('div');
  overlay.id = 'loading-overlay';
  overlay.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
      <p>${message}</p>
    </div>
  `;
  document.body.appendChild(overlay);
}

function hideLoading() {
  document.getElementById('loading-overlay')?.remove();
}

// Use in API calls
async function loadBots() {
  showLoading('Loading bots...');
  try {
    const bots = await apiCall('/api/bots');
    renderBots(bots);
  } finally {
    hideLoading();
  }
}
```

**Files:**
- [ ] `/home/user/FGD/admin.js`
- [ ] `/home/user/FGD/dashboard.js`
- [ ] `/home/user/FGD/style.css` (add loading styles)

---

### P2-9: Add Security Headers
**Effort:** 1 hour
**Impact:** Defense-in-depth security

**Install:**
```bash
npm install helmet
```

**Implementation:**
```javascript
// server.js or src/config/server.js
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

**Files:**
- [ ] `/home/user/FGD/server.js` or `/home/user/FGD/src/config/server.js`

---

### P2-10: Add API Documentation
**Effort:** 4 hours
**Impact:** Better developer experience

**Install:**
```bash
npm install swagger-jsdoc swagger-ui-express
```

**Implementation:**
```javascript
// server.js
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AICraft Cluster Dashboard API',
      version: '2.1.0',
      description: 'API for managing Minecraft NPC bots'
    },
    servers: [{ url: 'http://localhost:3000' }]
  },
  apis: ['./routes/*.js', './src/api/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

**Add JSDoc comments to routes:**
```javascript
/**
 * @swagger
 * /api/bots:
 *   post:
 *     summary: Create a new bot
 *     tags: [Bots]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [miner, builder, scout, guard, gatherer]
 *     responses:
 *       201:
 *         description: Bot created successfully
 */
router.post('/api/bots', ...);
```

**Files:**
- [ ] `/home/user/FGD/server.js`
- [ ] All route files (add JSDoc)

---

## 🔵 LOW PRIORITY (Technical Debt / Future Enhancements)

### LP-1: Consider Adding ORM (Prisma)
**Effort:** 16 hours
**Benefits:** Type safety, migrations, better query interface

---

### LP-2: Add Comprehensive Test Coverage
**Effort:** 40 hours
**Target:** 80% code coverage

---

### LP-3: Convert to TypeScript
**Effort:** 60 hours
**Benefits:** Type safety, better IDE support

---

### LP-4: Implement Service Worker
**Effort:** 6 hours
**Benefits:** Offline support, faster loading

---

### LP-5: Add Monitoring & Logging (Winston + Prometheus)
**Effort:** 8 hours
**Benefits:** Better observability

---

## SUMMARY

**Total Issues Identified:** 35+

**Priority Breakdown:**
- 🔴 P0 (Critical): 6 issues = 6 hours
- 🟠 P1 (High): 8 issues = 30 hours
- 🟡 P2 (Medium): 10 issues = 25 hours
- 🔵 Low: 11+ issues = 130+ hours

**Recommended Timeline:**
- **Week 1:** P0 issues (6 hours) - Security fixes
- **Week 2-3:** P1 issues (30 hours) - Core functionality
- **Month 2:** P2 issues (25 hours) - Polish and optimization
- **Month 3+:** Low priority (technical debt)

**Critical Path:**
1. Fix security vulnerabilities (P0)
2. Install build dependencies (P0)
3. Add rate limiting (P1)
4. Implement validation (P1)
5. Optimize performance (P1)

---

**Next Steps:**
1. Review this TODO list with team
2. Assign priorities and owners
3. Create sprint plan
4. Start with P0 security fixes
5. Set up CI/CD testing

**Report Generated:** 2025-11-18
**Source:** Comprehensive End-to-End Review (Agent Loop Mode)
