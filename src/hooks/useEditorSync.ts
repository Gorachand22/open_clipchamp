/**
 * useEditorSync Hook
 * 
 * Syncs editor state with backend for IDE-to-Editor real-time interaction.
 * This allows OpenCode IDE to:
 * - See what's happening in the editor
 * - Control timeline, clips, tracks
 * - Add generated content
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { editorControl } from '@/lib/editor-control';

export function useEditorSync() {
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncRef = useRef<number>(0);

  // Get state snapshot
  const getSnapshot = useCallback(() => {
    const state = useEditorStore.getState();
    return {
      tracks: state.tracks.map(t => ({
        id: t.id,
        type: t.type,
        name: t.name,
        muted: t.muted,
        locked: t.locked,
        visible: t.visible,
        clips: t.clips.map(c => ({
          id: c.id,
          trackId: c.trackId,
          mediaId: c.mediaId,
          name: '',
          type: 'video' as const,
          startTime: c.startTime,
          duration: c.duration,
          speed: c.speed,
          volume: c.volume,
        })),
      })),
      clips: state.tracks.flatMap(t => t.clips.map(c => ({
        id: c.id,
        trackId: c.trackId,
        mediaId: c.mediaId,
        name: '',
        type: 'video' as const,
        startTime: c.startTime,
        duration: c.duration,
        speed: c.speed,
        volume: c.volume,
      }))),
      currentTime: state.currentTime,
      duration: state.duration,
      aspectRatio: state.aspectRatio,
      isPlaying: state.isPlaying,
      selectedClipId: state.selectedClipId,
      markers: state.markers,
      timestamp: Date.now(),
    };
  }, []);

  // Push state to backend
  const pushState = useCallback(async () => {
    try {
      const snapshot = getSnapshot();
      await fetch('/api/editor/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
      });
    } catch (error) {
      console.error('[EditorSync] Failed to push state:', error);
    }
  }, [getSnapshot]);

  // Handle commands from IDE
  const handleCommand = useCallback((event: { type: string; data: any }) => {
    const state = useEditorStore.getState();
    
    switch (event.type) {
      case 'set_playhead':
        state.setCurrentTime(event.data.time);
        break;
      case 'playback':
        if (event.data.playing) state.play();
        else state.pause();
        break;
      case 'set_aspect_ratio':
        state.setAspectRatio(event.data.ratio);
        break;
      case 'add_track':
        state.addTrack(event.data.trackType);
        break;
      case 'add_clip': {
        const { trackId, mediaId, mediaName, mediaType, startTime, duration, src, thumbnail } = event.data;
        // Find appropriate track if not specified
        let targetTrackId = trackId;
        if (!targetTrackId) {
          const trackType = mediaType === 'audio' ? 'audio' : 'video';
          const track = state.tracks.find(t => t.type === trackType);
          if (track) targetTrackId = track.id;
        }
        if (targetTrackId) {
          // Calculate start time
          let clipStart = startTime ?? 0;
          if (startTime === undefined) {
            const track = state.tracks.find(t => t.id === targetTrackId);
            if (track && track.clips.length > 0) {
              const lastClip = track.clips.reduce((a, b) => 
                a.startTime + a.duration > b.startTime + b.duration ? a : b
              );
              clipStart = lastClip.startTime + lastClip.duration;
            }
          }
          state.addClipToTrack(targetTrackId, {
            mediaId,
            startTime: clipStart,
            duration,
            trimStart: 0,
            trimEnd: 0,
          });
        }
        break;
      }
      case 'remove_clip':
        state.removeClip(event.data.clipId);
        break;
      case 'move_clip':
        state.moveClip(event.data.clipId, event.data.startTime, event.data.targetTrackId);
        break;
      case 'split_clip':
        state.splitClipAtPlayhead();
        break;
      case 'delete_selected':
        state.deleteSelectedClip();
        break;
      case 'undo':
        state.undo();
        break;
      case 'redo':
        state.redo();
        break;
      case 'import_media':
        state.addMedia({
          id: event.data.mediaId || `media_${Date.now()}`,
          name: event.data.name,
          type: event.data.type,
          duration: event.data.duration,
          src: event.data.src,
          thumbnail: event.data.thumbnail,
        });
        break;
      case 'add_generated':
        // Add to media library then add to timeline
        const mediaId = `gen_${Date.now()}`;
        state.addMedia({
          id: mediaId,
          name: event.data.name,
          type: event.data.type,
          duration: event.data.duration,
          src: event.data.src,
          thumbnail: event.data.thumbnail,
        });
        // Auto-add to timeline
        const trackType = event.data.type === 'audio' ? 'audio' : 'video';
        const track = state.tracks.find(t => t.type === trackType);
        if (track) {
          let startTime = event.data.startTime ?? 0;
          if (event.data.startTime === undefined && track.clips.length > 0) {
            const lastClip = track.clips.reduce((a, b) => 
              a.startTime + a.duration > b.startTime + b.duration ? a : b
            );
            startTime = lastClip.startTime + lastClip.duration;
          }
          state.addClipToTrack(track.id, {
            mediaId,
            startTime,
            duration: event.data.duration,
            trimStart: 0,
            trimEnd: 0,
          });
        }
        break;
      case 'clear_timeline':
        // Clear all clips from all tracks
        state.tracks.forEach(t => {
          t.clips.forEach(c => state.removeClip(c.id));
        });
        break;
      default:
        console.log('[EditorSync] Unknown command:', event.type);
    }
  }, []);

  // Initialize sync
  useEffect(() => {
    // Push initial state
    pushState();

    // Set up periodic sync (every 2 seconds)
    syncIntervalRef.current = setInterval(() => {
      const now = Date.now();
      if (now - lastSyncRef.current > 2000) {
        pushState();
        lastSyncRef.current = now;
      }
    }, 2000);

    // Listen for broadcast commands
    const handleBroadcast = (event: any) => {
      if (event.data) {
        handleCommand({ type: event.type, data: event.data });
      }
    };

    editorControl.on('broadcast', handleBroadcast);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      editorControl.off('broadcast', handleBroadcast);
    };
  }, [pushState, handleCommand]);

  // Subscribe to store changes for immediate sync
  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe(() => {
      const now = Date.now();
      if (now - lastSyncRef.current > 500) {
        pushState();
        lastSyncRef.current = now;
      }
    });

    return unsubscribe;
  }, [pushState]);

  return { pushState, getSnapshot };
}
