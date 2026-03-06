#!/usr/bin/env python3
"""
YouTube Transcript Fetcher
Fetches raw transcript data in JSON format for IDE processing.

Usage:
    python3 fetch_transcript.py VIDEO_ID [LANGUAGES]

Arguments:
    VIDEO_ID    - YouTube video ID (11 characters)
    LANGUAGES   - Comma-separated language codes (default: en,hi,en-US,en-GB)

Output:
    JSON with success flag and transcript data or error message

Example:
    python3 fetch_transcript.py dQw4w9WgXcQ "en,es"
"""

import sys
import json
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound

def fetch_transcript(video_id, languages):
    """
    Fetch transcript for a YouTube video.
    
    Args:
        video_id: YouTube video ID
        languages: List of language codes in priority order
        
    Returns:
        JSON output with transcript data or error
    """
    try:
        ytt_api = YouTubeTranscriptApi()
        
        # 1. Retrieve the list of available transcripts
        transcript_list = ytt_api.list(video_id)
        
        try:
            # 2. Try to find a manually created or generated transcript matching language priorities
            transcript = transcript_list.find_transcript(languages)
            
        except NoTranscriptFound:
            # 3. Fallback: Translate the first available transcript to the highest priority language
            target_lang = languages[0]
            
            # Find any translatable transcript as the source
            source_transcript = None
            for t in transcript_list:
                if t.is_translatable:
                    source_transcript = t
                    break
                    
            if source_transcript:
                transcript = source_transcript.translate(target_lang)
            else:
                raise NoTranscriptFound()
                
        # 4. Fetch the snippet objects
        fetched = transcript.fetch()
        
        # 5. Export directly to raw array of dictionaries as documented
        if hasattr(fetched, 'to_raw_data'):
            raw_data = fetched.to_raw_data()
        else:
            raw_data = fetched
            
        # Fallback safeguard map just in case an older library version returns objects
        if raw_data and not isinstance(raw_data[0], dict) and hasattr(raw_data[0], 'text'):
            raw_data = [{"text": s.text, "start": s.start, "duration": s.duration} for s in raw_data]

        # Output successful JSON array
        print(json.dumps({
            "success": True,
            "data": raw_data
        }))
        
    except NoTranscriptFound:
        print(json.dumps({
            "success": False,
            "error": f"No transcript found or translatable for requested languages: {languages}"
        }))
        
    except TranscriptsDisabled:
         print(json.dumps({
            "success": False,
            "error": "Transcripts are disabled for this video."
        }))
        
    except Exception as e:
        # Output clean error JSON if fetching fails (blocked, etc.)
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No video ID provided"}))
        sys.exit(1)
        
    video_id = sys.argv[1]
    
    # Parse comma-separated languages or default to English/Hindi
    if len(sys.argv) > 2 and sys.argv[2]:
        languages = [lang.strip() for lang in sys.argv[2].split(',')]
    else:
        languages = ['en', 'hi', 'en-US', 'en-GB']
        
    fetch_transcript(video_id, languages)
