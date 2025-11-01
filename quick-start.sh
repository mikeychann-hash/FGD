#!/bin/bash

################################################################################
# Quick Start Script
#
# This is a simple wrapper that starts the server with default settings.
# For advanced options, use ./start-server.sh --help
################################################################################

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run the main startup script
exec "$SCRIPT_DIR/start-server.sh" prod "$@"
