import React, { useState } from 'react';
import { PuzzlePieceIcon, PowerIcon, CogIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const Plugins: React.FC = () => {
  const [plugins] = useState([
    {
      id: 'worldguard',
      name: 'WorldGuard',
      version: '7.0.9',
      description: 'Advanced world protection and management',
      author: 'sk89q',
      enabled: true,
      configFile: 'plugins/WorldGuard/config.yml'
    },
    {
      id: 'worldedit',
      name: 'WorldEdit',
      version: '7.2.15',
      description: 'In-game world editing tools',
      author: 'sk89q',
      enabled: true,
      configFile: 'plugins/WorldEdit/config.yml'
    },
    {
      id: 'luckperms',
      name: 'LuckPerms',
      version: '5.4.102',
      description: 'Advanced permissions management',
      author: 'Luck',
      enabled: true,
      configFile: 'plugins/LuckPerms/config.yml'
    },
    {
      id: 'vault',
      name: 'Vault',
      version: '1.7.3',
      description: 'Economy and permission API',
      author: 'Sleakes',
      enabled: true,
      configFile: null
    }
  ]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <PuzzlePieceIcon className="w-8 h-8 text-yellow-500" />
            <div>
              <h1 className="text-3xl font-bold text-white">Plugin Management</h1>
              <p className="text-slate-400">Manage server plugins and configurations</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">
                {plugins.filter(p => p.enabled).length}
              </div>
              <div className="text-sm text-slate-400">Enabled</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-400">
                {plugins.length}
              </div>
              <div className="text-sm text-slate-400">Total</div>
            </div>
          </div>
        </div>
      </div>

      {/* Plugin List */}
      <div className="space-y-4">
        {plugins.map((plugin) => (
          <div key={plugin.id} className="card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-yellow-500 bg-opacity-20 rounded-lg flex items-center justify-center">
                  <PuzzlePieceIcon className="w-6 h-6 text-yellow-500" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-1">
                    <h3 className="text-lg font-semibold text-white">{plugin.name}</h3>
                    <span className="text-sm text-slate-400">v{plugin.version}</span>
                    <div className={`status-indicator ${plugin.enabled ? 'status-online' : 'status-offline'}`} />
                  </div>
                  <p className="text-sm text-slate-400 mb-2">{plugin.description}</p>
                  <p className="text-xs text-slate-500">by {plugin.author}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    plugin.enabled 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  <PowerIcon className="w-4 h-4 inline mr-1" />
                  {plugin.enabled ? 'Disable' : 'Enable'}
                </button>
                
                {plugin.configFile && (
                  <button className="btn-secondary text-sm py-1 px-3">
                    <CogIcon className="w-4 h-4 inline mr-1" />
                    Config
                  </button>
                )}
                
                <button className="btn-secondary text-sm py-1 px-3">
                  <ArrowPathIcon className="w-4 h-4 inline mr-1" />
                  Reload
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {plugins.length === 0 && (
        <div className="text-center py-12">
          <PuzzlePieceIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-400">No plugins installed</p>
          <p className="text-sm text-slate-500 mt-2">
            Install plugins to enhance your server functionality
          </p>
        </div>
      )}
    </div>
  );
};

export default Plugins;