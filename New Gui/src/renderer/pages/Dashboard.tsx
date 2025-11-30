import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { ServerStatus } from '../types/server';
import { 
  ChartBarIcon, 
  UsersIcon, 
  CpuChipIcon, 
  ServerIcon,
  PlayIcon,
  StopIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import LineChart from '../components/LineChart';
import { SystemMetrics } from '../types/server';

interface DashboardProps {
  serverStatus: ServerStatus;
  socket: Socket | null;
}

const Dashboard: React.FC<DashboardProps> = ({ serverStatus, socket }) => {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu: { usage: 0, cores: 4, loadAverage: [0, 0, 0] },
    memory: { total: 8192, used: 4096, free: 4096, percentage: 50 },
    tps: { current: 20, average: 20, history: [] }
  });
  const [playerCount, setPlayerCount] = useState(0);
  const [maxPlayers, setMaxPlayers] = useState(20);
  const [onlinePlayers, setOnlinePlayers] = useState<string[]>([]);

  useEffect(() => {
    if (socket) {
      socket.on('tps-update', (data: { tps: number }) => {
        setMetrics(prev => ({
          ...prev,
          tps: {
            ...prev.tps,
            current: data.tps,
            history: [...prev.tps.history.slice(-20), { time: new Date(), value: data.tps }]
          }
        }));
      });

      socket.on('player-joined', (data: { player: string }) => {
        setPlayerCount(prev => prev + 1);
        setOnlinePlayers(prev => [...prev, data.player]);
      });

      socket.on('player-left', (data: { player: string }) => {
        setPlayerCount(prev => Math.max(0, prev - 1));
        setOnlinePlayers(prev => prev.filter(p => p !== data.player));
      });

      // Fetch initial system metrics
      fetchSystemMetrics();
    }

    return () => {
      if (socket) {
        socket.off('tps-update');
        socket.off('player-joined');
        socket.off('player-left');
      }
    };
  }, [socket]);

  const fetchSystemMetrics = async () => {
    try {
      const systemInfo = await window.electron.ipcRenderer.invoke('get-system-info');
      setMetrics(prev => ({
        ...prev,
        cpu: {
          ...prev.cpu,
          cores: systemInfo.cpus,
          loadAverage: systemInfo.loadAverage
        }
      }));
    } catch (error) {
      console.error('Failed to fetch system metrics:', error);
    }
  };

  const handleServerAction = async (action: 'start' | 'stop' | 'restart') => {
    try {
      let result;
      switch (action) {
        case 'start':
          result = await window.electron.ipcRenderer.invoke('start-server');
          break;
        case 'stop':
          result = await window.electron.ipcRenderer.invoke('stop-server');
          break;
        case 'restart':
          result = await window.electron.ipcRenderer.invoke('restart-server');
          break;
      }
      
      if (result.success) {
        // Action succeeded
        console.log(`Server ${action} successful`);
      } else {
        console.error(`Server ${action} failed:`, result.error);
      }
    } catch (error) {
      console.error(`Failed to ${action} server:`, error);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-slate-400">Monitor and control your Minecraft server</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <ServerIcon className="w-8 h-8 text-green-500" />
              <div>
                <h3 className="text-lg font-semibold text-white">Server Control</h3>
                <p className="text-sm text-slate-400">
                  {serverStatus.isRunning ? 'Server Online' : 'Server Offline'}
                </p>
              </div>
            </div>
            <div className={`status-indicator ${serverStatus.isRunning ? 'status-online' : 'status-offline'}`} />
          </div>
          
          <div className="flex space-x-2">
            {!serverStatus.isRunning ? (
              <button
                onClick={() => handleServerAction('start')}
                className="btn-primary flex-1 flex items-center justify-center space-x-2"
              >
                <PlayIcon className="w-4 h-4" />
                <span>Start</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleServerAction('restart')}
                  className="btn-secondary flex-1 flex items-center justify-center space-x-2"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  <span>Restart</span>
                </button>
                <button
                  onClick={() => handleServerAction('stop')}
                  className="btn-danger flex-1 flex items-center justify-center space-x-2"
                >
                  <StopIcon className="w-4 h-4" />
                  <span>Stop</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Player Count */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <UsersIcon className="w-8 h-8 text-blue-500" />
              <div>
                <h3 className="text-lg font-semibold text-white">Players</h3>
                <p className="text-sm text-slate-400">Connected players</p>
              </div>
            </div>
          </div>
          
          <div className="text-3xl font-bold text-white mb-2">
            {playerCount}/{maxPlayers}
          </div>
          
          {onlinePlayers.length > 0 && (
            <div className="text-sm text-slate-400">
              Online: {onlinePlayers.slice(0, 3).join(', ')}
              {onlinePlayers.length > 3 && ` +${onlinePlayers.length - 3} more`}
            </div>
          )}
        </div>

        {/* Performance */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <ChartBarIcon className="w-8 h-8 text-yellow-500" />
              <div>
                <h3 className="text-lg font-semibold text-white">Performance</h3>
                <p className="text-sm text-slate-400">Server TPS</p>
              </div>
            </div>
          </div>
          
          <div className="text-3xl font-bold text-white mb-2">
            {metrics.tps.current.toFixed(1)}
          </div>
          <div className="text-sm text-slate-400">
            Average: {metrics.tps.average.toFixed(1)} TPS
          </div>
        </div>
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">TPS History</h3>
            <CpuChipIcon className="w-5 h-5 text-slate-400" />
          </div>
          <LineChart
            data={metrics.tps.history}
            color="#22c55e"
            height={200}
            yAxis={{ min: 0, max: 25 }}
          />
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Memory Usage</h3>
            <ChartBarIcon className="w-5 h-5 text-slate-400" />
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm text-slate-400 mb-1">
                <span>Used Memory</span>
                <span>{(metrics.memory.used / 1024).toFixed(1)}GB / {(metrics.memory.total / 1024).toFixed(1)}GB</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${metrics.memory.percentage}%` }}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Total:</span>
                <span className="text-white ml-2">{(metrics.memory.total / 1024).toFixed(1)}GB</span>
              </div>
              <div>
                <span className="text-slate-400">Free:</span>
                <span className="text-white ml-2">{(metrics.memory.free / 1024).toFixed(1)}GB</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {onlinePlayers.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No recent activity</p>
          ) : (
            onlinePlayers.map((player, index) => (
              <div key={player} className="flex items-center space-x-3 p-3 bg-slate-700 rounded-lg">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">{player[0]}</span>
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{player}</p>
                  <p className="text-sm text-slate-400">Player joined the game</p>
                </div>
                <div className="status-indicator status-online" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;