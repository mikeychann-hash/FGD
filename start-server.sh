#!/bin/bash

################################################################################
# AICraft Cluster Dashboard - Server Startup Script
#
# This script handles all pre-flight checks and starts the server with proper
# error handling and validation.
#
# Usage:
#   ./start-server.sh [mode] [options]
#
# Modes:
#   prod      - Production mode (default)
#   dev       - Development mode with hot-reload
#   test      - Run tests only
#
# Options:
#   --port PORT       - Override default port (3000)
#   --log-level LEVEL - Set log level (DEBUG, INFO, WARN, ERROR, FATAL)
#   --no-install      - Skip dependency installation check
#   --help            - Show this help message
#
### END HELP ###

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check for help flag first
for arg in "$@"; do
    if [ "$arg" = "--help" ] || [ "$arg" = "-h" ]; then
        sed -n '/^# AICraft/,/^### END HELP ###/p' "$0" | grep '^#' | grep -v '###' | sed 's/^# //' | sed 's/^#$//'
        exit 0
    fi
done

MODE="${1:-prod}"
PORT="${PORT:-3000}"
LOG_LEVEL="${LOG_LEVEL:-INFO}"
SKIP_INSTALL=false

# Parse arguments
shift 2>/dev/null || true
while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            PORT="$2"
            shift 2
            ;;
        --log-level)
            LOG_LEVEL="$2"
            shift 2
            ;;
        --no-install)
            SKIP_INSTALL=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

check_command() {
    if command -v "$1" &> /dev/null; then
        return 0
    else
        return 1
    fi
}

################################################################################
# Pre-flight Checks
################################################################################

preflight_checks() {
    print_header "Pre-flight Checks"

    # Check Node.js
    if check_command node; then
        NODE_VERSION=$(node --version)
        print_success "Node.js installed: $NODE_VERSION"

        # Check if version is at least 14.x
        MAJOR_VERSION=$(echo "$NODE_VERSION" | cut -d'.' -f1 | tr -d 'v')
        if [ "$MAJOR_VERSION" -lt 14 ]; then
            print_error "Node.js version 14.x or higher required (found $NODE_VERSION)"
            exit 1
        fi
    else
        print_error "Node.js is not installed"
        echo -e "  Please install Node.js from ${BLUE}https://nodejs.org/${NC}"
        exit 1
    fi

    # Check npm
    if check_command npm; then
        NPM_VERSION=$(npm --version)
        print_success "npm installed: v$NPM_VERSION"
    else
        print_error "npm is not installed"
        exit 1
    fi

    # Check package.json
    if [ -f "package.json" ]; then
        print_success "package.json found"
    else
        print_error "package.json not found in $SCRIPT_DIR"
        exit 1
    fi

    # Check server.js
    if [ -f "server.js" ]; then
        print_success "server.js found"
    else
        print_error "server.js not found in $SCRIPT_DIR"
        exit 1
    fi

    # Check and install dependencies
    if [ "$SKIP_INSTALL" = false ]; then
        if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
            print_warning "Dependencies not installed, running npm install..."
            npm install
            print_success "Dependencies installed"
        else
            print_success "Dependencies already installed"

            # Check if package-lock.json is newer than node_modules
            if [ "package-lock.json" -nt "node_modules/.package-lock.json" ]; then
                print_warning "Dependencies may be outdated, running npm install..."
                npm install
                print_success "Dependencies updated"
            fi
        fi
    else
        print_info "Skipping dependency check (--no-install)"
    fi

    # Ensure data directory exists
    if [ ! -d "data" ]; then
        print_warning "Data directory not found, creating..."
        mkdir -p data
        print_success "Data directory created"
    else
        print_success "Data directory exists"
    fi

    # Check if port is available
    if command -v lsof &> /dev/null; then
        if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
            print_error "Port $PORT is already in use"
            echo -e "  Use ${YELLOW}--port${NC} to specify a different port"
            echo -e "  Or stop the process using: ${CYAN}lsof -ti:$PORT | xargs kill${NC}"
            exit 1
        else
            print_success "Port $PORT is available"
        fi
    else
        print_info "lsof not available, skipping port check"
    fi

    echo ""
}

################################################################################
# Environment Setup
################################################################################

setup_environment() {
    print_header "Environment Setup"

    export PORT="$PORT"
    export LOG_LEVEL="$LOG_LEVEL"

    if [ "$MODE" = "dev" ]; then
        export NODE_ENV="development"
        print_info "Mode: Development (hot-reload enabled)"
    else
        export NODE_ENV="production"
        print_info "Mode: Production"
    fi

    print_info "Port: $PORT"
    print_info "Log Level: $LOG_LEVEL"
    echo ""
}

################################################################################
# Server Startup
################################################################################

start_server() {
    print_header "Starting Server"

    case $MODE in
        prod|production)
            print_info "Starting server with: npm start"
            echo ""
            npm start
            ;;
        dev|development)
            print_info "Starting server with: npm run dev"
            echo ""
            npm run dev
            ;;
        test)
            print_info "Running tests..."
            echo ""
            if [ -f "test/npc_system.test.js" ]; then
                node test/npc_system.test.js
            else
                print_error "Test file not found"
                exit 1
            fi
            ;;
        *)
            print_error "Invalid mode: $MODE"
            echo "Valid modes: prod, dev, test"
            exit 1
            ;;
    esac
}

################################################################################
# Error Handler
################################################################################

error_handler() {
    echo ""
    print_error "Server startup failed!"
    echo ""
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo "  1. Check the error message above"
    echo "  2. Ensure all dependencies are installed: npm install"
    echo "  3. Check if the port is available: lsof -ti:$PORT"
    echo "  4. Review server logs in data/system_logs.json"
    echo "  5. Try running with --log-level DEBUG for more details"
    echo ""
    exit 1
}

trap error_handler ERR

################################################################################
# Main
################################################################################

main() {
    # Clear screen if terminal is available
    if [ -t 1 ] && [ -n "$TERM" ]; then
        clear
    fi

    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║                                                                  ║"
    echo "║           AICraft Cluster Dashboard - Server Startup            ║"
    echo "║                                                                  ║"
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    preflight_checks
    setup_environment
    start_server
}

main
