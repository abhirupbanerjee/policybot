/**
 * Data Aggregation Utility
 *
 * Provides server-side aggregation for large datasets to reduce token usage.
 * Works with both CSV and API data sources.
 */

import type {
  AggregationConfig,
  AggregationMetric,
  AggregatedRow,
} from '../../types/data-sources';

/**
 * Aggregate data by grouping and computing metrics
 *
 * @param data - Array of records to aggregate
 * @param config - Aggregation configuration
 * @returns Array of aggregated results
 */
export function aggregateData(
  data: Record<string, unknown>[],
  config: AggregationConfig
): AggregatedRow[] {
  if (!data || data.length === 0) {
    return [];
  }

  const { group_by, metrics } = config;

  // Group records by the specified field
  const groups = new Map<string, Record<string, unknown>[]>();

  for (const record of data) {
    const groupValue = String(record[group_by] ?? 'null');
    if (!groups.has(groupValue)) {
      groups.set(groupValue, []);
    }
    groups.get(groupValue)!.push(record);
  }

  // Compute aggregations for each group
  const results: AggregatedRow[] = [];

  for (const [groupValue, records] of groups) {
    const row: AggregatedRow = {
      [group_by]: groupValue === 'null' ? null : groupValue,
      count: records.length,
    };

    // Compute additional metrics if specified
    if (metrics && metrics.length > 0) {
      for (const metric of metrics) {
        const metricKey = `${metric.field}_${metric.operation}`;
        row[metricKey] = computeMetric(records, metric);
      }
    }

    results.push(row);
  }

  // Sort by count descending (most common first)
  results.sort((a, b) => b.count - a.count);

  return results;
}

/**
 * Compute a single metric for a group of records
 */
function computeMetric(
  records: Record<string, unknown>[],
  metric: AggregationMetric
): number | null {
  const { field, operation } = metric;

  // Extract numeric values from the field
  const values: number[] = [];
  for (const record of records) {
    const value = record[field];
    if (typeof value === 'number' && !isNaN(value)) {
      values.push(value);
    } else if (typeof value === 'string') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        values.push(num);
      }
    }
  }

  if (values.length === 0) {
    return null;
  }

  switch (operation) {
    case 'count':
      return values.length;

    case 'sum':
      return roundToDecimal(values.reduce((sum, v) => sum + v, 0), 2);

    case 'avg':
      return roundToDecimal(values.reduce((sum, v) => sum + v, 0) / values.length, 2);

    case 'min':
      return Math.min(...values);

    case 'max':
      return Math.max(...values);

    default:
      return null;
  }
}

/**
 * Round a number to specified decimal places
 */
function roundToDecimal(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Get unique values for a field (useful for auto-detecting groupable fields)
 */
export function getUniqueValues(
  data: Record<string, unknown>[],
  field: string,
  limit = 100
): unknown[] {
  const unique = new Set<unknown>();
  for (const record of data) {
    if (unique.size >= limit) break;
    unique.add(record[field]);
  }
  return Array.from(unique);
}

/**
 * Detect if a field is suitable for grouping (categorical with limited unique values)
 */
export function isGroupableField(
  data: Record<string, unknown>[],
  field: string,
  maxUniqueRatio = 0.3
): boolean {
  if (data.length === 0) return false;

  const uniqueValues = getUniqueValues(data, field, Math.ceil(data.length * maxUniqueRatio) + 1);
  const uniqueRatio = uniqueValues.length / data.length;

  // A field is groupable if it has relatively few unique values
  return uniqueRatio <= maxUniqueRatio && uniqueValues.length > 1;
}

/**
 * Auto-detect the best field to group by
 */
export function suggestGroupByField(data: Record<string, unknown>[]): string | null {
  if (data.length === 0) return null;

  const firstRecord = data[0];
  const fields = Object.keys(firstRecord);

  // Find fields that are good for grouping (categorical)
  for (const field of fields) {
    if (isGroupableField(data, field)) {
      return field;
    }
  }

  return null;
}
