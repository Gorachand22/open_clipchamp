'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  Video, Image, Music, Upload, Search, Clock, X, Plus,
  FileVideo, FileImage, FileAudio, Mic, Monitor, Camera, Type, Sparkles, Palette,
  Wand2, Film, Play, Headphones, Subtitles, LayoutTemplate,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/store/editorStore';
import type { MediaItem, MediaType } from '@/types/editor';
import { formatTimeShort, motionPresets, transitions, colorGradePresets, textPresets } from '@/types/editor';
import { importFilesToStore } from '@/lib/import-media';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';



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
  onDelete: (e: React.MouseEvent) => void;
  onAdd?: (e: React.MouseEvent) => void;
}

function DraggableMediaItem({ media, isSelected, onClick, onDelete, onAdd }: DraggableMediaItemProps) {
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
      case 'caption': return <Subtitles className="w-3 h-3 text-orange-400" />;
    }
  };

  const getBg = () => {
    switch (media.type) {
      case 'video': return 'bg-purple-500/20';
      case 'audio': return 'bg-green-500/20';
      case 'image': return 'bg-blue-500/20';
      case 'caption': return 'bg-orange-500/20';
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

        {/* Delete button (visible on hover) */}
        <button
          onPointerDown={(e) => {
            // Must catch pointer down to prevent drag start
            e.stopPropagation();
          }}
          onClick={onDelete}
          className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-500/80 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <X className="w-3 h-3 text-white" />
        </button>

        {/* Add button (visible on hover) */}
        {onAdd && (
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onClick={onAdd}
            className="absolute bottom-1 right-1 p-1 bg-purple-600/90 hover:bg-purple-500 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow"
            title="Add to timeline"
          >
            <Plus className="w-3 h-3 text-white" />
          </button>
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
  const { mediaLibrary, selectedMediaId, selectMedia, addMedia, removeMedia, addMediaInteractive } = useEditorStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<MediaType | 'all'>('all');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredMedia = mediaLibrary.filter((media) => {
    const matchesSearch = media.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || media.type === filterType;
    return matchesSearch && matchesType;
  });

  useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => e.preventDefault();
    const handleGlobalDrop = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', handleGlobalDragOver);
    window.addEventListener('drop', handleGlobalDrop);
    return () => {
      window.removeEventListener('dragover', handleGlobalDragOver);
      window.removeEventListener('drop', handleGlobalDrop);
    };
  }, []);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFiles = (files: File[]) => {
    importFilesToStore(files, addMedia);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  };

  return (
    <div
      className={cn("flex-1 w-full min-h-0 flex flex-col h-full rounded transition-all", isDraggingOver ? 'bg-purple-900/20 ring-2 ring-purple-500 ring-inset' : '')}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="p-1.5">
        <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white gap-1.5 h-7 text-[11px]" onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-3 h-3" /> Import
        </Button>
        <input ref={fileInputRef} type="file" multiple accept="video/*,audio/*,image/*,.srt,.vtt" className="hidden" onChange={handleFileSelect} />
      </div>

      <div className="px-1.5 pb-1.5 flex gap-1">
        <div className="relative flex-1">
          <Search className="absolute left-1.5 top-1.5 w-3 h-3 text-gray-500 pointer-events-none" />
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
            <SelectItem value="caption" className="text-[10px]">Captions</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className={cn('mx-1.5 mb-1.5 p-2 border border-dashed rounded text-center transition-colors pointer-events-none', isDraggingOver ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700')}
      >
        <Upload className="w-3 h-3 mx-auto mb-0.5 text-gray-500" />
        <p className="text-[9px] text-gray-500">Drop files anywhere</p>
      </div>

      <ScrollArea className="flex-1 px-1.5 min-h-0">
        <div className="grid grid-cols-2 gap-1">
          {filteredMedia.map((media) => (
            <DraggableMediaItem
              key={media.id}
              media={media}
              isSelected={selectedMediaId === media.id}
              onClick={() => selectMedia(media.id)}
              onDelete={(e) => {
                e.preventDefault();
                e.stopPropagation();
                removeMedia(media.id);
              }}
              onAdd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                addMediaInteractive(media.id);
              }}
            />
          ))}
        </div>
        {filteredMedia.length === 0 && (
          <div className="text-center py-3 text-gray-500 text-[10px]">No media</div>
        )}
      </ScrollArea>
    </div >
  );
}



function TextTab() {
  const { addMediaInteractive, selectedClipId, getClipById } = useEditorStore();

  const selectedClip = selectedClipId ? getClipById(selectedClipId) : null;
  const isTextSelected = selectedClip?.mediaId.startsWith('text-');

  const handleAddText = (preset: typeof textPresets[0]) => {
    addMediaInteractive(`text-${preset.id}`);
  };

  return (
    <ScrollArea className="flex-1 p-1.5 min-h-0">
      <div className="space-y-1.5">
        <div>
          <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mb-1">Styles</p>
          <div className="grid grid-cols-2 gap-1">
            {textPresets.map((preset) => (
              <div
                key={preset.id}
                className="group relative p-1.5 bg-gray-800/50 hover:bg-gray-800 rounded border border-transparent hover:border-gray-700 text-left transition-colors cursor-pointer"
                onClick={() => handleAddText(preset)}
              >
                <span className={cn("text-sm text-white", preset.style === 'bold' && "font-bold")}>{preset.preview}</span>
                <p className="text-[9px] text-gray-500">{preset.name}</p>
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddText(preset);
                  }}
                  className="absolute bottom-1 right-1 p-1 bg-purple-600/90 hover:bg-purple-500 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow"
                  title="Add to timeline"
                >
                  <Plus className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}


export default function MediaLibrary() {
  const { activeMediaTab, setActiveMediaTab } = useEditorStore();

  const tabs = [
    { id: 'your-media', label: 'Media', icon: <Video className="w-3 h-3" /> },
    { id: 'text', label: 'Text', icon: <Type className="w-3 h-3" /> },
  ];

  return (
    <div className="flex-1 w-full min-h-0 h-full flex flex-col bg-gray-900 border-l border-gray-800">
      {/* Compact Tabs */}
      <div className="p-0.5 border-b border-gray-800 bg-gray-900/50">
        <div className="grid grid-cols-3 gap-0.5">
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
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {activeMediaTab === 'your-media' && <YourMediaTab />}
        {activeMediaTab === 'text' && <TextTab />}
      </div>
    </div>
  );
}
