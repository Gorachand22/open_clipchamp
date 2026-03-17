# Clipchamp MCP Server

A Model Context Protocol (MCP) server that enables Claude Code to control the Open Clipchamp video editor. This allows Claude to act as a professional video editor assistant, controlling all aspects of the editor programmatically.

## Features

### Timeline Control
- Get editor state (tracks, clips, playhead position)
- Move playhead to specific time
- Start/pause playback
- Set aspect ratio (16:9, 9:16, 1:1, etc.)

### Clip Management
- Add clips to timeline
- Remove clips
- Move clips to new positions
- Split clips at playhead
- Select/deselect clips

### Clip Properties
- Set playback speed
- Adjust volume
- Add fade in/out effects
- Apply visual filters
- Color grading (exposure, contrast, saturation, etc.)
- Set animations (entrance/exit)
- Transform (scale, rotation, position, opacity)

### Track Management
- Add new tracks (video, audio, overlay)
- Remove tracks

### Media Import
- Import media files
- Add generated content

### AI Content Generation
- Text to Image generation
- Text to Video generation
- Image to Video animation
- Text to Speech synthesis
- List available voices

### YouTube Integration
- Download YouTube videos
- Get YouTube transcripts

### Utility
- Add markers
- Add captions
- Undo/Redo actions
- Clear timeline

## Installation

### 1. Install Dependencies

```bash
cd /home/babul/open_clipchamp/mcp-server
npm install
```

### 2. Build the Server

```bash
npm run build
```

### 3. Configure Claude Code

Copy the settings to your Claude Code configuration:

```bash
# Create Claude config directory if it doesn't exist
mkdir -p /home/babul/.claude

# Copy the settings (merge with existing settings if needed)
cp settings.json /home/babul/.claude/settings.json
```

Or manually add to your existing `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "clipchamp": {
      "command": "node",
      "args": ["/home/babul/open_clipchamp/mcp-server/dist/index.js"],
      "env": {
        "CLIPCHAMP_URL": "http://localhost:3000",
        "CLIPCHAMP_PROJECTS_DIR": "/home/babul/open_clipchamp/projects"
      }
    }
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "clipchamp:.*",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"[$(date '+%Y-%m-%d %H:%M:%S')] PRE  $TOOL_NAME\" >> /tmp/clipchamp-hooks.log"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "clipchamp:.*",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"[$(date '+%Y-%m-%d %H:%M:%S')] POST $TOOL_NAME exit=$TOOL_EXIT_CODE\" >> /tmp/clipchamp-hooks.log"
          }
        ]
      }
    ]
  }
}
```

### 4. Start the Clipchamp Editor

```bash
cd /home/babul/open_clipchamp
npm run dev
```

The editor should be running at http://localhost:3000

### 5. Restart Claude Code

After configuring, restart Claude Code for the changes to take effect.

## Usage

Once configured, Claude Code will have access to all the Clipchamp tools. Here's an example workflow:

```
User: "Create a TikTok video with a sunset background"

Claude will:
1. set_aspect_ratio to "9:16" for TikTok
2. text_to_image to generate a sunset image
3. add_clip to add the image to the timeline
4. add_caption to add text overlays
```

## Hook Logging

The hooks configuration logs all tool calls to `/tmp/clipchamp-hooks.log`. View the log with:

```bash
tail -f /tmp/clipchamp-hooks.log
```

This helps verify that Claude's commands are being executed correctly.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLIPCHAMP_URL` | `http://localhost:3000` | URL of the Clipchamp web app |
| `CLIPCHAMP_PROJECTS_DIR` | `./projects` | Directory for project files |

## Available Tools

### Editor State
- `get_editor_state` - Get current editor state

### Playback
- `set_playhead` - Move playhead to time
- `start_playback` - Start playing
- `pause_playback` - Pause playback

### Timeline
- `set_aspect_ratio` - Set project aspect ratio
- `add_track` - Add new track
- `remove_track` - Remove track
- `add_clip` - Add clip to timeline
- `remove_clip` - Remove clip
- `move_clip` - Move clip position
- `split_clip` - Split at playhead
- `delete_selected_clip` - Delete selected clip
- `select_clip` - Select a clip

### Clip Properties
- `set_clip_speed` - Set playback speed
- `set_clip_volume` - Set volume
- `set_clip_fade` - Add fade effects
- `set_clip_filter` - Apply filter
- `set_clip_color_grade` - Color grading
- `set_clip_animation` - Set animations
- `set_clip_transform` - Set transform

### Media
- `import_media` - Import media file
- `add_generated_content` - Add AI content

### AI Generation
- `text_to_image` - Generate image
- `text_to_video` - Generate video
- `image_to_video` - Animate image
- `check_generation_status` - Check AI task status
- `text_to_speech` - Text to speech
- `list_voices` - List TTS voices

### YouTube
- `download_youtube` - Download video
- `get_youtube_transcript` - Get subtitles

### Utility
- `add_marker` - Add timeline marker
- `add_caption` - Add caption
- `undo_action` - Undo
- `redo_action` - Redo
- `clear_timeline` - Clear all clips

## Troubleshooting

### MCP Server Not Starting

1. Check if Node.js is installed: `node --version` (needs 18+)
2. Check if dependencies are installed: `npm install`
3. Check if built: `npm run build`
4. Check logs for errors

### Cannot Connect to Clipchamp

1. Ensure the web app is running: `npm run dev`
2. Check if port 3000 is available
3. Try accessing http://localhost:3000 in browser

### Tools Not Working

1. Check the hook logs: `tail -f /tmp/clipchamp-hooks.log`
2. Check Claude Code output
3. Ensure the editor is connected (open in browser)

## Development

```bash
# Watch mode for development
npm run dev

# Build for production
npm run build

# Clean build artifacts
npm run clean
```

## License

MIT
