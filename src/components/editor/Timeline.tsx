'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  Undo2,
  Redo2,
  Scissors,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Magnet,
  Plus,
  ChevronDown,
  Video,
  Music,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/store/editorStore';
import TimelineTrack from './TimelineTrack';
import TimeRuler from './TimeRuler';
import { formatTime } from '@/types/editor';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Timeline() {
  const {
    tracks,
    zoom,
    currentTime,
    duration,
    setZoom,
    setCurrentTime,
    deleteSelectedClip,
    splitClipAtPlayhead,
    undo,
    redo,
    addTrack,
    removeTrack,
    isPlaying,
    play,
    pause,
    snapEnabled,
  } = useEditorStore();

  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);

  // Droppable area
  const { setNodeRef, isOver } = useDroppable({
    id: 'timeline-droppable',
    data: { type: 'timeline' },
  });

  // Playhead drag
  const handlePlayheadMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPlayhead(true);
    pause();
  }, [pause]);

  // Timeline click to position playhead
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    if ((e.target as HTMLElement).closest('[data-clip]')) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const scrollLeft = timelineRef.current.scrollLeft;
    const x = e.clientX - rect.left + scrollLeft;
    const timelineX = x - 200; // Track header width
    if (timelineX < 0) return;
    
    const newTime = Math.max(0, Math.min(duration, timelineX / zoom));
    setCurrentTime(newTime);
  }, [zoom, duration, setCurrentTime]);

  // Playhead drag with mouse
  useEffect(() => {
    if (!isDraggingPlayhead) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const scrollLeft = timelineRef.current.scrollLeft;
      const x = e.clientX - rect.left + scrollLeft;
      const timelineX = x - 200;
      const newTime = Math.max(0, Math.min(duration, timelineX / zoom));
      setCurrentTime(newTime);
    };

    const handleMouseUp = () => setIsDraggingPlayhead(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPlayhead, zoom, duration, setCurrentTime]);

  // Auto-scroll during playback
  useEffect(() => {
    if (!timelineRef.current || !isPlaying) return;
    
    const timeline = timelineRef.current;
    const playheadX = 200 + currentTime * zoom;
    const visibleStart = timeline.scrollLeft;
    const visibleEnd = visibleStart + timeline.clientWidth;
    
    if (playheadX < visibleStart + 250 || playheadX > visibleEnd - 150) {
      timeline.scrollLeft = playheadX - 350;
    }
  }, [currentTime, zoom, isPlaying]);

  const totalWidth = Math.max(duration * zoom + 600, 1000);

  const canDeleteTrack = (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return false;
    const sameTypeCount = tracks.filter(t => t.type === track.type).length;
    return sameTypeCount > 1;
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Timeline Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700 bg-gray-800 h-9 flex-shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={undo} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded" title="Undo (Ctrl+Z)">
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={redo} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded" title="Redo (Ctrl+Shift+Z)">
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-gray-600 mx-1" />
          <button onClick={splitClipAtPlayhead} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded" title="Split at playhead (S)">
            <Scissors className="w-3.5 h-3.5" />
          </button>
          <button onClick={deleteSelectedClip} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded" title="Delete (Delete)">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-gray-600 mx-1" />
          <button
            onClick={() => useEditorStore.setState({ snapEnabled: !snapEnabled })}
            className={cn(
              "p-1.5 rounded",
              snapEnabled ? "text-purple-400 bg-purple-600/20" : "text-gray-400 hover:text-white hover:bg-gray-700"
            )}
            title={snapEnabled ? "Snapping ON" : "Snapping OFF"}
          >
            <Magnet className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Time Display */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-white">{formatTime(currentTime)}</span>
          <span className="text-xs text-gray-500">/</span>
          <span className="text-xs font-mono text-gray-400">{formatTime(duration)}</span>
        </div>

        {/* Add Track */}
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-gray-700 rounded"
              >
                <Plus className="w-3 h-3" />
                Add Track
                <ChevronDown className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-800 border-gray-700">
              <DropdownMenuItem onClick={() => addTrack('video')} className="text-white hover:bg-gray-700 cursor-pointer">
                <Video className="w-4 h-4 mr-2 text-purple-400" />
                Video Track
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addTrack('audio')} className="text-white hover:bg-gray-700 cursor-pointer">
                <Music className="w-4 h-4 mr-2 text-green-400" />
                Audio Track
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addTrack('overlay')} className="text-white hover:bg-gray-700 cursor-pointer">
                <Layers className="w-4 h-4 mr-2 text-blue-400" />
                Overlay Track
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Timeline Content */}
      <div 
        ref={timelineRef}
        className="flex-1 overflow-x-auto overflow-y-auto relative"
        onClick={handleTimelineClick}
      >
        <div ref={setNodeRef} className={cn('relative min-w-full', isOver && 'bg-purple-900/10')} style={{ width: totalWidth }}>
          {/* Time Ruler */}
          <TimeRuler zoom={zoom} duration={duration} />

          {/* Tracks */}
          <div className="relative">
            {tracks.map((track) => (
              <TimelineTrack 
                key={track.id} 
                track={track} 
                zoom={zoom} 
                currentTime={currentTime}
                canDelete={canDeleteTrack(track.id)}
                onDelete={() => removeTrack(track.id)}
              />
            ))}
          </div>

          {/* Playhead */}
          <div
            className={cn(
              "absolute top-0 bottom-0 w-0.5 bg-red-500 z-50 cursor-ew-resize",
              isDraggingPlayhead && "bg-red-400"
            )}
            style={{ left: 200 + currentTime * zoom }}
            onMouseDown={handlePlayheadMouseDown}
          >
            {/* Top handle */}
            <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full shadow-lg cursor-grab" />
            {/* Triangle */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2"
              style={{
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '8px solid #ef4444',
                width: 0,
                height: 0,
              }}
            />
          </div>
        </div>
      </div>

      {/* Timeline Footer - Zoom Controls */}
      <div className="flex items-center justify-end gap-2 px-3 py-1.5 border-t border-gray-700 bg-gray-800 h-8 flex-shrink-0">
        <button onClick={() => setZoom(Math.max(10, zoom - 10))} disabled={zoom <= 10} className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded disabled:opacity-50" title="Zoom out">
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        
        <input
          type="range"
          min={10}
          max={200}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
        />
        
        <button onClick={() => setZoom(Math.min(200, zoom + 10))} disabled={zoom >= 200} className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded disabled:opacity-50" title="Zoom in">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        
        <button
          onClick={() => {
            if (timelineRef.current) {
              const visibleWidth = timelineRef.current.clientWidth - 200;
              setZoom(Math.max(10, Math.min(200, visibleWidth / duration)));
            }
          }}
          className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
          title="Zoom to fit"
        >
          <Maximize className="w-3.5 h-3.5" />
        </button>
        
        <span className="text-xs text-gray-500 w-12 text-right">{zoom.toFixed(0)}px/s</span>
      </div>
    </div>
  );
}
