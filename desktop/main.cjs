const { app, BrowserWindow, ipcMain, nativeTheme, session, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const Store = require('electron-store');

// Enable sandbox for all renderers created after this call.
app.enableSandbox();

const store = new Store();
const secretsStore = new Store({ name: 'fgd-secrets' });

const backendPort = process.env.PORT || process.env.FGD_DESKTOP_PORT || 3000;
const isDev = process.argv.includes('--dev');

let backendProcess = null;
let minecraftProcess = null;
let restartAttempts = 0;
let lastRestartAt = 0;
const MAX_RESTART_ATTEMPTS = 3;
const RESTART_RESET_MS = 5 * 60 * 1000;

function genSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function genStrongPassword() {
  const raw = crypto.randomBytes(24).toString('base64').replace(/[+/=]/g, '');
  return `A1${raw}`;
}

function ensureSecrets() {
  const current = secretsStore.store || {};
  const updates = {};
  if (!current.ADMIN_API_KEY) updates.ADMIN_API_KEY = genSecret();
  if (!current.LLM_API_KEY) updates.LLM_API_KEY = genSecret();
  if (!current.JWT_SECRET) updates.JWT_SECRET = genSecret(64);
  if (!current.ADMIN_PASSWORD) updates.ADMIN_PASSWORD = genStrongPassword();
  if (!current.RCON_PASSWORD) updates.RCON_PASSWORD = genSecret(16);
  if (Object.keys(updates).length > 0) {
    secretsStore.set(updates);
  }
  return { ...current, ...updates };
}

function regenerateSecrets() {
  secretsStore.clear();
  return ensureSecrets();
}

function buildBackendEnv() {
  const secrets = ensureSecrets();
  return {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || (isDev ? 'development' : 'production'),
    PORT: backendPort,
    FGD_DESKTOP: '1',
    FGD_BIND_ADDRESS: '127.0.0.1',
    FGD_DATA_DIR: path.join(app.getPath('userData'), 'data'),
    LOG_DIR: app.getPath('logs'),
    ADMIN_API_KEY: secrets.ADMIN_API_KEY,
    LLM_API_KEY: secrets.LLM_API_KEY,
    JWT_SECRET: secrets.JWT_SECRET,
    ADMIN_PASSWORD: secrets.ADMIN_PASSWORD,
    RCON_PASSWORD: secrets.RCON_PASSWORD,
  };
}

function startBackend() {
  if (backendProcess) {
    return;
  }

  const serverPath = path.join(__dirname, '..', 'server.js');
  backendProcess = spawn(process.execPath, [serverPath], {
    env: buildBackendEnv(),
    stdio: 'inherit',
    windowsHide: true,
  });

  backendProcess.on('error', (err) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('fgd:backend-exit', { reason: err.message });
    });
    scheduleRestartOrQuit(err.message);
  });

  backendProcess.on('exit', (code, signal) => {
    backendProcess = null;

    if (app.isQuitting) {
      return;
    }

    const reason = signal || `code=${code}`;
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('fgd:backend-exit', { reason });
    });

    scheduleRestartOrQuit(reason);
  });
}

function scheduleRestartOrQuit(reason) {
  const now = Date.now();
  if (now - lastRestartAt > RESTART_RESET_MS) {
    restartAttempts = 0;
  }

  if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
    dialog.showErrorBox(
      'FGD backend crashed',
      `The FGD backend has exited ${MAX_RESTART_ATTEMPTS} times in a row and will not be restarted.\n\n` +
        `Last reason: ${reason}\n\nCheck logs at: ${app.getPath('logs')}`
    );
    app.quit();
    return;
  }

  const delayMs = [1000, 4000, 16000][restartAttempts] || 16000;
  restartAttempts += 1;
  lastRestartAt = now;

  setTimeout(() => {
    if (!app.isQuitting) {
      startBackend();
    }
  }, delayMs);
}

function stopBackend() {
  if (!backendProcess) {
    return;
  }
  backendProcess.kill();
  backendProcess = null;
}

function installContentSecurityPolicy() {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' http://127.0.0.1:${backendPort} ws://127.0.0.1:${backendPort}`,
    "img-src 'self' data:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });
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
      sandbox: true,
      webSecurity: true,
    },
    show: false,
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Block arbitrary navigation away from the app shell.
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev
      ? ['http://localhost:5173', `http://127.0.0.1:${backendPort}`]
      : [`http://127.0.0.1:${backendPort}`];
    if (!allowed.some((prefix) => url.startsWith(prefix))) {
      event.preventDefault();
    }
  });

  // External links open in the user's default browser; no new Electron windows.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.once('ready-to-show', () => {
    win.show();
    if (process.platform === 'win32') {
      try {
        win.setBackgroundMaterial('mica');
      } catch (_e) {
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
    minecraftProcess.stdin.write('stop\n');
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

// IPC Handlers — never expose secrets to the renderer.
ipcMain.handle('fgd:get-config', () => ({
  port: backendPort,
  apiBaseUrl: `http://127.0.0.1:${backendPort}`,
}));

// Admin-only: expose the admin API key to the renderer via a gated channel.
// The renderer uses this to call the local backend without shipping a key in its bundle.
ipcMain.handle('fgd:get-admin-key', () => {
  const secrets = ensureSecrets();
  return { apiKey: secrets.ADMIN_API_KEY };
});

ipcMain.handle('fgd:regenerate-secrets', async () => {
  regenerateSecrets();
  stopBackend();
  // Small delay so the backend fully exits before restart
  setTimeout(() => startBackend(), 500);
  return { success: true };
});

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
  installContentSecurityPolicy();
  ensureSecrets();
  startBackend();
  createWindow();

  // Optional auto-updater; only runs in packaged builds.
  if (!isDev && app.isPackaged) {
    try {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.logger = console;
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.warn('Auto-update check failed:', err && err.message);
      });
    } catch (err) {
      console.warn('electron-updater not available:', err && err.message);
    }
  }

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
