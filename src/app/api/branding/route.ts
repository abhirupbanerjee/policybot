/**
 * Public Branding API
 *
 * GET /api/branding - Get branding settings (no auth required)
 */

import { NextResponse } from 'next/server';
import { getBrandingSettings, BRANDING_ICONS } from '@/lib/db/config';

export async function GET() {
  try {
    const branding = getBrandingSettings();

    return NextResponse.json({
      botName: branding.botName,
      botIcon: branding.botIcon,
      // Include available icons for client reference
      availableIcons: BRANDING_ICONS,
    });
  } catch (error) {
    console.error('Failed to get branding settings:', error);
    return NextResponse.json(
      { error: 'Failed to get branding settings' },
      { status: 500 }
    );
  }
}
