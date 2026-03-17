#!/bin/bash

# API Key Helper Script for Claude Code
# This script provides API keys for Claude Code when needed

# Z.ai API Key (for AI generation features)
# Set this environment variable or uncomment and add your key
# export Z_AI_API_KEY="your-api-key-here"

# If using environment variables, just echo them
if [ -n "$Z_AI_API_KEY" ]; then
    echo "$Z_AI_API_KEY"
else
    # Return empty or default
    echo ""
fi
