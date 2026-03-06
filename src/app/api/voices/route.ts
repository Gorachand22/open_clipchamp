/**
 * Voices API
 * 
 * GET /api/voices
 * List available TTS voices (system and cloned)
 * 
 * Uses Z_AUDIO credentials from environment variables
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const token = process.env.Z_AUDIO_TOKEN;
    const userId = process.env.Z_AUDIO_USER_ID;
    const apiBase = process.env.Z_AUDIO_API_BASE || 'https://audio.z.ai/api';

    // Check if credentials are configured
    if (!token) {
      return NextResponse.json({ 
        success: false, 
        error: 'Z_AUDIO_TOKEN not configured in environment',
        configured: false,
        voices: { cloned: [], system: [] },
        setup: {
          env_vars: ['Z_AUDIO_TOKEN', 'Z_AUDIO_USER_ID', 'Z_AUDIO_API_BASE'],
          note: 'Add these to your .env file to enable TTS voice listing',
        },
      }, { status: 500 });
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const results = {
      cloned: [] as Array<{ value: string; label: string; type: string }>,
      system: [] as Array<{ value: string; label: string; type: string }>,
    };

    // 1. Fetch System Voices
    try {
      const sysResponse = await fetch(`${apiBase}/v1/z-audio/voices/list_system`, { headers });
      if (sysResponse.ok) {
        const sysData = await sysResponse.json();
        const systemVoices = sysData.data || sysData.voices || [];
        results.system = systemVoices.map((v: any) => ({
          value: v.voice_id || v.id,
          label: v.voice_name || v.name || 'Unknown',
          type: 'system',
          gender: v.gender,
          language: v.language,
          preview_url: v.preview_url || v.audio_url,
        }));
        console.log(`[Voices API] Loaded ${results.system.length} system voices`);
      } else {
        console.warn(`[Voices API] System voices fetch failed: ${sysResponse.status}`);
      }
    } catch (e) {
      console.error('[Voices API] Error fetching system voices:', e);
    }

    // 2. Fetch Cloned Voices (requires userId)
    if (userId) {
      try {
        const cloneResponse = await fetch(
          `${apiBase}/v1/z-audio/voices/list?user_id=${userId}&page=1&page_size=200`,
          { headers }
        );
        if (cloneResponse.ok) {
          const cloneData = await cloneResponse.json();
          const clonedVoices = cloneData.data || cloneData.voices || [];
          results.cloned = clonedVoices.map((v: any) => ({
            value: v.voice_id || v.id,
            label: v.voice_name || v.name || 'Unknown',
            type: 'cloned',
            created_at: v.created_at,
            preview_url: v.preview_url || v.audio_url,
          }));
          console.log(`[Voices API] Loaded ${results.cloned.length} cloned voices`);
        } else {
          console.warn(`[Voices API] Cloned voices fetch failed: ${cloneResponse.status}`);
        }
      } catch (e) {
        console.error('[Voices API] Error fetching cloned voices:', e);
      }
    }

    return NextResponse.json({
      success: true,
      configured: true,
      userId: userId || null,
      apiBase: apiBase,
      voices: results,
      totalVoices: results.cloned.length + results.system.length,
    });

  } catch (error: any) {
    console.error('[Voices API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/voices
 * Test TTS with a specific voice
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, voiceId, speed = 1.0 } = body;

    if (!text || !voiceId) {
      return NextResponse.json(
        { success: false, error: 'text and voiceId are required' },
        { status: 400 }
      );
    }

    const token = process.env.Z_AUDIO_TOKEN;
    const userId = process.env.Z_AUDIO_USER_ID;
    const apiBase = process.env.Z_AUDIO_API_BASE || 'https://audio.z.ai/api';

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Z_AUDIO_TOKEN not configured' },
        { status: 500 }
      );
    }

    console.log(`[Voices API] TTS Request: voiceId=${voiceId}, text length=${text.length}`);

    const response = await fetch(`${apiBase}/v1/z-audio/tts/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        voice_id: voiceId,
        voice_name: 'TTS Voice',
        user_id: userId || 'anonymous',
        input_text: text,
        speed: speed,
        volume: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, error: `TTS API Error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    // Parse SSE stream for audio data
    const streamText = await response.text();
    const lines = streamText.split('\n');
    const chunks: Buffer[] = [];
    let firstChunk = true;

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.substring(6).trim();
        if (jsonStr && jsonStr !== '[DONE]') {
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.audio) {
              const chunkBuffer = Buffer.from(parsed.audio, 'base64');
              if (firstChunk) {
                chunks.push(chunkBuffer);
                firstChunk = false;
              } else if (chunkBuffer.length > 44) {
                // Skip WAV header for subsequent chunks
                chunks.push(chunkBuffer.subarray(44));
              }
            }
          } catch {}
        }
      }
    }

    if (chunks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No audio data received from TTS service' },
        { status: 500 }
      );
    }

    // Assemble WAV file
    const assembledWav = Buffer.concat(chunks);
    const totalSize = assembledWav.length;
    
    // Fix WAV header size fields
    if (totalSize > 44) {
      assembledWav.writeUInt32LE(totalSize - 8, 4);
      assembledWav.writeUInt32LE(totalSize - 44, 40);
    }

    // Return audio as base64
    return NextResponse.json({
      success: true,
      audioBase64: assembledWav.toString('base64'),
      mimeType: 'audio/wav',
      duration: Math.round((assembledWav.length - 44) / 32000), // Approximate duration
      voiceId: voiceId,
      text: text,
    });

  } catch (error: any) {
    console.error('[Voices API] TTS Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
