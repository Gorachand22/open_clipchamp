/**
 * Editor Control System - IDE to Editor Real-Time Interaction
 *
 * IMPORTANT: Uses globalThis singleton to ensure the SAME EventEmitter instance
 * is shared across all Next.js API routes (avoids module isolation issues in dev).
 */

import { EventEmitter } from 'events';

// =============================================================================
// Types
// =============================================================================
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
  clips?: ClipData[];
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

// =============================================================================
// Singleton via globalThis — survives Next.js HMR and route isolation
// =============================================================================
class EditorControlManager extends EventEmitter {
  private snapshot: EditorSnapshot | null = null;
  private clients = new Set<string>();

  constructor() {
    super();
    this.setMaxListeners(100); // prevent memory leak warnings
  }

  registerClient(id: string) {
    this.clients.add(id);
    console.log(`[EditorControl] Client connected: ${id} (total: ${this.clients.size})`);
  }

  unregisterClient(id: string) {
    this.clients.delete(id);
    console.log(`[EditorControl] Client disconnected: ${id} (total: ${this.clients.size})`);
  }

  getClientCount() {
    return this.clients.size;
  }

  getSnapshot(): EditorSnapshot | null {
    return this.snapshot;
  }

  updateSnapshot(s: EditorSnapshot) {
    this.snapshot = { ...s, timestamp: Date.now() };
    this.emit('snapshot', this.snapshot);
  }

  broadcast(type: string, data: unknown) {
    const msg = { type, data, timestamp: Date.now() };
    console.log(`[EditorControl] Broadcasting: ${type} to ${this.clients.size} clients`);
    this.emit('broadcast', msg);
  }
}

// Use globalThis to survive Next.js hot reloads and module re-imports
declare global {
  // eslint-disable-next-line no-var
  var __editorControl: EditorControlManager | undefined;
}

if (!global.__editorControl) {
  global.__editorControl = new EditorControlManager();
}

export const editorControl: EditorControlManager = global.__editorControl;

// =============================================================================
// Tool Result Type
// =============================================================================
interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// =============================================================================
// Editor Control Tools — called by MCP route
// =============================================================================
export const editorControlTools = {
  async get_editor_state(): Promise<ToolResult> {
    const snap = editorControl.getSnapshot();
    if (!snap) {
      return {
        success: false,
        error: 'Editor not connected. Open http://localhost:3000 in browser first.',
      };
    }
    return { success: true, data: snap };
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

  async add_generated_content(params: {
    type: string;
    name: string;
    src: string;
    duration: number;
    thumbnail?: string;
    startTime?: number;
  }): Promise<ToolResult> {
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
