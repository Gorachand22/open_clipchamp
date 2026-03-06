/**
 * MCP Tools - AI Generation & Video Processing Tools
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
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
}

// System Dependencies
export async function checkYtDlp() {
  try {
    const { stdout } = await execAsync('yt-dlp --version');
    return { installed: true, version: stdout.trim() };
  } catch {
    return { installed: false, error: 'yt-dlp not installed' };
  }
}

export async function checkFfmpeg() {
  try {
    const { stdout } = await execAsync('ffmpeg -version');
    return { installed: true, version: stdout.split('\n')[0] };
  } catch {
    return { installed: false, error: 'ffmpeg not installed' };
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
  return { installed: false, error: 'manim not installed' };
}

export async function checkAllDependencies() {
  const [ytDlp, ffmpeg, manim] = await Promise.all([checkYtDlp(), checkFfmpeg(), checkManim()]);
  return { ytDlp, ffmpeg, manim };
}

// Rate limiting
let lastZaiRequest = 0;
let zaiConsecutiveErrors = 0;
const ZAI_MIN_INTERVAL = 180000;

// AI Generation Tools
export async function text_to_image(params: { prompt: string; size?: string }): Promise<ToolResult> {
  const { prompt, size = '1024x1024' } = params;
  const validSizes = ['1024x1024', '768x1344', '1344x768', '864x1152', '720x1440', '1152x864', '1440x720'];
  
  if (!validSizes.includes(size)) {
    return { success: false, error: `Invalid size. Use: ${validSizes.join(', ')}` };
  }

  try {
    const zai = await ZAI.create();
    const response = await zai.images.generations.create({
      prompt: prompt.trim(),
      size: size as any,
    });

    const base64 = response.data?.[0]?.base64;
    if (!base64) return { success: false, error: 'No image generated' };

    await ensureFolders();
    const filename = `ai_image_${uuidv4()}.png`;
    const outputPath = path.join(FOLDERS.OUTPUT, filename);
    await fs.writeFile(outputPath, Buffer.from(base64, 'base64'));

    return {
      success: true,
      outputs: { image: { type: 'image', path: outputPath, url: `/api/files/output/${filename}` } }
    };
  } catch (error: any) {
    zaiConsecutiveErrors++;
    if (error?.message?.includes('429')) {
      return { success: false, error: 'Rate limit. Wait 3 min.', rateLimitWait: 180 };
    }
    return { success: false, error: error?.message || 'Failed' };
  }
}

export async function text_to_video(params: { prompt: string; size?: string; duration?: 5 | 10 }): Promise<ToolResult> {
  const { prompt, size = '768x1344', duration = 5 } = params;

  try {
    const zai = await ZAI.create();
    const task = await zai.video.generations.create({
      prompt: prompt.trim(),
      size,
      duration,
      quality: 'speed',
      fps: 30,
    });

    const taskId = task.id;
    if (!taskId) return { success: false, error: 'No task ID' };

    return {
      success: true,
      data: { taskId, status: 'PROCESSING' },
      outputs: { task: { type: 'task', path: '', data: { taskId } } }
    };
  } catch (error: any) {
    if (error?.message?.includes('429')) {
      return { success: false, error: 'Rate limit. Wait 3 min.', rateLimitWait: 180 };
    }
    return { success: false, error: error?.message || 'Failed' };
  }
}

export async function image_to_video(params: { prompt: string; imageUrl: string; size?: string; duration?: 5 | 10 }): Promise<ToolResult> {
  const { prompt, imageUrl, size = '768x1344', duration = 5 } = params;

  try {
    let imageDataUrl = imageUrl;
    if (!imageUrl.startsWith('data:') && !imageUrl.startsWith('http')) {
      const localPath = imageUrl.startsWith('/api/files/') 
        ? path.join(FOLDERS.OUTPUT, path.basename(imageUrl))
        : imageUrl;
      const imageBuffer = await fs.readFile(localPath);
      const ext = path.extname(localPath).toLowerCase().substring(1) || 'jpeg';
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
      imageDataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
    }

    const zai = await ZAI.create();
    const task = await zai.video.generations.create({
      prompt: prompt.trim(),
      image_url: imageDataUrl,
      size,
      duration,
      quality: 'speed',
      fps: 30,
    });

    const taskId = task.id;
    if (!taskId) return { success: false, error: 'No task ID' };

    return {
      success: true,
      data: { taskId, status: 'PROCESSING' },
      outputs: { task: { type: 'task', path: '', data: { taskId } } }
    };
  } catch (error: any) {
    if (error?.message?.includes('429')) {
      return { success: false, error: 'Rate limit. Wait 3 min.', rateLimitWait: 180 };
    }
    return { success: false, error: error?.message || 'Failed' };
  }
}

export async function check_generation_status(params: { taskId: string }): Promise<ToolResult> {
  try {
    const zai = await ZAI.create();
    const result = await zai.async.result.query(params.taskId);
    const status = result.task_status || (result as any).status;

    if (status === 'SUCCESS') {
      const videoUrl = (result as any).video_result?.[0]?.url || (result as any).video_url;
      if (videoUrl) {
        const vidRes = await fetch(videoUrl);
        if (!vidRes.ok) return { success: false, error: `Download failed: ${vidRes.status}` };
        
        const arrayBuffer = await vidRes.arrayBuffer();
        await ensureFolders();
        const filename = `ai_video_${uuidv4()}.mp4`;
        const outputPath = path.join(FOLDERS.OUTPUT, filename);
        await fs.writeFile(outputPath, Buffer.from(arrayBuffer));

        return {
          success: true,
          data: { status: 'SUCCESS' },
          outputs: { video: { type: 'video', path: outputPath, url: `/api/files/output/${filename}` } }
        };
      }
    }

    if (status === 'FAIL') return { success: false, error: 'Video generation failed' };
    return { success: true, data: { status: status || 'PROCESSING', progress: 50 } };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed' };
  }
}

export async function text_to_speech(params: { text: string; voiceId: string; speed?: number }): Promise<ToolResult> {
  const { text, voiceId, speed = 1.0 } = params;
  const token = process.env.Z_AUDIO_TOKEN;
  const userId = process.env.Z_AUDIO_USER_ID;
  const apiBase = process.env.Z_AUDIO_API_BASE || 'https://audio.z.ai/api';

  if (!token || !userId) {
    return { success: false, error: 'Z_AUDIO_TOKEN or Z_AUDIO_USER_ID not configured' };
  }

  try {
    const response = await fetch(`${apiBase}/v1/z-audio/tts/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({ voice_id: voiceId, voice_name: 'Unknown', user_id: userId, input_text: text, speed, volume: 1 })
    });

    if (!response.ok) return { success: false, error: `TTS API Error: ${response.status}` };

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
              if (firstChunk) { chunks.push(chunkBuffer); firstChunk = false; }
              else if (chunkBuffer.length > 44) { chunks.push(chunkBuffer.subarray(44)); }
            }
          } catch {}
        }
      }
    }

    if (chunks.length === 0) return { success: false, error: 'No audio data received' };

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
      outputs: { audio: { type: 'audio', path: outputPath, url: `/api/files/output/${filename}` } }
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed' };
  }
}

// Grok Tools (Fallback)
const grokTasks = new Map<string, any>();
let grokDailyCount = 0;
let grokDailyReset = Date.now() + 86400000;
const GROK_DAILY_LIMIT = 4;

function checkGrokQuota() {
  const now = Date.now();
  if (now > grokDailyReset) { grokDailyCount = 0; grokDailyReset = now + 86400000; }
  return { allowed: grokDailyCount < GROK_DAILY_LIMIT, remaining: GROK_DAILY_LIMIT - grokDailyCount };
}

export async function text_to_image_grok(params: { prompt: string; aspectRatio?: string }): Promise<ToolResult> {
  const quota = checkGrokQuota();
  if (!quota.allowed) return { success: false, error: 'Grok daily limit reached', rateLimitWait: 86400 };

  const taskId = uuidv4();
  grokTasks.set(taskId, { id: taskId, prompt: params.prompt, mode: 'textToImage', status: 'pending' });
  grokDailyCount++;

  return { success: true, data: { taskId, status: 'pending', remainingQuota: quota.remaining - 1 } };
}

export async function text_to_video_grok(params: { prompt: string; aspectRatio?: string }): Promise<ToolResult> {
  const quota = checkGrokQuota();
  if (!quota.allowed) return { success: false, error: 'Grok daily limit reached', rateLimitWait: 86400 };

  const taskId = uuidv4();
  grokTasks.set(taskId, { id: taskId, prompt: params.prompt, mode: 'textToVideo', status: 'pending' });
  grokDailyCount++;

  return { success: true, data: { taskId, status: 'pending', remainingQuota: quota.remaining - 1 } };
}

export async function image_to_video_grok(params: { prompt: string; imageUrl: string }): Promise<ToolResult> {
  const quota = checkGrokQuota();
  if (!quota.allowed) return { success: false, error: 'Grok daily limit reached', rateLimitWait: 86400 };

  const taskId = uuidv4();
  grokTasks.set(taskId, { id: taskId, prompt: params.prompt, mode: 'imageToVideo', status: 'pending' });
  grokDailyCount++;

  return { success: true, data: { taskId, status: 'pending', remainingQuota: quota.remaining - 1 } };
}

// YouTube Tools
export async function download_youtube(params: { url: string; separateAudio?: boolean }): Promise<ToolResult> {
  const ytDlpCheck = await checkYtDlp();
  if (!ytDlpCheck.installed) return { success: false, error: ytDlpCheck.error };

  try {
    await ensureFolders();
    const { stdout: infoJson } = await execAsync(`yt-dlp --dump-json "${params.url}"`);
    const info = JSON.parse(infoJson);
    const safeTitle = info.title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50) || `yt_${uuidv4()}`;
    const filename = `${safeTitle}.mp4`;
    const outputPath = path.join(FOLDERS.OUTPUT, filename);

    await execAsync(`yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best" --merge-output-format mp4 -o "${outputPath}" "${params.url}"`, { maxBuffer: 1024 * 1024 * 100 });

    return {
      success: true,
      data: { title: info.title, duration: info.duration },
      outputs: { video: { type: 'video', path: outputPath, url: `/api/files/output/${filename}` } }
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed' };
  }
}

export async function get_youtube_transcript(params: { videoId: string; languages?: string[] }): Promise<ToolResult> {
  try {
    const languages = params.languages || ['en'];
    const { stdout } = await execAsync(`python3 scripts/fetch_transcript.py ${params.videoId} "${languages.join(',')}"`);
    const result = JSON.parse(stdout.trim());
    if (!result.success) return { success: false, error: result.error };
    return { success: true, data: result.data };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed' };
  }
}

// Video Editing Tools
export async function trim_clip(params: { videoPath: string; start: number; end: number }): Promise<ToolResult> {
  const ffmpegCheck = await checkFfmpeg();
  if (!ffmpegCheck.installed) return { success: false, error: ffmpegCheck.error };

  try {
    await ensureFolders();
    const inputPath = params.videoPath.startsWith('/api/files/')
      ? path.join(FOLDERS.OUTPUT, path.basename(params.videoPath))
      : params.videoPath;
    const filename = `clip_${uuidv4()}.mp4`;
    const outputPath = path.join(FOLDERS.OUTPUT, filename);

    await execAsync(`ffmpeg -i "${inputPath}" -ss ${params.start} -to ${params.end} -c copy "${outputPath}" -y`, { maxBuffer: 1024 * 1024 * 100 });

    return {
      success: true,
      outputs: { video: { type: 'video', path: outputPath, url: `/api/files/output/${filename}` } }
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed' };
  }
}

export async function reframe(params: { videoPath: string; targetRatio: string }): Promise<ToolResult> {
  const ffmpegCheck = await checkFfmpeg();
  if (!ffmpegCheck.installed) return { success: false, error: ffmpegCheck.error };

  const resolutions: Record<string, string> = {
    '9:16': '1080:1920', '16:9': '1920:1080', '1:1': '1080:1080', '4:5': '1080:1350'
  };

  try {
    await ensureFolders();
    const inputPath = params.videoPath.startsWith('/api/files/')
      ? path.join(FOLDERS.OUTPUT, path.basename(params.videoPath))
      : params.videoPath;
    const filename = `reframed_${uuidv4()}.mp4`;
    const outputPath = path.join(FOLDERS.OUTPUT, filename);
    const [width, height] = resolutions[params.targetRatio]?.split(':') || ['1920', '1080'];

    await execAsync(`ffmpeg -i "${inputPath}" -vf "scale=-2:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1" -c:v libx264 -preset fast -c:a copy "${outputPath}" -y`, { maxBuffer: 1024 * 1024 * 100 });

    return {
      success: true,
      outputs: { video: { type: 'video', path: outputPath, url: `/api/files/output/${filename}` } }
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed' };
  }
}

export async function add_captions(params: { videoPath: string; transcript: Array<{ text: string; start: number; duration: number }>; style?: string }): Promise<ToolResult> {
  const ffmpegCheck = await checkFfmpeg();
  if (!ffmpegCheck.installed) return { success: false, error: ffmpegCheck.error };

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

    await execAsync(`ffmpeg -i "${inputPath}" -vf "subtitles='${srtPath}':force_style='Fontname=Arial,Fontsize=24,PrimaryColour=&H00FFFFFF,Outline=2'" -c:v libx264 -preset fast -c:a copy "${outputPath}" -y`, { maxBuffer: 1024 * 1024 * 100 });

    await fs.unlink(srtPath).catch(() => {});

    return {
      success: true,
      outputs: { video: { type: 'video', path: outputPath, url: `/api/files/output/${filename}` } }
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed' };
  }
}

// Manim
export async function generate_animation(params: { script: string; quality?: 'l' | 'm' | 'h' }): Promise<ToolResult> {
  const manimCheck = await checkManim();
  if (!manimCheck.installed) return { success: false, error: manimCheck.error };

  const qualityMap: Record<string, string> = { 'l': '-ql', 'm': '-qm', 'h': '-qh' };
  const qualityFlag = qualityMap[params.quality || 'm'] || '-qm';

  try {
    await ensureFolders();
    const scriptBaseName = `manim_${uuidv4().replace(/-/g, '_')}`;
    const workspaceDir = path.join(FOLDERS.TEMP, scriptBaseName);
    await fs.mkdir(workspaceDir, { recursive: true });

    const scriptPath = path.join(workspaceDir, 'scene.py');
    const constructBody = params.script.split('\n').map(line => `        ${line}`).join('\n');
    const pythonScript = `from manim import *\n\nclass GeneratedScene(Scene):\n    def construct(self):\n${constructBody || '        self.wait(1)'}\n`;
    await fs.writeFile(scriptPath, pythonScript);

    await execAsync(`"${manimCheck.bin || 'manim'}" ${qualityFlag} "${scriptPath}" GeneratedScene`, { cwd: workspaceDir, maxBuffer: 1024 * 1024 * 500, timeout: 600000 });

    const manimVideosDir = path.join(workspaceDir, 'media', 'videos', 'scene');
    let renderedFilePath: string | null = null;
    try {
      const qualityDirs = await fs.readdir(manimVideosDir);
      for (const qualDir of qualityDirs) {
        const candidate = path.join(manimVideosDir, qualDir, 'GeneratedScene.mp4');
        try { await fs.stat(candidate); renderedFilePath = candidate; break; } catch {}
      }
    } catch {}

    if (!renderedFilePath) return { success: false, error: 'Output not found' };

    const filename = `manim_${uuidv4()}.mp4`;
    const outputPath = path.join(FOLDERS.OUTPUT, filename);
    await fs.copyFile(renderedFilePath, outputPath);

    await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => {});

    return {
      success: true,
      outputs: { video: { type: 'video', path: outputPath, url: `/api/files/output/${filename}` } }
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed' };
  }
}

function formatSRTTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

// Initialize
ensureFolders();
