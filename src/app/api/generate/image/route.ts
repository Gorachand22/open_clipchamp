/**
 * Image Generation API
 * 
 * POST /api/generate/image
 * Generate an image from a text prompt using z-ai-web-dev-sdk
 * 
 * Supports multiple aspect ratios/sizes with automatic rate limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Valid image sizes with aspect ratio mapping
const VALID_SIZES = [
  '1024x1024',  // 1:1 Square
  '768x1344',   // 9:16 Vertical (Shorts/Reels/TikTok)
  '1344x768',   // 16:9 Horizontal (YouTube)
  '864x1152',   // 3:4 Portrait (Instagram)
  '720x1440',   // 9:20 Vertical
  '1152x864',   // 4:3 Landscape
  '1440x720',   // 2:1 Wide
] as const;

type ImageSize = typeof VALID_SIZES[number];

// Size to aspect ratio mapping for IDE reference
const SIZE_GUIDE: Record<ImageSize, { aspectRatio: string; platform: string }> = {
  '1024x1024': { aspectRatio: '1:1', platform: 'Instagram Feed, LinkedIn' },
  '768x1344': { aspectRatio: '9:16', platform: 'TikTok, Shorts, Reels' },
  '1344x768': { aspectRatio: '16:9', platform: 'YouTube, Web' },
  '864x1152': { aspectRatio: '3:4', platform: 'Instagram Portrait' },
  '720x1440': { aspectRatio: '9:20', platform: 'Stories' },
  '1152x864': { aspectRatio: '4:3', platform: 'Presentations' },
  '1440x720': { aspectRatio: '2:1', platform: 'Twitter, Web banner' },
};

// Folders for output
const FOLDERS = {
  OUTPUT: path.join(process.cwd(), 'output'),
};

async function ensureFolders() {
  await fs.mkdir(FOLDERS.OUTPUT, { recursive: true });
}

// Rate limit tracking
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 180000; // 3 minutes after 429

/**
 * POST /api/generate/image
 * Generate an image from text prompt
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, size = '1024x1024' } = body;

    // Validate prompt
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json(
        { success: false, error: 'prompt is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Validate size
    if (!VALID_SIZES.includes(size as ImageSize)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid size. Must be one of: ${VALID_SIZES.join(', ')}`,
          validSizes: VALID_SIZES,
          sizeGuide: SIZE_GUIDE,
        },
        { status: 400 }
      );
    }

    console.log(`[Image API] Generating: "${prompt.substring(0, 50)}..." Size: ${size}`);

    // Check rate limit
    const now = Date.now();
    if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
      const waitTime = Math.ceil((MIN_REQUEST_INTERVAL - (now - lastRequestTime)) / 1000);
      console.log(`[Image API] Rate limit: waiting ${waitTime}s`);
    }

    // Create ZAI instance
    const zai = await ZAI.create();

    // Generate image with retry logic for rate limits
    let response;
    let retries = 3;
    let delay = 60000; // Start with 1 minute

    while (retries >= 0) {
      try {
        response = await zai.images.generations.create({
          prompt: prompt.trim(),
          size: size as ImageSize,
        });
        lastRequestTime = Date.now();
        break;
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        if ((errorMsg.includes('429') || errorMsg.includes('Rate limit') || errorMsg.includes('rate limit')) && retries > 0) {
          console.warn(`[Image API] Rate limit hit (429). Retrying in ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
          retries--;
          delay *= 2; // Exponential backoff
        } else {
          throw err;
        }
      }
    }

    const base64Data = response?.data?.[0]?.base64;

    if (!base64Data) {
      console.error('[Image API] No image data in response');
      return NextResponse.json(
        { success: false, error: 'No image data returned from AI service' },
        { status: 500 }
      );
    }

    // Save to output folder
    await ensureFolders();
    const filename = `image_${uuidv4()}.png`;
    const outputPath = path.join(FOLDERS.OUTPUT, filename);
    await fs.writeFile(outputPath, Buffer.from(base64Data, 'base64'));

    console.log(`[Image API] Image saved: ${filename}`);

    return NextResponse.json({
      success: true,
      base64: base64Data,
      prompt: prompt.trim(),
      size: size,
      aspectRatio: SIZE_GUIDE[size as ImageSize]?.aspectRatio,
      platform: SIZE_GUIDE[size as ImageSize]?.platform,
      filename: filename,
      url: `/api/files/output/${filename}`,
      path: outputPath,
    });

  } catch (error: unknown) {
    console.error('[Image API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Image generation failed';
    
    // Check for rate limit in error
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
 * GET /api/generate/image
 * Returns API documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/generate/image',
    method: 'POST',
    description: 'Generate an image from a text prompt',
    parameters: {
      prompt: {
        type: 'string',
        required: true,
        description: 'Text description for image generation',
      },
      size: {
        type: 'string',
        required: false,
        default: '1024x1024',
        options: VALID_SIZES,
        description: 'Output image size',
      },
    },
    response: {
      success: 'boolean',
      base64: 'string (base64 encoded PNG image)',
      prompt: 'string',
      size: 'string',
      aspectRatio: 'string - derived aspect ratio',
      platform: 'string - recommended platform',
      filename: 'string - saved filename',
      url: 'string - URL to access the image',
      path: 'string - local file path',
    },
    sizeGuide: SIZE_GUIDE,
    examples: {
      'Square (Instagram Feed)': {
        prompt: 'A beautiful sunset over mountains',
        size: '1024x1024',
      },
      'Vertical (TikTok/Shorts/Reels)': {
        prompt: 'A cat playing with a ball',
        size: '768x1344',
      },
      'Horizontal (YouTube)': {
        prompt: 'Ocean waves at sunset',
        size: '1344x768',
      },
      'Portrait (Instagram)': {
        prompt: 'A portrait of a woman in golden hour',
        size: '864x1152',
      },
    },
    rateLimits: {
      note: 'After 429 errors, wait 2-3 minutes before next request',
      autoRetry: 'Automatic retry with exponential backoff is built-in',
    },
  });
}
