# ============================================================================
# Paper + Geyser Setup Script for Windows
# This script downloads and configures Paper server with Geyser plugin
# ============================================================================

param(
    [string]$PaperVersion = "1.21.1",
    [string]$PaperBuild = "latest",
    [string]$GeyserVersion = "latest"
)

# Color output functions
function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "  $Message" -ForegroundColor Gray
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

# Main script
Write-Header "Paper + Geyser Setup Script for Windows"

Write-Info "Minecraft Version: $PaperVersion"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerDir = Join-Path $ScriptDir "paper-server"
$PluginsDir = Join-Path $ServerDir "plugins"

Write-Info "Server Directory: $ServerDir"
Write-Host ""

# Check for Java
Write-Host "Checking for Java..." -ForegroundColor Cyan
try {
    $javaVersion = & java -version 2>&1 | Select-Object -First 1
    Write-Success "Java is installed: $javaVersion"
} catch {
    Write-Error-Custom "Java is not installed or not in PATH!"
    Write-Info "Please install Java 17 or higher from:"
    Write-Info "  https://adoptium.net/ (recommended)"
    Write-Info "  https://www.oracle.com/java/technologies/downloads/"
    exit 1
}

# Create directories
Write-Host ""
Write-Host "Creating directories..." -ForegroundColor Cyan
if (-not (Test-Path $ServerDir)) {
    New-Item -ItemType Directory -Path $ServerDir -Force | Out-Null
    Write-Success "Created server directory"
} else {
    Write-Success "Server directory exists"
}

if (-not (Test-Path $PluginsDir)) {
    New-Item -ItemType Directory -Path $PluginsDir -Force | Out-Null
    Write-Success "Created plugins directory"
} else {
    Write-Success "Plugins directory exists"
}

# Download Paper if not exists
$PaperJar = Join-Path $ServerDir "paper.jar"
if (-not (Test-Path $PaperJar)) {
    Write-Host ""
    Write-Host "Downloading Paper $PaperVersion..." -ForegroundColor Cyan

    # Get the latest build number for the version
    if ($PaperBuild -eq "latest") {
        Write-Info "Fetching latest build info..."
        try {
            $apiUrl = "https://api.papermc.io/v2/projects/paper/versions/$PaperVersion"
            $response = Invoke-RestMethod -Uri $apiUrl -Method Get
            $BuildNumber = $response.builds[-1]

            if (-not $BuildNumber) {
                Write-Error-Custom "Could not fetch latest build number for Paper $PaperVersion"
                Write-Info "Please check if version $PaperVersion is available at https://papermc.io/downloads"
                exit 1
            }

            Write-Info "Latest build: #$BuildNumber"
        } catch {
            Write-Error-Custom "Failed to fetch Paper build info: $_"
            exit 1
        }
    } else {
        $BuildNumber = $PaperBuild
    }

    Write-Info "Downloading Paper build #$BuildNumber..."
    $DownloadUrl = "https://api.papermc.io/v2/projects/paper/versions/$PaperVersion/builds/$BuildNumber/downloads/paper-$PaperVersion-$BuildNumber.jar"

    try {
        Invoke-WebRequest -Uri $DownloadUrl -OutFile $PaperJar -UseBasicParsing
        Write-Success "Paper downloaded successfully"
    } catch {
        Write-Error-Custom "Failed to download Paper: $_"
        Write-Info "URL attempted: $DownloadUrl"
        exit 1
    }
} else {
    Write-Host ""
    Write-Success "Paper server already exists (paper.jar)"
}

# Download Geyser if not exists
$GeyserJar = Join-Path $PluginsDir "Geyser-Spigot.jar"
if (-not (Test-Path $GeyserJar)) {
    Write-Host ""
    Write-Host "Downloading Geyser plugin..." -ForegroundColor Cyan

    Write-Info "Fetching latest Geyser build..."
    $GeyserUrl = "https://download.geysermc.org/v2/projects/geyser/versions/latest/builds/latest/downloads/spigot"

    try {
        Invoke-WebRequest -Uri $GeyserUrl -OutFile $GeyserJar -UseBasicParsing
        Write-Success "Geyser downloaded successfully"
    } catch {
        Write-Error-Custom "Failed to download Geyser: $_"
        exit 1
    }
} else {
    Write-Host ""
    Write-Success "Geyser plugin already exists"
}

# Create eula.txt
$EulaFile = Join-Path $ServerDir "eula.txt"
if (-not (Test-Path $EulaFile)) {
    Write-Host ""
    Write-Host "Creating eula.txt..." -ForegroundColor Cyan
    Write-Warning "By changing the setting below to TRUE you are agreeing to Minecraft's EULA"
    Write-Info "EULA: https://aka.ms/MinecraftEULA"

    @"
# By changing the setting below to TRUE you are indicating your agreement to Minecraft's EULA (https://aka.ms/MinecraftEULA).
eula=true
"@ | Out-File -FilePath $EulaFile -Encoding utf8

    Write-Success "EULA accepted"
}

# Create server.properties with RCON enabled
$ServerPropsFile = Join-Path $ServerDir "server.properties"
if (-not (Test-Path $ServerPropsFile)) {
    Write-Host ""
    Write-Host "Creating server.properties with RCON enabled..." -ForegroundColor Cyan

    @"
# Minecraft server properties
# Generated by FGD setup script

# Server Settings
server-port=25565
server-ip=
max-players=20
motd=FGD AICraft Server - Paper + Geyser
online-mode=true
allow-flight=true
difficulty=normal
gamemode=survival
pvp=true

# RCON Configuration (Required for FGD Dashboard)
enable-rcon=true
rcon.port=25575
rcon.password=fgd_rcon_password_change_me
broadcast-rcon-to-ops=true

# World Settings
level-name=world
level-seed=
level-type=minecraft\:normal
spawn-protection=16
view-distance=10
simulation-distance=10

# Performance
max-tick-time=60000
network-compression-threshold=256
sync-chunk-writes=true

# Other
white-list=false
enforce-whitelist=false
spawn-npcs=true
spawn-animals=true
spawn-monsters=true
generate-structures=true
"@ | Out-File -FilePath $ServerPropsFile -Encoding utf8

    Write-Success "server.properties created"
    Write-Info "RCON Port: 25575"
    Write-Info "RCON Password: fgd_rcon_password_change_me"
    Write-Warning "IMPORTANT: Change the RCON password in server.properties!"
}

# Create Windows start script
$StartBat = Join-Path $ServerDir "start-server.bat"
Write-Host ""
Write-Host "Creating start script..." -ForegroundColor Cyan

@"
@echo off
REM Paper Server Start Script for Windows
REM Adjust memory settings based on your system

title Minecraft Paper Server

cd /d "%~dp0"

REM Memory settings (adjust as needed)
set MIN_RAM=2G
set MAX_RAM=4G

REM Java arguments for performance (Aikar's flags)
set JAVA_ARGS=-Xms%MIN_RAM% -Xmx%MAX_RAM% -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1

echo ============================================
echo Starting Paper Server
echo Memory: %MIN_RAM% - %MAX_RAM%
echo ============================================
echo.

java %JAVA_ARGS% -jar paper.jar nogui

echo.
echo Server stopped.
pause
"@ | Out-File -FilePath $StartBat -Encoding utf8

Write-Success "Start script created (start-server.bat)"

# Summary
Write-Header "Setup Complete!"
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Edit server.properties and change RCON password"
Write-Host "  2. Configure Geyser in plugins/Geyser-Spigot/config.yml (after first run)"
Write-Host "  3. Update FGD .env file with RCON credentials:"
Write-Host "       MINECRAFT_RCON_HOST=127.0.0.1"
Write-Host "       MINECRAFT_RCON_PORT=25575"
Write-Host "       MINECRAFT_RCON_PASSWORD=your_password_here"
Write-Host "  4. Start the Paper server:"
Write-Host "       cd minecraft-servers\paper-server"
Write-Host "       .\start-server.bat"
Write-Host "  5. Start the FGD dashboard:"
Write-Host "       .\start-server.bat"
Write-Host ""
Write-Host "Server Ports:" -ForegroundColor Yellow
Write-Host "  - Java Edition: 25565"
Write-Host "  - Bedrock Edition: 19132 (UDP, configured in Geyser)"
Write-Host "  - RCON: 25575"
Write-Host "  - FGD Dashboard: 3000"
Write-Host ""
Write-Warning "IMPORTANT:"
Write-Host "  - Change RCON password in server.properties" -ForegroundColor Red
Write-Host "  - Configure Geyser settings after first server start"
Write-Host "  - Open ports in firewall if needed"
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
