import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { ConsoleEntry } from '../types/server';
import { 
  CommandLineIcon, 
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline';

interface ConsoleProps {
  socket: Socket | null;
}

const Console: React.FC<ConsoleProps> = ({ socket }) => {
  const [consoleOutput, setConsoleOutput] = useState<ConsoleEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'>('ALL');
  const [command, setCommand] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const consoleRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (socket) {
      socket.on('console-output', (data: { type: string; data: string }) => {
        const lines = data.data.split('\n').filter(line => line.trim());
        
        lines.forEach(line => {
          const entry: ConsoleEntry = {
            timestamp: new Date(),
            level: parseLogLevel(line),
            message: line,
            source: data.type
          };
          
          setConsoleOutput(prev => [...prev.slice(-1000), entry]); // Keep last 1000 entries
        });
      });
    }

    return () => {
      if (socket) {
        socket.off('console-output');
      }
    };
  }, [socket]);

  useEffect(() => {
    if (autoScroll && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleOutput, autoScroll]);

  const parseLogLevel = (message: string): ConsoleEntry['level'] => {
    if (message.includes('[ERROR]') || message.includes('ERROR')) return 'ERROR';
    if (message.includes('[WARN]') || message.includes('WARN')) return 'WARN';
    if (message.includes('[DEBUG]') || message.includes('DEBUG')) return 'DEBUG';
    if (message.includes('[INFO]') || message.includes('INFO')) return 'INFO';
    return 'INFO';
  };

  const getLogColor = (level: ConsoleEntry['level']): string => {
    switch (level) {
      case 'ERROR': return 'text-red-400';
      case 'WARN': return 'text-yellow-400';
      case 'DEBUG': return 'text-blue-400';
      case 'INFO': return 'text-green-400';
      default: return 'text-slate-300';
    }
  };

  const filteredOutput = consoleOutput.filter(entry => {
    const matchesSearch = searchTerm === '' || 
      entry.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterLevel === 'ALL' || entry.level === filterLevel;
    return matchesSearch && matchesFilter;
  });

  const sendCommand = async () => {
    if (!command.trim()) return;

    try {
      const result = await window.electron.ipcRenderer.invoke('send-rcon-command', command);
      
      // Add command to console output
      const commandEntry: ConsoleEntry = {
        timestamp: new Date(),
        level: 'INFO',
        message: `> ${command}`,
        source: 'command'
      };
      
      const responseEntry: ConsoleEntry = {
        timestamp: new Date(),
        level: 'INFO',
        message: result || 'Command executed successfully',
        source: 'response'
      };
      
      setConsoleOutput(prev => [...prev, commandEntry, responseEntry]);
      setCommand('');
    } catch (error) {
      const errorEntry: ConsoleEntry = {
        timestamp: new Date(),
        level: 'ERROR',
        message: `Failed to execute command: ${error}`,
        source: 'error'
      };
      setConsoleOutput(prev => [...prev, errorEntry]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendCommand();
    }
  };

  const clearConsole = () => {
    setConsoleOutput([]);
  };

  const exportLogs = () => {
    const logContent = filteredOutput
      .map(entry => `[${entry.timestamp.toISOString()}] [${entry.level}] ${entry.message}`)
      .join('\n');
    
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `server-logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <CommandLineIcon className="w-8 h-8 text-green-500" />
            <div>
              <h1 className="text-2xl font-bold text-white">Server Console</h1>
              <p className="text-slate-400">Real-time server logs and command interface</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                autoScroll 
                  ? 'bg-green-500 text-white' 
                  : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
              }`}
            >
              <ArrowDownIcon className="w-4 h-4 inline mr-1" />
              Auto-scroll
            </button>
            
            <button
              onClick={clearConsole}
              className="px-3 py-1 bg-slate-600 text-slate-300 rounded text-sm font-medium hover:bg-slate-500 transition-colors"
            >
              Clear
            </button>
            
            <button
              onClick={exportLogs}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-500 transition-colors"
            >
              Export
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field w-full pl-10"
            />
          </div>

          {/* Filter */}
          <div className="flex items-center space-x-2">
            <FunnelIcon className="w-5 h-5 text-slate-400" />
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value as any)}
              className="input-field"
            >
              <option value="ALL">All Levels</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
              <option value="DEBUG">DEBUG</option>
            </select>
          </div>

          {/* Stats */}
          <div className="text-sm text-slate-400">
            Showing {filteredOutput.length} of {consoleOutput.length} entries
          </div>
        </div>
      </div>

      {/* Console Output */}
      <div className="flex-1 overflow-hidden">
        <div
          ref={consoleRef}
          className="h-full p-6 font-mono text-sm overflow-y-auto bg-slate-900"
          style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
        >
          {filteredOutput.map((entry, index) => (
            <div
              key={index}
              className="flex items-start space-x-3 py-1 hover:bg-slate-800 px-2 rounded transition-colors"
            >
              <span className="text-slate-500 text-xs whitespace-nowrap mt-0.5">
                {entry.timestamp.toLocaleTimeString()}
              </span>
              <span className={`text-xs font-semibold whitespace-nowrap mt-0.5 ${getLogColor(entry)}`}>
                [{entry.level}]
              </span>
              <span className={`flex-1 ${getLogColor(entry)} break-all`}>
                {entry.message}
              </span>
            </div>
          ))}
          
          {filteredOutput.length === 0 && (
            <div className="text-center text-slate-400 py-8">
              {consoleOutput.length === 0 ? 'No console output yet...' : 'No entries match your filters'}
            </div>
          )}
        </div>
      </div>

      {/* Command Input */}
      <div className="p-6 border-t border-slate-700">
        <div className="flex items-center space-x-3">
          <span className="text-green-500 font-mono text-sm">{'>'}</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Enter command..."
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyPress={handleKeyPress}
            className="input-field flex-1 font-mono text-sm"
            disabled={!serverStatus.rconConnected}
          />
          <button
            onClick={sendCommand}
            disabled={!command.trim() || !serverStatus.rconConnected}
            className="btn-primary px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
        
        {!serverStatus.rconConnected && (
          <p className="text-sm text-yellow-500 mt-2">
            RCON not connected. Commands will not work.
          </p>
        )}
      </div>
    </div>
  );
};

export default Console;
