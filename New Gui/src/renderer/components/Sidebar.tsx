import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ServerStatus } from '../types/server';
import {
  HomeIcon,
  ServerIcon,
  UsersIcon,
  PuzzlePieceIcon,
  CommandLineIcon,
  CogIcon,
  PowerIcon,
  CpuChipIcon
} from '@heroicons/react/24/outline';

interface SidebarProps {
  serverStatus: ServerStatus;
}

const Sidebar: React.FC<SidebarProps> = ({ serverStatus }) => {
  const location = useLocation();

  const menuItems = [
    { path: '/dashboard', icon: HomeIcon, label: 'Dashboard' },
    { path: '/server', icon: ServerIcon, label: 'Server' },
    { path: '/players', icon: UsersIcon, label: 'Players' },
    { path: '/bots', icon: CpuChipIcon, label: 'Bots' },
    { path: '/plugins', icon: PuzzlePieceIcon, label: 'Plugins' },
    { path: '/console', icon: CommandLineIcon, label: 'Console' },
    { path: '/settings', icon: CogIcon, label: 'Settings' }
  ];

  return (
    <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
      {/* Logo and Server Status */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
            <ServerIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Minecraft Admin</h1>
            <p className="text-xs text-slate-400">Server Management</p>
          </div>
        </div>
        
        {/* Server Status */}
        <div className="bg-slate-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-300">Server Status</span>
            <div className={`status-indicator ${serverStatus.isRunning ? 'status-online' : 'status-offline'}`} />
          </div>
          <p className="text-xs text-slate-400">
            {serverStatus.isRunning ? 'Online' : 'Offline'}
            {serverStatus.isRunning && serverStatus.pid && ` (PID: ${serverStatus.pid})`}
          </p>
          {serverStatus.isRunning && (
            <p className="text-xs text-slate-400 mt-1">
              Uptime: {Math.floor(serverStatus.uptime / 1000 / 60)}m
            </p>
          )}
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors duration-200 ${
                    isActive
                      ? 'bg-green-500 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Quick Actions */}
      <div className="p-4 border-t border-slate-700">
        <div className="space-y-2">
          <button
            onClick={() => {
              if (serverStatus.isRunning) {
                window.electron.ipcRenderer.invoke('stop-server');
              } else {
                window.electron.ipcRenderer.invoke('start-server');
              }
            }}
            className={`w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg font-medium transition-colors duration-200 ${
              serverStatus.isRunning
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            <PowerIcon className="w-4 h-4" />
            <span>{serverStatus.isRunning ? 'Stop Server' : 'Start Server'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
