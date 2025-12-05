'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Users, User, FolderOpen, Tag, Plus } from 'lucide-react';
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

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/superuser/users');

      if (response.status === 403) {
        router.push('/');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load data');
      }

      const data = await response.json();
      setAssignedCategories(data.assignedCategories || []);
      setUsers(data.users || []);
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
              <p className="text-sm text-gray-500">Manage user subscriptions for your categories</p>
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
              You can manage user subscriptions for these categories
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

        {/* Users Section */}
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
      </main>

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
