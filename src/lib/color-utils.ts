/**
 * Client-side Color Utilities
 *
 * Used for computing accent color variants for the UI theming system.
 * These utilities work in both browser and Node.js environments.
 */

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Parse hex color to RGB values
 */
export function hexToRgb(hex: string): ColorRGB {
  const cleanHex = hex.replace(/^#/, '');
  const bigint = parseInt(cleanHex, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

/**
 * Convert RGB to hex string
 */
export function rgbToHex(rgb: ColorRGB): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Lighten a color by a percentage (0-100)
 */
export function lightenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  const factor = percent / 100;
  return rgbToHex({
    r: Math.round(rgb.r + (255 - rgb.r) * factor),
    g: Math.round(rgb.g + (255 - rgb.g) * factor),
    b: Math.round(rgb.b + (255 - rgb.b) * factor),
  });
}

/**
 * Darken a color by a percentage (0-100)
 */
export function darkenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  const factor = 1 - percent / 100;
  return rgbToHex({
    r: Math.round(rgb.r * factor),
    g: Math.round(rgb.g * factor),
    b: Math.round(rgb.b * factor),
  });
}

/**
 * Check if a hex color is valid
 */
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Generate all accent color variants from a base color
 */
export function generateAccentColors(baseColor: string): {
  color: string;
  hover: string;
  light: string;
  lighter: string;
  border: string;
  text: string;
} {
  return {
    color: baseColor,
    hover: darkenColor(baseColor, 15),
    light: lightenColor(baseColor, 85),
    lighter: lightenColor(baseColor, 93),
    border: lightenColor(baseColor, 70),
    text: darkenColor(baseColor, 25),
  };
}

/**
 * Default accent color
 */
export const DEFAULT_ACCENT_COLOR = '#2563eb';
