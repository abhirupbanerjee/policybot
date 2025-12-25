'use client';

import { useEffect } from 'react';
import { generateAccentColors, DEFAULT_ACCENT_COLOR, isValidHexColor } from '@/lib/color-utils';

interface AccentColorProviderProps {
  children: React.ReactNode;
}

/**
 * Fetches branding accent color and injects CSS custom properties
 * into the document root for global theming.
 */
export default function AccentColorProvider({ children }: AccentColorProviderProps) {
  useEffect(() => {
    const fetchAndApplyAccentColor = async () => {
      try {
        const response = await fetch('/api/branding');
        if (response.ok) {
          const data = await response.json();
          const accentColor = data.accentColor && isValidHexColor(data.accentColor)
            ? data.accentColor
            : DEFAULT_ACCENT_COLOR;

          applyAccentColors(accentColor);
        }
      } catch (error) {
        console.error('Failed to fetch branding:', error);
        // Use defaults on error
        applyAccentColors(DEFAULT_ACCENT_COLOR);
      }
    };

    fetchAndApplyAccentColor();
  }, []);

  return <>{children}</>;
}

/**
 * Apply accent color CSS variables to the document root
 */
function applyAccentColors(baseColor: string) {
  const colors = generateAccentColors(baseColor);
  const root = document.documentElement;

  root.style.setProperty('--accent-color', colors.color);
  root.style.setProperty('--accent-hover', colors.hover);
  root.style.setProperty('--accent-light', colors.light);
  root.style.setProperty('--accent-lighter', colors.lighter);
  root.style.setProperty('--accent-border', colors.border);
  root.style.setProperty('--accent-text', colors.text);
}
