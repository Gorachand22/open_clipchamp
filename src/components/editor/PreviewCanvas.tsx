'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward,
  Maximize, Minimize, Volume2, VolumeX, ChevronDown, RotateCw
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
  const textRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);

  const clipTime = currentTime - clip.startTime;
  const isSelected = useEditorStore(state => state.selectedClipId) === clip.id;

  // Exit edit mode if deselected
  useEffect(() => {
    if (!isSelected) setIsEditing(false);
  }, [isSelected]);

  // Sync text content to DOM when not actively focused (avoids caret jumping)
  useEffect(() => {
    if (media.id.startsWith('text-') || media.type === 'caption') {
      let currentText = clip.text?.text || media.name || 'Text';
      if (media.type === 'caption' && media.captions) {
        const currentCaptionLine = media.captions.find((c: any) => clipTime >= c.startTime && clipTime <= c.endTime);
        if (currentCaptionLine) {
          currentText = currentCaptionLine.text;
        } else {
          currentText = isSelected ? '(No Subtitle Active Here)' : '';
        }
      }

      if (textRef.current && !isEditing) {
        if (textRef.current.innerHTML !== currentText) {
          textRef.current.innerHTML = currentText;
        }
      }
    }
  }, [clip.text?.text, media.id, isEditing, media.type, media.captions, clipTime, isSelected]);

  // F2 local listener
  useEffect(() => {
    if (!isSelected || !media.id.startsWith('text-')) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable) ||
        (e.target instanceof Element && e.target.closest('[contenteditable="true"]')) ||
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) return;

      if (e.key === 'F2') {
        e.preventDefault();
        setIsEditing(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelected, media.id]);

  // Focus and select all when entering edit mode
  useEffect(() => {
    if (isEditing && textRef.current) {
      textRef.current.focus();
      // Only select all if it's the first time they enter edit mode and didn't manually place cursor
      if (document.activeElement === textRef.current) {
        window.getSelection()?.selectAllChildren(textRef.current);
      }
    }
  }, [isEditing]);

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
  } else if (fadeOut > 0 && clipTime >= clip.duration - fadeOut && clipTime < clip.duration) {
    opacity *= Math.max(0, (clip.duration - clipTime) / fadeOut);
  }

  // Artificial fade out if lingering for a transition overlap
  if (clipTime >= clip.duration) {
    const overTime = clipTime - clip.duration;
    // We pass transitionLinger via clip object dynamically augmented below
    if (clip._lingerDuration) {
      opacity *= Math.max(0, 1 - (overTime / clip._lingerDuration));
    } else {
      opacity = 0;
    }
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

  if (media.id.startsWith('text-') || media.type === 'caption') {
    let textContent = clip.text?.text || 'Text';

    // Override static text content if it's an SRT parsed caption file
    if (media.type === 'caption' && media.captions) {
      const currentCaptionLine = media.captions.find((c: any) => clipTime >= c.startTime && clipTime <= c.endTime);
      if (currentCaptionLine) {
        textContent = currentCaptionLine.text;
      } else {
        // If empty space between SRT subtitles, hide it entirely unless selected
        if (!isSelected) return null;
        textContent = '(No Subtitle Active Here)';
      }
    }
    const fontSize = clip.text?.fontSize || 60;
    const fontFamily = clip.text?.fontFamily || 'Inter, sans-serif';
    const color = clip.text?.color || '#FFFFFF';
    const bgColor = clip.text?.backgroundColor || 'transparent';
    const fontWeight = clip.text?.fontWeight || 'bold';

    const updateTransform = useEditorStore.getState().updateClipTransform;

    const handlePointerDown = (e: React.PointerEvent, action: string, origin?: string) => {
      if (!isSelected) return;
      e.stopPropagation();
      if (action !== 'move') {
        e.preventDefault();
      }

      const startX = e.clientX;
      const startY = e.clientY;
      const startPosX = clip.transform?.positionX ?? 0;
      const startPosY = clip.transform?.positionY ?? 0;
      const startScale = clip.transform?.scale ?? 1;
      const startRot = clip.transform?.rotation ?? 0;

      const containerBounds = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
      const rect = e.currentTarget.parentElement?.getBoundingClientRect();

      const centerX = rect ? rect.left + rect.width / 2 : 0;
      const centerY = rect ? rect.height / 2 + rect.top : 0;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (action === 'move') {
          const dx = moveEvent.clientX - startX;
          const dy = moveEvent.clientY - startY;
          updateTransform(clip.id, {
            positionX: startPosX + dx,
            positionY: startPosY + dy,
          });
        } else if (action === 'scale') {
          const dx = moveEvent.clientX - startX;
          const dy = moveEvent.clientY - startY;
          // Basic scaling based on y-movement logic
          const dist = Math.sqrt(dx * dx + dy * dy);
          let scaleChange = dist / 200; // arbitrary scale factor
          if (origin === 'nw' || origin === 'w') {
            scaleChange = dx < 0 ? scaleChange : -scaleChange;
          } else if (origin === 'ne' || origin === 'e') {
            scaleChange = dx > 0 ? scaleChange : -scaleChange;
          } else if (origin === 'sw' || origin === 's') {
            scaleChange = dy > 0 ? scaleChange : -scaleChange;
          } else if (origin === 'se') {
            scaleChange = dx > 0 ? scaleChange : -scaleChange;
          } else if (origin === 'n') {
            scaleChange = dy < 0 ? scaleChange : -scaleChange;
          }
          let newScale = startScale + scaleChange;
          // If dx/dy signs oppose origin for corner drags, adjust
          if (origin === 'se') {
            const mX = moveEvent.clientX - centerX;
            const mY = moveEvent.clientY - centerY;
            const startDist = Math.sqrt((startX - centerX) ** 2 + (startY - centerY) ** 2);
            const currentDist = Math.sqrt(mX ** 2 + mY ** 2);
            newScale = startScale * (currentDist / startDist);
          } else if (origin === 'ne' || origin === 'sw' || origin === 'nw') {
            const mX = moveEvent.clientX - centerX;
            const mY = moveEvent.clientY - centerY;
            const startDist = Math.sqrt((startX - centerX) ** 2 + (startY - centerY) ** 2);
            const currentDist = Math.sqrt(mX ** 2 + mY ** 2);
            newScale = startScale * (currentDist / startDist);
          }

          if (newScale < 0.1) newScale = 0.1;
          updateTransform(clip.id, { scale: newScale });
        } else if (action === 'rotate') {
          const startAngle = Math.atan2(startY - centerY, startX - centerX);
          const currentAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
          let angleDiff = (currentAngle - startAngle) * (180 / Math.PI);
          let newRotation = startRot + angleDiff;
          // constrain to somewhat standard degrees when near them if snapping enabled later
          updateTransform(clip.id, { rotation: newRotation });
        }
      };

      const handlePointerUp = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    };

    return (
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          animationPlayState: isPlaying ? 'running' : 'paused',
          animationDelay: clip.transition ? `${-clipTime}s` : undefined,
          '--anim-duration': clip.transition ? `${clip.transition.duration}s` : undefined,
        } as React.CSSProperties}
        className={cn(
          "absolute inset-0",
          clip.transition && clipTime < clip.transition.duration ? `trans-${clip.transition.type}` : ''
        )}
      >
        <div
          className={cn(
            "relative flex items-center justify-center transition-all",
            isSelected ? "ring-2 ring-purple-500" : ""
          )}
          style={{
            pointerEvents: isEditing ? 'none' : 'auto',
            cursor: isSelected && !isEditing ? 'move' : 'default',
            // We pass variables down to CSS for duration if we prefer, but for now fixed duration using classes is easiest.
          }}
          onPointerDown={(e) => {
            if (isEditing) return; // let child handle it

            if (isSelected) {
              handlePointerDown(e, 'move');
            }
          }}
          onDoubleClick={(e) => {
            if (isSelected && !isEditing) {
              e.stopPropagation();
              setIsEditing(true);
            }
          }}
        >
          {isSelected && (
            <>
              {/* Attached Toolbar */}
              <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-50 min-w-max">
                <FloatingToolbar />
              </div>

              {/* Bounding Box Handles */}
              {/* Corners */}
              <div onPointerDown={(e) => handlePointerDown(e, 'scale', 'nw')} className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white rounded-full border border-gray-300 shadow cursor-nwse-resize" />
              <div onPointerDown={(e) => handlePointerDown(e, 'scale', 'ne')} className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white rounded-full border border-gray-300 shadow cursor-nesw-resize" />
              <div onPointerDown={(e) => handlePointerDown(e, 'scale', 'sw')} className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white rounded-full border border-gray-300 shadow cursor-nesw-resize" />
              <div onPointerDown={(e) => handlePointerDown(e, 'scale', 'se')} className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white rounded-full border border-gray-300 shadow cursor-nwse-resize" />

              {/* Edges */}
              <div onPointerDown={(e) => handlePointerDown(e, 'scale', 'n')} className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-1.5 bg-white rounded-sm border border-gray-300 shadow cursor-ns-resize" />
              <div onPointerDown={(e) => handlePointerDown(e, 'scale', 's')} className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-1.5 bg-white rounded-sm border border-gray-300 shadow cursor-ns-resize" />
              <div onPointerDown={(e) => handlePointerDown(e, 'scale', 'w')} className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-1.5 h-3 bg-white rounded-sm border border-gray-300 shadow cursor-ew-resize" />
              <div onPointerDown={(e) => handlePointerDown(e, 'scale', 'e')} className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-1.5 h-3 bg-white rounded-sm border border-gray-300 shadow cursor-ew-resize" />

              {/* Rotate anchor */}
              <div onPointerDown={(e) => handlePointerDown(e, 'rotate')} className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-6 h-6 bg-white rounded-full shadow flex items-center justify-center cursor-crosshair">
                <RotateCw className="w-3.5 h-3.5 text-black" />
              </div>
            </>
          )}

          <div
            ref={textRef}
            className={cn(
              clip.animation?.entrance && !isEditing && `anim-${clip.animation.entrance}`,
              isEditing && "outline-none ring-2 ring-blue-500 rounded-sm"
            )}
            style={{
              fontSize: `${fontSize}px`,
              fontFamily,
              color,
              backgroundColor: bgColor,
              fontWeight,
              textAlign: clip.text?.alignment || 'center',
              fontStyle: clip.text?.fontStyle || 'normal',
              textTransform: clip.text?.textTransform || 'none',
              background: 'transparent',
              padding: '12px',
              minWidth: '50px',
              maxWidth: '90%',
              width: 'fit-content',
              minHeight: `${fontSize * 1.2}px`,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              display: 'inline-block',
              cursor: isEditing ? 'text' : (isSelected ? 'move' : 'pointer'),
              userSelect: isEditing ? 'text' : 'none',
              pointerEvents: 'auto', // override parent none
              // Control animation play state
              animationPlayState: isPlaying ? 'running' : 'paused',
              animationDelay: `${-(clipTime)}s`,
              '--anim-duration': `${clip.animation?.duration || 1}s`,
            } as React.CSSProperties}
            onPointerDown={(e) => {
              if (isEditing) {
                e.stopPropagation();
              }
            }}
            onDoubleClick={(e) => {
              if (isSelected && !isEditing) {
                e.stopPropagation();
                setIsEditing(true);
              }
            }}
            contentEditable={isEditing}
            suppressContentEditableWarning
            onInput={(e) => {
              if (isEditing) {
                const newTextContent = e.currentTarget.innerHTML || '';
                if (media.type === 'caption') return; // Do not edit SRT master array natively this way
                useEditorStore.getState().updateClipProperty(clip.id, 'text', { ...(clip.text || {}), text: newTextContent });
              }
            }}
            onBlur={(e) => {
              setIsEditing(false);
              window.getSelection()?.removeAllRanges();
            }}
            onClick={(e) => {
              if (!isSelected) {
                e.preventDefault();
              }
            }}
          />
        </div>
      </div>
    );
  }

  const transitionClass = clip.transition && clipTime < clip.transition.duration ? `trans-${clip.transition.type}` : '';
  const transitionStyle = {
    animationPlayState: isPlaying ? 'running' : 'paused',
    animationDelay: clip.transition ? `${-clipTime}s` : undefined,
    '--anim-duration': clip.transition ? `${clip.transition.duration}s` : undefined,
  } as React.CSSProperties;

  const getEffectClasses = (effects?: string[]) => {
    if (!effects || effects.length === 0) return '';
    return effects.map(e => {
      switch (e) {
        case 'blur': return 'blur-md';
        case 'glow': return 'drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]';
        case 'vhs': return 'sepia-[.5] hue-rotate-[15deg] saturate-150 contrast-125';
        case 'glitch': return 'anim-jitter contrast-150';
        case 'shake': return 'anim-jitter';
        case 'zoom': return 'scale-110';
        case 'flash': return 'contrast-200 brightness-150';
        case 'rgb': return 'anim-rainbow';
        case 'pixel': return 'blur-[2px] contrast-150';
        default: return '';
      }
    }).join(' ');
  };

  const currentEffectsClass = getEffectClasses(clip.effects);

  if (media.type === 'video') {
    if (!media.src) {
      return (
        <div className={cn("absolute inset-0 pointer-events-none", transitionClass)} style={transitionStyle}>
          <img
            src={media.thumbnail}
            alt={media.name}
            style={style}
            className={cn("absolute inset-0 w-full h-full object-contain transition-all duration-300", currentEffectsClass)}
          />
        </div>
      );
    }
    return (
      <div className={cn("absolute inset-0 pointer-events-none", transitionClass)} style={transitionStyle}>
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          src={media.src}
          style={style}
          playsInline
          preload="auto"
          onLoadedMetadata={(e) => {
            (e.target as HTMLVideoElement).currentTime = Math.max(0, clipTime);
          }}
          className={cn("absolute inset-0 w-full h-full object-contain transition-all duration-300", currentEffectsClass)}
        />
      </div>
    );
  }

  if (media.type === 'image') {
    return (
      <div className={cn("absolute inset-0 pointer-events-none", transitionClass)} style={transitionStyle}>
        <img
          src={media.src || media.thumbnail}
          alt={media.name}
          style={style}
          className={cn("absolute inset-0 w-full h-full object-contain transition-all duration-300", currentEffectsClass)}
        />
      </div>
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
  const activeClips = tracks.flatMap((track, trackIndex) => {
    // We need to look ahead to see if the *next* clip has a transition
    // If it does, and it's physically adjacent, we force this clip to linger visually.
    const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);
    return sortedClips.map((clip, idx) => {
      let lingerDuration = 0;
      if (idx < sortedClips.length - 1) {
        const nextClip = sortedClips[idx + 1];
        // If next clip touches this one AND has a transition, we linger
        if (Math.abs(nextClip.startTime - (clip.startTime + clip.duration)) < 0.1) {
          if (nextClip.transition) {
            lingerDuration = nextClip.transition.duration;
          }
        }
      }
      
      const isCurrentlyActive = currentTime >= clip.startTime && currentTime < (clip.startTime + clip.duration + lingerDuration);
      
      if (isCurrentlyActive) {
        // Embed the linger duration so the ClipLayer can fade it out
        return { clip: { ...clip, _lingerDuration: lingerDuration }, track, trackIndex };
      }
      return null;
    }).filter(Boolean) as { clip: any, track: any, trackIndex: number }[];
  }).sort((a, b) => b.trackIndex - a.trackIndex);

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
          {(!selectedClip || !selectedClip.mediaId.startsWith('text-')) && (
            <FloatingToolbar />
          )}
        </div>

        <div className="text-sm text-gray-400 font-mono whitespace-nowrap">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Preview area */}
      <div
        ref={containerRef as any}
        className="flex-1 flex items-center justify-center p-4 relative min-h-0 overflow-hidden bg-gray-950"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget && selectedClipId) {
            useEditorStore.getState().selectClip(null);
          }
        }}
      >

        {/* Preview frame with checkerboard background */}
        <div
          ref={previewRef}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget && selectedClipId) {
              useEditorStore.getState().selectClip(null);
            }
          }}
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
