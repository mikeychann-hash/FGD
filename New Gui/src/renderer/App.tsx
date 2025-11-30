import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Server from './pages/Server';
import Players from './pages/Players';
import Bots from './pages/Bots';
import Plugins from './pages/Plugins';
import Console from './pages/Console';
import Settings from './pages/Settings';
import { ServerStatus } from './types/server';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus>({
    isRunning: false,
    pid: null,
    rconConnected: false,
    uptime: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize socket connection
    const socketIo = io('http://localhost:3001');
    setSocket(socketIo);

    // Listen for server status updates
    socketIo.on('status-update', (status: ServerStatus) => {
      setServerStatus(status);
    });

    socketIo.on('console-output', (data: any) => {
      // Handle console output
      console.log('Console:', data);
    });

    socketIo.on('player-joined', (data: any) => {
      // Handle player join events
      console.log('Player joined:', data.player);
    });

    socketIo.on('player-left', (data: any) => {
      // Handle player leave events
      console.log('Player left:', data.player);
    });

    socketIo.on('tps-update', (data: any) => {
      // Handle TPS updates
      console.log('TPS Update:', data.tps);
    });

    // Get initial server status
    fetchServerStatus();

    return () => {
      socketIo.disconnect();
    };
  }, []);

  const fetchServerStatus = async () => {
    try {
      const status = await window.electron.ipcRenderer.invoke('get-server-status');
      setServerStatus(status);
    } catch (error) {
      console.error('Failed to fetch server status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500"></div>
          <p className="mt-4 text-slate-400">Loading Minecraft Server Admin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-900">
      <Sidebar serverStatus={serverStatus} />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<Dashboard serverStatus={serverStatus} socket={socket} />} />
            <Route path="/server" element={<Server serverStatus={serverStatus} />} />
            <Route path="/players" element={<Players socket={socket} />} />
            <Route path="/bots" element={<Bots />} />
            <Route path="/plugins" element={<Plugins />} />
            <Route path="/console" element={<Console socket={socket} />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

// Type declarations for electron API
declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
        removeListener: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
      };
    };
  }
}

export default App;