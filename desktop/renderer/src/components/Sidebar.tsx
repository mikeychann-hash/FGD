import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  HomeIcon,
  CpuChipIcon,
  QueueListIcon,
  CommandLineIcon,
  ServerIcon,
  Cog6ToothIcon,
  MapIcon,
} from '@heroicons/react/24/outline';
import { BackendStatus, BridgeStatus } from '../types';

interface SidebarProps {
  backendStatus: BackendStatus;
  bridgeStatus: BridgeStatus;
}

const Sidebar: React.FC<SidebarProps> = ({ backendStatus, bridgeStatus }) => {
  const navItems = [
    { path: '/dashboard', icon: HomeIcon, label: 'Dashboard' },
    { path: '/npcs', icon: CpuChipIcon, label: 'NPCs' },
    { path: '/tasks', icon: QueueListIcon, label: 'Tasks' },
    { path: '/map', icon: MapIcon, label: 'Map' },
    { path: '/console', icon: CommandLineIcon, label: 'Console' },
    { path: '/server', icon: ServerIcon, label: 'Server' },
    { path: '/settings', icon: Cog6ToothIcon, label: 'Settings' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'offline':
        return 'bg-red-500';
      case 'starting':
        return 'bg-amber-500';
      case 'error':
        return 'bg-red-600';
      default:
        return 'bg-slate-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'offline':
        return 'Offline';
      case 'starting':
        return 'Starting...';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  return (
    <aside className="w-64 bg-slate-900/50 border-r border-slate-800/50 flex flex-col backdrop-blur-sm">
      {/* Header */}
      <div className="p-6 border-b border-slate-800/50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-win11 flex items-center justify-center shadow-lg">
            <CpuChipIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100">FGD Desktop</h1>
            <p className="text-xs text-slate-400">v{backendStatus.version}</p>
          </div>
        </div>
      </div>

      {/* Status indicators */}
      <div className="px-4 py-4 space-y-2">
        <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-win11 border border-slate-700/50">
          <span className="text-xs font-medium text-slate-300">Backend</span>
          <div className="flex items-center space-x-2">
            <div className={`status-dot ${getStatusColor(backendStatus.status) === 'bg-green-500' ? 'status-online' : getStatusColor(backendStatus.status) === 'bg-red-500' ? 'status-offline' : 'status-warning'}`}></div>
            <span className="text-xs text-slate-400">{getStatusText(backendStatus.status)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-win11 border border-slate-700/50">
          <span className="text-xs font-medium text-slate-300">Bridge</span>
          <div className="flex items-center space-x-2">
            <div className={`status-dot ${bridgeStatus.rcon.connected ? 'status-online' : 'status-offline'}`}></div>
            <span className="text-xs text-slate-400">
              {bridgeStatus.rcon.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-win11 border border-slate-700/50">
          <span className="text-xs font-medium text-slate-300">Bots</span>
          <span className="text-xs font-semibold text-green-400">
            {bridgeStatus.mineflayer.botCount} active
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-win11 transition-all duration-200 group ${
                isActive
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30 shadow-md'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent hover:border-slate-700/50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={`w-5 h-5 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-green-400' : 'text-slate-500'
                  }`}
                />
                <span className="font-medium text-sm">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800/50">
        <div className="text-center">
          <p className="text-xs text-slate-500">AICraft Federation</p>
          <p className="text-xs text-slate-600 mt-1">Governance Dashboard</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
