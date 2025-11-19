#!/bin/bash

# CORS Testing Script with curl
# This script demonstrates CORS security with practical examples

echo -e "\n\033[1;36m=== CORS Security Testing with curl ===\033[0m\n"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Server URL (change if needed)
SERVER_URL="http://localhost:3000"
TEST_ENDPOINT="/api/test"

echo -e "${YELLOW}Note: Make sure the server is running with 'npm start' before running these tests${NC}\n"

# Test 1: Request with allowed origin
echo -e "${BLUE}Test 1: Request with ALLOWED origin (http://localhost:3000)${NC}"
echo "Command: curl -v -H 'Origin: http://localhost:3000' ${SERVER_URL}${TEST_ENDPOINT}"
echo ""
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -H "Origin: http://localhost:3000" -H "Content-Type: application/json" ${SERVER_URL}${TEST_ENDPOINT} 2>&1)
http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)

if [ "$http_status" = "200" ]; then
    echo -e "${GREEN}✓ PASS: Request accepted (Status: 200)${NC}"
else
    echo -e "${RED}✗ FAIL: Request rejected (Status: ${http_status})${NC}"
fi
echo -e "Expected: ${GREEN}200 OK with Access-Control-Allow-Origin: http://localhost:3000${NC}\n"

# Test 2: Request with another allowed origin
echo -e "${BLUE}Test 2: Request with ALLOWED origin (http://localhost:8080)${NC}"
echo "Command: curl -v -H 'Origin: http://localhost:8080' ${SERVER_URL}${TEST_ENDPOINT}"
echo ""
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -H "Origin: http://localhost:8080" -H "Content-Type: application/json" ${SERVER_URL}${TEST_ENDPOINT} 2>&1)
http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)

if [ "$http_status" = "200" ]; then
    echo -e "${GREEN}✓ PASS: Request accepted (Status: 200)${NC}"
else
    echo -e "${RED}✗ FAIL: Request rejected (Status: ${http_status})${NC}"
fi
echo -e "Expected: ${GREEN}200 OK with Access-Control-Allow-Origin: http://localhost:8080${NC}\n"

# Test 3: Request with disallowed origin
echo -e "${BLUE}Test 3: Request with DISALLOWED origin (http://malicious-site.com)${NC}"
echo "Command: curl -v -H 'Origin: http://malicious-site.com' ${SERVER_URL}${TEST_ENDPOINT}"
echo ""
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -H "Origin: http://malicious-site.com" -H "Content-Type: application/json" ${SERVER_URL}${TEST_ENDPOINT} 2>&1)
http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)

if [ "$http_status" = "403" ]; then
    echo -e "${GREEN}✓ PASS: Request properly rejected (Status: 403)${NC}"
else
    echo -e "${RED}✗ FAIL: Request not rejected (Status: ${http_status})${NC}"
fi
echo -e "Expected: ${GREEN}403 Forbidden with CORS error message${NC}\n"

# Test 4: Request with another disallowed origin
echo -e "${BLUE}Test 4: Request with DISALLOWED origin (https://evil.com)${NC}"
echo "Command: curl -v -H 'Origin: https://evil.com' ${SERVER_URL}${TEST_ENDPOINT}"
echo ""
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -H "Origin: https://evil.com" -H "Content-Type: application/json" ${SERVER_URL}${TEST_ENDPOINT} 2>&1)
http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)

if [ "$http_status" = "403" ]; then
    echo -e "${GREEN}✓ PASS: Request properly rejected (Status: 403)${NC}"
else
    echo -e "${RED}✗ FAIL: Request not rejected (Status: ${http_status})${NC}"
fi
echo -e "Expected: ${GREEN}403 Forbidden with CORS error message${NC}\n"

# Test 5: Request with no origin (like curl/mobile apps)
echo -e "${BLUE}Test 5: Request with NO origin header (curl/mobile/server-to-server)${NC}"
echo "Command: curl -v ${SERVER_URL}${TEST_ENDPOINT}"
echo ""
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -H "Content-Type: application/json" ${SERVER_URL}${TEST_ENDPOINT} 2>&1)
http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)

if [ "$http_status" = "200" ]; then
    echo -e "${GREEN}✓ PASS: Request accepted (Status: 200)${NC}"
else
    echo -e "${RED}✗ FAIL: Request rejected (Status: ${http_status})${NC}"
fi
echo -e "Expected: ${GREEN}200 OK (allows requests without Origin header)${NC}\n"

# Test 6: OPTIONS preflight request
echo -e "${BLUE}Test 6: OPTIONS preflight request with allowed origin${NC}"
echo "Command: curl -v -X OPTIONS -H 'Origin: http://localhost:3000' ${SERVER_URL}${TEST_ENDPOINT}"
echo ""
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X OPTIONS -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: Content-Type" ${SERVER_URL}${TEST_ENDPOINT} 2>&1)
http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)

if [ "$http_status" = "204" ] || [ "$http_status" = "200" ]; then
    echo -e "${GREEN}✓ PASS: Preflight accepted (Status: ${http_status})${NC}"
else
    echo -e "${RED}✗ FAIL: Preflight rejected (Status: ${http_status})${NC}"
fi
echo -e "Expected: ${GREEN}204 No Content with CORS headers${NC}\n"

echo -e "${BLUE}=== Detailed Examples ===${NC}\n"

echo -e "${YELLOW}To see full response headers, use -v flag:${NC}"
echo "curl -v -H 'Origin: http://localhost:3000' ${SERVER_URL}${TEST_ENDPOINT}"
echo ""

echo -e "${YELLOW}To test with credentials:${NC}"
echo "curl -v --cookie 'session=abc123' -H 'Origin: http://localhost:3000' ${SERVER_URL}${TEST_ENDPOINT}"
echo ""

echo -e "${YELLOW}To test POST request:${NC}"
echo "curl -v -X POST -H 'Origin: http://localhost:3000' -H 'Content-Type: application/json' -d '{\"test\":\"data\"}' ${SERVER_URL}${TEST_ENDPOINT}"
echo ""

echo -e "${GREEN}Tests complete!${NC}\n"
