'use client';

/**
 * Workspace Header
 *
 * Branded header for standalone workspace mode.
 * Simpler than main app header - no settings menu.
 */

import { Menu } from 'lucide-react';

interface WorkspaceHeaderProps {
  title: string;
  logoUrl?: string | null;
  primaryColor: string;
  showMenuButton?: boolean;
  onMenuClick?: () => void;
}

export function WorkspaceHeader({
  title,
  logoUrl,
  primaryColor,
  showMenuButton = false,
  onMenuClick,
}: WorkspaceHeaderProps) {
  return (
    <header
      className="flex items-center justify-between px-4 py-3 text-white"
      style={{ backgroundColor: primaryColor }}
    >
      <div className="flex items-center gap-3">
        {showMenuButton && (
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors lg:hidden"
            aria-label="Toggle sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {logoUrl && (
          <img
            src={logoUrl}
            alt=""
            className="w-8 h-8 rounded-lg object-cover"
          />
        )}

        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
    </header>
  );
}
