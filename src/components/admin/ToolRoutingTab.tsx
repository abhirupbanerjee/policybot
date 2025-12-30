'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Route,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  TestTube,
  ChevronDown,
  ChevronUp,
  Zap,
  Hash,
  Code,
  Power,
  PowerOff,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Modal from '@/components/ui/Modal';

// Types matching the API
interface ToolRoutingRule {
  id: string;
  toolName: string;
  ruleName: string;
  ruleType: 'keyword' | 'regex';
  patterns: string[];
  forceMode: 'required' | 'preferred' | 'suggested';
  priority: number;
  categoryIds: number[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

interface TestResult {
  message: string;
  categoryIds: number[];
  matches: {
    ruleName: string;
    toolName: string;
    pattern: string;
    forceMode: string;
  }[];
  finalToolChoice: string;
}

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface Tool {
  name: string;
  displayName: string;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

/**
 * Get display name for force mode
 */
function getForceModeLabel(mode: string): { label: string; color: string } {
  switch (mode) {
    case 'required':
      return { label: 'Force Tool', color: 'bg-red-100 text-red-700' };
    case 'preferred':
      return { label: 'Force Any', color: 'bg-orange-100 text-orange-700' };
    case 'suggested':
      return { label: 'Suggest', color: 'bg-blue-100 text-blue-700' };
    default:
      return { label: mode, color: 'bg-gray-100 text-gray-700' };
  }
}

/**
 * ToolRoutingTab - Admin interface for managing tool routing rules
 */
export default function ToolRoutingTab() {
  const [rules, setRules] = useState<ToolRoutingRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRule, setEditingRule] = useState<ToolRoutingRule | null>(null);
  const [formData, setFormData] = useState({
    toolName: '',
    ruleName: '',
    ruleType: 'keyword' as 'keyword' | 'regex',
    patterns: '',
    forceMode: 'required' as 'required' | 'preferred' | 'suggested',
    priority: 100,
    categoryIds: [] as number[],
    isActive: true,
  });

  // Test panel state
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testCategoryIds, setTestCategoryIds] = useState<number[]>([]);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  // Expanded rules
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  // Fetch routing rules
  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/tool-routing');
      if (!response.ok) throw new Error('Failed to fetch routing rules');

      const data = await response.json();
      setRules(data.rules || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load routing rules');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/categories');
      if (!response.ok) throw new Error('Failed to fetch categories');

      const data = await response.json();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  }, []);

  // Fetch available tools
  const fetchTools = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/tools');
      if (!response.ok) throw new Error('Failed to fetch tools');

      const data = await response.json();
      setTools(data.tools || []);
    } catch (err) {
      console.error('Failed to fetch tools:', err);
    }
  }, []);

  // Fetch data on mount
  useEffect(() => {
    fetchRules();
    fetchCategories();
    fetchTools();
  }, [fetchRules, fetchCategories, fetchTools]);

  // Open create modal
  const handleCreate = () => {
    setEditingRule(null);
    setFormData({
      toolName: '',
      ruleName: '',
      ruleType: 'keyword',
      patterns: '',
      forceMode: 'required',
      priority: 100,
      categoryIds: [],
      isActive: true,
    });
    setShowEditModal(true);
  };

  // Open edit modal
  const handleEdit = (rule: ToolRoutingRule) => {
    setEditingRule(rule);
    setFormData({
      toolName: rule.toolName,
      ruleName: rule.ruleName,
      ruleType: rule.ruleType,
      patterns: rule.patterns.join('\n'),
      forceMode: rule.forceMode,
      priority: rule.priority,
      categoryIds: rule.categoryIds || [],
      isActive: rule.isActive,
    });
    setShowEditModal(true);
  };

  // Save rule
  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const patterns = formData.patterns
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean);

      if (patterns.length === 0) {
        throw new Error('At least one pattern is required');
      }

      const payload = {
        toolName: formData.toolName,
        ruleName: formData.ruleName,
        ruleType: formData.ruleType,
        patterns,
        forceMode: formData.forceMode,
        priority: formData.priority,
        categoryIds: formData.categoryIds.length > 0 ? formData.categoryIds : null,
        isActive: formData.isActive,
      };

      const url = editingRule
        ? `/api/admin/tool-routing/${editingRule.id}`
        : '/api/admin/tool-routing';

      const response = await fetch(url, {
        method: editingRule ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save rule');
      }

      setSuccess(editingRule ? 'Rule updated successfully' : 'Rule created successfully');
      setTimeout(() => setSuccess(null), 3000);
      setShowEditModal(false);
      fetchRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  // Delete rule
  const handleDelete = async (rule: ToolRoutingRule) => {
    if (!confirm(`Delete rule "${rule.ruleName}"?`)) return;

    try {
      const response = await fetch(`/api/admin/tool-routing/${rule.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete rule');
      }

      setSuccess('Rule deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
      fetchRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
    }
  };

  // Toggle rule active state
  const handleToggleActive = async (rule: ToolRoutingRule) => {
    try {
      const response = await fetch(`/api/admin/tool-routing/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update rule');
      }

      setSuccess(`Rule ${rule.isActive ? 'disabled' : 'enabled'}`);
      setTimeout(() => setSuccess(null), 3000);
      fetchRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rule');
    }
  };

  // Test routing
  const handleTest = async () => {
    if (!testMessage.trim()) return;

    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/admin/tool-routing/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: testMessage,
          categoryIds: testCategoryIds,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Test failed');
      }

      const result = await response.json();
      setTestResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  // Toggle rule expansion
  const toggleExpand = (ruleId: string) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(ruleId)) {
      newExpanded.delete(ruleId);
    } else {
      newExpanded.add(ruleId);
    }
    setExpandedRules(newExpanded);
  };

  // Group rules by tool
  const rulesByTool = rules.reduce(
    (acc, rule) => {
      if (!acc[rule.toolName]) {
        acc[rule.toolName] = [];
      }
      acc[rule.toolName].push(rule);
      return acc;
    },
    {} as Record<string, ToolRoutingRule[]>
  );

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
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            &times;
          </button>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 text-green-600 rounded-lg flex items-center gap-3">
          <CheckCircle size={20} />
          <span>{success}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Route size={20} />
            Tool Routing Rules
          </h2>
          <p className="text-sm text-gray-500">
            Configure keyword/regex patterns to force specific tool calls
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setShowTestPanel(!showTestPanel)}>
            <TestTube size={16} className="mr-2" />
            Test
          </Button>
          <Button variant="secondary" onClick={fetchRules} disabled={loading}>
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleCreate}>
            <Plus size={16} className="mr-2" />
            Add Rule
          </Button>
        </div>
      </div>

      {/* Test Panel */}
      {showTestPanel && (
        <div className="bg-white rounded-lg border p-4 space-y-4">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <TestTube size={16} />
            Test Routing Rules
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Test Message
              </label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Enter a message to test routing..."
                className="w-full h-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category Filter (optional)
              </label>
              <select
                multiple
                value={testCategoryIds.map(String)}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map((o) =>
                    parseInt(o.value)
                  );
                  setTestCategoryIds(selected);
                }}
                className="w-full h-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={handleTest} disabled={testing || !testMessage.trim()}>
              {testing ? <Spinner size="sm" className="mr-2" /> : <Zap size={16} className="mr-2" />}
              Run Test
            </Button>
            {testResult && (
              <div className="flex-1 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm">
                  <span className="font-medium">Result: </span>
                  <span
                    className={`px-2 py-0.5 rounded ${
                      testResult.finalToolChoice.startsWith('function:')
                        ? 'bg-green-100 text-green-700'
                        : testResult.finalToolChoice === 'required'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {testResult.finalToolChoice}
                  </span>
                </div>
                {testResult.matches.length > 0 ? (
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">Matched:</span>
                    <ul className="list-disc list-inside mt-1">
                      {testResult.matches.map((m, i) => (
                        <li key={i}>
                          {m.ruleName} → {m.toolName} (pattern: &quot;{m.pattern}&quot;)
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-gray-500">No rules matched</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rules List */}
      <div className="space-y-4">
        {Object.keys(rulesByTool).length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
            No routing rules configured. Click &quot;Add Rule&quot; to create one.
          </div>
        ) : (
          Object.entries(rulesByTool).map(([toolName, toolRules]) => (
            <div key={toolName} className="bg-white rounded-lg border shadow-sm">
              {/* Tool Group Header */}
              <div className="px-6 py-3 bg-gray-50 border-b">
                <h3 className="font-semibold text-gray-900">{toolName}</h3>
                <p className="text-sm text-gray-500">{toolRules.length} rule(s)</p>
              </div>

              {/* Rules */}
              <div className="divide-y">
                {toolRules.map((rule) => {
                  const isExpanded = expandedRules.has(rule.id);
                  const forceMode = getForceModeLabel(rule.forceMode);

                  return (
                    <div key={rule.id} className={`${!rule.isActive ? 'bg-gray-50' : ''}`}>
                      {/* Rule Row */}
                      <div className="px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => toggleExpand(rule.id)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-medium ${rule.isActive ? 'text-gray-900' : 'text-gray-400'}`}
                              >
                                {rule.ruleName}
                              </span>
                              <span
                                className={`px-2 py-0.5 text-xs rounded-full ${
                                  rule.ruleType === 'keyword'
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-indigo-100 text-indigo-700'
                                }`}
                              >
                                {rule.ruleType === 'keyword' ? (
                                  <>
                                    <Hash size={10} className="inline mr-1" />
                                    keyword
                                  </>
                                ) : (
                                  <>
                                    <Code size={10} className="inline mr-1" />
                                    regex
                                  </>
                                )}
                              </span>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${forceMode.color}`}>
                                {forceMode.label}
                              </span>
                              {!rule.isActive && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500">
                                  Disabled
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              {rule.patterns.length} pattern(s) • Priority: {rule.priority}
                              {rule.categoryIds && ` • ${rule.categoryIds.length} category(ies)`}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleToggleActive(rule)}
                            title={rule.isActive ? 'Disable rule' : 'Enable rule'}
                          >
                            {rule.isActive ? <Power size={16} /> : <PowerOff size={16} />}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleEdit(rule)}
                            title="Edit rule"
                          >
                            <Edit2 size={16} />
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleDelete(rule)}
                            title="Delete rule"
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="px-6 py-4 bg-gray-50 border-t">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-2">Patterns</h4>
                              <div className="flex flex-wrap gap-2">
                                {rule.patterns.map((pattern, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-1 bg-white border rounded text-sm font-mono"
                                  >
                                    {pattern}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-2">Categories</h4>
                              {rule.categoryIds ? (
                                <div className="flex flex-wrap gap-2">
                                  {rule.categoryIds.map((catId) => {
                                    const cat = categories.find((c) => c.id === catId);
                                    return (
                                      <span
                                        key={catId}
                                        className="px-2 py-1 bg-white border rounded text-sm"
                                      >
                                        {cat?.name || `Category ${catId}`}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-sm text-gray-500">All categories</span>
                              )}
                            </div>
                          </div>
                          <div className="mt-4 text-xs text-gray-500">
                            Created by {rule.createdBy} on {formatDate(rule.createdAt)}
                            {rule.updatedAt !== rule.createdAt && (
                              <> • Updated {formatDate(rule.updatedAt)}</>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={editingRule ? 'Edit Routing Rule' : 'Create Routing Rule'}
      >
        <div className="space-y-4">
          {/* Tool Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tool Name *</label>
            <select
              value={formData.toolName}
              onChange={(e) => setFormData({ ...formData, toolName: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a tool...</option>
              {tools.map((tool) => (
                <option key={tool.name} value={tool.name}>
                  {tool.displayName} ({tool.name})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              The tool to invoke when patterns match
            </p>
          </div>

          {/* Rule Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name *</label>
            <input
              type="text"
              value={formData.ruleName}
              onChange={(e) => setFormData({ ...formData, ruleName: e.target.value })}
              placeholder="e.g., Chart Visualization Keywords"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Rule Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rule Type *</label>
            <select
              value={formData.ruleType}
              onChange={(e) =>
                setFormData({ ...formData, ruleType: e.target.value as 'keyword' | 'regex' })
              }
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="keyword">Keyword (word boundary matching)</option>
              <option value="regex">Regex (regular expression)</option>
            </select>
          </div>

          {/* Patterns */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Patterns * (one per line)
            </label>
            <textarea
              value={formData.patterns}
              onChange={(e) => setFormData({ ...formData, patterns: e.target.value })}
              placeholder={
                formData.ruleType === 'keyword'
                  ? 'chart\ngraph\nvisualize\ncreate a chart'
                  : '\\bchart\\b\n\\bgraph\\b\n\\bvisuali[sz]e\\b'
              }
              className="w-full h-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.ruleType === 'keyword'
                ? 'Case-insensitive word boundary matching'
                : 'JavaScript regex patterns (case-insensitive)'}
            </p>
          </div>

          {/* Force Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Force Mode *</label>
            <select
              value={formData.forceMode}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  forceMode: e.target.value as 'required' | 'preferred' | 'suggested',
                })
              }
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="required">Required - Force this specific tool</option>
              <option value="preferred">Preferred - Force some tool (LLM picks which)</option>
              <option value="suggested">Suggested - Hint but don&apos;t force</option>
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <input
              type="number"
              value={formData.priority}
              onChange={(e) =>
                setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })
              }
              min={1}
              max={1000}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Lower = higher priority (evaluated first)</p>
          </div>

          {/* Categories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category Filter (optional)
            </label>
            <select
              multiple
              value={formData.categoryIds.map(String)}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions).map((o) =>
                  parseInt(o.value)
                );
                setFormData({ ...formData, categoryIds: selected });
              }}
              className="w-full h-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to apply to all categories. Hold Ctrl/Cmd to select multiple.
            </p>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="rule-active"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="rule-active" className="text-sm font-medium text-gray-700">
              Rule is active
            </label>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              <X size={16} className="mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.toolName.trim() || !formData.ruleName.trim()}
            >
              {saving ? <Spinner size="sm" className="mr-2" /> : <Save size={16} className="mr-2" />}
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
