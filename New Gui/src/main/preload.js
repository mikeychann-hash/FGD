const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the process to send
// and receive messages from the main process
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel, ...args) => {
      // Whitelist channels
      const validChannels = [
        'start-server',
        'stop-server',
        'restart-server',
        'get-server-status',
        'send-rcon-command',
        'get-config',
        'set-config',
        'get-all-config',
        'read-file',
        'write-file',
        'spawn-bot',
        'despawn-bot',
        'get-system-info'
      ];
      
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
    },
    
    on: (channel, listener) => {
      const validChannels = [
        'navigate-to',
        'update-available',
        'status-update',
        'console-output',
        'player-joined',
        'player-left',
        'tps-update',
        'server-stopped',
        'server-error',
        'rcon-connected'
      ];
      
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, listener);
      }
    },
    
    removeListener: (channel, listener) => {
      const validChannels = [
        'navigate-to',
        'update-available',
        'status-update',
        'console-output',
        'player-joined',
        'player-left',
        'tps-update',
        'server-stopped',
        'server-error',
        'rcon-connected'
      ];
      
      if (validChannels.includes(channel)) {
        ipcRenderer.removeListener(channel, listener);
      }
    }
  }
});