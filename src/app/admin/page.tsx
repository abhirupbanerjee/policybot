'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, RefreshCw, Trash2, FileText, AlertCircle, Users, UserPlus, Shield, User, Settings, Save, FolderOpen, Plus, Edit2, BarChart3, Database, HardDrive, Globe, Tag, Landmark, DollarSign, Activity, Layers, Server, ScrollText, ChevronUp, ChevronDown, ChevronsUpDown, Search, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { type SortDirection } from '@/components/ui/SortableTable';
import type { GlobalDocument } from '@/types';

interface AllowedUser {
  id?: number;
  email: string;
  name?: string;
  role: 'admin' | 'superuser' | 'user';
  addedAt: string;
  addedBy: string;
  subscriptions?: { categoryId: number; categoryName: string; isActive: boolean }[];
  assignedCategories?: { categoryId: number; categoryName: string }[];
}

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  created_by: string;
  created_at: string;
  documentCount: number;
  superUserCount: number;
  subscriberCount: number;
}

interface SystemPromptConfig {
  prompt: string;
  updatedAt: string;
  updatedBy: string;
}

interface RAGSettings {
  topKChunks: number;
  maxContextChunks: number;
  similarityThreshold: number;
  chunkSize: number;
  chunkOverlap: number;
  queryExpansionEnabled: boolean;
  cacheEnabled: boolean;
  cacheTTLSeconds: number;
  updatedAt: string;
  updatedBy: string;
}

interface LLMSettings {
  model: string;
  temperature: number;
  maxTokens: number;
  updatedAt: string;
  updatedBy: string;
}

interface AcronymMappings {
  mappings: Record<string, string>;
  updatedAt: string;
  updatedBy: string;
}

interface TavilySettings {
  apiKey: string;
  enabled: boolean;
  defaultTopic: 'general' | 'news' | 'finance';
  defaultSearchDepth: 'basic' | 'advanced';
  maxResults: number;
  includeDomains: string[];
  excludeDomains: string[];
  cacheTTLSeconds: number;
  updatedAt: string;
  updatedBy: string;
}

interface AvailableModel {
  id: string;
  name: string;
  description: string;
  provider?: 'openai' | 'mistral' | 'ollama' | 'azure';
}

interface ProviderStatus {
  provider: string;
  available: boolean;
  configured: boolean;
  error?: string;
}

interface ServiceStatus {
  name: string;
  model: string;
  provider: string;
  available: boolean;
  configured: boolean;
  error?: string;
}

interface ModelPreset {
  id: string;
  name: string;
  description: string;
  model: string;
  llmSettings: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
  ragSettings: {
    topKChunks: number;
    maxContextChunks: number;
    similarityThreshold: number;
    chunkSize: number;
    chunkOverlap: number;
    queryExpansionEnabled: boolean;
    cacheEnabled: boolean;
    cacheTTLSeconds: number;
  };
}

type TabType = 'documents' | 'categories' | 'users' | 'settings' | 'stats';
type SettingsSection = 'prompt' | 'rag' | 'llm' | 'acronyms' | 'tavily' | 'branding' | 'reranker';

interface BrandingSettings {
  botName: string;
  botIcon: string;
  updatedAt?: string;
  updatedBy?: string;
}

interface RerankerSettings {
  enabled: boolean;
  provider: 'cohere' | 'local';
  topKForReranking: number;
  minRerankerScore: number;
  cacheTTLSeconds: number;
  updatedAt?: string;
  updatedBy?: string;
}

// Available icon options for branding with their Lucide components
const BRANDING_ICONS = [
  { key: 'government', label: 'Government', Icon: Landmark },
  { key: 'operations', label: 'Operations', Icon: Settings },
  { key: 'finance', label: 'Finance', Icon: DollarSign },
  { key: 'kpi', label: 'KPI', Icon: BarChart3 },
  { key: 'logs', label: 'Logs', Icon: FileText },
  { key: 'data', label: 'Data', Icon: Database },
  { key: 'monitoring', label: 'Monitoring', Icon: Activity },
  { key: 'architecture', label: 'Architecture', Icon: Layers },
  { key: 'internet', label: 'Internet', Icon: Globe },
  { key: 'systems', label: 'Systems', Icon: Server },
  { key: 'policy', label: 'Policy', Icon: ScrollText },
] as const;

interface SystemStats {
  database: {
    users: { total: number; admins: number; superUsers: number; regularUsers: number };
    categories: { total: number; withDocuments: number; totalSubscriptions: number };
    threads: { total: number; totalMessages: number; totalUploads: number };
    documents: { total: number; globalDocuments: number; categoryDocuments: number; totalChunks: number; byStatus: { processing: number; ready: number; error: number } };
  };
  chroma: {
    connected: boolean;
    collections: { name: string; documentCount: number }[];
    totalVectors: number;
  };
  storage: {
    globalDocsDir: { path: string; exists: boolean; fileCount: number; totalSizeMB: number };
    threadsDir: { path: string; exists: boolean; userCount: number; totalUploadSizeMB: number };
    dataDir: { path: string; exists: boolean; totalSizeMB: number };
  };
  recentActivity: {
    recentThreads: { id: string; title: string; userEmail: string; messageCount: number; createdAt: string }[];
    recentDocuments: { id: number; filename: string; uploadedBy: string; status: string; createdAt: string }[];
  };
}

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('documents');

  // Document state
  const [documents, setDocuments] = useState<GlobalDocument[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [docLoading, setDocLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<GlobalDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reindexing, setReindexing] = useState<string | null>(null);

  // Document search and sort state
  const [docSearchTerm, setDocSearchTerm] = useState('');
  const [docSortKey, setDocSortKey] = useState<keyof GlobalDocument | null>(null);
  const [docSortDirection, setDocSortDirection] = useState<SortDirection>(null);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategoryIds, setUploadCategoryIds] = useState<number[]>([]);
  const [uploadIsGlobal, setUploadIsGlobal] = useState(false);

  // Edit document modal state
  const [editingDoc, setEditingDoc] = useState<GlobalDocument | null>(null);
  const [editDocCategoryIds, setEditDocCategoryIds] = useState<number[]>([]);
  const [editDocIsGlobal, setEditDocIsGlobal] = useState(false);
  const [savingDocChanges, setSavingDocChanges] = useState(false);

  // User state
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [userLoading, setUserLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'superuser' | 'user'>('user');
  const [addingUser, setAddingUser] = useState(false);
  const [deleteUser, setDeleteUser] = useState<AllowedUser | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<AllowedUser | null>(null);
  const [updatingRole, setUpdatingRole] = useState(false);

  // Add user category selection state
  const [newUserSubscriptions, setNewUserSubscriptions] = useState<number[]>([]);
  const [newUserAssignedCategories, setNewUserAssignedCategories] = useState<number[]>([]);

  // Manage user subscriptions state
  const [managingUserSubs, setManagingUserSubs] = useState<AllowedUser | null>(null);
  const [editUserSubscriptions, setEditUserSubscriptions] = useState<number[]>([]);
  const [editUserAssignedCategories, setEditUserAssignedCategories] = useState<number[]>([]);
  const [savingUserSubs, setSavingUserSubs] = useState(false);

  // Category state
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryDescription, setEditCategoryDescription] = useState('');
  const [updatingCategory, setUpdatingCategory] = useState(false);

  // System prompt state
  const [systemPrompt, setSystemPrompt] = useState<SystemPromptConfig | null>(null);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [promptLoading, setPromptLoading] = useState(true);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [promptModified, setPromptModified] = useState(false);

  // RAG/LLM settings state
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('prompt');
  const [ragSettings, setRagSettings] = useState<RAGSettings | null>(null);
  const [editedRag, setEditedRag] = useState<Omit<RAGSettings, 'updatedAt' | 'updatedBy'> | null>(null);
  const [llmSettings, setLlmSettings] = useState<LLMSettings | null>(null);
  const [editedLlm, setEditedLlm] = useState<Omit<LLMSettings, 'updatedAt' | 'updatedBy'> | null>(null);
  const [acronymMappings, setAcronymMappings] = useState<AcronymMappings | null>(null);
  const [editedAcronyms, setEditedAcronyms] = useState<string>('');
  const [tavilySettings, setTavilySettings] = useState<TavilySettings | null>(null);
  const [editedTavily, setEditedTavily] = useState<Omit<TavilySettings, 'updatedAt' | 'updatedBy'> | null>(null);
  const [brandingSettings, setBrandingSettings] = useState<BrandingSettings | null>(null);
  const [editedBranding, setEditedBranding] = useState<Omit<BrandingSettings, 'updatedAt' | 'updatedBy'> | null>(null);
  const [rerankerSettings, setRerankerSettings] = useState<RerankerSettings | null>(null);
  const [editedReranker, setEditedReranker] = useState<Omit<RerankerSettings, 'updatedAt' | 'updatedBy'> | null>(null);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [modelPresets, setModelPresets] = useState<ModelPreset[]>([]);
  const [providerStatus, setProviderStatus] = useState<Record<string, ProviderStatus>>({});
  const [serviceStatus, setServiceStatus] = useState<Record<string, ServiceStatus>>({});
  const [providersLoading, setProvidersLoading] = useState(true);
  const [applyingPreset, setApplyingPreset] = useState(false);
  const [restoringDefaults, setRestoringDefaults] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [ragModified, setRagModified] = useState(false);
  const [llmModified, setLlmModified] = useState(false);
  const [acronymsModified, setAcronymsModified] = useState(false);
  const [tavilyModified, setTavilyModified] = useState(false);
  const [brandingModified, setBrandingModified] = useState(false);
  const [rerankerModified, setRerankerModified] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stats state
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Load documents
  const loadDocuments = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/documents');

      if (response.status === 403) {
        router.push('/');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load documents');
      }

      const data = await response.json();
      setDocuments(data.documents.map((d: GlobalDocument) => ({
        ...d,
        uploadedAt: new Date(d.uploadedAt),
      })));
      setTotalChunks(data.totalChunks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setDocLoading(false);
    }
  }, [router]);

  // Load users
  const loadUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users');

      if (response.status === 403) {
        router.push('/');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load users');
      }

      const data = await response.json();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setUserLoading(false);
    }
  }, [router]);

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/categories');

      if (response.status === 403) {
        router.push('/');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load categories');
      }

      const data = await response.json();
      setCategories(data.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setCategoryLoading(false);
    }
  }, [router]);

  // Load system prompt
  const loadSystemPrompt = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/system-prompt');

      if (response.status === 403) {
        router.push('/');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load system prompt');
      }

      const data = await response.json();
      setSystemPrompt(data);
      setEditedPrompt(data.prompt);
      setPromptModified(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system prompt');
    } finally {
      setPromptLoading(false);
    }
  }, [router]);

  // Load RAG/LLM settings
  const loadSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/settings');

      if (response.status === 403) {
        router.push('/');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load settings');
      }

      const data = await response.json();
      setRagSettings(data.rag);
      setEditedRag({
        topKChunks: data.rag.topKChunks,
        maxContextChunks: data.rag.maxContextChunks,
        similarityThreshold: data.rag.similarityThreshold,
        chunkSize: data.rag.chunkSize,
        chunkOverlap: data.rag.chunkOverlap,
        queryExpansionEnabled: data.rag.queryExpansionEnabled,
        cacheEnabled: data.rag.cacheEnabled,
        cacheTTLSeconds: data.rag.cacheTTLSeconds,
      });
      setLlmSettings(data.llm);
      setEditedLlm({
        model: data.llm.model,
        temperature: data.llm.temperature,
        maxTokens: data.llm.maxTokens,
      });
      setAcronymMappings(data.acronyms);
      setEditedAcronyms(
        Object.entries(data.acronyms.mappings)
          .map(([k, v]) => `${k}=${v}`)
          .join('\n')
      );
      setTavilySettings(data.tavily);
      setEditedTavily({
        apiKey: data.tavily.apiKey,
        enabled: data.tavily.enabled,
        defaultTopic: data.tavily.defaultTopic,
        defaultSearchDepth: data.tavily.defaultSearchDepth,
        maxResults: data.tavily.maxResults,
        includeDomains: data.tavily.includeDomains,
        excludeDomains: data.tavily.excludeDomains,
        cacheTTLSeconds: data.tavily.cacheTTLSeconds,
      });
      setBrandingSettings(data.branding);
      setEditedBranding({
        botName: data.branding.botName,
        botIcon: data.branding.botIcon,
      });
      setRerankerSettings(data.reranker);
      setEditedReranker({
        enabled: data.reranker.enabled,
        provider: data.reranker.provider,
        topKForReranking: data.reranker.topKForReranking,
        minRerankerScore: data.reranker.minRerankerScore,
        cacheTTLSeconds: data.reranker.cacheTTLSeconds,
      });
      setAvailableModels(data.availableModels);
      setModelPresets(data.modelPresets || []);
      setRagModified(false);
      setLlmModified(false);
      setAcronymsModified(false);
      setTavilyModified(false);
      setBrandingModified(false);
      setRerankerModified(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setSettingsLoading(false);
    }
  }, [router]);

  // Load system stats
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const response = await fetch('/api/admin/stats');

      if (response.status === 403) {
        router.push('/');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load stats');
      }

      const data = await response.json();
      setSystemStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setStatsLoading(false);
    }
  }, [router]);

  // Load provider availability status
  const loadProviders = useCallback(async () => {
    setProvidersLoading(true);
    try {
      const response = await fetch('/api/admin/providers');

      if (response.status === 403) {
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load provider status');
      }

      const data = await response.json();
      setProviderStatus(data.providers || {});
      setServiceStatus(data.services || {});
    } catch (err) {
      console.error('Failed to load provider status:', err);
      // Don't show error to user - providers status is optional
    } finally {
      setProvidersLoading(false);
    }
  }, []);

  // Helper to get provider from model name
  const getModelProvider = useCallback((model: string): 'openai' | 'mistral' | 'ollama' | 'azure' => {
    if (model.startsWith('ollama-')) return 'ollama';
    if (model.startsWith('mistral') || model.startsWith('ministral')) return 'mistral';
    if (model.startsWith('azure-')) return 'azure';
    return 'openai';
  }, []);

  useEffect(() => {
    loadDocuments();
    loadUsers();
    loadCategories();
    loadSystemPrompt();
    loadSettings();
    loadStats();
    loadProviders();
  }, [loadDocuments, loadUsers, loadCategories, loadSystemPrompt, loadSettings, loadStats, loadProviders]);

  // Document handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
    ];
    if (!supportedTypes.includes(file.type)) {
      setError('Invalid file type. Allowed: PDF, DOCX, XLSX, PPTX, PNG, JPG, WEBP, GIF');
      e.target.value = '';
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('File too large (max 50MB)');
      e.target.value = '';
      return;
    }

    // Open modal with selected file
    setUploadFile(file);
    setUploadCategoryIds([]);
    setUploadIsGlobal(false);
    setShowUploadModal(true);
    e.target.value = '';
  };

  const handleUploadConfirm = async () => {
    if (!uploadFile) return;

    setUploading(true);
    setUploadProgress('Uploading...');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('categoryIds', JSON.stringify(uploadCategoryIds));
      formData.append('isGlobal', String(uploadIsGlobal));

      const response = await fetch('/api/admin/documents', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      setUploadProgress('Processing...');
      await loadDocuments();
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadCategoryIds([]);
      setUploadIsGlobal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleEditDoc = (doc: GlobalDocument) => {
    setEditingDoc(doc);
    setEditDocCategoryIds(doc.categories?.map(c => c.id) || []);
    setEditDocIsGlobal(doc.isGlobal || false);
  };

  const handleSaveDocChanges = async () => {
    if (!editingDoc) return;

    setSavingDocChanges(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/documents/${editingDoc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryIds: editDocCategoryIds,
          isGlobal: editDocIsGlobal,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update document');
      }

      await loadDocuments();
      setEditingDoc(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update document');
    } finally {
      setSavingDocChanges(false);
    }
  };

  const handleDeleteDoc = async () => {
    if (!deleteDoc) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/documents/${deleteDoc.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Delete failed');
      }

      setDocuments((prev) => prev.filter((d) => d.id !== deleteDoc.id));
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
      setDeleteDoc(null);
    }
  };

  const handleReindex = async (docId: string) => {
    setReindexing(docId);
    setError(null);

    try {
      const response = await fetch(`/api/admin/documents/${docId}?reindex=true`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Reindex failed');
      }

      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reindex failed');
    } finally {
      setReindexing(null);
    }
  };

  const handleRefreshAll = async () => {
    if (!confirm('This will clear the response cache and reindex all documents. This may take a few minutes. Continue?')) {
      return;
    }

    setRefreshingAll(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/refresh', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Refresh failed');
      }

      const result = await response.json();
      await loadDocuments();
      alert(`Refresh complete! Cache cleared, ${result.documentsReindexed} documents reindexed.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshingAll(false);
    }
  };

  // User handlers
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim()) return;

    setAddingUser(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail.trim(),
          name: newUserName.trim() || undefined,
          role: newUserRole,
          subscriptions: newUserRole === 'user' ? newUserSubscriptions : undefined,
          assignedCategories: newUserRole === 'superuser' ? newUserAssignedCategories : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add user');
      }

      await loadUsers();
      setShowAddUser(false);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserRole('user');
      setNewUserSubscriptions([]);
      setNewUserAssignedCategories([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setAddingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;

    setDeletingUser(true);
    try {
      const response = await fetch(`/api/admin/users?email=${encodeURIComponent(deleteUser.email)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove user');
      }

      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove user');
    } finally {
      setDeletingUser(false);
      setDeleteUser(null);
    }
  };

  const handleUpdateRole = async (newRole: 'admin' | 'superuser' | 'user') => {
    if (!editingUser) return;

    setUpdatingRole(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: editingUser.email,
          role: newRole,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update role');
      }

      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setUpdatingRole(false);
      setEditingUser(null);
    }
  };

  const handleManageUserSubs = (user: AllowedUser) => {
    setManagingUserSubs(user);
    if (user.role === 'user') {
      setEditUserSubscriptions(user.subscriptions?.map(s => s.categoryId) || []);
      setEditUserAssignedCategories([]);
    } else if (user.role === 'superuser') {
      setEditUserSubscriptions([]);
      setEditUserAssignedCategories(user.assignedCategories?.map(c => c.categoryId) || []);
    }
  };

  const handleSaveUserSubs = async () => {
    if (!managingUserSubs) return;

    setSavingUserSubs(true);
    setError(null);

    try {
      // Use user ID from the managingUserSubs object
      const userId = managingUserSubs.id;

      if (!userId) {
        throw new Error('Could not find user ID');
      }

      if (managingUserSubs.role === 'user') {
        // Get current subscriptions
        const currentSubs = managingUserSubs.subscriptions?.map(s => s.categoryId) || [];

        // Add new subscriptions
        for (const catId of editUserSubscriptions) {
          if (!currentSubs.includes(catId)) {
            await fetch(`/api/admin/users/${userId}/subscriptions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ categoryId: catId }),
            });
          }
        }

        // Remove old subscriptions
        for (const catId of currentSubs) {
          if (!editUserSubscriptions.includes(catId)) {
            await fetch(`/api/admin/users/${userId}/subscriptions?categoryId=${catId}`, {
              method: 'DELETE',
            });
          }
        }
      } else if (managingUserSubs.role === 'superuser') {
        // Get current assignments
        const currentAssignments = managingUserSubs.assignedCategories?.map(c => c.categoryId) || [];

        // Add new assignments
        for (const catId of editUserAssignedCategories) {
          if (!currentAssignments.includes(catId)) {
            await fetch(`/api/admin/super-users/${userId}/categories`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ categoryId: catId }),
            });
          }
        }

        // Remove old assignments
        for (const catId of currentAssignments) {
          if (!editUserAssignedCategories.includes(catId)) {
            await fetch(`/api/admin/super-users/${userId}/categories?categoryId=${catId}`, {
              method: 'DELETE',
            });
          }
        }
      }

      await loadUsers();
      setManagingUserSubs(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subscriptions');
    } finally {
      setSavingUserSubs(false);
    }
  };

  // Category handlers
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setAddingCategory(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          description: newCategoryDescription.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create category');
      }

      await loadCategories();
      setShowAddCategory(false);
      setNewCategoryName('');
      setNewCategoryDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category');
    } finally {
      setAddingCategory(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategory) return;

    setDeletingCategory(true);
    try {
      const response = await fetch(`/api/admin/categories/${deleteCategory.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete category');
      }

      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    } finally {
      setDeletingCategory(false);
      setDeleteCategory(null);
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setEditCategoryName(category.name);
    setEditCategoryDescription(category.description || '');
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editCategoryName.trim()) return;

    setUpdatingCategory(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/categories/${editingCategory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editCategoryName.trim(),
          description: editCategoryDescription.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update category');
      }

      await loadCategories();
      setEditingCategory(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update category');
    } finally {
      setUpdatingCategory(false);
    }
  };

  // System prompt handlers
  const handlePromptChange = (value: string) => {
    setEditedPrompt(value);
    setPromptModified(value !== systemPrompt?.prompt);
  };

  const handleSavePrompt = async () => {
    if (!promptModified || !editedPrompt.trim()) return;

    setSavingPrompt(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/system-prompt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: editedPrompt }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save system prompt');
      }

      const result = await response.json();
      setSystemPrompt(result.config);
      setPromptModified(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save system prompt');
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleResetPrompt = () => {
    if (systemPrompt) {
      setEditedPrompt(systemPrompt.prompt);
      setPromptModified(false);
    }
  };

  // RAG settings handlers
  const handleRagChange = <K extends keyof Omit<RAGSettings, 'updatedAt' | 'updatedBy'>>(
    key: K,
    value: Omit<RAGSettings, 'updatedAt' | 'updatedBy'>[K]
  ) => {
    if (!editedRag) return;
    const updated = { ...editedRag, [key]: value };
    setEditedRag(updated);
    setRagModified(
      JSON.stringify(updated) !== JSON.stringify({
        topKChunks: ragSettings?.topKChunks,
        maxContextChunks: ragSettings?.maxContextChunks,
        similarityThreshold: ragSettings?.similarityThreshold,
        chunkSize: ragSettings?.chunkSize,
        chunkOverlap: ragSettings?.chunkOverlap,
        queryExpansionEnabled: ragSettings?.queryExpansionEnabled,
        cacheEnabled: ragSettings?.cacheEnabled,
        cacheTTLSeconds: ragSettings?.cacheTTLSeconds,
      })
    );
  };

  const handleSaveRag = async () => {
    if (!ragModified || !editedRag) return;

    setSavingSettings(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'rag', settings: editedRag }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save RAG settings');
      }

      const result = await response.json();
      setRagSettings(result.settings);
      setRagModified(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save RAG settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetRag = () => {
    if (ragSettings) {
      setEditedRag({
        topKChunks: ragSettings.topKChunks,
        maxContextChunks: ragSettings.maxContextChunks,
        similarityThreshold: ragSettings.similarityThreshold,
        chunkSize: ragSettings.chunkSize,
        chunkOverlap: ragSettings.chunkOverlap,
        queryExpansionEnabled: ragSettings.queryExpansionEnabled,
        cacheEnabled: ragSettings.cacheEnabled,
        cacheTTLSeconds: ragSettings.cacheTTLSeconds,
      });
      setRagModified(false);
    }
  };

  // LLM settings handlers
  const handleLlmChange = <K extends keyof Omit<LLMSettings, 'updatedAt' | 'updatedBy'>>(
    key: K,
    value: Omit<LLMSettings, 'updatedAt' | 'updatedBy'>[K]
  ) => {
    if (!editedLlm) return;
    const updated = { ...editedLlm, [key]: value };
    setEditedLlm(updated);
    setLlmModified(
      JSON.stringify(updated) !== JSON.stringify({
        model: llmSettings?.model,
        temperature: llmSettings?.temperature,
        maxTokens: llmSettings?.maxTokens,
      })
    );
  };

  const handleSaveLlm = async () => {
    if (!llmModified || !editedLlm) return;

    setSavingSettings(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'llm', settings: editedLlm }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save LLM settings');
      }

      const result = await response.json();
      setLlmSettings(result.settings);
      setLlmModified(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save LLM settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetLlm = () => {
    if (llmSettings) {
      setEditedLlm({
        model: llmSettings.model,
        temperature: llmSettings.temperature,
        maxTokens: llmSettings.maxTokens,
      });
      setLlmModified(false);
    }
  };

  // Preset handlers
  const handleApplyPreset = async (presetId: string) => {
    setApplyingPreset(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'preset', settings: { presetId } }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to apply preset');
      }

      const result = await response.json();

      // Update LLM settings
      setLlmSettings({
        ...result.settings.llm,
        updatedAt: new Date().toISOString(),
        updatedBy: 'admin',
      });
      setEditedLlm(result.settings.llm);

      // Update RAG settings
      setRagSettings({
        ...result.settings.rag,
        updatedAt: new Date().toISOString(),
        updatedBy: 'admin',
      });
      setEditedRag(result.settings.rag);

      setLlmModified(false);
      setRagModified(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply preset');
    } finally {
      setApplyingPreset(false);
    }
  };

  // Restore all settings to defaults (gpt-4.1-mini preset + default system prompt)
  const handleRestoreAllDefaults = async () => {
    setRestoringDefaults(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'restoreAllDefaults', settings: {} }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to restore defaults');
      }

      // Reload all settings
      await loadSettings();
      await loadSystemPrompt();
      setShowRestoreConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore defaults');
    } finally {
      setRestoringDefaults(false);
    }
  };

  // Acronym handlers
  const handleAcronymsChange = (value: string) => {
    setEditedAcronyms(value);
    const originalText = Object.entries(acronymMappings?.mappings || {})
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    setAcronymsModified(value !== originalText);
  };

  const parseAcronyms = (text: string): Record<string, string> => {
    const mappings: Record<string, string> = {};
    const lines = text.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        mappings[key.trim().toLowerCase()] = valueParts.join('=').trim();
      }
    }
    return mappings;
  };

  const handleSaveAcronyms = async () => {
    if (!acronymsModified) return;

    setSavingSettings(true);
    setError(null);

    try {
      const mappings = parseAcronyms(editedAcronyms);
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'acronyms', settings: { mappings } }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save acronym mappings');
      }

      const result = await response.json();
      setAcronymMappings(result.settings);
      setAcronymsModified(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save acronym mappings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetAcronyms = () => {
    if (acronymMappings) {
      setEditedAcronyms(
        Object.entries(acronymMappings.mappings)
          .map(([k, v]) => `${k}=${v}`)
          .join('\n')
      );
      setAcronymsModified(false);
    }
  };

  const handleSaveTavily = async () => {
    if (!editedTavily || !tavilyModified) return;

    setSavingSettings(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'tavily', settings: editedTavily }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save Tavily settings');
      }

      const result = await response.json();
      setTavilySettings(result.settings);
      setEditedTavily({
        apiKey: result.settings.apiKey,
        enabled: result.settings.enabled,
        defaultTopic: result.settings.defaultTopic,
        defaultSearchDepth: result.settings.defaultSearchDepth,
        maxResults: result.settings.maxResults,
        includeDomains: result.settings.includeDomains,
        excludeDomains: result.settings.excludeDomains,
        cacheTTLSeconds: result.settings.cacheTTLSeconds,
      });
      setTavilyModified(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Tavily settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetTavily = () => {
    if (tavilySettings) {
      setEditedTavily({
        apiKey: tavilySettings.apiKey,
        enabled: tavilySettings.enabled,
        defaultTopic: tavilySettings.defaultTopic,
        defaultSearchDepth: tavilySettings.defaultSearchDepth,
        maxResults: tavilySettings.maxResults,
        includeDomains: tavilySettings.includeDomains,
        excludeDomains: tavilySettings.excludeDomains,
        cacheTTLSeconds: tavilySettings.cacheTTLSeconds,
      });
      setTavilyModified(false);
    }
  };

  // Branding handlers
  const handleSaveBranding = async () => {
    if (!editedBranding || !brandingModified) return;

    setSavingSettings(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'branding', settings: editedBranding }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save branding settings');
      }

      const data = await response.json();
      setBrandingSettings(data.branding);
      setBrandingModified(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save branding settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetBranding = () => {
    if (brandingSettings) {
      setEditedBranding({
        botName: brandingSettings.botName,
        botIcon: brandingSettings.botIcon,
      });
      setBrandingModified(false);
    }
  };

  // Reranker handlers
  const handleSaveReranker = async () => {
    if (!editedReranker || !rerankerModified) return;

    setSavingSettings(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'reranker', settings: editedReranker }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save reranker settings');
      }

      const data = await response.json();
      setRerankerSettings(data.reranker);
      setRerankerModified(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save reranker settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetReranker = () => {
    if (rerankerSettings) {
      setEditedReranker({
        enabled: rerankerSettings.enabled,
        provider: rerankerSettings.provider,
        topKForReranking: rerankerSettings.topKForReranking,
        minRerankerScore: rerankerSettings.minRerankerScore,
        cacheTTLSeconds: rerankerSettings.cacheTTLSeconds,
      });
      setRerankerModified(false);
    }
  };

  // Utility functions
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
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
            fuzzyMatch(docSearchTerm, doc.categories?.map(c => c.name).join(' ') || ''),
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
          case 'chunkCount':
            aVal = a.chunkCount;
            bVal = b.chunkCount;
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
  const handleDocSort = (key: keyof GlobalDocument) => {
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
  const SortableDocHeader = ({ columnKey, label, className = '' }: { columnKey: keyof GlobalDocument; label: string; className?: string }) => {
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

  if (docLoading && userLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-500">
                  Manage documents and users
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'documents'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText size={16} className="inline mr-2" />
              Documents
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'categories'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <FolderOpen size={16} className="inline mr-2" />
              Categories
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'users'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users size={16} className="inline mr-2" />
              Users
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Settings size={16} className="inline mr-2" />
              Settings
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'stats'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <BarChart3 size={16} className="inline mr-2" />
              Stats
            </button>
          </nav>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-3">
            <AlertCircle size={20} />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              &times;
            </button>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="px-6 py-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Knowledge Base Documents</h2>
                  <p className="text-sm text-gray-500">
                    {docSearchTerm ? `${filteredAndSortedDocs.length} of ${documents.length}` : documents.length} documents, {totalChunks} chunks indexed
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    disabled={refreshingAll || documents.length === 0}
                    loading={refreshingAll}
                    onClick={handleRefreshAll}
                    title="Clear cache and reindex all documents"
                  >
                    <RefreshCw size={18} className={`mr-2 ${refreshingAll ? 'animate-spin' : ''}`} />
                    {refreshingAll ? 'Refreshing...' : 'Refresh All'}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.webp,.gif"
                    onChange={handleFileSelect}
                    disabled={uploading}
                    className="hidden"
                  />
                  <Button
                    disabled={uploading}
                    loading={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={18} className="mr-2" />
                    {uploadProgress || 'Upload Document'}
                  </Button>
                </div>
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
                  Upload PDF documents to build your policy knowledge base
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
                      <th className="px-6 py-3 font-medium">Categories</th>
                      <SortableDocHeader columnKey="size" label="Size" />
                      <SortableDocHeader columnKey="chunkCount" label="Chunks" />
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
                            <FileText className="w-5 h-5 text-blue-600" />
                            <span className="font-medium text-gray-900">{doc.filename}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {doc.isGlobal && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                                <Globe size={10} />
                                Global
                              </span>
                            )}
                            {doc.categories && doc.categories.length > 0 ? (
                              doc.categories.map(cat => (
                                <span
                                  key={cat.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full"
                                >
                                  <Tag size={10} />
                                  {cat.name}
                                </span>
                              ))
                            ) : !doc.isGlobal ? (
                              <span className="text-gray-400 text-xs italic">Uncategorized</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {formatFileSize(doc.size)}
                        </td>
                        <td className="px-6 py-4 text-gray-600">{doc.chunkCount}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
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
                        <td className="px-6 py-4 text-gray-600">
                          {formatDate(doc.uploadedAt)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditDoc(doc)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Edit categories"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleReindex(doc.id)}
                              disabled={reindexing === doc.id}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
                              title="Reindex"
                            >
                              {reindexing === doc.id ? (
                                <Spinner size="sm" />
                              ) : (
                                <RefreshCw size={16} />
                              )}
                            </button>
                            <button
                              onClick={() => setDeleteDoc(doc)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete"
                            >
                              <Trash2 size={16} />
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

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="px-6 py-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Document Categories</h2>
                  <p className="text-sm text-gray-500">
                    {categories.length} categories defined
                  </p>
                </div>
                <Button onClick={() => setShowAddCategory(true)}>
                  <Plus size={18} className="mr-2" />
                  Add Category
                </Button>
              </div>
            </div>

            {categoryLoading ? (
              <div className="px-6 py-12 flex justify-center">
                <Spinner size="lg" />
              </div>
            ) : categories.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No categories yet</h3>
                <p className="text-gray-500 mb-4">
                  Create categories to organize documents and control user access
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-left text-sm text-gray-600">
                    <tr>
                      <th className="px-6 py-3 font-medium">Category</th>
                      <th className="px-6 py-3 font-medium">Slug</th>
                      <th className="px-6 py-3 font-medium">Documents</th>
                      <th className="px-6 py-3 font-medium">Super Users</th>
                      <th className="px-6 py-3 font-medium">Subscribers</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {categories.map((cat) => (
                      <tr key={cat.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <FolderOpen className="w-5 h-5 text-blue-600" />
                            <div>
                              <span className="font-medium text-gray-900">{cat.name}</span>
                              {cat.description && (
                                <p className="text-sm text-gray-500">{cat.description}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600 font-mono text-sm">
                          {cat.slug}
                        </td>
                        <td className="px-6 py-4 text-gray-600">{cat.documentCount}</td>
                        <td className="px-6 py-4 text-gray-600">{cat.superUserCount}</td>
                        <td className="px-6 py-4 text-gray-600">{cat.subscriberCount}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditCategory(cat)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Edit"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => setDeleteCategory(cat)}
                              disabled={cat.documentCount > 0}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                              title={cat.documentCount > 0 ? 'Remove documents first' : 'Delete'}
                            >
                              <Trash2 size={16} />
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

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="px-6 py-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Allowed Users</h2>
                  <p className="text-sm text-gray-500">
                    {users.length} users with access
                  </p>
                </div>
                <Button onClick={() => setShowAddUser(true)}>
                  <UserPlus size={18} className="mr-2" />
                  Add User
                </Button>
              </div>
            </div>

            {users.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No users yet</h3>
                <p className="text-gray-500 mb-4">
                  Add users to grant them access to the application
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-left text-sm text-gray-600">
                    <tr>
                      <th className="px-6 py-3 font-medium">User</th>
                      <th className="px-6 py-3 font-medium">Role</th>
                      <th className="px-6 py-3 font-medium">Categories</th>
                      <th className="px-6 py-3 font-medium">Added</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {users.map((user) => (
                      <tr key={user.email} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              user.role === 'admin' ? 'bg-purple-100' :
                              user.role === 'superuser' ? 'bg-orange-100' : 'bg-gray-100'
                            }`}>
                              {user.role === 'admin' ? (
                                <Shield size={16} className="text-purple-600" />
                              ) : user.role === 'superuser' ? (
                                <UserPlus size={16} className="text-orange-600" />
                              ) : (
                                <User size={16} className="text-gray-600" />
                              )}
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
                          <span
                            className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                              user.role === 'admin'
                                ? 'bg-purple-100 text-purple-700'
                                : user.role === 'superuser'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {user.role === 'superuser' ? 'super user' : user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {user.role === 'admin' ? (
                              <span className="text-gray-400 text-xs italic">All access</span>
                            ) : user.role === 'superuser' ? (
                              user.assignedCategories && user.assignedCategories.length > 0 ? (
                                user.assignedCategories.map(cat => (
                                  <span
                                    key={cat.categoryId}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full"
                                  >
                                    <FolderOpen size={10} />
                                    {cat.categoryName}
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-400 text-xs italic">No categories assigned</span>
                              )
                            ) : (
                              user.subscriptions && user.subscriptions.length > 0 ? (
                                user.subscriptions.map(sub => (
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
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-400 text-xs italic">No subscriptions</span>
                              )
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {formatDate(user.addedAt)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {user.role !== 'admin' && (
                              <button
                                onClick={() => handleManageUserSubs(user)}
                                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                                title={user.role === 'superuser' ? 'Manage assigned categories' : 'Manage subscriptions'}
                              >
                                <FolderOpen size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => setEditingUser(user)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Change role"
                            >
                              <Shield size={16} />
                            </button>
                            <button
                              onClick={() => setDeleteUser(user)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Remove user"
                            >
                              <Trash2 size={16} />
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

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="flex gap-6">
            {/* Settings Navigation */}
            <div className="w-48 shrink-0">
              <nav className="bg-white rounded-lg border shadow-sm p-2 space-y-1">
                <button
                  onClick={() => setSettingsSection('prompt')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    settingsSection === 'prompt'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  System Prompt
                </button>
                <button
                  onClick={() => setSettingsSection('llm')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    settingsSection === 'llm'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  LLM Settings
                </button>
                <button
                  onClick={() => setSettingsSection('rag')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    settingsSection === 'rag'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  RAG Settings
                </button>
                <button
                  onClick={() => setSettingsSection('acronyms')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    settingsSection === 'acronyms'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Acronym Mappings
                </button>
                <button
                  onClick={() => setSettingsSection('tavily')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    settingsSection === 'tavily'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Web Search
                </button>
                <button
                  onClick={() => setSettingsSection('branding')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    settingsSection === 'branding'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Branding
                </button>
                <button
                  onClick={() => setSettingsSection('reranker')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    settingsSection === 'reranker'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Reranker
                </button>
              </nav>
            </div>

            {/* Settings Content */}
            <div className="flex-1">
              {/* System Prompt Section */}
              {settingsSection === 'prompt' && (
                <div className="bg-white rounded-lg border shadow-sm">
                  <div className="px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-semibold text-gray-900">System Prompt</h2>
                        <p className="text-sm text-gray-500">
                          Define the AI assistant&apos;s behavior and instructions
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {promptModified && (
                          <Button variant="secondary" onClick={handleResetPrompt} disabled={savingPrompt}>
                            Reset
                          </Button>
                        )}
                        <Button onClick={handleSavePrompt} disabled={!promptModified || savingPrompt} loading={savingPrompt}>
                          <Save size={18} className="mr-2" />
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                  {promptLoading ? (
                    <div className="px-6 py-12 flex justify-center"><Spinner size="lg" /></div>
                  ) : (
                    <div className="p-6">
                      <textarea
                        value={editedPrompt}
                        onChange={(e) => handlePromptChange(e.target.value)}
                        rows={16}
                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                        placeholder="Enter the system prompt..."
                      />
                      {systemPrompt && (
                        <p className="mt-2 text-xs text-gray-500">
                          Last updated: {formatDate(systemPrompt.updatedAt)} by {systemPrompt.updatedBy}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* LLM Settings Section */}
              {settingsSection === 'llm' && (
                <div className="space-y-4">
                  {/* Model Presets Card */}
                  <div className="bg-white rounded-lg border shadow-sm">
                    <div className="px-6 py-4 border-b">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="font-semibold text-gray-900">Quick Presets</h2>
                          <p className="text-sm text-gray-500">Apply recommended model + RAG configurations</p>
                        </div>
                        <Button
                          variant="secondary"
                          onClick={() => setShowRestoreConfirm(true)}
                          disabled={restoringDefaults || applyingPreset}
                          className="text-orange-600 border-orange-300 hover:bg-orange-50"
                        >
                          <RefreshCw size={16} className="mr-2" />
                          Restore All Defaults
                        </Button>
                      </div>
                    </div>
                    <div className="p-6">
                      {/* Provider & Services Status */}
                      {!providersLoading && (Object.keys(providerStatus).length > 0 || Object.keys(serviceStatus).length > 0) && (
                        <div className="mb-4 space-y-3">
                          {/* LLM Providers */}
                          <div>
                            <div className="text-xs font-medium text-gray-500 mb-1.5">LLM Providers</div>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(providerStatus).map(([provider, status]) => (
                                <div
                                  key={provider}
                                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                    status.available
                                      ? 'bg-green-100 text-green-800'
                                      : status.configured
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}
                                  title={status.error || (status.available ? 'Connected' : 'Not available')}
                                >
                                  <span className={`w-2 h-2 rounded-full mr-1.5 ${
                                    status.available
                                      ? 'bg-green-500'
                                      : status.configured
                                      ? 'bg-yellow-500'
                                      : 'bg-gray-400'
                                  }`} />
                                  {provider.charAt(0).toUpperCase() + provider.slice(1)}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Services (Embedding, OCR, Audio) */}
                          {Object.keys(serviceStatus).length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-gray-500 mb-1.5">Services</div>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(serviceStatus).map(([key, service]) => (
                                  <div
                                    key={key}
                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                      service.available
                                        ? 'bg-green-100 text-green-800'
                                        : service.configured
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}
                                    title={`${service.model} (${service.provider})${service.error ? ` - ${service.error}` : ''}`}
                                  >
                                    <span className={`w-2 h-2 rounded-full mr-1.5 ${
                                      service.available
                                        ? 'bg-green-500'
                                        : service.configured
                                        ? 'bg-yellow-500'
                                        : 'bg-gray-400'
                                    }`} />
                                    {service.name}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {modelPresets.map((preset) => {
                          const provider = getModelProvider(preset.model);
                          const status = providerStatus[provider];
                          const available = status?.available ?? true;
                          const configured = status?.configured ?? true;

                          return (
                            <div
                              key={preset.id}
                              className={`relative p-4 rounded-lg border-2 transition-all ${
                                !available
                                  ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                                  : editedLlm?.model === preset.model
                                  ? 'border-blue-500 bg-blue-50 cursor-pointer'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
                              }`}
                              onClick={() => available && !applyingPreset && handleApplyPreset(preset.id)}
                              title={!available ? (status?.error || 'Provider not available') : undefined}
                            >
                              {/* Status badges */}
                              <div className="absolute top-2 right-2 flex gap-1">
                                {editedLlm?.model === preset.model && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                    Active
                                  </span>
                                )}
                                {!providersLoading && (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    available
                                      ? 'bg-green-100 text-green-700'
                                      : configured
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-gray-100 text-gray-500'
                                  }`}>
                                    {available ? '✓' : configured ? '!' : '—'}
                                  </span>
                                )}
                              </div>
                              <h3 className="font-medium text-gray-900 pr-16">{preset.name}</h3>
                              <p className="text-sm text-gray-500 mt-1">{preset.description}</p>
                              <div className="mt-3 text-xs text-gray-400 space-y-1">
                                <div>Temp: {preset.llmSettings.temperature} | Tokens: {preset.llmSettings.maxTokens}</div>
                                <div>Chunks: {preset.ragSettings.topKChunks}/{preset.ragSettings.maxContextChunks}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {applyingPreset && (
                        <div className="mt-4 flex items-center justify-center text-sm text-gray-500">
                          <Spinner size="sm" /> <span className="ml-2">Applying preset...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Manual LLM Settings Card */}
                  <div className="bg-white rounded-lg border shadow-sm">
                    <div className="px-6 py-4 border-b">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="font-semibold text-gray-900">LLM Settings</h2>
                          <p className="text-sm text-gray-500">Fine-tune the language model parameters manually</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {llmModified && (
                            <Button variant="secondary" onClick={handleResetLlm} disabled={savingSettings}>
                              Reset
                            </Button>
                          )}
                          <Button onClick={handleSaveLlm} disabled={!llmModified || savingSettings} loading={savingSettings}>
                            <Save size={18} className="mr-2" />
                            Save
                          </Button>
                        </div>
                      </div>
                    </div>
                    {settingsLoading ? (
                      <div className="px-6 py-12 flex justify-center"><Spinner size="lg" /></div>
                    ) : editedLlm && (
                      <div className="p-6 space-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                        <select
                          value={editedLlm.model}
                          onChange={(e) => handleLlmChange('model', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          {availableModels.map((model) => {
                            const provider = model.provider || getModelProvider(model.id);
                            const status = providerStatus[provider];
                            const available = status?.available ?? true;
                            return (
                              <option
                                key={model.id}
                                value={model.id}
                                disabled={!available}
                              >
                                {model.name} {!available ? '(unavailable)' : ''}
                              </option>
                            );
                          })}
                        </select>
                        <p className="mt-1 text-xs text-gray-500">
                          {availableModels.find(m => m.id === editedLlm.model)?.description}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Temperature: {editedLlm.temperature}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="2"
                          step="0.1"
                          value={editedLlm.temperature}
                          onChange={(e) => handleLlmChange('temperature', parseFloat(e.target.value))}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>0 (Deterministic)</span>
                          <span>2 (Creative)</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Max Tokens</label>
                        <input
                          type="number"
                          min="100"
                          max="16000"
                          value={editedLlm.maxTokens}
                          onChange={(e) => handleLlmChange('maxTokens', parseInt(e.target.value) || 2000)}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">Maximum length of generated responses (100-16000)</p>
                      </div>
                      {llmSettings && (
                          <p className="text-xs text-gray-500 pt-4 border-t">
                            Last updated: {formatDate(llmSettings.updatedAt)} by {llmSettings.updatedBy}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* RAG Settings Section */}
              {settingsSection === 'rag' && (
                <div className="bg-white rounded-lg border shadow-sm">
                  <div className="px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-semibold text-gray-900">RAG Settings</h2>
                        <p className="text-sm text-gray-500">Configure retrieval and chunking parameters</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {ragModified && (
                          <Button variant="secondary" onClick={handleResetRag} disabled={savingSettings}>
                            Reset
                          </Button>
                        )}
                        <Button onClick={handleSaveRag} disabled={!ragModified || savingSettings} loading={savingSettings}>
                          <Save size={18} className="mr-2" />
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                  {settingsLoading ? (
                    <div className="px-6 py-12 flex justify-center"><Spinner size="lg" /></div>
                  ) : editedRag && (
                    <div className="p-6 space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Top K Chunks</label>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={editedRag.topKChunks}
                            onChange={(e) => handleRagChange('topKChunks', parseInt(e.target.value) || 15)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="mt-1 text-xs text-gray-500">Chunks retrieved per query (1-50)</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Max Context Chunks</label>
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={editedRag.maxContextChunks}
                            onChange={(e) => handleRagChange('maxContextChunks', parseInt(e.target.value) || 12)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="mt-1 text-xs text-gray-500">Max chunks sent to LLM (1-30)</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Similarity Threshold: {editedRag.similarityThreshold}
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={editedRag.similarityThreshold}
                            onChange={(e) => handleRagChange('similarityThreshold', parseFloat(e.target.value))}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>0 (All)</span>
                            <span>1 (Exact)</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Cache TTL (seconds)</label>
                          <input
                            type="number"
                            min="0"
                            max="86400"
                            value={editedRag.cacheTTLSeconds}
                            onChange={(e) => handleRagChange('cacheTTLSeconds', parseInt(e.target.value) || 3600)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="mt-1 text-xs text-gray-500">Response cache duration (0-86400)</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Chunk Size</label>
                          <input
                            type="number"
                            min="100"
                            max="2000"
                            value={editedRag.chunkSize}
                            onChange={(e) => handleRagChange('chunkSize', parseInt(e.target.value) || 500)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="mt-1 text-xs text-gray-500">Characters per chunk (100-2000)</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Chunk Overlap</label>
                          <input
                            type="number"
                            min="0"
                            max={editedRag.chunkSize / 2}
                            value={editedRag.chunkOverlap}
                            onChange={(e) => handleRagChange('chunkOverlap', parseInt(e.target.value) || 50)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="mt-1 text-xs text-gray-500">Overlap between chunks</p>
                        </div>
                      </div>
                      <div className="flex gap-6 pt-4 border-t">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editedRag.queryExpansionEnabled}
                            onChange={(e) => handleRagChange('queryExpansionEnabled', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Query Expansion (acronyms)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editedRag.cacheEnabled}
                            onChange={(e) => handleRagChange('cacheEnabled', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Response Caching</span>
                        </label>
                      </div>
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          Chunk size/overlap changes only affect new documents. Use &quot;Refresh All&quot; on the Documents tab to reindex existing documents.
                        </p>
                      </div>
                      {ragSettings && (
                        <p className="text-xs text-gray-500 pt-4 border-t">
                          Last updated: {formatDate(ragSettings.updatedAt)} by {ragSettings.updatedBy}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Acronym Mappings Section */}
              {settingsSection === 'acronyms' && (
                <div className="bg-white rounded-lg border shadow-sm">
                  <div className="px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-semibold text-gray-900">Acronym Mappings</h2>
                        <p className="text-sm text-gray-500">Define acronym expansions for query enhancement</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {acronymsModified && (
                          <Button variant="secondary" onClick={handleResetAcronyms} disabled={savingSettings}>
                            Reset
                          </Button>
                        )}
                        <Button onClick={handleSaveAcronyms} disabled={!acronymsModified || savingSettings} loading={savingSettings}>
                          <Save size={18} className="mr-2" />
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                  {settingsLoading ? (
                    <div className="px-6 py-12 flex justify-center"><Spinner size="lg" /></div>
                  ) : (
                    <div className="p-6">
                      <textarea
                        value={editedAcronyms}
                        onChange={(e) => handleAcronymsChange(e.target.value)}
                        rows={12}
                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                        placeholder="ea=enterprise architecture&#10;it=information technology"
                      />
                      <p className="mt-2 text-sm text-gray-500">
                        One mapping per line in format: acronym=expansion. Used to expand queries for better retrieval.
                      </p>
                      {acronymMappings && (
                        <p className="mt-4 text-xs text-gray-500">
                          Last updated: {formatDate(acronymMappings.updatedAt)} by {acronymMappings.updatedBy}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Web Search (Tavily) Section */}
              {settingsSection === 'tavily' && (
                <div className="bg-white rounded-lg border shadow-sm">
                  <div className="px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-semibold text-gray-900">Web Search (Tavily)</h2>
                        <p className="text-sm text-gray-500">Configure web search capabilities for real-time information</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {tavilyModified && (
                          <Button variant="secondary" onClick={handleResetTavily} disabled={savingSettings}>
                            Reset
                          </Button>
                        )}
                        <Button onClick={handleSaveTavily} disabled={!tavilyModified || savingSettings} loading={savingSettings}>
                          <Save size={18} className="mr-2" />
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                  {settingsLoading ? (
                    <div className="px-6 py-12 flex justify-center"><Spinner size="lg" /></div>
                  ) : editedTavily ? (
                    <div className="p-6 space-y-6">
                      {/* Enable/Disable Toggle */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="font-medium text-gray-900">Enable Web Search</label>
                          <p className="text-sm text-gray-500">Allow the assistant to search the web for current information</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={editedTavily.enabled}
                          onChange={(e) => {
                            setEditedTavily({ ...editedTavily, enabled: e.target.checked });
                            setTavilyModified(true);
                          }}
                          className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </div>

                      {/* API Key */}
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Tavily API Key</label>
                        <input
                          type="password"
                          value={editedTavily.apiKey}
                          onChange={(e) => {
                            setEditedTavily({ ...editedTavily, apiKey: e.target.value });
                            setTavilyModified(true);
                          }}
                          placeholder="tvly-xxxxxxxxxxxxx"
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Get your API key from{' '}
                          <a href="https://tavily.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            tavily.com
                          </a>
                        </p>
                      </div>

                      {/* Settings Grid */}
                      <div className="grid grid-cols-2 gap-6">
                        {/* Default Topic */}
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">Default Topic</label>
                          <select
                            value={editedTavily.defaultTopic}
                            onChange={(e) => {
                              setEditedTavily({ ...editedTavily, defaultTopic: e.target.value as 'general' | 'news' | 'finance' });
                              setTavilyModified(true);
                            }}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="general">General</option>
                            <option value="news">News</option>
                            <option value="finance">Finance</option>
                          </select>
                        </div>

                        {/* Search Depth */}
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">Search Depth</label>
                          <select
                            value={editedTavily.defaultSearchDepth}
                            onChange={(e) => {
                              setEditedTavily({ ...editedTavily, defaultSearchDepth: e.target.value as 'basic' | 'advanced' });
                              setTavilyModified(true);
                            }}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="basic">Basic (1 credit/search)</option>
                            <option value="advanced">Advanced (2 credits/search)</option>
                          </select>
                        </div>

                        {/* Max Results */}
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">Max Results</label>
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={editedTavily.maxResults}
                            onChange={(e) => {
                              setEditedTavily({ ...editedTavily, maxResults: parseInt(e.target.value) || 5 });
                              setTavilyModified(true);
                            }}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <p className="mt-1 text-xs text-gray-500">Number of search results (1-20)</p>
                        </div>

                        {/* Cache TTL */}
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">Cache Duration</label>
                          <input
                            type="number"
                            min="60"
                            max="2592000"
                            value={editedTavily.cacheTTLSeconds}
                            onChange={(e) => {
                              setEditedTavily({ ...editedTavily, cacheTTLSeconds: parseInt(e.target.value) || 1800 });
                              setTavilyModified(true);
                            }}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            {Math.floor(editedTavily.cacheTTLSeconds / 60)} minutes (60s - 2,592,000s)
                          </p>
                        </div>
                      </div>

                      {/* Include Domains */}
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Include Domains (Optional)</label>
                        <textarea
                          value={editedTavily.includeDomains.join('\n')}
                          onChange={(e) => {
                            setEditedTavily({
                              ...editedTavily,
                              includeDomains: e.target.value.split('\n').filter(d => d.trim()),
                            });
                            setTavilyModified(true);
                          }}
                          rows={3}
                          placeholder="gov.gd&#10;.gov"
                          className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                        />
                        <p className="mt-1 text-xs text-gray-500">One domain per line. Only search these domains.</p>
                      </div>

                      {/* Exclude Domains */}
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Exclude Domains (Optional)</label>
                        <textarea
                          value={editedTavily.excludeDomains.join('\n')}
                          onChange={(e) => {
                            setEditedTavily({
                              ...editedTavily,
                              excludeDomains: e.target.value.split('\n').filter(d => d.trim()),
                            });
                            setTavilyModified(true);
                          }}
                          rows={3}
                          placeholder="reddit.com&#10;twitter.com"
                          className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                        />
                        <p className="mt-1 text-xs text-gray-500">One domain per line. Exclude these domains from results.</p>
                      </div>

                      {/* Last Updated */}
                      {tavilySettings && (
                        <p className="text-xs text-gray-500">
                          Last updated: {formatDate(tavilySettings.updatedAt)} by {tavilySettings.updatedBy}
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {/* Branding Section */}
              {settingsSection === 'branding' && (
                <div className="bg-white rounded-lg border shadow-sm">
                  <div className="px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-semibold text-gray-900">Branding</h2>
                        <p className="text-sm text-gray-500">Customize the bot&apos;s name and icon</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {brandingModified && (
                          <Button variant="secondary" onClick={handleResetBranding} disabled={savingSettings}>
                            Reset
                          </Button>
                        )}
                        <Button onClick={handleSaveBranding} disabled={!brandingModified || savingSettings} loading={savingSettings}>
                          <Save size={18} className="mr-2" />
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                  {settingsLoading ? (
                    <div className="px-6 py-12 flex justify-center"><Spinner size="lg" /></div>
                  ) : editedBranding ? (
                    <div className="p-6 space-y-6">
                      {/* Bot Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Bot Name</label>
                        <input
                          type="text"
                          value={editedBranding.botName}
                          onChange={(e) => {
                            setEditedBranding({ ...editedBranding, botName: e.target.value });
                            setBrandingModified(true);
                          }}
                          placeholder="Policy Bot"
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">This name appears in the sidebar header</p>
                      </div>

                      {/* Bot Icon */}
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">Bot Icon</label>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                          {BRANDING_ICONS.map(({ key, label, Icon }) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setEditedBranding({ ...editedBranding, botIcon: key });
                                setBrandingModified(true);
                              }}
                              className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                                editedBranding.botIcon === key
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600'
                              }`}
                            >
                              <Icon size={24} />
                              <span className="mt-1 text-xs">{label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Preview */}
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">Preview</label>
                        <div className="inline-flex items-center gap-2 px-4 py-3 bg-gray-100 rounded-lg">
                          {(() => {
                            const iconData = BRANDING_ICONS.find(i => i.key === editedBranding.botIcon);
                            if (iconData) {
                              const IconComponent = iconData.Icon;
                              return <IconComponent size={24} className="text-blue-600" />;
                            }
                            return <ScrollText size={24} className="text-blue-600" />;
                          })()}
                          <span className="text-xl font-bold text-gray-900">{editedBranding.botName || 'Policy Bot'}</span>
                        </div>
                      </div>

                      {/* Last Updated */}
                      {brandingSettings?.updatedAt && (
                        <p className="text-xs text-gray-500">
                          Last updated: {formatDate(brandingSettings.updatedAt)} by {brandingSettings.updatedBy}
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {/* Reranker Section */}
              {settingsSection === 'reranker' && (
                <div className="bg-white rounded-lg border shadow-sm">
                  <div className="px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-semibold text-gray-900">Reranker Settings</h2>
                        <p className="text-sm text-gray-500">Configure document reranking for improved RAG quality</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {rerankerModified && (
                          <Button variant="secondary" onClick={handleResetReranker} disabled={savingSettings}>
                            Reset
                          </Button>
                        )}
                        <Button onClick={handleSaveReranker} disabled={!rerankerModified || savingSettings} loading={savingSettings}>
                          <Save size={18} className="mr-2" />
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                  {settingsLoading ? (
                    <div className="px-6 py-12 flex justify-center"><Spinner size="lg" /></div>
                  ) : editedReranker ? (
                    <div className="p-6 space-y-6">
                      {/* Enable/Disable Toggle */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="font-medium text-gray-900">Enable Reranker</label>
                          <p className="text-sm text-gray-500">Rerank retrieved chunks for better relevance ordering</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={editedReranker.enabled}
                          onChange={(e) => {
                            setEditedReranker({ ...editedReranker, enabled: e.target.checked });
                            setRerankerModified(true);
                          }}
                          className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </div>

                      {/* Provider Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Reranker Provider</label>
                        <select
                          value={editedReranker.provider}
                          onChange={(e) => {
                            setEditedReranker({ ...editedReranker, provider: e.target.value as 'cohere' | 'local' });
                            setRerankerModified(true);
                          }}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="cohere">Cohere API (Fast, requires API key)</option>
                          <option value="local">Local (Free, slower first load)</option>
                        </select>
                        <p className="mt-1 text-xs text-gray-500">
                          {editedReranker.provider === 'cohere'
                            ? 'Uses Cohere rerank-english-v3.0 model. Requires COHERE_API_KEY in environment.'
                            : 'Uses local all-MiniLM-L6-v2 model with semantic similarity. First load downloads model.'}
                        </p>
                      </div>

                      {/* Settings Grid */}
                      <div className="grid grid-cols-2 gap-6">
                        {/* Top K for Reranking */}
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">Top K for Reranking</label>
                          <input
                            type="number"
                            min="5"
                            max="100"
                            value={editedReranker.topKForReranking}
                            onChange={(e) => {
                              setEditedReranker({ ...editedReranker, topKForReranking: parseInt(e.target.value) || 50 });
                              setRerankerModified(true);
                            }}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <p className="mt-1 text-xs text-gray-500">Number of chunks to rerank (5-100)</p>
                        </div>

                        {/* Min Score Threshold */}
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">Min Score Threshold</label>
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.05"
                            value={editedReranker.minRerankerScore}
                            onChange={(e) => {
                              setEditedReranker({ ...editedReranker, minRerankerScore: parseFloat(e.target.value) || 0.3 });
                              setRerankerModified(true);
                            }}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <p className="mt-1 text-xs text-gray-500">Chunks below this score are filtered (0-1)</p>
                        </div>

                        {/* Cache TTL */}
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">Cache Duration</label>
                          <input
                            type="number"
                            min="60"
                            max="86400"
                            value={editedReranker.cacheTTLSeconds}
                            onChange={(e) => {
                              setEditedReranker({ ...editedReranker, cacheTTLSeconds: parseInt(e.target.value) || 3600 });
                              setRerankerModified(true);
                            }}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            {Math.floor(editedReranker.cacheTTLSeconds / 60)} minutes (60s - 86,400s)
                          </p>
                        </div>
                      </div>

                      {/* Last Updated */}
                      {rerankerSettings?.updatedAt && (
                        <p className="text-xs text-gray-500">
                          Last updated: {formatDate(rerankerSettings.updatedAt)} by {rerankerSettings.updatedBy}
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            {statsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : systemStats ? (
              <>
                {/* Database Stats */}
                <div className="bg-white rounded-lg border shadow-sm">
                  <div className="px-6 py-4 border-b flex items-center gap-3">
                    <Database className="text-blue-600" size={20} />
                    <h2 className="font-semibold text-gray-900">Database Statistics</h2>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      {/* Users */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-gray-900">{systemStats.database.users.total}</div>
                        <div className="text-sm text-gray-500">Total Users</div>
                        <div className="mt-2 text-xs text-gray-400">
                          {systemStats.database.users.admins} admins, {systemStats.database.users.superUsers} super users
                        </div>
                      </div>
                      {/* Categories */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-gray-900">{systemStats.database.categories.total}</div>
                        <div className="text-sm text-gray-500">Categories</div>
                        <div className="mt-2 text-xs text-gray-400">
                          {systemStats.database.categories.withDocuments} with documents
                        </div>
                      </div>
                      {/* Threads */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-gray-900">{systemStats.database.threads.total}</div>
                        <div className="text-sm text-gray-500">Threads</div>
                        <div className="mt-2 text-xs text-gray-400">
                          {systemStats.database.threads.totalMessages} messages
                        </div>
                      </div>
                      {/* Documents */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-gray-900">{systemStats.database.documents.total}</div>
                        <div className="text-sm text-gray-500">Documents</div>
                        <div className="mt-2 text-xs text-gray-400">
                          {systemStats.database.documents.totalChunks} chunks indexed
                        </div>
                      </div>
                    </div>
                    {/* Document Status */}
                    <div className="mt-6 pt-4 border-t">
                      <div className="text-sm font-medium text-gray-700 mb-2">Document Status</div>
                      <div className="flex gap-4">
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                          {systemStats.database.documents.byStatus.ready} ready
                        </span>
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                          {systemStats.database.documents.byStatus.processing} processing
                        </span>
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                          {systemStats.database.documents.byStatus.error} error
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ChromaDB Stats */}
                <div className="bg-white rounded-lg border shadow-sm">
                  <div className="px-6 py-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Database className="text-purple-600" size={20} />
                      <h2 className="font-semibold text-gray-900">ChromaDB Vector Store</h2>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                      systemStats.chroma.connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {systemStats.chroma.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <div className="p-6">
                    <div className="text-2xl font-bold text-gray-900 mb-4">
                      {systemStats.chroma.totalVectors.toLocaleString()} total vectors
                    </div>
                    {systemStats.chroma.collections.length > 0 && (
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-2">Collections</div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {systemStats.chroma.collections.map((col) => (
                            <div key={col.name} className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
                              <div className="font-medium text-gray-900 truncate">{col.name}</div>
                              <div className="text-xs text-gray-500">{col.documentCount.toLocaleString()} vectors</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* File Storage Stats */}
                <div className="bg-white rounded-lg border shadow-sm">
                  <div className="px-6 py-4 border-b flex items-center gap-3">
                    <HardDrive className="text-green-600" size={20} />
                    <h2 className="font-semibold text-gray-900">File Storage</h2>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-lg font-bold text-gray-900">{systemStats.storage.dataDir.totalSizeMB} MB</div>
                        <div className="text-sm text-gray-500">Total Data Size</div>
                        <div className="mt-1 text-xs text-gray-400 truncate" title={systemStats.storage.dataDir.path}>
                          {systemStats.storage.dataDir.path}
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-lg font-bold text-gray-900">{systemStats.storage.globalDocsDir.totalSizeMB} MB</div>
                        <div className="text-sm text-gray-500">Global Documents</div>
                        <div className="mt-1 text-xs text-gray-400">
                          {systemStats.storage.globalDocsDir.fileCount} files
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-lg font-bold text-gray-900">{systemStats.storage.threadsDir.totalUploadSizeMB} MB</div>
                        <div className="text-sm text-gray-500">Thread Uploads</div>
                        <div className="mt-1 text-xs text-gray-400">
                          {systemStats.storage.threadsDir.userCount} users
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Recent Threads */}
                  <div className="bg-white rounded-lg border shadow-sm">
                    <div className="px-6 py-4 border-b">
                      <h2 className="font-semibold text-gray-900">Recent Threads</h2>
                    </div>
                    <div className="divide-y max-h-80 overflow-y-auto">
                      {systemStats.recentActivity.recentThreads.length === 0 ? (
                        <div className="px-6 py-8 text-center text-gray-500 text-sm">No threads yet</div>
                      ) : (
                        systemStats.recentActivity.recentThreads.map((thread) => (
                          <div key={thread.id} className="px-6 py-3">
                            <div className="text-sm font-medium text-gray-900 truncate">{thread.title}</div>
                            <div className="text-xs text-gray-500">
                              {thread.userEmail} - {thread.messageCount} messages
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Recent Documents */}
                  <div className="bg-white rounded-lg border shadow-sm">
                    <div className="px-6 py-4 border-b">
                      <h2 className="font-semibold text-gray-900">Recent Documents</h2>
                    </div>
                    <div className="divide-y max-h-80 overflow-y-auto">
                      {systemStats.recentActivity.recentDocuments.length === 0 ? (
                        <div className="px-6 py-8 text-center text-gray-500 text-sm">No documents yet</div>
                      ) : (
                        systemStats.recentActivity.recentDocuments.map((doc) => (
                          <div key={doc.id} className="px-6 py-3">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-medium text-gray-900 truncate flex-1">{doc.filename}</div>
                              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ml-2 ${
                                doc.status === 'ready' ? 'bg-green-100 text-green-700' :
                                doc.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {doc.status}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">{doc.uploadedBy}</div>
                          </div>
                        ))
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
              <div className="text-center py-12 text-gray-500">Failed to load stats</div>
            )}
          </div>
        )}
      </main>

      {/* Delete Document Modal */}
      <Modal
        isOpen={!!deleteDoc}
        onClose={() => setDeleteDoc(null)}
        title="Delete Document?"
      >
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete &quot;{deleteDoc?.filename}&quot;?
        </p>
        <p className="text-sm text-gray-500 mb-6">
          This will remove the document and all {deleteDoc?.chunkCount} indexed chunks from the knowledge base.
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setDeleteDoc(null)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDeleteDoc}
            loading={deleting}
          >
            Delete
          </Button>
        </div>
      </Modal>

      {/* Upload Document Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setUploadFile(null);
          setUploadCategoryIds([]);
          setUploadIsGlobal(false);
        }}
        title="Upload Document"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              File
            </label>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-gray-700 truncate">{uploadFile?.name}</span>
              <span className="text-xs text-gray-500 ml-auto">
                {uploadFile && formatFileSize(uploadFile.size)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categories
            </label>
            <div className="border border-gray-200 rounded-lg p-2">
              <div className="flex flex-wrap gap-2 mb-2">
                {uploadCategoryIds.length === 0 ? (
                  <span className="text-sm text-gray-500">No categories selected</span>
                ) : (
                  uploadCategoryIds.map(catId => {
                    const cat = categories.find(c => c.id === catId);
                    return cat ? (
                      <span
                        key={catId}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                      >
                        <Tag size={10} />
                        {cat.name}
                        <button
                          type="button"
                          onClick={() => setUploadCategoryIds(ids => ids.filter(id => id !== catId))}
                          className="hover:bg-blue-200 rounded-full p-0.5"
                        >
                          ×
                        </button>
                      </span>
                    ) : null;
                  })
                )}
              </div>
              <select
                value=""
                onChange={(e) => {
                  const catId = parseInt(e.target.value, 10);
                  if (catId && !uploadCategoryIds.includes(catId)) {
                    setUploadCategoryIds([...uploadCategoryIds, catId]);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">Add category...</option>
                {categories
                  .filter(cat => !uploadCategoryIds.includes(cat.id))
                  .map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))
                }
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="uploadIsGlobal"
              checked={uploadIsGlobal}
              onChange={(e) => setUploadIsGlobal(e.target.checked)}
              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <label htmlFor="uploadIsGlobal" className="flex items-center gap-2 text-sm text-gray-700">
              <Globe size={16} className="text-purple-600" />
              Global document (available in all categories)
            </label>
          </div>

          <p className="text-xs text-gray-500">
            {uploadIsGlobal
              ? 'Global documents are indexed into all category collections for universal access.'
              : uploadCategoryIds.length > 0
              ? `This document will be available to users subscribed to the selected ${uploadCategoryIds.length === 1 ? 'category' : 'categories'}.`
              : 'Select categories or mark as global to control document visibility.'}
          </p>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="secondary"
            onClick={() => {
              setShowUploadModal(false);
              setUploadFile(null);
              setUploadCategoryIds([]);
              setUploadIsGlobal(false);
            }}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUploadConfirm}
            loading={uploading}
            disabled={!uploadFile}
          >
            <Upload size={18} className="mr-2" />
            {uploadProgress || 'Upload'}
          </Button>
        </div>
      </Modal>

      {/* Edit Document Modal */}
      <Modal
        isOpen={!!editingDoc}
        onClose={() => setEditingDoc(null)}
        title="Edit Document Categories"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
            <FileText className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-gray-700 truncate font-medium">{editingDoc?.filename}</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categories
            </label>
            <div className="border border-gray-200 rounded-lg p-2">
              <div className="flex flex-wrap gap-2 mb-2">
                {editDocCategoryIds.length === 0 ? (
                  <span className="text-sm text-gray-500">No categories selected</span>
                ) : (
                  editDocCategoryIds.map(catId => {
                    const cat = categories.find(c => c.id === catId);
                    return cat ? (
                      <span
                        key={catId}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                      >
                        <Tag size={10} />
                        {cat.name}
                        <button
                          type="button"
                          onClick={() => setEditDocCategoryIds(ids => ids.filter(id => id !== catId))}
                          className="hover:bg-blue-200 rounded-full p-0.5"
                        >
                          ×
                        </button>
                      </span>
                    ) : null;
                  })
                )}
              </div>
              <select
                value=""
                onChange={(e) => {
                  const catId = parseInt(e.target.value, 10);
                  if (catId && !editDocCategoryIds.includes(catId)) {
                    setEditDocCategoryIds([...editDocCategoryIds, catId]);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">Add category...</option>
                {categories
                  .filter(cat => !editDocCategoryIds.includes(cat.id))
                  .map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))
                }
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="editDocIsGlobal"
              checked={editDocIsGlobal}
              onChange={(e) => setEditDocIsGlobal(e.target.checked)}
              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <label htmlFor="editDocIsGlobal" className="flex items-center gap-2 text-sm text-gray-700">
              <Globe size={16} className="text-purple-600" />
              Global document (available in all categories)
            </label>
          </div>

          <p className="text-xs text-gray-500">
            {editDocIsGlobal
              ? 'This document will be re-indexed into all category collections.'
              : editDocCategoryIds.length > 0
              ? `This document will be re-indexed into the selected ${editDocCategoryIds.length === 1 ? 'category' : 'categories'}.`
              : 'Select categories or mark as global. Changes will trigger re-indexing.'}
          </p>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="secondary"
            onClick={() => setEditingDoc(null)}
            disabled={savingDocChanges}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveDocChanges}
            loading={savingDocChanges}
          >
            <Save size={18} className="mr-2" />
            Save Changes
          </Button>
        </div>
      </Modal>

      {/* Add User Modal */}
      <Modal
        isOpen={showAddUser}
        onClose={() => setShowAddUser(false)}
        title="Add User"
      >
        <form onSubmit={handleAddUser}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="user@example.com"
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name (optional)
              </label>
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={newUserRole}
                onChange={(e) => {
                  setNewUserRole(e.target.value as 'admin' | 'superuser' | 'user');
                  setNewUserSubscriptions([]);
                  setNewUserAssignedCategories([]);
                }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="user">User - Can use chat and upload documents</option>
                <option value="superuser">Super User - Can manage assigned categories</option>
                <option value="admin">Admin - Full access including user management</option>
              </select>
            </div>

            {/* Category selection for users */}
            {newUserRole === 'user' && categories.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subscribe to Categories
                </label>
                <div className="border border-gray-200 rounded-lg p-2">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {newUserSubscriptions.length === 0 ? (
                      <span className="text-sm text-gray-500">No categories selected</span>
                    ) : (
                      newUserSubscriptions.map(catId => {
                        const cat = categories.find(c => c.id === catId);
                        return cat ? (
                          <span
                            key={catId}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                          >
                            <Tag size={10} />
                            {cat.name}
                            <button
                              type="button"
                              onClick={() => setNewUserSubscriptions(ids => ids.filter(id => id !== catId))}
                              className="hover:bg-blue-200 rounded-full p-0.5"
                            >
                              ×
                            </button>
                          </span>
                        ) : null;
                      })
                    )}
                  </div>
                  <select
                    value=""
                    onChange={(e) => {
                      const catId = parseInt(e.target.value, 10);
                      if (catId && !newUserSubscriptions.includes(catId)) {
                        setNewUserSubscriptions([...newUserSubscriptions, catId]);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Add category subscription...</option>
                    {categories
                      .filter(cat => !newUserSubscriptions.includes(cat.id))
                      .map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))
                    }
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  User will have access to documents in these categories.
                </p>
              </div>
            )}

            {/* Category assignment for super users */}
            {newUserRole === 'superuser' && categories.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign Categories to Manage
                </label>
                <div className="border border-gray-200 rounded-lg p-2">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {newUserAssignedCategories.length === 0 ? (
                      <span className="text-sm text-gray-500">No categories assigned</span>
                    ) : (
                      newUserAssignedCategories.map(catId => {
                        const cat = categories.find(c => c.id === catId);
                        return cat ? (
                          <span
                            key={catId}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full"
                          >
                            <FolderOpen size={10} />
                            {cat.name}
                            <button
                              type="button"
                              onClick={() => setNewUserAssignedCategories(ids => ids.filter(id => id !== catId))}
                              className="hover:bg-orange-200 rounded-full p-0.5"
                            >
                              ×
                            </button>
                          </span>
                        ) : null;
                      })
                    )}
                  </div>
                  <select
                    value=""
                    onChange={(e) => {
                      const catId = parseInt(e.target.value, 10);
                      if (catId && !newUserAssignedCategories.includes(catId)) {
                        setNewUserAssignedCategories([...newUserAssignedCategories, catId]);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Assign category...</option>
                    {categories
                      .filter(cat => !newUserAssignedCategories.includes(cat.id))
                      .map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))
                    }
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Super user will be able to manage users subscribed to these categories.
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAddUser(false);
                setNewUserSubscriptions([]);
                setNewUserAssignedCategories([]);
              }}
              disabled={addingUser}
            >
              Cancel
            </Button>
            <Button type="submit" loading={addingUser}>
              Add User
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete User Modal */}
      <Modal
        isOpen={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        title="Remove User?"
      >
        <p className="text-gray-600 mb-4">
          Are you sure you want to remove access for &quot;{deleteUser?.email}&quot;?
        </p>
        <p className="text-sm text-gray-500 mb-6">
          This user will no longer be able to sign in to the application.
        </p>
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setDeleteUser(null)}
            disabled={deletingUser}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDeleteUser}
            loading={deletingUser}
          >
            Remove
          </Button>
        </div>
      </Modal>

      {/* Edit Role Modal */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Change User Role"
      >
        <p className="text-gray-600 mb-4">
          Change role for &quot;{editingUser?.email}&quot;
        </p>
        <div className="space-y-2 mb-6">
          <button
            onClick={() => handleUpdateRole('user')}
            disabled={updatingRole || editingUser?.role === 'user'}
            className={`w-full p-3 text-left border rounded-lg transition-colors ${
              editingUser?.role === 'user'
                ? 'border-blue-500 bg-blue-50'
                : 'hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <User size={20} className="text-gray-600" />
              <div>
                <p className="font-medium text-gray-900">User</p>
                <p className="text-sm text-gray-500">Can use chat and upload documents</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => handleUpdateRole('superuser')}
            disabled={updatingRole || editingUser?.role === 'superuser'}
            className={`w-full p-3 text-left border rounded-lg transition-colors ${
              editingUser?.role === 'superuser'
                ? 'border-orange-500 bg-orange-50'
                : 'hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <UserPlus size={20} className="text-orange-600" />
              <div>
                <p className="font-medium text-gray-900">Super User</p>
                <p className="text-sm text-gray-500">Can manage assigned categories</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => handleUpdateRole('admin')}
            disabled={updatingRole || editingUser?.role === 'admin'}
            className={`w-full p-3 text-left border rounded-lg transition-colors ${
              editingUser?.role === 'admin'
                ? 'border-purple-500 bg-purple-50'
                : 'hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Shield size={20} className="text-purple-600" />
              <div>
                <p className="font-medium text-gray-900">Admin</p>
                <p className="text-sm text-gray-500">Full access including user management</p>
              </div>
            </div>
          </button>
        </div>
        <div className="flex justify-end">
          <Button
            variant="secondary"
            onClick={() => setEditingUser(null)}
            disabled={updatingRole}
          >
            {updatingRole ? <Spinner size="sm" /> : 'Close'}
          </Button>
        </div>
      </Modal>

      {/* Manage User Subscriptions Modal */}
      <Modal
        isOpen={!!managingUserSubs}
        onClose={() => setManagingUserSubs(null)}
        title={managingUserSubs?.role === 'superuser' ? 'Manage Assigned Categories' : 'Manage Subscriptions'}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              managingUserSubs?.role === 'superuser' ? 'bg-orange-100' : 'bg-gray-100'
            }`}>
              {managingUserSubs?.role === 'superuser' ? (
                <UserPlus size={16} className="text-orange-600" />
              ) : (
                <User size={16} className="text-gray-600" />
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">
                {managingUserSubs?.name || managingUserSubs?.email.split('@')[0]}
              </p>
              <p className="text-xs text-gray-500">{managingUserSubs?.email}</p>
            </div>
          </div>

          {managingUserSubs?.role === 'user' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category Subscriptions
              </label>
              <div className="border border-gray-200 rounded-lg p-2">
                <div className="flex flex-wrap gap-2 mb-2">
                  {editUserSubscriptions.length === 0 ? (
                    <span className="text-sm text-gray-500">No subscriptions</span>
                  ) : (
                    editUserSubscriptions.map(catId => {
                      const cat = categories.find(c => c.id === catId);
                      return cat ? (
                        <span
                          key={catId}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                        >
                          <Tag size={10} />
                          {cat.name}
                          <button
                            type="button"
                            onClick={() => setEditUserSubscriptions(ids => ids.filter(id => id !== catId))}
                            className="hover:bg-blue-200 rounded-full p-0.5"
                          >
                            ×
                          </button>
                        </span>
                      ) : null;
                    })
                  )}
                </div>
                <select
                  value=""
                  onChange={(e) => {
                    const catId = parseInt(e.target.value, 10);
                    if (catId && !editUserSubscriptions.includes(catId)) {
                      setEditUserSubscriptions([...editUserSubscriptions, catId]);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">Add subscription...</option>
                  {categories
                    .filter(cat => !editUserSubscriptions.includes(cat.id))
                    .map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))
                  }
                </select>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                User will have access to documents in subscribed categories.
              </p>
            </div>
          )}

          {managingUserSubs?.role === 'superuser' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assigned Categories
              </label>
              <div className="border border-gray-200 rounded-lg p-2">
                <div className="flex flex-wrap gap-2 mb-2">
                  {editUserAssignedCategories.length === 0 ? (
                    <span className="text-sm text-gray-500">No categories assigned</span>
                  ) : (
                    editUserAssignedCategories.map(catId => {
                      const cat = categories.find(c => c.id === catId);
                      return cat ? (
                        <span
                          key={catId}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full"
                        >
                          <FolderOpen size={10} />
                          {cat.name}
                          <button
                            type="button"
                            onClick={() => setEditUserAssignedCategories(ids => ids.filter(id => id !== catId))}
                            className="hover:bg-orange-200 rounded-full p-0.5"
                          >
                            ×
                          </button>
                        </span>
                      ) : null;
                    })
                  )}
                </div>
                <select
                  value=""
                  onChange={(e) => {
                    const catId = parseInt(e.target.value, 10);
                    if (catId && !editUserAssignedCategories.includes(catId)) {
                      setEditUserAssignedCategories([...editUserAssignedCategories, catId]);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">Assign category...</option>
                  {categories
                    .filter(cat => !editUserAssignedCategories.includes(cat.id))
                    .map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))
                  }
                </select>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Super user can manage users subscribed to these categories.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="secondary"
            onClick={() => setManagingUserSubs(null)}
            disabled={savingUserSubs}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveUserSubs}
            loading={savingUserSubs}
          >
            <Save size={18} className="mr-2" />
            Save Changes
          </Button>
        </div>
      </Modal>

      {/* Add Category Modal */}
      <Modal
        isOpen={showAddCategory}
        onClose={() => setShowAddCategory(false)}
        title="Create Category"
      >
        <form onSubmit={handleAddCategory}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category Name *
              </label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., Human Resources"
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                A URL-safe slug will be generated automatically
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                value={newCategoryDescription}
                onChange={(e) => setNewCategoryDescription(e.target.value)}
                placeholder="Brief description of this category"
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddCategory(false)}
              disabled={addingCategory}
            >
              Cancel
            </Button>
            <Button type="submit" loading={addingCategory}>
              Create Category
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Category Modal */}
      <Modal
        isOpen={!!deleteCategory}
        onClose={() => setDeleteCategory(null)}
        title="Delete Category?"
      >
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete &quot;{deleteCategory?.name}&quot;?
        </p>
        <p className="text-sm text-gray-500 mb-6">
          This will remove the category. Documents assigned to this category will become unassigned.
        </p>
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setDeleteCategory(null)}
            disabled={deletingCategory}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDeleteCategory}
            loading={deletingCategory}
          >
            Delete
          </Button>
        </div>
      </Modal>

      {/* Edit Category Modal */}
      <Modal
        isOpen={!!editingCategory}
        onClose={() => setEditingCategory(null)}
        title="Edit Category"
      >
        <form onSubmit={handleUpdateCategory}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category Name *
              </label>
              <input
                type="text"
                value={editCategoryName}
                onChange={(e) => setEditCategoryName(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={editCategoryDescription}
                onChange={(e) => setEditCategoryDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditingCategory(null)}
              disabled={updatingCategory}
            >
              Cancel
            </Button>
            <Button type="submit" loading={updatingCategory}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Restore All Defaults Confirmation Modal */}
      <Modal
        isOpen={showRestoreConfirm}
        onClose={() => setShowRestoreConfirm(false)}
        title="Restore All Defaults?"
      >
        <p className="text-gray-600 mb-4">
          This will reset ALL settings to their default values:
        </p>
        <ul className="text-sm text-gray-600 list-disc list-inside mb-4 space-y-1">
          <li><strong>LLM:</strong> GPT-4.1 Mini (temp: 0.7, tokens: 2000)</li>
          <li><strong>RAG:</strong> 15/10 chunks, 0.5 threshold</li>
          <li><strong>System Prompt:</strong> Default GPSA prompt</li>
        </ul>
        <p className="text-sm text-orange-600 font-medium">
          This action cannot be undone. Your current settings will be overwritten.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="secondary"
            onClick={() => setShowRestoreConfirm(false)}
            disabled={restoringDefaults}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRestoreAllDefaults}
            loading={restoringDefaults}
            className="bg-orange-600 hover:bg-orange-700"
          >
            Restore Defaults
          </Button>
        </div>
      </Modal>
    </div>
  );
}
