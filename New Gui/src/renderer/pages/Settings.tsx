import React, { useState, useEffect } from 'react';
import { 
  CogIcon, 
  PaintBrushIcon, 
  BellIcon, 
  ShieldCheckIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'notifications' | 'security'>('general');
  const [settings, setSettings] = useState({
    autoStart: false,
    minimizeToTray: true,
    checkUpdates: true,
    theme: 'dark',
    accentColor: 'green',
    consoleFontSize: 14,
    notifications: {
      playerJoin: true,
      playerLeave: true,
      serverEvents: true,
      errors: true
    },
    security: {
      requirePassword: false,
      autoLock: false,
      lockTimeout: 300
    }
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await window.electron.ipcRenderer.invoke('get-all-config');
      if (savedSettings && savedSettings.appSettings) {
        setSettings({ ...settings, ...savedSettings.appSettings });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      await window.electron.ipcRenderer.invoke('set-config', 'appSettings', settings);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    }
  };

  const resetSettings = () => {
    if (confirm('Are you sure you want to reset all settings to default?')) {
      setSettings({
        autoStart: false,
        minimizeToTray: true,
        checkUpdates: true,
        theme: 'dark',
        accentColor: 'green',
        consoleFontSize: 14,
        notifications: {
          playerJoin: true,
          playerLeave: true,
          serverEvents: true,
          errors: true
        },
        security: {
          requirePassword: false,
          autoLock: false,
          lockTimeout: 300
        }
      });
    }
  };

  const menuItems = [
    { id: 'general', label: 'General', icon: CogIcon },
    { id: 'appearance', label: 'Appearance', icon: PaintBrushIcon },
    { id: 'notifications', label: 'Notifications', icon: BellIcon },
    { id: 'security', label: 'Security', icon: ShieldCheckIcon }
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center space-x-3">
          <CogIcon className="w-8 h-8 text-slate-400" />
          <div>
            <h1 className="text-3xl font-bold text-white">Settings</h1>
            <p className="text-slate-400">Configure your Minecraft Server Admin application</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="card p-4">
            <nav className="space-y-2">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                    activeTab === item.id
                      ? 'bg-green-500 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="card p-6">
            {activeTab === 'general' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white mb-4">General Settings</h3>
                
                <div className="space-y-4">
                  <label className="flex items-center justify-between">
                    <div>
                      <span className="text-white font-medium">Auto-start server</span>
                      <p className="text-sm text-slate-400">Automatically start server when app launches</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoStart}
                      onChange={(e) => setSettings({ ...settings, autoStart: e.target.checked })}
                      className="w-5 h-5 text-green-500 bg-slate-700 border-slate-600 rounded focus:ring-green-500"
                    />
                  </label>

                  <label className="flex items-center justify-between">
                    <div>
                      <span className="text-white font-medium">Minimize to tray</span>
                      <p className="text-sm text-slate-400">Keep app running in system tray when minimized</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.minimizeToTray}
                      onChange={(e) => setSettings({ ...settings, minimizeToTray: e.target.checked })}
                      className="w-5 h-5 text-green-500 bg-slate-700 border-slate-600 rounded focus:ring-green-500"
                    />
                  </label>

                  <label className="flex items-center justify-between">
                    <div>
                      <span className="text-white font-medium">Check for updates</span>
                      <p className="text-sm text-slate-400">Automatically check for app updates</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.checkUpdates}
                      onChange={(e) => setSettings({ ...settings, checkUpdates: e.target.checked })}
                      className="w-5 h-5 text-green-500 bg-slate-700 border-slate-600 rounded focus:ring-green-500"
                    />
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white mb-4">Appearance Settings</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Theme
                    </label>
                    <select
                      value={settings.theme}
                      onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
                      className="input-field w-full"
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                      <option value="system">System</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Accent Color
                    </label>
                    <select
                      value={settings.accentColor}
                      onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
                      className="input-field w-full"
                    >
                      <option value="green">Green</option>
                      <option value="blue">Blue</option>
                      <option value="purple">Purple</option>
                      <option value="red">Red</option>
                      <option value="orange">Orange</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Console Font Size
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="20"
                      value={settings.consoleFontSize}
                      onChange={(e) => setSettings({ ...settings, consoleFontSize: parseInt(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                      <span>10px</span>
                      <span>{settings.consoleFontSize}px</span>
                      <span>20px</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white mb-4">Notification Settings</h3>
                
                <div className="space-y-4">
                  <label className="flex items-center justify-between">
                    <span className="text-white font-medium">Player join notifications</span>
                    <input
                      type="checkbox"
                      checked={settings.notifications.playerJoin}
                      onChange={(e) => setSettings({ 
                        ...settings, 
                        notifications: { ...settings.notifications, playerJoin: e.target.checked }
                      })}
                      className="w-5 h-5 text-green-500 bg-slate-700 border-slate-600 rounded focus:ring-green-500"
                    />
                  </label>

                  <label className="flex items-center justify-between">
                    <span className="text-white font-medium">Player leave notifications</span>
                    <input
                      type="checkbox"
                      checked={settings.notifications.playerLeave}
                      onChange={(e) => setSettings({ 
                        ...settings, 
                        notifications: { ...settings.notifications, playerLeave: e.target.checked }
                      })}
                      className="w-5 h-5 text-green-500 bg-slate-700 border-slate-600 rounded focus:ring-green-500"
                    />
                  </label>

                  <label className="flex items-center justify-between">
                    <span className="text-white font-medium">Server event notifications</span>
                    <input
                      type="checkbox"
                      checked={settings.notifications.serverEvents}
                      onChange={(e) => setSettings({ 
                        ...settings, 
                        notifications: { ...settings.notifications, serverEvents: e.target.checked }
                      })}
                      className="w-5 h-5 text-green-500 bg-slate-700 border-slate-600 rounded focus:ring-green-500"
                    />
                  </label>

                  <label className="flex items-center justify-between">
                    <span className="text-white font-medium">Error notifications</span>
                    <input
                      type="checkbox"
                      checked={settings.notifications.errors}
                      onChange={(e) => setSettings({ 
                        ...settings, 
                        notifications: { ...settings.notifications, errors: e.target.checked }
                      })}
                      className="w-5 h-5 text-green-500 bg-slate-700 border-slate-600 rounded focus:ring-green-500"
                    />
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white mb-4">Security Settings</h3>
                
                <div className="space-y-4">
                  <label className="flex items-center justify-between">
                    <div>
                      <span className="text-white font-medium">Require password</span>
                      <p className="text-sm text-slate-400">Require password to access the application</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.security.requirePassword}
                      onChange={(e) => setSettings({ 
                        ...settings, 
                        security: { ...settings.security, requirePassword: e.target.checked }
                      })}
                      className="w-5 h-5 text-green-500 bg-slate-700 border-slate-600 rounded focus:ring-green-500"
                    />
                  </label>

                  <label className="flex items-center justify-between">
                    <div>
                      <span className="text-white font-medium">Auto-lock</span>
                      <p className="text-sm text-slate-400">Automatically lock after inactivity</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.security.autoLock}
                      onChange={(e) => setSettings({ 
                        ...settings, 
                        security: { ...settings.security, autoLock: e.target.checked }
                      })}
                      className="w-5 h-5 text-green-500 bg-slate-700 border-slate-600 rounded focus:ring-green-500"
                    />
                  </label>

                  {settings.security.autoLock && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Auto-lock timeout (seconds)
                      </label>
                      <input
                        type="number"
                        min="60"
                        max="3600"
                        value={settings.security.lockTimeout}
                        onChange={(e) => setSettings({ 
                          ...settings, 
                          security: { ...settings.security, lockTimeout: parseInt(e.target.value) }
                        })}
                        className="input-field w-full"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-700">
              <button
                onClick={resetSettings}
                className="btn-secondary flex items-center space-x-2"
              >
                <ArrowPathIcon className="w-4 h-4" />
                <span>Reset to Default</span>
              </button>
              
              <button
                onClick={saveSettings}
                className="btn-primary"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;