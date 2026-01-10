'use client';

import { CheckCircle, Circle, XCircle, AlertTriangle, Clock, Target } from 'lucide-react';
import type { AgentPlanStats } from '@/types/stream';

interface AgentTask {
  id: number;
  description: string;
  type: string;
  status: 'pending' | 'running' | 'done' | 'skipped' | 'needs_review';
  confidence?: number;
}

interface AgentPlanProgressProps {
  planTitle?: string;
  tasks: AgentTask[];
  currentTaskId?: number;
  budgetWarning?: {
    level: 'medium' | 'high';
    percentage: number;
  };
  stats?: AgentPlanStats;
  isComplete?: boolean;
}

export default function AgentPlanProgress({
  planTitle,
  tasks,
  currentTaskId,
  budgetWarning,
  stats,
  isComplete,
}: AgentPlanProgressProps) {
  const getTaskIcon = (task: AgentTask) => {
    if (task.status === 'done') {
      return <CheckCircle size={18} className="text-green-600" />;
    } else if (task.status === 'skipped') {
      return <XCircle size={18} className="text-red-500" />;
    } else if (task.status === 'needs_review') {
      return <AlertTriangle size={18} className="text-yellow-600" />;
    } else if (task.status === 'running') {
      return <Clock size={18} className="text-blue-600 animate-pulse" />;
    } else {
      return <Circle size={18} className="text-gray-400" />;
    }
  };

  const getTaskStatusColor = (task: AgentTask) => {
    if (task.status === 'done') return 'border-green-200 bg-green-50';
    if (task.status === 'skipped') return 'border-red-200 bg-red-50';
    if (task.status === 'needs_review') return 'border-yellow-200 bg-yellow-50';
    if (task.status === 'running') return 'border-blue-200 bg-blue-50';
    return 'border-gray-200 bg-gray-50';
  };

  const getConfidenceBadgeColor = (confidence?: number) => {
    if (!confidence) return '';
    if (confidence >= 80) return 'bg-green-100 text-green-800';
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="bg-white rounded-lg border border-purple-200 p-4 mb-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Target className="text-purple-600" size={20} />
            <h3 className="font-semibold text-gray-900">
              {planTitle || 'Autonomous Plan'}
            </h3>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {isComplete
              ? 'Plan completed'
              : currentTaskId
                ? `Executing task ${currentTaskId}...`
                : 'Preparing tasks...'}
          </p>
        </div>

        {/* Budget Warning */}
        {budgetWarning && (
          <div
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              budgetWarning.level === 'high'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            Budget: {budgetWarning.percentage}%
          </div>
        )}
      </div>

      {/* Task List */}
      {tasks.length > 0 && (
        <div className="space-y-2 mb-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${getTaskStatusColor(
                task
              )} ${task.id === currentTaskId ? 'ring-2 ring-blue-400' : ''}`}
            >
              <div className="flex-shrink-0 mt-0.5">{getTaskIcon(task)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {task.description}
                  </p>
                  {task.confidence !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getConfidenceBadgeColor(
                        task.confidence
                      )}`}
                    >
                      {task.confidence}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-0.5">{task.type}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Statistics (shown when complete) */}
      {isComplete && stats && (
        <div className="border-t border-gray-200 pt-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">{stats.completed_tasks}</div>
              <div className="text-xs text-gray-600">Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{stats.needs_review_tasks}</div>
              <div className="text-xs text-gray-600">Needs Review</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-600">
                {stats.average_confidence.toFixed(0)}%
              </div>
              <div className="text-xs text-gray-600">Avg Confidence</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
