/**
 * Data Sources Type Definitions
 *
 * Types for external API and CSV data source configurations,
 * query parameters, responses, and visualization.
 */

// ===== API Parameter Types =====

/**
 * Parameter definition for API endpoints
 */
export interface DataAPIParameter {
  /** Parameter name */
  name: string;
  /** Data type */
  type: 'string' | 'integer' | 'number' | 'boolean' | 'array';
  /** Where the parameter is sent */
  in: 'query' | 'path' | 'header' | 'body';
  /** Human-readable description */
  description: string;
  /** Whether the parameter is required */
  required: boolean;
  /** Default value if not provided */
  default?: unknown;
  /** Example value for documentation */
  example?: unknown;
  /** List of allowed values (enum) */
  allowedValues?: unknown[];
}

// ===== Response Structure Types =====

/**
 * Field definition in API response
 */
export interface ResponseField {
  /** Field name in the response */
  name: string;
  /** Data type of the field */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date';
  /** Human-readable description */
  description: string;
  /** Format hint (e.g., 'currency', 'percentage', 'date') */
  format?: string;
  /** Nested fields for object/array types */
  nestedFields?: ResponseField[];
}

/**
 * Response structure definition
 */
export interface ResponseStructure {
  /** JSONPath to the data array in the response (e.g., "data.results" or "$") */
  jsonPath: string;
  /** Whether the data at jsonPath is an array */
  dataIsArray: boolean;
  /** Fields in the response data */
  fields: ResponseField[];
  /** JSONPath to total count for pagination */
  totalCountPath?: string;
}

// ===== Authentication Types =====

/**
 * Authentication configuration for API endpoints
 */
export interface AuthConfig {
  /** Authentication type */
  type: 'none' | 'bearer' | 'api_key' | 'basic';
  /** Credential details (values are encrypted in storage) */
  credentials?: {
    /** Bearer token (encrypted) */
    token?: string;
    /** API key value (encrypted) */
    apiKey?: string;
    /** Header name for API key (e.g., 'X-API-Key', 'Authorization') */
    apiKeyHeader?: string;
    /** Where to send API key */
    apiKeyLocation?: 'header' | 'query';
    /** Username for basic auth */
    username?: string;
    /** Password for basic auth (encrypted) */
    password?: string;
  };
}

// ===== API Configuration Types =====

/**
 * Main API configuration
 */
export interface DataAPIConfig {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of what this API provides */
  description: string;
  /** Base endpoint URL */
  endpoint: string;
  /** HTTP method */
  method: 'GET' | 'POST';
  /** Expected response format */
  responseFormat: 'json' | 'csv';
  /** Authentication configuration */
  authentication: AuthConfig;
  /** Custom headers to include */
  headers?: Record<string, string>;
  /** Parameter definitions */
  parameters: DataAPIParameter[];
  /** Response structure definition */
  responseStructure: ResponseStructure;
  /** Sample response for LLM context */
  sampleResponse?: Record<string, unknown>;
  /** Original OpenAPI spec if uploaded */
  openApiSpec?: Record<string, unknown>;
  /** How this API was configured */
  configMethod: 'manual' | 'openapi';
  /** Category IDs this API is linked to */
  categoryIds: number[];
  /** Current status */
  status: 'active' | 'inactive' | 'error' | 'untested';
  /** User who created this */
  createdBy: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Last successful test timestamp */
  lastTested?: string;
  /** Last error message */
  lastError?: string;
}

// ===== CSV Configuration Types =====

/**
 * Column definition for CSV data
 */
export interface CSVColumn {
  /** Column name */
  name: string;
  /** Inferred data type */
  type: 'string' | 'number' | 'boolean' | 'date';
  /** Human-readable description */
  description: string;
  /** Format hint (e.g., 'currency', 'percentage') */
  format?: string;
}

/**
 * CSV data source configuration
 */
export interface DataCSVConfig {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of the data */
  description: string;
  /** Path to stored CSV file */
  filePath: string;
  /** Original filename when uploaded */
  originalFilename: string;
  /** Column definitions */
  columns: CSVColumn[];
  /** Sample data rows (first 5 rows) */
  sampleData: Record<string, unknown>[];
  /** Total row count */
  rowCount: number;
  /** File size in bytes */
  fileSize: number;
  /** Category IDs this CSV is linked to */
  categoryIds: number[];
  /** User who created this */
  createdBy: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

// ===== Unified Data Source Type =====

/**
 * Unified data source type (discriminated union)
 */
export type DataSource =
  | { type: 'api'; config: DataAPIConfig }
  | { type: 'csv'; config: DataCSVConfig };

// ===== Aggregation Types =====

/**
 * Supported aggregation operations
 */
export type AggregationOperation = 'count' | 'sum' | 'avg' | 'min' | 'max';

/**
 * Metric definition for aggregation
 */
export interface AggregationMetric {
  /** Field to aggregate */
  field: string;
  /** Aggregation operation */
  operation: AggregationOperation;
}

/**
 * Aggregation configuration for data queries
 */
export interface AggregationConfig {
  /** Field(s) to group results by - single field or array for multi-dimensional grouping */
  group_by: string | string[];
  /** Metrics to compute for each group */
  metrics?: AggregationMetric[];
}

/**
 * Single aggregated result row
 * Contains the group key, count, and any computed metrics
 */
export interface AggregatedRow {
  /** Count of records in this group */
  count: number;
  /** Dynamic fields for group key and computed metrics */
  [key: string]: unknown;
}

/**
 * Response containing aggregated data
 */
export interface AggregatedDataResponse {
  /** Whether the aggregation succeeded */
  success: boolean;
  /** Aggregated results */
  data: AggregatedRow[] | null;
  /** Aggregation metadata */
  metadata: DataQueryMetadata & {
    /** Indicates response contains aggregated data */
    aggregated: true;
    /** The field(s) data was grouped by */
    groupedBy: string | string[];
  };
  /** Error information if failed */
  error?: DataQueryError;
}

// ===== Query Types =====

/**
 * Filter condition for querying data
 */
export interface DataFilter {
  /** Field to filter on */
  field: string;
  /** Comparison operator */
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in';
  /** Value to compare against */
  value: unknown;
}

/**
 * Sort configuration
 */
export interface DataSort {
  /** Field to sort by */
  field: string;
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/**
 * Query parameters for data sources
 */
export interface DataQueryParams {
  /** Name of the data source to query */
  sourceName: string;
  /** Type of data source */
  sourceType: 'api' | 'csv';
  /** Parameters to pass to API */
  parameters?: Record<string, unknown>;
  /** Filter conditions */
  filters?: DataFilter[];
  /** Sort configuration */
  sort?: DataSort;
  /** Maximum records to return */
  limit?: number;
  /** Records to skip */
  offset?: number;
}

// ===== Response Types =====

/**
 * Metadata about a data query response
 */
export interface DataQueryMetadata {
  /** Name of the data source */
  source: string;
  /** Type of data source */
  sourceType: 'api' | 'csv';
  /** When the data was fetched */
  fetchedAt: string;
  /** Whether response was from cache */
  cached: boolean;
  /** Number of records returned */
  recordCount: number;
  /** Total records available (if known) */
  totalRecords?: number;
  /** Field names in the response */
  fields: string[];
  /** Execution time in milliseconds */
  executionTimeMs: number;
}

/**
 * Error information in response
 */
export interface DataQueryError {
  /** Error code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Additional details */
  details?: string;
}

/**
 * Response from a data query
 */
export interface DataQueryResponse {
  /** Whether the query succeeded */
  success: boolean;
  /** Query results */
  data: Record<string, unknown>[] | null;
  /** Response metadata */
  metadata: DataQueryMetadata;
  /** Error information if failed */
  error?: DataQueryError;
}

// ===== Visualization Types =====

/**
 * Supported chart types
 */
export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'radar' | 'table';

/**
 * Axis configuration
 */
export interface AxisConfig {
  /** Field to use for this axis */
  field: string;
  /** Display label */
  label: string;
}

/**
 * Series configuration for charts
 */
export interface SeriesConfig {
  /** Field containing series data */
  field: string;
  /** Display label */
  label: string;
  /** Custom color (hex) */
  color?: string;
}

/**
 * Visualization configuration
 */
export interface VisualizationConfig {
  /** Type of chart */
  chartType: ChartType;
  /** Chart title */
  title: string;
  /** X-axis configuration */
  xAxis?: AxisConfig;
  /** Y-axis configuration */
  yAxis?: AxisConfig;
  /** Data series configurations */
  series?: SeriesConfig[];
  /** Field to group data by */
  groupBy?: string;
  /** Aggregation function */
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
}

/**
 * Visualization request hint from tool
 */
export interface VisualizationHint {
  /** Suggested chart type */
  chartType: ChartType;
  /** Field for X axis */
  xField?: string;
  /** Field for Y axis */
  yField?: string;
  /** Field to group by */
  groupBy?: string;
}

/**
 * Complete data visualization result
 */
export interface DataVisualizationResult {
  /** Mandatory text analysis of the data */
  analysis: string;
  /** Visualization configuration and data */
  visualization: {
    /** Chart type */
    type: ChartType;
    /** Full visualization config */
    config: VisualizationConfig;
    /** Data for the chart */
    data: Record<string, unknown>[];
  };
  /** Optional raw data */
  rawData?: Record<string, unknown>[];
}

// ===== Audit Types =====

/**
 * Audit log entry for data source changes
 */
export interface DataSourceAuditEntry {
  /** Entry ID */
  id: number;
  /** Type of data source */
  sourceType: 'api' | 'csv';
  /** ID of the data source */
  sourceId: string;
  /** Action performed */
  action: 'created' | 'updated' | 'tested' | 'deleted';
  /** User who made the change */
  changedBy: string;
  /** Additional details (JSON) */
  details?: Record<string, unknown>;
  /** When the change was made */
  changedAt: string;
}

// ===== Database Row Types =====

/**
 * Database row for data_api_configs table
 */
export interface DbDataAPIConfig {
  id: string;
  name: string;
  description: string | null;
  endpoint: string;
  method: string;
  response_format: string;
  authentication: string | null;
  headers: string | null;
  parameters: string | null;
  response_structure: string | null;
  sample_response: string | null;
  openapi_spec: string | null;
  config_method: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_tested: string | null;
  last_error: string | null;
}

/**
 * Database row for data_csv_configs table
 */
export interface DbDataCSVConfig {
  id: string;
  name: string;
  description: string | null;
  file_path: string;
  original_filename: string | null;
  columns: string | null;
  sample_data: string | null;
  row_count: number;
  file_size: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Database row for data_api_categories table
 */
export interface DbDataAPICategory {
  api_id: string;
  category_id: number;
  created_at: string;
}

/**
 * Database row for data_csv_categories table
 */
export interface DbDataCSVCategory {
  csv_id: string;
  category_id: number;
  created_at: string;
}

/**
 * Database row for data_source_audit table
 */
export interface DbDataSourceAudit {
  id: number;
  source_type: string;
  source_id: string;
  action: string;
  changed_by: string;
  details: string | null;
  changed_at: string;
}
