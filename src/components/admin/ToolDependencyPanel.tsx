'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Shield,
  Wrench
} from 'lucide-react';

interface DependencyValidation {
  ok: boolean;
  message: string;
  details?: {
    envVars?: Array<{ name: string; set: boolean; source?: string }>;
    tools?: Array<{ name: string; enabled: boolean }>;
  };
}

interface ToolDependencyStatus {
  name: string;
  displayName: string;
  description: string;
  enabled: boolean;
  validation: DependencyValidation;
  canEnable: boolean;
  missingDependencies: string[];
}

interface Summary {
  ready: number;
  available: number;
  needsConfig: number;
  total: number;
}

export function ToolDependencyPanel() {
  const [tools, setTools] = useState<ToolDependencyStatus[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/tools/dependencies');
      if (!res.ok) {
        throw new Error('Failed to fetch tool dependencies');
      }
      const data = await res.json();
      setTools(data.tools || []);
      setSummary(data.summary || null);
    } catch (e) {
      console.error('Failed to fetch tool dependencies:', e);
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatusIcon = (tool: ToolDependencyStatus) => {
    if (tool.enabled && tool.validation.ok) {
      return <CheckCircle className="text-green-500 flex-shrink-0" size={20} />;
    }
    if (tool.canEnable) {
      return <AlertTriangle className="text-yellow-500 flex-shrink-0" size={20} />;
    }
    return <XCircle className="text-red-500 flex-shrink-0" size={20} />;
  };

  const getStatusBadge = (tool: ToolDependencyStatus) => {
    if (tool.enabled && tool.validation.ok) {
      return (
        <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full font-medium">
          Active
        </span>
      );
    }
    if (tool.canEnable) {
      return (
        <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-full font-medium">
          {tool.enabled ? 'Enabled' : 'Available'}
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full font-medium">
        Needs Config
      </span>
    );
  };

  if (error) {
    return (
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <div className="text-red-600 flex items-center gap-2">
          <XCircle size={20} />
          <span>Error: {error}</span>
        </div>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Shield className="text-blue-600" size={24} />
          <div>
            <h2 className="font-semibold text-gray-900">Tool Dependencies</h2>
            <p className="text-sm text-gray-500">View tool prerequisites and validation status</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin text-gray-400' : 'text-gray-600'} />
        </button>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="px-6 py-4 border-b bg-gray-50 grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-semibold text-green-600">{summary.ready}</div>
            <div className="text-xs text-gray-500">Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-yellow-600">{summary.available}</div>
            <div className="text-xs text-gray-500">Available</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-red-600">{summary.needsConfig}</div>
            <div className="text-xs text-gray-500">Needs Config</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-gray-600">{summary.total}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && tools.length === 0 && (
        <div className="px-6 py-12 text-center text-gray-500">
          <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
          <p>Loading tool dependencies...</p>
        </div>
      )}

      {/* Tool List */}
      <div className="divide-y">
        {tools.map((tool) => (
          <div key={tool.name}>
            {/* Tool Row */}
            <div
              className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setExpanded(expanded === tool.name ? null : tool.name)}
            >
              <div className="flex items-center gap-3 min-w-0">
                {getStatusIcon(tool)}
                <div className="min-w-0">
                  <div className="font-medium text-gray-900">{tool.displayName}</div>
                  <div className="text-sm text-gray-500 truncate">{tool.description}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {getStatusBadge(tool)}
                {expanded === tool.name ? (
                  <ChevronUp size={16} className="text-gray-400" />
                ) : (
                  <ChevronDown size={16} className="text-gray-400" />
                )}
              </div>
            </div>

            {/* Expanded Details */}
            {expanded === tool.name && (
              <div className="px-6 pb-4 pl-12 space-y-3 bg-gray-50 border-t">
                {/* Status Message */}
                <div className="pt-3">
                  <p className="text-sm">
                    <span className="font-medium text-gray-700">Status: </span>
                    <span className={tool.validation.ok ? 'text-green-700' : 'text-amber-700'}>
                      {tool.validation.message}
                    </span>
                  </p>
                </div>

                {/* Environment Variables */}
                {tool.validation.details?.envVars && tool.validation.details.envVars.length > 0 && (
                  <div className="bg-white p-3 rounded-lg border">
                    <p className="text-xs font-medium text-gray-500 uppercase mb-2">Environment Variables</p>
                    <div className="space-y-1">
                      {tool.validation.details.envVars.map((env) => (
                        <div key={env.name} className="flex items-center gap-2 text-sm">
                          {env.set ? (
                            <CheckCircle size={14} className="text-green-500" />
                          ) : (
                            <XCircle size={14} className="text-red-500" />
                          )}
                          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{env.name}</code>
                          {env.set && env.source && (
                            <span className="text-xs text-gray-400">({env.source})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tool Dependencies */}
                {tool.validation.details?.tools && tool.validation.details.tools.length > 0 && (
                  <div className="bg-white p-3 rounded-lg border">
                    <p className="text-xs font-medium text-gray-500 uppercase mb-2">Required Tools</p>
                    <div className="space-y-1">
                      {tool.validation.details.tools.map((dep) => (
                        <div key={dep.name} className="flex items-center gap-2 text-sm">
                          {dep.enabled ? (
                            <CheckCircle size={14} className="text-green-500" />
                          ) : (
                            <XCircle size={14} className="text-red-500" />
                          )}
                          <Wrench size={14} className="text-gray-400" />
                          <span>{dep.name}</span>
                          <span className={`text-xs ${dep.enabled ? 'text-green-600' : 'text-red-600'}`}>
                            ({dep.enabled ? 'enabled' : 'disabled'})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing Dependencies */}
                {tool.missingDependencies.length > 0 && (
                  <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                    <p className="text-xs font-medium text-red-800 uppercase mb-2">Missing Dependencies</p>
                    <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                      {tool.missingDependencies.map((dep, i) => (
                        <li key={i}>{dep}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Ready to Enable */}
                {tool.canEnable && !tool.enabled && (
                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                    <p className="text-sm text-green-700 flex items-center gap-2">
                      <CheckCircle size={16} />
                      All dependencies satisfied - enable this tool in Tools Management
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {!loading && tools.length === 0 && (
        <div className="px-6 py-12 text-center text-gray-500">
          <Wrench className="mx-auto mb-2 text-gray-300" size={32} />
          <p>No tools configured</p>
        </div>
      )}
    </div>
  );
}
