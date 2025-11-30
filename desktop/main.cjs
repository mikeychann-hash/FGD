const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const Store = require('electron-store');

const store = new Store();
const backendPort = process.env.PORT || process.env.FGD_DESKTOP_PORT || 3000;
const isDev = process.argv.includes('--dev');
let backendProcess = null;
let minecraftProcess = null;

function startBackend() {
  if (backendProcess) {
    return;
  }

  const serverPath = path.join(__dirname, '..', 'server.js');
  backendProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: backendPort,
    },
    stdio: 'inherit',
    windowsHide: true,
  });

  backendProcess.on('error', (err) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('fgd:backend-exit', { reason: err.message });
    });
    if (!app.isQuitting) {
      app.quit();
    }
  });

  backendProcess.on('exit', (code, signal) => {
    backendProcess = null;
    const reason = signal || code;

    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('fgd:backend-exit', { reason });
    });

    if (!app.isQuitting) {
      app.quit();
    }
  });
}

function stopBackend() {
  if (!backendProcess) {
    return;
  }
  backendProcess.kill();
  backendProcess = null;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: 'FGD Desktop',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1e293b',
      symbolColor: '#ffffff',
      height: 32,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  // Load from Vite dev server in development, or built files in production
  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Apply Windows 11 Mica effect if available
  win.once('ready-to-show', () => {
    win.show();
    if (process.platform === 'win32') {
      try {
        win.setBackgroundMaterial('mica');
      } catch (e) {
        // Mica not available on this Windows version
      }
    }
  });

  return win;
}

// Minecraft Server Management
function startMinecraftServer() {
  if (minecraftProcess) {
    return { success: false, message: 'Server is already running' };
  }

  const serverJar = store.get('minecraftServerJar');
  const javaPath = store.get('javaPath', 'java');
  const minMemory = store.get('minMemory', '2G');
  const maxMemory = store.get('maxMemory', '4G');

  if (!serverJar) {
    return { success: false, message: 'Minecraft server JAR path not configured' };
  }

  const serverDir = path.dirname(serverJar);
  const jarName = path.basename(serverJar);

  try {
    minecraftProcess = spawn(
      javaPath,
      [`-Xms${minMemory}`, `-Xmx${maxMemory}`, '-jar', jarName, 'nogui'],
      {
        cwd: serverDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    minecraftProcess.stdout.on('data', (data) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('minecraft:log', { message: data.toString(), level: 'info' });
      });
    });

    minecraftProcess.stderr.on('data', (data) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('minecraft:log', { message: data.toString(), level: 'error' });
      });
    });

    minecraftProcess.on('exit', (code) => {
      minecraftProcess = null;
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('minecraft:stopped', { code });
      });
    });

    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('minecraft:started');
    });

    return { success: true, message: 'Minecraft server started' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

function stopMinecraftServer() {
  if (!minecraftProcess) {
    return { success: false, message: 'Server is not running' };
  }

  try {
    // Send stop command to Minecraft server
    minecraftProcess.stdin.write('stop\n');

    // Force kill after 30 seconds if it doesn't stop gracefully
    setTimeout(() => {
      if (minecraftProcess) {
        minecraftProcess.kill('SIGTERM');
      }
    }, 30000);

    return { success: true, message: 'Stop command sent to server' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

function getMinecraftServerStatus() {
  return {
    running: minecraftProcess !== null,
    pid: minecraftProcess ? minecraftProcess.pid : null,
  };
}

// IPC Handlers
ipcMain.handle('fgd:get-config', () => ({
  port: backendPort,
  apiBaseUrl: `http://localhost:${backendPort}`,
}));

ipcMain.handle('minecraft:start', () => startMinecraftServer());
ipcMain.handle('minecraft:stop', () => stopMinecraftServer());
ipcMain.handle('minecraft:status', () => getMinecraftServerStatus());
ipcMain.handle('minecraft:send-command', (event, command) => {
  if (!minecraftProcess) {
    return { success: false, message: 'Server is not running' };
  }
  try {
    minecraftProcess.stdin.write(command + '\n');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// Settings Management
ipcMain.handle('settings:get', (event, key) => store.get(key));
ipcMain.handle('settings:set', (event, key, value) => {
  store.set(key, value);
  return { success: true };
});
ipcMain.handle('settings:getAll', () => store.store);

app.setName('FGD Desktop');
nativeTheme.themeSource = 'dark';

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
  stopBackend();
  if (minecraftProcess) {
    minecraftProcess.kill();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
