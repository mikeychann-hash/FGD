#!/bin/bash

################################################################################
# System Requirements Check
# Run this to diagnose any installation issues
################################################################################

echo "=== System Diagnostics ==="
echo ""

echo "1. Checking Node.js..."
if command -v node &> /dev/null; then
    echo "   ✓ Node.js is installed"
    echo "   Version: $(node --version)"
    echo "   Path: $(which node)"
else
    echo "   ✗ Node.js is NOT installed"
    echo "   Please install from: https://nodejs.org/"
fi
echo ""

echo "2. Checking npm..."
if command -v npm &> /dev/null; then
    echo "   ✓ npm is installed"
    echo "   Version: $(npm --version)"
    echo "   Path: $(which npm)"
else
    echo "   ✗ npm is NOT installed"
fi
echo ""

echo "3. Checking current directory..."
echo "   Current dir: $(pwd)"
if [ -f "package.json" ]; then
    echo "   ✓ package.json found"
else
    echo "   ✗ package.json NOT found"
fi
if [ -f "server.js" ]; then
    echo "   ✓ server.js found"
else
    echo "   ✗ server.js NOT found"
fi
echo ""

echo "4. Checking dependencies..."
if [ -d "node_modules" ]; then
    echo "   ✓ node_modules directory exists"
    MODULE_COUNT=$(find node_modules -maxdepth 1 -type d | wc -l)
    echo "   Installed packages: $((MODULE_COUNT - 1))"
else
    echo "   ⚠ node_modules NOT found (run: npm install)"
fi
echo ""

echo "5. Checking port 3000..."
if command -v lsof &> /dev/null; then
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "   ⚠ Port 3000 is IN USE"
        echo "   Process: $(lsof -Pi :3000 -sTCP:LISTEN | tail -1)"
    else
        echo "   ✓ Port 3000 is available"
    fi
else
    echo "   ⚠ lsof not available (cannot check port)"
fi
echo ""

echo "=== Recommended Actions ==="
if ! command -v node &> /dev/null; then
    echo "→ Install Node.js from https://nodejs.org/ (version 14 or higher)"
fi
if [ ! -d "node_modules" ]; then
    echo "→ Run: npm install"
fi
if ! [ -f "package.json" ]; then
    echo "→ Make sure you're in the FGD project directory"
fi
echo ""

echo "=== Try These Commands ==="
echo "  ./check-requirements.sh    # Run this diagnostic again"
echo "  npm install                # Install dependencies"
echo "  ./quick-start.sh           # Start the server"
echo "  ./start-server.sh --help   # See all startup options"
echo ""
