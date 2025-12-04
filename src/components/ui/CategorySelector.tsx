'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, X, Tag, Check } from 'lucide-react';

interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
}

interface CategorySelectorProps {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function CategorySelector({
  selectedIds,
  onChange,
  placeholder = 'Select categories...',
  disabled = false,
  className = '',
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch user's available categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/user/categories');
        if (response.ok) {
          const data = await response.json();
          setCategories(data.categories || []);
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleCategory = (categoryId: number) => {
    if (selectedIds.includes(categoryId)) {
      onChange(selectedIds.filter(id => id !== categoryId));
    } else {
      onChange([...selectedIds, categoryId]);
    }
  };

  const removeCategory = (categoryId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedIds.filter(id => id !== categoryId));
  };

  const selectedCategories = categories.filter(cat => selectedIds.includes(cat.id));

  if (loading) {
    return (
      <div className={`h-10 bg-gray-100 rounded-lg animate-pulse ${className}`} />
    );
  }

  if (categories.length === 0) {
    return (
      <div className={`text-sm text-gray-500 py-2 ${className}`}>
        No categories available
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected categories / trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full min-h-[40px] px-3 py-2 text-left
          bg-white border rounded-lg
          flex items-center flex-wrap gap-1.5
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-gray-400 cursor-pointer'}
          ${isOpen ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-300'}
        `}
      >
        {selectedCategories.length === 0 ? (
          <span className="text-gray-500 text-sm">{placeholder}</span>
        ) : (
          selectedCategories.map(cat => (
            <span
              key={cat.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full"
            >
              <Tag size={10} />
              {cat.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => removeCategory(cat.id, e)}
                  className="hover:bg-blue-200 rounded-full p-0.5"
                >
                  <X size={10} />
                </button>
              )}
            </span>
          ))
        )}
        <ChevronDown
          size={16}
          className={`ml-auto text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {categories.map(cat => {
            const isSelected = selectedIds.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className={`
                  w-full px-3 py-2 text-left flex items-center gap-2
                  hover:bg-gray-50 transition-colors
                  ${isSelected ? 'bg-blue-50' : ''}
                `}
              >
                <div className={`
                  w-4 h-4 rounded border flex items-center justify-center shrink-0
                  ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}
                `}>
                  {isSelected && <Check size={12} className="text-white" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {cat.name}
                  </div>
                  {cat.description && (
                    <div className="text-xs text-gray-500 truncate">
                      {cat.description}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
