'use client';

import React, { useRef, useEffect, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  ChevronDown,
  Maximize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/store/editorStore';
import { formatTime, aspectRatioDimensions, type AspectRatio } from '@/types/editor';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import FloatingToolbar from './FloatingToolbar';

const aspectRatios: { value: AspectRatio; label: string }[] = [
  { value: '16:9', label: '16:9 (Landscape)' },
  { value: '9:16', label: '9:16 (Portrait)' },
  { value: '1:1', label: '1:1 (Square)' },
  { value: '4:5', label: '4:5 (Instagram)' },
  { value: '21:9', label: '21:9 (Ultrawide)' },
];

export default function PreviewCanvas() {
  const {
    currentTime,
    duration,
    isPlaying,
    volume,
    tracks,
    mediaLibrary,
    aspectRatio,
    isFullscreen,
    selectedClipId,
    getClipById,
    setCurrentTime,
    togglePlay,
    setVolume,
    setAspectRatio,
    setFullscreen,
  } = useEditorStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const [isMuted, setIsMuted] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 640, height: 360 });

  const selectedClip = selectedClipId ? getClipById(selectedClipId) : null;

  // Update canvas size based on container and aspect ratio
  useEffect(() => {
    const updateCanvasSize = () => {
      if (!containerRef.current) return;
      
      const container = containerRef.current;
      const containerWidth = container.clientWidth - 32;
      const containerHeight = container.clientHeight - 100;
      
      const dims = aspectRatioDimensions[aspectRatio];
      const aspectRatioValue = dims.width / dims.height;
      
      let width = containerWidth;
      let height = width / aspectRatioValue;
      
      if (height > containerHeight) {
        height = containerHeight;
        width = height * aspectRatioValue;
      }
      
      setCanvasSize({ width: Math.floor(width), height: Math.floor(height) });
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [aspectRatio]);

  // Playback loop
  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      
      const animate = (timestamp: number) => {
        const delta = (timestamp - lastTimeRef.current) / 1000;
        lastTimeRef.current = timestamp;
        
        const state = useEditorStore.getState();
        const newTime = state.currentTime + delta;
        
        if (newTime >= state.duration) {
          useEditorStore.getState().setCurrentTime(0);
        } else {
          useEditorStore.getState().setCurrentTime(newTime);
        }
        
        animationRef.current = requestAnimationFrame(animate);
      };
      
      animationRef.current = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  // Draw on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dims = aspectRatioDimensions[aspectRatio];
    
    // Set canvas resolution (higher for quality)
    const scale = 2;
    canvas.width = dims.width / 4;
    canvas.height = dims.height / 4;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Find active clips at current time
    const activeClips = tracks.flatMap(track =>
      track.clips.filter(clip =>
        currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration
      ).map(clip => ({ clip, track }))
    );

    // Sort by track type (overlay on top)
    const trackOrder = { overlay: 0, video: 1, audio: 2 };
    const sortedClips = activeClips.sort((a, b) => {
      return (trackOrder[a.track.type] ?? 2) - (trackOrder[b.track.type] ?? 2);
    });

    // Draw clips
    sortedClips.forEach(({ clip, track }) => {
      const media = mediaLibrary.find(m => m.id === clip.mediaId);
      if (!media) return;

      const transform = clip.transform;
      const clipProgress = (currentTime - clip.startTime) / clip.duration;

      // Calculate fade opacity
      let opacity = transform?.opacity ?? 1;
      if (clip.fadeIn > 0 && clipProgress < clip.fadeIn / clip.duration) {
        opacity *= clipProgress / (clip.fadeIn / clip.duration);
      }
      if (clip.fadeOut > 0 && clipProgress > 1 - clip.fadeOut / clip.duration) {
        opacity *= (1 - clipProgress) / (clip.fadeOut / clip.duration);
      }

      ctx.save();
      ctx.globalAlpha = opacity;

      // Apply transforms
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      ctx.translate(centerX, centerY);
      ctx.rotate((transform?.rotation ?? 0) * Math.PI / 180);
      if (transform?.flipH) ctx.scale(-1, 1);
      if (transform?.flipV) ctx.scale(1, -1);
      ctx.translate(-centerX, -centerY);

      // Draw based on media type
      if (media.type === 'video') {
        // Video gradient background
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#7c3aed');
        gradient.addColorStop(0.5, '#8b5cf6');
        gradient.addColorStop(1, '#4c1d95');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Play icon
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2 - 40, canvas.height / 2 - 40);
        ctx.lineTo(canvas.width / 2 - 40, canvas.height / 2 + 40);
        ctx.lineTo(canvas.width / 2 + 40, canvas.height / 2);
        ctx.closePath();
        ctx.fill();

        // Media name
        ctx.fillStyle = 'white';
        ctx.font = 'bold 28px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(media.name, canvas.width / 2, canvas.height / 2 + 80);

        // Time indicator
        const clipTime = currentTime - clip.startTime;
        ctx.font = '20px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(`${clipTime.toFixed(1)}s / ${clip.duration.toFixed(1)}s`, canvas.width / 2, canvas.height / 2 - 80);
        
        // Progress bar
        const progress = clipTime / clip.duration;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(50, canvas.height - 40, canvas.width - 100, 4);
        ctx.fillStyle = '#a855f7';
        ctx.fillRect(50, canvas.height - 40, (canvas.width - 100) * progress, 4);

      } else if (media.type === 'image') {
        // Image gradient
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#2563eb');
        gradient.addColorStop(0.5, '#3b82f6');
        gradient.addColorStop(1, '#1d4ed8');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Image icon
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 3;
        ctx.strokeRect(canvas.width / 2 - 60, canvas.height / 2 - 45, 120, 90);

        // Mountain
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2 - 45, canvas.height / 2 + 30);
        ctx.lineTo(canvas.width / 2 - 15, canvas.height / 2 - 15);
        ctx.lineTo(canvas.width / 2 + 25, canvas.height / 2 + 15);
        ctx.lineTo(canvas.width / 2 + 45, canvas.height / 2);
        ctx.lineTo(canvas.width / 2 + 45, canvas.height / 2 + 35);
        ctx.lineTo(canvas.width / 2 - 45, canvas.height / 2 + 35);
        ctx.fill();

        // Sun
        ctx.beginPath();
        ctx.arc(canvas.width / 2 + 30, canvas.height / 2 - 20, 15, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 200, 100, 0.5)';
        ctx.fill();

        // Name
        ctx.fillStyle = 'white';
        ctx.font = 'bold 28px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(media.name, canvas.width / 2, canvas.height / 2 + 80);

      } else if (media.type === 'audio') {
        // Audio visualization
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#059669');
        gradient.addColorStop(0.5, '#10b981');
        gradient.addColorStop(1, '#047857');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Waveform
        const barCount = 50;
        const barWidth = (canvas.width - 80) / barCount;
        const clipTime = currentTime - clip.startTime;
        
        for (let i = 0; i < barCount; i++) {
          const progress = i / barCount;
          const timeOffset = clipTime * 3 + progress * Math.PI * 6;
          const height = (Math.sin(timeOffset) * 0.5 + 0.5) * 120 + 20;
          
          ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + Math.sin(timeOffset) * 0.2})`;
          ctx.fillRect(
            40 + i * barWidth,
            canvas.height / 2 - height / 2,
            barWidth - 2,
            height
          );
        }

        // Music icon
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = 'bold 60px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('♪', canvas.width / 2, canvas.height / 2 - 60);

        // Name
        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px system-ui, sans-serif';
        ctx.fillText(media.name, canvas.width / 2, canvas.height / 2 + 100);
      }

      ctx.restore();
    });

    // No clips message
    if (activeClips.length === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Add media to the timeline to preview', canvas.width / 2, canvas.height / 2);
      
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillText('Drag media from the left panel to the timeline below', canvas.width / 2, canvas.height / 2 + 30);
    }

    // Timecode overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    const timecodeWidth = 120;
    ctx.fillRect(canvas.width - timecodeWidth - 10, 10, timecodeWidth, 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatTime(currentTime), canvas.width - 20, 22);

    // Selection indicator
    if (selectedClip && activeClips.some(ac => ac.clip.id === selectedClip.id)) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    }

  }, [currentTime, tracks, mediaLibrary, aspectRatio, selectedClip]);

  const skipFrames = (frames: number) => {
    setCurrentTime(Math.max(0, Math.min(duration, currentTime + frames / 30)));
  };

  const handleSeek = (value: number[]) => setCurrentTime(value[0]);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!isFullscreen) {
        await containerRef.current.requestFullscreen();
        setFullscreen(true);
      } else {
        await document.exitFullscreen();
        setFullscreen(false);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    setVolume(isMuted ? 1 : 0);
  };

  const getCanvasAspectRatio = () => {
    const dims = aspectRatioDimensions[aspectRatio];
    return dims.width / dims.height;
  };

  return (
    <div ref={containerRef} className="h-full flex flex-col bg-gray-950">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900/80 border-b border-gray-800 flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-white hover:bg-gray-700">
              <span>Aspect ratio: {aspectRatio}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-gray-800 border-gray-700">
            {aspectRatios.map((ratio) => (
              <DropdownMenuItem
                key={ratio.value}
                onClick={() => setAspectRatio(ratio.value)}
                className={cn('text-white', aspectRatio === ratio.value && 'bg-purple-600')}
              >
                {ratio.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="text-sm text-gray-400 font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Canvas Preview */}
      <div ref={containerRef} className="flex-1 flex flex-col items-center justify-center p-4 relative gap-3 min-h-0 overflow-hidden">
        {/* Floating Toolbar */}
        <div className="absolute top-2 z-10">
          <FloatingToolbar />
        </div>

        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full rounded-lg shadow-2xl bg-black object-contain"
          style={{ 
            width: canvasSize.width,
            height: canvasSize.height,
          }}
        />

        {/* Selected clip info */}
        {selectedClip && (
          <div className="absolute bottom-16 left-4 px-3 py-2 bg-gray-800/90 backdrop-blur-sm rounded-lg border border-gray-700">
            <p className="text-sm text-white font-medium">
              {mediaLibrary.find(m => m.id === selectedClip.mediaId)?.name}
            </p>
            <p className="text-xs text-gray-400">
              Duration: {selectedClip.duration.toFixed(1)}s | Position: {selectedClip.startTime.toFixed(1)}s
            </p>
          </div>
        )}
      </div>

      {/* Playback Controls */}
      <div className="bg-gray-900 border-t border-gray-800 p-3 flex-shrink-0">
        {/* Seek Bar */}
        <div className="mb-3">
          <Slider
            value={[currentTime]}
            max={duration}
            step={0.01}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between">
          {/* Left controls */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => skipFrames(-1)} className="text-white hover:bg-gray-700 w-8 h-8" title="Previous frame">
              <SkipBack className="w-4 h-4" />
            </Button>
          </div>

          {/* Center - Play/Pause */}
          <Button size="icon" onClick={togglePlay} className="w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-700 text-white">
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </Button>

          {/* Right controls */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => skipFrames(1)} className="text-white hover:bg-gray-700 w-8 h-8" title="Next frame">
              <SkipForward className="w-4 h-4" />
            </Button>
            <div className="w-px h-4 bg-gray-700 mx-1" />
            <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white hover:bg-gray-700 w-8 h-8" title={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white hover:bg-gray-700 w-8 h-8" title="Fullscreen">
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
