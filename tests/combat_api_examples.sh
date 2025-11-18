#!/bin/bash
#
# Combat System API Testing Examples
# Usage: ./combat_api_examples.sh <bot-id>
#

BOT_ID=${1:-"test-bot-1"}
BASE_URL="http://localhost:3000"
AUTH_TOKEN="${AUTH_TOKEN:-your-jwt-token-here}"

echo "=========================================="
echo "Combat System API Testing"
echo "Bot ID: $BOT_ID"
echo "=========================================="
echo ""

# Test 1: Get bot state (health, food)
echo "TEST 1: Get Bot State"
echo "---"
curl -s -X GET "$BASE_URL/api/mineflayer/$BOT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" | jq '.bot | {health, food, position}'
echo ""

# Test 2: Find target
echo "TEST 2: Find Target (zombie)"
echo "---"
curl -s -X POST "$BASE_URL/api/mineflayer/$BOT_ID/combat" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subAction": "target",
    "entityType": "zombie",
    "range": 16
  }' | jq '.'
echo ""

# Test 3: Prepare for combat (equip armor and weapons)
echo "TEST 3: Prepare for Combat (Defend)"
echo "---"
curl -s -X POST "$BASE_URL/api/mineflayer/$BOT_ID/combat" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subAction": "defend",
    "timeout": 5000
  }' | jq '.'
echo ""

# Test 4: Attack nearest zombie
echo "TEST 4: Attack Nearest Zombie"
echo "---"
curl -s -X POST "$BASE_URL/api/mineflayer/$BOT_ID/combat/attack" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entityType": "zombie",
    "range": 16,
    "timeout": 30000,
    "autoWeapon": true
  }' | jq '.'
echo ""

# Test 5: Evade from threats
echo "TEST 5: Evade from Threats"
echo "---"
curl -s -X POST "$BASE_URL/api/mineflayer/$BOT_ID/combat" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subAction": "evade",
    "range": 16,
    "timeout": 10000
  }' | jq '.'
echo ""

# Test 6: Check final state
echo "TEST 6: Check Final Bot State"
echo "---"
curl -s -X GET "$BASE_URL/api/mineflayer/$BOT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" | jq '.bot | {health, food, position}'
echo ""

echo "=========================================="
echo "Testing Complete"
echo "=========================================="
