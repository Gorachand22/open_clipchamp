import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { MediaItem, TimelineClip, Track, EditorState, AspectRatio, ClipTransform, ExportSettings, Marker, Caption, ChromaKeySettings, ColorGradeSettings, BeautySettings, PanZoomSettings, AnimationSettings, Template, MotionPreset } from '@/types/editor';
import { defaultClipTransform, defaultChromaKey, defaultColorGrade, defaultBeauty, defaultPanZoom, defaultAnimation } from '@/types/editor';

// Sample media items with actual demo content
const sampleMedia: MediaItem[] = [
  {
    id: 'media-1',
    name: 'Sunset Beach',
    type: 'video',
    duration: 15,
    thumbnail: '/thumbnails/sunset.jpg',
    width: 1920,
    height: 1080,
  },
  {
    id: 'media-2',
    name: 'Abstract Waves',
    type: 'video',
    duration: 12,
    thumbnail: '/thumbnails/ribbons.jpg',
    width: 1920,
    height: 1080,
  },
  {
    id: 'media-3',
    name: 'City Timelapse',
    type: 'video',
    duration: 8,
    thumbnail: '/thumbnails/camera.jpg',
    width: 1920,
    height: 1080,
  },
  {
    id: 'media-4',
    name: 'Gradient Background',
    type: 'image',
    duration: 5,
    thumbnail: '/thumbnails/gradient.jpg',
    width: 1920,
    height: 1080,
  },
  {
    id: 'media-5',
    name: 'Abstract Bubble',
    type: 'image',
    duration: 5,
    thumbnail: '/thumbnails/bubble.jpg',
    width: 1920,
    height: 1080,
  },
  {
    id: 'media-6',
    name: 'Mountain Landscape',
    type: 'image',
    duration: 5,
    thumbnail: '/thumbnails/landscape.jpg',
    width: 1920,
    height: 1080,
  },
  {
    id: 'media-7',
    name: 'Soft Guitar Music',
    type: 'audio',
    duration: 30,
    thumbnail: '/thumbnails/audio.jpg',
  },
  {
    id: 'media-8',
    name: 'Nature Walk',
    type: 'video',
    duration: 20,
    thumbnail: '/thumbnails/nature.jpg',
    width: 1920,
    height: 1080,
  },
];

// Initial tracks with proper heights
const initialTracks: Track[] = [
  {
    id: 'track-overlay-1',
    type: 'overlay',
    name: 'Text',
    clips: [],
    muted: false,
    locked: false,
    visible: true,
    height: 48,
  },
  {
    id: 'track-video-1',
    type: 'video',
    name: 'Video 1',
    clips: [],
    muted: false,
    locked: false,
    visible: true,
    height: 64,
  },
  {
    id: 'track-audio-1',
    type: 'audio',
    name: 'Audio 1',
    clips: [],
    muted: false,
    locked: false,
    visible: true,
    height: 56,
  },
];

const defaultExportSettings: ExportSettings = {
  quality: '1080p',
  format: 'mp4',
  fps: 30,
  removeWatermark: true,
};

// Calculate total duration from all clips exactly
function calculateDuration(tracks: Track[]): number {
  let maxEnd = 0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      const clipEnd = clip.startTime + clip.duration;
      if (clipEnd > maxEnd) maxEnd = clipEnd;
    }
  }
  // Minimum 5 seconds if completely empty
  return Math.max(5, maxEnd);
}

// History state type
interface HistoryState {
  tracks: Track[];
  selectedClipId: string | null;
  currentTime: number;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  mediaLibrary: sampleMedia,
  tracks: initialTracks,
  markers: [],
  captions: [],
  selectedClipId: null,
  selectedMediaId: null,
  selectedTrackId: null,
  currentTime: 0,
  duration: 5,
  isPlaying: false,
  volume: 1,
  zoom: 50,
  scrollPosition: 0,
  aspectRatio: '16:9',
  isFullscreen: false,
  activeMediaTab: 'your-media',
  activePropertyTab: 'filters',
  showShortcuts: false,
  showTemplates: false,
  showMusicLibrary: false,
  showStickers: false,
  showAutoCaptions: false,
  exportSettings: defaultExportSettings,
  history: [] as HistoryState[],
  historyIndex: -1,
  snapEnabled: true,
  snapThreshold: 10,

  addMedia: (media) => {
    set((state) => ({
      mediaLibrary: [...state.mediaLibrary, { ...media, id: media.id || uuidv4() }],
    }));
  },

  removeMedia: (id) => {
    set((state) => {
      const newTracks = state.tracks.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => c.mediaId !== id),
      }));
      return {
        mediaLibrary: state.mediaLibrary.filter((m) => m.id !== id),
        tracks: newTracks,
        duration: calculateDuration(newTracks),
        selectedMediaId: state.selectedMediaId === id ? null : state.selectedMediaId,
        selectedClipId: state.selectedClipId && newTracks.some(t => t.clips.some(c => c.id === state.selectedClipId))
          ? state.selectedClipId
          : null,
      };
    });
  },

  addClipToTrack: (trackId, clipData) => {
    const state = get();
    const track = state.tracks.find((t) => t.id === trackId);
    if (!track) return;

    let media = state.mediaLibrary.find((m) => m.id === clipData.mediaId);

    // Auto-create placeholder media entry if not found — allows MCP add_clip to work
    if (!media) {
      const placeholder: MediaItem = {
        id: clipData.mediaId,
        name: (clipData as any).mediaName || clipData.mediaId,
        type: (clipData as any).mediaType || 'video',
        duration: clipData.duration || 10,
        src: (clipData as any).src,
        thumbnail: (clipData as any).thumbnail,
      };
      const newMediaLibrary = [...state.mediaLibrary, placeholder];
      set({ mediaLibrary: newMediaLibrary });
      media = placeholder;
    }

    let optimalStartTime = clipData.startTime;
    if (track.clips.length > 0) {
      const lastClipEnd = Math.max(...track.clips.map(c => c.startTime + c.duration));
      optimalStartTime = Math.max(clipData.startTime, lastClipEnd);
    }

    const newClip: TimelineClip = {
      id: uuidv4(),
      trackId,
      mediaId: clipData.mediaId,
      startTime: optimalStartTime,
      duration: clipData.duration || media.duration,
      trimStart: clipData.trimStart || 0,
      trimEnd: clipData.trimEnd || 0,
      transform: { ...defaultClipTransform },
      speed: 1,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
      chromaKey: { ...defaultChromaKey },
      colorGrade: { ...defaultColorGrade },
      beauty: { ...defaultBeauty },
      panZoom: { ...defaultPanZoom },
      animation: { ...defaultAnimation },
    };

    set((state) => {
      const newTracks = state.tracks.map((t) =>
        t.id === trackId ? { ...t, clips: [...t.clips, newClip] } : t
      );
      return {
        tracks: newTracks,
        duration: calculateDuration(newTracks),
        selectedClipId: newClip.id,
      };
    });
  },

  removeClip: (clipId) => {
    set((state) => {
      const newTracks = state.tracks.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => c.id !== clipId),
      }));
      return {
        tracks: newTracks,
        duration: calculateDuration(newTracks),
        selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId,
      };
    });
  },

  moveClip: (clipId, newStartTime, newTrackId) => {
    set((state) => {
      const tracks = [...state.tracks];
      let clipToMove: TimelineClip | null = null;

      for (let i = 0; i < tracks.length; i++) {
        const clipIndex = tracks[i].clips.findIndex((c) => c.id === clipId);
        if (clipIndex !== -1) {
          clipToMove = { ...tracks[i].clips[clipIndex], startTime: Math.max(0, newStartTime) };
          tracks[i] = { ...tracks[i], clips: tracks[i].clips.filter((c) => c.id !== clipId) };
          break;
        }
      }

      if (!clipToMove) return state;

      const targetTrackId = newTrackId || clipToMove.trackId;
      const targetTrackIndex = tracks.findIndex((t) => t.id === targetTrackId);

      if (targetTrackIndex !== -1) {
        tracks[targetTrackIndex] = {
          ...tracks[targetTrackIndex],
          clips: [...tracks[targetTrackIndex].clips, { ...clipToMove, trackId: targetTrackId }],
        };
      }

      return { tracks, duration: calculateDuration(tracks) };
    });
  },

  updateClipDuration: (clipId, duration, trimStart, trimEnd) => {
    set((state) => {
      const newTracks = state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId
            ? { ...c, duration: Math.max(0.1, duration), trimStart: trimStart ?? c.trimStart, trimEnd: trimEnd ?? c.trimEnd }
            : c
        ),
      }));
      return { tracks: newTracks, duration: calculateDuration(newTracks) };
    });
  },

  updateClipTransform: (clipId, transform) => {
    set((state) => ({
      tracks: state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId ? { ...c, transform: { ...c.transform, ...transform } } : c
        ),
      })),
    }));
  },

  updateClipProperty: (clipId, property, value) => {
    set((state) => ({
      tracks: state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId ? { ...c, [property]: value } : c
        ),
      })),
    }));
  },

  updateClipChromaKey: (clipId, settings) => {
    set((state) => ({
      tracks: state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId ? { ...c, chromaKey: { ...c.chromaKey, ...settings } } : c
        ),
      })),
    }));
  },

  updateClipColorGrade: (clipId, settings) => {
    set((state) => ({
      tracks: state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId ? { ...c, colorGrade: { ...c.colorGrade, ...settings } } : c
        ),
      })),
    }));
  },

  updateClipBeauty: (clipId, settings) => {
    set((state) => ({
      tracks: state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId ? { ...c, beauty: { ...c.beauty, ...settings } } : c
        ),
      })),
    }));
  },

  updateClipPanZoom: (clipId, settings) => {
    set((state) => ({
      tracks: state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId ? { ...c, panZoom: { ...c.panZoom, ...settings } } : c
        ),
      })),
    }));
  },

  updateClipAnimation: (clipId, settings) => {
    set((state) => ({
      tracks: state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId ? { ...c, animation: { ...c.animation, ...settings } } : c
        ),
      })),
    }));
  },

  selectClip: (clipId) => set({ selectedClipId: clipId, selectedMediaId: null }),
  selectMedia: (mediaId) => set({ selectedMediaId: mediaId, selectedClipId: null }),
  selectTrack: (trackId) => set({ selectedTrackId: trackId }),

  setCurrentTime: (time) => {
    const state = get();
    set({ currentTime: Math.max(0, Math.min(time, state.duration)) });
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),

  setZoom: (zoom) => set({ zoom: Math.max(10, Math.min(200, zoom)) }),
  setScrollPosition: (position) => set({ scrollPosition: Math.max(0, position) }),

  zoomToFit: () => {
    const state = get();
    const maxEndTime = Math.max(...state.tracks.flatMap((t) => t.clips.map((c) => c.startTime + c.duration)), 30);
    const timelineWidth = 800;
    set({ zoom: Math.max(10, Math.min(200, timelineWidth / maxEndTime)) });
  },

  setAspectRatio: (ratio: AspectRatio) => set({ aspectRatio: ratio }),
  setFullscreen: (fullscreen: boolean) => set({ isFullscreen: fullscreen }),
  setActiveMediaTab: (tab: string) => set({ activeMediaTab: tab }),
  setActivePropertyTab: (tab: string) => set({ activePropertyTab: tab }),
  setShowShortcuts: (show: boolean) => set({ showShortcuts: show }),

  addTrack: (type) => {
    const state = get();
    const trackCount = state.tracks.filter((t) => t.type === type).length;
    const newTrack: Track = {
      id: `track-${type}-${uuidv4()}`,
      type,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${trackCount + 1}`,
      clips: [],
      muted: false,
      locked: false,
      visible: true,
      height: type === 'audio' ? 56 : 64,
    };
    set((state) => ({ tracks: [...state.tracks, newTrack] }));
  },

  removeTrack: (trackId) => {
    const state = get();
    const track = state.tracks.find(t => t.id === trackId);
    if (!track) return;

    const sameTypeCount = state.tracks.filter(t => t.type === track.type).length;
    if (sameTypeCount <= 1) return;

    set((state) => ({
      tracks: state.tracks.filter((t) => t.id !== trackId),
      selectedTrackId: state.selectedTrackId === trackId ? null : state.selectedTrackId,
    }));
  },

  toggleTrackMute: (trackId) => {
    set((state) => ({
      tracks: state.tracks.map((t) => t.id === trackId ? { ...t, muted: !t.muted } : t),
    }));
  },

  toggleTrackLock: (trackId) => {
    set((state) => ({
      tracks: state.tracks.map((t) => t.id === trackId ? { ...t, locked: !t.locked } : t),
    }));
  },

  undo: () => {
    const state = get();
    if (state.historyIndex > 0) {
      const prevState = state.history[state.historyIndex - 1];
      set({
        tracks: prevState.tracks,
        selectedClipId: prevState.selectedClipId,
        currentTime: prevState.currentTime,
        historyIndex: state.historyIndex - 1
      });
    }
  },

  redo: () => {
    const state = get();
    if (state.historyIndex < state.history.length - 1) {
      const nextState = state.history[state.historyIndex + 1];
      set({
        tracks: nextState.tracks,
        selectedClipId: nextState.selectedClipId,
        currentTime: nextState.currentTime,
        historyIndex: state.historyIndex + 1
      });
    }
  },

  saveToHistory: () => {
    const state = get();
    const currentState: HistoryState = {
      tracks: JSON.parse(JSON.stringify(state.tracks)),
      selectedClipId: state.selectedClipId,
      currentTime: state.currentTime
    };
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(currentState);
    if (newHistory.length > 50) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  splitClipAtPlayhead: () => {
    const state = get();
    const { currentTime, tracks } = state;

    for (const track of tracks) {
      if (track.locked) continue;
      for (const clip of track.clips) {
        const clipEnd = clip.startTime + clip.duration;
        if (currentTime > clip.startTime + 0.1 && currentTime < clipEnd - 0.1) {
          const currentState: HistoryState = {
            tracks: JSON.parse(JSON.stringify(tracks)),
            selectedClipId: state.selectedClipId,
            currentTime: state.currentTime
          };
          const newHistory = state.history.slice(0, state.historyIndex + 1);
          newHistory.push(currentState);

          const firstPart: TimelineClip = { ...clip, duration: currentTime - clip.startTime };
          const secondPart: TimelineClip = {
            ...clip,
            id: uuidv4(),
            startTime: currentTime,
            duration: clipEnd - currentTime,
            trimStart: clip.trimStart + (currentTime - clip.startTime),
          };

          set({
            tracks: tracks.map((t) =>
              t.id === track.id
                ? { ...t, clips: t.clips.filter((c) => c.id !== clip.id).concat([firstPart, secondPart]) }
                : t
            ),
            history: newHistory.length > 50 ? newHistory.slice(-50) : newHistory,
            historyIndex: newHistory.length > 50 ? 49 : newHistory.length - 1,
          });
          return;
        }
      }
    }
  },

  deleteSelectedClip: () => {
    const state = get();
    if (state.selectedClipId) {
      const currentState: HistoryState = {
        tracks: JSON.parse(JSON.stringify(state.tracks)),
        selectedClipId: state.selectedClipId,
        currentTime: state.currentTime
      };
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(currentState);

      const newTracks = state.tracks.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => c.id !== state.selectedClipId),
      }));

      set({
        tracks: newTracks,
        duration: calculateDuration(newTracks),
        selectedClipId: null,
        history: newHistory.length > 50 ? newHistory.slice(-50) : newHistory,
        historyIndex: newHistory.length > 50 ? 49 : newHistory.length - 1,
      });
    }
  },

  addMarker: (time: number, label: string) => {
    const marker: Marker = { id: uuidv4(), time, label, color: '#ef4444' };
    set((state) => ({ markers: [...state.markers, marker] }));
  },

  removeMarker: (id: string) => {
    set((state) => ({ markers: state.markers.filter((m) => m.id !== id) }));
  },

  addCaption: (caption) => {
    const newCaption: Caption = { ...caption, id: uuidv4() };
    set((state) => ({ captions: [...state.captions, newCaption] }));
  },

  updateCaption: (id, caption) => {
    set((state) => ({
      captions: state.captions.map((c) => c.id === id ? { ...c, ...caption } : c),
    }));
  },

  removeCaption: (id: string) => {
    set((state) => ({ captions: state.captions.filter((c) => c.id !== id) }));
  },

  autoGenerateCaptions: () => {
    const state = get();
    // Generate mock captions from clips
    const newCaptions: Caption[] = [];
    state.tracks.forEach(track => {
      track.clips.forEach(clip => {
        const media = state.mediaLibrary.find(m => m.id === clip.mediaId);
        if (media && (media.type === 'video' || media.type === 'audio')) {
          // Create mock caption segments
          const numCaptions = Math.ceil(clip.duration / 3);
          for (let i = 0; i < numCaptions; i++) {
            newCaptions.push({
              id: uuidv4(),
              startTime: clip.startTime + i * 3,
              endTime: Math.min(clip.startTime + (i + 1) * 3, clip.startTime + clip.duration),
              text: `Caption ${newCaptions.length + 1}`,
              style: {
                font: 'Arial',
                size: 24,
                color: '#ffffff',
                backgroundColor: 'rgba(0,0,0,0.7)',
                position: 'bottom',
                animation: 'fade-in-up',
              },
            });
          }
        }
      });
    });
    set({ captions: newCaptions });
  },

  applyTemplate: (template: Template) => {
    set((state) => ({
      aspectRatio: template.aspectRatio,
      duration: template.duration,
    }));
  },

  applyMotionPreset: (clipId: string, preset: MotionPreset) => {
    set((state) => ({
      tracks: state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId ? { ...c, motionPreset: preset.id, animation: { ...c.animation, entrance: preset.id } } : c
        ),
      })),
    }));
  },

  setExportSettings: (settings: Partial<ExportSettings>) => {
    set((state) => ({ exportSettings: { ...state.exportSettings, ...settings } }));
  },

  getMediaById: (id) => get().mediaLibrary.find((m) => m.id === id),
  getClipById: (id) => {
    for (const track of get().tracks) {
      const clip = track.clips.find((c) => c.id === id);
      if (clip) return clip;
    }
    return undefined;
  },
  getTrackById: (id) => get().tracks.find((t) => t.id === id),
  getActiveClipAtTime: (time: number) => {
    for (const track of get().tracks) {
      if (track.type === 'video' || track.type === 'overlay') {
        for (const clip of track.clips) {
          if (time >= clip.startTime && time < clip.startTime + clip.duration) return clip;
        }
      }
    }
    return undefined;
  },

  getSnappedTime: (time: number, excludeClipId?: string) => {
    const state = get();
    if (!state.snapEnabled) return time;

    const snapThresholdTime = state.snapThreshold / state.zoom;
    const snapPoints: number[] = [0, state.currentTime];

    for (const track of state.tracks) {
      for (const clip of track.clips) {
        if (clip.id === excludeClipId) continue;
        snapPoints.push(clip.startTime);
        snapPoints.push(clip.startTime + clip.duration);
      }
    }

    let closestPoint = time;
    let closestDistance = Infinity;

    for (const point of snapPoints) {
      const distance = Math.abs(time - point);
      if (distance < closestDistance && distance < snapThresholdTime) {
        closestDistance = distance;
        closestPoint = point;
      }
    }

    return closestPoint;
  },
}));
