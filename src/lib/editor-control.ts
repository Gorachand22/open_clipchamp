/**
 * Editor Control System - IDE to Editor Real-Time Interaction
 */

import { EventEmitter } from 'events';

// Types
export interface EditorSnapshot {
  tracks: TrackData[];
  clips: ClipData[];
  currentTime: number;
  duration: number;
  aspectRatio: string;
  isPlaying: boolean;
  selectedClipId: string | null;
  markers: MarkerData[];
  timestamp: number;
}

export interface TrackData {
  id: string;
  type: 'video' | 'audio' | 'overlay';
  name: string;
  muted: boolean;
  locked: boolean;
  visible: boolean;
}

export interface ClipData {
  id: string;
  trackId: string;
  mediaId: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  startTime: number;
  duration: number;
  speed: number;
  volume: number;
}

export interface MarkerData {
  id: string;
  time: number;
  label: string;
}

// Editor Control Manager
class EditorControlManager extends EventEmitter {
  private snapshot: EditorSnapshot | null = null;
  private clients = new Set<string>();

  registerClient(id: string) {
    this.clients.add(id);
    this.emit('client_connected', id);
  }

  unregisterClient(id: string) {
    this.clients.delete(id);
    this.emit('client_disconnected', id);
  }

  getSnapshot(): EditorSnapshot | null {
    return this.snapshot;
  }

  updateSnapshot(s: EditorSnapshot) {
    this.snapshot = { ...s, timestamp: Date.now() };
    this.emit('snapshot', this.snapshot);
  }

  broadcast(type: string, data: unknown) {
    this.emit('broadcast', { type, data, timestamp: Date.now() });
  }
}

export const editorControl = new EditorControlManager();

// Tool Result Type
interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Editor Control Tools
export const editorControlTools = {
  async get_editor_state(): Promise<ToolResult> {
    const snap = editorControl.getSnapshot();
    return snap ? { success: true, data: snap } : { success: false, error: 'No editor' };
  },

  async set_playhead(params: { time: number }): Promise<ToolResult> {
    editorControl.broadcast('set_playhead', params);
    return { success: true, data: { time: params.time } };
  },

  async start_playback(): Promise<ToolResult> {
    editorControl.broadcast('playback', { playing: true });
    return { success: true, data: { isPlaying: true } };
  },

  async pause_playback(): Promise<ToolResult> {
    editorControl.broadcast('playback', { playing: false });
    return { success: true, data: { isPlaying: false } };
  },

  async set_aspect_ratio(params: { ratio: string }): Promise<ToolResult> {
    editorControl.broadcast('set_aspect_ratio', params);
    return { success: true, data: { aspectRatio: params.ratio } };
  },

  async add_track(params: { trackType: 'video' | 'audio' | 'overlay' }): Promise<ToolResult> {
    editorControl.broadcast('add_track', params);
    return { success: true };
  },

  async remove_track(params: { trackId: string }): Promise<ToolResult> {
    editorControl.broadcast('remove_track', params);
    return { success: true };
  },

  async add_clip(params: {
    trackId?: string;
    mediaId: string;
    mediaName: string;
    mediaType: 'video' | 'audio' | 'image';
    startTime?: number;
    duration: number;
    src?: string;
    thumbnail?: string;
  }): Promise<ToolResult> {
    editorControl.broadcast('add_clip', params);
    return { success: true, data: { clipId: `clip_${Date.now()}` } };
  },

  async remove_clip(params: { clipId: string }): Promise<ToolResult> {
    editorControl.broadcast('remove_clip', params);
    return { success: true };
  },

  async move_clip(params: { clipId: string; startTime: number; targetTrackId?: string }): Promise<ToolResult> {
    editorControl.broadcast('move_clip', params);
    return { success: true };
  },

  async set_clip_speed(params: { clipId: string; speed: number }): Promise<ToolResult> {
    editorControl.broadcast('set_clip_speed', params);
    return { success: true };
  },

  async set_clip_volume(params: { clipId: string; volume: number }): Promise<ToolResult> {
    editorControl.broadcast('set_clip_volume', params);
    return { success: true };
  },

  async set_clip_fade(params: { clipId: string; fadeIn?: number; fadeOut?: number }): Promise<ToolResult> {
    editorControl.broadcast('set_clip_fade', params);
    return { success: true };
  },

  async set_clip_transform(params: { clipId: string; transform: Record<string, unknown> }): Promise<ToolResult> {
    editorControl.broadcast('set_clip_transform', params);
    return { success: true };
  },

  async set_clip_filter(params: { clipId: string; filter: string }): Promise<ToolResult> {
    editorControl.broadcast('set_clip_filter', params);
    return { success: true };
  },

  async set_clip_color_grade(params: { clipId: string; settings: Record<string, number> }): Promise<ToolResult> {
    editorControl.broadcast('set_clip_color_grade', params);
    return { success: true };
  },

  async set_clip_chroma_key(params: { clipId: string; enabled: boolean; keyColor?: string; similarity?: number }): Promise<ToolResult> {
    editorControl.broadcast('set_clip_chroma_key', params);
    return { success: true };
  },

  async set_clip_animation(params: { clipId: string; entrance?: string; exit?: string }): Promise<ToolResult> {
    editorControl.broadcast('set_clip_animation', params);
    return { success: true };
  },

  async split_clip(): Promise<ToolResult> {
    editorControl.broadcast('split_clip', {});
    return { success: true };
  },

  async delete_selected_clip(): Promise<ToolResult> {
    editorControl.broadcast('delete_selected', {});
    return { success: true };
  },

  async select_clip(params: { clipId: string | null }): Promise<ToolResult> {
    editorControl.broadcast('select_clip', params);
    return { success: true };
  },

  async add_marker(params: { time: number; label: string; color?: string }): Promise<ToolResult> {
    editorControl.broadcast('add_marker', params);
    return { success: true };
  },

  async add_caption(params: { startTime: number; endTime: number; text: string }): Promise<ToolResult> {
    editorControl.broadcast('add_caption', params);
    return { success: true };
  },

  async import_media(params: { name: string; type: string; src: string; duration: number; thumbnail?: string }): Promise<ToolResult> {
    const mediaId = `media_${Date.now()}`;
    editorControl.broadcast('import_media', { ...params, mediaId });
    return { success: true, data: { mediaId } };
  },

  async add_generated_content(params: { type: string; name: string; src: string; duration: number; thumbnail?: string }): Promise<ToolResult> {
    editorControl.broadcast('add_generated', params);
    return { success: true };
  },

  async undo_action(): Promise<ToolResult> {
    editorControl.broadcast('undo', {});
    return { success: true };
  },

  async redo_action(): Promise<ToolResult> {
    editorControl.broadcast('redo', {});
    return { success: true };
  },

  async clear_timeline(): Promise<ToolResult> {
    editorControl.broadcast('clear_timeline', {});
    return { success: true };
  },
};
