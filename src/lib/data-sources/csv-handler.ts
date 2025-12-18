/**
 * CSV File Handler
 *
 * Handles parsing, storing, and querying CSV data sources.
 */

import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';
import type {
  CSVColumn,
  DataFilter,
  DataSort,
  DataQueryResponse,
  AggregationConfig,
} from '../../types/data-sources';
import { aggregateData } from './aggregation';

// ===== Types =====

/**
 * Options for parsing CSV files
 */
export interface CSVParseOptions {
  /** Column delimiter (default: ',') */
  delimiter?: string;
  /** Whether first row is header (default: true) */
  hasHeader?: boolean;
  /** Skip first N rows */
  skipRows?: number;
  /** Encoding (default: 'utf-8') */
  encoding?: BufferEncoding;
}

/**
 * Result of parsing a CSV file
 */
export interface CSVParseResult {
  /** Inferred column definitions */
  columns: CSVColumn[];
  /** Sample data (first 5 rows) */
  sampleData: Record<string, unknown>[];
  /** Total row count */
  rowCount: number;
  /** All parsed data */
  data: Record<string, unknown>[];
}

// ===== Parsing =====

/**
 * Parse a CSV file buffer into structured data
 */
export function parseCSVBuffer(
  buffer: Buffer,
  options: CSVParseOptions = {}
): CSVParseResult {
  const {
    delimiter = ',',
    hasHeader = true,
    skipRows = 0,
    encoding = 'utf-8',
  } = options;

  // Convert buffer to string
  const content = buffer.toString(encoding);

  // Parse CSV
  const records = parse(content, {
    delimiter,
    columns: hasHeader,
    skip_empty_lines: true,
    from_line: skipRows + 1,
    relax_column_count: true,
    trim: true,
  }) as unknown as Record<string, string>[];

  if (records.length === 0) {
    return {
      columns: [],
      sampleData: [],
      rowCount: 0,
      data: [],
    };
  }

  // Get column names
  const columnNames = Object.keys(records[0]);

  // Infer column types from sample data
  const columns = inferColumnTypes(columnNames, records.slice(0, 100));

  // Convert data types
  const data = records.map(record => convertRecordTypes(record, columns));

  // Get sample data (first 5 rows)
  const sampleData = data.slice(0, 5);

  return {
    columns,
    sampleData,
    rowCount: data.length,
    data,
  };
}

/**
 * Parse a CSV file from disk
 */
export function parseCSVFile(
  filePath: string,
  options: CSVParseOptions = {}
): CSVParseResult {
  const buffer = fs.readFileSync(filePath);
  return parseCSVBuffer(buffer, options);
}

/**
 * Infer column types from sample data
 */
function inferColumnTypes(
  columnNames: string[],
  samples: Record<string, string>[]
): CSVColumn[] {
  return columnNames.map(name => {
    const values = samples.map(row => row[name]).filter(v => v !== '' && v !== null && v !== undefined);
    const type = inferTypeFromValues(values);

    return {
      name,
      type,
      description: '', // User can fill this in
      format: inferFormat(values, type),
    };
  });
}

/**
 * Infer data type from array of string values
 */
function inferTypeFromValues(values: string[]): 'string' | 'number' | 'boolean' | 'date' {
  if (values.length === 0) return 'string';

  // Check for boolean
  const booleanPattern = /^(true|false|yes|no|1|0)$/i;
  const allBoolean = values.every(v => booleanPattern.test(v));
  if (allBoolean) return 'boolean';

  // Check for date
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/,              // ISO date: 2024-01-15
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/,   // ISO datetime
    /^\d{2}\/\d{2}\/\d{4}$/,            // US date: 01/15/2024
    /^\d{2}-\d{2}-\d{4}$/,              // EU date: 15-01-2024
  ];
  const dateMatches = values.filter(v =>
    datePatterns.some(pattern => pattern.test(v)) || !isNaN(Date.parse(v))
  );
  if (dateMatches.length > values.length * 0.8) return 'date';

  // Check for number
  const numberPattern = /^-?\d*\.?\d+$/;
  const currencyPattern = /^[\$€£¥]?\s*-?\d{1,3}(,\d{3})*(\.\d+)?$/;
  const percentPattern = /^-?\d*\.?\d+%$/;

  const numericMatches = values.filter(v => {
    const cleaned = v.replace(/[$€£¥,\s%]/g, '');
    return numberPattern.test(cleaned) || currencyPattern.test(v) || percentPattern.test(v);
  });
  if (numericMatches.length > values.length * 0.8) return 'number';

  return 'string';
}

/**
 * Infer format hint from values
 */
function inferFormat(values: string[], type: string): string | undefined {
  if (type !== 'number' || values.length === 0) return undefined;

  // Check for currency
  if (values.some(v => /^[\$€£¥]/.test(v))) return 'currency';

  // Check for percentage
  if (values.some(v => /%$/.test(v))) return 'percentage';

  return undefined;
}

/**
 * Convert record values to appropriate types
 */
function convertRecordTypes(
  record: Record<string, string>,
  columns: CSVColumn[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const column of columns) {
    const value = record[column.name];

    if (value === '' || value === null || value === undefined) {
      result[column.name] = null;
      continue;
    }

    switch (column.type) {
      case 'number':
        // Remove currency symbols and commas
        const cleaned = value.replace(/[$€£¥,\s%]/g, '');
        const num = parseFloat(cleaned);
        result[column.name] = isNaN(num) ? null : num;
        break;

      case 'boolean':
        const lower = value.toLowerCase();
        result[column.name] = lower === 'true' || lower === 'yes' || lower === '1';
        break;

      case 'date':
        const date = new Date(value);
        result[column.name] = isNaN(date.getTime()) ? value : date.toISOString();
        break;

      default:
        result[column.name] = value;
    }
  }

  return result;
}

// ===== Querying =====

/**
 * Query CSV data from a stored file with filters, sorting, and pagination
 */
export function queryCSVData(
  filePath: string,
  filters?: DataFilter[],
  sort?: DataSort,
  limit?: number,
  offset?: number
): DataQueryResponse {
  const startTime = Date.now();

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        data: null,
        metadata: {
          source: path.basename(filePath),
          sourceType: 'csv',
          fetchedAt: new Date().toISOString(),
          cached: false,
          recordCount: 0,
          fields: [],
          executionTimeMs: Date.now() - startTime,
        },
        error: {
          code: 'FILE_NOT_FOUND',
          message: `CSV file not found: ${filePath}`,
        },
      };
    }

    // Parse the file
    const parsed = parseCSVFile(filePath);
    let data = parsed.data;

    // Apply filters
    if (filters && filters.length > 0) {
      data = applyFilters(data, filters);
    }

    // Apply sorting
    if (sort) {
      data = applySorting(data, sort);
    }

    const totalRecords = data.length;

    // Apply pagination
    if (offset !== undefined && offset > 0) {
      data = data.slice(offset);
    }
    if (limit !== undefined && limit > 0) {
      data = data.slice(0, limit);
    }

    return {
      success: true,
      data,
      metadata: {
        source: path.basename(filePath),
        sourceType: 'csv',
        fetchedAt: new Date().toISOString(),
        cached: false,
        recordCount: data.length,
        totalRecords,
        fields: parsed.columns.map(c => c.name),
        executionTimeMs: Date.now() - startTime,
      },
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      metadata: {
        source: path.basename(filePath),
        sourceType: 'csv',
        fetchedAt: new Date().toISOString(),
        cached: false,
        recordCount: 0,
        fields: [],
        executionTimeMs: Date.now() - startTime,
      },
      error: {
        code: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error querying CSV',
      },
    };
  }
}

/**
 * Apply filters to data
 */
function applyFilters(
  data: Record<string, unknown>[],
  filters: DataFilter[]
): Record<string, unknown>[] {
  return data.filter(record => {
    return filters.every(filter => {
      const value = record[filter.field];
      const filterValue = filter.value;

      switch (filter.operator) {
        case 'eq':
          return value === filterValue;

        case 'ne':
          return value !== filterValue;

        case 'gt':
          return typeof value === 'number' && typeof filterValue === 'number'
            ? value > filterValue
            : String(value) > String(filterValue);

        case 'lt':
          return typeof value === 'number' && typeof filterValue === 'number'
            ? value < filterValue
            : String(value) < String(filterValue);

        case 'gte':
          return typeof value === 'number' && typeof filterValue === 'number'
            ? value >= filterValue
            : String(value) >= String(filterValue);

        case 'lte':
          return typeof value === 'number' && typeof filterValue === 'number'
            ? value <= filterValue
            : String(value) <= String(filterValue);

        case 'contains':
          return typeof value === 'string' && typeof filterValue === 'string'
            ? value.toLowerCase().includes(filterValue.toLowerCase())
            : false;

        case 'in':
          return Array.isArray(filterValue) && filterValue.includes(value);

        default:
          return true;
      }
    });
  });
}

/**
 * Apply sorting to data
 */
function applySorting(
  data: Record<string, unknown>[],
  sort: DataSort
): Record<string, unknown>[] {
  return [...data].sort((a, b) => {
    const aVal = a[sort.field];
    const bVal = b[sort.field];

    // Handle nulls
    if (aVal === null || aVal === undefined) return sort.direction === 'asc' ? 1 : -1;
    if (bVal === null || bVal === undefined) return sort.direction === 'asc' ? -1 : 1;

    // Compare values
    let comparison: number;
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    } else {
      comparison = String(aVal).localeCompare(String(bVal));
    }

    return sort.direction === 'asc' ? comparison : -comparison;
  });
}

// ===== Aggregation =====

/**
 * Query CSV data with aggregation (server-side)
 * Returns compact aggregated results instead of raw records
 */
export function queryCSVDataWithAggregation(
  filePath: string,
  aggregation: AggregationConfig,
  filters?: DataFilter[]
): DataQueryResponse {
  const startTime = Date.now();

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        data: null,
        metadata: {
          source: path.basename(filePath),
          sourceType: 'csv',
          fetchedAt: new Date().toISOString(),
          cached: false,
          recordCount: 0,
          fields: [],
          executionTimeMs: Date.now() - startTime,
        },
        error: {
          code: 'FILE_NOT_FOUND',
          message: `CSV file not found: ${filePath}`,
        },
      };
    }

    // Parse the file
    const parsed = parseCSVFile(filePath);
    let data = parsed.data;

    // Apply filters first
    if (filters && filters.length > 0) {
      data = applyFilters(data, filters);
    }

    const totalRecords = data.length;

    // Aggregate the data
    const aggregatedData = aggregateData(data, aggregation);

    // Build field names for the aggregated result
    const aggregatedFields = [aggregation.group_by, 'count'];
    if (aggregation.metrics) {
      for (const metric of aggregation.metrics) {
        aggregatedFields.push(`${metric.field}_${metric.operation}`);
      }
    }

    return {
      success: true,
      data: aggregatedData as unknown as Record<string, unknown>[],
      metadata: {
        source: path.basename(filePath),
        sourceType: 'csv',
        fetchedAt: new Date().toISOString(),
        cached: false,
        recordCount: aggregatedData.length,
        totalRecords,
        fields: aggregatedFields,
        executionTimeMs: Date.now() - startTime,
      },
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      metadata: {
        source: path.basename(filePath),
        sourceType: 'csv',
        fetchedAt: new Date().toISOString(),
        cached: false,
        recordCount: 0,
        fields: [],
        executionTimeMs: Date.now() - startTime,
      },
      error: {
        code: 'AGGREGATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error aggregating CSV',
      },
    };
  }
}

// ===== File Storage =====

/**
 * Get the storage path for CSV files
 */
export function getCSVStoragePath(): string {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const csvDir = path.join(dataDir, 'csv-sources');

  // Ensure directory exists
  if (!fs.existsSync(csvDir)) {
    fs.mkdirSync(csvDir, { recursive: true });
  }

  return csvDir;
}

/**
 * Store a CSV file
 */
export function storeCSVFile(
  buffer: Buffer,
  originalFilename: string
): { filePath: string; fileSize: number } {
  const csvDir = getCSVStoragePath();
  const timestamp = Date.now();
  const safeFilename = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = `${timestamp}_${safeFilename}`;
  const filePath = path.join(csvDir, filename);

  fs.writeFileSync(filePath, buffer);

  return {
    filePath,
    fileSize: buffer.length,
  };
}

/**
 * Delete a CSV file
 */
export function deleteCSVFile(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
