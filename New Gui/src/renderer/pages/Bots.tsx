import React from 'react';
import { CpuChipIcon, PlusIcon, CogIcon } from '@heroicons/react/24/outline';

const Bots: React.FC = () => {
  const botTypes = [
    {
      id: 'miner',
      name: 'Miner Bot',
      description: 'Automatically mines resources',
      icon: '⛏️',
      status: 'available'
    },
    {
      id: 'lumberjack',
      name: 'Lumberjack Bot',
      description: 'Chops trees and collects wood',
      icon: '🪓',
      status: 'available'
    },
    {
      id: 'guard',
      name: 'Guard Bot',
      description: 'Protects areas from hostile mobs',
      icon: '🛡️',
      status: 'available'
    },
    {
      id: 'builder',
      name: 'Builder Bot',
      description: 'Builds structures automatically',
      icon: '🧱',
      status: 'available'
    },
    {
      id: 'farmer',
      name: 'Farmer Bot',
      description: 'Farms crops and tends animals',
      icon: '🌾',
      status: 'coming-soon'
    }
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CpuChipIcon className="w-8 h-8 text-purple-500" />
            <div>
              <h1 className="text-3xl font-bold text-white">Bot Management</h1>
              <p className="text-slate-400">Spawn and manage Minecraft bots</p>
            </div>
          </div>
          
          <button className="btn-primary flex items-center space-x-2">
            <PlusIcon className="w-4 h-4" />
            <span>Spawn Bot</span>
          </button>
        </div>
      </div>

      {/* Bot Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {botTypes.map((botType) => (
          <div
            key={botType.id}
            className={`card p-6 ${botType.status === 'coming-soon' ? 'opacity-50' : 'hover:border-purple-500 transition-colors'}`}
          >
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">{botType.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-1">{botType.name}</h3>
              <p className="text-sm text-slate-400">{botType.description}</p>
            </div>
            
            {botType.status === 'available' ? (
              <div className="space-y-2">
                <button className="btn-primary w-full text-sm py-2">
                  Spawn {botType.name}
                </button>
                <button className="btn-secondary w-full text-sm py-2 flex items-center justify-center space-x-1">
                  <CogIcon className="w-4 h-4" />
                  <span>Configure</span>
                </button>
              </div>
            ) : (
              <div className="text-center">
                <span className="text-xs text-slate-500 bg-slate-700 px-3 py-1 rounded-full">
                  Coming Soon
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Active Bots */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Active Bots</h3>
        <div className="text-center py-12">
          <CpuChipIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-400">No bots currently active</p>
          <p className="text-sm text-slate-500 mt-2">
            Spawn a bot to get started
          </p>
        </div>
      </div>
    </div>
  );
};

export default Bots;
