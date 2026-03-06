'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward,
  Maximize, Minimize, Volume2, VolumeX, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/store/editorStore';
import { formatTime, aspectRatioDimensions, type AspectRatio } from '@/types/editor';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import FloatingToolbar from './FloatingToolbar';

const aspectRatios: { value: AspectRatio; label: string }[] = [
  { value: '16:9', label: '16:9 (Landscape)' },
  { value: '9:16', label: '9:16 (Portrait)' },
  { value: '1:1', label: '1:1 (Square)' },
  { value: '4:5', label: '4:5 (Instagram)' },
  { value: '21:9', label: '21:9 (Ultrawide)' },
];

// ----------------------------------------------------------------------
// Single layer renderer for one active clip
// ----------------------------------------------------------------------
function ClipLayer({ clip, media, currentTime, isPlaying, isTop, trackMuted, globalVolume }: {
  clip: any; media: any; currentTime: number; isPlaying: boolean; isTop: boolean; trackMuted: boolean; globalVolume: number;
}) {
  const mediaRef = useRef<HTMLMediaElement>(null);
  const clipTime = currentTime - clip.startTime;

  // Sync video time when currentTime changes
  useEffect(() => {
    const el = mediaRef.current;
    if (!el || (media.type !== 'video' && media.type !== 'audio')) return;

    // If playing, let the video run naturally but correct it if it drifts too far
    // If paused, always sync the frame exactly so scrubbing works flawlessly
    if (!isPlaying) {
      el.currentTime = Math.max(0, clipTime);
    } else if (Math.abs(el.currentTime - clipTime) > 0.3) {
      el.currentTime = Math.max(0, clipTime);
    }
  }, [clipTime, media.type, isPlaying]);

  // Sync play/pause
  useEffect(() => {
    const el = mediaRef.current;
    if (!el || (media.type !== 'video' && media.type !== 'audio')) return;
    if (isPlaying) {
      el.play().catch(() => { });
    } else {
      el.pause();
    }
  }, [isPlaying, media.type]);

  // Sync Volume and Speed with Fade Interpolation
  useEffect(() => {
    const el = mediaRef.current;
    if (!el || (media.type !== 'video' && media.type !== 'audio')) return;

    // Calculate fade for volume
    let currentVolume = clip.volume ?? 1;
    const fadeIn = clip.fadeIn || 0;
    const fadeOut = clip.fadeOut || 0;
    if (fadeIn > 0 && clipTime < fadeIn) {
      currentVolume *= Math.max(0, clipTime / fadeIn);
    } else if (fadeOut > 0 && clip.duration - clipTime < fadeOut) {
      currentVolume *= Math.max(0, (clip.duration - clipTime) / fadeOut);
    }

    el.muted = trackMuted;
    el.volume = Math.max(0, Math.min(1, globalVolume * currentVolume));
    el.playbackRate = clip.speed ?? 1;
  }, [trackMuted, globalVolume, clip.volume, clip.speed, clip.fadeIn, clip.fadeOut, clip.duration, clipTime, media.type]);

  let opacity = clip.transform?.opacity ?? 1;
  const fadeIn = clip.fadeIn || 0;
  const fadeOut = clip.fadeOut || 0;
  if (fadeIn > 0 && clipTime < fadeIn) {
    opacity *= Math.max(0, clipTime / fadeIn);
  } else if (fadeOut > 0 && clip.duration - clipTime < fadeOut) {
    opacity *= Math.max(0, (clip.duration - clipTime) / fadeOut);
  }
  const fit = clip.transform?.fit ?? true;
  const rotation = clip.transform?.rotation ?? 0;
  const scale = clip.transform?.scale ?? 1;
  const flipH = clip.transform?.flipH ? -1 : 1;
  const flipV = clip.transform?.flipV ? -1 : 1;
  const posX = clip.transform?.positionX ?? 0;
  const posY = clip.transform?.positionY ?? 0;

  let cssFilter = '';

  // Apply Color Grading
  if (clip.colorGrade) {
    const brightness = 1 + (clip.colorGrade.exposure || 0) / 100;
    const contrast = 1 + (clip.colorGrade.contrast || 0) / 100;
    const saturate = 1 + (clip.colorGrade.saturation || 0) / 100;
    const sepia = clip.colorGrade.temperature && clip.colorGrade.temperature > 0 ? clip.colorGrade.temperature / 100 : 0;
    const hueRotate = clip.colorGrade.temperature && clip.colorGrade.temperature < 0 ? clip.colorGrade.temperature / 2 : 0;

    if (brightness !== 1) cssFilter += `brightness(${brightness}) `;
    if (contrast !== 1) cssFilter += `contrast(${contrast}) `;
    if (saturate !== 1) cssFilter += `saturate(${saturate}) `;
    if (sepia > 0) cssFilter += `sepia(${sepia}) `;
    if (hueRotate !== 0) cssFilter += `hue-rotate(${hueRotate}deg) `;
  }

  // Apply Filter Presets
  if (clip.filter) {
    switch (clip.filter) {
      case 'cinematic': cssFilter += 'contrast(1.2) saturate(1.1) brightness(0.9) '; break;
      case 'warm': cssFilter += 'sepia(0.3) saturate(1.2) '; break;
      case 'cool': cssFilter += 'hue-rotate(15deg) saturate(0.9) '; break;
      case 'vintage': cssFilter += 'sepia(0.4) contrast(1.1) brightness(0.9) '; break;
      case 'noir': cssFilter += 'grayscale(1) contrast(1.2) brightness(0.9) '; break;
      case 'vibrant': cssFilter += 'saturate(1.5) contrast(1.1) '; break;
      case 'muted': cssFilter += 'saturate(0.5) contrast(0.9) '; break;
      case 'teal': cssFilter += 'hue-rotate(-15deg) saturate(1.2) contrast(1.1) '; break;
      case 'dramatic': cssFilter += 'contrast(1.4) brightness(0.8) saturate(0.8) '; break;
      case 'retro': cssFilter += 'sepia(0.2) saturate(1.4) hue-rotate(-10deg) '; break;
      case 'neon': cssFilter += 'saturate(2) contrast(1.2) brightness(1.1) hue-rotate(10deg) '; break;
    }
  }

  const style: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: fit ? 'contain' : 'cover',
    opacity,
    transform: `translate(${posX}px, ${posY}px) rotate(${rotation}deg) scale(${scale * flipH}, ${scale * flipV})`,
    filter: cssFilter.trim() || undefined,
  };

  if (media.type === 'video') {
    if (!media.src) {
      return (
        <img
          src={media.thumbnail}
          alt={media.name}
          style={style}
          className="absolute inset-0 w-full h-full object-contain"
        />
      );
    }
    return (
      <video
        ref={mediaRef as React.RefObject<HTMLVideoElement>}
        src={media.src}
        style={style}
        playsInline
        preload="auto"
        onLoadedMetadata={(e) => {
          (e.target as HTMLVideoElement).currentTime = Math.max(0, clipTime);
        }}
        className="absolute inset-0 w-full h-full object-contain"
      />
    );
  }

  if (media.type === 'image') {
    return (
      <img
        src={media.src || media.thumbnail}
        alt={media.name}
        style={style}
        className="absolute inset-0 w-full h-full object-contain"
      />
    );
  }

  // Audio - show hidden audio tag
  if (media.type === 'audio') {
    return (
      <audio
        ref={mediaRef as React.RefObject<HTMLAudioElement>}
        src={media.src}
        preload="auto"
        onLoadedMetadata={(e) => {
          (e.target as HTMLAudioElement).currentTime = Math.max(0, clipTime);
        }}
        className="hidden"
      />
    );
  }

  return null;
}

// ----------------------------------------------------------------------
// Empty state message
// ----------------------------------------------------------------------
function EmptyState() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
      <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-2">
        <Play className="w-8 h-8 text-gray-600 ml-1" />
      </div>
      <p className="text-gray-400 text-sm">Add media to the timeline to preview</p>
      <p className="text-gray-600 text-xs">Drag media from the left panel to the timeline below</p>
    </div>
  );
}

// ----------------------------------------------------------------------
// Main PreviewCanvas
// ----------------------------------------------------------------------
export default function PreviewCanvas() {
  const {
    currentTime, duration, isPlaying, volume, tracks, mediaLibrary,
    aspectRatio, isFullscreen, selectedClipId, getClipById,
    setCurrentTime, togglePlay, setVolume, setAspectRatio, setFullscreen,
  } = useEditorStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
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
      const cw = container.clientWidth - 32;
      const ch = container.clientHeight - 80;
      const dims = aspectRatioDimensions[aspectRatio];
      const ar = dims.width / dims.height;
      let w = cw;
      let h = w / ar;
      if (h > ch) { h = ch; w = h * ar; }
      setCanvasSize({ width: Math.floor(w), height: Math.floor(h) });
    };
    updateCanvasSize();
    const ro = new ResizeObserver(updateCanvasSize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [aspectRatio]);

  // Playback animation loop
  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      const animate = (ts: number) => {
        const delta = (ts - lastTimeRef.current) / 1000;
        lastTimeRef.current = ts;
        const state = useEditorStore.getState();
        const nt = state.currentTime + delta;
        if (nt >= state.duration) {
          useEditorStore.getState().setCurrentTime(0);
          useEditorStore.getState().pause();
        } else {
          useEditorStore.getState().setCurrentTime(nt);
        }
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    }
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isPlaying]);


  // Get active clips sorted by layer (overlay on top)
  const activeClips = tracks.flatMap(track =>
    track.clips
      .filter(clip => currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration)
      .map(clip => ({ clip, track }))
  ).sort((a, b) => {
    const order: Record<string, number> = { video: 0, audio: 1, overlay: 2 };
    return (order[a.track.type] ?? 0) - (order[b.track.type] ?? 0);
  });

  const skipFrames = (frames: number) => setCurrentTime(Math.max(0, Math.min(duration, currentTime + frames / 30)));
  const handleSeek = (value: number[]) => setCurrentTime(value[0]);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!isFullscreen) { await containerRef.current.requestFullscreen(); setFullscreen(true); }
      else { await document.exitFullscreen(); setFullscreen(false); }
    } catch { }
  };

  const toggleMute = () => { setIsMuted(!isMuted); setVolume(isMuted ? 1 : 0); };

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
        <div className="flex-1 flex justify-center px-4">
          <FloatingToolbar />
        </div>

        <div className="text-sm text-gray-400 font-mono whitespace-nowrap">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Preview area */}
      <div ref={containerRef as any} className="flex-1 flex items-center justify-center p-4 relative min-h-0 overflow-hidden bg-gray-950">

        {/* Preview frame with checkerboard background */}
        <div
          ref={previewRef}
          style={{
            width: canvasSize.width,
            height: canvasSize.height,
            position: 'relative',
            borderRadius: 8,
            overflow: 'hidden',
            backgroundColor: '#000',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.9)',
            backgroundImage: `repeating-conic-gradient(#111 0% 25%, #0a0a0a 0% 50%)`,
            backgroundSize: '20px 20px',
          }}
        >
          {/* Render each active clip as a layer */}
          {activeClips.map(({ clip, track }, i) => {
            const media = mediaLibrary.find(m => m.id === clip.mediaId);
            if (!media) return null;
            return (
              <ClipLayer
                key={clip.id}
                clip={clip}
                media={media}
                currentTime={currentTime}
                isPlaying={isPlaying}
                isTop={i === activeClips.length - 1}
                trackMuted={track.muted}
                globalVolume={isMuted ? 0 : volume}
              />
            );
          })}

          {/* Empty state */}
          {activeClips.length === 0 && <EmptyState />}

          {/* Selection border */}
          {selectedClip && activeClips.some(ac => ac.clip.id === selectedClip.id) && (
            <div className="absolute inset-0 border-2 border-green-500 pointer-events-none rounded-lg" />
          )}

          {/* Timecode */}
          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 rounded text-xs font-mono text-white">
            {formatTime(currentTime)}
          </div>
        </div>

        {/* Selected clip info */}
        {selectedClip && (
          <div className="absolute bottom-4 left-4 px-3 py-2 bg-gray-800/90 backdrop-blur-sm rounded-lg border border-gray-700">
            <p className="text-sm text-white font-medium">
              {mediaLibrary.find(m => m.id === selectedClip.mediaId)?.name}
            </p>
            <p className="text-xs text-gray-400">
              Duration: {selectedClip.duration.toFixed(1)}s | Position: {selectedClip.startTime.toFixed(1)}s
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-900 border-t border-gray-800 px-3 py-1.5 flex items-center gap-4 flex-shrink-0 h-10">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => skipFrames(-1)} className="text-white hover:bg-gray-700 w-6 h-6" title="Previous frame">
            <SkipBack className="w-3 h-3" />
          </Button>
          <Button size="icon" onClick={togglePlay} className="w-7 h-7 rounded-sm bg-purple-600 hover:bg-purple-700 text-white">
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => skipFrames(1)} className="text-white hover:bg-gray-700 w-6 h-6" title="Next frame">
            <SkipForward className="w-3 h-3" />
          </Button>
        </div>

        <div className="flex-1 flex items-center h-full">
          <Slider value={[currentTime]} max={duration} step={0.01} onValueChange={handleSeek} className="cursor-pointer" />
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white hover:bg-gray-700 w-6 h-6">
            {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white hover:bg-gray-700 w-6 h-6">
            {isFullscreen ? <Minimize className="w-3 h-3" /> : <Maximize className="w-3 h-3" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
