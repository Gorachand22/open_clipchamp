/**
 * useEditorSync — Browser bridge for OpenCode MCP real-time control
 *
 * Flow: OpenCode → MCP route → editorControl (globalThis) → SSE → this hook → Zustand store → UI
 */
'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';

export function useEditorSync() {
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncRef = useRef<number>(0);
  const syncingRef = useRef(false);

  // Push current Zustand state to backend so `get_editor_state` has fresh data
  const pushState = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      const s = useEditorStore.getState();
      const snapshot = {
        tracks: s.tracks.map(t => ({
          id: t.id, type: t.type, name: t.name,
          muted: t.muted, locked: t.locked, visible: t.visible,
          clips: t.clips.map(c => ({
            id: c.id, trackId: c.trackId, mediaId: c.mediaId,
            name: s.mediaLibrary.find(m => m.id === c.mediaId)?.name ?? '',
            type: s.mediaLibrary.find(m => m.id === c.mediaId)?.type ?? 'video',
            startTime: c.startTime, duration: c.duration,
            speed: c.speed ?? 1, volume: c.volume ?? 1,
          })),
        })),
        clips: s.tracks.flatMap(t => t.clips.map(c => ({
          id: c.id, trackId: c.trackId, mediaId: c.mediaId,
          name: s.mediaLibrary.find(m => m.id === c.mediaId)?.name ?? '',
          type: s.mediaLibrary.find(m => m.id === c.mediaId)?.type ?? 'video',
          startTime: c.startTime, duration: c.duration,
          speed: c.speed ?? 1, volume: c.volume ?? 1,
        }))),
        currentTime: s.currentTime,
        duration: s.duration,
        aspectRatio: s.aspectRatio,
        isPlaying: s.isPlaying,
        selectedClipId: s.selectedClipId,
        markers: s.markers ?? [],
        timestamp: Date.now(),
      };
      await fetch('/api/editor/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
      });
    } catch (e) {
      console.warn('[EditorSync] pushState failed:', e);
    } finally {
      syncingRef.current = false;
    }
  }, []);

  // Handle incoming commands from MCP via SSE
  const handleCommand = useCallback((command: string, data: any) => {
    const s = useEditorStore.getState();
    console.log(`[EditorSync] Command: ${command}`, data);

    switch (command) {
      case 'set_playhead':
        s.setCurrentTime(Number(data.time));
        break;

      case 'playback':
        if (data.playing) s.play(); else s.pause();
        break;

      case 'set_aspect_ratio':
        s.setAspectRatio(data.ratio);
        break;

      case 'add_track':
        s.addTrack(data.trackType);
        break;

      case 'add_clip': {
        const { mediaId, mediaName, mediaType, startTime, duration, src, thumbnail, trackId } = data;

        // Find or create target track
        let targetTrackId: string | undefined = trackId;
        if (!targetTrackId) {
          const type = mediaType === 'audio' ? 'audio' : 'video';
          targetTrackId = s.tracks.find(t => t.type === type)?.id ?? s.tracks[1]?.id;
        }

        if (targetTrackId) {
          s.addClipToTrack(targetTrackId, {
            mediaId,
            mediaName,
            mediaType,
            src,
            thumbnail,
            startTime: startTime ?? 0,
            duration: duration ?? 5,
            trimStart: 0,
            trimEnd: 0,
          } as any);
        }
        break;
      }

      case 'remove_clip':
        s.removeClip(data.clipId);
        break;

      case 'move_clip':
        s.moveClip(data.clipId, data.startTime, data.targetTrackId);
        break;

      case 'split_clip':
        s.splitClipAtPlayhead();
        break;

      case 'delete_selected':
        s.deleteSelectedClip();
        break;

      case 'select_clip':
        s.selectClip(data.clipId);
        break;

      case 'undo':
        s.undo();
        break;

      case 'redo':
        s.redo();
        break;

      case 'import_media':
        s.addMedia({
          id: data.mediaId ?? `media_${Date.now()}`,
          name: data.name,
          type: data.type,
          duration: data.duration,
          src: data.src,
          thumbnail: data.thumbnail,
        });
        break;

      case 'add_generated': {
        const mediaId = `gen_${Date.now()}`;
        s.addMedia({
          id: mediaId, name: data.name, type: data.type,
          duration: data.duration, src: data.src, thumbnail: data.thumbnail,
        });
        const trackType = data.type === 'audio' ? 'audio' : 'video';
        const track = s.tracks.find(t => t.type === trackType) ?? s.tracks[1];
        if (track) {
          const lastEnd = track.clips.reduce((m, c) => Math.max(m, c.startTime + c.duration), 0);
          s.addClipToTrack(track.id, {
            mediaId, startTime: data.startTime ?? lastEnd,
            duration: data.duration, trimStart: 0, trimEnd: 0,
          });
        }
        break;
      }

      case 'add_marker':
        s.addMarker(data.time, data.label);
        break;

      case 'add_caption':
        s.addCaption({ startTime: data.startTime, endTime: data.endTime, text: data.text, style: {} as any });
        break;

      case 'clear_timeline':
        s.tracks.forEach(t => t.clips.forEach(c => s.removeClip(c.id)));
        break;

      case 'set_clip_speed':
        s.updateClipProperty(data.clipId, 'speed', data.speed);
        break;

      case 'set_clip_volume':
        s.updateClipProperty(data.clipId, 'volume', data.volume);
        break;

      case 'set_clip_fade':
        if (data.fadeIn !== undefined) s.updateClipProperty(data.clipId, 'fadeIn', data.fadeIn);
        if (data.fadeOut !== undefined) s.updateClipProperty(data.clipId, 'fadeOut', data.fadeOut);
        break;

      case 'set_clip_filter':
        s.updateClipProperty(data.clipId, 'activeFilter', data.filter);
        break;

      case 'set_clip_color_grade':
        s.updateClipColorGrade(data.clipId, data.settings);
        break;

      case 'set_clip_animation':
        s.updateClipAnimation(data.clipId, { entrance: data.entrance, exit: data.exit });
        break;

      default:
        console.log('[EditorSync] Unknown command:', command, data);
    }

    // After any command, push updated state back to backend
    setTimeout(() => pushState(), 200);
  }, [pushState]);

  // Connect to SSE endpoint
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let retries = 0;

    const connect = () => {
      if (es) { es.close(); es = null; }

      console.log(`[EditorSync] Connecting to SSE... (attempt ${retries + 1})`);
      es = new EventSource('/api/editor/events');

      es.onopen = () => {
        retries = 0;
        console.log('[EditorSync] SSE connected ✓');
        pushState(); // Push state immediately on connect
      };

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === 'connected') {
            console.log('[EditorSync] Server acknowledged, clientId:', payload.clientId);
            pushState();
          } else if (payload.type === 'command') {
            // MCP → SSE → React: run the command
            handleCommand(payload.command, payload.data ?? {});
          }
          // 'snapshot' type means someone else updated state — ignore for now
        } catch (e) {
          console.warn('[EditorSync] Parse error:', e);
        }
      };

      es.onerror = (err) => {
        console.warn('[EditorSync] SSE error, will reconnect...', err);
        es?.close();
        es = null;
        const delay = Math.min(5000, 1000 * Math.pow(1.5, retries));
        retries++;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (es) { es.close(); }
      console.log('[EditorSync] Disconnected');
    };
  }, [handleCommand, pushState]);

  // Periodically push Zustand state to backend (keep `get_editor_state` fresh)
  useEffect(() => {
    syncTimerRef.current = setInterval(() => {
      const now = Date.now();
      if (now - lastSyncRef.current > 2000) {
        lastSyncRef.current = now;
        pushState();
      }
    }, 2000);
    return () => { if (syncTimerRef.current) clearInterval(syncTimerRef.current); };
  }, [pushState]);

  // Push state on every Zustand change (debounced to 500ms)
  useEffect(() => {
    const unsub = useEditorStore.subscribe(() => {
      const now = Date.now();
      if (now - lastSyncRef.current > 500) {
        lastSyncRef.current = now;
        pushState();
      }
    });
    return unsub;
  }, [pushState]);

  return { pushState };
}
