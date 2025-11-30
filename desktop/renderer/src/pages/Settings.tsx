import React, { useState, useEffect } from 'react';
import { Cog6ToothIcon, ServerIcon, CpuChipIcon, BellIcon, FolderIcon } from '@heroicons/react/24/outline';

interface SettingsProps {
  apiBaseUrl: string;
}

const Settings: React.FC<SettingsProps> = ({ apiBaseUrl }) => {
  const [settings, setSettings] = useState({
    minecraftServerJar: '',
    javaPath: 'java',
    minMemory: '2G',
    maxMemory: '4G',
    backend: {
      port: 3000,
      autoStart: true,
    },
    minecraft: {
      host: 'localhost',
      port: 25565,
      rconPort: 25575,
      rconPassword: '',
    },
    bots: {
      maxCount: 8,
      defaultRole: 'miner',
      autoReconnect: true,
    },
    notifications: {
      botEvents: true,
      systemAlerts: true,
      taskUpdates: false,
    },
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const allSettings = await window.fgdDesktop.settings.getAll();
      setSettings((prev) => ({ ...prev, ...allSettings }));
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSave = async () => {
    try {
      // Save each setting
      await window.fgdDesktop.settings.set('minecraftServerJar', settings.minecraftServerJar);
      await window.fgdDesktop.settings.set('javaPath', settings.javaPath);
      await window.fgdDesktop.settings.set('minMemory', settings.minMemory);
      await window.fgdDesktop.settings.set('maxMemory', settings.maxMemory);
      await window.fgdDesktop.settings.set('backend', settings.backend);
      await window.fgdDesktop.settings.set('minecraft', settings.minecraft);
      await window.fgdDesktop.settings.set('bots', settings.bots);
      await window.fgdDesktop.settings.set('notifications', settings.notifications);

      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings: ' + (error as Error).message);
    }
  };

  const handleBrowseServerJar = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.jar';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setSettings({ ...settings, minecraftServerJar: file.path });
      }
    };
    input.click();
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Settings</h1>
          <p className="text-slate-400 mt-1">Configure FGD Desktop preferences</p>
        </div>
        <button className="btn-primary" onClick={handleSave}>
          Save Changes
        </button>
      </div>

      {/* Minecraft Server Launcher */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-win11 flex items-center justify-center">
            <ServerIcon className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-100">Minecraft Server Launcher</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Server JAR File
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                className="input flex-1"
                value={settings.minecraftServerJar}
                onChange={(e) =>
                  setSettings({ ...settings, minecraftServerJar: e.target.value })
                }
                placeholder="C:\path\to\paper-1.21.8-60.jar"
              />
              <button className="btn-secondary px-3" onClick={handleBrowseServerJar}>
                <FolderIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Path to your Minecraft server JAR file (Paper, Spigot, etc.)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Java Path
            </label>
            <input
              type="text"
              className="input w-full"
              value={settings.javaPath}
              onChange={(e) => setSettings({ ...settings, javaPath: e.target.value })}
              placeholder="java"
            />
            <p className="text-xs text-slate-500 mt-1">
              Path to Java executable (leave as 'java' if in PATH)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Minimum Memory
              </label>
              <input
                type="text"
                className="input w-full"
                value={settings.minMemory}
                onChange={(e) => setSettings({ ...settings, minMemory: e.target.value })}
                placeholder="2G"
              />
              <p className="text-xs text-slate-500 mt-1">Example: 2G, 1024M</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Maximum Memory
              </label>
              <input
                type="text"
                className="input w-full"
                value={settings.maxMemory}
                onChange={(e) => setSettings({ ...settings, maxMemory: e.target.value })}
                placeholder="4G"
              />
              <p className="text-xs text-slate-500 mt-1">Example: 4G, 4096M</p>
            </div>
          </div>
        </div>
      </div>

      {/* Backend Settings */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-green-500/20 rounded-win11 flex items-center justify-center">
            <ServerIcon className="w-6 h-6 text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-100">FGD Backend</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Backend Port
            </label>
            <input
              type="number"
              className="input w-full md:w-64"
              value={settings.backend.port}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  backend: { ...settings.backend, port: parseInt(e.target.value) },
                })
              }
            />
            <p className="text-xs text-slate-500 mt-1">
              Port number for the FGD backend server
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="autoStart"
              className="w-4 h-4 rounded bg-slate-800 border-slate-700"
              checked={settings.backend.autoStart}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  backend: { ...settings.backend, autoStart: e.target.checked },
                })
              }
            />
            <label htmlFor="autoStart" className="text-sm text-slate-300">
              Auto-start backend with desktop app
            </label>
          </div>
        </div>
      </div>

      {/* Minecraft RCON Settings */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-purple-500/20 rounded-win11 flex items-center justify-center">
            <CubeIcon className="w-6 h-6 text-purple-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-100">Minecraft RCON</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Server Host
            </label>
            <input
              type="text"
              className="input w-full"
              value={settings.minecraft.host}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  minecraft: { ...settings.minecraft, host: e.target.value },
                })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Server Port
            </label>
            <input
              type="number"
              className="input w-full"
              value={settings.minecraft.port}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  minecraft: { ...settings.minecraft, port: parseInt(e.target.value) },
                })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              RCON Port
            </label>
            <input
              type="number"
              className="input w-full"
              value={settings.minecraft.rconPort}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  minecraft: { ...settings.minecraft, rconPort: parseInt(e.target.value) },
                })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              RCON Password
            </label>
            <input
              type="password"
              className="input w-full"
              value={settings.minecraft.rconPassword}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  minecraft: { ...settings.minecraft, rconPassword: e.target.value },
                })
              }
              placeholder="Enter RCON password"
            />
          </div>
        </div>
      </div>

      {/* Bot Settings */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-blue-500/20 rounded-win11 flex items-center justify-center">
            <CpuChipIcon className="w-6 h-6 text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-100">Bot Configuration</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Maximum Bot Count
            </label>
            <input
              type="number"
              className="input w-full md:w-64"
              value={settings.bots.maxCount}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  bots: { ...settings.bots, maxCount: parseInt(e.target.value) },
                })
              }
              min={1}
              max={20}
            />
            <p className="text-xs text-slate-500 mt-1">
              Maximum number of concurrent bots (1-20)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Default Role
            </label>
            <select
              className="input w-full md:w-64"
              value={settings.bots.defaultRole}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  bots: { ...settings.bots, defaultRole: e.target.value },
                })
              }
            >
              <option value="miner">Miner</option>
              <option value="builder">Builder</option>
              <option value="farmer">Farmer</option>
              <option value="guard">Guard</option>
              <option value="explorer">Explorer</option>
              <option value="crafter">Crafter</option>
            </select>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="autoReconnect"
              className="w-4 h-4 rounded bg-slate-800 border-slate-700"
              checked={settings.bots.autoReconnect}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  bots: { ...settings.bots, autoReconnect: e.target.checked },
                })
              }
            />
            <label htmlFor="autoReconnect" className="text-sm text-slate-300">
              Auto-reconnect bots on disconnect
            </label>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-amber-500/20 rounded-win11 flex items-center justify-center">
            <BellIcon className="w-6 h-6 text-amber-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-100">Notifications</h2>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="botEvents"
              className="w-4 h-4 rounded bg-slate-800 border-slate-700"
              checked={settings.notifications.botEvents}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, botEvents: e.target.checked },
                })
              }
            />
            <label htmlFor="botEvents" className="text-sm text-slate-300">
              Bot spawn/despawn events
            </label>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="systemAlerts"
              className="w-4 h-4 rounded bg-slate-800 border-slate-700"
              checked={settings.notifications.systemAlerts}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, systemAlerts: e.target.checked },
                })
              }
            />
            <label htmlFor="systemAlerts" className="text-sm text-slate-300">
              System alerts and errors
            </label>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="taskUpdates"
              className="w-4 h-4 rounded bg-slate-800 border-slate-700"
              checked={settings.notifications.taskUpdates}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, taskUpdates: e.target.checked },
                })
              }
            />
            <label htmlFor="taskUpdates" className="text-sm text-slate-300">
              Task completion updates
            </label>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-slate-700/50 rounded-win11 flex items-center justify-center">
            <Cog6ToothIcon className="w-6 h-6 text-slate-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-100">About</h2>
        </div>

        <div className="space-y-2 text-sm text-slate-400">
          <p>
            <strong className="text-slate-300">FGD Desktop</strong> - AICraft Federation Governance Dashboard
          </p>
          <p>Version 2.1.0</p>
          <p>Built with Electron, React, and TypeScript</p>
          <p className="text-xs text-slate-600 mt-4">
            © 2025 AICraft Federation. Licensed under GPL-3.0
          </p>
        </div>
      </div>
    </div>
  );
};

// Missing import
const CubeIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

export default Settings;
