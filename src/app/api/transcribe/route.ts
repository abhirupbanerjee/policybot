import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { transcribeAudio } from '@/lib/openai';
import type { TranscribeResponse, ApiError } from '@/types';

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB (Whisper limit)
const ALLOWED_TYPES = ['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/mp4'];

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json<ApiError>(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json<ApiError>(
        { error: 'No audio file provided', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(audioFile.type)) {
      return NextResponse.json<ApiError>(
        { error: 'Invalid audio format. Supported: webm, mp3, wav, m4a', code: 'INVALID_FILE_TYPE' },
        { status: 400 }
      );
    }

    // Validate file size
    if (audioFile.size > MAX_AUDIO_SIZE) {
      return NextResponse.json<ApiError>(
        { error: 'File too large (max 25MB)', code: 'FILE_TOO_LARGE' },
        { status: 413 }
      );
    }

    // Convert to buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Transcribe
    const { text, duration } = await transcribeAudio(buffer, audioFile.name);

    return NextResponse.json<TranscribeResponse>({ text, duration });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json<ApiError>(
      {
        error: 'Transcription failed',
        code: 'SERVICE_ERROR',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
