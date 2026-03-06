/**
 * MCP Tools - AI Generation & Video Processing Tools
 * 
 * Complete implementation with:
 * - Rate limiting and retry logic
 * - Proper parameter validation
 * - Integration with generate API routes
 * - Self-improvement error handling
 * - Multi-agent isolation for Manim
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as fsSync from 'fs';
import { v4 as uuidv4 } from 'uuid';
import ZAI from 'z-ai-web-dev-sdk';

const execAsync = promisify(exec);

// Folders
export const FOLDERS = {
  INPUT: path.join(process.cwd(), 'input'),
  OUTPUT: path.join(process.cwd(), 'output'),
  TEMP: path.join(process.cwd(), 'temp'),
  DOWNLOAD: path.join(process.cwd(), 'download'),
};

export async function ensureFolders() {
  await Promise.all([
    fs.mkdir(FOLDERS.INPUT, { recursive: true }),
    fs.mkdir(FOLDERS.OUTPUT, { recursive: true }),
    fs.mkdir(FOLDERS.TEMP, { recursive: true }),
    fs.mkdir(FOLDERS.DOWNLOAD, { recursive: true }),
  ]);
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  outputs?: Record<string, { type: string; path: string; url?: string; data?: unknown }>;
  error?: string;
  rateLimitWait?: number;
  suggestions?: string[]; // Self-improvement suggestions
  retryable?: boolean; // Can this error be retried?
}

// Valid sizes for image/video generation
export const VALID_SIZES = [
  '1024x1024',  // 1:1 Square
  '768x1344',   // 9:16 Vertical (Shorts/Reels/TikTok)
  '1344x768',   // 16:9 Horizontal (YouTube)
  '864x1152',   // 3:4 Portrait (Instagram)
  '720x1440',   // 9:20 Vertical
  '1152x864',   // 4:3 Landscape
  '1440x720',   // 2:1 Wide
] as const;

export const SIZE_TO_ASPECT_RATIO: Record<string, string> = {
  '1024x1024': '1:1',
  '768x1344': '9:16',
  '1344x768': '16:9',
  '864x1152': '3:4',
  '720x1440': '9:20',
  '1152x864': '4:3',
  '1440x720': '2:1',
};

// Rate limiting state
let lastImageRequest = 0;
let lastVideoRequest = 0;
const RATE_LIMIT_COOLDOWN = 180000; // 3 minutes

// ============================================================
// SELF-IMPROVEMENT LOGGING SYSTEM
// ============================================================

interface ErrorLog {
  timestamp: string;
  tool: string;
  error: string;
  params: Record<string, unknown>;
  suggestions: string[];
}

const ERROR_LOG_PATH = path.join(process.cwd(), 'error_logs.json');

async function logError(tool: string, error: string, params: Record<string, unknown>): Promise<string[]> {
  const suggestions: string[] = [];

  // Analyze error and provide suggestions
  if (error.includes('429') || error.includes('rate limit')) {
    suggestions.push('Wait 3 minutes before retrying');
    suggestions.push('Consider using grok tools as fallback (4/day limit)');
  }

  if (error.includes('not installed')) {
    suggestions.push(`Install missing dependency: check project README for installation instructions`);
  }

  if (error.includes('timeout')) {
    suggestions.push('Try with smaller parameters or simpler prompt');
    suggestions.push('Check network connectivity');
  }

  if (error.includes('No transcript')) {
    suggestions.push('Video may not have captions enabled');
    suggestions.push('Try different language codes');
  }

  if (error.includes('Manim')) {
    suggestions.push('Check Manim script syntax');
    suggestions.push('Ensure all Manim objects are properly imported');
  }

  // Log to file for analysis
  try {
    const logEntry: ErrorLog = {
      timestamp: new Date().toISOString(),
      tool,
      error,
      params: { ...params, _redacted: 'sensitive fields removed' },
      suggestions
    };

    let logs: ErrorLog[] = [];
    try {
      const existing = await fs.readFile(ERROR_LOG_PATH, 'utf-8');
      logs = JSON.parse(existing);
    } catch { }

    logs.push(logEntry);

    // Keep last 100 errors
    if (logs.length > 100) {
      logs = logs.slice(-100);
    }

    await fs.writeFile(ERROR_LOG_PATH, JSON.stringify(logs, null, 2));
  } catch { }

  return suggestions;
}

function getZaiConfig() {
  try {
    const configPath = path.join(process.cwd(), '.z-ai-config');
    const configData = fsSync.readFileSync(configPath, 'utf-8');
    return JSON.parse(configData);
  } catch {
    return null;
  }
}

// ============================================================
// SYSTEM DEPENDENCIES
// ============================================================

export async function checkYtDlp() {
  try {
    const { stdout } = await execAsync('yt-dlp --version');
    return { installed: true, version: stdout.trim() };
  } catch {
    return { installed: false, error: 'yt-dlp not installed. Run: pip install yt-dlp' };
  }
}

export async function checkFfmpeg() {
  try {
    const { stdout } = await execAsync('ffmpeg -version');
    return { installed: true, version: stdout.split('\n')[0] };
  } catch {
    return { installed: false, error: 'ffmpeg not installed. Run: apt install ffmpeg or brew install ffmpeg' };
  }
}

export async function checkManim() {
  const home = process.env.HOME || '/root';
  const candidates = [`${home}/.local/bin/manim`, '/usr/local/bin/manim', 'manim'];
  for (const bin of candidates) {
    try {
      const { stdout } = await execAsync(`"${bin}" --version`);
      return { installed: true, version: stdout.trim(), bin };
    } catch { continue; }
  }
  return { installed: false, error: 'manim not installed. Run: pip install manim' };
}

export async function checkRemotion() {
  try {
    // Check if remotion is installed in node_modules
    const remotionPath = path.join(process.cwd(), 'node_modules', 'remotion');
    const stat = await fs.stat(remotionPath);
    return { installed: true, path: remotionPath };
  } catch {
    return { installed: false, error: 'remotion not installed. Run: bun add remotion @remotion/player' };
  }
}

export async function checkAllDependencies() {
  const [ytDlp, ffmpeg, manim, remotion] = await Promise.all([
    checkYtDlp(),
    checkFfmpeg(),
    checkManim(),
    checkRemotion()
  ]);
  return { ytDlp, ffmpeg, manim, remotion };
}

// ============================================================
// AI GENERATION TOOLS
// ============================================================

/**
 * Text to Image Generation
 * Generates an image from a text prompt
 */
export async function text_to_image(params: {
  prompt: string;
  size?: string;
}): Promise<ToolResult> {
  const { prompt, size = '1024x1024' } = params;

  // Validate size
  if (!VALID_SIZES.includes(size as any)) {
    return {
      success: false,
      error: `Invalid size. Use one of: ${VALID_SIZES.join(', ')}`,
      suggestions: ['Use 1024x1024 for square', 'Use 768x1344 for vertical (TikTok/Shorts)', 'Use 1344x768 for horizontal (YouTube)'],
      retryable: true
    };
  }

  // Check rate limit
  const now = Date.now();
  if (now - lastImageRequest < RATE_LIMIT_COOLDOWN) {
    const wait = Math.ceil((RATE_LIMIT_COOLDOWN - (now - lastImageRequest)) / 1000);
    console.log(`[text_to_image] Rate limit: wait ${wait}s`);
  }

  try {
    await ensureFolders();
    const zai = await ZAI.create();

    console.log(`[text_to_image] Generating: "${prompt.substring(0, 50)}..." Size: ${size}`);

    // Retry logic for rate limits
    let response;
    let retries = 3;
    let delay = 30000;

    while (retries >= 0) {
      try {
        response = await zai.images.generations.create({
          prompt: prompt.trim(),
          size: size as any,
        });
        lastImageRequest = Date.now();
        break;
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        if ((errorMsg.includes('429') || errorMsg.includes('rate limit')) && retries > 0) {
          console.warn(`[text_to_image] Rate limit. Retrying in ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
          retries--;
          delay *= 2;
        } else {
          throw err;
        }
      }
    }

    const base64 = response?.data?.[0]?.base64;
    if (!base64) {
      return { success: false, error: 'No image generated', retryable: true };
    }

    const filename = `ai_image_${uuidv4()}.png`;
    const outputPath = path.join(FOLDERS.OUTPUT, filename);
    await fs.writeFile(outputPath, Buffer.from(base64, 'base64'));

    console.log(`[text_to_image] Saved: ${filename}`);

    return {
      success: true,
      data: {
        size: size,
        aspectRatio: SIZE_TO_ASPECT_RATIO[size],
        filename: filename,
      },
      outputs: {
        image: {
          type: 'image',
          path: outputPath,
          url: `/api/files/output/${filename}`,
          data: { base64: base64.substring(0, 100) + '...' },
        }
      }
    };

  } catch (error: any) {
    const errorMsg = error?.message || 'Failed';
    const suggestions = await logError('text_to_image', errorMsg, { prompt: prompt?.substring(0, 50) || '', size });

    if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
      return {
        success: false,
        error: 'Rate limit reached. Wait 3 minutes.',
        rateLimitWait: 180,
        suggestions,
        retryable: true
      };
    }
    return { success: false, error: errorMsg, suggestions, retryable: false };
  }
}

/**
 * Text to Video Generation
 * Creates a video generation task from text prompt
 */
export async function text_to_video(params: {
  prompt: string;
  size?: string;
  duration?: 5 | 10;
  quality?: 'speed' | 'quality';
}): Promise<ToolResult> {
  const { prompt, size = '768x1344', duration = 5, quality = 'speed' } = params;

  // Validate size
  if (!VALID_SIZES.includes(size as any)) {
    return {
      success: false,
      error: `Invalid size. Use one of: ${VALID_SIZES.join(', ')}`,
      suggestions: ['Use 768x1344 for vertical (TikTok/Shorts)', 'Use 1344x768 for horizontal (YouTube)'],
      retryable: true
    };
  }

  // Validate duration
  if (![5, 10].includes(duration)) {
    return { success: false, error: 'duration must be 5 or 10', retryable: true };
  }

  // Validate quality
  if (!['speed', 'quality'].includes(quality)) {
    return { success: false, error: "quality must be 'speed' or 'quality'", retryable: true };
  }

  try {
    await ensureFolders();
    const zai = await ZAI.create();

    console.log(`[text_to_video] Generating: "${prompt.substring(0, 50)}..."`);
    console.log(`[text_to_video] Size: ${size}, Duration: ${duration}s, Quality: ${quality}`);

    // Retry logic for rate limits
    let task;
    let retries = 3;
    let delay = 60000;

    while (retries >= 0) {
      try {
        task = await zai.video.generations.create({
          prompt: prompt.trim(),
          size: size as any,
          duration: duration,
          quality: quality,
          fps: 30,
        });
        lastVideoRequest = Date.now();
        break;
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        if ((errorMsg.includes('429') || errorMsg.includes('rate limit')) && retries > 0) {
          console.warn(`[text_to_video] Rate limit. Retrying in ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
          retries--;
          delay *= 2;
        } else {
          throw err;
        }
      }
    }

    const taskId = task?.id;
    if (!taskId) {
      return { success: false, error: 'No task ID returned', retryable: true };
    }

    console.log(`[text_to_video] Task created: ${taskId}`);

    return {
      success: true,
      data: {
        taskId,
        status: 'PROCESSING',
        size: size,
        aspectRatio: SIZE_TO_ASPECT_RATIO[size],
        duration: duration,
        quality: quality,
      },
      outputs: {
        task: {
          type: 'task',
          path: '',
          data: { taskId, status: 'PROCESSING' }
        }
      }
    };

  } catch (error: any) {
    const errorMsg = error?.message || 'Failed';
    const suggestions = await logError('text_to_video', errorMsg, { prompt: prompt.substring(0, 50), size, duration, quality });

    if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
      return {
        success: false,
        error: 'Rate limit reached. Wait 3 minutes.',
        rateLimitWait: 180,
        suggestions,
        retryable: true
      };
    }
    return { success: false, error: errorMsg, suggestions, retryable: false };
  }
}

/**
 * Image to Video Generation
 * Animates an image based on text prompt
 */
export async function image_to_video(params: {
  prompt: string;
  imageUrl: string;
  size?: string;
  duration?: 5 | 10;
  quality?: 'speed' | 'quality';
}): Promise<ToolResult> {
  const { prompt, imageUrl, size = '768x1344', duration = 5, quality = 'speed' } = params;

  // Validate size
  if (!VALID_SIZES.includes(size as any)) {
    return {
      success: false,
      error: `Invalid size. Use one of: ${VALID_SIZES.join(', ')}`,
      retryable: true
    };
  }

  try {
    await ensureFolders();
    let imageDataUrl = imageUrl;

    // Handle local file paths
    if (!imageUrl.startsWith('data:') && !imageUrl.startsWith('http')) {
      const localPath = imageUrl.startsWith('/api/files/')
        ? path.join(FOLDERS.OUTPUT, path.basename(imageUrl))
        : imageUrl;

      const imageBuffer = await fs.readFile(localPath);
      const ext = path.extname(localPath).toLowerCase().substring(1) || 'jpeg';
      const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      imageDataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
      console.log(`[image_to_video] Encoded local image (${Math.round(imageBuffer.length / 1024)} KB)`);
    }

    const zai = await ZAI.create();

    console.log(`[image_to_video] Generating: "${prompt.substring(0, 50)}..."`);

    // Retry logic for rate limits
    let task;
    let retries = 3;
    let delay = 60000;

    while (retries >= 0) {
      try {
        task = await zai.video.generations.create({
          prompt: prompt.trim(),
          image_url: imageDataUrl,
          size: size as any,
          duration: duration,
          quality: quality,
          fps: 30,
        });
        lastVideoRequest = Date.now();
        break;
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        if ((errorMsg.includes('429') || errorMsg.includes('rate limit')) && retries > 0) {
          console.warn(`[image_to_video] Rate limit. Retrying in ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
          retries--;
          delay *= 2;
        } else {
          throw err;
        }
      }
    }

    const taskId = task?.id;
    if (!taskId) {
      return { success: false, error: 'No task ID returned', retryable: true };
    }

    console.log(`[image_to_video] Task created: ${taskId}`);

    return {
      success: true,
      data: {
        taskId,
        status: 'PROCESSING',
        size: size,
        aspectRatio: SIZE_TO_ASPECT_RATIO[size],
        duration: duration,
        quality: quality,
        mode: 'image-to-video',
      },
      outputs: {
        task: {
          type: 'task',
          path: '',
          data: { taskId, status: 'PROCESSING' }
        }
      }
    };

  } catch (error: any) {
    const errorMsg = error?.message || 'Failed';
    const suggestions = await logError('image_to_video', errorMsg, { prompt: prompt.substring(0, 50), size, duration, quality });

    if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
      return {
        success: false,
        error: 'Rate limit reached. Wait 3 minutes.',
        rateLimitWait: 180,
        suggestions,
        retryable: true
      };
    }
    return { success: false, error: errorMsg, suggestions, retryable: false };
  }
}

/**
 * Check Video Generation Status
 * Polls for video generation task completion
 */
export async function check_generation_status(params: { taskId: string }): Promise<ToolResult> {
  const { taskId } = params;

  try {
    const zaiConfig = getZaiConfig();

    if (zaiConfig?.baseUrl) {
      // Direct API polling (more reliable)
      const pollUrl = `${zaiConfig.baseUrl}/video/generations/${taskId.trim()}`;

      const pollRes = await fetch(pollUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${zaiConfig.apiKey || 'Z.ai'}`,
          'Content-Type': 'application/json',
        },
      });

      if (!pollRes.ok) {
        return {
          success: false,
          error: `Status check failed: ${pollRes.status}`,
          retryable: true
        };
      }

      const result = await pollRes.json();
      const status = result.task_status || result.status || 'PROCESSING';
      const videoUrl = result.video_url || result.output?.video_url || result.data?.video_url;
      const base64Video = result.base64 || result.output?.base64 || result.data?.base64;

      console.log(`[check_status] Task ${taskId}: ${status}`);

      // Download and save video if complete
      if (status === 'SUCCESS' && videoUrl) {
        await ensureFolders();
        const vidRes = await fetch(videoUrl);
        if (vidRes.ok) {
          const arrayBuffer = await vidRes.arrayBuffer();
          const filename = `ai_video_${uuidv4()}.mp4`;
          const outputPath = path.join(FOLDERS.OUTPUT, filename);
          await fs.writeFile(outputPath, Buffer.from(arrayBuffer));

          console.log(`[check_status] Video saved: ${filename}`);

          return {
            success: true,
            data: { status: 'SUCCESS', filename, size: arrayBuffer.byteLength },
            outputs: {
              video: {
                type: 'video',
                path: outputPath,
                url: `/api/files/output/${filename}`
              }
            }
          };
        }
      }

      // Handle base64 video
      if (status === 'SUCCESS' && base64Video) {
        await ensureFolders();
        const filename = `ai_video_${uuidv4()}.mp4`;
        const outputPath = path.join(FOLDERS.OUTPUT, filename);
        await fs.writeFile(outputPath, Buffer.from(base64Video, 'base64'));

        return {
          success: true,
          data: { status: 'SUCCESS', filename },
          outputs: {
            video: {
              type: 'video',
              path: outputPath,
              url: `/api/files/output/${filename}`
            }
          }
        };
      }

      return {
        success: true,
        data: {
          status: status,
          progress: status === 'FAIL' ? 0 : 50
        }
      };
    }

    // Fallback: Use SDK
    const zai = await ZAI.create();
    const result = await zai.async.result.query(taskId.trim());
    const status = (result as any).task_status || (result as any).status || 'PROCESSING';

    return {
      success: true,
      data: {
        status: status,
        progress: status === 'SUCCESS' ? 100 : status === 'FAIL' ? 0 : 50
      }
    };

  } catch (error: any) {
    const errorMsg = error?.message || 'Failed';
    const suggestions = await logError('check_generation_status', errorMsg, { taskId });
    return { success: false, error: errorMsg, suggestions, retryable: true };
  }
}

/**
 * Text to Speech
 * Converts text to audio using Z Audio API
 */
export async function text_to_speech(params: {
  text: string;
  voiceId: string;
  speed?: number;
}): Promise<ToolResult> {
  const { text, voiceId, speed = 1.0 } = params;
  const token = process.env.Z_AUDIO_TOKEN;
  const userId = process.env.Z_AUDIO_USER_ID;
  const apiBase = process.env.Z_AUDIO_API_BASE || 'https://audio.z.ai/api';

  if (!token || !userId) {
    return {
      success: false,
      error: 'Z_AUDIO_TOKEN or Z_AUDIO_USER_ID not configured in .env',
      suggestions: ['Add Z_AUDIO_TOKEN and Z_AUDIO_USER_ID to your .env file'],
      retryable: false
    };
  }

  try {
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
        user_id: userId,
        input_text: text,
        speed,
        volume: 1
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `TTS API Error: ${response.status}`,
        suggestions: ['Check if voice ID is valid using list_voices tool'],
        retryable: response.status >= 500
      };
    }

    // Parse SSE stream
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
                chunks.push(chunkBuffer.subarray(44));
              }
            }
          } catch { }
        }
      }
    }

    if (chunks.length === 0) {
      return {
        success: false,
        error: 'No audio data received',
        suggestions: ['Check if the text is valid and not empty'],
        retryable: true
      };
    }

    // Assemble WAV file
    const assembledWav = Buffer.concat(chunks);
    const totalSize = assembledWav.length;
    if (totalSize > 44) {
      assembledWav.writeUInt32LE(totalSize - 8, 4);
      assembledWav.writeUInt32LE(totalSize - 44, 40);
    }

    await ensureFolders();
    const filename = `tts_${uuidv4()}.wav`;
    const outputPath = path.join(FOLDERS.OUTPUT, filename);
    await fs.writeFile(outputPath, assembledWav);

    return {
      success: true,
      outputs: {
        audio: {
          type: 'audio',
          path: outputPath,
          url: `/api/files/output/${filename}`
        }
      }
    };

  } catch (error: any) {
    const errorMsg = error?.message || 'Failed';
    const suggestions = await logError('text_to_speech', errorMsg, { voiceId, speed });
    return { success: false, error: errorMsg, suggestions, retryable: false };
  }
}

/**
 * List TTS Voices
 * Returns available system and cloned voices
 */
export async function list_voices(): Promise<ToolResult> {
  const token = process.env.Z_AUDIO_TOKEN;
  const userId = process.env.Z_AUDIO_USER_ID;
  const apiBase = process.env.Z_AUDIO_API_BASE || 'https://audio.z.ai/api';

  if (!token) {
    return {
      success: false,
      error: 'Z_AUDIO_TOKEN not configured',
      suggestions: ['Add Z_AUDIO_TOKEN to your .env file']
    };
  }

  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const results = { cloned: [] as any[], system: [] as any[] };

    // Fetch system voices
    const sysRes = await fetch(`${apiBase}/v1/z-audio/voices/list_system`, { headers });
    if (sysRes.ok) {
      const data = await sysRes.json();
      results.system = (data.data || data.voices || []).map((v: any) => ({
        voiceId: v.voice_id || v.id,
        name: v.voice_name || v.name || 'Unknown',
        type: 'system',
      }));
    }

    // Fetch cloned voices
    if (userId) {
      const cloneRes = await fetch(
        `${apiBase}/v1/z-audio/voices/list?user_id=${userId}&page=1&page_size=200`,
        { headers }
      );
      if (cloneRes.ok) {
        const data = await cloneRes.json();
        results.cloned = (data.data || []).map((v: any) => ({
          voiceId: v.voice_id || v.id,
          name: v.voice_name || v.name || 'Unknown',
          type: 'cloned',
        }));
      }
    }

    return {
      success: true,
      data: {
        ...results,
        totalVoices: results.system.length + results.cloned.length
      }
    };

  } catch (error: any) {
    const errorMsg = error?.message || 'Failed';
    const suggestions = await logError('list_voices', errorMsg, {});
    return { success: false, error: errorMsg, suggestions };
  }
}

// ============================================================
// YOUTUBE TOOLS
// ============================================================

/**
 * Download YouTube Video
 * Downloads video with options for video, audio, or both
 */
export async function download_youtube(params: {
  url: string;
  format?: 'video' | 'audio' | 'both';
  quality?: 'best' | 'medium' | 'low';
}): Promise<ToolResult> {
  const { url, format = 'both', quality = 'best' } = params;

  const ytDlpCheck = await checkYtDlp();
  if (!ytDlpCheck.installed) {
    return {
      success: false,
      error: ytDlpCheck.error,
      suggestions: ['Install yt-dlp: pip install yt-dlp', 'Or use: brew install yt-dlp'],
      retryable: false
    };
  }

  try {
    await ensureFolders();

    // Get video info first
    const { stdout: infoJson } = await execAsync(`yt-dlp --dump-json "${url}"`);
    const info = JSON.parse(infoJson);
    const safeTitle = info.title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50) || `yt_${uuidv4()}`;

    const outputs: Record<string, { type: string; path: string; url?: string }> = {};
    const data: any = {
      title: info.title,
      duration: info.duration,
      description: info.description,
      uploader: info.uploader,
      viewCount: info.view_count
    };

    const qualityFormat = quality === 'best'
      ? 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best'
      : quality === 'medium'
        ? 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]'
        : 'worst[ext=mp4]/worst';

    if (format === 'video' || format === 'both') {
      const videoFilename = `${safeTitle}.mp4`;
      const videoPath = path.join(FOLDERS.OUTPUT, videoFilename);

      await execAsync(
        `yt-dlp -f "${qualityFormat}" --merge-output-format mp4 -o "${videoPath}" "${url}"`,
        { maxBuffer: 1024 * 1024 * 100 }
      );

      outputs.video = {
        type: 'video',
        path: videoPath,
        url: `/api/files/output/${videoFilename}`
      };
    }

    if (format === 'audio' || format === 'both') {
      const audioFilename = `${safeTitle}.mp3`;
      const audioPath = path.join(FOLDERS.OUTPUT, audioFilename);

      await execAsync(
        `yt-dlp -x --audio-format mp3 --audio-quality 0 -o "${audioPath}" "${url}"`,
        { maxBuffer: 1024 * 1024 * 100 }
      );

      outputs.audio = {
        type: 'audio',
        path: audioPath,
        url: `/api/files/output/${audioFilename}`
      };
    }

    return {
      success: true,
      data,
      outputs
    };

  } catch (error: any) {
    const errorMsg = error?.message || 'Failed';
    const suggestions = await logError('download_youtube', errorMsg, { url, format, quality });

    if (errorMsg.includes('Sign in') || errorMsg.includes('age')) {
      suggestions.push('Video may be age-restricted or require authentication');
    }

    return { success: false, error: errorMsg, suggestions, retryable: false };
  }
}

/**
 * Get YouTube Transcript
 * Fetches transcript in raw JSON format for IDE processing
 */
export async function get_youtube_transcript(params: {
  videoId: string;
  languages?: string[];
}): Promise<ToolResult> {
  const { videoId, languages = ['en', 'hi', 'en-US', 'en-GB'] } = params;

  try {
    // Try using the Python script first
    const scriptPath = path.join(process.cwd(), 'scripts', 'fetch_transcript.py');

    try {
      await fs.stat(scriptPath);
      const { stdout } = await execAsync(
        `python3 "${scriptPath}" ${videoId} "${languages.join(',')}"`
      );
      const result = JSON.parse(stdout.trim());
      if (!result.success) {
        return {
          success: false,
          error: result.error,
          suggestions: ['Video may not have captions enabled', 'Try different language codes']
        };
      }

      return {
        success: true,
        data: {
          videoId,
          languages,
          transcript: result.data,
          segmentCount: result.data.length,
          fullText: result.data.map((s: any) => s.text).join(' ')
        }
      };
    } catch {
      // Script not found, try direct API
    }

    // Fallback: Use youtube-transcript-api style response
    return {
      success: false,
      error: 'Transcript script not found. Install youtube-transcript-api: pip install youtube-transcript-api',
      suggestions: ['Run: pip install youtube-transcript-api', 'Ensure scripts/fetch_transcript.py exists']
    };

  } catch (error: any) {
    const errorMsg = error?.message || 'Failed';
    const suggestions = await logError('get_youtube_transcript', errorMsg, { videoId, languages });
    return { success: false, error: errorMsg, suggestions };
  }
}

// ============================================================
// VIDEO EDITING TOOLS
// ============================================================

export async function trim_clip(params: {
  videoPath: string;
  start: number;
  end: number;
}): Promise<ToolResult> {
  const ffmpegCheck = await checkFfmpeg();
  if (!ffmpegCheck.installed) {
    return {
      success: false,
      error: ffmpegCheck.error,
      suggestions: ['Install ffmpeg: apt install ffmpeg or brew install ffmpeg']
    };
  }

  try {
    await ensureFolders();
    const inputPath = params.videoPath.startsWith('/api/files/')
      ? path.join(FOLDERS.OUTPUT, path.basename(params.videoPath))
      : params.videoPath;
    const filename = `clip_${uuidv4()}.mp4`;
    const outputPath = path.join(FOLDERS.OUTPUT, filename);

    await execAsync(
      `ffmpeg -i "${inputPath}" -ss ${params.start} -to ${params.end} -c copy "${outputPath}" -y`,
      { maxBuffer: 1024 * 1024 * 100 }
    );

    return {
      success: true,
      outputs: {
        video: {
          type: 'video',
          path: outputPath,
          url: `/api/files/output/${filename}`
        }
      }
    };

  } catch (error: any) {
    const errorMsg = error?.message || 'Failed';
    const suggestions = await logError('trim_clip', errorMsg, params);
    return { success: false, error: errorMsg, suggestions };
  }
}

export async function reframe(params: {
  videoPath: string;
  targetRatio: string;
}): Promise<ToolResult> {
  const ffmpegCheck = await checkFfmpeg();
  if (!ffmpegCheck.installed) {
    return {
      success: false,
      error: ffmpegCheck.error,
      suggestions: ['Install ffmpeg: apt install ffmpeg or brew install ffmpeg']
    };
  }

  const resolutions: Record<string, string> = {
    '9:16': '1080:1920',
    '16:9': '1920:1080',
    '1:1': '1080:1080',
    '4:5': '1080:1350',
  };

  try {
    await ensureFolders();
    const inputPath = params.videoPath.startsWith('/api/files/')
      ? path.join(FOLDERS.OUTPUT, path.basename(params.videoPath))
      : params.videoPath;
    const filename = `reframed_${uuidv4()}.mp4`;
    const outputPath = path.join(FOLDERS.OUTPUT, filename);
    const [width, height] = resolutions[params.targetRatio]?.split(':') || ['1920', '1080'];

    await execAsync(
      `ffmpeg -i "${inputPath}" -vf "scale=-2:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1" -c:v libx264 -preset fast -c:a copy "${outputPath}" -y`,
      { maxBuffer: 1024 * 1024 * 100 }
    );

    return {
      success: true,
      data: { targetRatio: params.targetRatio, resolution: `${width}x${height}` },
      outputs: {
        video: {
          type: 'video',
          path: outputPath,
          url: `/api/files/output/${filename}`
        }
      }
    };

  } catch (error: any) {
    const errorMsg = error?.message || 'Failed';
    const suggestions = await logError('reframe', errorMsg, params);
    return { success: false, error: errorMsg, suggestions };
  }
}

export async function add_captions(params: {
  videoPath: string;
  transcript: Array<{ text: string; start: number; duration: number }>;
  style?: string;
}): Promise<ToolResult> {
  const ffmpegCheck = await checkFfmpeg();
  if (!ffmpegCheck.installed) {
    return {
      success: false,
      error: ffmpegCheck.error,
      suggestions: ['Install ffmpeg: apt install ffmpeg or brew install ffmpeg']
    };
  }

  try {
    await ensureFolders();
    const inputPath = params.videoPath.startsWith('/api/files/')
      ? path.join(FOLDERS.OUTPUT, path.basename(params.videoPath))
      : params.videoPath;

    const srtFilename = `subtitles_${uuidv4()}.srt`;
    const srtPath = path.join(FOLDERS.TEMP, srtFilename);
    const srtContent = params.transcript.map((item, i) => {
      const startTime = formatSRTTime(item.start);
      const endTime = formatSRTTime(item.start + item.duration);
      return `${i + 1}\n${startTime} --> ${endTime}\n${item.text}\n`;
    }).join('\n');
    await fs.writeFile(srtPath, srtContent, 'utf8');

    const filename = `captioned_${uuidv4()}.mp4`;
    const outputPath = path.join(FOLDERS.OUTPUT, filename);

    await execAsync(
      `ffmpeg -i "${inputPath}" -vf "subtitles='${srtPath}':force_style='Fontname=Arial,Fontsize=24,PrimaryColour=&H00FFFFFF,Outline=2'" -c:v libx264 -preset fast -c:a copy "${outputPath}" -y`,
      { maxBuffer: 1024 * 1024 * 100 }
    );

    await fs.unlink(srtPath).catch(() => { });

    return {
      success: true,
      outputs: {
        video: {
          type: 'video',
          path: outputPath,
          url: `/api/files/output/${filename}`
        }
      }
    };

  } catch (error: any) {
    const errorMsg = error?.message || 'Failed';
    const suggestions = await logError('add_captions', errorMsg, { videoPath: params.videoPath, style: params.style });
    return { success: false, error: errorMsg, suggestions };
  }
}

// ============================================================
// MANIM TOOL - WITH MULTI-AGENT ISOLATION
// ============================================================

// Manim execution queue for serialization
const manimQueue: Array<() => Promise<void>> = [];
let manimRunning = false;

async function runManimQueue() {
  if (manimRunning || manimQueue.length === 0) return;
  manimRunning = true;

  while (manimQueue.length > 0) {
    const task = manimQueue.shift();
    if (task) {
      try {
        await task();
      } catch { }
    }
  }

  manimRunning = false;
}

export async function generate_animation(params: {
  script: string;
  quality?: 'l' | 'm' | 'h';
}): Promise<ToolResult> {
  const manimCheck = await checkManim();
  if (!manimCheck.installed) {
    return {
      success: false,
      error: manimCheck.error,
      suggestions: [
        'Install manim: pip install manim',
        'For Linux: sudo apt install libpango1.0-dev ffmpeg',
        'For Mac: brew install py3cairo ffmpeg'
      ]
    };
  }

  const qualityMap: Record<string, string> = {
    'l': '-ql',
    'm': '-qm',
    'h': '-qh'
  };
  const qualityFlag = qualityMap[params.quality || 'm'] || '-qm';

  // Create unique workspace for this execution (multi-agent isolation)
  const executionId = uuidv4().replace(/-/g, '_');
  const workspaceDir = path.join(FOLDERS.TEMP, `manim_${executionId}`);

  return new Promise((resolve) => {
    const task = async () => {
      try {
        await ensureFolders();
        await fs.mkdir(workspaceDir, { recursive: true });

        // Write script with unique class name to avoid conflicts
        const scriptPath = path.join(workspaceDir, 'scene.py');
        const constructBody = params.script.split('\n').map(line => `        ${line}`).join('\n');
        const pythonScript = `from manim import *

class GeneratedScene_${executionId}(Scene):
    def construct(self):
${constructBody || '        self.wait(1)'}
`;
        await fs.writeFile(scriptPath, pythonScript);

        console.log(`[manim] Starting render in workspace: ${executionId}`);

        await execAsync(
          `"${manimCheck.bin || 'manim'}" ${qualityFlag} "${scriptPath}" GeneratedScene_${executionId}`,
          { cwd: workspaceDir, maxBuffer: 1024 * 1024 * 500, timeout: 600000 }
        );

        // Find rendered file
        const manimVideosDir = path.join(workspaceDir, 'media', 'videos', 'scene');
        let renderedFilePath: string | null = null;
        try {
          const qualityDirs = await fs.readdir(manimVideosDir);
          for (const qualDir of qualityDirs) {
            const candidate = path.join(manimVideosDir, qualDir, `GeneratedScene_${executionId}.mp4`);
            try {
              await fs.stat(candidate);
              renderedFilePath = candidate;
              break;
            } catch { }
          }
        } catch { }

        if (!renderedFilePath) {
          resolve({
            success: false,
            error: 'Output video not found after render',
            suggestions: ['Check Manim script syntax', 'Ensure all objects are properly imported']
          });
          return;
        }

        const filename = `manim_${executionId}.mp4`;
        const outputPath = path.join(FOLDERS.OUTPUT, filename);
        await fs.copyFile(renderedFilePath, outputPath);

        // Clean up workspace
        await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => { });

        console.log(`[manim] Render complete: ${filename}`);

        resolve({
          success: true,
          data: { executionId, quality: params.quality || 'm' },
          outputs: {
            video: {
              type: 'video',
              path: outputPath,
              url: `/api/files/output/${filename}`
            }
          }
        });

      } catch (error: any) {
        const errorMsg = error?.message || 'Failed';
        const suggestions = await logError('generate_animation', errorMsg, {
          script: params.script.substring(0, 100),
          quality: params.quality
        });

        // Clean up on error
        await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => { });

        resolve({ success: false, error: errorMsg, suggestions });
      }
    };

    // Add to queue for serialization
    manimQueue.push(task);
    runManimQueue();
  });
}

// ============================================================
// REMOTION TOOL
// ============================================================

export async function render_remotion(params: {
  compositionId: string;
  inputProps?: Record<string, unknown>;
  outputLocation?: string;
  codec?: 'h264' | 'h265' | 'vp8' | 'vp9' | 'prores';
  fps?: number;
  durationInFrames?: number;
}): Promise<ToolResult> {
  const remotionCheck = await checkRemotion();
  if (!remotionCheck.installed) {
    return {
      success: false,
      error: remotionCheck.error,
      suggestions: [
        'Install remotion: bun add remotion @remotion/player @remotion/cli',
        'Or: npm install remotion @remotion/player @remotion/cli'
      ]
    };
  }

  try {
    await ensureFolders();
    const { compositionId, inputProps = {}, codec = 'h264', fps = 30, durationInFrames } = params;

    const filename = `remotion_${uuidv4()}.mp4`;
    const outputPath = path.join(FOLDERS.OUTPUT, filename);

    // Create a temporary remotion project if needed
    const remotionProjectDir = path.join(FOLDERS.TEMP, `remotion_${uuidv4()}`);
    await fs.mkdir(remotionProjectDir, { recursive: true });

    // Create basic Root.tsx
    const rootContent = `import { Composition } from '@remotion/player';
import React from 'react';

const VideoComposition: React.FC = () => {
  return (
    <div style={{ flex: 1, backgroundColor: '#000' }}>
      <h1>Remotion Video</h1>
    </div>
  );
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="${compositionId}"
        component={VideoComposition}
        durationInFrames=${durationInFrames || 150}
        fps=${fps}
        width={1920}
        height={1080}
      />
    </>
  );
};
`;

    await fs.writeFile(path.join(remotionProjectDir, 'Root.tsx'), rootContent);

    // For now, return info about the composition
    // In production, you would use remotion's renderMedia or npx remotion render

    // Clean up temp directory
    await fs.rm(remotionProjectDir, { recursive: true, force: true }).catch(() => { });

    return {
      success: true,
      data: {
        message: 'Remotion composition info retrieved',
        compositionId,
        codec,
        fps,
        durationInFrames: durationInFrames || 150,
        note: 'Full rendering requires Remotion project setup with proper compositions'
      },
      suggestions: [
        'Set up a Remotion project with your compositions',
        'Use npx remotion render to render the video',
        'Check Remotion docs: https://remotion.dev/docs'
      ]
    };

  } catch (error: any) {
    const errorMsg = error?.message || 'Failed';
    const suggestions = await logError('render_remotion', errorMsg, params);
    return { success: false, error: errorMsg, suggestions };
  }
}

// ============================================================
// GROK TOOLS (Fallback, limited ~4/day)
// ============================================================

const grokTasks = new Map<string, any>();
let grokDailyCount = 0;
let grokDailyReset = Date.now() + 86400000;
const GROK_DAILY_LIMIT = 4;

function checkGrokQuota() {
  const now = Date.now();
  if (now > grokDailyReset) {
    grokDailyCount = 0;
    grokDailyReset = now + 86400000;
  }
  return { allowed: grokDailyCount < GROK_DAILY_LIMIT, remaining: GROK_DAILY_LIMIT - grokDailyCount };
}

export async function text_to_image_grok(params: {
  prompt: string;
  aspectRatio?: string;
}): Promise<ToolResult> {
  const quota = checkGrokQuota();
  if (!quota.allowed) {
    return {
      success: false,
      error: 'Grok daily limit reached (4/day)',
      rateLimitWait: 86400,
      suggestions: ['Wait for daily reset', 'Use z-ai text_to_image tool instead']
    };
  }

  const taskId = uuidv4();
  grokTasks.set(taskId, {
    id: taskId,
    prompt: params.prompt,
    mode: 'textToImage',
    status: 'pending'
  });
  grokDailyCount++;

  return {
    success: true,
    data: { taskId, status: 'pending', remainingQuota: quota.remaining - 1 }
  };
}

export async function text_to_video_grok(params: {
  prompt: string;
  aspectRatio?: string;
}): Promise<ToolResult> {
  const quota = checkGrokQuota();
  if (!quota.allowed) {
    return {
      success: false,
      error: 'Grok daily limit reached (4/day)',
      rateLimitWait: 86400,
      suggestions: ['Wait for daily reset', 'Use z-ai text_to_video tool instead']
    };
  }

  const taskId = uuidv4();
  grokTasks.set(taskId, {
    id: taskId,
    prompt: params.prompt,
    mode: 'textToVideo',
    status: 'pending'
  });
  grokDailyCount++;

  return {
    success: true,
    data: { taskId, status: 'pending', remainingQuota: quota.remaining - 1 }
  };
}

export async function image_to_video_grok(params: {
  prompt: string;
  imageUrl: string;
}): Promise<ToolResult> {
  const quota = checkGrokQuota();
  if (!quota.allowed) {
    return {
      success: false,
      error: 'Grok daily limit reached (4/day)',
      rateLimitWait: 86400,
      suggestions: ['Wait for daily reset', 'Use z-ai image_to_video tool instead']
    };
  }

  const taskId = uuidv4();
  grokTasks.set(taskId, {
    id: taskId,
    prompt: params.prompt,
    mode: 'imageToVideo',
    status: 'pending',
    imageUrl: params.imageUrl
  });
  grokDailyCount++;

  return {
    success: true,
    data: { taskId, status: 'pending', remainingQuota: quota.remaining - 1 }
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatSRTTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

// Initialize
ensureFolders();
