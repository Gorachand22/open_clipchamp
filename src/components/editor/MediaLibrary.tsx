'use client';

import React, { useState, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  Video, Image, Music, Upload, Search, Clock,
  FileVideo, FileImage, FileAudio, Mic, Monitor, Camera, Type, Sparkles, Palette,
  Wand2, Sticker, Film, Play, Headphones, Subtitles, LayoutTemplate,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/store/editorStore';
import type { MediaItem, MediaType } from '@/types/editor';
import { formatTimeShort, motionPresets, stickersLibrary, transitions, textAnimations, colorGradePresets } from '@/types/editor';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// Text presets - compact
const textPresets = [
  { id: 'title-1', name: 'Title', preview: 'Aa', style: 'bold' },
  { id: 'subtitle-1', name: 'Subtitle', preview: 'Aa', style: 'medium' },
  { id: 'caption-1', name: 'Caption', preview: 'Aa', style: 'normal' },
  { id: 'headline', name: 'Headline', preview: 'HEAD', style: 'bold' },
  { id: 'lower-third', name: 'Lower Third', preview: '━━━', style: 'normal' },
  { id: 'quote', name: 'Quote', preview: '"', style: 'normal' },
];

// Templates - compact list
const templates = [
  { id: 'tiktok', name: 'TikTok', aspectRatio: '9:16', icon: '🎵' },
  { id: 'instagram-reel', name: 'IG Reel', aspectRatio: '9:16', icon: '🎬' },
  { id: 'instagram-story', name: 'IG Story', aspectRatio: '9:16', icon: '📸' },
  { id: 'instagram-post', name: 'IG Post', aspectRatio: '1:1', icon: '⬜' },
  { id: 'youtube-short', name: 'YT Short', aspectRatio: '9:16', icon: '▶️' },
  { id: 'youtube-video', name: 'YouTube', aspectRatio: '16:9', icon: '📺' },
  { id: 'cinematic', name: 'Cinematic', aspectRatio: '21:9', icon: '🎥' },
  { id: 'square', name: 'Square', aspectRatio: '1:1', icon: '◻️' },
];

// Music library (mock)
const musicLibrary = [
  { id: 'music-1', name: 'Upbeat Energy', genre: 'Pop', bpm: 128, duration: '2:00' },
  { id: 'music-2', name: 'Chill Vibes', genre: 'Lo-Fi', bpm: 85, duration: '3:00' },
  { id: 'music-3', name: 'Epic Trailer', genre: 'Cinematic', bpm: 140, duration: '1:30' },
  { id: 'music-4', name: 'Happy Days', genre: 'Pop', bpm: 110, duration: '2:30' },
  { id: 'music-5', name: 'Summer Beach', genre: 'Tropical', bpm: 105, duration: '3:20' },
];

// Sound effects
const soundEffects = [
  { id: 'sfx-whoosh', name: 'Whoosh', duration: '1s' },
  { id: 'sfx-click', name: 'Click', duration: '0.5s' },
  { id: 'sfx-pop', name: 'Pop', duration: '0.3s' },
  { id: 'sfx-impact', name: 'Impact', duration: '0.5s' },
];

interface DraggableMediaItemProps {
  media: MediaItem;
  isSelected: boolean;
  onClick: () => void;
}

function DraggableMediaItem({ media, isSelected, onClick }: DraggableMediaItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `media-${media.id}`,
    data: { type: 'media', media },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const getIcon = () => {
    switch (media.type) {
      case 'video': return <FileVideo className="w-3 h-3 text-purple-400" />;
      case 'audio': return <FileAudio className="w-3 h-3 text-green-400" />;
      case 'image': return <FileImage className="w-3 h-3 text-blue-400" />;
    }
  };

  const getBg = () => {
    switch (media.type) {
      case 'video': return 'bg-purple-500/20';
      case 'audio': return 'bg-green-500/20';
      case 'image': return 'bg-blue-500/20';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        'relative group cursor-grab active:cursor-grabbing rounded overflow-hidden',
        'border transition-all duration-150',
        isSelected ? 'border-purple-500 ring-1 ring-purple-500/30' : 'border-gray-700 hover:border-gray-500'
      )}
    >
      <div className={cn('aspect-video flex items-center justify-center relative', getBg())}>
        {media.thumbnail ? (
          <img src={media.thumbnail} alt={media.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center">{getIcon()}</div>
        )}
      </div>
      <div className="px-1.5 py-1 bg-gray-800/90">
        <p className="text-[10px] text-white truncate">{media.name}</p>
        <p className="text-[9px] text-gray-500">{formatTimeShort(media.duration)}</p>
      </div>
    </div>
  );
}

function YourMediaTab() {
  const { mediaLibrary, selectedMediaId, selectMedia, addMedia } = useEditorStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<MediaType | 'all'>('all');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredMedia = mediaLibrary.filter((media) => {
    const matchesSearch = media.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || media.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingOver(true); };
  const handleDragLeave = () => setIsDraggingOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFiles = (files: File[]) => {
    files.forEach(file => {
      const type: MediaType = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('image/') ? 'image' : 'video';
      addMedia({ name: file.name, type, duration: type === 'image' ? 5 : 10, thumbnail: undefined, src: URL.createObjectURL(file), file });
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-1.5">
        <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white gap-1.5 h-7 text-[11px]" onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-3 h-3" /> Import
        </Button>
        <input ref={fileInputRef} type="file" multiple accept="video/*,audio/*,image/*" className="hidden" onChange={handleFileSelect} />
      </div>

      <div className="px-1.5 pb-1.5 flex gap-1">
        <div className="relative flex-1">
          <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
          <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-6 bg-gray-800 border-gray-700 text-white text-[10px] h-6" />
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as MediaType | 'all')}>
          <SelectTrigger className="w-16 bg-gray-800 border-gray-700 text-white text-[10px] h-6 px-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            <SelectItem value="all" className="text-[10px]">All</SelectItem>
            <SelectItem value="video" className="text-[10px]">Video</SelectItem>
            <SelectItem value="image" className="text-[10px]">Image</SelectItem>
            <SelectItem value="audio" className="text-[10px]">Audio</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className={cn('mx-1.5 mb-1.5 p-2 border border-dashed rounded text-center transition-colors', isDraggingOver ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700 hover:border-gray-600')}
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
        <Upload className="w-3 h-3 mx-auto mb-0.5 text-gray-500" />
        <p className="text-[9px] text-gray-500">Drop files</p>
      </div>

      <ScrollArea className="flex-1 px-1.5">
        <div className="grid grid-cols-2 gap-1">
          {filteredMedia.map((media) => (
            <DraggableMediaItem key={media.id} media={media} isSelected={selectedMediaId === media.id} onClick={() => selectMedia(media.id)} />
          ))}
        </div>
        {filteredMedia.length === 0 && (
          <div className="text-center py-3 text-gray-500 text-[10px]">No media</div>
        )}
      </ScrollArea>
    </div>
  );
}

function TemplatesTab() {
  const { setAspectRatio } = useEditorStore();
  
  return (
    <ScrollArea className="flex-1 p-1.5">
      <div className="space-y-1">
        <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wider">Platforms</p>
        <div className="space-y-0.5">
          {templates.map((template) => (
            <button 
              key={template.id}
              onClick={() => setAspectRatio(template.aspectRatio as '16:9' | '9:16' | '1:1' | '4:5' | '21:9')}
              className="w-full flex items-center gap-2 p-1.5 bg-gray-800/50 hover:bg-gray-800 rounded border border-transparent hover:border-gray-700 transition-colors"
            >
              <span className="text-sm w-5 text-center">{template.icon}</span>
              <span className="text-[10px] text-gray-300 flex-1 text-left">{template.name}</span>
              <span className="text-[9px] text-gray-600 tabular-nums">{template.aspectRatio}</span>
            </button>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

function TextTab() {
  const { addClipToTrack, tracks, currentTime } = useEditorStore();

  const handleAddText = (preset: typeof textPresets[0]) => {
    const overlayTrack = tracks.find(t => t.type === 'overlay') || tracks.find(t => t.type === 'video');
    if (!overlayTrack) return;
    const lastClipEnd = overlayTrack.clips.reduce((max, clip) => Math.max(max, clip.startTime + clip.duration), currentTime);
    addClipToTrack(overlayTrack.id, { mediaId: `text-${preset.id}`, startTime: lastClipEnd, duration: 5, trimStart: 0, trimEnd: 0 });
  };

  return (
    <ScrollArea className="flex-1 p-1.5">
      <div className="space-y-1.5">
        <div>
          <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mb-1">Styles</p>
          <div className="grid grid-cols-2 gap-1">
            {textPresets.map((preset) => (
              <button 
                key={preset.id} 
                onClick={() => handleAddText(preset)} 
                className="p-1.5 bg-gray-800/50 hover:bg-gray-800 rounded border border-transparent hover:border-gray-700 text-left transition-colors"
              >
                <span className={cn("text-sm text-white", preset.style === 'bold' && "font-bold")}>{preset.preview}</span>
                <p className="text-[9px] text-gray-500">{preset.name}</p>
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mb-1">Animations</p>
          <div className="flex flex-wrap gap-0.5">
            {textAnimations.slice(0, 8).map((anim) => (
              <button
                key={anim.id}
                className="px-1.5 py-0.5 bg-gray-800/50 hover:bg-gray-800 rounded text-[9px] text-gray-400 border border-transparent hover:border-gray-700"
              >
                {anim.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

function TransitionsTab() {
  return (
    <ScrollArea className="flex-1 p-1.5">
      <div className="space-y-1.5">
        {['basic', 'wipe', 'slide', 'motion', 'effects'].map((category) => (
          <div key={category}>
            <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mb-1">{category}</p>
            <div className="grid grid-cols-4 gap-0.5">
              {transitions.filter(t => t.category === category).slice(0, 4).map((t) => (
                <button
                  key={t.id}
                  className="flex flex-col items-center justify-center p-1.5 bg-gray-800/50 hover:bg-gray-800 rounded border border-transparent hover:border-gray-700 transition-colors"
                >
                  <span className="text-sm">{t.icon}</span>
                  <span className="text-[8px] text-gray-500 truncate w-full text-center">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function EffectsTab() {
  return (
    <ScrollArea className="flex-1 p-1.5">
      <div className="space-y-1.5">
        <div>
          <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mb-1">Motion</p>
          <div className="grid grid-cols-2 gap-0.5">
            {motionPresets.slice(0, 6).map((preset) => (
              <button
                key={preset.id}
                className="p-1.5 bg-gray-800/50 hover:bg-gray-800 rounded border border-transparent hover:border-gray-700 text-left"
              >
                <p className="text-[10px] text-gray-300">{preset.name}</p>
                <p className="text-[8px] text-gray-500">{preset.duration}s</p>
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mb-1">Effects</p>
          <div className="grid grid-cols-3 gap-0.5">
            {['Blur', 'Glow', 'VHS', 'Glitch', 'Shake', 'Zoom', 'Flash', 'RGB', 'Pixel'].map((effect) => (
              <button
                key={effect}
                className="p-1.5 bg-gray-800/50 hover:bg-gray-800 rounded border border-transparent hover:border-gray-700 text-center"
              >
                <span className="text-[9px] text-gray-400">{effect}</span>
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mb-1">Colors</p>
          <div className="grid grid-cols-4 gap-0.5">
            {colorGradePresets.slice(0, 8).map((preset) => (
              <button
                key={preset.id}
                className="p-1 bg-gray-800/50 hover:bg-gray-800 rounded border border-transparent hover:border-gray-700 text-center"
              >
                <span className="text-[8px] text-gray-400">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

function MusicTab() {
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  
  return (
    <ScrollArea className="flex-1 p-1.5">
      <div className="space-y-1.5">
        <div>
          <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mb-1">Tracks</p>
          <div className="flex gap-0.5 mb-1 flex-wrap">
            {['all', 'Pop', 'Lo-Fi', 'Cinematic'].map((genre) => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[9px]",
                  selectedGenre === genre ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400"
                )}
              >
                {genre === 'all' ? 'All' : genre}
              </button>
            ))}
          </div>
          <div className="space-y-0.5">
            {musicLibrary.filter(m => selectedGenre === 'all' || m.genre === selectedGenre).map((track) => (
              <button
                key={track.id}
                className="w-full flex items-center gap-1.5 p-1.5 bg-gray-800/50 hover:bg-gray-800 rounded border border-transparent hover:border-gray-700"
              >
                <div className="w-5 h-5 bg-purple-600/30 rounded flex items-center justify-center flex-shrink-0">
                  <Play className="w-2.5 h-2.5 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-300 truncate">{track.name}</p>
                  <p className="text-[8px] text-gray-500">{track.bpm} BPM</p>
                </div>
                <span className="text-[8px] text-gray-600">{track.duration}</span>
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mb-1">SFX</p>
          <div className="grid grid-cols-2 gap-0.5">
            {soundEffects.map((sfx) => (
              <button
                key={sfx.id}
                className="flex items-center gap-1 p-1 bg-gray-800/50 hover:bg-gray-800 rounded border border-transparent hover:border-gray-700"
              >
                <Play className="w-2.5 h-2.5 text-green-400" />
                <span className="text-[9px] text-gray-400">{sfx.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

function StickersTab() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const categories = ['all', 'emoji', 'shapes', 'arrows'];
  
  const filteredStickers = selectedCategory === 'all' 
    ? stickersLibrary 
    : stickersLibrary.filter(s => s.category === selectedCategory);

  return (
    <ScrollArea className="flex-1 p-1.5">
      <div className="space-y-1">
        <div className="flex gap-0.5 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-1.5 py-0.5 rounded text-[9px] capitalize",
                selectedCategory === cat ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        
        <div className="grid grid-cols-5 gap-0.5">
          {filteredStickers.slice(0, 20).map((sticker) => (
            <button
              key={sticker.id}
              className="aspect-square bg-gray-800/50 hover:bg-gray-800 rounded flex items-center justify-center text-lg border border-transparent hover:border-gray-700"
              title={sticker.name}
            >
              {sticker.emoji}
            </button>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

function CaptionsTab() {
  const { autoGenerateCaptions, tracks } = useEditorStore();
  const hasClips = tracks.some(t => t.clips.length > 0);

  return (
    <ScrollArea className="flex-1 p-1.5">
      <div className="space-y-1.5">
        <button
          onClick={autoGenerateCaptions}
          disabled={!hasClips}
          className="w-full p-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 rounded text-center transition-colors disabled:opacity-50"
        >
          <Subtitles className="w-4 h-4 mx-auto mb-0.5 text-purple-400" />
          <p className="text-[10px] text-white">Auto Captions</p>
        </button>

        <div>
          <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mb-1">Styles</p>
          <div className="grid grid-cols-2 gap-0.5">
            {[
              { name: 'Classic', desc: 'White on black' },
              { name: 'TikTok', desc: 'Auto style' },
              { name: 'YouTube', desc: 'CC style' },
              { name: 'Minimal', desc: 'Outline' },
            ].map((style) => (
              <button
                key={style.name}
                className="p-1.5 bg-gray-800/50 hover:bg-gray-800 rounded border border-transparent hover:border-gray-700 text-left"
              >
                <p className="text-[10px] text-gray-300">{style.name}</p>
                <p className="text-[8px] text-gray-500">{style.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

function RecordCreateTab() {
  return (
    <ScrollArea className="flex-1 p-1.5">
      <div className="space-y-0.5">
        {[
          { icon: Monitor, label: 'Screen', color: 'text-purple-400' },
          { icon: Camera, label: 'Camera', color: 'text-blue-400' },
          { icon: Mic, label: 'Voice', color: 'text-green-400' },
          { icon: Video, label: 'Both', color: 'text-orange-400' },
        ].map((item, i) => (
          <button key={i} className="w-full flex items-center gap-2 p-1.5 bg-gray-800/50 hover:bg-gray-800 rounded border border-transparent hover:border-gray-700 transition-colors">
            <item.icon className={cn("w-4 h-4", item.color)} />
            <span className="text-[10px] text-gray-300">{item.label}</span>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}

function BrandKitTab() {
  return (
    <ScrollArea className="flex-1 p-1.5">
      <div className="space-y-2">
        <div>
          <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mb-1">Colors</p>
          <div className="flex gap-1">
            {['#9333ea', '#3b82f6', '#22c55e', '#f59e0b'].map((color, i) => (
              <button key={i} className="w-5 h-5 rounded border border-gray-700 hover:border-white" style={{ backgroundColor: color }} />
            ))}
            <button className="w-5 h-5 rounded border border-dashed border-gray-700 hover:border-gray-500 flex items-center justify-center">
              <span className="text-gray-500 text-xs">+</span>
            </button>
          </div>
        </div>
        <div>
          <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mb-1">Logo</p>
          <button className="w-full aspect-video bg-gray-800/50 rounded border border-dashed border-gray-700 hover:border-gray-500 flex items-center justify-center">
            <Upload className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>
    </ScrollArea>
  );
}

export default function MediaLibrary() {
  const { activeMediaTab, setActiveMediaTab } = useEditorStore();

  const tabs = [
    { id: 'your-media', label: 'Media', icon: <Video className="w-3 h-3" /> },
    { id: 'templates', label: 'Templates', icon: <LayoutTemplate className="w-3 h-3" /> },
    { id: 'text', label: 'Text', icon: <Type className="w-3 h-3" /> },
    { id: 'transitions', label: 'Trans', icon: <Film className="w-3 h-3" /> },
    { id: 'effects', label: 'Effects', icon: <Sparkles className="w-3 h-3" /> },
    { id: 'music', label: 'Music', icon: <Music className="w-3 h-3" /> },
    { id: 'stickers', label: 'Stickers', icon: <Sticker className="w-3 h-3" /> },
    { id: 'captions', label: 'Captions', icon: <Subtitles className="w-3 h-3" /> },
    { id: 'record', label: 'Record', icon: <Mic className="w-3 h-3" /> },
    { id: 'brand', label: 'Brand', icon: <Palette className="w-3 h-3" /> },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Compact Tabs */}
      <div className="p-0.5 border-b border-gray-800 bg-gray-900/50">
        <div className="grid grid-cols-5 gap-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveMediaTab(tab.id)}
              className={cn(
                'flex flex-col items-center gap-0.5 p-1 rounded transition-colors',
                activeMediaTab === tab.id 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
              )}
              title={tab.label}
            >
              {tab.icon}
              <span className="text-[8px] truncate w-full text-center leading-tight">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeMediaTab === 'your-media' && <YourMediaTab />}
        {activeMediaTab === 'templates' && <TemplatesTab />}
        {activeMediaTab === 'text' && <TextTab />}
        {activeMediaTab === 'transitions' && <TransitionsTab />}
        {activeMediaTab === 'effects' && <EffectsTab />}
        {activeMediaTab === 'music' && <MusicTab />}
        {activeMediaTab === 'stickers' && <StickersTab />}
        {activeMediaTab === 'captions' && <CaptionsTab />}
        {activeMediaTab === 'record' && <RecordCreateTab />}
        {activeMediaTab === 'brand' && <BrandKitTab />}
      </div>
    </div>
  );
}
