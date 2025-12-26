'use client';

import { useState } from 'react';
import {
  Menu,
  X,
  LayoutDashboard,
  BarChart3,
  FolderOpen,
  FileText,
  Users,
  MessageSquare,
  Globe,
  Settings,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

type TabType = 'dashboard' | 'documents' | 'categories' | 'users' | 'settings' | 'stats' | 'prompts' | 'tools';
type SettingsSection = 'rag' | 'llm' | 'reranker' | 'memory' | 'summarization' | 'limits' | 'backup' | 'branding';
type PromptsSection = 'system-prompt' | 'category-prompts' | 'acronyms' | 'skills';

interface AdminSidebarMenuProps {
  activeTab: TabType;
  settingsSection: SettingsSection;
  promptsSection: PromptsSection;
  onTabChange: (tab: TabType) => void;
  onSettingsChange: (section: SettingsSection) => void;
  onPromptsChange: (section: PromptsSection) => void;
}

const MAIN_TABS: { id: TabType; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'categories', label: 'Categories', icon: FolderOpen },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'prompts', label: 'Prompts', icon: MessageSquare },
  { id: 'tools', label: 'Tools', icon: Globe },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const PROMPTS_SUBMENU: { id: PromptsSection; label: string }[] = [
  { id: 'system-prompt', label: 'System Prompt' },
  { id: 'category-prompts', label: 'Category Prompts' },
  { id: 'acronyms', label: 'Acronyms' },
  { id: 'skills', label: 'Skills' },
];

const SETTINGS_SUBMENU: { id: SettingsSection; label: string }[] = [
  { id: 'llm', label: 'LLM' },
  { id: 'rag', label: 'RAG' },
  { id: 'reranker', label: 'Reranker' },
  { id: 'memory', label: 'Memory' },
  { id: 'summarization', label: 'Summarization' },
  { id: 'limits', label: 'Limits' },
  { id: 'backup', label: 'Backup' },
  { id: 'branding', label: 'Branding' },
];

export default function AdminSidebarMenu({
  activeTab,
  settingsSection,
  promptsSection,
  onTabChange,
  onSettingsChange,
  onPromptsChange,
}: AdminSidebarMenuProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<'prompts' | 'settings' | null>(
    activeTab === 'prompts' ? 'prompts' : activeTab === 'settings' ? 'settings' : null
  );

  const handleTabClick = (tabId: TabType) => {
    if (tabId === 'prompts' || tabId === 'settings') {
      setExpandedMenu(expandedMenu === tabId ? null : tabId);
    } else {
      onTabChange(tabId);
      setIsMobileOpen(false);
    }
  };

  const handlePromptsSubClick = (section: PromptsSection) => {
    onTabChange('prompts');
    onPromptsChange(section);
    setIsMobileOpen(false);
  };

  const handleSettingsSubClick = (section: SettingsSection) => {
    onTabChange('settings');
    onSettingsChange(section);
    setIsMobileOpen(false);
  };

  const getCurrentLabel = () => {
    if (activeTab === 'prompts') {
      const sub = PROMPTS_SUBMENU.find(s => s.id === promptsSection);
      return `Prompts > ${sub?.label || ''}`;
    }
    if (activeTab === 'settings') {
      const sub = SETTINGS_SUBMENU.find(s => s.id === settingsSection);
      return `Settings > ${sub?.label || ''}`;
    }
    return MAIN_TABS.find(t => t.id === activeTab)?.label || '';
  };

  // Shared menu content
  const MenuContent = ({ showHeader = false, onClose }: { showHeader?: boolean; onClose?: () => void }) => (
    <>
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-gray-900">Admin Menu</span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-700"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          )}
        </div>
      )}
      <nav className="py-2 overflow-y-auto flex-1">
        {MAIN_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const hasSubmenu = tab.id === 'prompts' || tab.id === 'settings';
          const isExpanded = expandedMenu === tab.id;

          return (
            <div key={tab.id}>
              <button
                onClick={() => handleTabClick(tab.id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                  isActive && !hasSubmenu
                    ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600'
                    : isActive && hasSubmenu
                    ? 'text-blue-700 border-l-4 border-blue-600 bg-blue-50/50'
                    : 'text-gray-700 hover:bg-gray-50 border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} />
                  <span className="font-medium text-sm">{tab.label}</span>
                </div>
                {hasSubmenu && (
                  isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                )}
              </button>

              {/* Prompts Submenu */}
              {tab.id === 'prompts' && isExpanded && (
                <div className="bg-gray-50/80">
                  {PROMPTS_SUBMENU.map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => handlePromptsSubClick(sub.id)}
                      className={`w-full pl-11 pr-4 py-2 text-left text-sm transition-colors ${
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

              {/* Settings Submenu */}
              {tab.id === 'settings' && isExpanded && (
                <div className="bg-gray-50/80">
                  {SETTINGS_SUBMENU.map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => handleSettingsSubClick(sub.id)}
                      className={`w-full pl-11 pr-4 py-2 text-left text-sm transition-colors ${
                        activeTab === 'settings' && settingsSection === sub.id
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
    </>
  );

  return (
    <>
      {/* Mobile: Hamburger Button */}
      <div className="md:hidden">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="flex items-center gap-2 p-2 text-gray-600 hover:text-gray-900"
          aria-label="Open menu"
        >
          <Menu size={24} />
          <span className="text-sm font-medium truncate max-w-[200px]">{getCurrentLabel()}</span>
        </button>

        {/* Mobile Overlay */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-30"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Mobile Drawer */}
        <div
          className={`fixed top-0 left-0 h-full w-64 bg-white shadow-xl z-40 transform transition-transform duration-200 flex flex-col ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <MenuContent showHeader onClose={() => setIsMobileOpen(false)} />
        </div>
      </div>

      {/* Desktop: Fixed Sidebar */}
      <div className="hidden md:flex md:flex-col md:w-56 md:shrink-0 bg-white border-r h-[calc(100vh-64px)] sticky top-16">
        <MenuContent />
      </div>
    </>
  );
}
