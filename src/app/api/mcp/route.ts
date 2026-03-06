/**
 * MCP (Model Context Protocol) Server Endpoint
 * 
 * Complete MCP tools for OpenCode IDE to control Video Editor Pro.
 * Includes: AI generation, YouTube, Video editing, Manim, Editor control, Remotion
 * 
 * RATE LIMITING:
 * - z-ai tools: Wait 3 minutes after 429 errors
 * - Grok tools: ~4 generations per day limit
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureFolders, checkAllDependencies } from '@/lib/mcp-tools';
import { editorControlTools } from '@/lib/editor-control';

// Import all tools
import {
  // Z-AI Generation
  text_to_image,
  text_to_video,
  image_to_video,
  check_generation_status,
  text_to_speech,
  // Grok Extension
  text_to_image_grok,
  text_to_video_grok,
  image_to_video_grok,
  // YouTube
  download_youtube,
  get_youtube_transcript,
  // Video Editing
  trim_clip,
  reframe,
  add_captions,
  // Manim
  generate_animation,
  type ToolResult,
} from '@/lib/mcp-tools';

// Tool definitions for MCP discovery
const TOOLS = [
  // ============================================================
  // EDITOR CONTROL TOOLS - Real-time IDE-to-Editor interaction
  // ============================================================
  {
    name: 'get_editor_state',
    description: 'Get current editor state snapshot including timeline, clips, tracks, playback position. Use this to see what the editor looks like.',
    category: 'editor',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'set_playhead',
    description: 'Move the playhead (current time indicator) to a specific time in seconds.',
    category: 'editor',
    parameters: {
      type: 'object',
      properties: { time: { type: 'number', description: 'Time in seconds' } },
      required: ['time']
    }
  },
  {
    name: 'start_playback',
    description: 'Start video playback from current position.',
    category: 'editor',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'pause_playback',
    description: 'Pause video playback.',
    category: 'editor',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'set_aspect_ratio',
    description: 'Change project aspect ratio (16:9, 9:16, 1:1, 4:5, 21:9) for different platforms.',
    category: 'editor',
    parameters: {
      type: 'object',
      properties: { ratio: { type: 'string', enum: ['16:9', '9:16', '1:1', '4:5', '21:9'] } },
      required: ['ratio']
    }
  },
  {
    name: 'add_track',
    description: 'Add a new track to the timeline (video, audio, or overlay).',
    category: 'editor',
    parameters: {
      type: 'object',
      properties: { trackType: { type: 'string', enum: ['video', 'audio', 'overlay'] } },
      required: ['trackType']
    }
  },
  {
    name: 'add_clip',
    description: 'Add a clip to the timeline. Can specify track or auto-select based on media type.',
    category: 'editor',
    parameters: {
      type: 'object',
      properties: {
        trackId: { type: 'string', description: 'Optional: target track ID' },
        mediaId: { type: 'string', description: 'Unique media identifier' },
        mediaName: { type: 'string', description: 'Display name' },
        mediaType: { type: 'string', enum: ['video', 'audio', 'image'] },
        startTime: { type: 'number', description: 'Start time in seconds (default: end of track)' },
        duration: { type: 'number', description: 'Clip duration in seconds' },
        src: { type: 'string', description: 'Media source URL' },
        thumbnail: { type: 'string', description: 'Thumbnail URL' }
      },
      required: ['mediaId', 'mediaName', 'mediaType', 'duration']
    }
  },
  {
    name: 'remove_clip',
    description: 'Remove a clip from the timeline.',
    category: 'editor',
    parameters: {
      type: 'object',
      properties: { clipId: { type: 'string' } },
      required: ['clipId']
    }
  },
  {
    name: 'move_clip',
    description: 'Move a clip to a new position on the timeline.',
    category: 'editor',
    parameters: {
      type: 'object',
      properties: {
        clipId: { type: 'string' },
        startTime: { type: 'number', description: 'New start time in seconds' },
        targetTrackId: { type: 'string', description: 'Optional: move to different track' }
      },
      required: ['clipId', 'startTime']
    }
  },
  {
    name: 'set_clip_speed',
    description: 'Change clip playback speed (0.5 = half speed, 2 = double speed).',
    category: 'editor',
    parameters: {
      type: 'object',
      properties: { clipId: { type: 'string' }, speed: { type: 'number', description: 'Speed multiplier (0.1-10)' } },
      required: ['clipId', 'speed']
    }
  },
  {
    name: 'add_generated_content',
    description: 'Add AI-generated content (image/video/audio) directly to the timeline.',
    category: 'editor',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['video', 'audio', 'image'] },
        name: { type: 'string' },
        src: { type: 'string', description: 'URL to generated content' },
        thumbnail: { type: 'string' },
        duration: { type: 'number' },
        startTime: { type: 'number' }
      },
      required: ['type', 'name', 'src', 'duration']
    }
  },
  {
    name: 'split_clip',
    description: 'Split the clip at the current playhead position.',
    category: 'editor',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'undo_action',
    description: 'Undo the last action.',
    category: 'editor',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'redo_action',
    description: 'Redo the last undone action.',
    category: 'editor',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'clear_timeline',
    description: 'Clear all clips from the timeline.',
    category: 'editor',
    parameters: { type: 'object', properties: {}, required: [] }
  },

  // ============================================================
  // Z-AI GENERATION TOOLS
  // ============================================================
  {
    name: 'text_to_image',
    description: 'Generate image from text prompt using z-ai. Returns image URL.',
    category: 'ai-generation',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Text description for image' },
        size: { type: 'string', default: '1024x1024', enum: ['1024x1024', '768x1344', '1344x768'] }
      },
      required: ['prompt']
    },
    rateLimitNote: 'Wait 3 minutes if 429 error'
  },
  {
    name: 'text_to_video',
    description: 'Generate video from text prompt. Returns task ID for polling.',
    category: 'ai-generation',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Text description for video' },
        size: { type: 'string', default: '768x1344' },
        duration: { type: 'number', default: 5, enum: [5, 10] },
        quality: { type: 'string', default: 'speed', enum: ['speed', 'quality'] }
      },
      required: ['prompt']
    },
    rateLimitNote: 'Wait 3 minutes if 429 error'
  },
  {
    name: 'image_to_video',
    description: 'Generate video from an image + prompt.',
    category: 'ai-generation',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Animation description' },
        imageUrl: { type: 'string', description: 'Image URL, base64, or file path' },
        duration: { type: 'number', default: 5 }
      },
      required: ['prompt', 'imageUrl']
    }
  },
  {
    name: 'check_generation_status',
    description: 'Check status of video generation task. Returns video URL when complete.',
    category: 'ai-generation',
    parameters: {
      type: 'object',
      properties: { taskId: { type: 'string' } },
      required: ['taskId']
    }
  },
  {
    name: 'text_to_speech',
    description: 'Convert text to speech audio.',
    category: 'ai-generation',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        voiceId: { type: 'string' },
        speed: { type: 'number', default: 1.0 }
      },
      required: ['text', 'voiceId']
    }
  },

  // ============================================================
  // GROK EXTENSION TOOLS (fallback, ~4/day limit)
  // ============================================================
  {
    name: 'text_to_image_grok',
    description: 'Generate image using Grok extension. LIMIT: ~4/day',
    category: 'grok',
    parameters: {
      type: 'object',
      properties: { prompt: { type: 'string' }, aspectRatio: { type: 'string', default: '16:9' } },
      required: ['prompt']
    }
  },
  {
    name: 'text_to_video_grok',
    description: 'Generate video using Grok extension. LIMIT: ~4/day',
    category: 'grok',
    parameters: {
      type: 'object',
      properties: { prompt: { type: 'string' }, aspectRatio: { type: 'string', default: '16:9' } },
      required: ['prompt']
    }
  },

  // ============================================================
  // YOUTUBE TOOLS
  // ============================================================
  {
    name: 'download_youtube',
    description: 'Download YouTube video with metadata and transcript.',
    category: 'youtube',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'YouTube video URL' },
        separateAudio: { type: 'boolean', default: true }
      },
      required: ['url']
    }
  },
  {
    name: 'get_youtube_transcript',
    description: 'Fetch transcript/subtitles for a YouTube video.',
    category: 'youtube',
    parameters: {
      type: 'object',
      properties: { videoId: { type: 'string', description: 'YouTube video ID (11 chars)' } },
      required: ['videoId']
    }
  },

  // ============================================================
  // VIDEO EDITING TOOLS (ffmpeg-based)
  // ============================================================
  {
    name: 'trim_clip',
    description: 'Trim video from start to end time.',
    category: 'video-editing',
    parameters: {
      type: 'object',
      properties: {
        videoPath: { type: 'string' },
        start: { type: 'number', description: 'Start time in seconds' },
        end: { type: 'number', description: 'End time in seconds' }
      },
      required: ['videoPath', 'start', 'end']
    }
  },
  {
    name: 'reframe',
    description: 'Convert video aspect ratio (e.g., 16:9 to 9:16 for TikTok).',
    category: 'video-editing',
    parameters: {
      type: 'object',
      properties: {
        videoPath: { type: 'string' },
        targetRatio: { type: 'string', enum: ['9:16', '16:9', '1:1', '4:5'] }
      },
      required: ['videoPath', 'targetRatio']
    }
  },
  {
    name: 'add_captions',
    description: 'Burn subtitles into video.',
    category: 'video-editing',
    parameters: {
      type: 'object',
      properties: {
        videoPath: { type: 'string' },
        transcript: { type: 'array', description: 'Array of {text, start, duration}' }
      },
      required: ['videoPath', 'transcript']
    }
  },

  // ============================================================
  // MANIM TOOL
  // ============================================================
  {
    name: 'generate_animation',
    description: 'Create math/technical animation using Manim (Python).',
    category: 'manim',
    parameters: {
      type: 'object',
      properties: {
        script: { type: 'string', description: 'Manim Python code (construct method body)' },
        quality: { type: 'string', default: 'm', enum: ['l', 'm', 'h'] }
      },
      required: ['script']
    }
  },

  // ============================================================
  // RENDER TOOL
  // ============================================================
  {
    name: 'render_video',
    description: 'Render the current timeline to a video file. Use this to export the project.',
    category: 'render',
    parameters: {
      type: 'object',
      properties: {
        aspectRatio: { type: 'string', default: '16:9', enum: ['16:9', '9:16', '1:1', '4:5', '21:9'] },
        quality: { type: 'string', default: '1080p', enum: ['480p', '720p', '1080p', '4K'] },
        fps: { type: 'number', default: 30, enum: [24, 30, 60] },
        format: { type: 'string', default: 'mp4', enum: ['mp4', 'webm', 'gif'] }
      },
      required: []
    }
  }
];

// Ensure folders exist on module load
ensureFolders();

/**
 * GET /api/mcp
 * List available tools (MCP discovery)
 */
export async function GET() {
  return NextResponse.json({
    name: 'Video Editor Pro - MCP Server',
    version: '3.0.0',
    description: 'Complete AI-powered video editing tools for OpenCode IDE with real-time editor control',
    tools: TOOLS,
    categories: ['editor', 'ai-generation', 'grok', 'youtube', 'video-editing', 'manim', 'render'],
    rateLimits: {
      zai: '3 minutes between requests after 429 error',
      grok: '~4 generations per day'
    },
    endpoints: {
      tools: '/api/mcp',
      editorState: '/api/editor/state',
      editorEvents: '/api/editor/events',
      render: '/api/render'
    }
  });
}

/**
 * POST /api/mcp
 * Execute a tool
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool, params } = body;

    if (!tool) {
      return NextResponse.json({ error: 'Tool name is required' }, { status: 400 });
    }

    let result: any;

    // ============================================================
    // EDITOR CONTROL TOOLS
    // ============================================================
    switch (tool) {
      case 'get_editor_state':
        result = await editorControlTools.get_editor_state();
        break;
      case 'set_playhead':
        result = await editorControlTools.set_playhead(params);
        break;
      case 'start_playback':
        result = await editorControlTools.start_playback();
        break;
      case 'pause_playback':
        result = await editorControlTools.pause_playback();
        break;
      case 'set_aspect_ratio':
        result = await editorControlTools.set_aspect_ratio(params);
        break;
      case 'add_track':
        result = await editorControlTools.add_track(params);
        break;
      case 'add_clip':
        result = await editorControlTools.add_clip(params);
        break;
      case 'remove_clip':
        result = await editorControlTools.remove_clip(params);
        break;
      case 'move_clip':
        result = await editorControlTools.move_clip(params);
        break;
      case 'set_clip_speed':
        result = await editorControlTools.set_clip_speed(params);
        break;
      case 'set_clip_volume':
        result = await editorControlTools.set_clip_volume(params);
        break;
      case 'set_clip_fade':
        result = await editorControlTools.set_clip_fade(params);
        break;
      case 'set_clip_transform':
        result = await editorControlTools.set_clip_transform(params);
        break;
      case 'set_clip_filter':
        result = await editorControlTools.set_clip_filter(params);
        break;
      case 'set_clip_color_grade':
        result = await editorControlTools.set_clip_color_grade(params);
        break;
      case 'set_clip_chroma_key':
        result = await editorControlTools.set_clip_chroma_key(params);
        break;
      case 'set_clip_animation':
        result = await editorControlTools.set_clip_animation(params);
        break;
      case 'split_clip':
        result = await editorControlTools.split_clip();
        break;
      case 'delete_selected_clip':
        result = await editorControlTools.delete_selected_clip();
        break;
      case 'select_clip':
        result = await editorControlTools.select_clip(params);
        break;
      case 'add_marker':
        result = await editorControlTools.add_marker(params);
        break;
      case 'add_caption':
        result = await editorControlTools.add_caption(params);
        break;
      case 'import_media':
        result = await editorControlTools.import_media(params);
        break;
      case 'add_generated_content':
        result = await editorControlTools.add_generated_content(params);
        break;
      case 'undo_action':
        result = await editorControlTools.undo_action();
        break;
      case 'redo_action':
        result = await editorControlTools.redo_action();
        break;
      case 'clear_timeline':
        result = await editorControlTools.clear_timeline();
        break;

      // ============================================================
      // Z-AI GENERATION TOOLS
      // ============================================================
      case 'text_to_image':
        result = await text_to_image(params);
        break;
      case 'text_to_video':
        result = await text_to_video(params);
        break;
      case 'image_to_video':
        result = await image_to_video(params);
        break;
      case 'check_generation_status':
        result = await check_generation_status(params);
        break;
      case 'text_to_speech':
        result = await text_to_speech(params);
        break;

      // ============================================================
      // GROK EXTENSION TOOLS
      // ============================================================
      case 'text_to_image_grok':
        result = await text_to_image_grok(params);
        break;
      case 'text_to_video_grok':
        result = await text_to_video_grok(params);
        break;
      case 'image_to_video_grok':
        result = await image_to_video_grok(params);
        break;

      // ============================================================
      // YOUTUBE TOOLS
      // ============================================================
      case 'download_youtube':
        result = await download_youtube(params);
        break;
      case 'get_youtube_transcript':
        result = await get_youtube_transcript(params);
        break;

      // ============================================================
      // VIDEO EDITING TOOLS
      // ============================================================
      case 'trim_clip':
        result = await trim_clip(params);
        break;
      case 'reframe':
        result = await reframe(params);
        break;
      case 'add_captions':
        result = await add_captions(params);
        break;

      // ============================================================
      // MANIM TOOL
      // ============================================================
      case 'generate_animation':
        result = await generate_animation(params);
        break;

      default:
        return NextResponse.json({ error: `Unknown tool: ${tool}` }, { status: 400 });
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[MCP] Tool execution error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * HEAD /api/mcp
 * Health check with dependency status
 */
export async function HEAD() {
  const deps = await checkAllDependencies();
  const allInstalled = deps.ytDlp.installed && deps.ffmpeg.installed;
  
  return new NextResponse(null, {
    status: allInstalled ? 200 : 206,
    headers: {
      'X-Dependencies': JSON.stringify(deps)
    }
  });
}
