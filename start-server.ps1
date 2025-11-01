################################################################################
# AICraft Cluster Dashboard - PowerShell Startup Script
#
# This script handles all pre-flight checks and starts the server on Windows
#
# Usage:
#   .\start-server.ps1 [mode] [-Port <port>] [-LogLevel <level>]
#
# Modes:
#   prod      - Production mode (default)
#   dev       - Development mode with hot-reload
#   test      - Run tests only
#
# Examples:
#   .\start-server.ps1
#   .\start-server.ps1 dev
#   .\start-server.ps1 prod -Port 8080 -LogLevel DEBUG
################################################################################

param(
    [Parameter(Position=0)]
    [ValidateSet("prod", "dev", "test", "production", "development")]
    [string]$Mode = "prod",

    [int]$Port = 3000,

    [ValidateSet("DEBUG", "INFO", "WARN", "ERROR", "FATAL")]
    [string]$LogLevel = "INFO",

    [switch]$Help
)

# Show help if requested
if ($Help) {
    Write-Host @"
AICraft Cluster Dashboard - PowerShell Startup Script

This script handles all pre-flight checks and starts the server on Windows

Usage:
  .\start-server.ps1 [mode] [-Port <port>] [-LogLevel <level>]

Modes:
  prod      - Production mode (default)
  dev       - Development mode with hot-reload
  test      - Run tests only

Parameters:
  -Port <number>      Override default port (3000)
  -LogLevel <level>   Set log level (DEBUG, INFO, WARN, ERROR, FATAL)
  -Help               Show this help message

Examples:
  .\start-server.ps1
  .\start-server.ps1 dev
  .\start-server.ps1 prod -Port 8080
  .\start-server.ps1 prod -LogLevel DEBUG

"@
    exit 0
}

# Helper functions
function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success {
    param([string]$Text)
    Write-Host "✓ $Text" -ForegroundColor Green
}

function Write-Error-Message {
    param([string]$Text)
    Write-Host "✗ $Text" -ForegroundColor Red
}

function Write-Warning-Message {
    param([string]$Text)
    Write-Host "⚠ $Text" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Text)
    Write-Host "ℹ $Text" -ForegroundColor Blue
}

# Main script
Clear-Host

Write-Host "╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                                  ║" -ForegroundColor Cyan
Write-Host "║           AICraft Cluster Dashboard - Server Startup            ║" -ForegroundColor Cyan
Write-Host "║                   PowerShell Edition                             ║" -ForegroundColor Cyan
Write-Host "║                                                                  ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

################################################################################
# Pre-flight Checks
################################################################################

Write-Header "Pre-flight Checks"

# Check Node.js
try {
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Node.js installed: $nodeVersion"

        # Check version (should be 14+)
        $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
        if ($majorVersion -lt 14) {
            Write-Error-Message "Node.js version 14.x or higher required (found $nodeVersion)"
            exit 1
        }
    } else {
        throw "Node.js not found"
    }
} catch {
    Write-Error-Message "Node.js is not installed"
    Write-Host ""
    Write-Host "  Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "  Download the LTS (Long Term Support) version for Windows" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  After installation:" -ForegroundColor Yellow
    Write-Host "    1. Restart PowerShell" -ForegroundColor Yellow
    Write-Host "    2. Run this script again" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "npm installed: v$npmVersion"
    } else {
        throw "npm not found"
    }
} catch {
    Write-Error-Message "npm is not installed"
    Write-Host "  npm should come with Node.js. Please reinstall Node.js." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check package.json
if (Test-Path "package.json") {
    Write-Success "package.json found"
} else {
    Write-Error-Message "package.json not found"
    Write-Host "  Make sure you're in the FGD project directory" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check server.js
if (Test-Path "server.js") {
    Write-Success "server.js found"
} else {
    Write-Error-Message "server.js not found"
    Write-Host "  Make sure you're in the FGD project directory" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check and install dependencies
if (-not (Test-Path "node_modules")) {
    Write-Warning-Message "Dependencies not installed, running npm install..."
    Write-Host ""
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Error-Message "Failed to install dependencies"
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host ""
    Write-Success "Dependencies installed"
} else {
    Write-Success "Dependencies already installed"

    # Check if package-lock.json is newer
    $packageLock = Get-Item "package-lock.json" -ErrorAction SilentlyContinue
    $nodeModules = Get-Item "node_modules" -ErrorAction SilentlyContinue

    if ($packageLock -and $nodeModules -and ($packageLock.LastWriteTime -gt $nodeModules.LastWriteTime)) {
        Write-Warning-Message "Dependencies may be outdated, running npm install..."
        npm install
        Write-Success "Dependencies updated"
    }
}

# Ensure data directory exists
if (-not (Test-Path "data")) {
    Write-Warning-Message "Data directory not found, creating..."
    New-Item -ItemType Directory -Path "data" | Out-Null
    Write-Success "Data directory created"
} else {
    Write-Success "Data directory exists"
}

# Check if port is available
$portInUse = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Error-Message "Port $Port is already in use"
    Write-Host "  Use -Port parameter to specify a different port" -ForegroundColor Yellow
    Write-Host "  Or stop the process using port $Port" -ForegroundColor Yellow
    $process = Get-Process -Id $portInUse.OwningProcess -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "  Process: $($process.Name) (PID: $($process.Id))" -ForegroundColor Yellow
    }
    Read-Host "Press Enter to exit"
    exit 1
} else {
    Write-Success "Port $Port is available"
}

Write-Host ""

################################################################################
# Environment Setup
################################################################################

Write-Header "Environment Setup"

$env:PORT = $Port
$env:LOG_LEVEL = $LogLevel

if ($Mode -eq "dev" -or $Mode -eq "development") {
    $env:NODE_ENV = "development"
    Write-Info "Mode: Development (hot-reload enabled)"
} else {
    $env:NODE_ENV = "production"
    Write-Info "Mode: Production"
}

Write-Info "Port: $Port"
Write-Info "Log Level: $LogLevel"

Write-Host ""

################################################################################
# Starting Server
################################################################################

Write-Header "Starting Server"

try {
    switch ($Mode) {
        { $_ -in "dev", "development" } {
            Write-Info "Starting server with: npm run dev"
            Write-Host ""
            Write-Host "Server will be available at: http://localhost:$Port" -ForegroundColor Green
            Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
            Write-Host ""
            npm run dev
        }
        "test" {
            Write-Info "Running tests..."
            Write-Host ""
            if (Test-Path "test\npc_system.test.js") {
                node test\npc_system.test.js
            } else {
                Write-Error-Message "Test file not found"
                exit 1
            }
        }
        default {
            Write-Info "Starting server with: npm start"
            Write-Host ""
            Write-Host "Server will be available at: http://localhost:$Port" -ForegroundColor Green
            Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
            Write-Host ""
            npm start
        }
    }
} catch {
    Write-Host ""
    Write-Error-Message "Server startup failed!"
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Check the error message above" -ForegroundColor Yellow
    Write-Host "  2. Ensure all dependencies are installed: npm install" -ForegroundColor Yellow
    Write-Host "  3. Check if the port is available" -ForegroundColor Yellow
    Write-Host "  4. Review server logs in data\system_logs.json" -ForegroundColor Yellow
    Write-Host "  5. Try running with -LogLevel DEBUG for more details" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
