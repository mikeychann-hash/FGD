const { app, BrowserWindow, ipcMain, Menu, nativeTheme } = require('electron');
const { join } = require('path');
const { autoUpdater } = require('electron-updater');
const Store = require('electron-store');
const { spawn } = require('child_process');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Rcon } = require('rcon');
const fs = require('fs');
const path = require('path');

class MinecraftServerAdmin {
  constructor() {
    this.mainWindow = null;
    this.serverProcess = null;
    this.rconClient = null;
    this.expressApp = null;
    this.server = null;
    this.io = null;
    this.store = new Store();
    this.serverStartTime = null;
    this.isDev = process.env.NODE_ENV === 'development';
    
    this.init();
  }

  init() {
    app.whenReady().then(() => {
      this.createWindow();
      this.setupMenu();
      this.setupIpcHandlers();
      this.startBackend();
      this.setupAutoUpdater();
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        this.stopServer();
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });
  }

  createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1200,
      minHeight: 700,
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: '#1e293b',
        symbolColor: '#ffffff'
      },
      webPreferences: {
        preload: join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false
      },
      icon: join(__dirname, '../../resources/icon.ico'),
      backgroundColor: '#0f172a',
      show: false
    });

    // Load the app
    if (this.isDev) {
      this.mainWindow.loadURL('http://localhost:5173');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(join(__dirname, '../../dist-react/index.html'));
    }

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      
      // Apply Windows 11 Mica effect if available
      if (process.platform === 'win32') {
        this.mainWindow.setBackdrop('mica');
      }
    });

    // Handle window events
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Prevent navigation to external URLs
    this.mainWindow.webContents.on('will-navigate', (event, url) => {
      if (url !== this.mainWindow.webContents.getURL()) {
        event.preventDefault();
        require('electron').shell.openExternal(url);
      }
    });
  }

  setupMenu() {
    const template = [
      {
        label: 'File',
        submenu: [
          {
            label: 'Settings',
            accelerator: 'CmdOrCtrl+,',
            click: () => this.mainWindow.webContents.send('navigate-to', '/settings')
          },
          { type: 'separator' },
          {
            label: 'Exit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => app.quit()
          }
        ]
      },
      {
        label: 'Server',
        submenu: [
          {
            label: 'Start Server',
            accelerator: 'CmdOrCtrl+S',
            click: () => this.startServer()
          },
          {
            label: 'Stop Server',
            accelerator: 'CmdOrCtrl+Shift+S',
            click: () => this.stopServer()
          },
          {
            label: 'Restart Server',
            accelerator: 'CmdOrCtrl+R',
            click: () => this.restartServer()
          }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'About',
            click: () => this.showAbout()
          },
          {
            label: 'Check for Updates',
            click: () => autoUpdater.checkForUpdatesAndNotify()
          }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  setupIpcHandlers() {
    // Server management
    ipcMain.handle('start-server', () => this.startServer());
    ipcMain.handle('stop-server', () => this.stopServer());
    ipcMain.handle('restart-server', () => this.restartServer());
    ipcMain.handle('get-server-status', () => this.getServerStatus());
    
    // RCON commands
    ipcMain.handle('send-rcon-command', (event, command) => this.sendRconCommand(command));
    
    // Configuration
    ipcMain.handle('get-config', (event, key) => this.store.get(key));
    ipcMain.handle('set-config', (event, key, value) => this.store.set(key, value));
    ipcMain.handle('get-all-config', () => this.store.store);
    
    // File operations
    ipcMain.handle('read-file', (event, filePath) => this.readFile(filePath));
    ipcMain.handle('write-file', (event, filePath, content) => this.writeFile(filePath, content));
    
    // Bot management
    ipcMain.handle('spawn-bot', (event, botConfig) => this.spawnBot(botConfig));
    ipcMain.handle('despawn-bot', (event, botId) => this.despawnBot(botId));
    
    // System info
    ipcMain.handle('get-system-info', () => this.getSystemInfo());
  }

  async startBackend() {
    this.expressApp = express();
    this.server = http.createServer(this.expressApp);
    this.io = socketIo(this.server, {
      cors: {
        origin: process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : undefined,
        methods: ['GET', 'POST']
      }
    });

    // API routes
    this.expressApp.use(express.json());
    
    this.expressApp.get('/api/status', (req, res) => {
      res.json(this.getServerStatus());
    });

    this.expressApp.post('/api/command', async (req, res) => {
      try {
        const result = await this.sendRconCommand(req.body.command);
        res.json({ success: true, result });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Socket.io for real-time updates
    this.io.on('connection', (socket) => {
      console.log('Client connected to backend');
      
      socket.on('disconnect', () => {
        console.log('Client disconnected from backend');
      });
    });

    const port = 3001;
    this.server.listen(port, () => {
      console.log(`Backend server running on port ${port}`);
    });
  }

  async startServer() {
    if (this.serverProcess) {
      return { success: false, error: 'Server is already running' };
    }

    try {
      const javaPath = this.store.get('javaPath', 'java');
      const serverJar = this.store.get('serverJar', 'server.jar');
      const maxMemory = this.store.get('maxMemory', '2G');
      const minMemory = this.store.get('minMemory', '1G');
      const serverDir = this.store.get('serverDir', './server');

      // Ensure server directory exists
      if (!fs.existsSync(serverDir)) {
        fs.mkdirSync(serverDir, { recursive: true });
      }

      const args = [
        `-Xmx${maxMemory}`,
        `-Xms${minMemory}`,
        '-jar',
        serverJar,
        'nogui'
      ];

      this.serverProcess = spawn(javaPath, args, {
        cwd: serverDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.serverStartTime = Date.now();
      this.setupServerProcessHandlers();
      
      // Wait for server to start and initialize RCON
      setTimeout(() => {
        this.initializeRcon();
      }, 10000);

      return { success: true, pid: this.serverProcess.pid };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  setupServerProcessHandlers() {
    this.serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      this.io?.emit('console-output', { type: 'stdout', data: output });
      this.parseServerOutput(output);
    });

    this.serverProcess.stderr.on('data', (data) => {
      const output = data.toString();
      this.io?.emit('console-output', { type: 'stderr', data: output });
    });

    this.serverProcess.on('close', (code) => {
      this.serverProcess = null;
      this.rconClient = null;
      this.serverStartTime = null;
      this.io?.emit('server-stopped', { code });
    });

    this.serverProcess.on('error', (error) => {
      this.io?.emit('server-error', { error: error.message });
    });
  }

  async stopServer() {
    if (!this.serverProcess) {
      return { success: false, error: 'Server is not running' };
    }

    try {
      // Try graceful shutdown with RCON first
      if (this.rconClient) {
        await this.sendRconCommand('stop');
        return { success: true };
      }

      // Fallback to process termination
      this.serverProcess.kill('SIGTERM');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async restartServer() {
    await this.stopServer();
    // Wait for server to fully stop
    await new Promise(resolve => setTimeout(resolve, 5000));
    return await this.startServer();
  }

  getServerStatus() {
    return {
      isRunning: !!this.serverProcess,
      pid: this.serverProcess?.pid || null,
      rconConnected: !!this.rconClient,
      uptime: this.serverProcess ? Date.now() - this.serverStartTime : 0
    };
  }

  async initializeRcon() {
    const rconPort = this.store.get('rcon.port', 25575);
    const rconPassword = this.store.get('rcon.password', 'password');

    this.rconClient = new Rcon({
      host: 'localhost',
      port: rconPort,
      password: rconPassword
    });

    try {
      await this.rconClient.connect();
      this.io?.emit('rcon-connected');
    } catch (error) {
      console.error('RCON connection failed:', error);
      this.rconClient = null;
    }
  }

  async sendRconCommand(command) {
    if (!this.rconClient) {
      throw new Error('RCON not connected');
    }

    try {
      const response = await this.rconClient.send(command);
      return response;
    } catch (error) {
      throw new Error(`RCON command failed: ${error.message}`);
    }
  }

  parseServerOutput(output) {
    // Parse player join/leave events
    if (output.includes('joined the game')) {
      const match = output.match(/(.+?) joined the game/);
      if (match) {
        this.io?.emit('player-joined', { player: match[1] });
      }
    }

    if (output.includes('left the game')) {
      const match = output.match(/(.+?) left the game/);
      if (match) {
        this.io?.emit('player-left', { player: match[1] });
      }
    }

    // Parse TPS information
    if (output.includes('TPS:')) {
      const tpsMatch = output.match(/TPS: ([\d.]+)/);
      if (tpsMatch) {
        this.io?.emit('tps-update', { tps: parseFloat(tpsMatch[1]) });
      }
    }
  }

  async spawnBot(botConfig) {
    // This will be implemented with Mineflayer
    return { success: true, botId: Date.now() };
  }

  async despawnBot(botId) {
    // This will be implemented with Mineflayer
    return { success: true };
  }

  async readFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async writeFile(filePath, content) {
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getSystemInfo() {
    const os = require('os');
    return {
      platform: os.platform(),
      arch: os.arch(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpus: os.cpus().length,
      loadAverage: os.loadavg()
    };
  }

  setupAutoUpdater() {
    autoUpdater.checkForUpdatesAndNotify();
    
    autoUpdater.on('update-available', () => {
      this.mainWindow?.webContents.send('update-available');
    });

    autoUpdater.on('update-downloaded', () => {
      autoUpdater.quitAndInstall();
    });
  }

  showAbout() {
    const { dialog } = require('electron');
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'About Minecraft Server Admin',
      message: 'Minecraft Server Admin v1.0.0',
      detail: 'A comprehensive desktop application for managing Minecraft servers.'
    });
  }
}

// Initialize the application
new MinecraftServerAdmin();
