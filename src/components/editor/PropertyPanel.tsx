'use client';

import React, { useState } from 'react';
import {
  Download, Volume2, Sparkles, Filter, Wand2, Palette, Gauge, Settings2,
  RotateCw, Sun, Maximize, Trash2, Layers, Eye, Droplet, Camera,
  Move, ZoomIn, Film,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/store/editorStore';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { colorGradePresets, motionPresets, transitions } from '@/types/editor';



const filterPresets = [
  { id: 'none', name: 'None', gradient: 'from-gray-600 to-gray-700' },
  { id: 'cinematic', name: 'Cinematic', gradient: 'from-gray-800 to-blue-900' },
  { id: 'warm', name: 'Warm', gradient: 'from-orange-600 to-amber-800' },
  { id: 'cool', name: 'Cool', gradient: 'from-blue-600 to-cyan-800' },
  { id: 'vintage', name: 'Vintage', gradient: 'from-amber-700 to-yellow-900' },
  { id: 'noir', name: 'Noir', gradient: 'from-gray-700 to-black' },
  { id: 'vibrant', name: 'Vibrant', gradient: 'from-pink-500 to-purple-700' },
  { id: 'muted', name: 'Muted', gradient: 'from-gray-500 to-gray-700' },
  { id: 'teal', name: 'Teal & Orange', gradient: 'from-teal-600 to-orange-700' },
  { id: 'dramatic', name: 'Dramatic', gradient: 'from-gray-800 to-purple-900' },
  { id: 'retro', name: 'Retro', gradient: 'from-amber-600 to-orange-800' },
  { id: 'neon', name: 'Neon', gradient: 'from-purple-500 to-pink-600' },
];

// Chroma and Beauty panels removed

// PanZoom and Motion panels removed

function ColorGradePanel() {
  const { selectedClipId, getClipById, updateClipColorGrade } = useEditorStore();
  const clip = selectedClipId ? getClipById(selectedClipId) : null;
  const settings = clip?.colorGrade || {
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

  const handleUpdate = (property: string, value: number[]) => {
    if (selectedClipId) {
      updateClipColorGrade(selectedClipId, { [property]: value[0] });
    }
  };

  if (!selectedClipId) return null;

  return (
    <div className="space-y-4">
      {/* Color adjust sliders */}
      <div className="space-y-3">
        {[
          { id: 'exposure', label: 'Exposure', min: -100, max: 100 },
          { id: 'contrast', label: 'Contrast', min: -100, max: 100 },
          { id: 'saturation', label: 'Saturation', min: -100, max: 100 },
          { id: 'temperature', label: 'Temperature', min: -100, max: 100 },
          { id: 'tint', label: 'Tint', min: -100, max: 100 },
          { id: 'vignette', label: 'Vignette', min: 0, max: 100 },
        ].map(prop => (
          <div key={prop.id}>
            <div className="flex justify-between text-[9px] mb-0.5 mt-1">
              <span className="text-gray-400 capitalize">{prop.label}</span>
              <span className="text-white">{(settings as any)[prop.id]}</span>
            </div>
            <Slider
              value={[(settings as any)[prop.id] || 0]}
              min={prop.min}
              max={prop.max}
              step={1}
              onValueChange={(val) => handleUpdate(prop.id, val)}
              disabled={!selectedClipId}
              className="h-1"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function EffectsPanel() {
  const { selectedClipId, getClipById, updateClipProperty } = useEditorStore();

  const clip = selectedClipId ? getClipById(selectedClipId) : null;
  const currentTransitionId = clip?.transition?.type;
  const selectedEffects = clip?.effects || [];

  const handleApplyTransition = (transitionId: string) => {
    if (!selectedClipId) return;

    if (currentTransitionId === transitionId || transitionId === 'none') {
      updateClipProperty(selectedClipId, 'transition', undefined);
    } else {
      updateClipProperty(selectedClipId, 'transition', {
        type: transitionId,
        duration: 1, // Default transition duration
        easing: 'linear',
      });
    }
  };

  const toggleEffect = (effectId: string) => {
    if (!selectedClipId) return;
    const newEffects = selectedEffects.includes(effectId)
      ? selectedEffects.filter(id => id !== effectId)
      : [...selectedEffects, effectId];
    updateClipProperty(selectedClipId, 'effects', newEffects);
  };

  if (!selectedClipId) return null; // Let the core PropertyPanel handle "Select a clip"

  const visualEffects = [
    { id: 'blur', name: 'Blur', icon: '🌫️' },
    { id: 'glow', name: 'Glow', icon: '✨' },
    { id: 'vhs', name: 'VHS', icon: '📼' },
    { id: 'glitch', name: 'Glitch', icon: '📺' },
    { id: 'shake', name: 'Shake', icon: '📳' },
    { id: 'zoom', name: 'Zoom', icon: '🔍' },
    { id: 'flash', name: 'Flash', icon: '⚡' },
    { id: 'rgb', name: 'RGB', icon: '🌈' },
    { id: 'pixel', name: 'Pixel', icon: '👾' },
  ];

  return (
    <div className="space-y-4 pb-4">
      {/* Visual Effects Section */}
      <div>
        <p className="text-[10px] text-white font-medium uppercase tracking-wider mb-2 border-b border-gray-800 pb-1">Visual Effects</p>
        <div className="grid grid-cols-3 gap-1">
          {visualEffects.map((effect) => (
            <button
              key={effect.id}
              onClick={() => toggleEffect(effect.id)}
              className={cn(
                'flex flex-col items-center gap-0.5 p-1.5 rounded border transition-colors',
                selectedEffects.includes(effect.id) ? 'bg-purple-600/20 border-purple-500' : 'bg-gray-800/50 border-gray-700 hover:border-gray-500'
              )}
            >
              <span className="text-sm">{effect.icon}</span>
              <span className="text-[9px] text-gray-400">{effect.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Transitions Section */}
      <div>
        <p className="text-[10px] text-white font-medium uppercase tracking-wider mb-2 border-b border-gray-800 pb-1 mt-4">Transitions</p>
        <div className="space-y-3">
          {['basic', 'slide', 'effects'].map((category) => (
            <div key={category}>
              <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mb-1.5">{category}</p>
              <div className="grid grid-cols-4 gap-1">
                {transitions.filter(t => t.category === category).map((t) => {
                  const isActive = currentTransitionId === t.id || (t.id === 'none' && !currentTransitionId);
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleApplyTransition(t.id)}
                      className={cn(
                        "flex flex-col items-center justify-center p-1.5 rounded border transition-colors min-h-[48px]",
                        isActive
                          ? "bg-purple-900/40 border-purple-500"
                          : "bg-gray-800/50 hover:bg-gray-800 border-transparent hover:border-gray-700"
                      )}
                    >
                      <span className={cn("text-base mb-1", isActive ? "text-purple-400" : "")}>{t.icon}</span>
                      <span className={cn("text-[9px] truncate w-full text-center px-0.5", isActive ? "text-purple-300 font-medium" : "text-gray-500")}>
                        {t.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PropertyPanel() {
  const {
    selectedClipId, getClipById, getMediaById, activePropertyTab, setActivePropertyTab,
    updateClipProperty, updateClipSpeed, tracks, removeTrack, selectedTrackId, selectTrack,
  } = useEditorStore();

  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);


  const selectedClip = selectedClipId ? getClipById(selectedClipId) : null;
  const selectedMedia = selectedClip ? getMediaById(selectedClip.mediaId) : null;

  const isText = selectedClip?.mediaId.startsWith('text-') || selectedMedia?.type === 'caption';
  const isAudio = selectedMedia?.type === 'audio';

  const tabs = [
    { id: 'filters', label: 'Filters', icon: <Filter className="w-3 h-3" /> },
    { id: 'effects', label: 'Effects', icon: <Wand2 className="w-3 h-3" /> },
    { id: 'adjust', label: 'Color', icon: <Palette className="w-3 h-3" /> },
    { id: 'speed', label: 'Speed', icon: <Gauge className="w-3 h-3" /> },
    { id: 'audio', label: 'Audio', icon: <Volume2 className="w-3 h-3" /> },
    { id: 'fade', label: 'Fade', icon: <Sparkles className="w-3 h-3" /> },
  ];

  const visibleTabs = tabs.filter(tab => {
    if (!selectedClip) return true;
    if (isText) return ['fade'].includes(tab.id);
    if (isAudio) return ['audio', 'fade', 'speed'].includes(tab.id);
    return true;
  });

  // If active tab is hidden, switch to a valid one
  React.useEffect(() => {
    if (selectedClip && !visibleTabs.find(t => t.id === activePropertyTab)) {
      setActivePropertyTab(visibleTabs[0]?.id || 'filters');
    }
  }, [selectedClip, visibleTabs, activePropertyTab, setActivePropertyTab]);

  const handleVolumeChange = (value: number[]) => {
    if (!selectedClipId) return;
    updateClipProperty(selectedClipId, 'volume', value[0] / 100);
  };

  const handleSpeedChange = (value: number[]) => {
    if (!selectedClipId) return;
    updateClipSpeed(selectedClipId, value[0]);
  };

  const handleFadeInChange = (value: number[]) => {
    if (!selectedClipId) return;
    updateClipProperty(selectedClipId, 'fadeIn', value[0]);
  };

  const handleFadeOutChange = (value: number[]) => {
    if (!selectedClipId) return;
    updateClipProperty(selectedClipId, 'fadeOut', value[0]);
  };



  const canDeleteTrack = (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return false;
    return tracks.filter(t => t.type === track.type).length > 1;
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 border-l border-gray-800">

      {/* Selected Clip Info */}
      {selectedMedia && (
        <div className="px-2 py-1 border-b border-gray-800 bg-gray-800/30 shrink-0">
          <p className="text-[10px] text-white font-medium truncate">{selectedMedia.name}</p>
          <p className="text-[9px] text-gray-500">{selectedMedia.type} • {selectedClip?.duration.toFixed(1)}s</p>
        </div>
      )}

      {/* Track Management */}
      <div className="px-1.5 py-1.5 border-b border-gray-800 shrink-0">
        <h3 className="text-[9px] text-gray-500 font-medium mb-1">Tracks</h3>
        <div className="space-y-0.5 max-h-16 overflow-y-auto">
          {tracks.map((track) => (
            <div
              key={track.id}
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer group",
                selectedTrackId === track.id ? "bg-purple-600/20 border border-purple-500/50" : "hover:bg-gray-800"
              )}
              onClick={() => selectTrack(track.id)}
            >
              <span className={cn(
                "w-1.5 h-1.5 rounded-full flex-shrink-0",
                track.type === 'video' && "bg-purple-400",
                track.type === 'audio' && "bg-green-400",
                track.type === 'overlay' && "bg-blue-400"
              )} />
              <span className="flex-1 text-[10px] text-gray-400 truncate">{track.name}</span>
              <span className="text-[9px] text-gray-600">{track.clips.length}</span>
              {canDeleteTrack(track.id) && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeTrack(track.id); }}
                  className="p-0.5 text-gray-600 hover:text-red-400 rounded opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activePropertyTab} onValueChange={setActivePropertyTab} className="flex-1 flex flex-col min-h-0">
        <div className="border-b border-gray-800 overflow-x-auto shrink-0">
          <TabsList className="bg-gray-900 flex h-auto p-0.5 gap-0.5 flex-wrap">
            {visibleTabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-500 rounded"
              >
                {tab.icon}
                <span>{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <ScrollArea className="flex-1 p-1.5 min-h-0">
          {!selectedClip && (
            <div className="text-center py-4 text-gray-500">
              <Settings2 className="w-4 h-4 mx-auto mb-1 opacity-50" />
              <p className="text-[10px]">Select a clip</p>
            </div>
          )}

          <TabsContent value="filters" className="mt-0 space-y-1">
            <div className="grid grid-cols-4 gap-0.5">
              {filterPresets.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => { setSelectedFilter(filter.id); if (selectedClipId && filter.id !== 'none') updateClipProperty(selectedClipId, 'filter', filter.id); }}
                  className={cn(
                    'aspect-square rounded overflow-hidden border transition-all',
                    selectedFilter === filter.id ? 'border-purple-500 ring-1 ring-purple-500/50' : 'border-gray-700 hover:border-gray-500'
                  )}
                >
                  <div className={cn('w-full h-full bg-gradient-to-br flex items-center justify-center', filter.gradient)}>
                    <span className="text-[8px] text-white font-medium">{filter.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="effects" className="mt-0">
            <EffectsPanel />
          </TabsContent>

          <TabsContent value="adjust" className="mt-0">
            {selectedClipId && <ColorGradePanel />}
          </TabsContent>

          <TabsContent value="speed" className="mt-0 space-y-2">
            <div>
              <div className="flex justify-between text-[9px] mb-0.5">
                <span className="text-gray-400">Speed</span>
                <span className="text-white">{(selectedClip?.speed || 1).toFixed(2)}x</span>
              </div>
              <Slider value={[selectedClip?.speed || 1]} min={0.25} max={4} step={0.25} onValueChange={handleSpeedChange} disabled={!selectedClipId} className="h-1" />
            </div>
            <div className="flex gap-0.5 flex-wrap">
              {[0.5, 1, 1.5, 2, 3, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => { if (selectedClipId) updateClipSpeed(selectedClipId, s); }}
                  disabled={!selectedClipId}
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[9px]',
                    selectedClip?.speed === s ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700',
                    !selectedClipId && 'opacity-50'
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="fade" className="mt-0 space-y-2">
            <div>
              <div className="flex justify-between text-[9px] mb-0.5">
                <span className="text-gray-400">Fade In</span>
                <span className="text-white">{(selectedClip?.fadeIn || 0).toFixed(1)}s</span>
              </div>
              <Slider value={[selectedClip?.fadeIn || 0]} min={0} max={5} step={0.1} onValueChange={handleFadeInChange} disabled={!selectedClipId} className="h-1" />
            </div>
            <div>
              <div className="flex justify-between text-[9px] mb-0.5">
                <span className="text-gray-400">Fade Out</span>
                <span className="text-white">{(selectedClip?.fadeOut || 0).toFixed(1)}s</span>
              </div>
              <Slider value={[selectedClip?.fadeOut || 0]} min={0} max={5} step={0.1} onValueChange={handleFadeOutChange} disabled={!selectedClipId} className="h-1" />
            </div>
          </TabsContent>

          <TabsContent value="audio" className="mt-0 space-y-2">
            <div>
              <div className="flex justify-between text-[9px] mb-0.5">
                <span className="text-gray-400">Volume</span>
                <span className="text-white">{Math.round((selectedClip?.volume || 1) * 100)}%</span>
              </div>
              <Slider value={[(selectedClip?.volume || 1) * 100]} min={0} max={200} step={1} onValueChange={handleVolumeChange} disabled={!selectedClipId} className="h-1" />
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Footer */}
      <div className="p-1 border-t border-gray-800 text-[9px] text-gray-600 text-center">
        <kbd className="px-1 bg-gray-800 rounded">?</kbd> shortcuts
      </div>
    </div>
  );
}
