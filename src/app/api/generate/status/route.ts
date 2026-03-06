/**
 * Video Generation Status API
 * 
 * POST /api/generate/status
 * Check the status of a video generation task
 * 
 * Polls the AI service for video generation progress and returns:
 * - Current status (PROCESSING, SUCCESS, FAIL)
 * - Video URL or base64 when complete
 * - Progress percentage
 */

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as fsSync from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Folders
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

// Read z-ai config for direct API access
function getZaiConfig() {
  try {
    const configPath = path.join(process.cwd(), '.z-ai-config');
    const configData = fsSync.readFileSync(configPath, 'utf-8');
    return JSON.parse(configData);
  } catch {
    return null;
  }
}

/**
 * POST /api/generate/status
 * Check video generation status
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId } = body;

    // Validate taskId
    if (!taskId || typeof taskId !== 'string' || !taskId.trim()) {
      return NextResponse.json(
        { success: false, error: 'taskId is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    console.log(`[Status API] Checking status for task: ${taskId}`);

    // Try using z-ai config for direct polling (more reliable)
    const zaiConfig = getZaiConfig();
    
    if (zaiConfig?.baseUrl) {
      // Direct API polling
      const pollUrl = `${zaiConfig.baseUrl}/video/generations/${taskId.trim()}`;
      console.log(`[Status API] Direct polling: ${pollUrl}`);
      
      const pollRes = await fetch(pollUrl, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${zaiConfig.apiKey || 'Z.ai'}`,
          'Content-Type': 'application/json',
        },
      });

      if (!pollRes.ok) {
        const errorText = await pollRes.text();
        console.error(`[Status API] Polling failed: ${pollRes.status} - ${errorText}`);
        return NextResponse.json(
          { 
            success: false, 
            error: `Status check failed: ${pollRes.status}`,
            taskId: taskId,
            status: 'UNKNOWN',
          },
          { status: 500 }
        );
      }

      const result = await pollRes.json();
      console.log(`[Status API] Response:`, JSON.stringify(result).substring(0, 300));

      const status = result.task_status || result.status || 'PROCESSING';
      const videoUrl = result.video_url || result.output?.video_url || result.data?.video_url;
      const base64Video = result.base64 || result.output?.base64 || result.data?.base64;

      // If SUCCESS and has video URL, download and save
      if (status === 'SUCCESS' && videoUrl) {
        await ensureFolders();
        const filename = `video_${uuidv4()}.mp4`;
        const outputPath = path.join(FOLDERS.OUTPUT, filename);

        try {
          const videoRes = await fetch(videoUrl);
          if (videoRes.ok) {
            const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
            await fs.writeFile(outputPath, videoBuffer);
            console.log(`[Status API] Video saved: ${filename} (${Math.round(videoBuffer.length / 1024)} KB)`);

            return NextResponse.json({
              success: true,
              taskId: taskId,
              status: 'SUCCESS',
              progress: 100,
              videoUrl: videoUrl,
              localUrl: `/api/files/output/${filename}`,
              filename: filename,
              path: outputPath,
              size: videoBuffer.length,
            });
          }
        } catch (downloadErr) {
          console.error('[Status API] Failed to download video:', downloadErr);
        }
      }

      // If SUCCESS and has base64
      if (status === 'SUCCESS' && base64Video) {
        await ensureFolders();
        const filename = `video_${uuidv4()}.mp4`;
        const outputPath = path.join(FOLDERS.OUTPUT, filename);

        const videoBuffer = Buffer.from(base64Video, 'base64');
        await fs.writeFile(outputPath, videoBuffer);
        console.log(`[Status API] Video saved from base64: ${filename} (${Math.round(videoBuffer.length / 1024)} KB)`);

        return NextResponse.json({
          success: true,
          taskId: taskId,
          status: 'SUCCESS',
          progress: 100,
          base64: base64Video,
          localUrl: `/api/files/output/${filename}`,
          filename: filename,
          path: outputPath,
          size: videoBuffer.length,
        });
      }

      // Return current status
      return NextResponse.json({
        success: true,
        taskId: taskId,
        status: status,
        progress: result.progress || (status === 'SUCCESS' ? 100 : status === 'FAIL' ? 0 : 50),
        videoUrl: videoUrl,
        base64: base64Video,
      });
    }

    // Fallback: Use SDK
    const zai = await ZAI.create();
    const result = await zai.async.result.query(taskId.trim());

    const status = result.task_status || (result as any).status || 'PROCESSING';
    const videoUrl = (result as any).video_url || (result as any).output?.video_url;
    const base64Video = (result as any).base64 || (result as any).output?.base64;

    console.log(`[Status API] SDK Result status: ${status}`);

    // Handle SUCCESS with video URL
    if (status === 'SUCCESS' && videoUrl) {
      await ensureFolders();
      const filename = `video_${uuidv4()}.mp4`;
      const outputPath = path.join(FOLDERS.OUTPUT, filename);

      try {
        const videoRes = await fetch(videoUrl);
        if (videoRes.ok) {
          const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
          await fs.writeFile(outputPath, videoBuffer);
          console.log(`[Status API] Video saved: ${filename}`);

          return NextResponse.json({
            success: true,
            taskId: taskId,
            status: 'SUCCESS',
            progress: 100,
            videoUrl: videoUrl,
            localUrl: `/api/files/output/${filename}`,
            filename: filename,
            path: outputPath,
            size: videoBuffer.length,
          });
        }
      } catch (downloadErr) {
        console.error('[Status API] Download failed:', downloadErr);
      }
    }

    // Handle SUCCESS with base64
    if (status === 'SUCCESS' && base64Video) {
      await ensureFolders();
      const filename = `video_${uuidv4()}.mp4`;
      const outputPath = path.join(FOLDERS.OUTPUT, filename);

      const videoBuffer = Buffer.from(base64Video, 'base64');
      await fs.writeFile(outputPath, videoBuffer);

      return NextResponse.json({
        success: true,
        taskId: taskId,
        status: 'SUCCESS',
        progress: 100,
        base64: base64Video,
        localUrl: `/api/files/output/${filename}`,
        filename: filename,
        path: outputPath,
        size: videoBuffer.length,
      });
    }

    return NextResponse.json({
      success: true,
      taskId: taskId,
      status: status,
      progress: status === 'SUCCESS' ? 100 : status === 'FAIL' ? 0 : 50,
    });

  } catch (error: unknown) {
    console.error('[Status API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Status check failed';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/generate/status
 * Returns API documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/generate/status',
    method: 'POST',
    description: 'Check the status of a video generation task',
    parameters: {
      taskId: {
        type: 'string',
        required: true,
        description: 'The task ID returned from /api/generate/video',
      },
    },
    response: {
      success: 'boolean',
      taskId: 'string',
      status: 'string - PROCESSING, SUCCESS, or FAIL',
      progress: 'number - 0 to 100',
      videoUrl: 'string (optional) - Remote video URL when complete',
      localUrl: 'string (optional) - Local URL to access the video',
      filename: 'string (optional) - Saved filename',
      path: 'string (optional) - Local file path',
      size: 'number (optional) - File size in bytes',
    },
    statusValues: {
      PROCESSING: 'Video is being generated',
      SUCCESS: 'Video is ready',
      FAIL: 'Video generation failed',
    },
    example: {
      request: {
        taskId: 'task_abc123',
      },
      response_processing: {
        success: true,
        taskId: 'task_abc123',
        status: 'PROCESSING',
        progress: 50,
      },
      response_success: {
        success: true,
        taskId: 'task_abc123',
        status: 'SUCCESS',
        progress: 100,
        localUrl: '/api/files/output/video_xxx.mp4',
        filename: 'video_xxx.mp4',
      },
    },
    polling: {
      recommendation: 'Poll every 5-10 seconds until status is SUCCESS or FAIL',
      maxAttempts: 'Consider a timeout of 5-10 minutes for video generation',
    },
  });
}
