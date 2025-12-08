'use client';

import { useState, useRef } from 'react';
import { Download, UploadCloud, AlertTriangle, CheckCircle, FileText, Users, FolderOpen, Settings, MessageSquare, FileCode, RefreshCw, AlertCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

interface BackupManifest {
  version: string;
  createdAt: string;
  createdBy: string;
  application: {
    name: string;
    version: string;
  };
  contents: {
    documents: boolean;
    documentFiles: boolean;
    categories: boolean;
    settings: boolean;
    users: boolean;
    threads: boolean;
    documentCount: number;
    categoryCount: number;
    userCount: number;
    threadCount: number;
    totalFileSize: number;
  };
  warnings: string[];
}

interface RestoreResult {
  success: boolean;
  message: string;
  details: {
    documentsRestored: number;
    categoriesRestored: number;
    usersRestored: number;
    threadsRestored: number;
    filesRestored: number;
    settingsRestored: number;
  };
  warnings: string[];
}

export default function BackupTab() {
  // Backup state
  const [backupInProgress, setBackupInProgress] = useState(false);
  const [backupOptions, setBackupOptions] = useState({
    includeDocuments: true,
    includeDocumentFiles: true,
    includeCategories: true,
    includeSettings: true,
    includeUsers: true,
    includeThreads: false,
  });

  // Restore state
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreManifest, setRestoreManifest] = useState<BackupManifest | null>(null);
  const [restoreInProgress, setRestoreInProgress] = useState(false);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [restoreOptions, setRestoreOptions] = useState({
    clearExisting: false,
    restoreDocuments: true,
    restoreDocumentFiles: true,
    restoreCategories: true,
    restoreSettings: true,
    restoreUsers: true,
    restoreThreads: false,
    refreshVectorDb: true,
  });

  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle backup creation
  const handleCreateBackup = async () => {
    setBackupInProgress(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backupOptions),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Backup failed');
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : 'backup.zip';

      // Create blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create backup');
    } finally {
      setBackupInProgress(false);
    }
  };

  // Handle file selection for restore
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFile(file);
    setRestoreResult(null);
    setError(null);

    // Validate and get manifest
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/backup/restore', {
        method: 'PUT',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Invalid backup file');
      }

      const data = await response.json();
      setRestoreManifest(data.manifest);

      // Update restore options based on what's in the backup
      if (data.manifest?.contents) {
        setRestoreOptions(prev => ({
          ...prev,
          restoreDocuments: data.manifest.contents.documents,
          restoreDocumentFiles: data.manifest.contents.documentFiles,
          restoreCategories: data.manifest.contents.categories,
          restoreSettings: data.manifest.contents.settings,
          restoreUsers: data.manifest.contents.users,
          restoreThreads: data.manifest.contents.threads,
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read backup file');
      setRestoreFile(null);
      setRestoreManifest(null);
    }
  };

  // Handle restore
  const handleRestore = async () => {
    if (!restoreFile) return;

    setRestoreInProgress(true);
    setError(null);
    setRestoreResult(null);

    try {
      const formData = new FormData();
      formData.append('file', restoreFile);
      Object.entries(restoreOptions).forEach(([key, value]) => {
        formData.append(key, String(value));
      });

      const response = await fetch('/api/admin/backup/restore', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Restore failed');
      }

      setRestoreResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore backup');
    } finally {
      setRestoreInProgress(false);
    }
  };

  // Reset restore state
  const handleClearRestore = () => {
    setRestoreFile(null);
    setRestoreManifest(null);
    setRestoreResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-3">
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

      {/* Create Backup Section */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="px-6 py-4 border-b flex items-center gap-3">
          <Download className="text-blue-600" size={20} />
          <div>
            <h2 className="font-semibold text-gray-900">Create Backup</h2>
            <p className="text-sm text-gray-500">Export your data as a downloadable ZIP file</p>
          </div>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={backupOptions.includeDocuments}
                  onChange={(e) => setBackupOptions(prev => ({ ...prev, includeDocuments: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <FileText size={18} className="text-gray-500" />
                <span className="text-sm">Documents</span>
              </label>

              <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${!backupOptions.includeDocuments ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  checked={backupOptions.includeDocumentFiles}
                  onChange={(e) => setBackupOptions(prev => ({ ...prev, includeDocumentFiles: e.target.checked }))}
                  disabled={!backupOptions.includeDocuments}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <FileCode size={18} className="text-gray-500" />
                <span className="text-sm">Include Files</span>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={backupOptions.includeCategories}
                  onChange={(e) => setBackupOptions(prev => ({ ...prev, includeCategories: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <FolderOpen size={18} className="text-gray-500" />
                <span className="text-sm">Categories</span>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={backupOptions.includeSettings}
                  onChange={(e) => setBackupOptions(prev => ({ ...prev, includeSettings: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Settings size={18} className="text-gray-500" />
                <span className="text-sm">Settings</span>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={backupOptions.includeUsers}
                  onChange={(e) => setBackupOptions(prev => ({ ...prev, includeUsers: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Users size={18} className="text-gray-500" />
                <span className="text-sm">Users</span>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={backupOptions.includeThreads}
                  onChange={(e) => setBackupOptions(prev => ({ ...prev, includeThreads: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <MessageSquare size={18} className="text-gray-500" />
                <span className="text-sm">Threads</span>
              </label>
            </div>

            <div className="flex justify-end pt-4 border-t mt-4">
              <Button
                onClick={handleCreateBackup}
                disabled={backupInProgress}
              >
                {backupInProgress ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Creating Backup...
                  </>
                ) : (
                  <>
                    <Download size={16} className="mr-2" />
                    Create Backup
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Restore Backup Section */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="px-6 py-4 border-b flex items-center gap-3">
          <UploadCloud className="text-green-600" size={20} />
          <div>
            <h2 className="font-semibold text-gray-900">Restore from Backup</h2>
            <p className="text-sm text-gray-500">Upload a backup ZIP file to restore your data</p>
          </div>
        </div>
        <div className="p-6">
          {/* Important Reminder */}
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <span className="font-medium">Before restoring:</span> Ensure your <code className="bg-amber-100 px-1 rounded">.env</code> file is properly configured with API keys and environment variables. The backup does not include sensitive configuration files.
            </div>
          </div>

          {/* File Upload */}
          {!restoreFile ? (
            <div className="space-y-4">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-gray-50 transition-colors">
                <UploadCloud size={32} className="text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">Click to select backup file (.zip)</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected File Info */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText size={20} className="text-blue-600" />
                  <div>
                    <div className="font-medium text-gray-900">{restoreFile.name}</div>
                    <div className="text-sm text-gray-500">{formatSize(restoreFile.size)}</div>
                  </div>
                </div>
                <button
                  onClick={handleClearRestore}
                  className="text-gray-400 hover:text-gray-600"
                >
                  &times;
                </button>
              </div>

              {/* Manifest Info */}
              {restoreManifest && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm font-medium text-blue-900 mb-2">Backup Contents</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {restoreManifest.contents.documents && (
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-blue-600" />
                        <span>{restoreManifest.contents.documentCount} Documents</span>
                      </div>
                    )}
                    {restoreManifest.contents.categories && (
                      <div className="flex items-center gap-2">
                        <FolderOpen size={14} className="text-blue-600" />
                        <span>{restoreManifest.contents.categoryCount} Categories</span>
                      </div>
                    )}
                    {restoreManifest.contents.users && (
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-blue-600" />
                        <span>{restoreManifest.contents.userCount} Users</span>
                      </div>
                    )}
                    {restoreManifest.contents.threads && (
                      <div className="flex items-center gap-2">
                        <MessageSquare size={14} className="text-blue-600" />
                        <span>{restoreManifest.contents.threadCount} Threads</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-blue-600">
                    Created: {new Date(restoreManifest.createdAt).toLocaleString()} by {restoreManifest.createdBy}
                  </div>
                </div>
              )}

              {/* Restore Options */}
              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-700">Restore Options</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <label className={`flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50 ${!restoreManifest?.contents.documents ? 'opacity-50' : ''}`}>
                    <input
                      type="checkbox"
                      checked={restoreOptions.restoreDocuments}
                      onChange={(e) => setRestoreOptions(prev => ({ ...prev, restoreDocuments: e.target.checked }))}
                      disabled={!restoreManifest?.contents.documents}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">Documents</span>
                  </label>

                  <label className={`flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50 ${!restoreManifest?.contents.documentFiles || !restoreOptions.restoreDocuments ? 'opacity-50' : ''}`}>
                    <input
                      type="checkbox"
                      checked={restoreOptions.restoreDocumentFiles}
                      onChange={(e) => setRestoreOptions(prev => ({ ...prev, restoreDocumentFiles: e.target.checked }))}
                      disabled={!restoreManifest?.contents.documentFiles || !restoreOptions.restoreDocuments}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">Include Files</span>
                  </label>

                  <label className={`flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50 ${!restoreManifest?.contents.categories ? 'opacity-50' : ''}`}>
                    <input
                      type="checkbox"
                      checked={restoreOptions.restoreCategories}
                      onChange={(e) => setRestoreOptions(prev => ({ ...prev, restoreCategories: e.target.checked }))}
                      disabled={!restoreManifest?.contents.categories}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">Categories</span>
                  </label>

                  <label className={`flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50 ${!restoreManifest?.contents.settings ? 'opacity-50' : ''}`}>
                    <input
                      type="checkbox"
                      checked={restoreOptions.restoreSettings}
                      onChange={(e) => setRestoreOptions(prev => ({ ...prev, restoreSettings: e.target.checked }))}
                      disabled={!restoreManifest?.contents.settings}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">Settings</span>
                  </label>

                  <label className={`flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50 ${!restoreManifest?.contents.users ? 'opacity-50' : ''}`}>
                    <input
                      type="checkbox"
                      checked={restoreOptions.restoreUsers}
                      onChange={(e) => setRestoreOptions(prev => ({ ...prev, restoreUsers: e.target.checked }))}
                      disabled={!restoreManifest?.contents.users}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">Users</span>
                  </label>

                  <label className={`flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50 ${!restoreManifest?.contents.threads ? 'opacity-50' : ''}`}>
                    <input
                      type="checkbox"
                      checked={restoreOptions.restoreThreads}
                      onChange={(e) => setRestoreOptions(prev => ({ ...prev, restoreThreads: e.target.checked }))}
                      disabled={!restoreManifest?.contents.threads}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">Threads</span>
                  </label>
                </div>

                {/* Advanced Options */}
                <div className="border-t pt-3 space-y-3">
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 bg-red-50 border-red-200">
                    <input
                      type="checkbox"
                      checked={restoreOptions.clearExisting}
                      onChange={(e) => setRestoreOptions(prev => ({ ...prev, clearExisting: e.target.checked }))}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <AlertTriangle size={18} className="text-red-600" />
                    <div>
                      <span className="text-sm font-medium text-red-700">Clear existing data before restore</span>
                      <p className="text-xs text-red-600">This will DELETE all current data! Use with caution.</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 bg-green-50 border-green-200">
                    <input
                      type="checkbox"
                      checked={restoreOptions.refreshVectorDb}
                      onChange={(e) => setRestoreOptions(prev => ({ ...prev, refreshVectorDb: e.target.checked }))}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <RefreshCw size={18} className="text-green-600" />
                    <div>
                      <span className="text-sm font-medium text-green-700">Refresh Vector DB after restore</span>
                      <p className="text-xs text-green-600">Recommended for new instances - rebuilds document embeddings</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Restore Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={handleRestore}
                  disabled={restoreInProgress}
                  variant={restoreOptions.clearExisting ? 'danger' : 'primary'}
                >
                  {restoreInProgress ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Restoring...
                    </>
                  ) : (
                    <>
                      <UploadCloud size={16} className="mr-2" />
                      Restore Backup
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Restore Result */}
          {restoreResult && (
            <div className={`mt-4 p-4 rounded-lg ${restoreResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                {restoreResult.success ? (
                  <CheckCircle className="text-green-600" size={20} />
                ) : (
                  <AlertCircle className="text-red-600" size={20} />
                )}
                <span className={`font-medium ${restoreResult.success ? 'text-green-700' : 'text-red-700'}`}>
                  {restoreResult.message}
                </span>
              </div>
              {restoreResult.success && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm mt-3">
                  {restoreResult.details.documentsRestored > 0 && (
                    <div>Documents: {restoreResult.details.documentsRestored}</div>
                  )}
                  {restoreResult.details.categoriesRestored > 0 && (
                    <div>Categories: {restoreResult.details.categoriesRestored}</div>
                  )}
                  {restoreResult.details.usersRestored > 0 && (
                    <div>Users: {restoreResult.details.usersRestored}</div>
                  )}
                  {restoreResult.details.threadsRestored > 0 && (
                    <div>Threads: {restoreResult.details.threadsRestored}</div>
                  )}
                  {restoreResult.details.filesRestored > 0 && (
                    <div>Files: {restoreResult.details.filesRestored}</div>
                  )}
                  {restoreResult.details.settingsRestored > 0 && (
                    <div>Settings: {restoreResult.details.settingsRestored}</div>
                  )}
                </div>
              )}
              {restoreResult.warnings.length > 0 && (
                <div className="mt-3 space-y-1">
                  {restoreResult.warnings.map((warning, i) => (
                    <div key={i} className="text-sm text-yellow-700 flex items-start gap-2">
                      <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                      {warning}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
