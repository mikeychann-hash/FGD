# CORS Security Testing Guide

This guide demonstrates how to test the CORS configuration to ensure proper security.

## Configuration

The CORS configuration is controlled via the `ALLOWED_ORIGINS` environment variable in `.env`:

```bash
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
```

## Testing with curl

### Test 1: Allowed Origin (Should Succeed)
```bash
curl -v -H "Origin: http://localhost:3000" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/test
```

**Expected Response:**
- Status: `200 OK`
- Header: `Access-Control-Allow-Origin: http://localhost:3000`
- Header: `Access-Control-Allow-Credentials: true`

### Test 2: Disallowed Origin (Should Fail)
```bash
curl -v -H "Origin: http://malicious-site.com" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/test
```

**Expected Response:**
- Status: `403 Forbidden`
- Body: `{"error":"CORS Policy Violation","message":"Origin not allowed"}`
- No `Access-Control-Allow-Origin` header

### Test 3: No Origin (Should Succeed)
```bash
curl -v http://localhost:3000/api/test
```

**Expected Response:**
- Status: `200 OK`
- Allows requests without origin (for mobile apps, server-to-server, etc.)

### Test 4: Preflight Request
```bash
curl -v -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  http://localhost:3000/api/test
```

**Expected Response:**
- Status: `204 No Content`
- Header: `Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS`
- Header: `Access-Control-Allow-Origin: http://localhost:3000`

## WebSocket Testing

### Test 1: WebSocket with Allowed Origin (Should Connect)

**JavaScript (Browser Console):**
```javascript
const socket = io('http://localhost:3000', {
  withCredentials: true,
  extraHeaders: {
    origin: 'http://localhost:3000'
  }
});

socket.on('connect', () => {
  console.log('✓ Connected successfully with allowed origin');
});

socket.on('connect_error', (error) => {
  console.error('✗ Connection failed:', error.message);
});
```

**Expected:** Connection succeeds

### Test 2: WebSocket with Disallowed Origin (Should Fail)

**JavaScript (Node.js script):**
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  withCredentials: true,
  extraHeaders: {
    origin: 'http://malicious-site.com'
  }
});

socket.on('connect', () => {
  console.log('✓ Connected (UNEXPECTED - SECURITY ISSUE!)');
});

socket.on('connect_error', (error) => {
  console.log('✗ Connection rejected (EXPECTED - Security working):', error.message);
});
```

**Expected:** Connection rejected with CORS error

## Production Deployment

### Environment Variables for Production

```bash
# .env (Production)
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

### Testing Production Configuration

```bash
# Test allowed production origin
curl -v -H "Origin: https://yourdomain.com" \
  -H "Content-Type: application/json" \
  https://yourdomain.com/api/test

# Test disallowed origin
curl -v -H "Origin: https://attacker.com" \
  -H "Content-Type: application/json" \
  https://yourdomain.com/api/test
```

## Security Checklist

- [x] Wildcard CORS (`origin: "*"`) removed
- [x] Origin whitelist implemented
- [x] Environment variable configuration added
- [x] Credentials support enabled with proper origin validation
- [x] Preflight requests handled correctly
- [x] Socket.IO CORS configured with same origin whitelist
- [x] Error handling for CORS violations
- [x] Development and production examples provided

## Automated Testing

Run the automated CORS test suite:

```bash
node test-cors.js
```

This will verify:
1. Allowed origins are accepted
2. Disallowed origins are rejected
3. Requests without origin are allowed (for mobile apps)
4. Preflight requests work correctly
5. Credentials are supported
6. Proper HTTP status codes are returned

## Common Issues

### Issue: CORS error even with allowed origin

**Solution:** Ensure the origin in the request exactly matches the whitelist (including protocol and port):
- ✓ `http://localhost:3000`
- ✗ `localhost:3000` (missing protocol)
- ✗ `http://localhost:3000/` (trailing slash)

### Issue: WebSocket connection fails

**Solution:** Verify Socket.IO client and server versions are compatible and origins are properly configured.

### Issue: Credentials not working

**Solution:** Ensure both client and server have credentials enabled:
- Server: `credentials: true` in CORS config
- Client: `withCredentials: true` in request/socket options

## Migration from Wildcard CORS

**Before (Insecure):**
```javascript
app.use(cors()); // Allows all origins
```

**After (Secure):**
```javascript
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
```

## References

- [OWASP CORS Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [MDN CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Socket.IO CORS Troubleshooting](https://socket.io/docs/v4/handling-cors/)
