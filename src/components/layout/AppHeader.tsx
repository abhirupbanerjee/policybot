'use client';

import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Share2,
  Landmark,
  Settings,
  DollarSign,
  BarChart3,
  FileText,
  Database,
  Activity,
  Layers,
  Globe,
  Server,
  ScrollText,
} from 'lucide-react';

// Icon mapping for branding (same as ThreadSidebar)
const ICON_COMPONENTS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  government: Landmark,
  operations: Settings,
  finance: DollarSign,
  kpi: BarChart3,
  logs: FileText,
  data: Database,
  monitoring: Activity,
  architecture: Layers,
  internet: Globe,
  systems: Server,
  policy: ScrollText,
};

interface AppHeaderProps {
  title: string;
  brandingIcon: string;
  onToggleLeftSidebar: () => void;
  onToggleRightSidebar: () => void;
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  showShareButton?: boolean;
  onShare?: () => void;
}

export default function AppHeader({
  title,
  brandingIcon,
  onToggleLeftSidebar,
  onToggleRightSidebar,
  leftSidebarOpen,
  rightSidebarOpen,
  showShareButton = false,
  onShare,
}: AppHeaderProps) {
  const IconComponent = ICON_COMPONENTS[brandingIcon] || ScrollText;

  return (
    <header className="sticky top-0 z-30 bg-white border-b px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between">
        {/* Left section: Toggle + Logo + Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleLeftSidebar}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title={leftSidebarOpen ? 'Collapse threads panel' : 'Expand threads panel'}
          >
            {leftSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
          </button>
          <div className="flex items-center gap-2">
            <IconComponent size={24} className="text-blue-600" />
            <h1 className="text-lg font-semibold text-gray-900 truncate max-w-[300px] sm:max-w-[400px] lg:max-w-none">
              {title}
            </h1>
          </div>
        </div>

        {/* Right section: Share + Artifacts toggle */}
        <div className="flex items-center gap-2">
          {showShareButton && onShare && (
            <button
              onClick={onShare}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Share thread"
            >
              <Share2 size={18} />
            </button>
          )}
          <button
            onClick={onToggleRightSidebar}
            className="hidden lg:flex p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title={rightSidebarOpen ? 'Collapse artifacts panel' : 'Expand artifacts panel'}
          >
            {rightSidebarOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
}
