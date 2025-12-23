/**
 * Chart Generator Tool Types
 *
 * Types for the chart_gen autonomous tool that generates
 * visualizations from LLM-constructed data.
 */

import type { ChartType, VisualizationHint } from './data-sources';

// ===== Tool Input Types =====

/**
 * Valid chart type recommendations
 */
export type ChartGenRecommendation =
  | 'bar'
  | 'line'
  | 'pie'
  | 'area'
  | 'scatter'
  | 'radar'
  | 'table'
  | 'auto';

/**
 * Series display mode for multiple y_fields
 */
export type SeriesMode = 'grouped' | 'stacked' | 'auto';

/**
 * Arguments passed to chart_gen tool by the LLM
 */
export interface ChartGenToolArgs {
  /** Descriptive chart title */
  title: string;
  /** Array of data objects to visualize */
  data: Record<string, unknown>[];
  /** Field name for X-axis (categories) */
  x_field: string;
  /** Field name(s) for Y-axis values */
  y_fields: string[];
  /** LLM-recommended chart type */
  recommended_chart?: ChartGenRecommendation;
  /** How to display multiple series: grouped (side-by-side) or stacked */
  series_mode?: SeriesMode;
  /** Optional notes about data sources/methodology */
  notes?: string;
}

// ===== Tool Output Types =====

/**
 * Successful chart generation result
 */
export interface ChartGenResult {
  success: true;
  /** Data to visualize */
  data: Record<string, unknown>[];
  /** Metadata about the generation */
  metadata: ChartGenMetadata;
  /** Visualization configuration */
  visualizationHint: VisualizationHint;
  /** Chart title */
  chartTitle: string;
  /** Optional notes displayed below chart */
  notes?: string;
  /** Series display mode */
  seriesMode?: SeriesMode;
}

/**
 * Failed chart generation result
 */
export interface ChartGenError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
  };
}

/**
 * Combined result type
 */
export type ChartGenResponse = ChartGenResult | ChartGenError;

/**
 * Metadata for chart generation
 */
export interface ChartGenMetadata {
  /** Always "LLM Generated" */
  source: string;
  /** Always "chart_gen" */
  sourceType: 'chart_gen';
  /** Number of data rows */
  recordCount: number;
  /** Field names in the data */
  fields: string[];
  /** Processing time (always 0 for local generation) */
  executionTimeMs: number;
  /** Always false for generated data */
  cached: false;
}

// ===== Configuration Types =====

/**
 * Tool configuration schema
 */
export interface ChartGenConfig {
  /** Maximum allowed data rows */
  maxDataRows: number;
  /** Default chart type when 'auto' selected */
  defaultChartType: ChartType;
  /** Enabled chart types */
  enabledChartTypes: ChartType[];
}

// ===== Validation Types =====

/**
 * Validation result for tool arguments
 */
export interface ChartGenValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
