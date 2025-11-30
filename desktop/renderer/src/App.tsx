import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import NPCs from './pages/NPCs';
import Tasks from './pages/Tasks';
import Console from './pages/Console';
import Server from './pages/Server';
import Settings from './pages/Settings';
import Map from './pages/Map';
import { BackendStatus, BridgeStatus, NPCBot } from './types';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({
    status: 'starting',
    port: 3000,
    version: '2.1.0',
  });
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>({
    rcon: { connected: false, host: 'localhost', port: 25575 },
    mineflayer: { connected: false, botCount: 0 },
    plugin: { installed: false },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [bots, setBots] = useState<NPCBot[]>([]);

  useEffect(() => {
    initializeApp();

    // Listen for backend exit events
    window.fgdDesktop.onBackendExit(({ reason }) => {
      setBackendStatus({
        status: 'offline',
        port: 3000,
        version: '2.1.0',
      });
      console.error('Backend stopped:', reason);
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const initializeApp = async () => {
    try {
      // Get configuration from main process
      const config = await window.fgdDesktop.getConfig();
      setApiBaseUrl(config.apiBaseUrl);

      // Initialize Socket.IO connection
      const socketInstance = io(config.apiBaseUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
      });

      socketInstance.on('connect', () => {
        console.log('Socket.IO connected');
        fetchBackendStatus(config.apiBaseUrl);
      });

      socketInstance.on('disconnect', () => {
        console.log('Socket.IO disconnected');
      });

      socketInstance.on('system:status', (data: any) => {
        if (data.backend) {
          setBackendStatus((prev) => ({
            ...prev,
            status: 'online',
            uptime: data.backend.uptime,
          }));
        }
      });

      socketInstance.on('bridge:status', (data: BridgeStatus) => {
        setBridgeStatus(data);
      });

      socketInstance.on('bot:spawned', (data: any) => {
        console.log('Bot spawned:', data);
      });

      socketInstance.on('bot:status', (data: any) => {
        console.log('Bot status update:', data);
      });

      socketInstance.on('bot:spawned', (data: any) => {
        fetchBots(baseUrl);
      });

      socketInstance.on('bot:moved', (data: any) => {
        setBots((prev) =>
          prev.map((bot) =>
            bot.id === data.botId && data.position
              ? { ...bot, position: data.position }
              : bot
          )
        );
      });

      setSocket(socketInstance);
      fetchBots(baseUrl);
    } catch (error) {
      console.error('Failed to initialize app:', error);
      setBackendStatus((prev) => ({ ...prev, status: 'error' }));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBackendStatus = async (baseUrl: string) => {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      const data = await response.json();

      if (response.ok && data.status !== 'error') {
        setBackendStatus({
          status: 'online',
          port: parseInt(baseUrl.split(':').pop() || '3000'),
          version: data.version || '2.1.0',
          uptime: data.uptime,
        });
      } else {
        setBackendStatus((prev) => ({ ...prev, status: 'error' }));
      }
    } catch (error) {
      console.error('Failed to fetch backend status:', error);
      setBackendStatus((prev) => ({ ...prev, status: 'offline' }));
    }
  };

  const fetchBots = async (baseUrl: string) => {
    try {
      const response = await fetch(`${baseUrl}/api/bots`);
      const data = await response.json();
      setBots(data.bots || []);
    } catch (error) {
      console.error('Failed to fetch bots:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="text-center space-y-4">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-slate-700"></div>
            <div className="absolute inset-0 rounded-full border-4 border-green-500 border-t-transparent animate-spin"></div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-slate-200">FGD Desktop</h2>
            <p className="text-sm text-slate-400">Initializing system...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <Sidebar backendStatus={backendStatus} bridgeStatus={bridgeStatus} />

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <Dashboard
                  socket={socket}
                  apiBaseUrl={apiBaseUrl}
                  backendStatus={backendStatus}
                  bridgeStatus={bridgeStatus}
                />
              }
            />
            <Route
              path="/npcs"
              element={<NPCs socket={socket} apiBaseUrl={apiBaseUrl} />}
            />
            <Route
              path="/tasks"
              element={<Tasks socket={socket} apiBaseUrl={apiBaseUrl} />}
            />
            <Route
              path="/console"
              element={<Console socket={socket} apiBaseUrl={apiBaseUrl} />}
            />
            <Route
              path="/server"
              element={
                <Server
                  backendStatus={backendStatus}
                  bridgeStatus={bridgeStatus}
                  apiBaseUrl={apiBaseUrl}
                />
              }
            />
            <Route
              path="/settings"
              element={<Settings apiBaseUrl={apiBaseUrl} />}
            />
            <Route
              path="/map"
              element={<Map apiBaseUrl={apiBaseUrl} bots={bots} />}
            />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;
