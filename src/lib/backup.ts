/**
 * Backup Utility Module
 *
 * ZIP creation and restoration for system backups
 */

import archiver from 'archiver';
import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import {
  exportDocuments,
  exportCategories,
  exportDocumentCategories,
  exportUsers,
  exportUserSubscriptions,
  exportSuperUserCategories,
  exportThreads,
  exportMessages,
  exportThreadCategories,
  exportThreadUploads,
  exportThreadOutputs,
  exportSettings,
  exportToolConfigs,
  exportCategoryToolConfigs,
  exportSkills,
  exportCategorySkills,
  exportCategoryPrompts,
  exportDataApiConfigs,
  exportDataApiCategories,
  exportDataCsvConfigs,
  exportDataCsvCategories,
  importDocuments,
  importCategories,
  importDocumentCategories,
  importUsers,
  importUserSubscriptions,
  importSuperUserCategories,
  importThreads,
  importMessages,
  importThreadCategories,
  importThreadUploads,
  importThreadOutputs,
  importSettings,
  importToolConfigs,
  importCategoryToolConfigs,
  importSkills,
  importCategorySkills,
  importCategoryPrompts,
  importDataApiConfigs,
  importDataApiCategories,
  importDataCsvConfigs,
  importDataCsvCategories,
  clearAllData,
} from './db/backup';
import { getGlobalDocsDir, getThreadsDir, ensureDir } from './storage';
import { transaction } from './db/index';

// ============ Types ============

export interface BackupOptions {
  includeDocuments: boolean;
  includeDocumentFiles: boolean;
  includeCategories: boolean;
  includeSettings: boolean;
  includeUsers: boolean;
  includeThreads: boolean;
  includeTools: boolean;
  includeSkills: boolean;
  includeCategoryPrompts: boolean;
  includeDataSources: boolean;
}

export interface RestoreOptions {
  clearExisting: boolean;
  restoreDocuments: boolean;
  restoreDocumentFiles: boolean;
  restoreCategories: boolean;
  restoreSettings: boolean;
  restoreUsers: boolean;
  restoreThreads: boolean;
  restoreTools: boolean;
  restoreSkills: boolean;
  restoreCategoryPrompts: boolean;
  restoreDataSources: boolean;
  refreshVectorDb: boolean;
}

export interface BackupManifest {
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
    tools: boolean;
    skills: boolean;
    categoryPrompts: boolean;
    dataSources: boolean;
    documentCount: number;
    categoryCount: number;
    userCount: number;
    threadCount: number;
    toolCount: number;
    skillCount: number;
    categoryPromptCount: number;
    dataSourceCount: number;
    totalFileSize: number;
  };
  warnings: string[];
}

export interface RestoreResult {
  success: boolean;
  message: string;
  details: {
    documentsRestored: number;
    categoriesRestored: number;
    usersRestored: number;
    threadsRestored: number;
    filesRestored: number;
    settingsRestored: number;
    toolsRestored: number;
    skillsRestored: number;
    categoryPromptsRestored: number;
    dataSourcesRestored: number;
  };
  warnings: string[];
}

// ============ Backup Functions ============

/**
 * Generate timestamped backup filename
 */
export function getBackupFilename(): string {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '-')
    .slice(0, 19);
  return `backup-${timestamp}.zip`;
}

/**
 * Create backup ZIP stream
 */
export async function createBackup(
  options: BackupOptions,
  userEmail: string
): Promise<{ stream: Readable; filename: string }> {
  const archive = archiver('zip', {
    zlib: { level: 6 }, // Compression level
  });

  const warnings: string[] = [];
  let totalFileSize = 0;

  // Export database data
  const documents = options.includeDocuments ? exportDocuments() : [];
  const categories = options.includeCategories ? exportCategories() : [];
  const documentCategories = options.includeDocuments || options.includeCategories
    ? exportDocumentCategories()
    : [];
  const users = options.includeUsers ? exportUsers() : [];
  const userSubscriptions = options.includeUsers ? exportUserSubscriptions() : [];
  const superUserCategories = options.includeUsers ? exportSuperUserCategories() : [];
  const settings = options.includeSettings ? exportSettings() : [];

  // Thread data
  let threads: ReturnType<typeof exportThreads> = [];
  let messages: ReturnType<typeof exportMessages> = [];
  let threadCategories: ReturnType<typeof exportThreadCategories> = [];
  let threadUploads: ReturnType<typeof exportThreadUploads> = [];
  let threadOutputs: ReturnType<typeof exportThreadOutputs> = [];

  if (options.includeThreads) {
    threads = exportThreads();
    messages = exportMessages();
    threadCategories = exportThreadCategories();
    threadUploads = exportThreadUploads();
    threadOutputs = exportThreadOutputs();
  }

  // Tools, skills, and category prompts data
  const toolConfigs = options.includeTools ? exportToolConfigs() : [];
  const categoryToolConfigs = options.includeTools ? exportCategoryToolConfigs() : [];
  const skills = options.includeSkills ? exportSkills() : [];
  const categorySkills = options.includeSkills ? exportCategorySkills() : [];
  const categoryPrompts = options.includeCategoryPrompts ? exportCategoryPrompts() : [];

  // Data sources
  const dataApiConfigs = options.includeDataSources ? exportDataApiConfigs() : [];
  const dataApiCategories = options.includeDataSources ? exportDataApiCategories() : [];
  const dataCsvConfigs = options.includeDataSources ? exportDataCsvConfigs() : [];
  const dataCsvCategories = options.includeDataSources ? exportDataCsvCategories() : [];

  // Create manifest
  const manifest: BackupManifest = {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    createdBy: userEmail,
    application: {
      name: 'Policy Bot',
      version: '1.0.0',
    },
    contents: {
      documents: options.includeDocuments,
      documentFiles: options.includeDocumentFiles,
      categories: options.includeCategories,
      settings: options.includeSettings,
      users: options.includeUsers,
      threads: options.includeThreads,
      tools: options.includeTools,
      skills: options.includeSkills,
      categoryPrompts: options.includeCategoryPrompts,
      dataSources: options.includeDataSources,
      documentCount: documents.length,
      categoryCount: categories.length,
      userCount: users.length,
      threadCount: threads.length,
      toolCount: toolConfigs.length,
      skillCount: skills.length,
      categoryPromptCount: categoryPrompts.length,
      dataSourceCount: dataApiConfigs.length + dataCsvConfigs.length,
      totalFileSize: 0, // Will be updated
    },
    warnings,
  };

  // Add manifest
  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

  // Add database exports
  if (options.includeDocuments) {
    archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), count: documents.length, records: documents }, null, 2), { name: 'data/documents.json' });
  }

  if (options.includeCategories) {
    archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), count: categories.length, records: categories }, null, 2), { name: 'data/categories.json' });
  }

  if (options.includeDocuments || options.includeCategories) {
    archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), count: documentCategories.length, records: documentCategories }, null, 2), { name: 'data/document_categories.json' });
  }

  if (options.includeUsers) {
    archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), count: users.length, records: users }, null, 2), { name: 'data/users.json' });
    archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), count: userSubscriptions.length, records: userSubscriptions }, null, 2), { name: 'data/user_subscriptions.json' });
    archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), count: superUserCategories.length, records: superUserCategories }, null, 2), { name: 'data/super_user_categories.json' });
  }

  if (options.includeSettings) {
    archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), count: settings.length, records: settings }, null, 2), { name: 'data/settings.json' });
  }

  if (options.includeThreads) {
    archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), count: threads.length, records: threads }, null, 2), { name: 'data/threads.json' });
    archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), count: messages.length, records: messages }, null, 2), { name: 'data/messages.json' });
    archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), count: threadCategories.length, records: threadCategories }, null, 2), { name: 'data/thread_categories.json' });
    archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), count: threadUploads.length, records: threadUploads }, null, 2), { name: 'data/thread_uploads.json' });
    archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), count: threadOutputs.length, records: threadOutputs }, null, 2), { name: 'data/thread_outputs.json' });
  }

  // Add tools data
  if (options.includeTools) {
    archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), count: toolConfigs.length, records: toolConfigs }, null, 2), { name: 'data/tool_configs.json' });
    archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), count: categoryToolConfigs.length, records: categoryToolConfigs }, null, 2), { name: 'data/category_tool_configs.json' });
  }

  // Add skills data
  if (options.includeSkills) {
    archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), count: skills.length, records: skills }, null, 2), { name: 'data/skills.json' });
    archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), count: categorySkills.length, records: categorySkills }, null, 2), { name: 'data/category_skills.json' });
  }

  // Add category prompts data
  if (options.includeCategoryPrompts) {
    archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), count: categoryPrompts.length, records: categoryPrompts }, null, 2), { name: 'data/category_prompts.json' });
  }

  // Add data sources data
  if (options.includeDataSources) {
    archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), count: dataApiConfigs.length, records: dataApiConfigs }, null, 2), { name: 'data/data_api_configs.json' });
    archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), count: dataApiCategories.length, records: dataApiCategories }, null, 2), { name: 'data/data_api_categories.json' });
    archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), count: dataCsvConfigs.length, records: dataCsvConfigs }, null, 2), { name: 'data/data_csv_configs.json' });
    archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), count: dataCsvCategories.length, records: dataCsvCategories }, null, 2), { name: 'data/data_csv_categories.json' });
  }

  // Add document files
  if (options.includeDocumentFiles && options.includeDocuments) {
    const globalDocsDir = getGlobalDocsDir();
    if (fs.existsSync(globalDocsDir)) {
      for (const doc of documents) {
        const filePath = path.join(globalDocsDir, doc.filepath);
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          totalFileSize += stats.size;
          archive.file(filePath, { name: `files/global-docs/${doc.filepath}` });
        } else {
          warnings.push(`Document file not found: ${doc.filepath}`);
        }
      }
    }
  }

  // Add thread files
  if (options.includeThreads) {
    const threadsDir = getThreadsDir();
    if (fs.existsSync(threadsDir)) {
      // Add entire threads directory recursively
      archive.directory(threadsDir, 'files/threads');
    }
  }

  // Add CSV data source files
  if (options.includeDataSources && dataCsvConfigs.length > 0) {
    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    const csvDir = path.join(dataDir, 'csv-sources');
    if (fs.existsSync(csvDir)) {
      for (const csv of dataCsvConfigs) {
        const filePath = path.join(csvDir, csv.file_path);
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          totalFileSize += stats.size;
          archive.file(filePath, { name: `files/csv-sources/${csv.file_path}` });
        } else {
          warnings.push(`CSV file not found: ${csv.file_path}`);
        }
      }
    }
  }

  // Update manifest with total file size
  manifest.contents.totalFileSize = totalFileSize;

  // Finalize archive
  archive.finalize();

  return {
    stream: archive as unknown as Readable,
    filename: getBackupFilename(),
  };
}

/**
 * Validate backup ZIP file
 */
export function validateBackupFile(zipBuffer: Buffer): {
  valid: boolean;
  manifest: BackupManifest | null;
  error?: string;
} {
  try {
    const zip = new AdmZip(zipBuffer);
    const manifestEntry = zip.getEntry('manifest.json');

    if (!manifestEntry) {
      return { valid: false, manifest: null, error: 'Invalid backup file: missing manifest.json' };
    }

    const manifestContent = manifestEntry.getData().toString('utf-8');
    const manifest = JSON.parse(manifestContent) as BackupManifest;

    if (!manifest.version || !manifest.createdAt || !manifest.contents) {
      return { valid: false, manifest: null, error: 'Invalid backup file: corrupt manifest' };
    }

    return { valid: true, manifest };
  } catch (error) {
    return { valid: false, manifest: null, error: `Failed to read backup file: ${error}` };
  }
}

/**
 * Restore from backup ZIP
 */
export async function restoreBackup(
  zipBuffer: Buffer,
  options: RestoreOptions
): Promise<RestoreResult> {
  const result: RestoreResult = {
    success: false,
    message: '',
    details: {
      documentsRestored: 0,
      categoriesRestored: 0,
      usersRestored: 0,
      threadsRestored: 0,
      filesRestored: 0,
      settingsRestored: 0,
      toolsRestored: 0,
      skillsRestored: 0,
      categoryPromptsRestored: 0,
      dataSourcesRestored: 0,
    },
    warnings: [],
  };

  try {
    // Validate first
    const validation = validateBackupFile(zipBuffer);
    if (!validation.valid || !validation.manifest) {
      result.message = validation.error || 'Invalid backup file';
      return result;
    }

    const zip = new AdmZip(zipBuffer);
    const manifest = validation.manifest;

    // Clear existing data if requested
    if (options.clearExisting) {
      clearAllData();
    }

    // Helper to read JSON from ZIP
    const readJsonFromZip = <T>(filename: string): T | null => {
      const entry = zip.getEntry(filename);
      if (!entry) return null;
      try {
        const content = entry.getData().toString('utf-8');
        const parsed = JSON.parse(content);
        return parsed.records as T;
      } catch {
        result.warnings.push(`Failed to parse ${filename}`);
        return null;
      }
    };

    // Restore in transaction for atomicity
    transaction(() => {
      // Restore categories first (other tables depend on it)
      if (options.restoreCategories && manifest.contents.categories) {
        const categories = readJsonFromZip<ReturnType<typeof exportCategories>>('data/categories.json');
        if (categories && categories.length > 0) {
          importCategories(categories);
          result.details.categoriesRestored = categories.length;
        }
      }

      // Restore users
      if (options.restoreUsers && manifest.contents.users) {
        const users = readJsonFromZip<ReturnType<typeof exportUsers>>('data/users.json');
        if (users && users.length > 0) {
          importUsers(users);
          result.details.usersRestored = users.length;
        }

        const userSubs = readJsonFromZip<ReturnType<typeof exportUserSubscriptions>>('data/user_subscriptions.json');
        if (userSubs && userSubs.length > 0) {
          importUserSubscriptions(userSubs);
        }

        const superUserCats = readJsonFromZip<ReturnType<typeof exportSuperUserCategories>>('data/super_user_categories.json');
        if (superUserCats && superUserCats.length > 0) {
          importSuperUserCategories(superUserCats);
        }
      }

      // Restore documents
      if (options.restoreDocuments && manifest.contents.documents) {
        const documents = readJsonFromZip<ReturnType<typeof exportDocuments>>('data/documents.json');
        if (documents && documents.length > 0) {
          importDocuments(documents);
          result.details.documentsRestored = documents.length;
        }

        const docCats = readJsonFromZip<ReturnType<typeof exportDocumentCategories>>('data/document_categories.json');
        if (docCats && docCats.length > 0) {
          importDocumentCategories(docCats);
        }
      }

      // Restore threads
      if (options.restoreThreads && manifest.contents.threads) {
        const threads = readJsonFromZip<ReturnType<typeof exportThreads>>('data/threads.json');
        if (threads && threads.length > 0) {
          importThreads(threads);
          result.details.threadsRestored = threads.length;
        }

        const messages = readJsonFromZip<ReturnType<typeof exportMessages>>('data/messages.json');
        if (messages && messages.length > 0) {
          importMessages(messages);
        }

        const threadCats = readJsonFromZip<ReturnType<typeof exportThreadCategories>>('data/thread_categories.json');
        if (threadCats && threadCats.length > 0) {
          importThreadCategories(threadCats);
        }

        const threadUploads = readJsonFromZip<ReturnType<typeof exportThreadUploads>>('data/thread_uploads.json');
        if (threadUploads && threadUploads.length > 0) {
          importThreadUploads(threadUploads);
        }

        const threadOutputs = readJsonFromZip<ReturnType<typeof exportThreadOutputs>>('data/thread_outputs.json');
        if (threadOutputs && threadOutputs.length > 0) {
          importThreadOutputs(threadOutputs);
        }
      }

      // Restore settings
      if (options.restoreSettings && manifest.contents.settings) {
        const settings = readJsonFromZip<ReturnType<typeof exportSettings>>('data/settings.json');
        if (settings && settings.length > 0) {
          importSettings(settings);
          result.details.settingsRestored = settings.length;
        }
      }

      // Restore tools
      if (options.restoreTools && manifest.contents.tools) {
        const toolConfigs = readJsonFromZip<ReturnType<typeof exportToolConfigs>>('data/tool_configs.json');
        if (toolConfigs && toolConfigs.length > 0) {
          importToolConfigs(toolConfigs);
          result.details.toolsRestored = toolConfigs.length;
        }

        const categoryToolConfigs = readJsonFromZip<ReturnType<typeof exportCategoryToolConfigs>>('data/category_tool_configs.json');
        if (categoryToolConfigs && categoryToolConfigs.length > 0) {
          importCategoryToolConfigs(categoryToolConfigs);
        }
      }

      // Restore skills
      if (options.restoreSkills && manifest.contents.skills) {
        const skills = readJsonFromZip<ReturnType<typeof exportSkills>>('data/skills.json');
        if (skills && skills.length > 0) {
          importSkills(skills);
          result.details.skillsRestored = skills.length;
        }

        const categorySkills = readJsonFromZip<ReturnType<typeof exportCategorySkills>>('data/category_skills.json');
        if (categorySkills && categorySkills.length > 0) {
          importCategorySkills(categorySkills);
        }
      }

      // Restore category prompts (includes starter prompts)
      if (options.restoreCategoryPrompts && manifest.contents.categoryPrompts) {
        const categoryPrompts = readJsonFromZip<ReturnType<typeof exportCategoryPrompts>>('data/category_prompts.json');
        if (categoryPrompts && categoryPrompts.length > 0) {
          importCategoryPrompts(categoryPrompts);
          result.details.categoryPromptsRestored = categoryPrompts.length;
        }
      }

      // Restore data sources
      if (options.restoreDataSources && manifest.contents.dataSources) {
        // Restore API configs first, then categories
        const dataApiConfigs = readJsonFromZip<ReturnType<typeof exportDataApiConfigs>>('data/data_api_configs.json');
        if (dataApiConfigs && dataApiConfigs.length > 0) {
          importDataApiConfigs(dataApiConfigs);
          result.details.dataSourcesRestored += dataApiConfigs.length;
        }

        const dataApiCategories = readJsonFromZip<ReturnType<typeof exportDataApiCategories>>('data/data_api_categories.json');
        if (dataApiCategories && dataApiCategories.length > 0) {
          importDataApiCategories(dataApiCategories);
        }

        // Restore CSV configs first, then categories
        const dataCsvConfigs = readJsonFromZip<ReturnType<typeof exportDataCsvConfigs>>('data/data_csv_configs.json');
        if (dataCsvConfigs && dataCsvConfigs.length > 0) {
          importDataCsvConfigs(dataCsvConfigs);
          result.details.dataSourcesRestored += dataCsvConfigs.length;
        }

        const dataCsvCategories = readJsonFromZip<ReturnType<typeof exportDataCsvCategories>>('data/data_csv_categories.json');
        if (dataCsvCategories && dataCsvCategories.length > 0) {
          importDataCsvCategories(dataCsvCategories);
        }
      }
    });

    // Restore document files (outside transaction - file system ops)
    if (options.restoreDocumentFiles && manifest.contents.documentFiles) {
      const globalDocsDir = getGlobalDocsDir();
      await ensureDir(globalDocsDir);

      const fileEntries = zip.getEntries().filter(e => e.entryName.startsWith('files/global-docs/'));
      for (const entry of fileEntries) {
        if (!entry.isDirectory) {
          const relativePath = entry.entryName.replace('files/global-docs/', '');
          const targetPath = path.join(globalDocsDir, relativePath);

          // Ensure directory exists
          await ensureDir(path.dirname(targetPath));

          // Extract file
          fs.writeFileSync(targetPath, entry.getData());
          result.details.filesRestored++;
        }
      }
    }

    // Restore thread files
    if (options.restoreThreads && manifest.contents.threads) {
      const threadsDir = getThreadsDir();
      await ensureDir(threadsDir);

      const fileEntries = zip.getEntries().filter(e => e.entryName.startsWith('files/threads/'));
      for (const entry of fileEntries) {
        if (!entry.isDirectory) {
          const relativePath = entry.entryName.replace('files/threads/', '');
          const targetPath = path.join(threadsDir, relativePath);

          // Ensure directory exists
          await ensureDir(path.dirname(targetPath));

          // Extract file
          fs.writeFileSync(targetPath, entry.getData());
          result.details.filesRestored++;
        }
      }
    }

    // Restore CSV data source files
    if (options.restoreDataSources && manifest.contents.dataSources) {
      const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
      const csvDir = path.join(dataDir, 'csv-sources');
      await ensureDir(csvDir);

      const fileEntries = zip.getEntries().filter(e => e.entryName.startsWith('files/csv-sources/'));
      for (const entry of fileEntries) {
        if (!entry.isDirectory) {
          const relativePath = entry.entryName.replace('files/csv-sources/', '');
          const targetPath = path.join(csvDir, relativePath);

          // Ensure directory exists
          await ensureDir(path.dirname(targetPath));

          // Extract file
          fs.writeFileSync(targetPath, entry.getData());
          result.details.filesRestored++;
        }
      }
    }

    result.success = true;
    result.message = 'Backup restored successfully';

  } catch (error) {
    result.message = `Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }

  return result;
}

/**
 * Get contents of a backup file without restoring
 */
export function getBackupContents(zipBuffer: Buffer): BackupManifest | null {
  const validation = validateBackupFile(zipBuffer);
  return validation.manifest;
}
