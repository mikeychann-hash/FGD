#!/usr/bin/env bash
# Wrapper for scripts/fgdctl.js
NODE_BIN=${NODE_BIN:-node}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
$NODE_BIN "$SCRIPT_DIR/fgdctl.js" "$@"
