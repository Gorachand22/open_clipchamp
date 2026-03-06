'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Video, Image as ImageIcon, Music } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/store/editorStore';
import type { TimelineClip, Track } from '@/types/editor';

interface TimelineClipProps {
  clip: TimelineClip;
  track: Track;
  zoom: number;
  isSelected: boolean;
}

export default function TimelineClip({ clip, track, zoom, isSelected }: TimelineClipProps) {
  const { selectClip, getMediaById, updateClipDuration, moveClip, getSnappedTime, saveToHistory } = useEditorStore();
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
  const [resizeState, setResizeState] = useState({ startTime: clip.startTime, duration: clip.duration });
  const clipRef = useRef<HTMLDivElement>(null);
  const initialMouseX = useRef(0);
  const initialStartTime = useRef(0);
  const initialDuration = useRef(0);

  const media = getMediaById(clip.mediaId);
  const displayStartTime = isResizing ? resizeState.startTime : clip.startTime;
  const displayDuration = isResizing ? resizeState.duration : clip.duration;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `clip-${clip.id}`,
    data: { type: 'clip', clipId: clip.id, trackId: track.id, mediaId: clip.mediaId },
    disabled: track.locked || isResizing !== null,
  });

  const dragOffset = transform ? transform.x / zoom : 0;
  const finalStartTime = isDragging ? displayStartTime + dragOffset : displayStartTime;

  const style = {
    left: finalStartTime * zoom,
    width: displayDuration * zoom,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : isSelected ? 10 : 1,
  };

  const getClipColors = () => {
    if (!media) return { bg: 'from-gray-600 to-gray-700', border: 'border-gray-500', header: 'bg-gray-900/50' };
    switch (media.type) {
      case 'video': return { bg: 'from-purple-600 to-purple-800', border: 'border-purple-400', header: 'bg-purple-900/50' };
      case 'audio': return { bg: 'from-emerald-600 to-emerald-800', border: 'border-emerald-400', header: 'bg-emerald-900/50' };
      case 'image': return { bg: 'from-blue-600 to-blue-800', border: 'border-blue-400', header: 'bg-blue-900/50' };
    }
  };

  const colors = getClipColors();

  const handleResizeStart = useCallback((e: React.MouseEvent, direction: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    if (track.locked) return;
    initialMouseX.current = e.clientX;
    initialStartTime.current = clip.startTime;
    initialDuration.current = clip.duration;
    setResizeState({ startTime: clip.startTime, duration: clip.duration });
    setIsResizing(direction);
  }, [track.locked, clip.startTime, clip.duration]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - initialMouseX.current;
      const deltaTime = deltaX / zoom;

      if (isResizing === 'left') {
        let newStartTime = initialStartTime.current + deltaTime;
        let newDuration = initialDuration.current - deltaTime;
        newStartTime = getSnappedTime(newStartTime, clip.id);
        if (newDuration < 0.5) { newDuration = 0.5; newStartTime = initialStartTime.current + initialDuration.current - 0.5; }
        if (newStartTime < 0) { newStartTime = 0; newDuration = initialStartTime.current + initialDuration.current; }
        setResizeState({ startTime: newStartTime, duration: newDuration });
      } else {
        let newDuration = initialDuration.current + deltaTime;
        const endTime = initialStartTime.current + newDuration;
        const snappedEndTime = getSnappedTime(endTime, clip.id);
        newDuration = snappedEndTime - initialStartTime.current;
        if (newDuration < 0.5) newDuration = 0.5;
        setResizeState(prev => ({ ...prev, duration: newDuration }));
      }
    };

    const handleMouseUp = () => {
      if (isResizing === 'left') {
        if (resizeState.startTime !== clip.startTime || resizeState.duration !== clip.duration) {
          saveToHistory();
          moveClip(clip.id, resizeState.startTime);
          updateClipDuration(clip.id, resizeState.duration);
        }
      } else {
        if (resizeState.duration !== clip.duration) {
          saveToHistory();
          updateClipDuration(clip.id, resizeState.duration);
        }
      }
      setIsResizing(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
  }, [isResizing, resizeState.startTime, resizeState.duration, clip, zoom, updateClipDuration, moveClip, getSnappedTime, saveToHistory]);

  const handleClick = useCallback((e: React.MouseEvent) => { e.stopPropagation(); selectClip(clip.id); }, [clip.id, selectClip]);

  const getIcon = () => {
    if (!media) return null;
    switch (media.type) {
      case 'video': return <Video className="w-3 h-3" />;
      case 'audio': return <Music className="w-3 h-3" />;
      case 'image': return <ImageIcon className="w-3 h-3" />;
    }
  };

  // Render waveform for audio
  const renderWaveform = () => {
    if (!media || media.type !== 'audio') return null;
    const bars = Math.max(10, Math.floor(displayDuration * zoom / 3));
    return (
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden px-1 pt-6">
        <svg className="w-full h-5" preserveAspectRatio="none" viewBox={`0 0 ${bars * 3} 24`}>
          {Array.from({ length: bars }).map((_, i) => {
            const height = 6 + Math.abs(Math.sin(i * 0.4 + clip.id.charCodeAt(3))) * 12 + Math.random() * 4;
            return <rect key={i} x={i * 3 + 1} y={(24 - height) / 2} width={2} height={height} fill="rgba(255,255,255,0.35)" rx={1} />;
          })}
        </svg>
      </div>
    );
  };

  // Render thumbnails for video
  const renderThumbnails = () => {
    if (!media || media.type !== 'video') return null;
    const thumbCount = Math.max(1, Math.floor(displayDuration * zoom / 40));
    return (
      <div className="absolute inset-0 flex overflow-hidden pt-6">
        {Array.from({ length: thumbCount }).map((_, i) => (
          <div key={i} className="flex-1 bg-gradient-to-br from-white/10 to-transparent border-r border-white/5 last:border-r-0" />
        ))}
      </div>
    );
  };

  return (
    <div
      ref={(node) => { setNodeRef(node); (clipRef as React.MutableRefObject<HTMLDivElement | null>).current = node; }}
      style={{ ...style, position: 'absolute', top: 2, bottom: 2 }}
      className={cn(
        'rounded overflow-hidden cursor-grab active:cursor-grabbing group',
        'border-2 transition-all duration-75',
        isSelected ? 'border-green-400 shadow-lg shadow-green-500/20' : 'border-transparent hover:border-white/30',
        isDragging && 'shadow-xl',
        track.locked && 'cursor-not-allowed opacity-70'
      )}
      onClick={handleClick}
      data-clip
      data-clip-id={clip.id}
      {...attributes}
    >
      <div className={cn('absolute inset-0 bg-gradient-to-r', colors.bg)} />
      {renderThumbnails()}
      {renderWaveform()}
      
      {/* Header */}
      <div className={cn('absolute top-0 left-0 right-0 h-5 flex items-center px-1.5 gap-1', colors.header)}>
        <span className="flex-shrink-0 opacity-70">{getIcon()}</span>
        <span className="text-[10px] text-white font-medium truncate flex-1">{media?.name || 'Unknown'}</span>
        <span className="text-[9px] text-white/70 bg-black/30 px-1 rounded">{displayDuration.toFixed(1)}s</span>
      </div>

      {/* Trim handles */}
      {!track.locked && (
        <>
          <div
            className={cn('absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize z-10', 'hover:bg-white/10', isResizing === 'left' ? 'bg-white/20' : 'opacity-0 group-hover:opacity-100 transition-opacity')}
            onMouseDown={(e) => handleResizeStart(e, 'left')}
          >
            <div className="w-0.5 h-6 bg-white/50 rounded-full absolute left-1 top-1/2 -translate-y-1/2" />
          </div>
          <div
            className={cn('absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize z-10', 'hover:bg-white/10', isResizing === 'right' ? 'bg-white/20' : 'opacity-0 group-hover:opacity-100 transition-opacity')}
            onMouseDown={(e) => handleResizeStart(e, 'right')}
          >
            <div className="w-0.5 h-6 bg-white/50 rounded-full absolute right-1 top-1/2 -translate-y-1/2" />
          </div>
        </>
      )}

      {/* Drag handle */}
      <div {...listeners} className="absolute inset-0 top-5 z-10" style={{ cursor: isResizing ? undefined : (track.locked ? 'not-allowed' : 'grab') }} />

      {/* Selection corners */}
      {isSelected && (
        <>
          <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-green-400" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-green-400" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-green-400" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-green-400" />
        </>
      )}

      {/* Fade indicators */}
      {clip.fadeIn > 0 && (
        <div className="absolute top-5 bottom-0 left-0 bg-gradient-to-r from-transparent to-white/10 pointer-events-none" style={{ width: (clip.fadeIn / clip.duration) * 100 + '%' }} />
      )}
      {clip.fadeOut > 0 && (
        <div className="absolute top-5 bottom-0 right-0 bg-gradient-to-l from-transparent to-white/10 pointer-events-none" style={{ width: (clip.fadeOut / clip.duration) * 100 + '%' }} />
      )}
    </div>
  );
}
