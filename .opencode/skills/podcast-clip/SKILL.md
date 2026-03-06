# Podcast Clip Extraction Skill

## Purpose
Extract the most engaging clips from a podcast or long-form video content, add captions, and prepare for social media sharing.

## Prerequisites
- ffmpeg installed
- whisper or youtube-transcript-api for transcription

## Workflow

### Step 1: Import Video/Audio
If YouTube:
- Call `download_youtube` with URL

If local file:
- Use the video directly from input folder

### Step 2: Get Transcript
If not already available:
- Call `get_transcript` for YouTube videos
- Or use local transcription

### Step 3: Find Highlight Moments
Call `find_best_clips` with:
- `videoPath`: Source video
- `count`: 3-5 clips
- `minDuration`: 30 (podcasts benefit from longer clips)
- `maxDuration`: 120 (2 minutes max)
- `transcript`: Full transcript for context

AI Analysis considerations:
- Look for emotional moments (laughter, surprise)
- Find quotable statements
- Identify story climaxes
- Detect high-energy segments

### Step 4: Process Each Clip
For each highlight:

#### 4a. Trim with Context
- Add 2-3 seconds before and after the key moment
- Ensure context is preserved

#### 4b. Reframe
- Use 9:16 for TikTok/Reels
- Use 1:1 for Twitter/X
- Use 16:9 for YouTube Shorts

#### 4c. Add Captions
- Style: "minimal" or "highlight"
- Highlight key words in different color
- Ensure readability on small screens

### Step 5: Add Intro/Outro (Optional)
If brand assets available:
- Add branded intro frame
- Add call-to-action outro

## Example Prompt
```
Extract 4 highlight clips from this podcast episode https://youtube.com/watch?v=example and format them for Twitter
```

## Notes
- Podcast clips benefit from longer duration (30-120s)
- Preserve speaker context - don't cut mid-sentence
- Highlight key quotes with different caption colors
- Consider adding speaker names as lower-third graphics
- Audio quality matters - consider noise reduction

## Output Format
```json
{
  "success": true,
  "source": {
    "title": "Podcast Episode Title",
    "duration": 3600,
    "speakers": ["Host", "Guest"]
  },
  "clips": [
    {
      "index": 1,
      "title": "Key Insight About X",
      "timestamp": "12:45",
      "duration": 45,
      "file": "/output/podcast_clip_1.mp4",
      "transcript": "The key insight is..."
    }
  ]
}
```