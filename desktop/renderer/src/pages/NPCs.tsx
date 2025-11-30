import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import {
  PlusIcon,
  TrashIcon,
  PlayIcon,
  StopIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { NPCBot } from '../types';

interface NPCsProps {
  socket: Socket | null;
  apiBaseUrl: string;
}

const NPCs: React.FC<NPCsProps> = ({ socket, apiBaseUrl }) => {
  const [bots, setBots] = useState<NPCBot[]>([]);
  const [selectedBot, setSelectedBot] = useState<NPCBot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSpawnModal, setShowSpawnModal] = useState(false);
  const [newBotConfig, setNewBotConfig] = useState({
    name: '',
    role: 'miner' as 'miner' | 'builder' | 'farmer' | 'guard' | 'explorer' | 'crafter',
  });

  useEffect(() => {
    fetchBots();

    if (socket) {
      socket.on('bot:spawned', () => fetchBots());
      socket.on('bot:status', () => fetchBots());
      socket.on('bot:despawned', () => fetchBots());
    }

    const interval = setInterval(fetchBots, 10000);

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('bot:spawned');
        socket.off('bot:status');
        socket.off('bot:despawned');
      }
    };
  }, [socket, apiBaseUrl]);

  const fetchBots = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/bots`);
      if (response.ok) {
        const data = await response.json();
        setBots(data.bots || []);
      }
    } catch (error) {
      console.error('Failed to fetch bots:', error);
    }
  };

  const handleSpawnBot = async () => {
    if (!newBotConfig.name) {
      alert('Please enter a bot name');
      return;
    }

    setIsLoading(true);
    try {
      // Create bot
      const createResponse = await fetch(`${apiBaseUrl}/api/bots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBotConfig.name,
          role: newBotConfig.role,
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create bot');
      }

      const botData = await createResponse.json();

      // Spawn bot
      const spawnResponse = await fetch(`${apiBaseUrl}/api/bots/${botData.id}/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: { x: 0, y: 64, z: 0 },
        }),
      });

      if (!spawnResponse.ok) {
        throw new Error('Failed to spawn bot');
      }

      setShowSpawnModal(false);
      setNewBotConfig({ name: '', role: 'miner' });
      fetchBots();
    } catch (error) {
      console.error('Error spawning bot:', error);
      alert('Failed to spawn bot: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDespawnBot = async (botId: string) => {
    if (!confirm('Are you sure you want to despawn this bot?')) return;

    try {
      const response = await fetch(`${apiBaseUrl}/api/bots/${botId}/despawn`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to despawn bot');
      }

      fetchBots();
    } catch (error) {
      console.error('Error despawning bot:', error);
      alert('Failed to despawn bot');
    }
  };

  const handleDeleteBot = async (botId: string) => {
    if (!confirm('Are you sure you want to delete this bot?')) return;

    try {
      const response = await fetch(`${apiBaseUrl}/api/bots/${botId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete bot');
      }

      fetchBots();
      setSelectedBot(null);
    } catch (error) {
      console.error('Error deleting bot:', error);
      alert('Failed to delete bot');
    }
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      miner: 'text-amber-400',
      builder: 'text-blue-400',
      farmer: 'text-green-400',
      guard: 'text-red-400',
      explorer: 'text-purple-400',
      crafter: 'text-cyan-400',
    };
    return colors[role] || 'text-slate-400';
  };

  const getRoleBadge = (role: string) => {
    const badges: Record<string, string> = {
      miner: 'badge-warning',
      builder: 'badge-info',
      farmer: 'badge-success',
      guard: 'badge-error',
      explorer: 'badge-info',
      crafter: 'badge-success',
    };
    return badges[role] || 'badge-info';
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">NPCs</h1>
          <p className="text-slate-400 mt-1">Manage your autonomous bots</p>
        </div>
        <button
          onClick={() => setShowSpawnModal(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <PlusIcon className="w-5 h-5" />
          <span>Spawn Bot</span>
        </button>
      </div>

      {/* Bot Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bots.map((bot) => (
          <div
            key={bot.id}
            className={`card card-hover cursor-pointer ${
              selectedBot?.id === bot.id ? 'ring-2 ring-green-500' : ''
            }`}
            onClick={() => setSelectedBot(bot)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div
                  className={`status-dot ${
                    bot.status === 'working' || bot.status === 'moving'
                      ? 'status-online'
                      : bot.status === 'idle'
                      ? 'status-warning'
                      : 'status-offline'
                  }`}
                ></div>
                <div>
                  <h3 className="font-semibold text-slate-100">{bot.name}</h3>
                  <p className="text-xs text-slate-500">ID: {bot.id}</p>
                </div>
              </div>
              <span className={`badge ${getRoleBadge(bot.role)}`}>{bot.role}</span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="text-slate-200 capitalize">{bot.status}</span>
              </div>
              {bot.position && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Position:</span>
                  <span className="text-slate-200 font-mono text-xs">
                    {bot.position.x.toFixed(0)}, {bot.position.y.toFixed(0)}, {bot.position.z.toFixed(0)}
                  </span>
                </div>
              )}
              {bot.health !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Health:</span>
                  <span className="text-green-400">{bot.health}/20</span>
                </div>
              )}
              {bot.currentTask && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Task:</span>
                  <span className="text-blue-400 capitalize">{bot.currentTask.type}</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex space-x-2">
              {bot.status === 'offline' ? (
                <button
                  className="btn-primary flex-1 text-sm py-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Spawn logic here
                  }}
                >
                  <PlayIcon className="w-4 h-4 inline mr-1" />
                  Spawn
                </button>
              ) : (
                <button
                  className="btn-secondary flex-1 text-sm py-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDespawnBot(bot.id);
                  }}
                >
                  <StopIcon className="w-4 h-4 inline mr-1" />
                  Despawn
                </button>
              )}
              <button
                className="btn-danger text-sm py-2 px-3"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteBot(bot.id);
                }}
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {bots.length === 0 && (
          <div className="col-span-full text-center py-12">
            <PlusIcon className="w-16 h-16 mx-auto text-slate-700 mb-4" />
            <p className="text-slate-400">No bots yet. Click "Spawn Bot" to get started.</p>
          </div>
        )}
      </div>

      {/* Spawn Modal */}
      {showSpawnModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="card max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-slate-100 mb-4">Spawn New Bot</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Bot Name
                </label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="e.g., miner_01"
                  value={newBotConfig.name}
                  onChange={(e) =>
                    setNewBotConfig({ ...newBotConfig, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Role
                </label>
                <select
                  className="input w-full"
                  value={newBotConfig.role}
                  onChange={(e) =>
                    setNewBotConfig({
                      ...newBotConfig,
                      role: e.target.value as any,
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
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                className="btn-secondary flex-1"
                onClick={() => setShowSpawnModal(false)}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                className="btn-primary flex-1"
                onClick={handleSpawnBot}
                disabled={isLoading}
              >
                {isLoading ? 'Spawning...' : 'Spawn Bot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NPCs;
