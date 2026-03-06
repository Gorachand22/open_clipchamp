'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useSensors,
  useSensor,
  PointerSensor,
  defaultDropAnimation,
  pointerWithin,
} from '@dnd-kit/core';
import { Video, Settings, HelpCircle, ChevronDown, Download, Keyboard, X, Image as ImageIcon, Music, GripVertical } from 'lucide-react';
import MediaLibrary from '@/components/editor/MediaLibrary';
import PreviewCanvas from '@/components/editor/PreviewCanvas';
import Timeline from '@/components/editor/Timeline';
import PropertyPanel from '@/components/editor/PropertyPanel';
import { useEditorStore } from '@/store/editorStore';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { MediaItem, AspectRatio } from '@/types/editor';
import { KEYBOARD_SHORTCUTS } from '@/types/editor';
import { useEditorSync } from '@/hooks/useEditorSync';
import { importFilesToStore } from '@/lib/import-media';

interface DragData {
  type: 'media' | 'clip';
  media?: MediaItem;
  clipId?: string;
  trackId?: string;
}

export default function Home() {
  const {
    mediaLibrary,
    tracks,
    addClipToTrack,
    moveClip,
    currentTime,
    duration,
    isPlaying,
    play,
    pause,
    aspectRatio,
    setAspectRatio,
    selectedClipId,
    zoom,
    getSnappedTime,
    saveToHistory,
    getClipById,
    showShortcuts,
    setShowShortcuts,
  } = useEditorStore();

  // IDE-to-Editor sync - enables OpenCode IDE to control the editor
  useEditorSync();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragData, setDragData] = useState<DragData | null>(null);

  // Panel sizes
  const [leftPanelWidth, setLeftPanelWidth] = useState(260);
  const [rightPanelWidth, setRightPanelWidth] = useState(280);
  const [timelineHeight, setTimelineHeight] = useState(260);

  // Resize refs
  const leftResizeRef = useRef<HTMLDivElement>(null);
  const rightResizeRef = useRef<HTMLDivElement>(null);
  const timelineResizeRef = useRef<HTMLDivElement>(null);
  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);
  const isResizingTimeline = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // Panel resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft.current) {
        const newWidth = Math.max(200, Math.min(400, e.clientX));
        setLeftPanelWidth(newWidth);
      } else if (isResizingRight.current) {
        const newWidth = Math.max(200, Math.min(400, window.innerWidth - e.clientX));
        setRightPanelWidth(newWidth);
      } else if (isResizingTimeline.current) {
        // Calculate new timeline height based on mouse distance from the bottom of the screen
        const bottomOffset = window.innerHeight - e.clientY;
        const newHeight = Math.max(100, Math.min(window.innerHeight * 0.8, bottomOffset));
        setTimelineHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      isResizingLeft.current = false;
      isResizingRight.current = false;
      isResizingTimeline.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startResizingLeft = () => {
    isResizingLeft.current = true;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  };

  const startResizingRight = () => {
    isResizingRight.current = true;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  };

  const startResizingTimeline = () => {
    isResizingTimeline.current = true;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    setDragData(active.data.current as DragData);
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over, delta } = event;
    setActiveId(null);
    setDragData(null);

    if (!over) return;

    const data = active.data.current as DragData;
    const overData = over.data.current;

    if (data?.type === 'media' && data.media) {
      const media = data.media;
      let targetTrackId: string | undefined;

      if (media.type === 'audio') {
        targetTrackId = tracks.find(t => t.type === 'audio')?.id;
      } else if (media.type === 'image') {
        targetTrackId = tracks.find(t => t.type === 'video')?.id;
      } else {
        targetTrackId = tracks.find(t => t.type === 'video')?.id;
      }

      if (overData?.type === 'track') {
        targetTrackId = overData.trackId;
      }

      if (targetTrackId) {
        const track = tracks.find(t => t.id === targetTrackId);
        let newStartTime = 0;

        if (track && track.clips.length > 0) {
          const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);
          const lastClip = sortedClips[sortedClips.length - 1];
          newStartTime = lastClip.startTime + lastClip.duration;
        }

        newStartTime = getSnappedTime(newStartTime);
        saveToHistory();
        addClipToTrack(targetTrackId, {
          mediaId: media.id,
          startTime: newStartTime,
          duration: media.duration,
          trimStart: 0,
          trimEnd: 0,
        });
      }
    } else if (data?.type === 'clip' && data.clipId) {
      const clip = getClipById(data.clipId);
      if (!clip) return;

      const newStartTime = Math.max(0, clip.startTime + delta.x / zoom);
      const snappedTime = getSnappedTime(newStartTime, data.clipId);

      let newTrackId = data.trackId;
      if (overData?.type === 'track' && overData.trackId !== data.trackId) {
        newTrackId = overData.trackId;
      }

      if (snappedTime !== clip.startTime || newTrackId !== data.trackId) {
        saveToHistory();
        moveClip(data.clipId, snappedTime, newTrackId);
      }
    }
  }, [addClipToTrack, moveClip, tracks, zoom, getSnappedTime, saveToHistory, getClipById]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const state = useEditorStore.getState();

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setShowShortcuts(!state.showShortcuts);
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        if (state.isPlaying) { state.pause(); } else { state.play(); }
      } else if (e.key === 's' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        state.splitClipAtPlayhead();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        state.deleteSelectedClip();
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        state.redo();
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        state.undo();
      } else if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        state.redo();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (e.shiftKey) {
          state.setCurrentTime(Math.max(0, state.currentTime - 5));
        } else {
          state.setCurrentTime(Math.max(0, state.currentTime - 1 / 30));
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (e.shiftKey) {
          state.setCurrentTime(Math.min(state.duration, state.currentTime + 5));
        } else {
          state.setCurrentTime(Math.min(state.duration, state.currentTime + 1 / 30));
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        state.setCurrentTime(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        state.setCurrentTime(state.duration);
      } else if (e.key === '=' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        state.setZoom(Math.min(200, state.zoom + 20));
      } else if (e.key === '-' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        state.setZoom(Math.max(10, state.zoom - 20));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowShortcuts]);

  // Global drag and drop handler to import files dropped anywhere in the app
  useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleGlobalDrop = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        importFilesToStore(Array.from(e.dataTransfer.files), useEditorStore.getState().addMedia);
      }
    };
    window.addEventListener('dragover', handleGlobalDragOver);
    window.addEventListener('drop', handleGlobalDrop);

    return () => {
      window.removeEventListener('dragover', handleGlobalDragOver);
      window.removeEventListener('drop', handleGlobalDrop);
    };
  }, []);

  const aspectRatios: { value: AspectRatio; label: string }[] = [
    { value: '16:9', label: '16:9' },
    { value: '9:16', label: '9:16' },
    { value: '1:1', label: '1:1' },
    { value: '4:5', label: '4:5' },
    { value: '21:9', label: '21:9' },
  ];

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-screen w-screen flex flex-col bg-gray-950 text-white overflow-hidden">
        {/* Header */}
        <header className="h-12 bg-gray-900 border-b border-gray-700 flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-purple-500" />
              <span className="font-semibold text-sm">Video Editor Pro</span>
            </div>
            <div className="h-4 w-px bg-gray-700" />
            <span className="flex items-center gap-1 text-sm text-gray-300">
              Untitled Project
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Aspect Ratio */}
            <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
              {aspectRatios.map((ar) => (
                <button
                  key={ar.value}
                  onClick={() => setAspectRatio(ar.value)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${aspectRatio === ar.value ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                >
                  {ar.label}
                </button>
              ))}
            </div>

            <Button variant="ghost" size="icon" onClick={() => setShowShortcuts(true)} className="text-gray-400 hover:text-white">
              <Keyboard className="w-4 h-4" />
            </Button>

            <Button className="bg-purple-600 hover:bg-purple-700 text-white gap-2 h-8 text-sm">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </header>

        {/* Main Content - Fixed height calculation */}
        <div className="flex-1 flex min-h-0" style={{ height: 'calc(100vh - 48px)' }}>
          {/* Left Panel */}
          <div className="flex-shrink-0 border-r border-gray-700 overflow-hidden flex flex-col" style={{ width: leftPanelWidth }}>
            <MediaLibrary />
            {/* Resize handle */}
            <div
              ref={leftResizeRef}
              className="w-1 bg-gray-700 hover:bg-purple-500 cursor-ew-resize flex-shrink-0 transition-colors group flex items-center justify-center"
              onMouseDown={startResizingLeft}
            >
              <GripVertical className="w-3 h-3 text-gray-600 group-hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Center */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Preview - Takes remaining space */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <PreviewCanvas />
              {/* Timeline resize handle */}
              <div
                ref={timelineResizeRef}
                className="h-3 bg-gray-900 border-y border-gray-700 hover:border-purple-500 hover:bg-purple-500/20 cursor-ns-resize flex-shrink-0 transition-all group flex items-center justify-center relative z-50"
                onMouseDown={startResizingTimeline}
              >
                <div className="w-12 h-1 bg-gray-600 group-hover:bg-purple-400 rounded-full transition-colors" />
              </div>
            </div>

            {/* Timeline - Variable height */}
            <div className="flex-shrink-0" style={{ height: timelineHeight }}>
              <Timeline />
            </div>
          </div>

          {/* Right Panel */}
          <div className="flex-shrink-0 border-l border-gray-700 overflow-hidden flex" style={{ width: rightPanelWidth }}>
            {/* Resize handle */}
            <div
              ref={rightResizeRef}
              className="w-1 bg-gray-700 hover:bg-purple-500 cursor-ew-resize flex-shrink-0 transition-colors group flex items-center justify-center"
              onMouseDown={startResizingRight}
            >
              <GripVertical className="w-3 h-3 text-gray-600 group-hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <PropertyPanel />
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay dropAnimation={defaultDropAnimation}>
        {activeId && dragData?.type === 'media' && dragData.media && (
          <div className="px-3 py-2 bg-purple-600 rounded-lg text-white text-sm shadow-xl border border-purple-400 flex items-center gap-2">
            {dragData.media.type === 'video' && <Video className="w-4 h-4" />}
            {dragData.media.type === 'audio' && <Music className="w-4 h-4" />}
            {dragData.media.type === 'image' && <ImageIcon className="w-4 h-4" />}
            <span>{dragData.media.name}</span>
          </div>
        )}
      </DragOverlay>

      {/* Keyboard Shortcuts Dialog */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="w-5 h-5" />
              Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 py-4">
            {KEYBOARD_SHORTCUTS.map((shortcut, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                <span className="text-sm text-gray-300">{shortcut.action}</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300 font-mono">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}
