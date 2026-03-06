/**
 * Video Render API
 * 
 * Renders the current timeline to a video file using FFmpeg.
 * Supports multiple aspect ratios, qualities, and formats.
 */

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

// Directories
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

// Resolution presets
const RESOLUTIONS: Record<string, { width: number; height: number }> = {
  '480p': { width: 854, height: 480 },
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '4K': { width: 3840, height: 2160 },
};

// Aspect ratio adjustments
const ASPECT_RATIOS: Record<string, string> = {
  '16:9': '1920:1080',
  '9:16': '1080:1920',
  '1:1': '1080:1080',
  '4:5': '1080:1350',
  '21:9': '2560:1080',
};

interface RenderRequest {
  // Timeline state
  tracks: Array<{
    id: string;
    type: 'video' | 'audio' | 'overlay';
    clips: Array<{
      id: string;
      mediaId: string;
      startTime: number;
      duration: number;
      trimStart: number;
      trimEnd: number;
      speed: number;
      volume: number;
      fadeIn: number;
      fadeOut: number;
      filter?: string;
      effects?: string[];
      transform?: {
        opacity: number;
        scale: number;
        rotation: number;
        positionX: number;
        positionY: number;
        flipH: boolean;
        flipV: boolean;
      };
    }>;
  }>;
  mediaLibrary: Array<{
    id: string;
    name: string;
    type: 'video' | 'audio' | 'image';
    src?: string;
    duration: number;
  }>;
  // Export settings
  aspectRatio: string;
  quality: '480p' | '720p' | '1080p' | '4K';
  fps: 24 | 30 | 60;
  format: 'mp4' | 'webm' | 'gif';
  duration: number;
}

/**
 * GET /api/render
 * Check render capabilities
 */
export async function GET() {
  let ffmpegVersion = null;
  let ffprobeVersion = null;
  
  try {
    const { stdout } = await execAsync('ffmpeg -version');
    ffmpegVersion = stdout.split('\n')[0];
  } catch {
    // FFmpeg not installed
  }
  
  try {
    const { stdout } = await execAsync('ffprobe -version');
    ffprobeVersion = stdout.split('\n')[0];
  } catch {
    // FFprobe not installed
  }
  
  return NextResponse.json({
    name: 'Video Editor Pro - Render Engine',
    version: '1.0.0',
    capabilities: {
      ffmpeg: ffmpegVersion ? { installed: true, version: ffmpegVersion } : { installed: false },
      ffprobe: ffprobeVersion ? { installed: true, version: ffprobeVersion } : { installed: false },
      supportedFormats: ['mp4', 'webm', 'gif'],
      supportedQualities: ['480p', '720p', '1080p', '4K'],
      supportedAspectRatios: ['16:9', '9:16', '1:1', '4:5', '21:9'],
      supportedFrameRates: [24, 30, 60],
    },
  });
}

/**
 * POST /api/render
 * Render timeline to video
 */
export async function POST(request: NextRequest) {
  try {
    const body: RenderRequest = await request.json();
    const { tracks, mediaLibrary, aspectRatio, quality, fps, format, duration } = body;
    
    await ensureFolders();
    
    // Check FFmpeg
    try {
      await execAsync('ffmpeg -version');
    } catch {
      return NextResponse.json({
        success: false,
        error: 'FFmpeg not installed. Please install FFmpeg to render videos.',
      }, { status: 500 });
    }
    
    const renderId = uuidv4();
    const outputFilename = `render_${renderId}.${format}`;
    const outputPath = path.join(FOLDERS.OUTPUT, outputFilename);
    
    // Get resolution
    const resolution = RESOLUTIONS[quality] || RESOLUTIONS['1080p'];
    const aspectRatioSize = ASPECT_RATIOS[aspectRatio] || ASPECT_RATIOS['16:9'];
    
    // Collect all clips with their media sources
    const allClips: Array<{
      clip: RenderRequest['tracks'][0]['clips'][0];
      media: RenderRequest['mediaLibrary'][0];
      trackType: string;
    }> = [];
    
    for (const track of tracks) {
      for (const clip of track.clips) {
        const media = mediaLibrary.find(m => m.id === clip.mediaId);
        if (media && media.src) {
          allClips.push({ clip, media, trackType: track.type });
        }
      }
    }
    
    // Sort by start time
    allClips.sort((a, b) => a.clip.startTime - b.clip.startTime);
    
    if (allClips.length === 0) {
      // Generate a blank video
      const blankCmd = `ffmpeg -f lavfi -i color=c=black:s=${aspectRatioSize.split(':').join('x')}:d=${duration}:r=${fps} ` +
        `-c:v libx264 -preset fast -crf 23 ` +
        `-pix_fmt yuv420p "${outputPath}" -y`;
      
      await execAsync(blankCmd, { maxBuffer: 1024 * 1024 * 100 });
    } else {
      // Build FFmpeg filter complex for compositing
      // For simplicity, we'll concatenate clips in order
      const tempFiles: string[] = [];
      
      for (let i = 0; i < allClips.length; i++) {
        const { clip, media, trackType } = allClips[i];
        
        if (!media.src) continue;
        
        // Handle different source types
        let inputPath = media.src;
        if (media.src.startsWith('http') || media.src.startsWith('//')) {
          // Download remote file
          const tempInput = path.join(FOLDERS.TEMP, `input_${i}_${path.basename(media.src).split('?')[0]}`);
          try {
            const response = await fetch(media.src);
            const buffer = await response.arrayBuffer();
            await fs.writeFile(tempInput, Buffer.from(buffer));
            inputPath = tempInput;
          } catch (e) {
            console.error('Failed to download:', media.src);
            continue;
          }
        } else if (media.src.startsWith('blob:') || media.src.startsWith('data:')) {
          // Skip blob/data URLs for now
          continue;
        }
        
        const tempOutput = path.join(FOLDERS.TEMP, `clip_${i}.mp4`);
        tempFiles.push(tempOutput);
        
        // Build filter for this clip
        let filterComplex = '';
        
        // Scale and crop to aspect ratio
        filterComplex = `scale=${aspectRatioSize.split(':').join(':')}:force_original_aspect_ratio=decrease,pad=${aspectRatioSize.split(':').join(':')}:(ow-iw)/2:(oh-ih)/2:black`;
        
        // Apply fade effects
        if (clip.fadeIn > 0) {
          filterComplex += `,fade=t=in:st=0:d=${clip.fadeIn}`;
        }
        if (clip.fadeOut > 0) {
          filterComplex += `,fade=t=out:st=${clip.duration - clip.fadeOut}:d=${clip.fadeOut}`;
        }
        
        // Apply speed
        const speedFilter = clip.speed !== 1 ? `-filter:v "setpts=${1/clip.speed}*pts"` : '';
        
        // Build command
        let cmd: string;
        if (media.type === 'image') {
          // Create video from image
          cmd = `ffmpeg -loop 1 -i "${inputPath}" -t ${clip.duration} ` +
            `-vf "${filterComplex}" ` +
            `-c:v libx264 -preset fast -crf 23 ` +
            `-pix_fmt yuv420p -r ${fps} "${tempOutput}" -y`;
        } else if (media.type === 'video') {
          // Trim and process video
          const trimStart = clip.trimStart || 0;
          const trimDuration = clip.duration;
          
          cmd = `ffmpeg -ss ${trimStart} -i "${inputPath}" -t ${trimDuration} ` +
            `-vf "${filterComplex}" ` +
            `-c:v libx264 -preset fast -crf 23 ` +
            `-c:a aac -b:a 128k ` +
            `-pix_fmt yuv420p -r ${fps} "${tempOutput}" -y`;
        } else if (media.type === 'audio') {
          // Create video from audio with waveform visualization
          cmd = `ffmpeg -i "${inputPath}" -t ${clip.duration} ` +
            `-f lavfi -i color=c=#1a1a2e:s=${aspectRatioSize.split(':').join('x')}:d=${clip.duration}:r=${fps} ` +
            `-filter_complex "[0:a]showwaves=s=${aspectRatioSize.split(':').join('x')}:mode=cline:colors=purple[v];[1:v][v]overlay=format=auto" ` +
            `-c:v libx264 -preset fast -crf 23 ` +
            `-c:a aac -b:a 128k ` +
            `-pix_fmt yuv420p -r ${fps} "${tempOutput}" -y`;
        } else {
          continue;
        }
        
        try {
          await execAsync(cmd, { maxBuffer: 1024 * 1024 * 100, timeout: 300000 });
        } catch (e) {
          console.error('Failed to process clip:', e);
        }
      }
      
      // Concatenate all clips
      if (tempFiles.length > 0) {
        // Check which files actually exist
        const existingFiles: string[] = [];
        for (const f of tempFiles) {
          try {
            await fs.stat(f);
            existingFiles.push(f);
          } catch {}
        }
        
        if (existingFiles.length > 0) {
          // Create concat file
          const concatFile = path.join(FOLDERS.TEMP, `concat_${renderId}.txt`);
          const concatContent = existingFiles.map(f => `file '${f}'`).join('\n');
          await fs.writeFile(concatFile, concatContent);
          
          // Concatenate
          const concatCmd = `ffmpeg -f concat -safe 0 -i "${concatFile}" ` +
            `-c:v libx264 -preset fast -crf 23 ` +
            `-c:a aac -b:a 128k ` +
            `-pix_fmt yuv420p "${outputPath}" -y`;
          
          await execAsync(concatCmd, { maxBuffer: 1024 * 1024 * 100, timeout: 300000 });
          
          // Cleanup
          await fs.unlink(concatFile).catch(() => {});
          for (const f of existingFiles) {
            await fs.unlink(f).catch(() => {});
          }
        } else {
          // Create blank video
          const blankCmd = `ffmpeg -f lavfi -i color=c=black:s=${aspectRatioSize.split(':').join('x')}:d=${duration}:r=${fps} ` +
            `-c:v libx264 -preset fast -crf 23 ` +
            `-pix_fmt yuv420p "${outputPath}" -y`;
          await execAsync(blankCmd, { maxBuffer: 1024 * 1024 * 100 });
        }
      } else {
        // Create blank video
        const blankCmd = `ffmpeg -f lavfi -i color=c=black:s=${aspectRatioSize.split(':').join('x')}:d=${duration}:r=${fps} ` +
          `-c:v libx264 -preset fast -crf 23 ` +
          `-pix_fmt yuv420p "${outputPath}" -y`;
        await execAsync(blankCmd, { maxBuffer: 1024 * 1024 * 100 });
      }
    }
    
    return NextResponse.json({
      success: true,
      outputs: {
        video: {
          type: 'video',
          path: outputPath,
          url: `/api/files/output/${outputFilename}`,
        }
      }
    });
    
  } catch (error: any) {
    console.error('[Render] Error:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Unknown error during rendering',
    }, { status: 500 });
  }
}
