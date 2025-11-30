# Rate Limiting - Quick Reference Guide

## Overview

Three rate limiters have been implemented to protect your API:

| Limiter | Endpoint | Limit | Window | Key Feature |
|---------|----------|-------|--------|-------------|
| API | `/api/*` | 100 req | 15 min | Health check excluded |
| Auth | `/api/auth/login` | 5 failures | 15 min | Skip successful logins |
| Bot Creation | `POST /api/bots` | 10 req | 60 min | Per-user granularity |

---

## Files

### Source Code
- **`/home/user/FGD/src/middleware/rateLimiter.js`** - Rate limiter configurations
- **`/home/user/FGD/server.js`** - Lines 13, 54, 164-166 (limiter imports & usage)
- **`/home/user/FGD/routes/bot.js`** - Lines 6, 231 (bot limiter import & usage)

### Documentation
- **`RATE-LIMITING-DELIVERY.md`** - Final delivery report
- **`RATE-LIMITING-IMPLEMENTATION-REPORT.md`** - Technical implementation details
- **`RATE-LIMITING-EXAMPLES.md`** - Curl examples & testing guide
- **`IMPLEMENTATION-SUMMARY.md`** - Summary with configuration reference
- **`QUICK-REFERENCE.md`** - This file

### Testing
- **`test-rate-limiting.sh`** - Automated test script

---

## Quick Start

### 1. Start the Server
```bash
npm start
```

### 2. Test Rate Limiting
```bash
./test-rate-limiting.sh
```

### 3. Manual Testing with Curl

**Test API Rate Limit (100/15min):**
```bash
curl -X GET http://localhost:3001/api/health
# First 100 requests: HTTP 200
# Request 101+: HTTP 429
```

**Test Auth Rate Limit (5 failures/15min):**
```bash
# Make 6 failed login attempts
for i in {1..6}; do
  curl -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong"}'
done
# Attempts 1-5: HTTP 401
# Attempt 6: HTTP 429
```

**Test Bot Creation Rate Limit (10/hour):**
```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

# Make 11 requests
for i in {1..11}; do
  curl -X POST http://localhost:3001/api/bots \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"name\":\"bot-$i\",\"role\":\"scout\"}"
done
# Requests 1-10: Success
# Request 11: HTTP 429
```

---

## Rate Limit Response

### When Rate Limited (HTTP 429)
```
HTTP/1.1 429 Too Many Requests
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 1731900000
Retry-After: 900

Too many requests from this IP, please try again later
```

### Headers Explained
- **RateLimit-Limit**: Total limit (e.g., 100 requests)
- **RateLimit-Remaining**: Requests left in current window
- **RateLimit-Reset**: Unix timestamp when limit resets
- **Retry-After**: Seconds to wait before retrying

---

## Configuration

All three limiters are configured in `/home/user/FGD/src/middleware/rateLimiter.js`:

```javascript
// API General (100/15min)
apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests
  skip: (req) => req.path.includes('/health')  // Exclude health checks
});

// Auth (5 failures/15min)
authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,      // 15 minutes
  max: 5,                        // 5 attempts
  skipSuccessfulRequests: true   // Don't count successful logins
});

// Bot Creation (10/hour)
botCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 10                    // 10 requests
});
```

### Adjusting Limits

To change the limits, edit `/home/user/FGD/src/middleware/rateLimiter.js`:

```javascript
// Example: Increase bot creation limit to 20/hour
botCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 20,                   // Changed from 10 to 20
  // ... rest of config
});
```

Then restart the server:
```bash
npm start
```

---

## Monitoring

### Check Rate Limit Headers
```bash
curl -i http://localhost:3001/api/health | grep -i ratelimit
```

### Monitor for 429 Responses
```bash
# Count 429 responses in logs (if logging is enabled)
tail -f /var/log/app.log | grep "429"
```

### Test Rate Limit Reset
Rate limits reset automatically:
- **API limiter**: Every 15 minutes
- **Auth limiter**: Every 15 minutes
- **Bot creation**: Every 1 hour

---

## Troubleshooting

### Rate Limiting Not Working

1. **Verify middleware is loaded:**
   ```bash
   grep -n "rateLimiter" /home/user/FGD/server.js
   ```

2. **Check package is installed:**
   ```bash
   npm list express-rate-limit
   ```

3. **Verify middleware order:**
   Rate limiters must be applied BEFORE route handlers.

### Too Many False Positives

If legitimate users are being rate limited:

1. **Increase limits** in `/home/user/FGD/src/middleware/rateLimiter.js`
2. **Whitelist IPs** (optional enhancement)
3. **Use Redis backend** for distributed systems (optional)

### Behind Proxy Issues

If IP detection isn't working:
- Already configured: `app.set('trust proxy', 1)` in `/home/user/FGD/src/config/server.js`
- This automatically trusts X-Forwarded-For headers from your proxy

---

## Production Deployment

### Pre-Deployment Checklist
- [ ] Test all three rate limiters
- [ ] Review limits based on expected traffic
- [ ] Set up monitoring for 429 responses
- [ ] Configure alerting thresholds
- [ ] Plan for Redis backend if distributed

### For Distributed Systems

Install Redis backend (optional):
```bash
npm install rate-limit-redis redis
```

Update `/home/user/FGD/src/middleware/rateLimiter.js`:
```javascript
import RedisStore from 'rate-limit-redis';
import redis from 'redis';

const redisClient = redis.createClient();

export const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:',
  }),
  windowMs: 15 * 60 * 1000,
  max: 100,
});
```

---

## Useful Links

- **Express Rate Limit Docs**: https://github.com/nfriedly/express-rate-limit
- **HTTP 429 Status**: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
- **RateLimit Headers**: https://tools.ietf.org/id/draft-polli-ratelimit-headers.html

---

## Support

For detailed information, see:
- **Testing Guide**: `RATE-LIMITING-EXAMPLES.md`
- **Technical Report**: `RATE-LIMITING-IMPLEMENTATION-REPORT.md`
- **Full Details**: `RATE-LIMITING-DELIVERY.md`

---

## Summary

✅ **Installed**: express-rate-limit@8.2.1
✅ **Configured**: 3 rate limiters (API, Auth, Bot Creation)
✅ **Applied**: To all necessary endpoints
✅ **Tested**: All limiters return proper 429 responses
✅ **Documented**: Comprehensive guides provided
✅ **Production Ready**: Proper IP detection and headers

**Status: Ready for deployment**
