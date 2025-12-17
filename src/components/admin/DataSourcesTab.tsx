'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Globe,
  FileSpreadsheet,
  Plus,
  Settings,
  Trash2,
  TestTube,
  RefreshCw,
  Upload,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Link2,
  Save,
  X,
  FileText,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Modal from '@/components/ui/Modal';
import type { DataAPIConfig, DataCSVConfig } from '@/types/data-sources';

// ===== Types =====

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface DataSourceCounts {
  apis: number;
  csvs: number;
  total: number;
}

// ===== Helper Functions =====

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-700';
    case 'error':
      return 'bg-red-100 text-red-700';
    case 'inactive':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-yellow-100 text-yellow-700';
  }
}

// ===== Sub-Components =====

/**
 * API Source Card
 */
function APISourceCard({
  api,
  categories,
  onEdit,
  onDelete,
  onTest,
}: {
  api: DataAPIConfig;
  categories: Category[];
  onEdit: (api: DataAPIConfig) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const linkedCategories = categories.filter(c => api.categoryIds.includes(c.id));

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`p-2 rounded-lg ${api.status === 'active' ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <Globe size={20} className={api.status === 'active' ? 'text-blue-600' : 'text-gray-400'} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-gray-900 truncate">{api.name}</h4>
              <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(api.status)}`}>
                {api.status}
              </span>
              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                {api.method}
              </span>
            </div>
            <p className="text-sm text-gray-500 truncate">{api.endpoint}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <Button variant="secondary" size="sm" onClick={() => onTest(api.id)} title="Test connection">
            <TestTube size={14} />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onEdit(api)} title="Edit">
            <Settings size={14} />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onDelete(api.id)} title="Delete">
            <Trash2 size={14} />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 py-3 border-t bg-gray-50 text-sm">
          {api.description && (
            <p className="text-gray-600 mb-2">{api.description}</p>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Method:</span>
              <span className="ml-1">{api.method}</span>
            </div>
            <div>
              <span className="text-gray-500">Format:</span>
              <span className="ml-1">{api.responseFormat}</span>
            </div>
            <div>
              <span className="text-gray-500">Auth:</span>
              <span className="ml-1">{api.authentication.type}</span>
            </div>
            <div>
              <span className="text-gray-500">Config:</span>
              <span className="ml-1">{api.configMethod}</span>
            </div>
          </div>
          {api.parameters.length > 0 && (
            <div className="mt-2">
              <span className="text-gray-500 text-xs">Parameters:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {api.parameters.map(p => (
                  <span key={p.name} className={`px-1.5 py-0.5 text-xs rounded ${p.required ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {linkedCategories.length > 0 && (
            <div className="mt-2">
              <span className="text-gray-500 text-xs">Categories:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {linkedCategories.map(c => (
                  <span key={c.id} className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {api.lastError && (
            <div className="mt-2 text-xs text-red-600">
              <AlertCircle size={12} className="inline mr-1" />
              {api.lastError}
            </div>
          )}
          <div className="mt-2 text-xs text-gray-400">
            Created: {formatDate(api.createdAt)}
            {api.lastTested && ` • Tested: ${formatDate(api.lastTested)}`}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * CSV Source Card
 */
function CSVSourceCard({
  csv,
  categories,
  onEdit,
  onDelete,
}: {
  csv: DataCSVConfig;
  categories: Category[];
  onEdit: (csv: DataCSVConfig) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const linkedCategories = categories.filter(c => csv.categoryIds.includes(c.id));

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="p-2 rounded-lg bg-green-100">
            <FileSpreadsheet size={20} className="text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-gray-900 truncate">{csv.name}</h4>
              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                CSV
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {csv.rowCount.toLocaleString()} rows • {formatBytes(csv.fileSize)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <Button variant="secondary" size="sm" onClick={() => onEdit(csv)} title="Edit">
            <Settings size={14} />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onDelete(csv.id)} title="Delete">
            <Trash2 size={14} />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 py-3 border-t bg-gray-50 text-sm">
          {csv.description && (
            <p className="text-gray-600 mb-2">{csv.description}</p>
          )}
          <div className="mb-2">
            <span className="text-gray-500 text-xs">Columns ({csv.columns.length}):</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {csv.columns.map(col => (
                <span key={col.name} className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                  {col.name} <span className="text-gray-400">({col.type})</span>
                </span>
              ))}
            </div>
          </div>
          {linkedCategories.length > 0 && (
            <div className="mt-2">
              <span className="text-gray-500 text-xs">Categories:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {linkedCategories.map(c => (
                  <span key={c.id} className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="mt-2 text-xs text-gray-400">
            Original: {csv.originalFilename} • Created: {formatDate(csv.createdAt)}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Main Component =====

interface DataSourcesTabProps {
  /** API base path - defaults to '/api/admin/data-sources' */
  apiBasePath?: string;
  /** Categories API path - defaults to '/api/admin/categories' */
  categoriesPath?: string;
}

export default function DataSourcesTab({
  apiBasePath = '/api/admin/data-sources',
  categoriesPath = '/api/admin/categories',
}: DataSourcesTabProps) {
  // Data state
  const [apis, setApis] = useState<DataAPIConfig[]>([]);
  const [csvs, setCsvs] = useState<DataCSVConfig[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [counts, setCounts] = useState<DataSourceCounts>({ apis: 0, csvs: 0, total: 0 });

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'api' | 'csv'>('api');

  // Modal states
  const [showCreateAPI, setShowCreateAPI] = useState(false);
  const [showUploadCSV, setShowUploadCSV] = useState(false);
  const [editingAPI, setEditingAPI] = useState<DataAPIConfig | null>(null);
  const [editingCSV, setEditingCSV] = useState<DataCSVConfig | null>(null);
  const [, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch data sources
  const fetchDataSources = useCallback(async () => {
    setLoading(true);
    try {
      const [sourcesRes, categoriesRes] = await Promise.all([
        fetch(apiBasePath),
        fetch(categoriesPath),
      ]);

      if (!sourcesRes.ok) throw new Error('Failed to fetch data sources');

      const sourcesData = await sourcesRes.json();
      setApis(sourcesData.apis || []);
      setCsvs(sourcesData.csvs || []);
      setCounts(sourcesData.counts || { apis: 0, csvs: 0, total: 0 });

      // For superuser API, categories come from the data sources response
      if (sourcesData.assignedCategories) {
        setCategories(sourcesData.assignedCategories);
      } else if (categoriesRes.ok) {
        const catData = await categoriesRes.json();
        setCategories(catData.categories || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data sources');
    } finally {
      setLoading(false);
    }
  }, [apiBasePath, categoriesPath]);

  useEffect(() => {
    fetchDataSources();
  }, [fetchDataSources]);

  // Test API connection
  const handleTestAPI = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const response = await fetch(`${apiBasePath}/${id}/test`, {
        method: 'POST',
      });
      const data = await response.json();
      setTestResult({ success: data.success, message: data.message });
      if (data.success) {
        fetchDataSources(); // Refresh to update status
      }
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setTestingId(null);
    }
  };

  // Delete data source
  const handleDelete = async (id: string, type: 'api' | 'csv') => {
    if (!confirm(`Are you sure you want to delete this ${type === 'api' ? 'API' : 'CSV'} data source?`)) {
      return;
    }

    try {
      const response = await fetch(`${apiBasePath}/${id}?type=${type}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete');
      }

      setSuccess('Data source deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
      fetchDataSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete data source');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-3">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 text-green-600 rounded-lg flex items-center gap-3">
          <CheckCircle size={20} />
          <span>{success}</span>
        </div>
      )}
      {testResult && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${testResult.success ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
          {testResult.success ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span>{testResult.message}</span>
          <button onClick={() => setTestResult(null)} className="ml-auto">&times;</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Data Sources</h2>
          <p className="text-sm text-gray-500">
            Manage external API and CSV data sources
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={fetchDataSources} disabled={loading}>
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Globe size={20} className="text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{counts.apis}</div>
              <div className="text-sm text-gray-500">API Sources</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileSpreadsheet size={20} className="text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{counts.csvs}</div>
              <div className="text-sm text-gray-500">CSV Sources</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Link2 size={20} className="text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{counts.total}</div>
              <div className="text-sm text-gray-500">Total Sources</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('api')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'api'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Globe size={16} className="inline mr-2" />
            APIs ({counts.apis})
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'csv'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileSpreadsheet size={16} className="inline mr-2" />
            CSVs ({counts.csvs})
          </button>
        </div>
      </div>

      {/* API Tab Content */}
      {activeTab === 'api' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowCreateAPI(true)}>
              <Plus size={16} className="mr-2" />
              Add API Source
            </Button>
          </div>

          {apis.length === 0 ? (
            <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
              <Globe size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No API data sources configured</p>
              <p className="text-sm mt-1">Click &quot;Add API Source&quot; to create one</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apis.map(api => (
                <APISourceCard
                  key={api.id}
                  api={api}
                  categories={categories}
                  onEdit={setEditingAPI}
                  onDelete={(id) => handleDelete(id, 'api')}
                  onTest={handleTestAPI}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* CSV Tab Content */}
      {activeTab === 'csv' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowUploadCSV(true)}>
              <Upload size={16} className="mr-2" />
              Upload CSV
            </Button>
          </div>

          {csvs.length === 0 ? (
            <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
              <FileSpreadsheet size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No CSV data sources uploaded</p>
              <p className="text-sm mt-1">Click &quot;Upload CSV&quot; to add one</p>
            </div>
          ) : (
            <div className="space-y-3">
              {csvs.map(csv => (
                <CSVSourceCard
                  key={csv.id}
                  csv={csv}
                  categories={categories}
                  onEdit={setEditingCSV}
                  onDelete={(id) => handleDelete(id, 'csv')}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create API Modal */}
      <CreateAPIModal
        isOpen={showCreateAPI}
        onClose={() => setShowCreateAPI(false)}
        categories={categories}
        onSuccess={() => {
          setShowCreateAPI(false);
          setSuccess('API data source created successfully');
          setTimeout(() => setSuccess(null), 3000);
          fetchDataSources();
        }}
        onError={setError}
        apiBasePath={apiBasePath}
      />

      {/* Upload CSV Modal */}
      <UploadCSVModal
        isOpen={showUploadCSV}
        onClose={() => setShowUploadCSV(false)}
        categories={categories}
        onSuccess={() => {
          setShowUploadCSV(false);
          setSuccess('CSV data source uploaded successfully');
          setTimeout(() => setSuccess(null), 3000);
          fetchDataSources();
        }}
        onError={setError}
        apiBasePath={apiBasePath}
      />

      {/* Edit API Modal */}
      {editingAPI && (
        <EditAPIModal
          api={editingAPI}
          isOpen={true}
          onClose={() => setEditingAPI(null)}
          categories={categories}
          onSuccess={() => {
            setEditingAPI(null);
            setSuccess('API data source updated successfully');
            setTimeout(() => setSuccess(null), 3000);
            fetchDataSources();
          }}
          onError={setError}
          apiBasePath={apiBasePath}
        />
      )}

      {/* Edit CSV Modal */}
      {editingCSV && (
        <EditCSVModal
          csv={editingCSV}
          isOpen={true}
          onClose={() => setEditingCSV(null)}
          categories={categories}
          onSuccess={() => {
            setEditingCSV(null);
            setSuccess('CSV data source updated successfully');
            setTimeout(() => setSuccess(null), 3000);
            fetchDataSources();
          }}
          onError={setError}
          apiBasePath={apiBasePath}
        />
      )}
    </div>
  );
}

// ===== Create API Modal =====

function CreateAPIModal({
  isOpen,
  onClose,
  categories,
  onSuccess,
  onError,
  apiBasePath,
}: {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSuccess: () => void;
  onError: (error: string) => void;
  apiBasePath: string;
}) {
  const [mode, setMode] = useState<'manual' | 'openapi'>('manual');
  const [saving, setSaving] = useState(false);
  const [yamlContent, setYamlContent] = useState('');
  const [parsedConfig, setParsedConfig] = useState<Partial<DataAPIConfig> | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [method, setMethod] = useState<'GET' | 'POST'>('GET');
  const [authType, setAuthType] = useState<'none' | 'bearer' | 'api_key' | 'basic'>('none');
  const [authToken, setAuthToken] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyHeader, setApiKeyHeader] = useState('X-API-Key');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);

  const resetForm = () => {
    setMode('manual');
    setYamlContent('');
    setParsedConfig(null);
    setName('');
    setDescription('');
    setEndpoint('');
    setMethod('GET');
    setAuthType('none');
    setAuthToken('');
    setApiKey('');
    setApiKeyHeader('X-API-Key');
    setUsername('');
    setPassword('');
    setSelectedCategories([]);
  };

  const handleParseOpenAPI = async () => {
    if (!yamlContent.trim()) {
      onError('Please paste OpenAPI YAML content');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${apiBasePath}/parse-openapi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml: yamlContent }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.errors?.join(', ') || data.error || 'Failed to parse OpenAPI spec');
      }

      setParsedConfig(data.config);
      setName(data.config.name || '');
      setDescription(data.config.description || '');
      setEndpoint(data.config.endpoint || '');
      setMethod(data.config.method || 'GET');

      if (data.config.authentication) {
        setAuthType(data.config.authentication.type || 'none');
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to parse OpenAPI spec');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      onError('Name is required');
      return;
    }
    if (!endpoint.trim()) {
      onError('Endpoint URL is required');
      return;
    }

    setSaving(true);
    try {
      const authentication: DataAPIConfig['authentication'] = { type: authType };
      if (authType === 'bearer' && authToken) {
        authentication.credentials = { token: authToken };
      } else if (authType === 'api_key' && apiKey) {
        authentication.credentials = { apiKey, apiKeyHeader };
      } else if (authType === 'basic' && username) {
        authentication.credentials = { username, password };
      }

      const body = {
        name: name.trim(),
        description: description.trim(),
        endpoint: endpoint.trim(),
        method,
        authentication,
        categoryIds: selectedCategories,
        configMethod: mode,
        ...(parsedConfig ? {
          parameters: parsedConfig.parameters,
          responseStructure: parsedConfig.responseStructure,
          openApiSpec: parsedConfig.openApiSpec,
        } : {}),
      };

      const response = await fetch(apiBasePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create API source');
      }

      resetForm();
      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to create API source');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { resetForm(); onClose(); }} title="Add API Data Source">
      <div className="space-y-4">
        {/* Mode Selector */}
        <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 px-3 py-1.5 text-sm rounded ${mode === 'manual' ? 'bg-white shadow' : ''}`}
          >
            Manual Configuration
          </button>
          <button
            onClick={() => setMode('openapi')}
            className={`flex-1 px-3 py-1.5 text-sm rounded ${mode === 'openapi' ? 'bg-white shadow' : ''}`}
          >
            Import OpenAPI
          </button>
        </div>

        {mode === 'openapi' && !parsedConfig && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                OpenAPI YAML Specification
              </label>
              <textarea
                value={yamlContent}
                onChange={(e) => setYamlContent(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows={10}
                placeholder="Paste your OpenAPI 3.0 YAML here..."
              />
            </div>
            <Button onClick={handleParseOpenAPI} disabled={saving}>
              {saving ? <Spinner size="sm" className="mr-2" /> : <FileText size={16} className="mr-2" />}
              Parse OpenAPI
            </Button>
          </div>
        )}

        {(mode === 'manual' || parsedConfig) && (
          <>
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="My API Source"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="What data does this API provide?"
              />
            </div>

            {/* Endpoint */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint URL *</label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="https://api.example.com/data"
              />
            </div>

            {/* Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">HTTP Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as 'GET' | 'POST')}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </div>

            {/* Authentication */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Authentication</label>
              <select
                value={authType}
                onChange={(e) => setAuthType(e.target.value as typeof authType)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">None</option>
                <option value="bearer">Bearer Token</option>
                <option value="api_key">API Key</option>
                <option value="basic">Basic Auth</option>
              </select>
            </div>

            {authType === 'bearer' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bearer Token</label>
                <input
                  type="password"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter token"
                />
              </div>
            )}

            {authType === 'api_key' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter API key"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Header Name</label>
                  <input
                    type="text"
                    value={apiKeyHeader}
                    onChange={(e) => setApiKeyHeader(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="X-API-Key"
                  />
                </div>
              </>
            )}

            {authType === 'basic' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            {/* Categories */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Link to Categories</label>
              <div className="flex flex-wrap gap-2 p-2 border rounded-lg max-h-32 overflow-y-auto">
                {categories.map(cat => (
                  <label key={cat.id} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCategories([...selectedCategories, cat.id]);
                        } else {
                          setSelectedCategories(selectedCategories.filter(id => id !== cat.id));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    {cat.name}
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">Data source must be linked to categories to be accessible</p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="secondary" onClick={() => { resetForm(); onClose(); }}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? <Spinner size="sm" className="mr-2" /> : <Save size={16} className="mr-2" />}
                Create API Source
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ===== Upload CSV Modal =====

function UploadCSVModal({
  isOpen,
  onClose,
  categories,
  onSuccess,
  onError,
  apiBasePath,
}: {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSuccess: () => void;
  onError: (error: string) => void;
  apiBasePath: string;
}) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setName('');
    setDescription('');
    setSelectedCategories([]);
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      onError('Name is required');
      return;
    }
    if (!file) {
      onError('Please select a CSV file');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name.trim());
      formData.append('description', description.trim());
      formData.append('categoryIds', JSON.stringify(selectedCategories));

      const response = await fetch(`${apiBasePath}/upload-csv`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload CSV');
      }

      resetForm();
      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to upload CSV');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { resetForm(); onClose(); }} title="Upload CSV Data Source">
      <div className="space-y-4">
        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">CSV File *</label>
          <div className="border-2 border-dashed rounded-lg p-4 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileSpreadsheet size={20} className="text-green-600" />
                <span className="text-sm">{file.name}</span>
                <button onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 hover:text-blue-800"
              >
                <Upload size={24} className="mx-auto mb-2" />
                <span className="text-sm">Click to select CSV file</span>
              </button>
            )}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="My CSV Data"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            rows={2}
            placeholder="What data does this CSV contain?"
          />
        </div>

        {/* Categories */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Link to Categories</label>
          <div className="flex flex-wrap gap-2 p-2 border rounded-lg max-h-32 overflow-y-auto">
            {categories.map(cat => (
              <label key={cat.id} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(cat.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedCategories([...selectedCategories, cat.id]);
                    } else {
                      setSelectedCategories(selectedCategories.filter(id => id !== cat.id));
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600"
                />
                {cat.name}
              </label>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="secondary" onClick={() => { resetForm(); onClose(); }}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Spinner size="sm" className="mr-2" /> : <Upload size={16} className="mr-2" />}
            Upload CSV
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ===== Edit API Modal =====

function EditAPIModal({
  api,
  isOpen,
  onClose,
  categories,
  onSuccess,
  onError,
  apiBasePath,
}: {
  api: DataAPIConfig;
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSuccess: () => void;
  onError: (error: string) => void;
  apiBasePath: string;
}) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(api.name);
  const [description, setDescription] = useState(api.description);
  const [endpoint, setEndpoint] = useState(api.endpoint);
  const [method, setMethod] = useState(api.method);
  const [selectedCategories, setSelectedCategories] = useState<number[]>(api.categoryIds);

  const handleSubmit = async () => {
    if (!name.trim()) {
      onError('Name is required');
      return;
    }
    if (!endpoint.trim()) {
      onError('Endpoint URL is required');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${apiBasePath}/${api.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'api',
          name: name.trim(),
          description: description.trim(),
          endpoint: endpoint.trim(),
          method,
          categoryIds: selectedCategories,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update API source');
      }

      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to update API source');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit API Data Source">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint URL *</label>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">HTTP Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as 'GET' | 'POST')}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Link to Categories</label>
          <div className="flex flex-wrap gap-2 p-2 border rounded-lg max-h-32 overflow-y-auto">
            {categories.map(cat => (
              <label key={cat.id} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(cat.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedCategories([...selectedCategories, cat.id]);
                    } else {
                      setSelectedCategories(selectedCategories.filter(id => id !== cat.id));
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600"
                />
                {cat.name}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Spinner size="sm" className="mr-2" /> : <Save size={16} className="mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ===== Edit CSV Modal =====

function EditCSVModal({
  csv,
  isOpen,
  onClose,
  categories,
  onSuccess,
  onError,
  apiBasePath,
}: {
  csv: DataCSVConfig;
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSuccess: () => void;
  onError: (error: string) => void;
  apiBasePath: string;
}) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(csv.name);
  const [description, setDescription] = useState(csv.description);
  const [selectedCategories, setSelectedCategories] = useState<number[]>(csv.categoryIds);

  const handleSubmit = async () => {
    if (!name.trim()) {
      onError('Name is required');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${apiBasePath}/${csv.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'csv',
          name: name.trim(),
          description: description.trim(),
          categoryIds: selectedCategories,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update CSV source');
      }

      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to update CSV source');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit CSV Data Source">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">File Info</label>
          <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
            <p>Original: {csv.originalFilename}</p>
            <p>Rows: {csv.rowCount.toLocaleString()} • Size: {formatBytes(csv.fileSize)}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Link to Categories</label>
          <div className="flex flex-wrap gap-2 p-2 border rounded-lg max-h-32 overflow-y-auto">
            {categories.map(cat => (
              <label key={cat.id} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(cat.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedCategories([...selectedCategories, cat.id]);
                    } else {
                      setSelectedCategories(selectedCategories.filter(id => id !== cat.id));
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600"
                />
                {cat.name}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Spinner size="sm" className="mr-2" /> : <Save size={16} className="mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
