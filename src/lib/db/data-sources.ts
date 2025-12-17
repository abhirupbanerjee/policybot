/**
 * Data Sources Database Operations
 *
 * CRUD operations for data_api_configs, data_csv_configs, and related tables.
 * Handles API and CSV data source configurations with category mapping.
 */

import { v4 as uuidv4 } from 'uuid';
import { execute, queryOne, queryAll, transaction } from './index';
import { safeEncrypt, safeDecrypt } from '../encryption';
import type {
  DataAPIConfig,
  DataCSVConfig,
  DataSource,
  AuthConfig,
  DataSourceAuditEntry,
  DbDataAPIConfig,
  DbDataCSVConfig,
  DbDataAPICategory,
  DbDataCSVCategory,
  DbDataSourceAudit,
} from '../../types/data-sources';

// ===== Mappers =====

/**
 * Map database row to DataAPIConfig
 */
function mapDbToAPIConfig(row: DbDataAPIConfig, categoryIds: number[]): DataAPIConfig {
  // Parse authentication and decrypt credentials
  let authentication: AuthConfig = { type: 'none' };
  if (row.authentication) {
    try {
      const parsed = JSON.parse(row.authentication);
      authentication = {
        type: parsed.type || 'none',
        credentials: parsed.credentials ? {
          token: parsed.credentials.token ? safeDecrypt(parsed.credentials.token) || undefined : undefined,
          apiKey: parsed.credentials.apiKey ? safeDecrypt(parsed.credentials.apiKey) || undefined : undefined,
          apiKeyHeader: parsed.credentials.apiKeyHeader,
          apiKeyLocation: parsed.credentials.apiKeyLocation,
          username: parsed.credentials.username,
          password: parsed.credentials.password ? safeDecrypt(parsed.credentials.password) || undefined : undefined,
        } : undefined,
      };
    } catch {
      // Keep default if parsing fails
    }
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    endpoint: row.endpoint,
    method: row.method as 'GET' | 'POST',
    responseFormat: row.response_format as 'json' | 'csv',
    authentication,
    headers: row.headers ? JSON.parse(row.headers) : undefined,
    parameters: row.parameters ? JSON.parse(row.parameters) : [],
    responseStructure: row.response_structure ? JSON.parse(row.response_structure) : { jsonPath: '$', dataIsArray: true, fields: [] },
    sampleResponse: row.sample_response ? JSON.parse(row.sample_response) : undefined,
    openApiSpec: row.openapi_spec ? JSON.parse(row.openapi_spec) : undefined,
    configMethod: row.config_method as 'manual' | 'openapi',
    categoryIds,
    status: row.status as 'active' | 'inactive' | 'error' | 'untested',
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastTested: row.last_tested || undefined,
    lastError: row.last_error || undefined,
  };
}

/**
 * Map database row to DataCSVConfig
 */
function mapDbToCSVConfig(row: DbDataCSVConfig, categoryIds: number[]): DataCSVConfig {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    filePath: row.file_path,
    originalFilename: row.original_filename || '',
    columns: row.columns ? JSON.parse(row.columns) : [],
    sampleData: row.sample_data ? JSON.parse(row.sample_data) : [],
    rowCount: row.row_count,
    fileSize: row.file_size,
    categoryIds,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to audit entry
 */
function mapDbToAuditEntry(row: DbDataSourceAudit): DataSourceAuditEntry {
  return {
    id: row.id,
    sourceType: row.source_type as 'api' | 'csv',
    sourceId: row.source_id,
    action: row.action as 'created' | 'updated' | 'tested' | 'deleted',
    changedBy: row.changed_by,
    details: row.details ? JSON.parse(row.details) : undefined,
    changedAt: row.changed_at,
  };
}

// ===== Category Helpers =====

/**
 * Get category IDs for an API
 */
function getAPICategoryIds(apiId: string): number[] {
  const rows = queryAll<DbDataAPICategory>(
    'SELECT category_id FROM data_api_categories WHERE api_id = ?',
    [apiId]
  );
  return rows.map(r => r.category_id);
}

/**
 * Get category IDs for a CSV
 */
function getCSVCategoryIds(csvId: string): number[] {
  const rows = queryAll<DbDataCSVCategory>(
    'SELECT category_id FROM data_csv_categories WHERE csv_id = ?',
    [csvId]
  );
  return rows.map(r => r.category_id);
}

// ===== API Operations =====

/**
 * Create a new API configuration
 */
export function createDataAPI(
  config: Omit<DataAPIConfig, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'lastTested' | 'lastError' | 'status'>,
  createdBy: string
): DataAPIConfig {
  const id = uuidv4();

  // Encrypt credentials before storage
  const authForStorage = config.authentication ? {
    type: config.authentication.type,
    credentials: config.authentication.credentials ? {
      token: config.authentication.credentials.token ? safeEncrypt(config.authentication.credentials.token) : undefined,
      apiKey: config.authentication.credentials.apiKey ? safeEncrypt(config.authentication.credentials.apiKey) : undefined,
      apiKeyHeader: config.authentication.credentials.apiKeyHeader,
      apiKeyLocation: config.authentication.credentials.apiKeyLocation,
      username: config.authentication.credentials.username,
      password: config.authentication.credentials.password ? safeEncrypt(config.authentication.credentials.password) : undefined,
    } : undefined,
  } : { type: 'none' };

  return transaction(() => {
    execute(
      `INSERT INTO data_api_configs (
        id, name, description, endpoint, method, response_format,
        authentication, headers, parameters, response_structure,
        sample_response, openapi_spec, config_method, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'untested', ?)`,
      [
        id,
        config.name,
        config.description || null,
        config.endpoint,
        config.method,
        config.responseFormat,
        JSON.stringify(authForStorage),
        config.headers ? JSON.stringify(config.headers) : null,
        JSON.stringify(config.parameters || []),
        JSON.stringify(config.responseStructure),
        config.sampleResponse ? JSON.stringify(config.sampleResponse) : null,
        config.openApiSpec ? JSON.stringify(config.openApiSpec) : null,
        config.configMethod,
        createdBy,
      ]
    );

    // Set categories
    if (config.categoryIds && config.categoryIds.length > 0) {
      setAPICategoriesInternal(id, config.categoryIds);
    }

    // Log audit
    logDataSourceChangeInternal('api', id, 'created', createdBy, { name: config.name });

    return getDataAPI(id)!;
  });
}

/**
 * Get a single API configuration by ID
 */
export function getDataAPI(id: string): DataAPIConfig | undefined {
  const row = queryOne<DbDataAPIConfig>(
    'SELECT * FROM data_api_configs WHERE id = ?',
    [id]
  );
  if (!row) return undefined;
  return mapDbToAPIConfig(row, getAPICategoryIds(id));
}

/**
 * Get a single API configuration by name
 */
export function getDataAPIByName(name: string): DataAPIConfig | undefined {
  const row = queryOne<DbDataAPIConfig>(
    'SELECT * FROM data_api_configs WHERE name = ?',
    [name]
  );
  if (!row) return undefined;
  return mapDbToAPIConfig(row, getAPICategoryIds(row.id));
}

/**
 * Get all API configurations
 */
export function getAllDataAPIs(): DataAPIConfig[] {
  const rows = queryAll<DbDataAPIConfig>(
    'SELECT * FROM data_api_configs ORDER BY name'
  );
  return rows.map(row => mapDbToAPIConfig(row, getAPICategoryIds(row.id)));
}

/**
 * Get APIs accessible to specific categories (only returns APIs that have at least one category assigned)
 */
export function getDataAPIsForCategories(categoryIds: number[]): DataAPIConfig[] {
  if (categoryIds.length === 0) return [];

  const placeholders = categoryIds.map(() => '?').join(',');
  const rows = queryAll<DbDataAPIConfig>(
    `SELECT DISTINCT a.* FROM data_api_configs a
     INNER JOIN data_api_categories ac ON a.id = ac.api_id
     WHERE ac.category_id IN (${placeholders}) AND a.status = 'active'
     ORDER BY a.name`,
    categoryIds
  );
  return rows.map(row => mapDbToAPIConfig(row, getAPICategoryIds(row.id)));
}

/**
 * Update an API configuration
 */
export function updateDataAPI(
  id: string,
  updates: Partial<Omit<DataAPIConfig, 'id' | 'createdAt' | 'createdBy'>>,
  updatedBy: string
): DataAPIConfig | undefined {
  const existing = getDataAPI(id);
  if (!existing) return undefined;

  return transaction(() => {
    const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push('description = ?');
      values.push(updates.description || null);
    }
    if (updates.endpoint !== undefined) {
      setClauses.push('endpoint = ?');
      values.push(updates.endpoint);
    }
    if (updates.method !== undefined) {
      setClauses.push('method = ?');
      values.push(updates.method);
    }
    if (updates.responseFormat !== undefined) {
      setClauses.push('response_format = ?');
      values.push(updates.responseFormat);
    }
    if (updates.authentication !== undefined) {
      const authForStorage = {
        type: updates.authentication.type,
        credentials: updates.authentication.credentials ? {
          token: updates.authentication.credentials.token ? safeEncrypt(updates.authentication.credentials.token) : undefined,
          apiKey: updates.authentication.credentials.apiKey ? safeEncrypt(updates.authentication.credentials.apiKey) : undefined,
          apiKeyHeader: updates.authentication.credentials.apiKeyHeader,
          apiKeyLocation: updates.authentication.credentials.apiKeyLocation,
          username: updates.authentication.credentials.username,
          password: updates.authentication.credentials.password ? safeEncrypt(updates.authentication.credentials.password) : undefined,
        } : undefined,
      };
      setClauses.push('authentication = ?');
      values.push(JSON.stringify(authForStorage));
    }
    if (updates.headers !== undefined) {
      setClauses.push('headers = ?');
      values.push(updates.headers ? JSON.stringify(updates.headers) : null);
    }
    if (updates.parameters !== undefined) {
      setClauses.push('parameters = ?');
      values.push(JSON.stringify(updates.parameters));
    }
    if (updates.responseStructure !== undefined) {
      setClauses.push('response_structure = ?');
      values.push(JSON.stringify(updates.responseStructure));
    }
    if (updates.sampleResponse !== undefined) {
      setClauses.push('sample_response = ?');
      values.push(updates.sampleResponse ? JSON.stringify(updates.sampleResponse) : null);
    }
    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      values.push(updates.status);
    }
    if (updates.lastTested !== undefined) {
      setClauses.push('last_tested = ?');
      values.push(updates.lastTested);
    }
    if (updates.lastError !== undefined) {
      setClauses.push('last_error = ?');
      values.push(updates.lastError || null);
    }

    values.push(id);

    execute(
      `UPDATE data_api_configs SET ${setClauses.join(', ')} WHERE id = ?`,
      values
    );

    // Update categories if provided
    if (updates.categoryIds !== undefined) {
      setAPICategoriesInternal(id, updates.categoryIds);
    }

    // Log audit
    logDataSourceChangeInternal('api', id, 'updated', updatedBy, { fields: Object.keys(updates) });

    return getDataAPI(id)!;
  });
}

/**
 * Update API status after test
 */
export function updateAPIStatus(
  id: string,
  status: 'active' | 'inactive' | 'error' | 'untested',
  updatedBy: string,
  error?: string
): void {
  execute(
    `UPDATE data_api_configs
     SET status = ?, last_tested = CURRENT_TIMESTAMP, last_error = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, error || null, id]
  );
  logDataSourceChangeInternal('api', id, 'tested', updatedBy, { status, error });
}

/**
 * Delete an API configuration
 */
export function deleteDataAPI(id: string, deletedBy: string): boolean {
  const existing = getDataAPI(id);
  if (!existing) return false;

  return transaction(() => {
    // Log audit first
    logDataSourceChangeInternal('api', id, 'deleted', deletedBy, { name: existing.name });

    // Delete (cascades to data_api_categories)
    execute('DELETE FROM data_api_configs WHERE id = ?', [id]);
    return true;
  });
}

/**
 * Set categories for an API (internal, no audit)
 */
function setAPICategoriesInternal(apiId: string, categoryIds: number[]): void {
  // Remove existing
  execute('DELETE FROM data_api_categories WHERE api_id = ?', [apiId]);

  // Add new
  for (const categoryId of categoryIds) {
    execute(
      'INSERT INTO data_api_categories (api_id, category_id) VALUES (?, ?)',
      [apiId, categoryId]
    );
  }
}

/**
 * Set categories for an API
 */
export function setAPICategories(apiId: string, categoryIds: number[], updatedBy: string): void {
  transaction(() => {
    setAPICategoriesInternal(apiId, categoryIds);
    logDataSourceChangeInternal('api', apiId, 'updated', updatedBy, { categoryIds });
  });
}

// ===== CSV Operations =====

/**
 * Create a new CSV configuration
 */
export function createDataCSV(
  config: Omit<DataCSVConfig, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
  createdBy: string
): DataCSVConfig {
  const id = uuidv4();

  return transaction(() => {
    execute(
      `INSERT INTO data_csv_configs (
        id, name, description, file_path, original_filename,
        columns, sample_data, row_count, file_size, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        config.name,
        config.description || null,
        config.filePath,
        config.originalFilename || null,
        JSON.stringify(config.columns || []),
        JSON.stringify(config.sampleData || []),
        config.rowCount,
        config.fileSize,
        createdBy,
      ]
    );

    // Set categories
    if (config.categoryIds && config.categoryIds.length > 0) {
      setCSVCategoriesInternal(id, config.categoryIds);
    }

    // Log audit
    logDataSourceChangeInternal('csv', id, 'created', createdBy, { name: config.name });

    return getDataCSV(id)!;
  });
}

/**
 * Get a single CSV configuration by ID
 */
export function getDataCSV(id: string): DataCSVConfig | undefined {
  const row = queryOne<DbDataCSVConfig>(
    'SELECT * FROM data_csv_configs WHERE id = ?',
    [id]
  );
  if (!row) return undefined;
  return mapDbToCSVConfig(row, getCSVCategoryIds(id));
}

/**
 * Get a single CSV configuration by name
 */
export function getDataCSVByName(name: string): DataCSVConfig | undefined {
  const row = queryOne<DbDataCSVConfig>(
    'SELECT * FROM data_csv_configs WHERE name = ?',
    [name]
  );
  if (!row) return undefined;
  return mapDbToCSVConfig(row, getCSVCategoryIds(row.id));
}

/**
 * Get all CSV configurations
 */
export function getAllDataCSVs(): DataCSVConfig[] {
  const rows = queryAll<DbDataCSVConfig>(
    'SELECT * FROM data_csv_configs ORDER BY name'
  );
  return rows.map(row => mapDbToCSVConfig(row, getCSVCategoryIds(row.id)));
}

/**
 * Get CSVs accessible to specific categories
 */
export function getDataCSVsForCategories(categoryIds: number[]): DataCSVConfig[] {
  if (categoryIds.length === 0) return [];

  const placeholders = categoryIds.map(() => '?').join(',');
  const rows = queryAll<DbDataCSVConfig>(
    `SELECT DISTINCT c.* FROM data_csv_configs c
     INNER JOIN data_csv_categories cc ON c.id = cc.csv_id
     WHERE cc.category_id IN (${placeholders})
     ORDER BY c.name`,
    categoryIds
  );
  return rows.map(row => mapDbToCSVConfig(row, getCSVCategoryIds(row.id)));
}

/**
 * Update a CSV configuration
 */
export function updateDataCSV(
  id: string,
  updates: Partial<Omit<DataCSVConfig, 'id' | 'createdAt' | 'createdBy'>>,
  updatedBy: string
): DataCSVConfig | undefined {
  const existing = getDataCSV(id);
  if (!existing) return undefined;

  return transaction(() => {
    const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push('description = ?');
      values.push(updates.description || null);
    }
    if (updates.columns !== undefined) {
      setClauses.push('columns = ?');
      values.push(JSON.stringify(updates.columns));
    }
    if (updates.sampleData !== undefined) {
      setClauses.push('sample_data = ?');
      values.push(JSON.stringify(updates.sampleData));
    }
    if (updates.rowCount !== undefined) {
      setClauses.push('row_count = ?');
      values.push(updates.rowCount);
    }

    values.push(id);

    execute(
      `UPDATE data_csv_configs SET ${setClauses.join(', ')} WHERE id = ?`,
      values
    );

    // Update categories if provided
    if (updates.categoryIds !== undefined) {
      setCSVCategoriesInternal(id, updates.categoryIds);
    }

    // Log audit
    logDataSourceChangeInternal('csv', id, 'updated', updatedBy, { fields: Object.keys(updates) });

    return getDataCSV(id)!;
  });
}

/**
 * Delete a CSV configuration
 */
export function deleteDataCSV(id: string, deletedBy: string): boolean {
  const existing = getDataCSV(id);
  if (!existing) return false;

  return transaction(() => {
    // Log audit first
    logDataSourceChangeInternal('csv', id, 'deleted', deletedBy, { name: existing.name });

    // Delete (cascades to data_csv_categories)
    execute('DELETE FROM data_csv_configs WHERE id = ?', [id]);
    return true;
  });
}

/**
 * Set categories for a CSV (internal, no audit)
 */
function setCSVCategoriesInternal(csvId: string, categoryIds: number[]): void {
  // Remove existing
  execute('DELETE FROM data_csv_categories WHERE csv_id = ?', [csvId]);

  // Add new
  for (const categoryId of categoryIds) {
    execute(
      'INSERT INTO data_csv_categories (csv_id, category_id) VALUES (?, ?)',
      [csvId, categoryId]
    );
  }
}

/**
 * Set categories for a CSV
 */
export function setCSVCategories(csvId: string, categoryIds: number[], updatedBy: string): void {
  transaction(() => {
    setCSVCategoriesInternal(csvId, categoryIds);
    logDataSourceChangeInternal('csv', csvId, 'updated', updatedBy, { categoryIds });
  });
}

// ===== Unified Operations =====

/**
 * Get all data sources (APIs and CSVs) accessible to specific categories
 */
export function getAllDataSourcesForCategories(categoryIds: number[]): DataSource[] {
  const apis = getDataAPIsForCategories(categoryIds);
  const csvs = getDataCSVsForCategories(categoryIds);

  const sources: DataSource[] = [
    ...apis.map(config => ({ type: 'api' as const, config })),
    ...csvs.map(config => ({ type: 'csv' as const, config })),
  ];

  // Sort by name
  return sources.sort((a, b) => a.config.name.localeCompare(b.config.name));
}

/**
 * Get a data source by name (searches both APIs and CSVs)
 */
export function getDataSourceByName(name: string): DataSource | undefined {
  const api = getDataAPIByName(name);
  if (api) return { type: 'api', config: api };

  const csv = getDataCSVByName(name);
  if (csv) return { type: 'csv', config: csv };

  return undefined;
}

/**
 * Get all data sources (for admin)
 */
export function getAllDataSources(): DataSource[] {
  const apis = getAllDataAPIs();
  const csvs = getAllDataCSVs();

  const sources: DataSource[] = [
    ...apis.map(config => ({ type: 'api' as const, config })),
    ...csvs.map(config => ({ type: 'csv' as const, config })),
  ];

  return sources.sort((a, b) => a.config.name.localeCompare(b.config.name));
}

// ===== Audit Operations =====

/**
 * Log a data source change (internal)
 */
function logDataSourceChangeInternal(
  sourceType: 'api' | 'csv',
  sourceId: string,
  action: 'created' | 'updated' | 'tested' | 'deleted',
  changedBy: string,
  details?: Record<string, unknown>
): void {
  execute(
    `INSERT INTO data_source_audit (source_type, source_id, action, changed_by, details)
     VALUES (?, ?, ?, ?, ?)`,
    [sourceType, sourceId, action, changedBy, details ? JSON.stringify(details) : null]
  );
}

/**
 * Log a data source change (public)
 */
export function logDataSourceChange(
  sourceType: 'api' | 'csv',
  sourceId: string,
  action: 'created' | 'updated' | 'tested' | 'deleted',
  changedBy: string,
  details?: Record<string, unknown>
): void {
  logDataSourceChangeInternal(sourceType, sourceId, action, changedBy, details);
}

/**
 * Get audit history for a data source
 */
export function getDataSourceAuditHistory(
  sourceType: 'api' | 'csv',
  sourceId: string,
  limit: number = 50
): DataSourceAuditEntry[] {
  const rows = queryAll<DbDataSourceAudit>(
    `SELECT * FROM data_source_audit
     WHERE source_type = ? AND source_id = ?
     ORDER BY changed_at DESC
     LIMIT ?`,
    [sourceType, sourceId, limit]
  );
  return rows.map(mapDbToAuditEntry);
}

/**
 * Get all audit history (for admin)
 */
export function getAllDataSourceAuditHistory(limit: number = 100): DataSourceAuditEntry[] {
  const rows = queryAll<DbDataSourceAudit>(
    `SELECT * FROM data_source_audit
     ORDER BY changed_at DESC
     LIMIT ?`,
    [limit]
  );
  return rows.map(mapDbToAuditEntry);
}
