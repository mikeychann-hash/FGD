#!/bin/bash

# FGD Unified Startup Script
# Starts Paper Server + Geyser + FGD Dashboard together

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAPER_SERVER_DIR="$SCRIPT_DIR/minecraft-servers/paper-server"
LOG_DIR="$SCRIPT_DIR/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create logs directory
mkdir -p "$LOG_DIR"

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}FGD Unified Startup${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Function to check if a process is running
check_process() {
    if [ -f "$1" ]; then
        PID=$(cat "$1")
        if ps -p "$PID" > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# Function to stop all services
stop_all() {
    echo ""
    echo -e "${YELLOW}Stopping all services...${NC}"

    # Stop FGD Dashboard
    if [ -f "$SCRIPT_DIR/.fgd-dashboard.pid" ]; then
        PID=$(cat "$SCRIPT_DIR/.fgd-dashboard.pid")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "Stopping FGD Dashboard (PID: $PID)..."
            kill "$PID"
            rm "$SCRIPT_DIR/.fgd-dashboard.pid"
        fi
    fi

    # Stop Paper Server
    if [ -f "$PAPER_SERVER_DIR/.paper-server.pid" ]; then
        PID=$(cat "$PAPER_SERVER_DIR/.paper-server.pid")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "Stopping Paper Server (PID: $PID)..."
            kill "$PID"
            rm "$PAPER_SERVER_DIR/.paper-server.pid"
        fi
    fi

    echo -e "${GREEN}All services stopped${NC}"
    exit 0
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap stop_all SIGINT SIGTERM

# Parse command line arguments
MODE="all"
if [ $# -gt 0 ]; then
    MODE="$1"
fi

case "$MODE" in
    "all")
        echo -e "${GREEN}Starting all services...${NC}"
        START_PAPER=true
        START_DASHBOARD=true
        ;;
    "paper")
        echo -e "${GREEN}Starting Paper server only...${NC}"
        START_PAPER=true
        START_DASHBOARD=false
        ;;
    "dashboard")
        echo -e "${GREEN}Starting FGD dashboard only...${NC}"
        START_PAPER=false
        START_DASHBOARD=true
        ;;
    "stop")
        stop_all
        ;;
    *)
        echo -e "${RED}Usage: $0 [all|paper|dashboard|stop]${NC}"
        echo ""
        echo "  all        - Start Paper server and FGD dashboard (default)"
        echo "  paper      - Start Paper server only"
        echo "  dashboard  - Start FGD dashboard only"
        echo "  stop       - Stop all running services"
        exit 1
        ;;
esac

echo ""

# Check if Paper server is set up
if [ "$START_PAPER" = true ]; then
    if [ ! -f "$PAPER_SERVER_DIR/paper.jar" ]; then
        echo -e "${RED}Error: Paper server not found!${NC}"
        echo ""
        echo "Please run the setup script first:"
        echo "  cd minecraft-servers && ./setup-paper-geyser.sh"
        echo ""
        exit 1
    fi

    # Check if Paper is already running
    if check_process "$PAPER_SERVER_DIR/.paper-server.pid"; then
        echo -e "${YELLOW}Paper server is already running${NC}"
    else
        echo -e "${BLUE}Starting Paper Server...${NC}"
        cd "$PAPER_SERVER_DIR"

        # Start Paper in background
        nohup bash start.sh > "$LOG_DIR/paper-server.log" 2>&1 &
        PAPER_PID=$!
        echo "$PAPER_PID" > .paper-server.pid

        echo -e "${GREEN}✓ Paper Server started (PID: $PAPER_PID)${NC}"
        echo "  Log file: $LOG_DIR/paper-server.log"
        echo "  Java Edition: localhost:25565"
        echo "  Bedrock Edition: localhost:19132"
        echo "  RCON: localhost:25575"
        echo ""

        # Wait a few seconds for server to initialize
        echo "Waiting for Paper server to initialize..."
        sleep 5
    fi

    cd "$SCRIPT_DIR"
fi

# Start FGD Dashboard
if [ "$START_DASHBOARD" = true ]; then
    # Check if already running
    if check_process "$SCRIPT_DIR/.fgd-dashboard.pid"; then
        echo -e "${YELLOW}FGD Dashboard is already running${NC}"
    else
        echo -e "${BLUE}Starting FGD Dashboard...${NC}"

        # Check if node_modules exists
        if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
            echo "Installing dependencies..."
            npm install
        fi

        # Start dashboard in background
        nohup node server.js > "$LOG_DIR/fgd-dashboard.log" 2>&1 &
        DASHBOARD_PID=$!
        echo "$DASHBOARD_PID" > .fgd-dashboard.pid

        echo -e "${GREEN}✓ FGD Dashboard started (PID: $DASHBOARD_PID)${NC}"
        echo "  Log file: $LOG_DIR/fgd-dashboard.log"
        echo "  Dashboard: http://localhost:3000"
        echo "  Admin Panel: http://localhost:3000/admin"
        echo ""
    fi
fi

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Startup Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Services running:"
if [ "$START_PAPER" = true ]; then
    echo "  ✓ Paper Server (Java: 25565, Bedrock: 19132, RCON: 25575)"
fi
if [ "$START_DASHBOARD" = true ]; then
    echo "  ✓ FGD Dashboard (Port: 3000)"
fi
echo ""
echo "Log files in: $LOG_DIR/"
echo ""
echo "Commands:"
echo "  View Paper logs:      tail -f $LOG_DIR/paper-server.log"
echo "  View Dashboard logs:  tail -f $LOG_DIR/fgd-dashboard.log"
echo "  Stop all services:    $0 stop"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Keep script running and wait for signals
if [ "$START_PAPER" = true ] || [ "$START_DASHBOARD" = true ]; then
    while true; do
        sleep 1

        # Check if processes are still running
        if [ "$START_PAPER" = true ]; then
            if ! check_process "$PAPER_SERVER_DIR/.paper-server.pid"; then
                echo -e "${RED}Paper Server stopped unexpectedly!${NC}"
                stop_all
            fi
        fi

        if [ "$START_DASHBOARD" = true ]; then
            if ! check_process "$SCRIPT_DIR/.fgd-dashboard.pid"; then
                echo -e "${RED}FGD Dashboard stopped unexpectedly!${NC}"
                stop_all
            fi
        fi
    done
fi
