'use client';

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, X } from 'lucide-react';

// ============================================
// Types
// ============================================

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig<T> {
  key: keyof T | null;
  direction: SortDirection;
}

export interface ColumnDef<T> {
  key: keyof T | 'actions';
  header: string;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  render?: (item: T) => React.ReactNode;
  sortValue?: (item: T) => string | number | Date;
}

// ============================================
// Fuzzy Search
// ============================================

/**
 * Simple fuzzy search that matches characters in order
 * Returns a score (higher is better match), or -1 if no match
 */
function fuzzyMatch(pattern: string, text: string): number {
  pattern = pattern.toLowerCase();
  text = text.toLowerCase();

  let patternIdx = 0;
  let score = 0;
  let lastMatchIdx = -1;

  for (let i = 0; i < text.length && patternIdx < pattern.length; i++) {
    if (text[i] === pattern[patternIdx]) {
      // Bonus for consecutive matches
      if (lastMatchIdx === i - 1) {
        score += 2;
      } else {
        score += 1;
      }
      // Bonus for matching at word boundaries
      if (i === 0 || text[i - 1] === ' ' || text[i - 1] === '-' || text[i - 1] === '_') {
        score += 3;
      }
      lastMatchIdx = i;
      patternIdx++;
    }
  }

  // Return -1 if pattern wasn't fully matched
  if (patternIdx < pattern.length) {
    return -1;
  }

  return score;
}

/**
 * Search items using fuzzy matching
 */
export function fuzzySearch<T>(
  items: T[],
  searchTerm: string,
  getSearchableText: (item: T) => string
): T[] {
  if (!searchTerm.trim()) {
    return items;
  }

  const results = items
    .map(item => ({
      item,
      score: fuzzyMatch(searchTerm, getSearchableText(item)),
    }))
    .filter(result => result.score >= 0)
    .sort((a, b) => b.score - a.score);

  return results.map(r => r.item);
}

// ============================================
// Sort Icon Component
// ============================================

interface SortIconProps {
  direction: SortDirection;
}

function SortIcon({ direction }: SortIconProps) {
  if (direction === 'asc') {
    return <ChevronUp size={14} className="text-blue-600" />;
  }
  if (direction === 'desc') {
    return <ChevronDown size={14} className="text-blue-600" />;
  }
  return <ChevronsUpDown size={14} className="text-gray-400" />;
}

// ============================================
// Sortable Header Component
// ============================================

interface SortableHeaderProps<T> {
  column: ColumnDef<T>;
  sortConfig: SortConfig<T>;
  onSort: (key: keyof T) => void;
}

function SortableHeader<T>({ column, sortConfig, onSort }: SortableHeaderProps<T>) {
  if (!column.sortable || column.key === 'actions') {
    return (
      <th className={`px-6 py-3 font-medium ${column.headerClassName || ''}`}>
        {column.header}
      </th>
    );
  }

  const isActive = sortConfig.key === column.key;

  return (
    <th className={`px-6 py-3 font-medium ${column.headerClassName || ''}`}>
      <button
        onClick={() => onSort(column.key as keyof T)}
        className="flex items-center gap-1 hover:text-blue-600 transition-colors group"
      >
        {column.header}
        <span className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
          <SortIcon direction={isActive ? sortConfig.direction : null} />
        </span>
      </button>
    </th>
  );
}

// ============================================
// Search Input Component
// ============================================

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Search...', className = '' }: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

// ============================================
// Hook for Sortable Data
// ============================================

export function useSortableData<T>(
  items: T[],
  defaultSort?: SortConfig<T>
) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>(
    defaultSort || { key: null, direction: null }
  );

  const sortedItems = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return items;
    }

    return [...items].sort((a, b) => {
      const aValue = a[sortConfig.key as keyof T];
      const bValue = b[sortConfig.key as keyof T];

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1;
      if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1;

      // Handle different types
      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime();
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [items, sortConfig]);

  const requestSort = (key: keyof T) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc';
      } else if (sortConfig.direction === 'desc') {
        direction = null;
      }
    }
    setSortConfig({ key: direction ? key : null, direction });
  };

  return { sortedItems, sortConfig, requestSort };
}

// ============================================
// Combined Hook for Search + Sort
// ============================================

export function useSearchableSortableData<T>(
  items: T[],
  getSearchableText: (item: T) => string,
  defaultSort?: SortConfig<T>
) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = useMemo(
    () => fuzzySearch(items, searchTerm, getSearchableText),
    [items, searchTerm, getSearchableText]
  );

  const { sortedItems, sortConfig, requestSort } = useSortableData(filteredItems, defaultSort);

  return {
    items: sortedItems,
    searchTerm,
    setSearchTerm,
    sortConfig,
    requestSort,
    totalCount: items.length,
    filteredCount: filteredItems.length,
  };
}

// ============================================
// Exported Components
// ============================================

export { SortableHeader, SortIcon };
