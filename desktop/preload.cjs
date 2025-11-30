const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fgdDesktop', {
  getConfig: () => ipcRenderer.invoke('fgd:get-config'),
  onBackendExit: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('fgd:backend-exit', listener);
    return () => ipcRenderer.removeListener('fgd:backend-exit', listener);
  },

  // Minecraft Server Controls
  minecraft: {
    start: () => ipcRenderer.invoke('minecraft:start'),
    stop: () => ipcRenderer.invoke('minecraft:stop'),
    getStatus: () => ipcRenderer.invoke('minecraft:status'),
    sendCommand: (command) => ipcRenderer.invoke('minecraft:send-command', command),
    onLog: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('minecraft:log', listener);
      return () => ipcRenderer.removeListener('minecraft:log', listener);
    },
    onStarted: (callback) => {
      const listener = () => callback();
      ipcRenderer.on('minecraft:started', listener);
      return () => ipcRenderer.removeListener('minecraft:started', listener);
    },
    onStopped: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('minecraft:stopped', listener);
      return () => ipcRenderer.removeListener('minecraft:stopped', listener);
    },
  },

  // Settings Management
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
  },
});
