#!/usr/bin/env node
/**
 * Clipchamp MCP Server - Complete Implementation
 *
 * Provides MCP tools for Claude Code to control Open Clipchamp video editor.
 *
 * Features:
 * - Full editor control (timeline, clips, tracks, playback)
 * - AI generation via Qwen bridge (FREE image/video generation)
 * - YouTube integration
 * - Media import/export
 *
 * The Qwen bridge uses a Chrome extension to automate chat.qwen.ai
 * for free AI content generation.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { v4 as uuidv4 } from 'uuid';
// ============================================================================
// Configuration
// ============================================================================
const CLIPCHAMP_URL = process.env.CLIPCHAMP_URL || 'http://localhost:3000';
// ============================================================================
// HTTP Helpers
// ============================================================================
async function fetchFromClipchamp(endpoint, options = {}) {
    const url = `${CLIPCHAMP_URL}${endpoint}`;
    return fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });
}
async function getEditorState() {
    try {
        const response = await fetchFromClipchamp('/api/editor/state');
        if (!response.ok) {
            return {
                success: false,
                error: `Failed to get editor state: ${response.status}. Make sure Clipchamp is running at ${CLIPCHAMP_URL}`,
            };
        }
        const data = await response.json();
        return { success: true, data: data.snapshot };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            error: `Cannot connect to Clipchamp at ${CLIPCHAMP_URL}. Is the editor running? Error: ${errorMessage}`,
        };
    }
}
async function sendCommand(command, params) {
    try {
        const response = await fetchFromClipchamp('/api/editor/state', {
            method: 'POST',
            body: JSON.stringify({ operation: command, params }),
        });
        if (!response.ok) {
            return { success: false, error: `Command failed: ${response.status}` };
        }
        const data = await response.json();
        return { success: true, data };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
}
async function callMCPTool(toolName, args) {
    try {
        const response = await fetchFromClipchamp('/api/mcp', {
            method: 'POST',
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: uuidv4(),
                method: 'tools/call',
                params: { name: toolName, arguments: args },
            }),
        });
        if (!response.ok) {
            return { success: false, error: `MCP call failed: ${response.status}` };
        }
        const data = await response.json();
        if (data.error) {
            return { success: false, error: data.error.message };
        }
        const content = data.result?.content?.[0];
        if (content?.type === 'text' && content.text) {
            try {
                return JSON.parse(content.text);
            }
            catch {
                return { success: true, data: content.text };
            }
        }
        return { success: true, data: data.result };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
}
// ============================================================================
// Qwen Bridge Functions
// ============================================================================
async function addQwenTask(prompt, mode, aspectRatio) {
    const taskId = `qwen_${Date.now()}_${uuidv4().substring(0, 8)}`;
    try {
        const response = await fetchFromClipchamp('/api/qwen-bridge/queue', {
            method: 'POST',
            body: JSON.stringify({
                id: taskId,
                prompt,
                mode,
                aspectRatio,
            }),
        });
        if (!response.ok) {
            return { success: false, error: 'Failed to add task to queue' };
        }
        const data = await response.json();
        return {
            success: true,
            data: {
                taskId,
                status: 'pending',
                message: 'Task added to queue. Open chat.qwen.ai to process.',
            },
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
}
async function getQwenTaskStatus(taskId) {
    try {
        const response = await fetchFromClipchamp(`/api/qwen-bridge/complete?taskId=${taskId}`);
        if (!response.ok) {
            return { success: false, error: 'Task not found' };
        }
        const data = await response.json();
        const task = data.task;
        if (!task) {
            return { success: false, error: 'Task not found' };
        }
        return {
            success: true,
            data: {
                taskId: task.id,
                status: task.status,
                result: task.result,
                error: task.error,
            },
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
}
// ============================================================================
// Tool Definitions
// ============================================================================
const TOOLS = [
    // ==================== Editor State ====================
    {
        name: 'get_editor_state',
        description: `Get the current state of the Clipchamp video editor.

Returns complete editor state including:
- tracks: All timeline tracks with their clips
- currentTime: Current playhead position (seconds)
- duration: Total project duration
- aspectRatio: Current aspect ratio
- isPlaying: Playback state
- selectedClipId: Currently selected clip
- markers: Timeline markers

Use this first to understand the project before making edits.`,
        inputSchema: { type: 'object', properties: {}, required: [] },
    },
    // ==================== Playback Control ====================
    {
        name: 'set_playhead',
        description: `Move the playhead (current time indicator) to a specific position.

Parameters:
- time: Target position in seconds (e.g., 5.5 for 5.5 seconds)

The playhead is the vertical line showing current position in timeline.`,
        inputSchema: {
            type: 'object',
            properties: {
                time: { type: 'number', description: 'Target time in seconds' },
            },
            required: ['time'],
        },
    },
    {
        name: 'start_playback',
        description: `Start video playback from the current playhead position.`,
        inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'pause_playback',
        description: `Pause video playback at the current position.`,
        inputSchema: { type: 'object', properties: {}, required: [] },
    },
    // ==================== Aspect Ratio ====================
    {
        name: 'set_aspect_ratio',
        description: `Set the project aspect ratio.

Available ratios:
- 16:9: YouTube/desktop (1920x1080)
- 9:16: TikTok/Shorts/Reels (1080x1920)
- 1:1: Instagram square (1080x1080)
- 4:5: Instagram portrait (1080x1350)
- 21:9: Ultrawide cinematic (2560x1080)`,
        inputSchema: {
            type: 'object',
            properties: {
                ratio: {
                    type: 'string',
                    enum: ['16:9', '9:16', '1:1', '4:5', '21:9'],
                },
            },
            required: ['ratio'],
        },
    },
    // ==================== Track Management ====================
    {
        name: 'add_track',
        description: `Add a new track to the timeline.

Track types:
- video: For video clips and images
- audio: For audio clips (music, voiceover)
- overlay: For text overlays and graphics`,
        inputSchema: {
            type: 'object',
            properties: {
                trackType: {
                    type: 'string',
                    enum: ['video', 'audio', 'overlay'],
                },
            },
            required: ['trackType'],
        },
    },
    {
        name: 'remove_track',
        description: `Remove a track from the timeline.

Parameters:
- trackId: ID of the track to remove

WARNING: This removes all clips on the track.`,
        inputSchema: {
            type: 'object',
            properties: {
                trackId: { type: 'string' },
            },
            required: ['trackId'],
        },
    },
    // ==================== Clip Management ====================
    {
        name: 'add_clip',
        description: `Add a media clip to the timeline.

Required:
- mediaId: Unique identifier for the media
- mediaName: Display name
- mediaType: 'video', 'audio', or 'image'
- duration: Clip duration in seconds

Optional:
- trackId: Target track (auto-selected if not provided)
- startTime: Start position (default: end of last clip)
- src: Media source URL/path
- thumbnail: Thumbnail URL`,
        inputSchema: {
            type: 'object',
            properties: {
                trackId: { type: 'string' },
                mediaId: { type: 'string' },
                mediaName: { type: 'string' },
                mediaType: { type: 'string', enum: ['video', 'audio', 'image'] },
                startTime: { type: 'number' },
                duration: { type: 'number' },
                src: { type: 'string' },
                thumbnail: { type: 'string' },
            },
            required: ['mediaId', 'mediaName', 'mediaType', 'duration'],
        },
    },
    {
        name: 'remove_clip',
        description: `Remove a clip from the timeline.`,
        inputSchema: {
            type: 'object',
            properties: {
                clipId: { type: 'string' },
            },
            required: ['clipId'],
        },
    },
    {
        name: 'move_clip',
        description: `Move a clip to a new position.`,
        inputSchema: {
            type: 'object',
            properties: {
                clipId: { type: 'string' },
                startTime: { type: 'number' },
                targetTrackId: { type: 'string' },
            },
            required: ['clipId', 'startTime'],
        },
    },
    {
        name: 'split_clip',
        description: `Split the selected clip at the playhead position.

The clip must be selected first using select_clip.`,
        inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'delete_selected_clip',
        description: `Delete the currently selected clip.`,
        inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'select_clip',
        description: `Select a clip on the timeline.`,
        inputSchema: {
            type: 'object',
            properties: {
                clipId: { type: 'string', description: 'Clip ID or null to deselect' },
            },
            required: [],
        },
    },
    // ==================== Clip Properties ====================
    {
        name: 'set_clip_speed',
        description: `Change clip playback speed.

Parameters:
- clipId: Clip ID
- speed: Speed multiplier (0.25-4, e.g., 2 = double speed)`,
        inputSchema: {
            type: 'object',
            properties: {
                clipId: { type: 'string' },
                speed: { type: 'number', description: 'Speed multiplier (0.25-4)' },
            },
            required: ['clipId', 'speed'],
        },
    },
    {
        name: 'set_clip_volume',
        description: `Set clip volume level.

Parameters:
- clipId: Clip ID
- volume: Volume level (0=mute, 1=normal, 2=double)`,
        inputSchema: {
            type: 'object',
            properties: {
                clipId: { type: 'string' },
                volume: { type: 'number', description: 'Volume level (0-2)' },
            },
            required: ['clipId', 'volume'],
        },
    },
    {
        name: 'set_clip_fade',
        description: `Set fade in/out effects on a clip.

Parameters:
- clipId: Clip ID
- fadeIn: Fade in duration (seconds)
- fadeOut: Fade out duration (seconds)`,
        inputSchema: {
            type: 'object',
            properties: {
                clipId: { type: 'string' },
                fadeIn: { type: 'number' },
                fadeOut: { type: 'number' },
            },
            required: ['clipId'],
        },
    },
    {
        name: 'set_clip_filter',
        description: `Apply a visual filter to a clip.

Available filters: none, cinematic, warm, cool, vintage, noir, vibrant, muted, teal, dramatic, retro, neon`,
        inputSchema: {
            type: 'object',
            properties: {
                clipId: { type: 'string' },
                filter: { type: 'string' },
            },
            required: ['clipId', 'filter'],
        },
    },
    {
        name: 'set_clip_color_grade',
        description: `Apply color grading settings.

Settings:
- exposure: -100 to 100
- contrast: -100 to 100
- saturation: -100 to 100
- temperature: -100 (cool) to 100 (warm)
- tint: -100 (green) to 100 (magenta)
- vignette: 0 to 100`,
        inputSchema: {
            type: 'object',
            properties: {
                clipId: { type: 'string' },
                settings: {
                    type: 'object',
                    properties: {
                        exposure: { type: 'number' },
                        contrast: { type: 'number' },
                        saturation: { type: 'number' },
                        temperature: { type: 'number' },
                        tint: { type: 'number' },
                        vignette: { type: 'number' },
                    },
                },
            },
            required: ['clipId', 'settings'],
        },
    },
    {
        name: 'set_clip_animation',
        description: `Set entrance/exit animations.

Animations:
- entrance: fade-in, slide-left, slide-right, zoom-in, bounce-in
- exit: fade-out, slide-out-left, slide-out-right, zoom-out`,
        inputSchema: {
            type: 'object',
            properties: {
                clipId: { type: 'string' },
                entrance: { type: 'string' },
                exit: { type: 'string' },
            },
            required: ['clipId'],
        },
    },
    // ==================== Markers ====================
    {
        name: 'add_marker',
        description: `Add a marker to the timeline.

Parameters:
- time: Position in seconds
- label: Marker label text`,
        inputSchema: {
            type: 'object',
            properties: {
                time: { type: 'number' },
                label: { type: 'string' },
            },
            required: ['time', 'label'],
        },
    },
    // ==================== Media Import ====================
    {
        name: 'import_media',
        description: `Import media into the editor's library.

Parameters:
- name: Display name
- type: 'video', 'audio', or 'image'
- src: Media source URL/path
- duration: Duration in seconds
- thumbnail: Thumbnail URL (optional)`,
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                type: { type: 'string' },
                src: { type: 'string' },
                duration: { type: 'number' },
                thumbnail: { type: 'string' },
            },
            required: ['name', 'type', 'src', 'duration'],
        },
    },
    // ==================== AI Generation (Qwen Bridge - FREE) ====================
    {
        name: 'text_to_image',
        description: `Generate an image from a text prompt using Qwen AI (FREE).

This tool uses chat.qwen.ai for FREE image generation.

Parameters:
- prompt: Description of the image to generate
- aspectRatio: Output aspect ratio

Available aspect ratios:
- 9:16: TikTok/Shorts/Reels (vertical)
- 16:9: YouTube (horizontal)
- 1:1: Square
- 3:4: Portrait
- 4:3: Landscape

IMPORTANT: 
1. You must have the Qwen automation extension installed
2. Open chat.qwen.ai in a browser tab before using this tool
3. The extension will automate the generation process

Returns a taskId. Use check_qwen_status to poll for completion.`,
        inputSchema: {
            type: 'object',
            properties: {
                prompt: { type: 'string', description: 'Image description' },
                aspectRatio: {
                    type: 'string',
                    enum: ['9:16', '16:9', '1:1', '3:4', '4:3'],
                    default: '9:16',
                },
            },
            required: ['prompt'],
        },
    },
    {
        name: 'text_to_video',
        description: `Generate a video from a text prompt using Qwen AI (FREE).

This tool uses chat.qwen.ai for FREE video generation.

Parameters:
- prompt: Description of the video to generate
- aspectRatio: Output aspect ratio

IMPORTANT:
1. Requires Qwen automation extension
2. Open chat.qwen.ai before using
3. Video generation takes longer than images

Returns a taskId. Use check_qwen_status to poll for completion.`,
        inputSchema: {
            type: 'object',
            properties: {
                prompt: { type: 'string', description: 'Video description' },
                aspectRatio: {
                    type: 'string',
                    enum: ['9:16', '16:9', '1:1', '3:4', '4:3'],
                    default: '9:16',
                },
            },
            required: ['prompt'],
        },
    },
    {
        name: 'check_qwen_status',
        description: `Check the status of a Qwen AI generation task.

Parameters:
- taskId: Task ID returned from text_to_image or text_to_video

Returns:
- status: 'pending', 'running', 'completed', or 'failed'
- result: Generated content URLs when complete

Poll every 5-10 seconds until completion.`,
        inputSchema: {
            type: 'object',
            properties: {
                taskId: { type: 'string' },
            },
            required: ['taskId'],
        },
    },
    {
        name: 'add_generated_content',
        description: `Add AI-generated content directly to the timeline.

This combines generation and timeline addition into one step.

Parameters:
- type: 'image' or 'video'
- prompt: Content description
- aspectRatio: Output aspect ratio
- autoAdd: If true, adds to timeline automatically when complete`,
        inputSchema: {
            type: 'object',
            properties: {
                type: { type: 'string', enum: ['image', 'video'] },
                prompt: { type: 'string' },
                aspectRatio: {
                    type: 'string',
                    enum: ['9:16', '16:9', '1:1', '3:4', '4:3'],
                    default: '9:16',
                },
                autoAdd: { type: 'boolean', default: true },
            },
            required: ['type', 'prompt'],
        },
    },
    // ==================== Undo/Redo ====================
    {
        name: 'undo_action',
        description: `Undo the last editor action.`,
        inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'redo_action',
        description: `Redo a previously undone action.`,
        inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'clear_timeline',
        description: `Clear all clips from the timeline.

WARNING: This removes all clips from all tracks.`,
        inputSchema: { type: 'object', properties: {}, required: [] },
    },
    // ==================== Caption ====================
    {
        name: 'add_caption',
        description: `Add a caption/subtitle to the timeline.

Parameters:
- startTime: When caption appears (seconds)
- endTime: When caption disappears (seconds)
- text: Caption text`,
        inputSchema: {
            type: 'object',
            properties: {
                startTime: { type: 'number' },
                endTime: { type: 'number' },
                text: { type: 'string' },
            },
            required: ['startTime', 'endTime', 'text'],
        },
    },
    // ==================== YouTube ====================
    {
        name: 'download_youtube',
        description: `Download a YouTube video.

Parameters:
- url: YouTube video URL
- format: 'video', 'audio', or 'both'
- quality: 'best', 'medium', or 'low'

Requires yt-dlp installed.`,
        inputSchema: {
            type: 'object',
            properties: {
                url: { type: 'string' },
                format: { type: 'string', enum: ['video', 'audio', 'both'], default: 'both' },
                quality: { type: 'string', enum: ['best', 'medium', 'low'], default: 'best' },
            },
            required: ['url'],
        },
    },
    {
        name: 'get_youtube_transcript',
        description: `Get transcript/subtitles from a YouTube video.

Parameters:
- videoId: YouTube video ID (from URL)
- languages: Language codes to try (default: ['en', 'hi'])`,
        inputSchema: {
            type: 'object',
            properties: {
                videoId: { type: 'string' },
                languages: {
                    type: 'array',
                    items: { type: 'string' },
                    default: ['en', 'hi'],
                },
            },
            required: ['videoId'],
        },
    },
];
// ============================================================================
// Tool Execution
// ============================================================================
async function executeTool(name, args) {
    switch (name) {
        // Editor State
        case 'get_editor_state':
            return getEditorState();
        // Playback
        case 'set_playhead':
            return sendCommand('set_playhead', args);
        case 'start_playback':
            return sendCommand('play', {});
        case 'pause_playback':
            return sendCommand('pause', {});
        // Aspect Ratio
        case 'set_aspect_ratio':
            return sendCommand('set_aspect_ratio', args);
        // Tracks
        case 'add_track':
            return sendCommand('add_track', args);
        case 'remove_track':
            return sendCommand('remove_track', args);
        // Clips
        case 'add_clip':
            return sendCommand('add_clip', args);
        case 'remove_clip':
            return sendCommand('remove_clip', args);
        case 'move_clip':
            return sendCommand('move_clip', args);
        case 'split_clip':
            return sendCommand('split_clip', {});
        case 'delete_selected_clip':
            return sendCommand('delete_selected', {});
        case 'select_clip':
            return sendCommand('select_clip', args);
        // Clip Properties
        case 'set_clip_speed':
            return callMCPTool('set_clip_speed', args);
        case 'set_clip_volume':
            return callMCPTool('set_clip_volume', args);
        case 'set_clip_fade':
            return callMCPTool('set_clip_fade', args);
        case 'set_clip_filter':
            return callMCPTool('set_clip_filter', args);
        case 'set_clip_color_grade':
            return callMCPTool('set_clip_color_grade', args);
        case 'set_clip_animation':
            return callMCPTool('set_clip_animation', args);
        // Markers
        case 'add_marker':
            return callMCPTool('add_marker', args);
        // Media Import
        case 'import_media':
            return sendCommand('import_media', args);
        // AI Generation (Qwen Bridge)
        case 'text_to_image':
            return addQwenTask(args.prompt, 'image', args.aspectRatio || '9:16');
        case 'text_to_video':
            return addQwenTask(args.prompt, 'video', args.aspectRatio || '9:16');
        case 'check_qwen_status':
            return getQwenTaskStatus(args.taskId);
        case 'add_generated_content': {
            const result = await addQwenTask(args.prompt, args.type, args.aspectRatio || '9:16');
            if (result.success && args.autoAdd !== false) {
                // Store for later auto-add when complete
                return {
                    ...result,
                    data: {
                        ...result.data,
                        message: 'Task queued. Use check_qwen_status to monitor progress, then add_clip to add to timeline.',
                    },
                };
            }
            return result;
        }
        // Captions
        case 'add_caption':
            return callMCPTool('add_caption', args);
        // Undo/Redo
        case 'undo_action':
            return callMCPTool('undo_action', {});
        case 'redo_action':
            return callMCPTool('redo_action', {});
        case 'clear_timeline':
            return callMCPTool('clear_timeline', {});
        // YouTube
        case 'download_youtube':
            return callMCPTool('download_youtube', args);
        case 'get_youtube_transcript':
            return callMCPTool('get_youtube_transcript', args);
        default:
            return { success: false, error: `Unknown tool: ${name}` };
    }
}
// ============================================================================
// Server Setup
// ============================================================================
const server = new Server({
    name: 'clipchamp-mcp-server',
    version: '2.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
});
// Handle call tool request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    console.error(`[MCP] Tool called: ${name}`);
    console.error(`[MCP] Arguments: ${JSON.stringify(args, null, 2)}`);
    try {
        const result = await executeTool(name, args || {});
        console.error(`[MCP] Result: success=${result.success}`);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                },
            ],
            isError: !result.success,
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[MCP] Error: ${errorMessage}`);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ success: false, error: errorMessage }, null, 2),
                },
            ],
            isError: true,
        };
    }
});
// ============================================================================
// Start Server
// ============================================================================
async function main() {
    console.error('[MCP] Starting Clipchamp MCP Server v2.0...');
    console.error(`[MCP] Clipchamp URL: ${CLIPCHAMP_URL}`);
    console.error('[MCP] AI Generation: Qwen Bridge (FREE)');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[MCP] Server connected and ready!');
}
main().catch((error) => {
    console.error('[MCP] Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map