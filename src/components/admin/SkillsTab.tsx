'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Power,
  PowerOff,
  AlertCircle,
  CheckCircle,
  Search,
  Zap,
  Layers,
  Lock,
  Settings,
  Save,
  Play,
  Eye,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Modal from '@/components/ui/Modal';

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface Skill {
  id: number;
  name: string;
  description: string | null;
  prompt_content: string;
  trigger_type: 'always' | 'category' | 'keyword';
  trigger_value: string | null;
  category_restricted: boolean;
  is_index: boolean;
  priority: number;
  is_active: boolean;
  is_core: boolean;
  token_estimate: number | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  categories: Category[];
}

interface SkillsSettings {
  enabled: boolean;
  maxTotalTokens: number;
  debugMode: boolean;
}

interface PreviewResult {
  wouldActivate: { name: string; trigger: string; tokens: number }[];
  totalTokens: number;
  exceedsLimit: boolean;
}

interface SkillFormData {
  name: string;
  description: string;
  prompt_content: string;
  trigger_type: 'always' | 'category' | 'keyword';
  trigger_value: string;
  category_restricted: boolean;
  is_index: boolean;
  priority: number;
  category_ids: number[];
}

const initialFormData: SkillFormData = {
  name: '',
  description: '',
  prompt_content: '',
  trigger_type: 'keyword',
  trigger_value: '',
  category_restricted: false,
  is_index: false,
  priority: 100,
  category_ids: [],
};

export default function SkillsTab() {
  // State
  const [skills, setSkills] = useState<Skill[]>([]);
  const [settings, setSettings] = useState<SkillsSettings>({
    enabled: false,
    maxTotalTokens: 3000,
    debugMode: false,
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [formData, setFormData] = useState<SkillFormData>(initialFormData);

  // Preview state
  const [previewCategoryIds, setPreviewCategoryIds] = useState<number[]>([]);
  const [previewMessage, setPreviewMessage] = useState('');
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Filter/search state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTriggerType, setFilterTriggerType] = useState<'all' | 'always' | 'category' | 'keyword'>('all');

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [skillsRes, categoriesRes] = await Promise.all([
        fetch('/api/admin/skills'),
        fetch('/api/admin/categories'),
      ]);

      if (!skillsRes.ok) throw new Error('Failed to fetch skills');
      if (!categoriesRes.ok) throw new Error('Failed to fetch categories');

      const skillsData = await skillsRes.json();
      const categoriesData = await categoriesRes.json();

      setSkills(skillsData.skills || []);
      setSettings(skillsData.settings || { enabled: false, maxTotalTokens: 3000, debugMode: false });
      setCategories(categoriesData.categories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Save settings
  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'skills-settings',
          value: settings,
        }),
      });

      if (!response.ok) throw new Error('Failed to save settings');

      setSuccess('Settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Create skill
  const handleCreate = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create skill');
      }

      setShowCreateModal(false);
      setFormData(initialFormData);
      setSuccess('Skill created successfully');
      setTimeout(() => setSuccess(null), 3000);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create skill');
    } finally {
      setSaving(false);
    }
  };

  // Update skill
  const handleUpdate = async () => {
    if (!selectedSkill) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/skills/${selectedSkill.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update skill');
      }

      setShowEditModal(false);
      setSelectedSkill(null);
      setFormData(initialFormData);
      setSuccess('Skill updated successfully');
      setTimeout(() => setSuccess(null), 3000);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update skill');
    } finally {
      setSaving(false);
    }
  };

  // Delete skill
  const handleDelete = async () => {
    if (!selectedSkill) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/skills/${selectedSkill.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete skill');
      }

      setShowDeleteModal(false);
      setSelectedSkill(null);
      setSuccess('Skill deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete skill');
    } finally {
      setSaving(false);
    }
  };

  // Toggle active status
  const handleToggleActive = async (skill: Skill) => {
    try {
      const response = await fetch(`/api/admin/skills/${skill.id}`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to toggle skill');
      }

      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle skill');
    }
  };

  // Preview skills
  const handlePreview = async () => {
    if (!previewMessage.trim()) return;
    setPreviewLoading(true);
    try {
      const response = await fetch('/api/admin/skills/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_ids: previewCategoryIds,
          test_message: previewMessage,
        }),
      });

      if (!response.ok) throw new Error('Failed to preview skills');

      const data = await response.json();
      setPreviewResult(data.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview skills');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Open edit modal
  const openEditModal = (skill: Skill) => {
    setSelectedSkill(skill);
    setFormData({
      name: skill.name,
      description: skill.description || '',
      prompt_content: skill.prompt_content,
      trigger_type: skill.trigger_type,
      trigger_value: skill.trigger_value || '',
      category_restricted: skill.category_restricted,
      is_index: skill.is_index,
      priority: skill.priority,
      category_ids: skill.categories.map(c => c.id),
    });
    setShowEditModal(true);
  };

  // Filter skills
  const filteredSkills = skills.filter(skill => {
    const matchesSearch =
      skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (skill.description?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesTrigger = filterTriggerType === 'all' || skill.trigger_type === filterTriggerType;
    return matchesSearch && matchesTrigger;
  });

  // Get trigger type badge
  const getTriggerBadge = (type: string) => {
    switch (type) {
      case 'always':
        return <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">Always</span>;
      case 'category':
        return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">Category</span>;
      case 'keyword':
        return <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Keyword</span>;
      default:
        return null;
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

      {/* Settings Panel */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="text-gray-600" size={20} />
            <div>
              <h2 className="font-semibold text-gray-900">Skills Settings</h2>
              <p className="text-sm text-gray-500">Configure the modular skills system</p>
            </div>
          </div>
          <Button onClick={handleSaveSettings} disabled={saving}>
            {saving ? <Spinner size="sm" className="mr-2" /> : <Save size={16} className="mr-2" />}
            Save Settings
          </Button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-medium">Enable Skills</span>
              <p className="text-sm text-gray-500">Activate the modular skills system</p>
            </div>
          </label>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Total Tokens</label>
            <input
              type="number"
              value={settings.maxTotalTokens}
              onChange={(e) => setSettings({ ...settings, maxTotalTokens: parseInt(e.target.value) || 3000 })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Maximum combined tokens for all activated skills</p>
          </div>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.debugMode}
              onChange={(e) => setSettings({ ...settings, debugMode: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-medium">Debug Mode</span>
              <p className="text-sm text-gray-500">Log skill activation details</p>
            </div>
          </label>
        </div>
      </div>

      {/* Skills List */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Layers className="text-gray-600" size={20} />
            <div>
              <h2 className="font-semibold text-gray-900">Skills</h2>
              <p className="text-sm text-gray-500">{skills.length} skills configured</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setShowPreviewModal(true)}>
              <Eye size={16} className="mr-2" />
              Preview
            </Button>
            <Button onClick={() => { setFormData(initialFormData); setShowCreateModal(true); }}>
              <Plus size={16} className="mr-2" />
              Add Skill
            </Button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="px-6 py-3 border-b bg-gray-50 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search skills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={filterTriggerType}
            onChange={(e) => setFilterTriggerType(e.target.value as 'all' | 'always' | 'category' | 'keyword')}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Triggers</option>
            <option value="always">Always</option>
            <option value="category">Category</option>
            <option value="keyword">Keyword</option>
          </select>
        </div>

        {/* Skills Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trigger</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categories</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tokens</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSkills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No skills found. Create your first skill to get started.
                  </td>
                </tr>
              ) : (
                filteredSkills.map((skill) => (
                  <tr key={skill.id} className={`hover:bg-gray-50 ${!skill.is_active ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {skill.is_core && <span title="Core skill"><Lock size={14} className="text-amber-500" /></span>}
                        <div>
                          <div className="font-medium text-gray-900">{skill.name}</div>
                          {skill.description && (
                            <div className="text-sm text-gray-500 truncate max-w-xs">{skill.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {getTriggerBadge(skill.trigger_type)}
                        {skill.trigger_value && (
                          <span className="text-xs text-gray-500 truncate max-w-[150px]" title={skill.trigger_value}>
                            {skill.trigger_value}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {skill.categories.length > 0 ? (
                          skill.categories.slice(0, 2).map((cat) => (
                            <span key={cat.id} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                              {cat.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                        {skill.categories.length > 2 && (
                          <span className="text-xs text-gray-500">+{skill.categories.length - 2}</span>
                        )}
                        {skill.category_restricted && (
                          <span title="Category restricted" className="text-amber-500">
                            <Lock size={12} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{skill.priority}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{skill.token_estimate || '~'}</td>
                    <td className="px-6 py-4">
                      {skill.is_active ? (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <Power size={14} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-400">
                          <PowerOff size={14} /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleActive(skill)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title={skill.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {skill.is_active ? <PowerOff size={16} /> : <Power size={16} />}
                        </button>
                        <button
                          onClick={() => openEditModal(skill)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="Edit"
                          disabled={skill.is_core}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => { setSelectedSkill(skill); setShowDeleteModal(true); }}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Delete"
                          disabled={skill.is_core}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showCreateModal || showEditModal}
        onClose={() => { setShowCreateModal(false); setShowEditModal(false); setSelectedSkill(null); }}
        title={showEditModal ? 'Edit Skill' : 'Create Skill'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Citation Style Guide"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Brief description of what this skill does"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Type *</label>
            <select
              value={formData.trigger_type}
              onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value as 'always' | 'category' | 'keyword' })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="always">Always (runs on every query)</option>
              <option value="category">Category (runs for specific categories)</option>
              <option value="keyword">Keyword (runs when keywords match)</option>
            </select>
          </div>

          {formData.trigger_type === 'keyword' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Keywords *</label>
              <input
                type="text"
                value={formData.trigger_value}
                onChange={(e) => setFormData({ ...formData, trigger_value: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="citation, reference, quote (comma-separated)"
              />
              <p className="text-xs text-gray-500 mt-1">Comma-separated keywords that trigger this skill</p>
            </div>
          )}

          {(formData.trigger_type === 'category' || formData.trigger_type === 'keyword') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categories {formData.trigger_type === 'category' ? '*' : '(optional)'}
              </label>
              <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                {categories.map((cat) => (
                  <label key={cat.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.category_ids.includes(cat.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, category_ids: [...formData.category_ids, cat.id] });
                        } else {
                          setFormData({ ...formData, category_ids: formData.category_ids.filter(id => id !== cat.id) });
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {formData.trigger_type === 'keyword' && formData.category_ids.length > 0 && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.category_restricted}
                onChange={(e) => setFormData({ ...formData, category_restricted: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Only activate if keyword matches AND category matches</span>
            </label>
          )}

          {formData.trigger_type === 'category' && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_index}
                onChange={(e) => setFormData({ ...formData, is_index: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Index skill (broader domain expertise, one per category)</span>
            </label>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <input
              type="number"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Lower numbers = higher priority. Default is 100.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prompt Content *</label>
            <textarea
              value={formData.prompt_content}
              onChange={(e) => setFormData({ ...formData, prompt_content: e.target.value })}
              rows={8}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              placeholder="Enter the prompt instructions for this skill..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Estimated tokens: ~{Math.ceil(formData.prompt_content.length / 4)}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => { setShowCreateModal(false); setShowEditModal(false); setSelectedSkill(null); }}>
              Cancel
            </Button>
            <Button onClick={showEditModal ? handleUpdate : handleCreate} disabled={saving}>
              {saving ? <Spinner size="sm" className="mr-2" /> : null}
              {showEditModal ? 'Update' : 'Create'} Skill
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSelectedSkill(null); }}
        title="Delete Skill"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{selectedSkill?.name}</strong>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setShowDeleteModal(false); setSelectedSkill(null); }}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={saving}>
              {saving ? <Spinner size="sm" className="mr-2" /> : null}
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal
        isOpen={showPreviewModal}
        onClose={() => { setShowPreviewModal(false); setPreviewResult(null); }}
        title="Preview Skill Activation"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Test Message</label>
            <input
              type="text"
              value={previewMessage}
              onChange={(e) => setPreviewMessage(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter a test message to see which skills would activate"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categories (optional)</label>
            <div className="border rounded-lg p-3 max-h-32 overflow-y-auto space-y-2">
              {categories.map((cat) => (
                <label key={cat.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={previewCategoryIds.includes(cat.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPreviewCategoryIds([...previewCategoryIds, cat.id]);
                      } else {
                        setPreviewCategoryIds(previewCategoryIds.filter(id => id !== cat.id));
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">{cat.name}</span>
                </label>
              ))}
            </div>
          </div>

          <Button onClick={handlePreview} disabled={previewLoading || !previewMessage.trim()}>
            {previewLoading ? <Spinner size="sm" className="mr-2" /> : <Play size={16} className="mr-2" />}
            Run Preview
          </Button>

          {previewResult && (
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium text-gray-900 mb-2">Results</h4>
              {previewResult.wouldActivate.length === 0 ? (
                <p className="text-gray-500">No skills would activate for this query.</p>
              ) : (
                <div className="space-y-2">
                  {previewResult.wouldActivate.map((skill, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <Zap size={14} className="text-amber-500" />
                        <span className="font-medium">{skill.name}</span>
                        {getTriggerBadge(skill.trigger)}
                      </div>
                      <span className="text-sm text-gray-500">~{skill.tokens} tokens</span>
                    </div>
                  ))}
                  <div className={`flex items-center justify-between p-2 rounded ${previewResult.exceedsLimit ? 'bg-red-50' : 'bg-green-50'}`}>
                    <span className="font-medium">Total</span>
                    <span className={previewResult.exceedsLimit ? 'text-red-600' : 'text-green-600'}>
                      {previewResult.totalTokens} / {settings.maxTotalTokens} tokens
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
