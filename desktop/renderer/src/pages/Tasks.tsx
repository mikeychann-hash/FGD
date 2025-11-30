import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { QueueListIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import { Task } from '../types';

interface TasksProps {
  socket: Socket | null;
  apiBaseUrl: string;
}

const Tasks: React.FC<TasksProps> = ({ socket, apiBaseUrl }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'failed'>('all');

  useEffect(() => {
    fetchTasks();

    if (socket) {
      socket.on('task:created', () => fetchTasks());
      socket.on('task:updated', () => fetchTasks());
      socket.on('task:completed', () => fetchTasks());
    }

    const interval = setInterval(fetchTasks, 10000);

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('task:created');
        socket.off('task:updated');
        socket.off('task:completed');
      }
    };
  }, [socket, apiBaseUrl]);

  const fetchTasks = async () => {
    try {
      // This endpoint would need to be implemented in the backend
      const response = await fetch(`${apiBaseUrl}/api/tasks`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      // Mock data for demonstration
      setTasks([]);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="w-5 h-5 text-green-400" />;
      case 'failed':
        return <XCircleIcon className="w-5 h-5 text-red-400" />;
      case 'in_progress':
        return <ClockIcon className="w-5 h-5 text-blue-400 animate-spin" />;
      default:
        return <QueueListIcon className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'badge-success';
      case 'failed':
        return 'badge-error';
      case 'in_progress':
        return 'badge-info';
      default:
        return 'badge-warning';
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return 'text-red-400';
    if (priority >= 5) return 'text-amber-400';
    return 'text-slate-400';
  };

  const filteredTasks = filter === 'all' ? tasks : tasks.filter((task) => task.status === filter);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Task Queue</h1>
          <p className="text-slate-400 mt-1">Manage and monitor bot tasks</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="badge badge-success">{tasks.filter(t => t.status === 'completed').length} completed</span>
          <span className="badge badge-info">{tasks.filter(t => t.status === 'in_progress').length} active</span>
          <span className="badge badge-warning">{tasks.filter(t => t.status === 'pending').length} queued</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex space-x-2">
        {['all', 'pending', 'in_progress', 'completed', 'failed'].map((status) => (
          <button
            key={status}
            className={`px-4 py-2 rounded-win11 text-sm font-medium transition-all ${
              filter === status
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-slate-800/30 text-slate-400 border border-slate-700/50 hover:border-slate-600/50'
            }`}
            onClick={() => setFilter(status as any)}
          >
            {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="card">
            <div className="text-center py-12 text-slate-500">
              <QueueListIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p>No tasks to display</p>
              <p className="text-sm mt-2">Tasks will appear here when bots are assigned work</p>
            </div>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div key={task.id} className="card hover:shadow-win11-lg transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <div className="mt-1">{getStatusIcon(task.status)}</div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-semibold text-slate-100">{task.description}</h3>
                      <span className={`badge ${getStatusBadge(task.status)}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                      <span className={`text-sm font-medium ${getPriorityColor(task.priority)}`}>
                        P{task.priority}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">Type:</span>
                        <span className="text-slate-200 ml-2 capitalize">{task.type}</span>
                      </div>
                      {task.assignedBot && (
                        <div>
                          <span className="text-slate-400">Bot:</span>
                          <span className="text-blue-400 ml-2">{task.assignedBot}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-400">Created:</span>
                        <span className="text-slate-200 ml-2">
                          {new Date(task.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      {task.progress !== undefined && (
                        <div>
                          <span className="text-slate-400">Progress:</span>
                          <span className="text-green-400 ml-2">{task.progress}%</span>
                        </div>
                      )}
                    </div>
                    {task.progress !== undefined && (
                      <div className="mt-3 bg-slate-700/30 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-green-500 h-full transition-all duration-500"
                          style={{ width: `${task.progress}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Tasks;
