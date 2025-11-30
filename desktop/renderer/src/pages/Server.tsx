import React, { useState, useEffect } from 'react';
import { ServerIcon, CheckCircleIcon, XCircleIcon, SignalIcon, PlayIcon, StopIcon, CommandLineIcon } from '@heroicons/react/24/outline';
import { BackendStatus, BridgeStatus } from '../types';

interface ServerProps {
  backendStatus: BackendStatus;
  bridgeStatus: BridgeStatus;
  apiBaseUrl: string;
}

const Server: React.FC<ServerProps> = ({ backendStatus, bridgeStatus, apiBaseUrl }) => {
  const [minecraftStatus, setMinecraftStatus] = useState({ running: false, pid: null as number | null });
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [logs, setLogs] = useState<{ message: string; level: string; timestamp: Date }[]>([]);
  const [command, setCommand] = useState('');
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    checkMinecraftStatus();

    // Listen for server events
    const unsubscribeLogs = window.fgdDesktop.minecraft.onLog(({ message, level }) => {
      setLogs((prev) => [...prev.slice(-100), { message, level, timestamp: new Date() }]);
    });

    const unsubscribeStarted = window.fgdDesktop.minecraft.onStarted(() => {
      setMinecraftStatus({ running: true, pid: null });
      setIsStarting(false);
      checkMinecraftStatus();
    });

    const unsubscribeStopped = window.fgdDesktop.minecraft.onStopped(() => {
      setMinecraftStatus({ running: false, pid: null });
      setIsStopping(false);
    });

    return () => {
      unsubscribeLogs();
      unsubscribeStarted();
      unsubscribeStopped();
    };
  }, []);

  const checkMinecraftStatus = async () => {
    try {
      const status = await window.fgdDesktop.minecraft.getStatus();
      setMinecraftStatus(status);
    } catch (error) {
      console.error('Failed to get Minecraft status:', error);
    }
  };

  const handleStartServer = async () => {
    setIsStarting(true);
    try {
      const result = await window.fgdDesktop.minecraft.start();
      if (!result.success) {
        alert(result.message);
        setIsStarting(false);
      }
    } catch (error) {
      alert('Failed to start server: ' + (error as Error).message);
      setIsStarting(false);
    }
  };

  const handleStopServer = async () => {
    setIsStopping(true);
    try {
      const result = await window.fgdDesktop.minecraft.stop();
      if (!result.success) {
        alert(result.message);
        setIsStopping(false);
      }
    } catch (error) {
      alert('Failed to stop server: ' + (error as Error).message);
      setIsStopping(false);
    }
  };

  const handleSendCommand = async () => {
    if (!command.trim()) return;
    try {
      const result = await window.fgdDesktop.minecraft.sendCommand(command);
      if (result.success) {
        setCommand('');
      } else {
        alert(result.message);
      }
    } catch (error) {
      alert('Failed to send command: ' + (error as Error).message);
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Server Status</h1>
          <p className="text-slate-400 mt-1">Monitor FGD backend and Minecraft server</p>
        </div>
      </div>

      {/* Minecraft Server Control */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className={`w-14 h-14 ${minecraftStatus.running ? 'bg-green-500/20' : 'bg-slate-500/20'} rounded-win11-lg flex items-center justify-center`}>
              <ServerIcon className={`w-8 h-8 ${minecraftStatus.running ? 'text-green-400' : 'text-slate-400'}`} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-100">Minecraft Server</h2>
              <p className="text-slate-400 text-sm">Launch and control your server</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {!minecraftStatus.running ? (
              <button
                className="btn-primary flex items-center space-x-2"
                onClick={handleStartServer}
                disabled={isStarting}
              >
                <PlayIcon className="w-5 h-5" />
                <span>{isStarting ? 'Starting...' : 'Start Server'}</span>
              </button>
            ) : (
              <button
                className="btn-danger flex items-center space-x-2"
                onClick={handleStopServer}
                disabled={isStopping}
              >
                <StopIcon className="w-5 h-5" />
                <span>{isStopping ? 'Stopping...' : 'Stop Server'}</span>
              </button>
            )}
            {minecraftStatus.running && (
              <button
                className="btn-ghost"
                onClick={() => setShowLogs(!showLogs)}
              >
                <CommandLineIcon className="w-5 h-5 inline mr-1" />
                {showLogs ? 'Hide Logs' : 'Show Logs'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-slate-800/30 rounded-win11 border border-slate-700/50">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Status</p>
            <div className="flex items-center space-x-2">
              {minecraftStatus.running ? (
                <>
                  <div className="status-dot status-online"></div>
                  <span className="font-semibold text-green-400">Running</span>
                </>
              ) : (
                <>
                  <div className="status-dot status-offline"></div>
                  <span className="font-semibold text-red-400">Stopped</span>
                </>
              )}
            </div>
          </div>

          <div className="p-4 bg-slate-800/30 rounded-win11 border border-slate-700/50">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Process ID</p>
            <p className="text-lg font-semibold text-slate-200">
              {minecraftStatus.pid || 'N/A'}
            </p>
          </div>

          <div className="p-4 bg-slate-800/30 rounded-win11 border border-slate-700/50">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Quick Action</p>
            <button
              className="btn-secondary text-sm w-full"
              onClick={() => window.open('/settings', '_self')}
            >
              Configure Server
            </button>
          </div>
        </div>

        {/* Console Logs */}
        {showLogs && minecraftStatus.running && (
          <div className="mt-6 space-y-3">
            <div className="p-4 bg-slate-900/50 rounded-win11 border border-slate-700/50 max-h-80 overflow-y-auto font-mono text-xs">
              {logs.length === 0 ? (
                <p className="text-slate-500 text-center py-4">Waiting for server logs...</p>
              ) : (
                logs.map((log, index) => (
                  <div
                    key={index}
                    className={`py-1 ${log.level === 'error' ? 'text-red-400' : 'text-slate-300'}`}
                  >
                    <span className="text-slate-500">
                      [{log.timestamp.toLocaleTimeString()}]
                    </span>{' '}
                    {log.message}
                  </div>
                ))
              )}
            </div>

            {/* Command Input */}
            <div className="flex space-x-2">
              <input
                type="text"
                className="input flex-1 font-mono text-sm"
                placeholder="Enter server command (e.g., say Hello World)"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendCommand()}
              />
              <button className="btn-primary" onClick={handleSendCommand}>
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Backend Status */}
      <div className="card">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-14 h-14 bg-green-500/20 rounded-win11-lg flex items-center justify-center">
            <ServerIcon className="w-8 h-8 text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-100">FGD Backend</h2>
            <p className="text-slate-400 text-sm">Core server and API</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-slate-800/30 rounded-win11 border border-slate-700/50">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Status</p>
            <div className="flex items-center space-x-2">
              {backendStatus.status === 'online' ? (
                <CheckCircleIcon className="w-5 h-5 text-green-400" />
              ) : (
                <XCircleIcon className="w-5 h-5 text-red-400" />
              )}
              <span className={`font-semibold ${backendStatus.status === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                {backendStatus.status === 'online' ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          <div className="p-4 bg-slate-800/30 rounded-win11 border border-slate-700/50">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Port</p>
            <p className="text-lg font-semibold text-slate-200">{backendStatus.port}</p>
          </div>

          <div className="p-4 bg-slate-800/30 rounded-win11 border border-slate-700/50">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Version</p>
            <p className="text-lg font-semibold text-slate-200">{backendStatus.version}</p>
          </div>
        </div>
      </div>

      {/* RCON Bridge */}
      <div className="card">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-14 h-14 bg-purple-500/20 rounded-win11-lg flex items-center justify-center">
            <SignalIcon className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-100">RCON Bridge</h2>
            <p className="text-slate-400 text-sm">Minecraft server connection</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-slate-800/30 rounded-win11 border border-slate-700/50">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Connection</p>
            <div className="flex items-center space-x-2">
              {bridgeStatus.rcon.connected ? (
                <CheckCircleIcon className="w-5 h-5 text-green-400" />
              ) : (
                <XCircleIcon className="w-5 h-5 text-red-400" />
              )}
              <span className={`font-semibold ${bridgeStatus.rcon.connected ? 'text-green-400' : 'text-red-400'}`}>
                {bridgeStatus.rcon.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          <div className="p-4 bg-slate-800/30 rounded-win11 border border-slate-700/50">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Host</p>
            <p className="text-lg font-semibold text-slate-200 font-mono">{bridgeStatus.rcon.host}</p>
          </div>

          <div className="p-4 bg-slate-800/30 rounded-win11 border border-slate-700/50">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Port</p>
            <p className="text-lg font-semibold text-slate-200 font-mono">{bridgeStatus.rcon.port}</p>
          </div>
        </div>
      </div>

      {/* Mineflayer Bridge */}
      <div className="card">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-14 h-14 bg-cyan-500/20 rounded-win11-lg flex items-center justify-center">
            <ServerIcon className="w-8 h-8 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-100">Mineflayer Bridge</h2>
            <p className="text-slate-400 text-sm">Native bot connections</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-slate-800/30 rounded-win11 border border-slate-700/50">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Status</p>
            <div className="flex items-center space-x-2">
              {bridgeStatus.mineflayer.connected ? (
                <CheckCircleIcon className="w-5 h-5 text-green-400" />
              ) : (
                <XCircleIcon className="w-5 h-5 text-red-400" />
              )}
              <span className={`font-semibold ${bridgeStatus.mineflayer.connected ? 'text-green-400' : 'text-red-400'}`}>
                {bridgeStatus.mineflayer.connected ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          <div className="p-4 bg-slate-800/30 rounded-win11 border border-slate-700/50">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Connected Bots</p>
            <p className="text-lg font-semibold text-cyan-400">{bridgeStatus.mineflayer.botCount}</p>
          </div>

          <div className="p-4 bg-slate-800/30 rounded-win11 border border-slate-700/50">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Plugin</p>
            <span className={`badge ${bridgeStatus.plugin.installed ? 'badge-success' : 'badge-error'}`}>
              {bridgeStatus.plugin.installed ? 'Installed' : 'Not Installed'}
            </span>
          </div>
        </div>
      </div>

      {/* API Info */}
      <div className="card">
        <h2 className="text-xl font-semibold text-slate-100 mb-4">API Information</h2>
        <div className="space-y-3">
          <div className="p-4 bg-slate-800/30 rounded-win11 border border-slate-700/50">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Base URL</p>
            <p className="text-slate-200 font-mono">{apiBaseUrl}</p>
          </div>
          <div className="p-4 bg-slate-800/30 rounded-win11 border border-slate-700/50">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Health Endpoint</p>
            <p className="text-slate-200 font-mono">{apiBaseUrl}/api/health</p>
          </div>
          <div className="p-4 bg-slate-800/30 rounded-win11 border border-slate-700/50">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">WebSocket</p>
            <p className="text-slate-200 font-mono">Socket.IO {backendStatus.status === 'online' ? '(Connected)' : '(Disconnected)'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Server;
