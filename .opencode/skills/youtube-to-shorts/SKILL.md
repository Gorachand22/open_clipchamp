\# YouTube to Shorts Skill



\## Purpose

Convert a YouTube video into multiple TikTok/Reels/Shorts format videos with AI-powered clip selection, reframing, and captioning.



\## Prerequisites

\- yt-dlp installed (`pip install yt-dlp`)

\- ffmpeg installed (`brew install ffmpeg` or `apt install ffmpeg`)

\- youtube-transcript-api (`pip install youtube-transcript-api`)



\## Workflow



\### Step 1: Download YouTube Video

Call `download\_youtube` tool with:

\- `url`: The YouTube video URL

\- `separateAudio`: true

\- `subtitleLanguage`: \['en'] or preferred languages



Returns:

\- `video.path`: Path to downloaded video

\- `audio.path`: Path to audio track

\- `transcript.data`: Array of transcript segments



\### Step 2: Analyze and Find Best Clips

Call `find\_best\_clips` tool with:

\- `videoPath`: Output from step 1

\- `count`: 5 (number of clips to find)

\- `minDuration`: 15 (seconds)

\- `maxDuration`: 60 (seconds)



Returns:

\- `clips`: Array of {start, end, score, reason}



\### Step 3: For Each Clip

For each clip found:



\#### 3a. Trim the Clip

Call `trim\_clip` tool with:

\- `videoPath`: Original video path

\- `start`: Clip start time

\- `end`: Clip end time



Returns:

\- `video.path`: Path to trimmed clip



\#### 3b. Reframe to 9:16

Call `reframe\_9\_16` tool with:

\- `videoPath`: Output from trim

\- `mode`: "center" or "face\_track"

\- `resolution`: "1080x1920"



Returns:

\- `video.path`: Path to reframed clip



\#### 3c. Add Captions

Call `add\_captions` tool with:

\- `videoPath`: Output from reframe

\- `transcript`: Filtered transcript segments for this clip

\- `style`: "cinematic"

\- `fontSize`: 24

\- `color`: "white"



Returns:

\- `video.path`: Final clip with captions



\### Step 4: Return Results

Return all processed clips with their file paths and URLs.



\## Example Prompt

```

Convert this YouTube video https://youtube.com/watch?v=dQw4w9WgXcQ to 5 TikTok shorts with cinematic captions

```



\## Notes

\- Always use cinematic caption style for maximum engagement

\- Target 15-60 second clips for optimal TikTok/Reels performance

\- If face\_track mode fails, fall back to center crop

\- Use transcript filtering to only show relevant subtitles for each clip

\- Consider audio levels when adding music tracks



\## Output Format

```json

{

&nbsp; "success": true,

&nbsp; "clips": \[

&nbsp;   {

&nbsp;     "index": 1,

&nbsp;     "originalStart": 45.2,

&nbsp;     "originalEnd": 75.5,

&nbsp;     "duration": 30.3,

&nbsp;     "file": "/output/shorts\_clip\_1.mp4",

&nbsp;     "url": "/api/files/output/shorts\_clip\_1.mp4"

&nbsp;   }

&nbsp; ]

}

```



\## Error Handling

\- If YouTube download fails, check if video is age-restricted or private

\- If transcript fails, still proceed with clip creation but skip captioning

\- If reframing fails, try center crop as fallback

