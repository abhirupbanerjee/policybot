'use client';

import { useState } from 'react';
import {
  Menu,
  X,
  LayoutDashboard,
  Users,
  FileText,
  MessageSquare,
  Globe,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

type TabType = 'dashboard' | 'users' | 'documents' | 'prompts' | 'tools';
type PromptsSection = 'global-prompt' | 'category-prompts' | 'skills';
type ToolsSection = 'tools' | 'backup';

interface MobileSuperuserMenuProps {
  activeTab: TabType;
  promptsSection: PromptsSection;
  toolsSection: ToolsSection;
  onTabChange: (tab: TabType) => void;
  onPromptsChange: (section: PromptsSection) => void;
  onToolsChange: (section: ToolsSection) => void;
}

const MAIN_TABS: { id: TabType; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'prompts', label: 'Prompts', icon: MessageSquare },
  { id: 'tools', label: 'Tools', icon: Globe },
];

const PROMPTS_SUBMENU: { id: PromptsSection; label: string }[] = [
  { id: 'global-prompt', label: 'Global Prompt' },
  { id: 'category-prompts', label: 'Category Prompts' },
  { id: 'skills', label: 'Skills' },
];

const TOOLS_SUBMENU: { id: ToolsSection; label: string }[] = [
  { id: 'tools', label: 'Tools' },
  { id: 'backup', label: 'Backup' },
];

export default function MobileSuperuserMenu({
  activeTab,
  promptsSection,
  toolsSection,
  onTabChange,
  onPromptsChange,
  onToolsChange,
}: MobileSuperuserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<'prompts' | 'tools' | null>(
    activeTab === 'prompts' ? 'prompts' : activeTab === 'tools' ? 'tools' : null
  );

  const handleTabClick = (tabId: TabType) => {
    if (tabId === 'prompts' || tabId === 'tools') {
      setExpandedMenu(expandedMenu === tabId ? null : tabId);
    } else {
      onTabChange(tabId);
      setIsOpen(false);
    }
  };

  const handlePromptsSubClick = (section: PromptsSection) => {
    onTabChange('prompts');
    onPromptsChange(section);
    setIsOpen(false);
  };

  const handleToolsSubClick = (section: ToolsSection) => {
    onTabChange('tools');
    onToolsChange(section);
    setIsOpen(false);
  };

  const getCurrentLabel = () => {
    if (activeTab === 'prompts') {
      const sub = PROMPTS_SUBMENU.find(s => s.id === promptsSection);
      return `Prompts > ${sub?.label || ''}`;
    }
    if (activeTab === 'tools') {
      const sub = TOOLS_SUBMENU.find(s => s.id === toolsSection);
      return `Tools > ${sub?.label || ''}`;
    }
    return MAIN_TABS.find(t => t.id === activeTab)?.label || '';
  };

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 p-2 text-gray-600 hover:text-gray-900"
        aria-label="Open menu"
      >
        <Menu size={24} />
        <span className="text-sm font-medium truncate max-w-[200px]">{getCurrentLabel()}</span>
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-white shadow-xl z-40 transform transition-transform duration-200 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-gray-900">Superuser Menu</span>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 text-gray-500 hover:text-gray-700"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Menu Items */}
        <nav className="py-2 overflow-y-auto max-h-[calc(100vh-60px)]">
          {MAIN_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const hasSubmenu = tab.id === 'prompts' || tab.id === 'tools';
            const isExpanded = expandedMenu === tab.id;

            return (
              <div key={tab.id}>
                <button
                  onClick={() => handleTabClick(tab.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} />
                    <span className="font-medium">{tab.label}</span>
                  </div>
                  {hasSubmenu && (
                    isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />
                  )}
                </button>

                {/* Prompts Submenu */}
                {tab.id === 'prompts' && isExpanded && (
                  <div className="bg-gray-50 border-l-4 border-gray-200">
                    {PROMPTS_SUBMENU.map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => handlePromptsSubClick(sub.id)}
                        className={`w-full px-8 py-2.5 text-left text-sm ${
                          activeTab === 'prompts' && promptsSection === sub.id
                            ? 'bg-blue-100 text-blue-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Tools Submenu */}
                {tab.id === 'tools' && isExpanded && (
                  <div className="bg-gray-50 border-l-4 border-gray-200">
                    {TOOLS_SUBMENU.map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => handleToolsSubClick(sub.id)}
                        className={`w-full px-8 py-2.5 text-left text-sm ${
                          activeTab === 'tools' && toolsSection === sub.id
                            ? 'bg-blue-100 text-blue-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </>
  );
}
