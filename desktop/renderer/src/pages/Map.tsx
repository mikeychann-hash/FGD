import React, { useState, useEffect, useRef } from 'react';
import { MapIcon, UserGroupIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import type { NPCBot } from '../types';

interface MapProps {
  apiBaseUrl: string;
  bots: NPCBot[];
}

const Map: React.FC<MapProps> = ({ apiBaseUrl, bots }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mapScale, setMapScale] = useState(2);
  const [centerX, setCenterX] = useState(0);
  const [centerZ, setCenterZ] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [selectedBot, setSelectedBot] = useState<string | null>(null);
  const [worldSeed, setWorldSeed] = useState<string>('Unknown');

  const colors = {
    miner: '#f59e0b',
    builder: '#3b82f6',
    farmer: '#10b981',
    guard: '#ef4444',
    explorer: '#8b5cf6',
    crafter: '#ec4899',
  };

  useEffect(() => {
    drawMap();
  }, [bots, mapScale, centerX, centerZ, showGrid, selectedBot]);

  useEffect(() => {
    // Fetch world seed from backend
    fetch(`${apiBaseUrl}/api/minecraft/status`)
      .then((res) => res.json())
      .then((data) => {
        if (data.worldSeed) {
          setWorldSeed(data.worldSeed);
        }
      })
      .catch((err) => console.error('Failed to fetch world seed:', err));
  }, [apiBaseUrl]);

  const drawMap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;

      const gridSize = 50 * mapScale;
      const offsetX = (centerX * mapScale) % gridSize;
      const offsetZ = (centerZ * mapScale) % gridSize;

      for (let x = -offsetX; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      for (let z = -offsetZ; z < height; z += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, z);
        ctx.lineTo(width, z);
        ctx.stroke();
      }
    }

    // Draw center crosshair
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 10, height / 2);
    ctx.lineTo(width / 2 + 10, height / 2);
    ctx.moveTo(width / 2, height / 2 - 10);
    ctx.lineTo(width / 2, height / 2 + 10);
    ctx.stroke();

    // Draw bots
    bots.forEach((bot) => {
      if (!bot.position) return;

      const screenX = width / 2 + (bot.position.x - centerX) * mapScale;
      const screenZ = height / 2 + (bot.position.z - centerZ) * mapScale;

      // Bot circle
      const isSelected = selectedBot === bot.id;
      const radius = isSelected ? 12 : 8;

      ctx.fillStyle = colors[bot.role] || '#64748b';
      ctx.beginPath();
      ctx.arc(screenX, screenZ, radius, 0, 2 * Math.PI);
      ctx.fill();

      // Bot outline
      ctx.strokeStyle = isSelected ? '#fff' : colors[bot.role] || '#64748b';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      // Bot name label
      ctx.fillStyle = '#fff';
      ctx.font = isSelected ? 'bold 12px "Segoe UI Variable"' : '11px "Segoe UI Variable"';
      ctx.textAlign = 'center';
      ctx.fillText(bot.name, screenX, screenZ - radius - 5);

      // Draw direction indicator if bot is moving
      if (bot.status === 'moving' && bot.position) {
        ctx.strokeStyle = colors[bot.role] || '#64748b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screenX, screenZ);
        ctx.lineTo(screenX, screenZ - 20);
        ctx.stroke();

        // Arrow head
        ctx.beginPath();
        ctx.moveTo(screenX, screenZ - 20);
        ctx.lineTo(screenX - 4, screenZ - 15);
        ctx.lineTo(screenX + 4, screenZ - 15);
        ctx.closePath();
        ctx.fillStyle = colors[bot.role] || '#64748b';
        ctx.fill();
      }
    });

    // Draw coordinate labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px "Segoe UI Variable"';
    ctx.textAlign = 'left';
    ctx.fillText(`X: ${centerX.toFixed(0)}`, 10, height - 40);
    ctx.fillText(`Z: ${centerZ.toFixed(0)}`, 10, height - 20);
    ctx.fillText(`Scale: ${mapScale.toFixed(1)}x`, 10, height - 60);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickZ = e.clientY - rect.top;

    const centerScreenX = canvas.width / 2;
    const centerScreenZ = canvas.height / 2;

    // Check if click is on a bot
    for (const bot of bots) {
      if (!bot.position) continue;

      const screenX = centerScreenX + (bot.position.x - centerX) * mapScale;
      const screenZ = centerScreenZ + (bot.position.z - centerZ) * mapScale;

      const distance = Math.sqrt((clickX - screenX) ** 2 + (clickZ - screenZ) ** 2);
      if (distance < 12) {
        setSelectedBot(bot.id);
        return;
      }
    }

    setSelectedBot(null);
  };

  const handleZoomIn = () => setMapScale(Math.min(mapScale + 0.5, 10));
  const handleZoomOut = () => setMapScale(Math.max(mapScale - 0.5, 0.5));
  const handleRecenter = () => {
    if (bots.length > 0 && bots[0].position) {
      setCenterX(bots[0].position.x);
      setCenterZ(bots[0].position.z);
    } else {
      setCenterX(0);
      setCenterZ(0);
    }
  };

  const selectedBotData = bots.find((b) => b.id === selectedBot);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Live Map</h1>
          <p className="text-slate-400 mt-1">
            Real-time bot locations and world overview
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="badge badge-info">
            <GlobeAltIcon className="w-4 h-4 mr-1" />
            Seed: {worldSeed}
          </div>
          <div className="badge badge-primary">
            <UserGroupIcon className="w-4 h-4 mr-1" />
            {bots.length} Bots Online
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Map Canvas */}
        <div className="xl:col-span-3">
          <div className="card p-0 overflow-hidden">
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center">
                <MapIcon className="w-5 h-5 mr-2" />
                World Map
              </h2>
              <div className="flex items-center space-x-2">
                <button
                  className="btn-ghost px-3 py-1 text-sm"
                  onClick={() => setShowGrid(!showGrid)}
                >
                  {showGrid ? 'Hide Grid' : 'Show Grid'}
                </button>
                <button className="btn-ghost px-3 py-1 text-sm" onClick={handleZoomOut}>
                  -
                </button>
                <span className="text-sm text-slate-400 min-w-16 text-center">
                  {mapScale.toFixed(1)}x
                </span>
                <button className="btn-ghost px-3 py-1 text-sm" onClick={handleZoomIn}>
                  +
                </button>
                <button className="btn-secondary px-3 py-1 text-sm" onClick={handleRecenter}>
                  Recenter
                </button>
              </div>
            </div>
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={1200}
                height={600}
                className="w-full bg-slate-900"
                onClick={handleCanvasClick}
                style={{ cursor: 'crosshair' }}
              />
            </div>
          </div>
        </div>

        {/* Bot List & Legend */}
        <div className="space-y-4">
          {/* Selected Bot Details */}
          {selectedBotData && (
            <div className="card">
              <h3 className="text-lg font-semibold text-slate-100 mb-4">Selected Bot</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: colors[selectedBotData.role] }}
                  />
                  <div>
                    <p className="font-semibold text-slate-200">{selectedBotData.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{selectedBotData.role}</p>
                  </div>
                </div>
                {selectedBotData.position && (
                  <div className="text-sm space-y-1">
                    <p className="text-slate-400">
                      <span className="font-mono">X:</span> {selectedBotData.position.x.toFixed(1)}
                    </p>
                    <p className="text-slate-400">
                      <span className="font-mono">Y:</span> {selectedBotData.position.y.toFixed(1)}
                    </p>
                    <p className="text-slate-400">
                      <span className="font-mono">Z:</span> {selectedBotData.position.z.toFixed(1)}
                    </p>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-700/50">
                  <p className="text-xs text-slate-400">Status</p>
                  <p
                    className={`text-sm font-medium ${
                      selectedBotData.status === 'working'
                        ? 'text-green-400'
                        : selectedBotData.status === 'moving'
                        ? 'text-blue-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {selectedBotData.status}
                  </p>
                </div>
                {selectedBotData.currentTask && (
                  <div className="pt-2 border-t border-slate-700/50">
                    <p className="text-xs text-slate-400">Current Task</p>
                    <p className="text-sm text-slate-200">{selectedBotData.currentTask.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Bot Roles</h3>
            <div className="space-y-2">
              {Object.entries(colors).map(([role, color]) => (
                <div key={role} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-sm text-slate-300 capitalize">{role}</span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {bots.filter((b) => b.role === role).length}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Active Bots List */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Active Bots</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {bots.map((bot) => (
                <button
                  key={bot.id}
                  className={`w-full text-left p-3 rounded-win11 transition-colors ${
                    selectedBot === bot.id
                      ? 'bg-slate-700/50 border border-slate-600'
                      : 'bg-slate-800/30 border border-transparent hover:bg-slate-700/30'
                  }`}
                  onClick={() => {
                    setSelectedBot(bot.id);
                    if (bot.position) {
                      setCenterX(bot.position.x);
                      setCenterZ(bot.position.z);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: colors[bot.role] }}
                      />
                      <span className="text-sm font-medium text-slate-200">{bot.name}</span>
                    </div>
                    <div className={`status-dot ${bot.status === 'working' ? 'status-online' : bot.status === 'moving' ? 'status-away' : 'status-idle'}`} />
                  </div>
                  {bot.position && (
                    <p className="text-xs text-slate-500 mt-1 font-mono">
                      {bot.position.x.toFixed(0)}, {bot.position.y.toFixed(0)}, {bot.position.z.toFixed(0)}
                    </p>
                  )}
                </button>
              ))}
              {bots.length === 0 && (
                <p className="text-center text-slate-500 text-sm py-8">No bots online</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Map;
