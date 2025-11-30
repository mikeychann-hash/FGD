# Rate Limiting Implementation - Testing Examples

This document provides curl examples and testing instructions for the rate limiting middleware.

## Middleware Overview

### Rate Limiting Configuration

1. **API General Rate Limiter**: 100 requests per 15 minutes on all `/api/*` routes
   - Health check endpoints are excluded
   - Applied globally before routing

2. **Auth Rate Limiter**: 5 login attempts per 15 minutes on `/api/auth/login`
   - Only counts failed login attempts
   - Rate limited per IP + username combination

3. **Bot Creation Rate Limiter**: 10 requests per hour on `POST /api/bots`
   - Applied per user
   - Rate limited per IP + username combination

## Testing Instructions

### Prerequisites
- Server running on `http://localhost:3001`
- Rate limiting middleware installed and configured
- Test script available at `/home/user/FGD/test-rate-limiting.sh`

### Test 1: API General Rate Limiting (100/15min)

To test the general API rate limiter, make multiple requests to any API endpoint within a 15-minute window:

```bash
# Make rapid requests to an API endpoint
for i in {1..105}; do
  curl -X GET http://localhost:3001/api/health \
    -H "Authorization: Bearer your_token"
  echo "Request $i sent"
  sleep 0.1
done
```

Expected behavior:
- First 100 requests: HTTP 200 OK
- 101st+ requests: HTTP 429 Too Many Requests
- Response body: `"Too many requests from this IP, please try again later"`

### Test 2: Auth Rate Limiting (5/15min)

To test the auth rate limiter, make 6 failed login attempts:

```bash
# Attempt 1-5: Valid auth response
for i in {1..5}; do
  curl -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "username": "testuser",
      "password": "wrongpassword"
    }'
  echo "Login attempt $i sent"
  sleep 1
done

# Attempt 6: Should be rate limited
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "wrongpassword"
  }'
```

Expected behavior:
- Attempts 1-5: HTTP 401 Unauthorized (authentication failed)
- Attempt 6: HTTP 429 Too Many Requests (rate limited)
- Response body: `"Too many login attempts, please try again later"`

#### Successful Login (Not Rate Limited)

Successful logins don't count toward the rate limit (skipSuccessfulRequests: true):

```bash
# This will NOT increment the rate limit counter
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "validuser",
    "password": "correctpassword"
  }'
```

### Test 3: Bot Creation Rate Limiting (10/hour)

To test the bot creation rate limiter, make 11 requests to create a bot:

```bash
# Generate authentication token first
TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }' | jq -r '.token')

# Attempt 1-10: Should succeed
for i in {1..10}; do
  curl -X POST http://localhost:3001/api/bots \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"name\": \"test-bot-$i\",
      \"role\": \"scout\",
      \"type\": \"explorer\"
    }"
  echo "Bot creation $i sent"
  sleep 1
done

# Attempt 11: Should be rate limited
curl -X POST http://localhost:3001/api/bots \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "test-bot-11",
    "role": "scout",
    "type": "explorer"
  }'
```

Expected behavior:
- Requests 1-10: HTTP 201 Created or 400 Bad Request (validation error)
- Request 11: HTTP 429 Too Many Requests (rate limited)
- Response body: `"Bot creation limit reached, please try again later"`

### Test 4: Rate Limit Headers

Each rate-limited response includes standard headers:

```bash
# Make a request and check the rate limit headers
curl -i http://localhost:3001/api/health
```

Response headers:
```
HTTP/1.1 200 OK
Content-Type: application/json
RateLimit-Limit: 100
RateLimit-Remaining: 99
RateLimit-Reset: 1731900000
```

### Test 5: Health Check Bypass (No Rate Limiting)

Health check endpoints are excluded from rate limiting:

```bash
# Make unlimited requests to health endpoint
for i in {1..200}; do
  curl -X GET http://localhost:3001/api/bots/health
  echo "Health check $i sent"
  sleep 0.01
done
```

Expected behavior:
- All requests: HTTP 200 OK
- Never rate limited, even with 200+ requests

## Automated Testing

Run the provided test script:

```bash
cd /home/user/FGD
./test-rate-limiting.sh
```

This script will:
1. Test API general rate limiting
2. Test auth rate limiting with multiple failed logins
3. Verify rate limit headers are present
4. Test bot creation rate limiting
5. Generate a comprehensive test report

## Rate Limit Bypass Scenarios

### IP Spoofing Considerations

The rate limiter uses the client IP address by default. Behind a reverse proxy, you may need to configure the app to trust the proxy's X-Forwarded-For header.

In `src/config/server.js`, the app is already configured:
```javascript
app.set('trust proxy', 1);
```

This ensures rate limiting works correctly with reverse proxies like nginx or Apache.

### Testing Rate Limiting Behind Proxy

```bash
# Test with X-Forwarded-For header
curl -X GET http://localhost:3001/api/health \
  -H "X-Forwarded-For: 192.168.1.100"
```

## Monitoring Rate Limits

### Checking Current Rate Limit Status

Rate limiting information can be monitored through:

1. **Response Headers**: Include remaining requests and reset time
2. **Logs**: Express middleware logs rate limit events
3. **Metrics**: Can be integrated with Prometheus for monitoring

Example metrics endpoint integration:
```javascript
// Add to /api/metrics endpoint
{
  "rate_limits": {
    "api": "100 requests per 15 minutes",
    "auth": "5 failed attempts per 15 minutes",
    "bot_creation": "10 per hour"
  }
}
```

## Configuration Reference

All rate limiting configurations are defined in `/home/user/FGD/src/middleware/rateLimiter.js`:

```javascript
// API Limiter
{
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // Max requests
  standardHeaders: true,      // Include rate limit headers
  legacyHeaders: false,       // Don't use older header format
  skip: (req) => req.path.includes('/health')  // Exclude health checks
}

// Auth Limiter
{
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                     // Max failed attempts
  skipSuccessfulRequests: true, // Don't count successful logins
  standardHeaders: true,
  keyGenerator: (req) => `${req.ip}-${req.body?.username}`  // Per user + IP
}

// Bot Creation Limiter
{
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 10,                    // Max requests
  standardHeaders: true,
  keyGenerator: (req) => `${req.ip}-${req.user?.username}`  // Per user + IP
}
```

## Troubleshooting

### Rate Limiting Not Working

1. **Verify middleware is loaded**:
   ```bash
   grep -n "rateLimiter" /home/user/FGD/server.js
   grep -n "rateLimiter" /home/user/FGD/routes/bot.js
   ```

2. **Check middleware order**: Rate limiting must be applied before route handlers

3. **Verify package installation**:
   ```bash
   npm list express-rate-limit
   ```

### Too Restrictive Limits

Adjust the configuration in `/home/user/FGD/src/middleware/rateLimiter.js`:
- Increase `max` value
- Increase `windowMs` value (in milliseconds)

### IP Address Detection Issues

Check that `app.set('trust proxy', 1)` is set in `/home/user/FGD/src/config/server.js`

## Production Recommendations

1. **Use Redis Store**: For distributed systems, use `rate-limit-redis` or `rate-limit-memcached`

2. **Dynamic Rate Limits**: Implement per-user or per-tier rate limits based on user subscription

3. **Whitelist Critical Endpoints**: Consider excluding critical endpoints from rate limiting

4. **Monitoring & Alerts**: Set up alerts when rate limit thresholds are exceeded

5. **Graceful Degradation**: Implement queuing for legitimate requests during traffic spikes

## References

- [express-rate-limit Documentation](https://github.com/nfriedly/express-rate-limit)
- [OWASP Rate Limiting Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [HTTP Status Code 429](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429)
