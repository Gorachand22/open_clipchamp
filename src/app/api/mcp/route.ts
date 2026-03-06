/**
 * MCP (Model Context Protocol) Server Endpoint - JSON-RPC 2.0
 *
 * Implements the MCP wire protocol so OpenCode can connect via:
 *   "mcp": { "video-editor": { "type": "remote", "url": "http://localhost:3000/api/mcp" } }
 *
 * Protocol: Streamable HTTP (POST JSON-RPC 2.0 messages)
 * Spec: https://spec.modelcontextprotocol.io
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureFolders, checkAllDependencies } from '@/lib/mcp-tools';
import { editorControlTools } from '@/lib/editor-control';

import {
  text_to_image,
  text_to_video,
  image_to_video,
  check_generation_status,
  text_to_speech,
  list_voices,
  text_to_image_grok,
  text_to_video_grok,
  image_to_video_grok,
  download_youtube,
  get_youtube_transcript,
  trim_clip,
  reframe,
  add_captions,
  generate_animation,
  render_remotion,
  VALID_SIZES,
  SIZE_TO_ASPECT_RATIO,
  type ToolResult,
} from '@/lib/mcp-tools';

// ============================================================
// MCP TOOL DEFINITIONS (inputSchema = JSON Schema)
// ============================================================
const MCP_TOOLS = [
  // --- Editor Control ---
  { name: 'get_editor_state', description: 'Get current editor state (timeline, clips, tracks, playhead position).', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'set_playhead', description: 'Move playhead to a specific time in seconds.', inputSchema: { type: 'object', properties: { time: { type: 'number' } }, required: ['time'] } },
  { name: 'start_playback', description: 'Start video playback.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'pause_playback', description: 'Pause video playback.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'set_aspect_ratio', description: 'Set project aspect ratio.', inputSchema: { type: 'object', properties: { ratio: { type: 'string', enum: ['16:9', '9:16', '1:1', '4:5', '21:9'] } }, required: ['ratio'] } },
  { name: 'add_track', description: 'Add a new track to the timeline.', inputSchema: { type: 'object', properties: { trackType: { type: 'string', enum: ['video', 'audio', 'overlay'] } }, required: ['trackType'] } },
  { name: 'add_clip', description: 'Add a clip to the timeline.', inputSchema: { type: 'object', properties: { trackId: { type: 'string' }, mediaId: { type: 'string' }, mediaName: { type: 'string' }, mediaType: { type: 'string', enum: ['video', 'audio', 'image'] }, startTime: { type: 'number' }, duration: { type: 'number' }, src: { type: 'string' }, thumbnail: { type: 'string' } }, required: ['mediaId', 'mediaName', 'mediaType', 'duration'] } },
  { name: 'remove_clip', description: 'Remove a clip from the timeline.', inputSchema: { type: 'object', properties: { clipId: { type: 'string' } }, required: ['clipId'] } },
  { name: 'move_clip', description: 'Move a clip to a new timeline position.', inputSchema: { type: 'object', properties: { clipId: { type: 'string' }, startTime: { type: 'number' }, targetTrackId: { type: 'string' } }, required: ['clipId', 'startTime'] } },
  { name: 'set_clip_speed', description: 'Change clip playback speed.', inputSchema: { type: 'object', properties: { clipId: { type: 'string' }, speed: { type: 'number' } }, required: ['clipId', 'speed'] } },
  { name: 'set_clip_volume', description: 'Set clip volume (0-1).', inputSchema: { type: 'object', properties: { clipId: { type: 'string' }, volume: { type: 'number' } }, required: ['clipId', 'volume'] } },
  { name: 'set_clip_fade', description: 'Set fade in/out on clip.', inputSchema: { type: 'object', properties: { clipId: { type: 'string' }, fadeIn: { type: 'number' }, fadeOut: { type: 'number' } }, required: ['clipId'] } },
  { name: 'set_clip_filter', description: 'Apply visual filter to clip.', inputSchema: { type: 'object', properties: { clipId: { type: 'string' }, filter: { type: 'string' } }, required: ['clipId', 'filter'] } },
  { name: 'set_clip_color_grade', description: 'Apply color grading to clip.', inputSchema: { type: 'object', properties: { clipId: { type: 'string' }, settings: { type: 'object' } }, required: ['clipId', 'settings'] } },
  { name: 'set_clip_animation', description: 'Set entrance/exit animation on clip.', inputSchema: { type: 'object', properties: { clipId: { type: 'string' }, entrance: { type: 'string' }, exit: { type: 'string' } }, required: ['clipId'] } },
  { name: 'split_clip', description: 'Split the selected clip at the current playhead position.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'delete_selected_clip', description: 'Delete the currently selected clip.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'select_clip', description: 'Select a clip by ID.', inputSchema: { type: 'object', properties: { clipId: { type: 'string' } }, required: [] } },
  { name: 'add_marker', description: 'Add a timeline marker.', inputSchema: { type: 'object', properties: { time: { type: 'number' }, label: { type: 'string' }, color: { type: 'string' } }, required: ['time', 'label'] } },
  { name: 'add_caption', description: 'Add a caption overlay at a specific time.', inputSchema: { type: 'object', properties: { startTime: { type: 'number' }, endTime: { type: 'number' }, text: { type: 'string' } }, required: ['startTime', 'endTime', 'text'] } },
  { name: 'import_media', description: 'Import a media file into the editor.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string' }, src: { type: 'string' }, duration: { type: 'number' }, thumbnail: { type: 'string' } }, required: ['name', 'type', 'src', 'duration'] } },
  { name: 'add_generated_content', description: 'Add AI-generated content (image/video/audio) to the timeline.', inputSchema: { type: 'object', properties: { type: { type: 'string', enum: ['video', 'audio', 'image'] }, name: { type: 'string' }, src: { type: 'string' }, thumbnail: { type: 'string' }, duration: { type: 'number' }, startTime: { type: 'number' } }, required: ['type', 'name', 'src', 'duration'] } },
  { name: 'undo_action', description: 'Undo the last editor action.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'redo_action', description: 'Redo the last undone action.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'clear_timeline', description: 'Clear all clips from the timeline.', inputSchema: { type: 'object', properties: {}, required: [] } },

  // --- AI Generation ---
  { name: 'text_to_image', description: 'Generate image from text prompt. Returns image URL. Sizes: 1024x1024 (1:1), 768x1344 (9:16 Shorts), 1344x768 (16:9 YouTube).', inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, size: { type: 'string', enum: ['1024x1024', '768x1344', '1344x768', '864x1152', '720x1440', '1152x864', '1440x720'], default: '1024x1024' } }, required: ['prompt'] } },
  { name: 'text_to_video', description: 'Generate video from text prompt. Returns taskId. Poll check_generation_status every 5-10s for result.', inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, size: { type: 'string', enum: ['768x1344', '1344x768', '1024x1024'], default: '768x1344' }, duration: { type: 'number', enum: [5, 10], default: 5 }, quality: { type: 'string', enum: ['speed', 'quality'], default: 'speed' } }, required: ['prompt'] } },
  { name: 'image_to_video', description: 'Animate an image into a video. Provide imageUrl and animation prompt.', inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, imageUrl: { type: 'string' }, size: { type: 'string', enum: ['768x1344', '1344x768', '1024x1024'], default: '768x1344' }, duration: { type: 'number', enum: [5, 10], default: 5 }, quality: { type: 'string', enum: ['speed', 'quality'], default: 'speed' } }, required: ['prompt', 'imageUrl'] } },
  { name: 'check_generation_status', description: 'Poll status of a video generation task. Returns status (PROCESSING/SUCCESS/FAIL) and video URL when done.', inputSchema: { type: 'object', properties: { taskId: { type: 'string' } }, required: ['taskId'] } },
  { name: 'text_to_speech', description: 'Convert text to speech audio. Use list_voices first to get voice IDs.', inputSchema: { type: 'object', properties: { text: { type: 'string' }, voiceId: { type: 'string' }, speed: { type: 'number', default: 1.0 } }, required: ['text', 'voiceId'] } },
  { name: 'list_voices', description: 'List available TTS voices (system and cloned). Call before text_to_speech.', inputSchema: { type: 'object', properties: {}, required: [] } },

  // --- Grok Fallback ---
  { name: 'text_to_image_grok', description: 'Generate image using Grok. LIMIT: ~4/day. Use as fallback.', inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, aspectRatio: { type: 'string', default: '16:9' } }, required: ['prompt'] } },
  { name: 'text_to_video_grok', description: 'Generate video using Grok. LIMIT: ~4/day. Use as fallback.', inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, aspectRatio: { type: 'string', default: '16:9' } }, required: ['prompt'] } },

  // --- YouTube ---
  { name: 'download_youtube', description: 'Download YouTube video. Returns video path, metadata, transcript.', inputSchema: { type: 'object', properties: { url: { type: 'string' }, format: { type: 'string', enum: ['video', 'audio', 'both'], default: 'both' }, quality: { type: 'string', enum: ['best', 'medium', 'low'], default: 'best' } }, required: ['url'] } },
  { name: 'get_youtube_transcript', description: 'Get timestamped transcript/subtitles for a YouTube video.', inputSchema: { type: 'object', properties: { videoId: { type: 'string' }, languages: { type: 'array', items: { type: 'string' }, default: ['en', 'hi'] } }, required: ['videoId'] } },

  // --- Video Editing ---
  { name: 'trim_clip', description: 'Trim video to start/end time using ffmpeg.', inputSchema: { type: 'object', properties: { videoPath: { type: 'string' }, start: { type: 'number' }, end: { type: 'number' } }, required: ['videoPath', 'start', 'end'] } },
  { name: 'reframe', description: 'Convert video aspect ratio (e.g. 16:9 to 9:16 for TikTok).', inputSchema: { type: 'object', properties: { videoPath: { type: 'string' }, targetRatio: { type: 'string', enum: ['9:16', '16:9', '1:1', '4:5'] } }, required: ['videoPath', 'targetRatio'] } },
  { name: 'add_captions', description: 'Burn subtitles/captions into video using transcript data.', inputSchema: { type: 'object', properties: { videoPath: { type: 'string' }, transcript: { type: 'array', items: { type: 'object' } } }, required: ['videoPath', 'transcript'] } },

  // --- Manim ---
  { name: 'generate_animation', description: 'Create math/technical animation using Manim Python. Returns rendered MP4.', inputSchema: { type: 'object', properties: { script: { type: 'string', description: 'Manim construct() method body' }, quality: { type: 'string', enum: ['l', 'm', 'h'], default: 'm' } }, required: ['script'] } },

  // --- Remotion ---
  { name: 'render_remotion', description: 'Render React-based video using Remotion.', inputSchema: { type: 'object', properties: { compositionId: { type: 'string' }, inputProps: { type: 'object' }, codec: { type: 'string', enum: ['h264', 'h265', 'vp8', 'vp9'], default: 'h264' }, fps: { type: 'number', default: 30 }, durationInFrames: { type: 'number' } }, required: ['compositionId'] } },
];

ensureFolders();

// ============================================================
// MCP JSON-RPC 2.0 HANDLER
// ============================================================

function mcpResponse(id: string | number | null, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, result });
}

function mcpError(id: string | number | null, code: number, message: string) {
  return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } });
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    // Editor Control
    case 'get_editor_state': return editorControlTools.get_editor_state();
    case 'set_playhead': return editorControlTools.set_playhead(args as any);
    case 'start_playback': return editorControlTools.start_playback();
    case 'pause_playback': return editorControlTools.pause_playback();
    case 'set_aspect_ratio': return editorControlTools.set_aspect_ratio(args as any);
    case 'add_track': return editorControlTools.add_track(args as any);
    case 'add_clip': return editorControlTools.add_clip(args as any);
    case 'remove_clip': return editorControlTools.remove_clip(args as any);
    case 'move_clip': return editorControlTools.move_clip(args as any);
    case 'set_clip_speed': return editorControlTools.set_clip_speed(args as any);
    case 'set_clip_volume': return editorControlTools.set_clip_volume(args as any);
    case 'set_clip_fade': return editorControlTools.set_clip_fade(args as any);
    case 'set_clip_filter': return editorControlTools.set_clip_filter(args as any);
    case 'set_clip_color_grade': return editorControlTools.set_clip_color_grade(args as any);
    case 'set_clip_animation': return editorControlTools.set_clip_animation(args as any);
    case 'split_clip': return editorControlTools.split_clip();
    case 'delete_selected_clip': return editorControlTools.delete_selected_clip();
    case 'select_clip': return editorControlTools.select_clip(args as any);
    case 'add_marker': return editorControlTools.add_marker(args as any);
    case 'add_caption': return editorControlTools.add_caption(args as any);
    case 'import_media': return editorControlTools.import_media(args as any);
    case 'add_generated_content': return editorControlTools.add_generated_content(args as any);
    case 'undo_action': return editorControlTools.undo_action();
    case 'redo_action': return editorControlTools.redo_action();
    case 'clear_timeline': return editorControlTools.clear_timeline();

    // AI Generation
    case 'text_to_image': return text_to_image(args as any);
    case 'text_to_video': return text_to_video(args as any);
    case 'image_to_video': return image_to_video(args as any);
    case 'check_generation_status': return check_generation_status(args as any);
    case 'text_to_speech': return text_to_speech(args as any);
    case 'list_voices': return list_voices();
    case 'text_to_image_grok': return text_to_image_grok(args as any);
    case 'text_to_video_grok': return text_to_video_grok(args as any);
    case 'image_to_video_grok': return image_to_video_grok(args as any);

    // YouTube
    case 'download_youtube': return download_youtube(args as any);
    case 'get_youtube_transcript': return get_youtube_transcript(args as any);

    // Video Editing
    case 'trim_clip': return trim_clip(args as any);
    case 'reframe': return reframe(args as any);
    case 'add_captions': return add_captions(args as any);

    // Manim
    case 'generate_animation': return generate_animation(args as any);

    // Remotion
    case 'render_remotion': return render_remotion(args as any);

    default:
      throw { code: -32601, message: `Unknown tool: ${name}` };
  }
}

// ============================================================
// ROUTE HANDLERS
// ============================================================

/**
 * POST /api/mcp
 * Handles all MCP JSON-RPC 2.0 messages from OpenCode
 */
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return mcpError(null, -32700, 'Parse error');
  }

  const { jsonrpc, id, method, params } = body;

  if (jsonrpc !== '2.0') {
    return mcpError(id ?? null, -32600, 'Invalid Request: must be JSON-RPC 2.0');
  }

  try {
    switch (method) {
      // --- MCP Lifecycle ---
      case 'initialize':
        return mcpResponse(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'video-editor-pro', version: '3.0.0' },
        });

      case 'notifications/initialized':
        // No-op notification — just acknowledge
        return new NextResponse(null, { status: 204 });

      // --- Tool Discovery ---
      case 'tools/list':
        return mcpResponse(id, { tools: MCP_TOOLS });

      // --- Tool Execution ---
      case 'tools/call': {
        const toolName = params?.name;
        const toolArgs = params?.arguments ?? {};

        if (!toolName) {
          return mcpError(id, -32602, 'Missing tool name in params');
        }

        const result = await executeTool(toolName, toolArgs);

        // Format result as MCP content blocks
        const content = [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ];

        return mcpResponse(id, { content, isError: false });
      }

      // --- Ping (keep-alive) ---
      case 'ping':
        return mcpResponse(id, {});

      default:
        return mcpError(id, -32601, `Method not found: ${method}`);
    }
  } catch (error: any) {
    console.error('[MCP] Error handling method:', method, error);
    if (error?.code) {
      return mcpError(id, error.code, error.message);
    }
    return mcpError(id, -32603, error?.message || 'Internal error');
  }
}

/**
 * GET /api/mcp
 * Health check — returns server info (not part of MCP spec but useful for debugging)
 */
export async function GET() {
  const deps = await checkAllDependencies();
  return NextResponse.json({
    service: 'Video Editor Pro - MCP Server',
    version: '3.0.0',
    protocol: 'MCP JSON-RPC 2.0 (2024-11-05)',
    tools: MCP_TOOLS.length,
    dependencies: deps,
    status: 'ok',
  });
}

/**
 * OPTIONS /api/mcp
 * CORS preflight for cross-origin requests from OpenCode
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
