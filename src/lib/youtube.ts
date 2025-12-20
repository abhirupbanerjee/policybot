/**
 * YouTube Transcript Extraction Module
 *
 * Tiered approach:
 * 1. Primary: YouTube Data API v3 (requires API key + OAuth consent for video owner)
 * 2. Fallback: youtube-transcript npm package (works for any public video with captions)
 */

import { YoutubeTranscript } from 'youtube-transcript';

// ============ Types ============

export interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  channelTitle: string;
  description: string;
  publishedAt: string;
  duration: string;
}

export interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

export interface YouTubeExtractResult {
  success: boolean;
  videoId: string;
  source?: 'youtube-api-v3' | 'youtube-transcript';
  videoInfo?: YouTubeVideoInfo;
  transcript?: string;
  segments?: TranscriptSegment[];
  error?: string;
}

// ============ URL Parsing ============

/**
 * Extract video ID from various YouTube URL formats
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Check if URL is a YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//.test(url) ||
         /^[a-zA-Z0-9_-]{11}$/.test(url);
}

// ============ YouTube Data API v3 (Primary) ============

/**
 * Get YouTube API key from environment
 */
function getYouTubeApiKey(): string | null {
  return process.env.YOUTUBE_API_KEY || null;
}

/**
 * Check if YouTube Data API v3 is configured
 */
export function isYouTubeApiConfigured(): boolean {
  return !!getYouTubeApiKey();
}

/**
 * Fetch video metadata from YouTube Data API v3
 */
async function fetchVideoInfo(videoId: string, apiKey: string): Promise<YouTubeVideoInfo | null> {
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?` +
      `part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error('YouTube API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      return null;
    }

    const item = data.items[0];
    return {
      videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      description: item.snippet.description,
      publishedAt: item.snippet.publishedAt,
      duration: item.contentDetails.duration,
    };
  } catch (error) {
    console.error('Error fetching video info:', error);
    return null;
  }
}

/**
 * Get caption tracks for a video using YouTube Data API v3
 */
async function getCaptionTracks(videoId: string, apiKey: string): Promise<Array<{ id: string; language: string }>> {
  try {
    const url = `https://www.googleapis.com/youtube/v3/captions?` +
      `part=snippet&videoId=${videoId}&key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      // This often fails with 403 for videos you don't own
      return [];
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      return [];
    }

    return data.items.map((item: { id: string; snippet: { language: string } }) => ({
      id: item.id,
      language: item.snippet.language,
    }));
  } catch (error) {
    console.error('Error fetching caption tracks:', error);
    return [];
  }
}

/**
 * Download a caption track using YouTube Data API v3
 * NOTE: This requires OAuth consent from the video owner
 */
async function downloadCaption(captionId: string, apiKey: string): Promise<string | null> {
  try {
    // This endpoint requires OAuth, not just an API key
    // It will fail for videos you don't own
    const url = `https://www.googleapis.com/youtube/v3/captions/${captionId}?` +
      `tfmt=srt&key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      // Expected to fail for third-party videos (requires OAuth)
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error('Error downloading caption:', error);
    return null;
  }
}

/**
 * Try to get transcript using YouTube Data API v3
 */
async function tryYouTubeApiV3(videoId: string): Promise<YouTubeExtractResult | null> {
  const apiKey = getYouTubeApiKey();
  if (!apiKey) {
    return null;
  }

  try {
    // Get caption tracks
    const tracks = await getCaptionTracks(videoId, apiKey);
    if (tracks.length === 0) {
      return null;
    }

    // Prefer English captions
    const englishTrack = tracks.find(t => t.language.startsWith('en')) || tracks[0];

    // Try to download the caption (will fail if not video owner)
    const captionText = await downloadCaption(englishTrack.id, apiKey);
    if (!captionText) {
      return null;
    }

    // Parse SRT format to plain text
    const transcript = parseSrtToPlainText(captionText);

    // Get video info
    const videoInfo = await fetchVideoInfo(videoId, apiKey);

    return {
      success: true,
      videoId,
      source: 'youtube-api-v3',
      videoInfo: videoInfo || undefined,
      transcript,
    };
  } catch (error) {
    console.warn('YouTube API v3 failed:', error);
    return null;
  }
}

/**
 * Parse SRT format to plain text
 */
function parseSrtToPlainText(srt: string): string {
  // Remove timestamps and sequence numbers, keep only text
  const lines = srt.split('\n');
  const textLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines, sequence numbers, and timestamp lines
    if (!trimmed) continue;
    if (/^\d+$/.test(trimmed)) continue;
    if (/^\d{2}:\d{2}:\d{2}/.test(trimmed)) continue;
    textLines.push(trimmed);
  }

  return textLines.join(' ');
}

// ============ youtube-transcript npm (Fallback) ============

/**
 * Try to get transcript using youtube-transcript npm package
 */
async function tryYouTubeTranscriptNpm(videoId: string): Promise<YouTubeExtractResult | null> {
  try {
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);

    if (!transcriptItems || transcriptItems.length === 0) {
      return null;
    }

    // Convert to our format
    const segments: TranscriptSegment[] = transcriptItems.map(item => ({
      text: item.text,
      offset: item.offset,
      duration: item.duration,
    }));

    // Combine into full transcript
    const transcript = segments.map(s => s.text).join(' ');

    // Try to get video info if API key is available
    const apiKey = getYouTubeApiKey();
    const videoInfo = apiKey ? await fetchVideoInfo(videoId, apiKey) : undefined;

    return {
      success: true,
      videoId,
      source: 'youtube-transcript',
      videoInfo: videoInfo || undefined,
      transcript,
      segments,
    };
  } catch (error) {
    console.warn('youtube-transcript npm failed:', error);
    return null;
  }
}

// ============ Main Extraction Function ============

/**
 * Extract YouTube video transcript using tiered approach
 *
 * Primary: YouTube Data API v3 (requires API key + OAuth consent)
 * Fallback: youtube-transcript npm package (any public video with captions)
 */
export async function extractYouTubeTranscript(url: string): Promise<YouTubeExtractResult> {
  const videoId = extractVideoId(url);

  if (!videoId) {
    return {
      success: false,
      videoId: '',
      error: 'Invalid YouTube URL or video ID',
    };
  }

  // Primary: Try YouTube Data API v3
  const apiResult = await tryYouTubeApiV3(videoId);
  if (apiResult) {
    return apiResult;
  }

  // Fallback: Try youtube-transcript npm package
  const npmResult = await tryYouTubeTranscriptNpm(videoId);
  if (npmResult) {
    return npmResult;
  }

  // Both failed
  return {
    success: false,
    videoId,
    error: 'Either consent or captions not available for this video',
  };
}

// ============ Formatting for Ingestion ============

/**
 * Format transcript with metadata for document ingestion
 */
export function formatTranscriptForIngestion(result: YouTubeExtractResult): string {
  if (!result.success || !result.transcript) {
    throw new Error(result.error || 'No transcript available');
  }

  const lines: string[] = [];

  lines.push('Source: YouTube Video');
  lines.push(`Video ID: ${result.videoId}`);
  lines.push(`URL: https://www.youtube.com/watch?v=${result.videoId}`);
  lines.push(`Extraction Method: ${result.source}`);

  if (result.videoInfo) {
    lines.push(`Title: ${result.videoInfo.title}`);
    lines.push(`Channel: ${result.videoInfo.channelTitle}`);
    lines.push(`Published: ${result.videoInfo.publishedAt}`);
    lines.push(`Duration: ${result.videoInfo.duration}`);
  }

  lines.push(`Extracted: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('TRANSCRIPT:');
  lines.push('');
  lines.push(result.transcript);

  return lines.join('\n');
}
