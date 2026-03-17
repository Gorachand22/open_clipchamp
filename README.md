# Open Clipchamp - AI-Powered Video Editor

A full-featured web-based video editor with MCP (Model Context Protocol) integration for Claude Code control. This allows Claude to act as a professional video editor assistant.

## Features

### Editor Features
- **Timeline Editor**: Multi-track timeline with drag-and-drop clips
- **Playback Control**: Playhead, zoom, scrubbing
- **Media Library**: Import videos, images, audio
- **Text Overlays**: Multiple text styles and animations
- **Effects**: Filters, transitions, color grading
- **Export**: Multiple formats and resolutions

### MCP Integration for Claude Code
Claude Code can control the entire editor through MCP tools:

**Timeline Control**
- `get_editor_state` - Get current project state
- `set_playhead` - Move playhead position
- `start_playback` / `pause_playback` - Control playback
- `set_aspect_ratio` - Set 16:9, 9:16, 1:1, etc.

**Clip Management**
- `add_clip` - Add media to timeline
- `remove_clip` - Remove clips
- `move_clip` - Move clips in timeline
- `split_clip` - Split at playhead
- `select_clip` - Select for editing

**Clip Properties**
- `set_clip_speed` - Speed adjustment (0.25-4x)
- `set_clip_volume` - Volume control
- `set_clip_fade` - Fade in/out effects
- `set_clip_filter` - Visual filters
- `set_clip_color_grade` - Color grading
- `set_clip_animation` - Entrance/exit animations

**AI Generation (FREE via Qwen)**
- `text_to_image` - Generate images from text
- `text_to_video` - Generate videos from text
- `check_qwen_status` - Check generation status

## Installation

### 1. Install Dependencies

```bash
cd /home/babul/open_clipchamp
npm install
```

### 2. Start the Web App

```bash
npm run dev
```

The editor will be available at http://localhost:3000

### 3. Install MCP Server

```bash
cd mcp-server
npm install
npm run build
```

### 4. Configure Claude Code

Copy the settings to your Claude Code configuration:

```bash
mkdir -p ~/.claude
cp mcp-server/settings.json ~/.claude/settings.json
```

Or add manually to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "clipchamp": {
      "command": "node",
      "args": ["/home/babul/open_clipchamp/mcp-server/dist/index.js"],
      "env": {
        "CLIPCHAMP_URL": "http://localhost:3000"
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

### 5. Restart Claude Code

After configuration, restart Claude Code for the changes to take effect.

## Qwen Automation Extension (Free AI Generation)

For free AI image/video generation, use the Qwen automation Chrome extension.

### Install Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `qwen_automate` folder

### Use Qwen Generation

1. Open chat.qwen.ai in Chrome
2. Click the extension icon to open the side panel
3. Enter prompt and select mode (Image/Video)
4. Click "Add to Queue"
5. The extension will automate the generation

Or use MCP tools:
```
text_to_image prompt="A sunset over mountains" aspectRatio="9:16"
text_to_video prompt="A cat playing piano" aspectRatio="16:9"
```

## Hook Logging

All MCP tool calls are logged to `/tmp/clipchamp-hooks.log`:

```bash
tail -f /tmp/clipchamp-hooks.log
```

## Project Structure

```
open_clipchamp/
├── src/
│   ├── app/                    # Next.js app routes
│   │   ├── api/
│   │   │   ├── editor/         # Editor state API
│   │   │   ├── mcp/            # MCP JSON-RPC endpoint
│   │   │   └── qwen-bridge/    # Qwen automation API
│   │   └── page.tsx            # Main editor page
│   ├── components/
│   │   └── editor/             # Editor components
│   ├── store/
│   │   └── editorStore.ts      # Zustand state store
│   ├── lib/
│   │   ├── editor-control.ts   # Editor control tools
│   │   ├── mcp-tools.ts        # AI generation tools
│   │   └── import-media.ts     # Media import utilities
│   └── types/
│       └── editor.ts           # TypeScript types
├── mcp-server/                 # Standalone MCP server
│   ├── src/
│   │   └── index.ts            # MCP server implementation
│   ├── dist/                   # Compiled JavaScript
│   ├── package.json
│   ├── tsconfig.json
│   └── settings.json           # Claude Code settings
├── qwen_automate/              # Chrome extension for Qwen
│   ├── manifest.json
│   ├── assets/
│   │   ├── content.js          # Content script
│   │   └── service-worker.js   # Background worker
│   └── src/ui/side-panel/      # Extension UI
└── grok_automate/              # Chrome extension for Grok (alternative)
```

## Available MCP Tools

### Editor Control (26 tools)
| Tool | Description |
|------|-------------|
| `get_editor_state` | Get complete editor state |
| `set_playhead` | Move playhead position |
| `start_playback` | Start video playback |
| `pause_playback` | Pause video playback |
| `set_aspect_ratio` | Set aspect ratio |
| `add_track` | Add new track |
| `remove_track` | Remove track |
| `add_clip` | Add clip to timeline |
| `remove_clip` | Remove clip |
| `move_clip` | Move clip position |
| `split_clip` | Split at playhead |
| `delete_selected_clip` | Delete selected |
| `select_clip` | Select a clip |
| `set_clip_speed` | Set speed (0.25-4x) |
| `set_clip_volume` | Set volume |
| `set_clip_fade` | Set fade effects |
| `set_clip_filter` | Apply filter |
| `set_clip_color_grade` | Color grading |
| `set_clip_animation` | Set animations |
| `add_marker` | Add timeline marker |
| `import_media` | Import media file |
| `undo_action` | Undo last action |
| `redo_action` | Redo action |
| `clear_timeline` | Clear all clips |
| `add_caption` | Add caption |
| `add_generated_content` | Add AI content |

### AI Generation (4 tools)
| Tool | Description |
|------|-------------|
| `text_to_image` | Generate image from prompt |
| `text_to_video` | Generate video from prompt |
| `check_qwen_status` | Check generation status |
| `add_generated_content` | Generate and add to timeline |

### YouTube (2 tools)
| Tool | Description |
|------|-------------|
| `download_youtube` | Download YouTube video |
| `get_youtube_transcript` | Get video transcript |

## Example Usage with Claude

```
User: "Create a TikTok video about AI"

Claude will:
1. set_aspect_ratio("9:16") for TikTok
2. text_to_image("AI concept art") 
3. Wait for generation
4. add_clip() to add to timeline
5. add_caption() for text overlay
```

## Troubleshooting

### Editor Not Connecting
- Ensure web app is running: `npm run dev`
- Check http://localhost:3000 in browser

### MCP Tools Not Working
- Check hooks log: `tail -f /tmp/clipchamp-hooks.log`
- Verify settings.json path is correct
- Restart Claude Code

### Qwen Extension Issues
- Ensure chat.qwen.ai is open
- Check extension is enabled
- Check side panel for errors

## License

MIT
