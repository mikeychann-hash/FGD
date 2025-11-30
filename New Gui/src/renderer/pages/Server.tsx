import React, { useState, useEffect } from 'react';
import { ServerStatus } from '../types/server';
import { 
  ServerIcon, 
  CogIcon, 
  FolderIcon, 
  DocumentTextIcon,
  PlayIcon,
  StopIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface ServerProps {
  serverStatus: ServerStatus;
}

const Server: React.FC<ServerProps> = ({ serverStatus }) => {
  const [config, setConfig] = useState({
    javaPath: 'java',
    serverJar: 'server.jar',
    maxMemory: '2G',
    minMemory: '1G',
    serverDir: './server',
    rconPort: 25575,
    rconPassword: 'password'
  });

  const [serverProperties, setServerProperties] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'properties' | 'files'>('general');

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setIsLoading(true);
      
      // Load saved configuration
      const savedConfig = await window.electron.ipcRenderer.invoke('get-all-config');
      if (savedConfig) {
        setConfig({
          javaPath: savedConfig.javaPath || 'java',
          serverJar: savedConfig.serverJar || 'server.jar',
          maxMemory: savedConfig.maxMemory || '2G',
          minMemory: savedConfig.minMemory || '1G',
          serverDir: savedConfig.serverDir || './server',
          rconPort: savedConfig.rcon?.port || 25575,
          rconPassword: savedConfig.rcon?.password || 'password'
        });
      }

      // Load server.properties
      const propertiesPath = `${config.serverDir}/server.properties`;
      const result = await window.electron.ipcRenderer.invoke('read-file', propertiesPath);
      if (result.success) {
        setServerProperties(result.content);
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfiguration = async () => {
    try {
      setIsLoading(true);
      
      // Save configuration
      await window.electron.ipcRenderer.invoke('set-config', 'javaPath', config.javaPath);
      await window.electron.ipcRenderer.invoke('set-config', 'serverJar', config.serverJar);
      await window.electron.ipcRenderer.invoke('set-config', 'maxMemory', config.maxMemory);
      await window.electron.ipcRenderer.invoke('set-config', 'minMemory', config.minMemory);
      await window.electron.ipcRenderer.invoke('set-config', 'serverDir', config.serverDir);
      await window.electron.ipcRenderer.invoke('set-config', 'rcon', {
        port: config.rconPort,
        password: config.rconPassword
      });

      // Save server.properties
      const propertiesPath = `${config.serverDir}/server.properties`;
      await window.electron.ipcRenderer.invoke('write-file', propertiesPath, serverProperties);

      alert('Configuration saved successfully!');
    } catch (error) {
      console.error('Failed to save configuration:', error);
      alert('Failed to save configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const startServer = async () => {
    try {
      setIsLoading(true);
      const result = await window.electron.ipcRenderer.invoke('start-server');
      
      if (result.success) {
        alert('Server started successfully!');
      } else {
        alert(`Failed to start server: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to start server:', error);
      alert('Failed to start server');
    } finally {
      setIsLoading(false);
    }
  };

  const stopServer = async () => {
    try {
      setIsLoading(true);
      const result = await window.electron.ipcRenderer.invoke('stop-server');
      
      if (result.success) {
        alert('Server stopped successfully!');
      } else {
        alert(`Failed to stop server: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to stop server:', error);
      alert('Failed to stop server');
    } finally {
      setIsLoading(false);
    }
  };

  const restartServer = async () => {
    try {
      setIsLoading(true);
      const result = await window.electron.ipcRenderer.invoke('restart-server');
      
      if (result.success) {
        alert('Server restarted successfully!');
      } else {
        alert(`Failed to restart server: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to restart server:', error);
      alert('Failed to restart server');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500"></div>
          <p className="mt-4 text-slate-400">Loading server configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ServerIcon className="w-8 h-8 text-green-500" />
            <div>
              <h1 className="text-3xl font-bold text-white">Server Management</h1>
              <p className="text-slate-400">Configure and control your Minecraft server</p>
            </div>
          </div>
          
          {/* Server Controls */}
          <div className="flex items-center space-x-3">
            {!serverStatus.isRunning ? (
              <button
                onClick={startServer}
                disabled={isLoading}
                className="btn-primary flex items-center space-x-2"
              >
                <PlayIcon className="w-4 h-4" />
                <span>Start Server</span>
              </button>
            ) : (
              <>
                <button
                  onClick={restartServer}
                  disabled={isLoading}
                  className="btn-secondary flex items-center space-x-2"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  <span>Restart</span>
                </button>
                <button
                  onClick={stopServer}
                  disabled={isLoading}
                  className="btn-danger flex items-center space-x-2"
                >
                  <StopIcon className="w-4 h-4" />
                  <span>Stop</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <div className={`status-indicator ${serverStatus.isRunning ? 'status-online' : 'status-offline'}`} />
              <span className="text-sm text-slate-400">Status</span>
            </div>
            <p className="text-white font-medium">
              {serverStatus.isRunning ? 'Online' : 'Offline'}
            </p>
          </div>
          
          {serverStatus.isRunning && (
            <>
              <div>
                <span className="text-sm text-slate-400">PID</span>
                <p className="text-white font-medium">{serverStatus.pid}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">RCON</span>
                <p className="text-white font-medium">
                  {serverStatus.rconConnected ? 'Connected' : 'Disconnected'}
                </p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Uptime</span>
                <p className="text-white font-medium">
                  {Math.floor(serverStatus.uptime / 1000 / 60)}m
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1 mb-6 bg-slate-800 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
            activeTab === 'general' ? 'bg-green-500 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <CogIcon className="w-4 h-4" />
          <span>General</span>
        </button>
        <button
          onClick={() => setActiveTab('properties')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
            activeTab === 'properties' ? 'bg-green-500 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <DocumentTextIcon className="w-4 h-4" />
          <span>Properties</span>
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
            activeTab === 'files' ? 'bg-green-500 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <FolderIcon className="w-4 h-4" />
          <span>Files</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'general' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Java Configuration */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Java Configuration</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Java Path
                  </label>
                  <input
                    type="text"
                    value={config.javaPath}
                    onChange={(e) => setConfig({ ...config, javaPath: e.target.value })}
                    className="input-field w-full"
                    placeholder="java"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Server JAR
                  </label>
                  <input
                    type="text"
                    value={config.serverJar}
                    onChange={(e) => setConfig({ ...config, serverJar: e.target.value })}
                    className="input-field w-full"
                    placeholder="server.jar"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Min Memory
                    </label>
                    <input
                      type="text"
                      value={config.minMemory}
                      onChange={(e) => setConfig({ ...config, minMemory: e.target.value })}
                      className="input-field w-full"
                      placeholder="1G"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Max Memory
                    </label>
                    <input
                      type="text"
                      value={config.maxMemory}
                      onChange={(e) => setConfig({ ...config, maxMemory: e.target.value })}
                      className="input-field w-full"
                      placeholder="2G"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* RCON Configuration */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">RCON Configuration</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    RCON Port
                  </label>
                  <input
                    type="number"
                    value={config.rconPort}
                    onChange={(e) => setConfig({ ...config, rconPort: parseInt(e.target.value) })}
                    className="input-field w-full"
                    placeholder="25575"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    RCON Password
                  </label>
                  <input
                    type="password"
                    value={config.rconPassword}
                    onChange={(e) => setConfig({ ...config, rconPassword: e.target.value })}
                    className="input-field w-full"
                    placeholder="password"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'properties' && (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Server Properties</h3>
              <p className="text-sm text-slate-400">server.properties</p>
            </div>
            
            <textarea
              value={serverProperties}
              onChange={(e) => setServerProperties(e.target.value)}
              className="input-field w-full h-96 font-mono text-sm"
              placeholder="# Minecraft server properties"
            />
            
            <div className="mt-4 text-sm text-slate-400">
              <p>Edit server configuration. Changes will take effect after server restart.</p>
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Server Files</h3>
            <div className="text-center py-12">
              <FolderIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-400">File manager coming soon</p>
              <p className="text-sm text-slate-500 mt-2">
                Server directory: {config.serverDir}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={saveConfiguration}
          disabled={isLoading}
          className="btn-primary px-6 py-2"
        >
          {isLoading ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
};

export default Server;