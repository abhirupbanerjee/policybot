'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Users, User, FolderOpen, Tag, Plus, FileText, Upload, Trash2, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';

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
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);

  // Active tab state
  const [activeTab, setActiveTab] = useState<'users' | 'documents'>('users');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load users and documents in parallel
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [router]);

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
    if (!uploadFile || !uploadCategory) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('categoryId', uploadCategory.toString());

      const response = await fetch('/api/superuser/documents', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload document');
      }

      await loadData();
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadCategory(null);
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
        </div>

        {/* Documents Section */}
        {activeTab === 'documents' && (
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="px-6 py-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Documents</h2>
                  <p className="text-sm text-gray-500">
                    {documents.length} documents in your categories
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
            </div>

            {documents.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
                <p className="text-gray-500 mb-4">
                  Upload PDF documents to your assigned categories
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-left text-sm text-gray-600">
                    <tr>
                      <th className="px-6 py-3 font-medium">Document</th>
                      <th className="px-6 py-3 font-medium">Category</th>
                      <th className="px-6 py-3 font-medium">Size</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Uploaded</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {documents.map((doc) => (
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
      </main>

      {/* Upload Document Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setUploadFile(null);
          setUploadCategory(null);
        }}
        title="Upload Document"
      >
        <form onSubmit={handleUploadDocument}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PDF File *
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
                    <span className="text-sm text-gray-600">Click to select a PDF file</span>
                    <span className="text-xs text-gray-400 mt-1">Max size: 50MB</span>
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
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
                setUploadCategory(null);
              }}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={uploading}
              disabled={!uploadFile || !uploadCategory}
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
    </div>
  );
}
