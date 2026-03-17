#!/bin/bash

# Clipchamp MCP Server Installation Script
# This script installs and builds the MCP server for Claude Code integration

set -e

echo "=========================================="
echo "  Clipchamp MCP Server Installation"
echo "=========================================="

# Check Node.js version
echo ""
echo "Checking Node.js version..."
NODE_VERSION=$(node --version 2>/dev/null || echo "none")
if [ "$NODE_VERSION" = "none" ]; then
    echo "ERROR: Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi
echo "Node.js version: $NODE_VERSION"

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo ""
echo "Installing dependencies..."
npm install

echo ""
echo "Building MCP server..."
npm run build

echo ""
echo "Creating log file..."
touch /tmp/clipchamp-hooks.log

echo ""
echo "=========================================="
echo "  Installation Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Copy the settings to Claude Code config:"
echo "   cp settings.json ~/.claude/settings.json"
echo ""
echo "   Or manually add the mcpServers section to your existing config."
echo ""
echo "2. Start the Clipchamp web app:"
echo "   cd /home/babul/open_clipchamp && npm run dev"
echo ""
echo "3. Restart Claude Code"
echo ""
echo "4. Test with Claude: 'Get the editor state'"
echo ""
echo "Logs will be written to: /tmp/clipchamp-hooks.log"
echo ""
