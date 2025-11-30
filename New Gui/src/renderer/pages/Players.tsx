import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { Player } from '../types/server';
import { 
  UsersIcon, 
  MagnifyingGlassIcon,
  UserIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  MapPinIcon,
  HeartIcon,
  CubeIcon
} from '@heroicons/react/24/outline';

interface PlayersProps {
  socket: Socket | null;
}

const Players: React.FC<PlayersProps> = ({ socket }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);

  useEffect(() => {
    if (socket) {
      socket.on('player-joined', (data: { player: string }) => {
        // Add or update player
        setPlayers(prev => {
          const existing = prev.find(p => p.name === data.player);
          if (existing) {
            return prev.map(p => 
              p.name === data.player 
                ? { ...p, isOnline: true, lastSeen: new Date() }
                : p
            );
          } else {
            return [...prev, {
              name: data.player,
              uuid: '',
              health: 20,
              hunger: 20,
              level: 0,
              dimension: 'overworld',
              position: { x: 0, y: 0, z: 0 },
              inventory: [],
              isOnline: true,
              lastSeen: new Date()
            }];
          }
        });
      });

      socket.on('player-left', (data: { player: string }) => {
        setPlayers(prev => 
          prev.map(p => 
            p.name === data.player 
              ? { ...p, isOnline: false, lastSeen: new Date() }
              : p
          )
        );
      });
    }

    return () => {
      if (socket) {
        socket.off('player-joined');
        socket.off('player-left');
      }
    };
  }, [socket]);

  const filteredPlayers = players.filter(player =>
    player.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const executePlayerCommand = async (command: string, playerName: string, reason?: string) => {
    try {
      const fullCommand = reason ? `${command} ${playerName} ${reason}` : `${command} ${playerName}`;
      const result = await window.electron.ipcRenderer.invoke('send-rcon-command', fullCommand);
      
      if (result) {
        console.log(`Command executed: ${fullCommand}`, result);
      }
    } catch (error) {
      console.error(`Failed to execute command: ${command}`, error);
    }
  };

  const kickPlayer = async (playerName: string, reason: string = 'Kicked by admin') => {
    await executePlayerCommand('kick', playerName, reason);
  };

  const banPlayer = async (playerName: string, reason: string = 'Banned by admin') => {
    await executePlayerCommand('ban', playerName, reason);
  };

  const teleportPlayer = async (playerName: string, target: string) => {
    await executePlayerCommand('tp', playerName, target);
  };

  const giveItem = async (playerName: string, item: string, amount: number = 1) => {
    await executePlayerCommand('give', playerName, `${item} ${amount}`);
  };

  const openPlayerModal = (player: Player) => {
    setSelectedPlayer(player);
    setShowPlayerModal(true);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <UsersIcon className="w-8 h-8 text-blue-500" />
            <div>
              <h1 className="text-3xl font-bold text-white">Player Management</h1>
              <p className="text-slate-400">Monitor and manage connected players</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">
                {players.filter(p => p.isOnline).length}
              </div>
              <div className="text-sm text-slate-400">Online</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-400">
                {players.filter(p => !p.isOnline).length}
              </div>
              <div className="text-sm text-slate-400">Offline</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <MagnifyingGlassIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search players..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field w-full pl-10"
          />
        </div>
      </div>

      {/* Player Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredPlayers.map((player) => (
          <div
            key={player.name}
            className="card p-4 hover:border-green-500 transition-colors cursor-pointer"
            onClick={() => openPlayerModal(player)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {player.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-white">{player.name}</h3>
                  <p className="text-sm text-slate-400">
                    {player.isOnline ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
              <div className={`status-indicator ${player.isOnline ? 'status-online' : 'status-offline'}`} />
            </div>

            {player.isOnline && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm">
                  <HeartIcon className="w-4 h-4 text-red-400" />
                  <span className="text-slate-300">Health: {player.health}/20</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <CubeIcon className="w-4 h-4 text-yellow-400" />
                  <span className="text-slate-300">Level: {player.level}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <MapPinIcon className="w-4 h-4 text-blue-400" />
                  <span className="text-slate-300">
                    {player.dimension}
                  </span>
                </div>
              </div>
            )}
            
            {!player.isOnline && (
              <div className="text-sm text-slate-400">
                Last seen: {new Date(player.lastSeen).toLocaleString()}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredPlayers.length === 0 && (
        <div className="text-center py-12">
          <UserIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-400">
            {searchTerm ? 'No players found matching your search.' : 'No players to display.'}
          </p>
        </div>
      )}

      {/* Player Detail Modal */}
      {showPlayerModal && selectedPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Player: {selectedPlayer.name}</h3>
              <button
                onClick={() => setShowPlayerModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-2xl">
                    {selectedPlayer.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{selectedPlayer.name}</p>
                  <p className="text-sm text-slate-400">
                    {selectedPlayer.isOnline ? 'Online' : 'Offline'}
                  </p>
                  <div className={`status-indicator ${selectedPlayer.isOnline ? 'status-online' : 'status-offline'}`} />
                </div>
              </div>

              {selectedPlayer.isOnline && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <HeartIcon className="w-5 h-5 text-red-400" />
                      <span className="text-slate-300">Health</span>
                      <span className="text-white font-medium">{selectedPlayer.health}/20</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <ShieldCheckIcon className="w-5 h-5 text-blue-400" />
                      <span className="text-slate-300">Level</span>
                      <span className="text-white font-medium">{selectedPlayer.level}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <MapPinIcon className="w-5 h-5 text-green-400" />
                    <span className="text-slate-300">Position</span>
                    <span className="text-white font-mono text-sm">
                      {Math.floor(selectedPlayer.position.x)}, {Math.floor(selectedPlayer.position.y)}, {Math.floor(selectedPlayer.position.z)}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <CubeIcon className="w-5 h-5 text-yellow-400" />
                    <span className="text-slate-300">Dimension</span>
                    <span className="text-white">{selectedPlayer.dimension}</span>
                  </div>
                </>
              )}

              <div className="pt-4 border-t border-slate-700">
                <h4 className="text-sm font-medium text-slate-300 mb-3">Actions</h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedPlayer.isOnline ? (
                    <>
                      <button
                        onClick={() => {
                          const reason = prompt('Kick reason:');
                          if (reason !== null) {
                            kickPlayer(selectedPlayer.name, reason || undefined);
                            setShowPlayerModal(false);
                          }
                        }}
                        className="btn-danger text-sm py-2"
                      >
                        Kick
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('Ban reason:');
                          if (reason !== null) {
                            banPlayer(selectedPlayer.name, reason || undefined);
                            setShowPlayerModal(false);
                          }
                        }}
                        className="btn-danger text-sm py-2"
                      >
                        Ban
                      </button>
                      <button
                        onClick={() => {
                          const target = prompt('Teleport to (player or coordinates):');
                          if (target) {
                            teleportPlayer(selectedPlayer.name, target);
                            setShowPlayerModal(false);
                          }
                        }}
                        className="btn-secondary text-sm py-2"
                      >
                        Teleport
                      </button>
                      <button
                        onClick={() => {
                          const item = prompt('Item to give:');
                          if (item) {
                            giveItem(selectedPlayer.name, item);
                            setShowPlayerModal(false);
                          }
                        }}
                        className="btn-secondary text-sm py-2"
                      >
                        Give Item
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        banPlayer(selectedPlayer.name);
                        setShowPlayerModal(false);
                      }}
                      className="btn-danger text-sm py-2 col-span-2"
                    >
                      Ban Player
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Players;