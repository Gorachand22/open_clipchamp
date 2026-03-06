# Video Editor Pro - WSL2 Ubuntu Setup Guide

This guide explains how to set up the Video Editor Pro with OpenCode IDE integration on WSL2 Ubuntu.

## Prerequisites

1. **WSL2 Ubuntu** - Already installed
2. **OpenCode IDE** - install from https://opencode.ai/
3. **Bun** - JavaScript runtime
4. **Python 3** - For Manim and YouTube transcript

## Step 1: Install System Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install ffmpeg (required for video processing)
sudo apt install -y ffmpeg

# Install Python and pip
sudo apt install -y python3 python3-pip python3-venv

# Install PortAudio (for audio processing)
sudo apt install -y libportaudio2 portaudio19-dev

# Install Manim dependencies
sudo apt install -y libpango1.0-dev libcairo2-dev

# Install yt-dlp (for YouTube downloads)
pip3 install yt-dlp --break-system-packages

# Install youtube-transcript-api (for transcripts)
pip3 install youtube-transcript-api --break-system-packages

# Install Manim (optional - for math animations)
pip3 install manim --break-system-packages
```

## Step 2: Install Bun (if not installed)

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Add to path (restart terminal or run)
source ~/.bashrc
```

## Step 3: Clone and Setup the Project

```bash
# Navigate to your workspace
cd ~

# If you have the zip file
cd open_clipchamp

# Install dependencies
bun install

# Create necessary directories
mkdir -p input output temp download

# Create .env file
cp .env.example .env  # If exists, otherwise create manually
```

## Step 4: Configure Environment Variables

Create a `.env` file in the project root:

```env
# Z-AI Configuration (for AI generation)
Z_AUDIO_TOKEN=your_audio_token_here
Z_AUDIO_USER_ID=your_user_id_here
Z_AUDIO_API_BASE=https://audio.z.ai/api
```

## Start the Editor

```bash
cd ~/open_clipchamp

# Start the development server
bun run dev
```

The editor will be available at: **http://localhost:3000**

## Connect OpenCode IDE

1. Open OpenCode IDE
2. The MCP server should auto-connect to `http://localhost:3000/api/mcp`
3. Verify connection by checking available tools:
   - In OpenCode, you should see 50+ tools available
   - Categories: editor, ai-generation, youtube, video-editing, manim, remotion

## Verification

### Test MCP Connection
```bash
# Test MCP endpoint
curl http://localhost:3000/api/mcp

# Should return JSON with tools list
```

### Test Editor State
```bash
# Test editor state endpoint
curl http://localhost:3000/api/editor/state
```

## Troubleshooting

### Port 3000 already in use
```bash
# Find and kill process
lsof -i :3000
kill -9 <PID>
```

### MCP connection fails
1. Check if editor is running: `curl http://localhost:3000/api/mcp`
2. Check OpenCode config: `cat ~/.config/opencode/opencode.json`
3. Restart OpenCode IDE