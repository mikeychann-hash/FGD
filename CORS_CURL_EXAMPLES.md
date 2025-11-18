# CORS Testing - Practical curl Examples

## Quick Reference Guide

### 1. Test with Allowed Origin (Should Work)

```bash
curl -v -H "Origin: http://localhost:3000" http://localhost:3000/api/test
```

**Expected:**
- ✅ Status: 200 OK
- ✅ Header: `Access-Control-Allow-Origin: http://localhost:3000`
- ✅ Header: `Access-Control-Allow-Credentials: true`

---

### 2. Test with Disallowed Origin (Should Fail)

```bash
curl -v -H "Origin: http://malicious-site.com" http://localhost:3000/api/test
```

**Expected:**
- ✅ Status: 403 Forbidden
- ✅ Response:
  ```json
  {
    "error": "CORS Policy Violation",
    "message": "Origin not allowed"
  }
  ```

---

### 3. Test Without Origin (Should Work)

```bash
curl -v http://localhost:3000/api/test
```

**Expected:**
- ✅ Status: 200 OK
- ✅ Allows requests without Origin (mobile apps, server-to-server)

---

### 4. Test OPTIONS Preflight

```bash
curl -v -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  http://localhost:3000/api/test
```

**Expected:**
- ✅ Status: 204 No Content
- ✅ Header: `Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS`

---

### 5. Test POST with Allowed Origin

```bash
curl -v -X POST \
  -H "Origin: http://localhost:3000" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}' \
  http://localhost:3000/api/test
```

**Expected:**
- ✅ Status: 200 OK (or appropriate status for endpoint)
- ✅ Header: `Access-Control-Allow-Origin: http://localhost:3000`

---

### 6. Test with Credentials

```bash
curl -v --cookie "session=abc123" \
  -H "Origin: http://localhost:3000" \
  http://localhost:3000/api/test
```

**Expected:**
- ✅ Status: 200 OK
- ✅ Header: `Access-Control-Allow-Credentials: true`

---

## Quick Test Script

Run all tests at once:

```bash
./test-curl-cors.sh
```

Or use automated tests:

```bash
# HTTP/Express CORS tests
node test-cors.js

# WebSocket/Socket.IO CORS tests
node test-websocket-cors.js
```

---

## Production Testing

Replace `localhost:3000` with your production domain:

```bash
# Test allowed production origin
curl -v -H "Origin: https://yourdomain.com" https://yourdomain.com/api/test

# Test disallowed origin
curl -v -H "Origin: https://attacker.com" https://yourdomain.com/api/test
```

---

## Common Headers Explained

| Header | Purpose |
|--------|---------|
| `Origin` | Tells server which domain is making the request |
| `Access-Control-Allow-Origin` | Server tells browser which origins are allowed |
| `Access-Control-Allow-Credentials` | Server allows cookies/auth |
| `Access-Control-Allow-Methods` | Server tells which HTTP methods are allowed |
| `Access-Control-Request-Method` | Preflight asks what methods are allowed |

---

## Security Notes

1. **Never use `origin: "*"` in production** - Current implementation is secure
2. **Always use HTTPS in production** - Prevents man-in-the-middle attacks
3. **Credentials require specific origin** - Cannot use wildcard with credentials
4. **Test both allowed and disallowed origins** - Verify security works both ways

---

## Troubleshooting

### Issue: "Origin not allowed by CORS"

**Solution:** Check that the origin exactly matches (including protocol and port):
- ✅ Correct: `http://localhost:3000`
- ❌ Wrong: `localhost:3000` (missing protocol)
- ❌ Wrong: `http://localhost:3000/` (trailing slash)

### Issue: No CORS headers in response

**Solution:** Ensure you're sending the `Origin` header in your request

### Issue: Preflight failing

**Solution:** Check that OPTIONS method is allowed and proper headers are sent

---

For more details, see `CORS_TESTING_GUIDE.md`
