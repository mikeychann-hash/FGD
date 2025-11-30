import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { CommandLineIcon, TrashIcon, ArrowDownIcon } from '@heroicons/react/24/outline';
import { ConsoleLog } from '../types';

interface ConsoleProps {
  socket: Socket | null;
  apiBaseUrl: string;
}

const Console: React.FC<ConsoleProps> = ({ socket, apiBaseUrl }) => {
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'error' | 'debug'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (socket) {
      socket.on('console:log', (log: ConsoleLog) => {
        addLog(log);
      });

      socket.on('bot:spawned', (data: any) => {
        addLog({
          timestamp: new Date(),
          level: 'info',
          source: 'bot',
          message: `Bot ${data.botId} spawned successfully`,
        });
      });

      socket.on('bot:status', (data: any) => {
        addLog({
          timestamp: new Date(),
          level: 'info',
          source: 'bot',
          message: `Bot ${data.botId}: ${data.status}`,
        });
      });
    }

    return () => {
      if (socket) {
        socket.off('console:log');
        socket.off('bot:spawned');
        socket.off('bot:status');
      }
    };
  }, [socket]);

  useEffect(() => {
    if (autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const addLog = (log: ConsoleLog) => {
    setLogs((prev) => [...prev, log]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'info':
        return 'text-blue-400';
      case 'warn':
        return 'text-amber-400';
      case 'error':
        return 'text-red-400';
      case 'debug':
        return 'text-slate-500';
      default:
        return 'text-slate-300';
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'backend':
        return 'text-green-400';
      case 'bridge':
        return 'text-purple-400';
      case 'bot':
        return 'text-cyan-400';
      case 'system':
        return 'text-slate-400';
      default:
        return 'text-slate-300';
    }
  };

  const filteredLogs = filter === 'all' ? logs : logs.filter((log) => log.level === filter);

  return (
    <div className="p-8 space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Console</h1>
          <p className="text-slate-400 mt-1">Real-time system logs and events</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            className={`btn-ghost text-sm ${autoScroll ? 'bg-green-500/20 border-green-500/30' : ''}`}
            onClick={() => setAutoScroll(!autoScroll)}
          >
            <ArrowDownIcon className="w-4 h-4 inline mr-1" />
            Auto-scroll
          </button>
          <button className="btn-danger text-sm" onClick={clearLogs}>
            <TrashIcon className="w-4 h-4 inline mr-1" />
            Clear
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex space-x-2">
        {['all', 'info', 'warn', 'error', 'debug'].map((level) => (
          <button
            key={level}
            className={`px-4 py-2 rounded-win11 text-sm font-medium transition-all ${
              filter === level
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-slate-800/30 text-slate-400 border border-slate-700/50 hover:border-slate-600/50'
            }`}
            onClick={() => setFilter(level as any)}
          >
            {level.charAt(0).toUpperCase() + level.slice(1)}
          </button>
        ))}
      </div>

      {/* Console Logs */}
      <div className="card flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto font-mono text-sm space-y-1">
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="text-center">
                <CommandLineIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>No logs to display</p>
                <p className="text-xs mt-2">Logs will appear here as events occur</p>
              </div>
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <div
                key={index}
                className="p-2 hover:bg-slate-800/50 rounded border-l-2 border-transparent hover:border-green-500/50 transition-colors"
              >
                <span className="text-slate-500">
                  [{log.timestamp.toLocaleTimeString()}]
                </span>{' '}
                <span className={`font-semibold ${getLevelColor(log.level)}`}>
                  [{log.level.toUpperCase()}]
                </span>{' '}
                <span className={getSourceColor(log.source)}>
                  [{log.source.toUpperCase()}]
                </span>{' '}
                <span className="text-slate-300">{log.message}</span>
                {log.details && (
                  <pre className="text-xs text-slate-500 mt-1 ml-4 overflow-x-auto">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};

export default Console;
