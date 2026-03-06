/**
 * Video Generation API
 * 
 * POST /api/generate/video
 * Generate a video from text prompt or image using z-ai-web-dev-sdk
 * 
 * Supports:
 * - Text-to-Video: Generate video from text description
 * - Image-to-Video: Animate an existing image
 * 
 * Features automatic rate limiting with exponential backoff retry
 */

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Valid video sizes with aspect ratio mapping
const VALID_SIZES = [
  '768x1344',   // 9:16 Vertical (Shorts/Reels/TikTok) - DEFAULT
  '1344x768',   // 16:9 Horizontal (YouTube)
  '1024x1024',  // 1:1 Square
  '864x1152',   // 3:4 Portrait (Instagram)
  '720x1440',   // 9:20 Vertical
  '1152x864',   // 4:3 Landscape
  '1440x720',   // 2:1 Wide
] as const;

type VideoSize = typeof VALID_SIZES[number];

// Valid durations
const VALID_DURATIONS = [5, 10] as const;
type VideoDuration = typeof VALID_DURATIONS[number];

// Valid quality options
const VALID_QUALITIES = ['speed', 'quality'] as const;
type VideoQuality = typeof VALID_QUALITIES[number];

// Size to aspect ratio mapping
const SIZE_GUIDE: Record<VideoSize, { aspectRatio: string; platform: string }> = {
  '768x1344': { aspectRatio: '9:16', platform: 'TikTok, Shorts, Reels' },
  '1344x768': { aspectRatio: '16:9', platform: 'YouTube, Web' },
  '1024x1024': { aspectRatio: '1:1', platform: 'Instagram Feed' },
  '864x1152': { aspectRatio: '3:4', platform: 'Instagram Portrait' },
  '720x1440': { aspectRatio: '9:20', platform: 'Stories' },
  '1152x864': { aspectRatio: '4:3', platform: 'Presentations' },
  '1440x720': { aspectRatio: '2:1', platform: 'Twitter, Web' },
};

// Folders for output
const FOLDERS = {
  OUTPUT: path.join(process.cwd(), 'output'),
  TEMP: path.join(process.cwd(), 'temp'),
};

async function ensureFolders() {
  await Promise.all([
    fs.mkdir(FOLDERS.OUTPUT, { recursive: true }),
    fs.mkdir(FOLDERS.TEMP, { recursive: true }),
  ]);
}

// Rate limit tracking
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 180000; // 3 minutes

/**
 * POST /api/generate/video
 * Generate a video from text or image
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      size = '768x1344',
      duration = 5,
      quality = 'speed',
      imageUrl,
    } = body;

    // Validate prompt
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json(
        { success: false, error: 'prompt is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Validate size
    if (!VALID_SIZES.includes(size as VideoSize)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid size. Must be one of: ${VALID_SIZES.join(', ')}`,
          validSizes: VALID_SIZES,
        },
        { status: 400 }
      );
    }

    // Validate duration
    if (!VALID_DURATIONS.includes(duration)) {
      return NextResponse.json(
        { success: false, error: `duration must be 5 or 10 seconds` },
        { status: 400 }
      );
    }

    // Validate quality
    if (!VALID_QUALITIES.includes(quality)) {
      return NextResponse.json(
        { success: false, error: `quality must be 'speed' or 'quality'` },
        { status: 400 }
      );
    }

    const isImageToVideo = imageUrl && typeof imageUrl === 'string' && imageUrl.trim();

    console.log(`[Video API] Starting ${isImageToVideo ? 'image-to-video' : 'text-to-video'}`);
    console.log(`[Video API] Prompt: "${prompt.substring(0, 50)}..." Size: ${size} Duration: ${duration}s Quality: ${quality}`);

    await ensureFolders();

    // Create ZAI instance
    const zai = await ZAI.create();

    // Build request parameters
    const params: Record<string, unknown> = {
      prompt: prompt.trim(),
      size: size,
      duration: duration,
      quality: quality,
      fps: 30,
    };

    // Handle image URL for image-to-video
    if (isImageToVideo) {
      if (imageUrl.startsWith('data:image/') || imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        params.image_url = imageUrl.trim();
      } else if (imageUrl.startsWith('/api/files/')) {
        // Local file URL - read and convert to base64
        const localPath = path.join(FOLDERS.OUTPUT, path.basename(imageUrl));
        try {
          const imageBuffer = await fs.readFile(localPath);
          const ext = path.extname(localPath).toLowerCase().substring(1) || 'jpeg';
          const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
          params.image_url = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
          console.log(`[Video API] Encoded local image to base64 (${Math.round(imageBuffer.length / 1024)} KB)`);
        } catch (err) {
          return NextResponse.json(
            { success: false, error: `Failed to read local image: ${err}` },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { success: false, error: 'imageUrl must be a data URL, http(s) URL, or /api/files/ path' },
          { status: 400 }
        );
      }
    }

    // Create video generation task with retry logic for rate limits
    let task;
    let retries = 3;
    let delay = 60000; // Start with 1 minute

    // Check rate limit
    const now = Date.now();
    if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
      const waitTime = MIN_REQUEST_INTERVAL - (now - lastRequestTime);
      console.log(`[Video API] Rate limit cooldown: waiting ${Math.round(waitTime / 1000)}s`);
      await new Promise(r => setTimeout(r, waitTime));
    }

    while (retries >= 0) {
      try {
        task = await zai.video.generations.create(params);
        lastRequestTime = Date.now();
        break; // Success
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        if ((errorMsg.includes('429') || errorMsg.includes('Rate limit') || errorMsg.includes('rate limit')) && retries > 0) {
          console.warn(`[Video API] Rate limit hit (429). Retrying in ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
          retries--;
          delay *= 2; // Exponential backoff
        } else {
          throw err;
        }
      }
    }

    const taskId = task?.id;

    if (!taskId) {
      console.error('[Video API] No task ID in response');
      return NextResponse.json(
        { success: false, error: 'No task ID returned from AI service' },
        { status: 500 }
      );
    }

    console.log(`[Video API] Task created: ${taskId}`);

    return NextResponse.json({
      success: true,
      taskId: taskId,
      status: task?.task_status || 'PROCESSING',
      prompt: prompt.trim(),
      size: size,
      duration: duration,
      quality: quality,
      aspectRatio: SIZE_GUIDE[size as VideoSize]?.aspectRatio,
      platform: SIZE_GUIDE[size as VideoSize]?.platform,
      mode: isImageToVideo ? 'image-to-video' : 'text-to-video',
      message: 'Use /api/generate/status with taskId to check progress and get the video',
    });

  } catch (error: unknown) {
    console.error('[Video API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Video generation failed';
    
    // Check for rate limit
    if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Rate limit reached. Please wait 2-3 minutes before generating again.',
          rateLimited: true,
          waitTime: 180,
        },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/generate/video
 * Returns API documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/generate/video',
    method: 'POST',
    description: 'Generate a video from text prompt or image (text-to-video or image-to-video)',
    parameters: {
      prompt: {
        type: 'string',
        required: true,
        description: 'Text description for video generation',
      },
      size: {
        type: 'string',
        required: false,
        default: '768x1344',
        options: VALID_SIZES,
        description: 'Output video size',
      },
      duration: {
        type: 'number',
        required: false,
        default: 5,
        options: VALID_DURATIONS,
        description: 'Video duration in seconds (5 or 10)',
      },
      quality: {
        type: 'string',
        required: false,
        default: 'speed',
        options: VALID_QUALITIES,
        description: 'Generation quality: speed (faster) or quality (better)',
      },
      imageUrl: {
        type: 'string',
        required: false,
        description: 'Optional: Base64 data URL, http(s) URL, or /api/files/ path for image-to-video',
      },
    },
    response: {
      success: 'boolean',
      taskId: 'string - Use with /api/generate/status to check progress',
      status: 'string - PROCESSING, SUCCESS, or FAIL',
      prompt: 'string',
      size: 'string',
      duration: 'number',
      quality: 'string',
      mode: 'string - text-to-video or image-to-video',
      message: 'string',
    },
    sizeGuide: SIZE_GUIDE,
    examples: {
      'Text to Video (Shorts/Reels/TikTok)': {
        prompt: 'A man dancing in a bar',
        size: '768x1344',
        duration: 5,
        quality: 'speed',
      },
      'Text to Video (YouTube)': {
        prompt: 'Ocean waves at sunset with golden hour lighting',
        size: '1344x768',
        duration: 10,
        quality: 'quality',
      },
      'Image to Video': {
        prompt: 'Animate this image with gentle camera motion',
        imageUrl: 'data:image/png;base64,...',
        size: '768x1344',
        duration: 5,
        quality: 'speed',
      },
    },
    rateLimits: {
      note: 'After 429 errors, wait 2-3 minutes before next request',
      autoRetry: 'Automatic retry with exponential backoff is built-in (up to 3 retries)',
    },
    workflow: {
      step1: 'POST to /api/generate/video with prompt and parameters',
      step2: 'Receive taskId in response',
      step3: 'Poll /api/generate/status with taskId until status is SUCCESS',
      step4: 'Download video from videoUrl or use base64 data',
    },
  });
}
