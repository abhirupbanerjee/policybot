'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, RefreshCw, Trash2, FileText, AlertCircle, Users, UserPlus, Shield, User } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import type { GlobalDocument } from '@/types';

interface AllowedUser {
  email: string;
  name?: string;
  role: 'admin' | 'user';
  addedAt: string;
  addedBy: string;
}

type TabType = 'documents' | 'users';

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

  // User state
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [userLoading, setUserLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');
  const [addingUser, setAddingUser] = useState(false);
  const [deleteUser, setDeleteUser] = useState<AllowedUser | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<AllowedUser | null>(null);
  const [updatingRole, setUpdatingRole] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    loadDocuments();
    loadUsers();
  }, [loadDocuments, loadUsers]);

  // Document handlers
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('File too large (max 50MB)');
      return;
    }

    setUploading(true);
    setUploadProgress('Uploading...');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(null);
      e.target.value = '';
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

  const handleUpdateRole = async (newRole: 'admin' | 'user') => {
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
                  <h2 className="font-semibold text-gray-900">Policy Documents</h2>
                  <p className="text-sm text-gray-500">
                    {documents.length} documents, {totalChunks} chunks indexed
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
                    accept=".pdf,application/pdf"
                    onChange={handleUpload}
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
            </div>

            {documents.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
                <p className="text-gray-500 mb-4">
                  Upload PDF documents to build your policy knowledge base
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-left text-sm text-gray-600">
                    <tr>
                      <th className="px-6 py-3 font-medium">Document</th>
                      <th className="px-6 py-3 font-medium">Size</th>
                      <th className="px-6 py-3 font-medium">Chunks</th>
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
                            <FileText className="w-5 h-5 text-blue-600" />
                            <span className="font-medium text-gray-900">{doc.filename}</span>
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
                      <th className="px-6 py-3 font-medium">Added</th>
                      <th className="px-6 py-3 font-medium">Added By</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {users.map((user) => (
                      <tr key={user.email} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              user.role === 'admin' ? 'bg-purple-100' : 'bg-gray-100'
                            }`}>
                              {user.role === 'admin' ? (
                                <Shield size={16} className="text-purple-600" />
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
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {formatDate(user.addedAt)}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {user.addedBy}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
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
                onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'user')}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="user">User - Can use chat and upload documents</option>
                <option value="admin">Admin - Full access including user management</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddUser(false)}
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
    </div>
  );
}
