import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import {
  CpuChipIcon,
  ServerIcon,
  CommandLineIcon,
  CheckCircleIcon,
  ClockIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';
import { BackendStatus, BridgeStatus, SystemMetrics, NPCBot } from '../types';

interface DashboardProps {
  socket: Socket | null;
  apiBaseUrl: string;
  backendStatus: BackendStatus;
  bridgeStatus: BridgeStatus;
}

const Dashboard: React.FC<DashboardProps> = ({
  socket,
  apiBaseUrl,
  backendStatus,
  bridgeStatus,
}) => {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu: { usage: 0, cores: 4, loadAverage: [0, 0, 0] },
    memory: { total: 8192, used: 0, free: 8192, percentage: 0 },
    bots: { active: 0, total: 0, maxAllowed: 8 },
  });
  const [bots, setBots] = useState<NPCBot[]>([]);
  const [recentActivity, setRecentActivity] = useState<string[]>([]);

  useEffect(() => {
    if (socket) {
      socket.on('bot:spawned', (data: any) => {
        addActivity(`Bot ${data.botId} spawned`);
        fetchBots();
      });

      socket.on('bot:status', (data: any) => {
        addActivity(`Bot ${data.botId}: ${data.status}`);
      });

      socket.on('bot:task_complete', (data: any) => {
        addActivity(`Bot ${data.botId} completed task: ${data.taskType}`);
      });

      socket.on('system:status', (data: any) => {
        if (data.metrics) {
          setMetrics(data.metrics);
        }
      });
    }

    fetchBots();
    fetchMetrics();

    const interval = setInterval(() => {
      fetchMetrics();
    }, 5000);

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('bot:spawned');
        socket.off('bot:status');
        socket.off('bot:task_complete');
        socket.off('system:status');
      }
    };
  }, [socket, apiBaseUrl]);

  const fetchBots = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/bots`);
      if (response.ok) {
        const data = await response.json();
        setBots(data.bots || []);
        setMetrics((prev) => ({
          ...prev,
          bots: {
            active: data.bots?.filter((b: NPCBot) => b.status !== 'offline').length || 0,
            total: data.bots?.length || 0,
            maxAllowed: 8,
          },
        }));
      }
    } catch (error) {
      console.error('Failed to fetch bots:', error);
    }
  };

  const fetchMetrics = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/health`);
      if (response.ok) {
        const data = await response.json();
        // Update metrics from health endpoint if available
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  const addActivity = (message: string) => {
    setRecentActivity((prev) => [
      `[${new Date().toLocaleTimeString()}] ${message}`,
      ...prev.slice(0, 9),
    ]);
  };

  const formatUptime = (uptime?: number) => {
    if (!uptime) return 'N/A';
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-slate-400 mt-1">Real-time FGD system overview</p>
        </div>
        <div className="flex items-center space-x-2 px-4 py-2 bg-slate-800/50 rounded-win11-lg border border-slate-700/50">
          <div className={`status-dot ${backendStatus.status === 'online' ? 'status-online' : 'status-offline'}`}></div>
          <span className="text-sm text-slate-300">
            System {backendStatus.status === 'online' ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Backend Status */}
        <div className="card card-hover">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Backend</p>
              <p className="text-2xl font-bold text-green-400">
                {backendStatus.status === 'online' ? 'Running' : 'Stopped'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Uptime: {formatUptime(backendStatus.uptime)}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-500/20 rounded-win11 flex items-center justify-center">
              <ServerIcon className="w-7 h-7 text-green-400" />
            </div>
          </div>
        </div>

        {/* Active Bots */}
        <div className="card card-hover">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Active Bots</p>
              <p className="text-2xl font-bold text-blue-400">
                {metrics.bots.active}/{metrics.bots.maxAllowed}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {metrics.bots.total} total registered
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-500/20 rounded-win11 flex items-center justify-center">
              <CpuChipIcon className="w-7 h-7 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Bridge Status */}
        <div className="card card-hover">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Bridge</p>
              <p className="text-2xl font-bold text-purple-400">
                {bridgeStatus.rcon.connected ? 'Connected' : 'Disconnected'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {bridgeStatus.rcon.host}:{bridgeStatus.rcon.port}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-500/20 rounded-win11 flex items-center justify-center">
              <CommandLineIcon className="w-7 h-7 text-purple-400" />
            </div>
          </div>
        </div>

        {/* Memory Usage */}
        <div className="card card-hover">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Memory</p>
              <p className="text-2xl font-bold text-amber-400">
                {metrics.memory.percentage.toFixed(0)}%
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {(metrics.memory.used / 1024).toFixed(1)} GB / {(metrics.memory.total / 1024).toFixed(1)} GB
              </p>
            </div>
            <div className="w-12 h-12 bg-amber-500/20 rounded-win11 flex items-center justify-center">
              <CubeIcon className="w-7 h-7 text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Bots List */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-100">Active Bots</h2>
            <span className="badge badge-info">{bots.filter(b => b.status !== 'offline').length} online</span>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {bots.filter(b => b.status !== 'offline').length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <CpuChipIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No active bots</p>
              </div>
            ) : (
              bots
                .filter((bot) => bot.status !== 'offline')
                .map((bot) => (
                  <div
                    key={bot.id}
                    className="flex items-center justify-between p-3 bg-slate-800/30 rounded-win11 border border-slate-700/50 hover:border-slate-600/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`status-dot ${bot.status === 'working' ? 'status-online' : bot.status === 'idle' ? 'status-warning' : ''}`}></div>
                      <div>
                        <p className="font-medium text-slate-200">{bot.name}</p>
                        <p className="text-xs text-slate-500 capitalize">{bot.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400 capitalize">{bot.status}</p>
                      {bot.currentTask && (
                        <p className="text-xs text-slate-600">{bot.currentTask.type}</p>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-100">Recent Activity</h2>
            <ClockIcon className="w-5 h-5 text-slate-500" />
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {recentActivity.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <CheckCircleIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No recent activity</p>
              </div>
            ) : (
              recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="p-3 bg-slate-800/30 rounded-win11 border border-slate-700/50"
                >
                  <p className="text-sm text-slate-300 font-mono">{activity}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="btn-primary text-sm">Spawn Bot</button>
          <button className="btn-secondary text-sm">View Tasks</button>
          <button className="btn-secondary text-sm">Check Bridge</button>
          <button className="btn-secondary text-sm">System Logs</button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
