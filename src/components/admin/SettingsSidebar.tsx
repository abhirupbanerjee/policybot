'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';

interface SettingSection {
  key: string;
  label: string;
  icon?: React.ComponentType<{ size?: number }>;
}

interface SettingsSidebarProps {
  sections: SettingSection[];
  activeSection: string;
  onSectionChange: (key: string) => void;
}

export default function SettingsSidebar({
  sections,
  activeSection,
  onSectionChange,
}: SettingsSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSectionClick = (key: string) => {
    onSectionChange(key);
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile FAB */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-20 bg-blue-600 text-white rounded-full shadow-lg touch-target"
        aria-label="Open settings menu"
      >
        <Menu size={24} />
      </button>

      {/* Sidebar - fixed on desktop, drawer on mobile */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-30 h-full md:h-auto
          w-64 bg-white border-r md:border md:rounded-lg md:shadow-sm
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b">
          <span className="font-semibold text-gray-900">Settings</span>
          <button
            onClick={() => setIsOpen(false)}
            className="hover:bg-gray-100 rounded-lg touch-target"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-2">
          {sections.map((section) => (
            <button
              key={section.key}
              onClick={() => handleSectionClick(section.key)}
              className={`
                w-full text-left px-4 py-3 min-h-[48px] rounded-lg
                transition-colors flex items-center gap-3 text-sm font-medium
                ${activeSection === section.key
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
                }
              `}
            >
              {section.icon && <section.icon size={18} />}
              {section.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
