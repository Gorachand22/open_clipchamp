export type MediaType = 'video' | 'audio' | 'image';

export interface MediaItem {
  id: string;
  name: string;
  type: MediaType;
  duration: number;
  thumbnail?: string;
  src?: string;
  width?: number;
  height?: number;
  file?: File;
}

export interface Keyframe {
  id: string;
  time: number;
  property: string;
  value: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bounce';
}

export interface TimelineClip {
  id: string;
  mediaId: string;
  trackId: string;
  startTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  transform: ClipTransform;
  filter?: string;
  effects?: string[];
  speed: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  keyframes?: Keyframe[];
  text?: TextContent;
  // New CapCut Pro features
  chromaKey?: ChromaKeySettings;
  blendingMode?: BlendingMode;
  motionPreset?: string;
  animation?: AnimationSettings;
  panZoom?: PanZoomSettings;
  beauty?: BeautySettings;
  colorGrade?: ColorGradeSettings;
  transition?: TransitionSettings;
}

export interface TextContent {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  backgroundColor: string;
  alignment: 'left' | 'center' | 'right';
  position: { x: number; y: number };
  animation?: string;
  outline?: TextOutline;
  shadow?: TextShadow;
}

export interface TextOutline {
  color: string;
  width: number;
}

export interface TextShadow {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface ClipTransform {
  fit: boolean;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  opacity: number;
  scale: number;
  positionX: number;
  positionY: number;
}

export interface ChromaKeySettings {
  enabled: boolean;
  keyColor: string; // hex color
  similarity: number; // 0-100
  smoothness: number; // 0-100
  feather: number; // 0-100
}

export type BlendingMode = 
  | 'normal' 
  | 'multiply' 
  | 'screen' 
  | 'overlay' 
  | 'darken' 
  | 'lighten' 
  | 'color-dodge' 
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion';

export interface AnimationSettings {
  entrance?: string;
  exit?: string;
  emphasis?: string;
  duration: number;
  delay: number;
}

export interface PanZoomSettings {
  enabled: boolean;
  startX: number;
  startY: number;
  startScale: number;
  endX: number;
  endY: number;
  endScale: number;
  easing: string;
}

export interface BeautySettings {
  enabled: boolean;
  smoothSkin: number; // 0-100
  brightenEyes: number; // 0-100
  whitenTeeth: number; // 0-100
  slimFace: number; // 0-100
  enlargeEyes: number; // 0-100
  sharpen: number; // 0-100
}

export interface ColorGradeSettings {
  preset?: string;
  exposure: number; // -100 to 100
  contrast: number; // -100 to 100
  saturation: number; // -100 to 100
  temperature: number; // -100 to 100 (cool to warm)
  tint: number; // -100 to 100 (green to magenta)
  vibrance: number; // -100 to 100
  highlights: number; // -100 to 100
  shadows: number; // -100 to 100
  vignette: number; // 0-100
}

export interface TransitionSettings {
  type: string;
  duration: number;
  easing: string;
}

export interface Track {
  id: string;
  type: 'video' | 'audio' | 'overlay';
  name: string;
  clips: TimelineClip[];
  muted: boolean;
  locked: boolean;
  visible: boolean;
  height: number;
  blendingMode?: BlendingMode;
}

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5' | '21:9';

export interface ExportSettings {
  quality: '480p' | '720p' | '1080p' | '4K';
  format: 'mp4' | 'webm' | 'gif';
  fps: 24 | 30 | 60;
  removeWatermark: boolean;
}

export interface Marker {
  id: string;
  time: number;
  label: string;
  color: string;
}

export interface Caption {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  style: CaptionStyle;
}

export interface CaptionStyle {
  font: string;
  size: number;
  color: string;
  backgroundColor: string;
  position: 'top' | 'center' | 'bottom';
  animation: string;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  platform: 'tiktok' | 'instagram' | 'youtube' | 'general';
  aspectRatio: AspectRatio;
  duration: number;
  thumbnail: string;
  presets: TemplatePreset[];
}

export interface TemplatePreset {
  type: 'text' | 'effect' | 'transition' | 'music';
  data: Record<string, unknown>;
}

export interface MusicTrack {
  id: string;
  name: string;
  artist: string;
  duration: number;
  genre: string;
  mood: string;
  bpm: number;
  waveform: number[];
  src: string;
}

export interface Sticker {
  id: string;
  name: string;
  category: string;
  emoji?: string;
  image?: string;
  animated: boolean;
}

export interface MotionPreset {
  id: string;
  name: string;
  category: 'entrance' | 'exit' | 'emphasis' | 'path';
  keyframes: Keyframe[];
  duration: number;
}

export interface EditorState {
  // Media library
  mediaLibrary: MediaItem[];
  
  // Timeline
  tracks: Track[];
  markers: Marker[];
  captions: Caption[];
  
  // Selection
  selectedClipId: string | null;
  selectedMediaId: string | null;
  selectedTrackId: string | null;
  
  // Playback
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  
  // Timeline zoom and scroll
  zoom: number;
  scrollPosition: number;
  snapEnabled: boolean;
  snapThreshold: number;
  
  // Preview
  aspectRatio: AspectRatio;
  isFullscreen: boolean;
  
  // UI state
  activeMediaTab: string;
  activePropertyTab: string;
  showShortcuts: boolean;
  showTemplates: boolean;
  showMusicLibrary: boolean;
  showStickers: boolean;
  showAutoCaptions: boolean;
  
  // Export
  exportSettings: ExportSettings;
  
  // History for undo/redo
  history: Partial<EditorState>[];
  historyIndex: number;
  
  // Actions
  addMedia: (media: MediaItem) => void;
  removeMedia: (id: string) => void;
  
  addClipToTrack: (trackId: string, clip: Omit<TimelineClip, 'id' | 'trackId' | 'transform'>) => void;
  removeClip: (clipId: string) => void;
  moveClip: (clipId: string, newStartTime: number, newTrackId?: string) => void;
  updateClipDuration: (clipId: string, duration: number, trimStart?: number, trimEnd?: number) => void;
  updateClipTransform: (clipId: string, transform: Partial<ClipTransform>) => void;
  updateClipProperty: (clipId: string, property: string, value: unknown) => void;
  updateClipChromaKey: (clipId: string, settings: Partial<ChromaKeySettings>) => void;
  updateClipColorGrade: (clipId: string, settings: Partial<ColorGradeSettings>) => void;
  updateClipBeauty: (clipId: string, settings: Partial<BeautySettings>) => void;
  updateClipPanZoom: (clipId: string, settings: Partial<PanZoomSettings>) => void;
  updateClipAnimation: (clipId: string, settings: Partial<AnimationSettings>) => void;
  
  selectClip: (clipId: string | null) => void;
  selectMedia: (mediaId: string | null) => void;
  selectTrack: (trackId: string | null) => void;
  
  setCurrentTime: (time: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setVolume: (volume: number) => void;
  
  setZoom: (zoom: number) => void;
  setScrollPosition: (position: number) => void;
  zoomToFit: () => void;
  
  setAspectRatio: (ratio: AspectRatio) => void;
  setFullscreen: (fullscreen: boolean) => void;
  
  setActiveMediaTab: (tab: string) => void;
  setActivePropertyTab: (tab: string) => void;
  setShowShortcuts: (show: boolean) => void;
  
  addTrack: (type: 'video' | 'audio' | 'overlay') => void;
  removeTrack: (trackId: string) => void;
  toggleTrackMute: (trackId: string) => void;
  toggleTrackLock: (trackId: string) => void;
  
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
  
  splitClipAtPlayhead: () => void;
  deleteSelectedClip: () => void;
  
  addMarker: (time: number, label: string) => void;
  removeMarker: (id: string) => void;
  
  addCaption: (caption: Omit<Caption, 'id'>) => void;
  updateCaption: (id: string, caption: Partial<Caption>) => void;
  removeCaption: (id: string) => void;
  autoGenerateCaptions: () => void;
  
  applyTemplate: (template: Template) => void;
  applyMotionPreset: (clipId: string, preset: MotionPreset) => void;
  
  setExportSettings: (settings: Partial<ExportSettings>) => void;
  
  getMediaById: (id: string) => MediaItem | undefined;
  getClipById: (id: string) => TimelineClip | undefined;
  getTrackById: (id: string) => Track | undefined;
  getActiveClipAtTime: (time: number) => TimelineClip | undefined;
  getSnappedTime: (time: number, excludeClipId?: string) => number;
}

// Default clip transform
export const defaultClipTransform: ClipTransform = {
  fit: true,
  rotation: 0,
  flipH: false,
  flipV: false,
  opacity: 1,
  scale: 1,
  positionX: 0,
  positionY: 0,
};

// Default chroma key settings
export const defaultChromaKey: ChromaKeySettings = {
  enabled: false,
  keyColor: '#00ff00',
  similarity: 50,
  smoothness: 50,
  feather: 10,
};

// Default color grade settings
export const defaultColorGrade: ColorGradeSettings = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  vibrance: 0,
  highlights: 0,
  shadows: 0,
  vignette: 0,
};

// Default beauty settings
export const defaultBeauty: BeautySettings = {
  enabled: false,
  smoothSkin: 0,
  brightenEyes: 0,
  whitenTeeth: 0,
  slimFace: 0,
  enlargeEyes: 0,
  sharpen: 0,
};

// Default pan/zoom settings
export const defaultPanZoom: PanZoomSettings = {
  enabled: false,
  startX: 50,
  startY: 50,
  startScale: 1,
  endX: 50,
  endY: 50,
  endScale: 1,
  easing: 'ease-in-out',
};

// Default animation settings
export const defaultAnimation: AnimationSettings = {
  entrance: '',
  exit: '',
  emphasis: '',
  duration: 0.5,
  delay: 0,
};

// Time formatting utilities
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
}

export function formatTimeShort(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatTimeCode(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
}

// Aspect ratio dimensions
export const aspectRatioDimensions: Record<AspectRatio, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '21:9': { width: 2560, height: 1080 },
};

// Platform presets
export const platformPresets = {
  tiktok: { aspectRatio: '9:16' as AspectRatio, maxWidth: 1080, maxHeight: 1920 },
  instagram_reels: { aspectRatio: '9:16' as AspectRatio, maxWidth: 1080, maxHeight: 1920 },
  instagram_stories: { aspectRatio: '9:16' as AspectRatio, maxWidth: 1080, maxHeight: 1920 },
  instagram_post: { aspectRatio: '1:1' as AspectRatio, maxWidth: 1080, maxHeight: 1080 },
  youtube_shorts: { aspectRatio: '9:16' as AspectRatio, maxWidth: 1080, maxHeight: 1920 },
  youtube: { aspectRatio: '16:9' as AspectRatio, maxWidth: 1920, maxHeight: 1080 },
};

// Motion presets
export const motionPresets: MotionPreset[] = [
  { id: 'fade-in', name: 'Fade In', category: 'entrance', duration: 0.5, keyframes: [] },
  { id: 'slide-left', name: 'Slide from Left', category: 'entrance', duration: 0.5, keyframes: [] },
  { id: 'slide-right', name: 'Slide from Right', category: 'entrance', duration: 0.5, keyframes: [] },
  { id: 'slide-up', name: 'Slide from Bottom', category: 'entrance', duration: 0.5, keyframes: [] },
  { id: 'slide-down', name: 'Slide from Top', category: 'entrance', duration: 0.5, keyframes: [] },
  { id: 'zoom-in', name: 'Zoom In', category: 'entrance', duration: 0.5, keyframes: [] },
  { id: 'spin-in', name: 'Spin In', category: 'entrance', duration: 0.5, keyframes: [] },
  { id: 'bounce-in', name: 'Bounce In', category: 'entrance', duration: 0.6, keyframes: [] },
  { id: 'fade-out', name: 'Fade Out', category: 'exit', duration: 0.5, keyframes: [] },
  { id: 'slide-out-left', name: 'Slide Out Left', category: 'exit', duration: 0.5, keyframes: [] },
  { id: 'slide-out-right', name: 'Slide Out Right', category: 'exit', duration: 0.5, keyframes: [] },
  { id: 'zoom-out', name: 'Zoom Out', category: 'exit', duration: 0.5, keyframes: [] },
  { id: 'spin-out', name: 'Spin Out', category: 'exit', duration: 0.5, keyframes: [] },
  { id: 'pulse', name: 'Pulse', category: 'emphasis', duration: 0.6, keyframes: [] },
  { id: 'shake', name: 'Shake', category: 'emphasis', duration: 0.5, keyframes: [] },
  { id: 'wiggle', name: 'Wiggle', category: 'emphasis', duration: 0.5, keyframes: [] },
  { id: 'float', name: 'Float', category: 'emphasis', duration: 1, keyframes: [] },
  { id: 'heartbeat', name: 'Heartbeat', category: 'emphasis', duration: 0.6, keyframes: [] },
];

// Transitions
export const transitions = [
  { id: 'none', name: 'None', icon: '○', category: 'basic' },
  { id: 'fade', name: 'Fade', icon: '◐', category: 'basic' },
  { id: 'dissolve', name: 'Dissolve', icon: '◑', category: 'basic' },
  { id: 'wipe-left', name: 'Wipe Left', icon: '◀', category: 'wipe' },
  { id: 'wipe-right', name: 'Wipe Right', icon: '▶', category: 'wipe' },
  { id: 'wipe-up', name: 'Wipe Up', icon: '△', category: 'wipe' },
  { id: 'wipe-down', name: 'Wipe Down', icon: '▽', category: 'wipe' },
  { id: 'zoom', name: 'Zoom', icon: '⊕', category: 'motion' },
  { id: 'zoom-blur', name: 'Zoom Blur', icon: '◎', category: 'motion' },
  { id: 'spin', name: 'Spin', icon: '↻', category: 'motion' },
  { id: 'slide-left', name: 'Slide Left', icon: '⏵', category: 'slide' },
  { id: 'slide-right', name: 'Slide Right', icon: '⏴', category: 'slide' },
  { id: 'push', name: 'Push', icon: '⏩', category: 'slide' },
  { id: 'glitch', name: 'Glitch', icon: '⚌', category: 'effects' },
  { id: 'flash', name: 'Flash', icon: '⚡', category: 'effects' },
  { id: 'blur', name: 'Blur', icon: '◌', category: 'effects' },
  { id: 'pixelate', name: 'Pixelate', icon: '▦', category: 'effects' },
  { id: 'luma', name: 'Luma Fade', icon: '◈', category: 'advanced' },
  { id: 'morph', name: 'Morph', icon: '◇', category: 'advanced' },
];

// Text animations
export const textAnimations = [
  { id: 'typewriter', name: 'Typewriter', category: 'entrance' },
  { id: 'fade-in-up', name: 'Fade In Up', category: 'entrance' },
  { id: 'bounce-in', name: 'Bounce In', category: 'entrance' },
  { id: 'scale-in', name: 'Scale In', category: 'entrance' },
  { id: 'slide-in-left', name: 'Slide In Left', category: 'entrance' },
  { id: 'slide-in-right', name: 'Slide In Right', category: 'entrance' },
  { id: 'glitch-in', name: 'Glitch In', category: 'entrance' },
  { id: 'wave', name: 'Wave', category: 'emphasis' },
  { id: 'jitter', name: 'Jitter', category: 'emphasis' },
  { id: 'rainbow', name: 'Rainbow', category: 'emphasis' },
  { id: 'neon-pulse', name: 'Neon Pulse', category: 'emphasis' },
];

// Color grading presets (cinematic looks)
export const colorGradePresets = [
  { id: 'none', name: 'None', settings: {} },
  { id: 'cinematic', name: 'Cinematic', settings: { contrast: 15, saturation: -10, highlights: -10, shadows: 5 } },
  { id: 'vintage', name: 'Vintage', settings: { saturation: -20, temperature: 20, vignette: 30 } },
  { id: 'warm', name: 'Warm Sunset', settings: { temperature: 30, saturation: 10 } },
  { id: 'cool', name: 'Cool Blue', settings: { temperature: -30, saturation: 5 } },
  { id: 'noir', name: 'Film Noir', settings: { saturation: -100, contrast: 30, vignette: 40 } },
  { id: 'teal-orange', name: 'Teal & Orange', settings: { temperature: -10, tint: 20, contrast: 15 } },
  { id: 'bright', name: 'Bright & Airy', settings: { exposure: 10, contrast: -10, highlights: -15 } },
  { id: 'moody', name: 'Moody', settings: { exposure: -10, contrast: 20, saturation: -15, vignette: 25 } },
  { id: 'retro', name: 'Retro 80s', settings: { contrast: 20, saturation: 20, temperature: 10 } },
  { id: 'natural', name: 'Natural', settings: { contrast: 5, saturation: 5 } },
  { id: 'dramatic', name: 'Dramatic', settings: { contrast: 35, saturation: -5, highlights: -20, shadows: 10 } },
];

// Stickers library
export const stickersLibrary: Sticker[] = [
  // Emojis
  { id: 'emoji-fire', name: 'Fire', category: 'emoji', emoji: '🔥', animated: false },
  { id: 'emoji-heart', name: 'Heart', category: 'emoji', emoji: '❤️', animated: false },
  { id: 'emoji-star', name: 'Star', category: 'emoji', emoji: '⭐', animated: false },
  { id: 'emoji-sparkles', name: 'Sparkles', category: 'emoji', emoji: '✨', animated: false },
  { id: 'emoji-thumbsup', name: 'Thumbs Up', category: 'emoji', emoji: '👍', animated: false },
  { id: 'emoji-rocket', name: 'Rocket', category: 'emoji', emoji: '🚀', animated: false },
  { id: 'emoji-100', name: '100', category: 'emoji', emoji: '💯', animated: false },
  { id: 'emoji-party', name: 'Party', category: 'emoji', emoji: '🎉', animated: false },
  { id: 'emoji-clap', name: 'Clap', category: 'emoji', emoji: '👏', animated: false },
  { id: 'emoji-crown', name: 'Crown', category: 'emoji', emoji: '👑', animated: false },
  // Shapes
  { id: 'shape-circle', name: 'Circle', category: 'shapes', emoji: '⭕', animated: false },
  { id: 'shape-star', name: 'Star Shape', category: 'shapes', emoji: '☆', animated: false },
  { id: 'shape-diamond', name: 'Diamond', category: 'shapes', emoji: '💎', animated: false },
  // Arrows
  { id: 'arrow-right', name: 'Arrow Right', category: 'arrows', emoji: '➡️', animated: false },
  { id: 'arrow-up', name: 'Arrow Up', category: 'arrows', emoji: '⬆️', animated: false },
  { id: 'arrow-down', name: 'Arrow Down', category: 'arrows', emoji: '⬇️', animated: false },
  // Social
  { id: 'social-follow', name: 'Follow', category: 'social', emoji: '➕', animated: false },
  { id: 'social-like', name: 'Like', category: 'social', emoji: '💗', animated: false },
  { id: 'social-subscribe', name: 'Subscribe', category: 'social', emoji: '🔔', animated: false },
];

// Blending modes
export const blendingModes: { id: BlendingMode; name: string }[] = [
  { id: 'normal', name: 'Normal' },
  { id: 'multiply', name: 'Multiply' },
  { id: 'screen', name: 'Screen' },
  { id: 'overlay', name: 'Overlay' },
  { id: 'darken', name: 'Darken' },
  { id: 'lighten', name: 'Lighten' },
  { id: 'color-dodge', name: 'Color Dodge' },
  { id: 'color-burn', name: 'Color Burn' },
  { id: 'hard-light', name: 'Hard Light' },
  { id: 'soft-light', name: 'Soft Light' },
  { id: 'difference', name: 'Difference' },
  { id: 'exclusion', name: 'Exclusion' },
];

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = [
  { key: 'Space', action: 'Play/Pause', description: 'Toggle playback' },
  { key: 'S', action: 'Split', description: 'Split clip at playhead' },
  { key: 'Delete', action: 'Delete', description: 'Delete selected clip' },
  { key: 'Backspace', action: 'Delete', description: 'Delete selected clip' },
  { key: 'Ctrl+Z', action: 'Undo', description: 'Undo last action' },
  { key: 'Ctrl+Shift+Z', action: 'Redo', description: 'Redo last action' },
  { key: 'Ctrl+Y', action: 'Redo', description: 'Redo last action' },
  { key: '←', action: 'Previous Frame', description: 'Move one frame back' },
  { key: '→', action: 'Next Frame', description: 'Move one frame forward' },
  { key: 'Shift+←', action: 'Back 5s', description: 'Move 5 seconds back' },
  { key: 'Shift+→', action: 'Forward 5s', description: 'Move 5 seconds forward' },
  { key: 'Home', action: 'Start', description: 'Go to beginning' },
  { key: 'End', action: 'End', description: 'Go to end' },
  { key: 'Ctrl++', action: 'Zoom In', description: 'Zoom in timeline' },
  { key: 'Ctrl+-', action: 'Zoom Out', description: 'Zoom out timeline' },
  { key: 'Ctrl+0', action: 'Fit', description: 'Zoom to fit' },
  { key: 'M', action: 'Mute', description: 'Mute/unmute selected track' },
  { key: 'L', action: 'Lock', description: 'Lock/unlock selected track' },
  { key: 'T', action: 'Add Text', description: 'Add text overlay' },
  { key: 'C', action: 'Chroma Key', description: 'Toggle chroma key' },
  { key: 'K', action: 'Keyframe', description: 'Add keyframe' },
  { key: '?', action: 'Shortcuts', description: 'Show keyboard shortcuts' },
];
