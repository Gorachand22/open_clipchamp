# Product Promo Video Skill

## Purpose
Create professional product promotional videos from product images or descriptions, optimized for social media advertising.

## Prerequisites
- Product images or description available
- Optional: brand guidelines

## Workflow

### Step 1: Gather Assets
If images provided:
- Load from input folder
- Ensure high quality (min 1080p)

If description only:
- Call `generate_image` to create product visuals
- Use professional product photography style

### Step 2: Create Script
Generate promotional script using AI:
- Attention-grabbing opening
- Key product benefits (3-5 points)
- Call to action

### Step 3: Generate Voiceover
Call `text_to_speech` with:
- `text`: Generated script
- `voiceId`: Professional voice
- `speed`: 1.0

### Step 4: Generate Video
Option A - Product Showcase:
- Call `generate_video` with:
  - `imageUrl`: Product image
  - `prompt`: "Professional product showcase video, elegant rotation, soft lighting"
  - `duration`: 5 or 10

Option B - Lifestyle Video:
- Call `generate_video` with:
  - `prompt`: "Product in use, lifestyle setting, professional cinematography"
  - `size`: "768x1344" (for vertical video)

### Step 5: Add Text Overlays
- Product name as title
- Key features as bullet points
- Price and CTA
- Add captions for accessibility

### Step 6: Add Music
- Select background music matching brand tone
- Mix levels: voiceover -6dB, music -18dB

## Example Prompt
```
Create a 30-second promotional video for my new wireless earbuds. Use the product image from input folder and highlight: 24-hour battery life, noise cancellation, and waterproof design.
```

## Notes
- Vertical format (9:16) works best for social media ads
- Keep videos under 60 seconds for optimal engagement
- Include clear CTA in final 3 seconds
- Ensure brand colors are consistent
- Add captions (85% of social videos are watched muted)

## Output Format
```json
{
  "success": true,
  "product": {
    "name": "Product Name",
    "features": ["Feature 1", "Feature 2", "Feature 3"]
  },
  "video": {
    "duration": 30,
    "format": "9:16",
    "file": "/output/product_promo.mp4",
    "url": "/api/files/output/product_promo.mp4"
  },
  "assets": {
    "images": ["/output/product_shot_1.png"],
    "voiceover": "/output/voiceover.wav",
    "music": "/output/background_music.mp3"
  }
}
```

## Platform Optimizations

### TikTok/Reels
- Duration: 15-60 seconds
- Format: 9:16 (1080x1920)
- Hook in first 3 seconds
- Native feel, less polished

### YouTube Shorts
- Duration: Up to 60 seconds
- Format: 9:16
- Strong thumbnail moment
- Clear audio

### Twitter/X
- Duration: 30-45 seconds
- Format: 1:1 or 16:9
- Auto-play optimized
- Subtitles required

### Instagram Feed
- Duration: 30-60 seconds
- Format: 1:1 or 4:5
- High production value
- Brand-forward