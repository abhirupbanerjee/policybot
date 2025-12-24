'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Power,
  PowerOff,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ListTodo,
  Variable,
  Save,
  X,
  Upload,
  FileJson,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Modal from '@/components/ui/Modal';

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface TaskItem {
  id: number;
  description: string;
}

interface TaskTemplate {
  key: string;
  name: string;
  description: string;
  active: boolean;
  placeholders: string[];
  tasks: TaskItem[];
  createdBy?: string;
  updatedBy?: string;
  updatedAt?: string;
}

interface TemplateFormData {
  key: string;
  name: string;
  description: string;
  placeholders: string[];
  tasks: TaskItem[];
}

const initialFormData: TemplateFormData = {
  key: '',
  name: '',
  description: '',
  placeholders: [],
  tasks: [{ id: 1, description: '' }],
};

interface TaskPlannerTemplatesProps {
  /** If true, restricts to superuser permissions (can't deactivate/delete) */
  isSuperuser?: boolean;
  /** Categories available to this user */
  categories?: Category[];
}

export default function TaskPlannerTemplates({
  isSuperuser = false,
  categories: propCategories,
}: TaskPlannerTemplatesProps) {
  // State
  const [categories, setCategories] = useState<Category[]>(propCategories || []);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(initialFormData);

  // Import state
  const [importJson, setImportJson] = useState('');
  const [importOverwrite, setImportOverwrite] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: string[];
    skipped: string[];
    errors: Array<{ key: string; error: string }>;
    summary: { total: number; imported: number; skipped: number; failed: number };
  } | null>(null);

  // Preview state
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      const data = await res.json();
      setCategories(data.categories || []);
      if (data.categories?.length > 0) {
        setSelectedCategoryId((prev) => prev || data.categories[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    if (!selectedCategoryId) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/tools/task-planner/templates?categoryId=${selectedCategoryId}`
      );
      if (!res.ok) throw new Error('Failed to fetch templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [selectedCategoryId]);

  // Fetch categories if not provided
  useEffect(() => {
    if (!propCategories) {
      fetchCategories();
    }
  }, [propCategories, fetchCategories]);

  // Fetch templates when category changes
  useEffect(() => {
    if (selectedCategoryId) {
      fetchTemplates();
    } else {
      setTemplates([]);
    }
  }, [selectedCategoryId, fetchTemplates]);

  // Create template
  const handleCreate = async () => {
    if (!selectedCategoryId) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/tools/task-planner/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: selectedCategoryId,
          key: formData.key,
          name: formData.name,
          description: formData.description,
          placeholders: formData.placeholders,
          tasks: formData.tasks.filter(t => t.description.trim()),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create template');
      }

      setSuccess('Template created successfully');
      setShowCreateModal(false);
      setFormData(initialFormData);
      fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setSaving(false);
    }
  };

  // Update template
  const handleUpdate = async () => {
    if (!selectedCategoryId || !selectedTemplate) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/tools/task-planner/templates/${selectedTemplate.key}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoryId: selectedCategoryId,
            name: formData.name,
            description: formData.description,
            placeholders: formData.placeholders,
            tasks: formData.tasks.filter(t => t.description.trim()),
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update template');
      }

      setSuccess('Template updated successfully');
      setShowEditModal(false);
      setSelectedTemplate(null);
      setFormData(initialFormData);
      fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template');
    } finally {
      setSaving(false);
    }
  };

  // Toggle template active status
  const handleToggleActive = async (template: TaskTemplate) => {
    if (!selectedCategoryId) return;
    if (isSuperuser && template.active) {
      setError('Only Admin can deactivate templates');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/tools/task-planner/templates/${template.key}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoryId: selectedCategoryId,
            active: !template.active,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update template');
      }

      setSuccess(`Template ${template.active ? 'deactivated' : 'activated'}`);
      fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template');
    } finally {
      setSaving(false);
    }
  };

  // Delete template
  const handleDelete = async () => {
    if (!selectedCategoryId || !selectedTemplate) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/tools/task-planner/templates/${selectedTemplate.key}?categoryId=${selectedCategoryId}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete template');
      }

      setSuccess('Template deleted');
      setShowDeleteModal(false);
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setSaving(false);
    }
  };

  // Import templates from JSON
  const handleImport = async () => {
    if (!selectedCategoryId) return;

    // Parse and validate JSON
    let templates;
    try {
      const parsed = JSON.parse(importJson);
      // Handle both array format and object with templates key
      templates = Array.isArray(parsed) ? parsed : parsed.templates;
      if (!Array.isArray(templates)) {
        setError('JSON must be an array of templates or an object with a "templates" array');
        return;
      }
    } catch {
      setError('Invalid JSON format');
      return;
    }

    setSaving(true);
    setError(null);
    setImportResult(null);
    try {
      const res = await fetch('/api/admin/tools/task-planner/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: selectedCategoryId,
          templates,
          overwrite: importOverwrite,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to import templates');
      }

      setImportResult(data);
      if (data.summary.imported > 0) {
        setSuccess(`Imported ${data.summary.imported} template(s) successfully`);
        fetchTemplates();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import templates');
    } finally {
      setSaving(false);
    }
  };

  // Handle file upload for import
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setImportJson(content);
      setImportResult(null);
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    event.target.value = '';
  };

  // Open edit modal
  const openEditModal = (template: TaskTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      key: template.key,
      name: template.name,
      description: template.description,
      placeholders: template.placeholders,
      tasks: template.tasks.length > 0 ? template.tasks : [{ id: 1, description: '' }],
    });
    setShowEditModal(true);
  };

  // Open delete confirmation
  const openDeleteModal = (template: TaskTemplate) => {
    setSelectedTemplate(template);
    setShowDeleteModal(true);
  };

  // Form helpers
  const addTask = () => {
    const maxId = Math.max(0, ...formData.tasks.map(t => t.id));
    setFormData(prev => ({
      ...prev,
      tasks: [...prev.tasks, { id: maxId + 1, description: '' }],
    }));
  };

  const removeTask = (id: number) => {
    if (formData.tasks.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.id !== id),
    }));
  };

  const updateTask = (id: number, description: string) => {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => (t.id === id ? { ...t, description } : t)),
    }));
  };

  const moveTask = (id: number, direction: 'up' | 'down') => {
    const idx = formData.tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === formData.tasks.length - 1) return;

    const newTasks = [...formData.tasks];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newTasks[idx], newTasks[swapIdx]] = [newTasks[swapIdx], newTasks[idx]];
    setFormData(prev => ({ ...prev, tasks: newTasks }));
  };

  const addPlaceholder = (value: string) => {
    if (!value.trim()) return;
    const placeholder = value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!formData.placeholders.includes(placeholder)) {
      setFormData(prev => ({
        ...prev,
        placeholders: [...prev.placeholders, placeholder],
      }));
    }
  };

  const removePlaceholder = (placeholder: string) => {
    setFormData(prev => ({
      ...prev,
      placeholders: prev.placeholders.filter(p => p !== placeholder),
    }));
  };

  // Replace placeholders in text for preview
  const applyPlaceholders = (text: string, vars: Record<string, string>) => {
    return text.replace(/\{(\w+)\}/g, (_, key) => vars[key] || `{${key}}`);
  };

  // Clear messages after timeout
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Template form modal content
  const renderTemplateForm = (isEdit: boolean) => (
    <div className="space-y-4">
      {/* Key (only for create) */}
      {!isEdit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Template Key *
          </label>
          <input
            type="text"
            value={formData.key}
            onChange={e =>
              setFormData(prev => ({
                ...prev,
                key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
              }))
            }
            placeholder="e.g., country_assessment"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Unique identifier (lowercase, underscores only)
          </p>
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Display Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Country SOE Assessment"
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="When to use this template..."
          rows={2}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Placeholders */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <Variable className="inline w-4 h-4 mr-1" />
          Placeholders
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {formData.placeholders.map(p => (
            <span
              key={p}
              className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm"
            >
              {`{${p}}`}
              <button
                onClick={() => removePlaceholder(p)}
                className="ml-1 text-blue-500 hover:text-blue-700"
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add placeholder (e.g., country)"
            className="flex-1 px-3 py-2 border rounded-lg text-sm"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addPlaceholder((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).value = '';
              }
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={e => {
              const input = (e.target as HTMLElement)
                .parentElement?.querySelector('input') as HTMLInputElement;
              if (input) {
                addPlaceholder(input.value);
                input.value = '';
              }
            }}
          >
            Add
          </Button>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Use {'{placeholder}'} in task descriptions to insert variables
        </p>
      </div>

      {/* Tasks */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <ListTodo className="inline w-4 h-4 mr-1" />
          Tasks *
        </label>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {formData.tasks.map((task, idx) => (
            <div key={task.id} className="flex items-center gap-2">
              <span className="w-6 text-center text-sm text-gray-500">{idx + 1}.</span>
              <input
                type="text"
                value={task.description}
                onChange={e => updateTask(task.id, e.target.value)}
                placeholder="Task description..."
                className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveTask(task.id, 'up')}
                  disabled={idx === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  onClick={() => moveTask(task.id, 'down')}
                  disabled={idx === formData.tasks.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  <ChevronDown size={16} />
                </button>
                <button
                  onClick={() => removeTask(task.id)}
                  disabled={formData.tasks.length <= 1}
                  className="p-1 text-red-400 hover:text-red-600 disabled:opacity-30"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <Button variant="secondary" size="sm" className="mt-2" onClick={addTask}>
          <Plus size={16} className="mr-1" />
          Add Task
        </Button>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button
          variant="secondary"
          onClick={() => {
            if (isEdit) {
              setShowEditModal(false);
            } else {
              setShowCreateModal(false);
            }
            setFormData(initialFormData);
            setSelectedTemplate(null);
          }}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={isEdit ? handleUpdate : handleCreate}
          disabled={
            saving ||
            !formData.name.trim() ||
            (!isEdit && !formData.key.trim()) ||
            formData.tasks.filter(t => t.description.trim()).length === 0
          }
        >
          {saving ? <Spinner size="sm" /> : <Save size={16} className="mr-1" />}
          {isEdit ? 'Update' : 'Create'} Template
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Task Planner Templates</h2>
          <p className="text-sm text-gray-500">
            Define reusable task plan templates for each category
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setImportJson('');
              setImportOverwrite(false);
              setImportResult(null);
              setShowImportModal(true);
            }}
            disabled={!selectedCategoryId}
          >
            <Upload size={16} className="mr-1" />
            Import JSON
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setFormData(initialFormData);
              setShowCreateModal(true);
            }}
            disabled={!selectedCategoryId}
          >
            <Plus size={16} className="mr-1" />
            Add Template
          </Button>
        </div>
      </div>

      {/* Status messages */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <CheckCircle size={16} />
          {success}
        </div>
      )}

      {/* Category selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Category
        </label>
        <select
          value={selectedCategoryId || ''}
          onChange={e => setSelectedCategoryId(Number(e.target.value) || null)}
          className="w-full max-w-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">-- Select a category --</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Templates list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : !selectedCategoryId ? (
        <div className="text-center py-12 text-gray-500">
          Select a category to manage its templates
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No templates defined for this category yet.
          <br />
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => {
              setFormData(initialFormData);
              setShowCreateModal(true);
            }}
          >
            <Plus size={16} className="mr-1" />
            Create First Template
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map(template => (
            <div
              key={template.key}
              className={`border rounded-lg ${
                template.active ? 'bg-white' : 'bg-gray-50 opacity-75'
              }`}
            >
              {/* Template header */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      setExpandedTemplate(
                        expandedTemplate === template.key ? null : template.key
                      )
                    }
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {expandedTemplate === template.key ? (
                      <ChevronUp size={20} />
                    ) : (
                      <ChevronDown size={20} />
                    )}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{template.name}</span>
                      {!template.active && (
                        <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      <code className="text-xs bg-gray-100 px-1 rounded">
                        {template.key}
                      </code>
                      <span className="mx-2">·</span>
                      {template.tasks.length} tasks
                      {template.placeholders.length > 0 && (
                        <>
                          <span className="mx-2">·</span>
                          {template.placeholders.map(p => `{${p}}`).join(', ')}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(template)}
                    disabled={saving || (isSuperuser && template.active)}
                    className={`p-2 rounded-lg ${
                      template.active
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-gray-400 hover:bg-gray-100'
                    } disabled:opacity-50`}
                    title={template.active ? 'Deactivate' : 'Activate'}
                  >
                    {template.active ? <Power size={18} /> : <PowerOff size={18} />}
                  </button>
                  <button
                    onClick={() => openEditModal(template)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Edit"
                  >
                    <Edit2 size={18} />
                  </button>
                  {!isSuperuser && (
                    <button
                      onClick={() => openDeleteModal(template)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded content */}
              {expandedTemplate === template.key && (
                <div className="px-4 pb-4 border-t">
                  {/* Description */}
                  {template.description && (
                    <p className="mt-3 text-sm text-gray-600">{template.description}</p>
                  )}

                  {/* Preview with variables */}
                  {template.placeholders.length > 0 && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        Preview with test values:
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {template.placeholders.map(p => (
                          <input
                            key={p}
                            type="text"
                            placeholder={p}
                            value={previewVars[p] || ''}
                            onChange={e =>
                              setPreviewVars(prev => ({ ...prev, [p]: e.target.value }))
                            }
                            className="px-2 py-1 text-sm border rounded"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tasks list */}
                  <div className="mt-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">Tasks:</div>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                      {template.tasks.map(task => (
                        <li key={task.id}>
                          {applyPlaceholders(task.description, previewVars)}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Metadata */}
                  {template.updatedAt && (
                    <div className="mt-4 text-xs text-gray-400">
                      Last updated: {new Date(template.updatedAt).toLocaleString()}
                      {template.updatedBy && ` by ${template.updatedBy}`}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setFormData(initialFormData);
        }}
        title="Create Template"
      >
        {renderTemplateForm(false)}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedTemplate(null);
          setFormData(initialFormData);
        }}
        title={`Edit Template: ${selectedTemplate?.name || ''}`}
      >
        {renderTemplateForm(true)}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedTemplate(null);
        }}
        title="Delete Template"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete the template{' '}
            <strong>{selectedTemplate?.name}</strong>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedTemplate(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={saving}>
              {saving ? <Spinner size="sm" /> : <Trash2 size={16} className="mr-1" />}
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportJson('');
          setImportResult(null);
        }}
        title="Import Templates from JSON"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Import multiple templates at once by uploading a JSON file or pasting JSON content.
            The JSON should be an array of template objects.
          </p>

          {/* File upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload JSON File
            </label>
            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <FileJson size={20} className="text-gray-400" />
              <span className="text-sm text-gray-600">Click to select a .json file</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* JSON textarea */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Or paste JSON content
            </label>
            <textarea
              value={importJson}
              onChange={(e) => {
                setImportJson(e.target.value);
                setImportResult(null);
              }}
              placeholder={`[
  {
    "key": "template_key",
    "name": "Template Name",
    "description": "When to use this template",
    "placeholders": ["variable1"],
    "tasks": [
      {"id": 1, "description": "First task with {variable1}"},
      {"id": 2, "description": "Second task"}
    ]
  }
]`}
              rows={10}
              className="w-full px-3 py-2 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Overwrite option */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={importOverwrite}
              onChange={(e) => setImportOverwrite(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700">
              Overwrite existing templates with the same key
            </span>
          </label>

          {/* Import results */}
          {importResult && (
            <div className="p-3 bg-gray-50 rounded-lg text-sm">
              <div className="font-medium text-gray-700 mb-2">Import Results:</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-green-500" />
                  <span>Imported: {importResult.summary.imported}</span>
                  {importResult.imported.length > 0 && (
                    <span className="text-gray-500">
                      ({importResult.imported.join(', ')})
                    </span>
                  )}
                </div>
                {importResult.summary.skipped > 0 && (
                  <div className="flex items-center gap-2 text-yellow-700">
                    <AlertCircle size={14} />
                    <span>Skipped (already exist): {importResult.summary.skipped}</span>
                    <span className="text-gray-500">
                      ({importResult.skipped.join(', ')})
                    </span>
                  </div>
                )}
                {importResult.summary.failed > 0 && (
                  <div className="text-red-600">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={14} />
                      <span>Failed: {importResult.summary.failed}</span>
                    </div>
                    <ul className="ml-6 mt-1 list-disc">
                      {importResult.errors.map((err, idx) => (
                        <li key={idx}>
                          <code>{err.key}</code>: {err.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => {
                setShowImportModal(false);
                setImportJson('');
                setImportResult(null);
              }}
            >
              {importResult ? 'Close' : 'Cancel'}
            </Button>
            {!importResult && (
              <Button
                variant="primary"
                onClick={handleImport}
                disabled={saving || !importJson.trim()}
              >
                {saving ? <Spinner size="sm" /> : <Upload size={16} className="mr-1" />}
                Import Templates
              </Button>
            )}
            {importResult && importResult.summary.imported > 0 && (
              <Button
                variant="primary"
                onClick={() => {
                  setShowImportModal(false);
                  setImportJson('');
                  setImportResult(null);
                }}
              >
                Done
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
