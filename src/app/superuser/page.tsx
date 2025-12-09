'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Users, User, FolderOpen, Tag, Plus, FileText, Upload, Trash2, X, ChevronUp, ChevronDown, ChevronsUpDown, Search, Edit2, Save, RefreshCw, MessageSquare, LayoutDashboard, Database, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { type SortDirection } from '@/components/ui/SortableTable';

interface AssignedCategory {
  categoryId: number;
  categoryName: string;
}

interface UserSubscription {
  categoryId: number;
  categoryName: string;
  isActive: boolean;
}

interface ManagedUser {
  id: number;
  email: string;
  name: string | null;
  subscriptions: UserSubscription[];
}

interface DocumentCategory {
  categoryId: number;
  categoryName: string;
}

interface ManagedDocument {
  id: number;
  filename: string;
  size: number;
  status: string;
  uploadedBy: string;
  uploadedAt: string;
  categories: DocumentCategory[];
}

interface CategoryStats {
  categoryId: number;
  categoryName: string;
  categorySlug: string;
  documentCount: number;
  readyDocuments: number;
  processingDocuments: number;
  errorDocuments: number;
  totalChunks: number;
  subscriberCount: number;
  activeSubscribers: number;
  hasCustomPrompt: boolean;
}

interface SuperUserStats {
  timestamp: string;
  assignedCategories: number;
  totalDocuments: number;
  totalSubscribers: number;
  categories: CategoryStats[];
  recentDocuments: {
    id: number;
    filename: string;
    categoryName: string;
    status: string;
    uploadedBy: string;
    uploadedAt: string;
  }[];
  recentSubscriptions: {
    userEmail: string;
    categoryName: string;
    subscribedAt: string;
    isActive: boolean;
  }[];
}

export default function SuperUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignedCategories, setAssignedCategories] = useState<AssignedCategory[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);

  // Add subscription modal state
  const [showAddSub, setShowAddSub] = useState(false);
  const [newSubEmail, setNewSubEmail] = useState('');
  const [newSubCategory, setNewSubCategory] = useState<number | null>(null);
  const [addingSub, setAddingSub] = useState(false);

  // Remove subscription state
  const [removingSub, setRemovingSub] = useState<{ email: string; categoryId: number } | null>(null);

  // Documents state
  const [documents, setDocuments] = useState<ManagedDocument[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'text'>('file');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTextName, setUploadTextName] = useState('');
  const [uploadTextContent, setUploadTextContent] = useState('');
  const [uploadCategory, setUploadCategory] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);

  // Document search and sort state
  const [docSearchTerm, setDocSearchTerm] = useState('');
  const [docSortKey, setDocSortKey] = useState<keyof ManagedDocument | null>(null);
  const [docSortDirection, setDocSortDirection] = useState<SortDirection>(null);

  // Active tab state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'documents' | 'prompts'>('dashboard');

  // Stats state
  const [stats, setStats] = useState<SuperUserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Category prompt state
  const [editingCategoryPrompt, setEditingCategoryPrompt] = useState<number | null>(null);
  const [categoryPromptLoading, setCategoryPromptLoading] = useState(false);
  const [categoryPromptData, setCategoryPromptData] = useState<{
    category: { id: number; name: string; slug: string };
    globalPrompt: string;
    categoryAddendum: string;
    combinedPrompt: string;
    charInfo: {
      globalLength: number;
      categoryLength: number;
      combinedLength: number;
      availableForCategory: number;
      maxCombined: number;
    };
    metadata: { updatedAt: string; updatedBy: string } | null;
  } | null>(null);
  const [editedCategoryAddendum, setEditedCategoryAddendum] = useState('');
  const [savingCategoryPrompt, setSavingCategoryPrompt] = useState(false);
  const [categoryPromptModified, setCategoryPromptModified] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const response = await fetch('/api/superuser/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load users, documents, and stats in parallel
      const [usersResponse, docsResponse] = await Promise.all([
        fetch('/api/superuser/users'),
        fetch('/api/superuser/documents'),
      ]);

      if (usersResponse.status === 403 || docsResponse.status === 403) {
        router.push('/');
        return;
      }

      if (!usersResponse.ok) {
        throw new Error('Failed to load user data');
      }

      const userData = await usersResponse.json();
      setAssignedCategories(userData.assignedCategories || []);
      setUsers(userData.users || []);

      if (docsResponse.ok) {
        const docsData = await docsResponse.json();
        setDocuments(docsData.documents || []);
      }

      // Load stats separately
      loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [router, loadStats]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubEmail.trim() || !newSubCategory) return;

    setAddingSub(true);
    setError(null);

    try {
      const response = await fetch('/api/superuser/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: newSubEmail.trim(),
          categoryId: newSubCategory,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add subscription');
      }

      await loadData();
      setShowAddSub(false);
      setNewSubEmail('');
      setNewSubCategory(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add subscription');
    } finally {
      setAddingSub(false);
    }
  };

  const handleRemoveSubscription = async () => {
    if (!removingSub) return;

    try {
      const response = await fetch(
        `/api/superuser/users?userEmail=${encodeURIComponent(removingSub.email)}&categoryId=${removingSub.categoryId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove subscription');
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove subscription');
    } finally {
      setRemovingSub(null);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadCategory) return;
    if (uploadMode === 'file' && !uploadFile) return;
    if (uploadMode === 'text' && (!uploadTextName.trim() || !uploadTextContent.trim())) return;

    setUploading(true);
    setError(null);

    try {
      let response: Response;

      if (uploadMode === 'file') {
        const formData = new FormData();
        formData.append('file', uploadFile!);
        formData.append('categoryId', uploadCategory.toString());

        response = await fetch('/api/superuser/documents', {
          method: 'POST',
          body: formData,
        });
      } else {
        response = await fetch('/api/superuser/documents/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: uploadTextName.trim(),
            content: uploadTextContent,
            categoryId: uploadCategory,
          }),
        });
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload document');
      }

      await loadData();
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadTextName('');
      setUploadTextContent('');
      setUploadCategory(null);
      setUploadMode('file');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    setDeletingDocId(docId);
    setError(null);

    try {
      const response = await fetch(`/api/superuser/documents/${docId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete document');
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setDeletingDocId(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Fuzzy search helper
  const fuzzyMatch = (pattern: string, text: string): number => {
    pattern = pattern.toLowerCase();
    text = text.toLowerCase();
    let patternIdx = 0;
    let score = 0;
    let lastMatchIdx = -1;
    for (let i = 0; i < text.length && patternIdx < pattern.length; i++) {
      if (text[i] === pattern[patternIdx]) {
        if (lastMatchIdx === i - 1) score += 2;
        else score += 1;
        if (i === 0 || text[i - 1] === ' ' || text[i - 1] === '-' || text[i - 1] === '_') score += 3;
        lastMatchIdx = i;
        patternIdx++;
      }
    }
    return patternIdx < pattern.length ? -1 : score;
  };

  // Document search and sort logic
  const filteredAndSortedDocs = useMemo(() => {
    let result = [...documents];

    // Apply fuzzy search
    if (docSearchTerm.trim()) {
      result = result
        .map(doc => ({
          doc,
          score: Math.max(
            fuzzyMatch(docSearchTerm, doc.filename),
            fuzzyMatch(docSearchTerm, doc.categories?.map(c => c.categoryName).join(' ') || ''),
            fuzzyMatch(docSearchTerm, doc.status)
          ),
        }))
        .filter(r => r.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map(r => r.doc);
    }

    // Apply sorting
    if (docSortKey && docSortDirection) {
      result.sort((a, b) => {
        let aVal: string | number | Date | undefined;
        let bVal: string | number | Date | undefined;

        switch (docSortKey) {
          case 'filename':
            aVal = a.filename.toLowerCase();
            bVal = b.filename.toLowerCase();
            break;
          case 'size':
            aVal = a.size;
            bVal = b.size;
            break;
          case 'status':
            aVal = a.status;
            bVal = b.status;
            break;
          case 'uploadedAt':
            aVal = new Date(a.uploadedAt).getTime();
            bVal = new Date(b.uploadedAt).getTime();
            break;
          default:
            return 0;
        }

        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return docSortDirection === 'asc' ? 1 : -1;
        if (bVal == null) return docSortDirection === 'asc' ? -1 : 1;

        let comparison = 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          comparison = aVal.localeCompare(bVal);
        } else {
          comparison = (aVal as number) - (bVal as number);
        }

        return docSortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [documents, docSearchTerm, docSortKey, docSortDirection]);

  // Toggle sort for documents
  const handleDocSort = (key: keyof ManagedDocument) => {
    if (docSortKey === key) {
      if (docSortDirection === 'asc') {
        setDocSortDirection('desc');
      } else if (docSortDirection === 'desc') {
        setDocSortKey(null);
        setDocSortDirection(null);
      }
    } else {
      setDocSortKey(key);
      setDocSortDirection('asc');
    }
  };

  // Sortable header component
  const SortableDocHeader = ({ columnKey, label, className = '' }: { columnKey: keyof ManagedDocument; label: string; className?: string }) => {
    const isActive = docSortKey === columnKey;
    return (
      <th className={`px-6 py-3 font-medium ${className}`}>
        <button
          onClick={() => handleDocSort(columnKey)}
          className="flex items-center gap-1 hover:text-blue-600 transition-colors group"
        >
          {label}
          <span className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
            {isActive && docSortDirection === 'asc' ? (
              <ChevronUp size={14} className="text-blue-600" />
            ) : isActive && docSortDirection === 'desc' ? (
              <ChevronDown size={14} className="text-blue-600" />
            ) : (
              <ChevronsUpDown size={14} className="text-gray-400" />
            )}
          </span>
        </button>
      </th>
    );
  };

  // Category prompt handlers
  const loadCategoryPrompt = async (categoryId: number) => {
    setCategoryPromptLoading(true);
    try {
      const response = await fetch(`/api/categories/${categoryId}/prompt`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load category prompt');
      }
      const data = await response.json();
      setCategoryPromptData(data);
      setEditedCategoryAddendum(data.categoryAddendum || '');
      setCategoryPromptModified(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load category prompt');
    } finally {
      setCategoryPromptLoading(false);
    }
  };

  const handleOpenCategoryPromptModal = async (categoryId: number) => {
    setEditingCategoryPrompt(categoryId);
    await loadCategoryPrompt(categoryId);
  };

  const handleCloseCategoryPromptModal = () => {
    setEditingCategoryPrompt(null);
    setCategoryPromptData(null);
    setEditedCategoryAddendum('');
    setCategoryPromptModified(false);
  };

  const handleCategoryAddendumChange = (value: string) => {
    setEditedCategoryAddendum(value);
    setCategoryPromptModified(value !== (categoryPromptData?.categoryAddendum || ''));
  };

  const handleSaveCategoryPrompt = async () => {
    if (!editingCategoryPrompt) return;

    setSavingCategoryPrompt(true);
    setError(null);

    try {
      const response = await fetch(`/api/categories/${editingCategoryPrompt}/prompt`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptAddendum: editedCategoryAddendum }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.details?.join(', ') || 'Failed to save category prompt');
      }

      const data = await response.json();
      setCategoryPromptData(prev => prev ? {
        ...prev,
        categoryAddendum: data.categoryAddendum || '',
        combinedPrompt: data.combinedPrompt,
        charInfo: data.charInfo,
        metadata: data.metadata,
      } : null);
      setCategoryPromptModified(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category prompt');
    } finally {
      setSavingCategoryPrompt(false);
    }
  };

  const handleResetCategoryToGlobal = async () => {
    if (!editingCategoryPrompt) return;

    setSavingCategoryPrompt(true);
    setError(null);

    try {
      const response = await fetch(`/api/categories/${editingCategoryPrompt}/prompt`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reset category prompt');
      }

      await loadCategoryPrompt(editingCategoryPrompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset category prompt');
    } finally {
      setSavingCategoryPrompt(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Super User Dashboard</h1>
              <p className="text-sm text-gray-500">Manage documents and user subscriptions for your categories</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600"
            >
              &times;
            </button>
          </div>
        )}

        {/* Assigned Categories */}
        <div className="bg-white rounded-lg border shadow-sm mb-6">
          <div className="px-6 py-4 border-b">
            <h2 className="font-semibold text-gray-900">Your Assigned Categories</h2>
            <p className="text-sm text-gray-500">
              You can manage documents and user subscriptions for these categories
            </p>
          </div>
          <div className="px-6 py-4">
            {assignedCategories.length === 0 ? (
              <p className="text-gray-500 text-sm">No categories assigned to you yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {assignedCategories.map(cat => (
                  <span
                    key={cat.categoryId}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm font-medium"
                  >
                    <FolderOpen size={14} />
                    {cat.categoryName}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b mb-6">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'dashboard'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <LayoutDashboard size={16} className="inline mr-2" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users size={16} className="inline mr-2" />
            Users
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'documents'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={16} className="inline mr-2" />
            Documents
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'prompts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageSquare size={16} className="inline mr-2" />
            Prompts
          </button>
        </div>

        {/* Dashboard Section */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {statsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : stats ? (
              <>
                {/* Stats Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg border shadow-sm p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                        <FolderOpen className="text-orange-600" size={20} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Assigned Categories</p>
                        <p className="text-2xl font-semibold text-gray-900">{stats.assignedCategories}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border shadow-sm p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Database className="text-blue-600" size={20} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Documents</p>
                        <p className="text-2xl font-semibold text-gray-900">{stats.totalDocuments}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border shadow-sm p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                        <Users className="text-green-600" size={20} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Subscribers</p>
                        <p className="text-2xl font-semibold text-gray-900">{stats.totalSubscribers}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Category Breakdown */}
                <div className="bg-white rounded-lg border shadow-sm">
                  <div className="px-6 py-4 border-b">
                    <h3 className="font-semibold text-gray-900">Category Breakdown</h3>
                    <p className="text-sm text-gray-500">Overview of each assigned category</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 text-left text-sm text-gray-600">
                        <tr>
                          <th className="px-6 py-3 font-medium">Category</th>
                          <th className="px-6 py-3 font-medium text-center">Documents</th>
                          <th className="px-6 py-3 font-medium text-center">Status</th>
                          <th className="px-6 py-3 font-medium text-center">Subscribers</th>
                          <th className="px-6 py-3 font-medium text-center">Custom Prompt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {stats.categories.map((cat) => (
                          <tr key={cat.categoryId} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <span className="font-medium text-gray-900">{cat.categoryName}</span>
                              <span className="ml-2 text-xs text-gray-400">{cat.categorySlug}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="font-medium text-gray-900">{cat.documentCount}</span>
                              {cat.totalChunks > 0 && (
                                <span className="ml-1 text-xs text-gray-400">({cat.totalChunks} chunks)</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-center gap-2">
                                {cat.readyDocuments > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                                    <CheckCircle size={12} />
                                    {cat.readyDocuments}
                                  </span>
                                )}
                                {cat.processingDocuments > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                                    <Clock size={12} />
                                    {cat.processingDocuments}
                                  </span>
                                )}
                                {cat.errorDocuments > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                                    <AlertCircle size={12} />
                                    {cat.errorDocuments}
                                  </span>
                                )}
                                {cat.documentCount === 0 && (
                                  <span className="text-xs text-gray-400">No documents</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="font-medium text-gray-900">{cat.subscriberCount}</span>
                              {cat.activeSubscribers !== cat.subscriberCount && (
                                <span className="ml-1 text-xs text-gray-400">({cat.activeSubscribers} active)</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              {cat.hasCustomPrompt ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
                                  <MessageSquare size={12} />
                                  Yes
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">Global only</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Recent Documents */}
                  <div className="bg-white rounded-lg border shadow-sm">
                    <div className="px-6 py-4 border-b">
                      <h3 className="font-semibold text-gray-900">Recent Documents</h3>
                      <p className="text-sm text-gray-500">Latest documents in your categories</p>
                    </div>
                    <div className="p-4">
                      {stats.recentDocuments.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-4">No documents yet</p>
                      ) : (
                        <ul className="space-y-3">
                          {stats.recentDocuments.map((doc) => (
                            <li key={doc.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50">
                              <FileText size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 truncate">{doc.filename}</p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">
                                    {doc.categoryName}
                                  </span>
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded ${
                                      doc.status === 'ready'
                                        ? 'bg-green-100 text-green-700'
                                        : doc.status === 'processing'
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-red-100 text-red-700'
                                    }`}
                                  >
                                    {doc.status}
                                  </span>
                                  <span>{formatDate(doc.uploadedAt)}</span>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Recent Subscriptions */}
                  <div className="bg-white rounded-lg border shadow-sm">
                    <div className="px-6 py-4 border-b">
                      <h3 className="font-semibold text-gray-900">Recent Subscriptions</h3>
                      <p className="text-sm text-gray-500">Latest subscribers to your categories</p>
                    </div>
                    <div className="p-4">
                      {stats.recentSubscriptions.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-4">No subscriptions yet</p>
                      ) : (
                        <ul className="space-y-3">
                          {stats.recentSubscriptions.map((sub, idx) => (
                            <li key={idx} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50">
                              <User size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 truncate">{sub.userEmail}</p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">
                                    {sub.categoryName}
                                  </span>
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded ${
                                      sub.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                    }`}
                                  >
                                    {sub.isActive ? 'Active' : 'Inactive'}
                                  </span>
                                  <span>{formatDate(sub.subscribedAt)}</span>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>

                {/* Refresh Button */}
                <div className="flex justify-center">
                  <Button variant="secondary" onClick={loadStats} disabled={statsLoading}>
                    <RefreshCw size={16} className={`mr-2 ${statsLoading ? 'animate-spin' : ''}`} />
                    Refresh Stats
                  </Button>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-lg border shadow-sm p-8 text-center">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to load stats</h3>
                <p className="text-gray-500 mb-4">There was a problem loading your dashboard statistics.</p>
                <Button variant="secondary" onClick={loadStats}>
                  <RefreshCw size={16} className="mr-2" />
                  Try Again
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Documents Section */}
        {activeTab === 'documents' && (
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="px-6 py-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Documents</h2>
                  <p className="text-sm text-gray-500">
                    {docSearchTerm ? `${filteredAndSortedDocs.length} of ${documents.length}` : documents.length} documents in your categories
                  </p>
                </div>
                <Button
                  onClick={() => setShowUploadModal(true)}
                  disabled={assignedCategories.length === 0}
                >
                  <Upload size={18} className="mr-2" />
                  Upload Document
                </Button>
              </div>
              {/* Search bar */}
              {documents.length > 0 && (
                <div className="mt-4">
                  <div className="relative max-w-md">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={docSearchTerm}
                      onChange={(e) => setDocSearchTerm(e.target.value)}
                      placeholder="Search documents by name, category, or status..."
                      className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {docSearchTerm && (
                      <button
                        onClick={() => setDocSearchTerm('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {documents.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
                <p className="text-gray-500 mb-4">
                  Upload documents to your assigned categories
                </p>
              </div>
            ) : filteredAndSortedDocs.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No matching documents</h3>
                <p className="text-gray-500 mb-4">
                  Try adjusting your search term
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-left text-sm text-gray-600">
                    <tr>
                      <SortableDocHeader columnKey="filename" label="Document" />
                      <th className="px-6 py-3 font-medium">Category</th>
                      <SortableDocHeader columnKey="size" label="Size" />
                      <SortableDocHeader columnKey="status" label="Status" />
                      <SortableDocHeader columnKey="uploadedAt" label="Uploaded" />
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredAndSortedDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <FileText size={20} className="text-red-500" />
                            <span className="font-medium text-gray-900">{doc.filename}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {doc.categories.map(cat => (
                              <span
                                key={cat.categoryId}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full"
                              >
                                {cat.categoryName}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatFileSize(doc.size)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full ${
                              doc.status === 'ready'
                                ? 'bg-green-100 text-green-700'
                                : doc.status === 'processing'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDate(doc.uploadedAt)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end">
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              disabled={deletingDocId === doc.id}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                              title="Delete document"
                            >
                              {deletingDocId === doc.id ? (
                                <Spinner size="sm" />
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Users Section */}
        {activeTab === 'users' && (
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Managed Users</h2>
                <p className="text-sm text-gray-500">
                  {users.length} users subscribed to your categories
                </p>
              </div>
              <Button
                onClick={() => setShowAddSub(true)}
                disabled={assignedCategories.length === 0}
              >
                <Plus size={18} className="mr-2" />
                Add Subscription
              </Button>
            </div>
          </div>

          {users.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No users yet</h3>
              <p className="text-gray-500 mb-4">
                Add subscriptions to give users access to your categories
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-left text-sm text-gray-600">
                  <tr>
                    <th className="px-6 py-3 font-medium">User</th>
                    <th className="px-6 py-3 font-medium">Subscriptions</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <User size={16} className="text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {user.name || user.email.split('@')[0]}
                            </p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {user.subscriptions.map(sub => (
                            <span
                              key={sub.categoryId}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${
                                sub.isActive
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              <Tag size={10} />
                              {sub.categoryName}
                              <button
                                onClick={() => setRemovingSub({ email: user.email, categoryId: sub.categoryId })}
                                className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                                title="Remove subscription"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setNewSubEmail(user.email);
                              setShowAddSub(true);
                            }}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                            title="Add subscription"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}

        {/* Prompts Section */}
        {activeTab === 'prompts' && (
          <div className="space-y-6">
            {/* Global System Prompt (Read-only) */}
            <div className="bg-white rounded-lg border shadow-sm">
              <div className="px-6 py-4 border-b">
                <h2 className="font-semibold text-gray-900">Global System Prompt</h2>
                <p className="text-sm text-gray-500">
                  This prompt applies to all categories (read-only)
                </p>
              </div>
              <div className="p-6">
                {categoryPromptData ? (
                  <div className="bg-gray-50 border rounded-lg p-4 max-h-48 overflow-y-auto">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                      {categoryPromptData.globalPrompt}
                    </pre>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">
                    Select a category below to view the global system prompt
                  </p>
                )}
              </div>
            </div>

            {/* Category Prompts */}
            <div className="bg-white rounded-lg border shadow-sm">
              <div className="px-6 py-4 border-b">
                <h2 className="font-semibold text-gray-900">Category-Specific Prompts</h2>
                <p className="text-sm text-gray-500">
                  Add custom prompt guidance for your assigned categories
                </p>
              </div>
              <div className="p-6">
                {assignedCategories.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No categories assigned to you.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-3 font-medium text-gray-700">Category</th>
                          <th className="pb-3 font-medium text-gray-700">Custom Prompt</th>
                          <th className="pb-3 font-medium text-gray-700 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {assignedCategories.map((cat) => (
                          <tr key={cat.categoryId} className="hover:bg-gray-50">
                            <td className="py-3">
                              <span className="font-medium text-gray-900">{cat.categoryName}</span>
                            </td>
                            <td className="py-3">
                              <span className="text-gray-500 text-xs">Click Edit to configure</span>
                            </td>
                            <td className="py-3 text-right">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleOpenCategoryPromptModal(cat.categoryId)}
                              >
                                <Edit2 size={14} className="mr-1" />
                                Edit
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Upload Document Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setUploadFile(null);
          setUploadTextName('');
          setUploadTextContent('');
          setUploadCategory(null);
          setUploadMode('file');
        }}
        title="Upload Document"
      >
        {/* Tabs */}
        <div className="flex border-b mb-4">
          <button
            type="button"
            onClick={() => setUploadMode('file')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              uploadMode === 'file'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Upload size={16} className="inline mr-2" />
            File Upload
          </button>
          <button
            type="button"
            onClick={() => setUploadMode('text')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              uploadMode === 'text'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={16} className="inline mr-2" />
            Text Content
          </button>
        </div>

        <form onSubmit={handleUploadDocument}>
          <div className="space-y-4">
            {/* File Upload Mode */}
            {uploadMode === 'file' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File *
                </label>
                <div className="border-2 border-dashed rounded-lg p-4">
                  {uploadFile ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText size={20} className="text-red-500" />
                        <span className="text-sm font-medium">{uploadFile.name}</span>
                        <span className="text-xs text-gray-500">
                          ({formatFileSize(uploadFile.size)})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUploadFile(null)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <X size={16} className="text-gray-500" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center cursor-pointer">
                      <Upload size={24} className="text-gray-400 mb-2" />
                      <span className="text-sm text-gray-600">Click to select a file</span>
                      <span className="text-xs text-gray-400 mt-1">PDF, DOCX, XLSX, PPTX, Images (max 50MB)</span>
                      <input
                        type="file"
                        accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.webp,.gif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/png,image/jpeg,image/webp,image/gif"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setUploadFile(file);
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* Text Content Mode */}
            {uploadMode === 'text' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Document Name *
                  </label>
                  <input
                    type="text"
                    value={uploadTextName}
                    onChange={(e) => setUploadTextName(e.target.value)}
                    placeholder="e.g., Company Policy Overview"
                    maxLength={255}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Content *
                  </label>
                  <textarea
                    value={uploadTextContent}
                    onChange={(e) => setUploadTextContent(e.target.value)}
                    placeholder="Paste your text content here..."
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-y"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {uploadTextContent.length.toLocaleString()} characters
                  </p>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <select
                value={uploadCategory || ''}
                onChange={(e) => setUploadCategory(parseInt(e.target.value, 10) || null)}
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select category...</option>
                {assignedCategories.map(cat => (
                  <option key={cat.categoryId} value={cat.categoryId}>
                    {cat.categoryName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowUploadModal(false);
                setUploadFile(null);
                setUploadTextName('');
                setUploadTextContent('');
                setUploadCategory(null);
                setUploadMode('file');
              }}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={uploading}
              disabled={
                !uploadCategory ||
                (uploadMode === 'file' ? !uploadFile : (!uploadTextName.trim() || !uploadTextContent.trim()))
              }
            >
              Upload
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Subscription Modal */}
      <Modal
        isOpen={showAddSub}
        onClose={() => {
          setShowAddSub(false);
          setNewSubEmail('');
          setNewSubCategory(null);
        }}
        title="Add Subscription"
      >
        <form onSubmit={handleAddSubscription}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User Email *
              </label>
              <input
                type="email"
                value={newSubEmail}
                onChange={(e) => setNewSubEmail(e.target.value)}
                placeholder="user@example.com"
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                User must already exist in the system
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <select
                value={newSubCategory || ''}
                onChange={(e) => setNewSubCategory(parseInt(e.target.value, 10) || null)}
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select category...</option>
                {assignedCategories.map(cat => (
                  <option key={cat.categoryId} value={cat.categoryId}>
                    {cat.categoryName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAddSub(false);
                setNewSubEmail('');
                setNewSubCategory(null);
              }}
              disabled={addingSub}
            >
              Cancel
            </Button>
            <Button type="submit" loading={addingSub}>
              Add Subscription
            </Button>
          </div>
        </form>
      </Modal>

      {/* Remove Subscription Confirmation */}
      <Modal
        isOpen={!!removingSub}
        onClose={() => setRemovingSub(null)}
        title="Remove Subscription?"
      >
        <p className="text-gray-600 mb-4">
          Are you sure you want to remove this subscription?
        </p>
        <p className="text-sm text-gray-500 mb-6">
          The user will lose access to documents in this category.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setRemovingSub(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleRemoveSubscription}>
            Remove
          </Button>
        </div>
      </Modal>

      {/* Category Prompt Edit Modal */}
      <Modal
        isOpen={editingCategoryPrompt !== null}
        onClose={handleCloseCategoryPromptModal}
        title={`Edit Prompt: ${categoryPromptData?.category.name || 'Category'}`}
      >
        {categoryPromptLoading ? (
          <div className="py-12 flex justify-center">
            <Spinner size="lg" />
          </div>
        ) : categoryPromptData ? (
          <div className="space-y-6">
            {/* Global Prompt Preview (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Global System Prompt
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  ({categoryPromptData.charInfo.globalLength} chars)
                </span>
              </label>
              <div className="bg-gray-50 border rounded-lg p-3 max-h-40 overflow-y-auto">
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">
                  {categoryPromptData.globalPrompt}
                </pre>
              </div>
            </div>

            {/* Category Addendum (Editable) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category-Specific Addendum
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  ({editedCategoryAddendum.length} / {categoryPromptData.charInfo.availableForCategory} chars available)
                </span>
              </label>
              <textarea
                value={editedCategoryAddendum}
                onChange={(e) => handleCategoryAddendumChange(e.target.value)}
                rows={6}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm ${
                  editedCategoryAddendum.length > categoryPromptData.charInfo.availableForCategory
                    ? 'border-red-300 bg-red-50'
                    : ''
                }`}
                placeholder="Add category-specific guidance here (optional)..."
              />
              {editedCategoryAddendum.length > categoryPromptData.charInfo.availableForCategory && (
                <p className="mt-1 text-xs text-red-600">
                  Exceeds available character limit
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                This text will be appended to the global system prompt for this category.
              </p>
            </div>

            {/* Combined Preview (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Combined Prompt Preview
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  (Total: {categoryPromptData.charInfo.globalLength + (editedCategoryAddendum ? editedCategoryAddendum.length + 42 : 0)} / {categoryPromptData.charInfo.maxCombined} chars)
                </span>
              </label>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                  {categoryPromptData.globalPrompt}
                  {editedCategoryAddendum && (
                    <>
                      {'\n\n--- Category-Specific Guidelines ---\n\n'}
                      <span className="text-blue-700">{editedCategoryAddendum}</span>
                    </>
                  )}
                </pre>
              </div>
            </div>

            {/* Metadata */}
            {categoryPromptData.metadata && (
              <p className="text-xs text-gray-500">
                Last updated: {new Date(categoryPromptData.metadata.updatedAt).toLocaleString()} by {categoryPromptData.metadata.updatedBy}
              </p>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="secondary"
                onClick={handleResetCategoryToGlobal}
                disabled={savingCategoryPrompt || !categoryPromptData.categoryAddendum}
                className="text-orange-600 border-orange-300 hover:bg-orange-50"
              >
                <RefreshCw size={16} className="mr-2" />
                Reset to Global Only
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={handleCloseCategoryPromptModal}
                  disabled={savingCategoryPrompt}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveCategoryPrompt}
                  disabled={
                    !categoryPromptModified ||
                    savingCategoryPrompt ||
                    editedCategoryAddendum.length > categoryPromptData.charInfo.availableForCategory
                  }
                  loading={savingCategoryPrompt}
                >
                  <Save size={16} className="mr-2" />
                  Save
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Failed to load category prompt data</p>
        )}
      </Modal>
    </div>
  );
}
