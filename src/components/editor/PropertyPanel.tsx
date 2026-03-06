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

const effects = [
  { id: 'blur', name: 'Blur', icon: '🌫️' },
  { id: 'glow', name: 'Glow', icon: '✨' },
  { id: 'vhs', name: 'VHS', icon: '📼' },
  { id: 'glitch', name: 'Glitch', icon: '📺' },
  { id: 'shake', name: 'Shake', icon: '📳' },
  { id: 'flash', name: 'Flash', icon: '⚡' },
];

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

function ExportDialog() {
  const { exportSettings, setExportSettings, tracks } = useEditorStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const hasClips = tracks.some(t => t.clips.length > 0);

  const handleExport = () => {
    if (!hasClips) return;
    setIsExporting(true);
    setExportProgress(0);
    const interval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 100) { clearInterval(interval); setIsExporting(false); return 100; }
        return prev + 5;
      });
    }, 100);
  };

  const qualityOptions = [
    { value: '480p', label: '480p', desc: 'SD' },
    { value: '720p', label: '720p', desc: 'HD' },
    { value: '1080p', label: '1080p', desc: 'Full HD' },
    { value: '4K', label: '4K', desc: 'Ultra HD' },
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white gap-1.5 h-7 text-[11px]" disabled={!hasClips}>
          <Download className="w-3 h-3" /> Export
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-sm">Export Video</DialogTitle>
          <DialogDescription className="text-gray-400 text-[11px]">No watermark</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-3">
          <div className="space-y-1.5">
            <label className="text-[11px] text-gray-300">Quality</label>
            <div className="grid grid-cols-4 gap-1">
              {qualityOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setExportSettings({ quality: opt.value as '480p' | '720p' | '1080p' | '4K' })}
                  className={cn(
                    "p-1.5 rounded border text-center transition-colors",
                    exportSettings.quality === opt.value 
                      ? "bg-purple-600 border-purple-500 text-white" 
                      : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
                  )}
                >
                  <p className="text-[10px] font-medium">{opt.label}</p>
                  <p className="text-[8px] text-gray-400">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-gray-300">Format</label>
            <Select value={exportSettings.format} onValueChange={(v) => setExportSettings({ format: v as 'mp4' | 'webm' | 'gif' })}>
              <SelectTrigger className="bg-gray-700 border-gray-600 h-7 text-[11px]"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                <SelectItem value="mp4" className="text-[11px]">MP4</SelectItem>
                <SelectItem value="webm" className="text-[11px]">WebM</SelectItem>
                <SelectItem value="gif" className="text-[11px]">GIF</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-gray-300">Frame Rate</label>
            <div className="grid grid-cols-3 gap-1">
              {['24', '30', '60'].map((fps) => (
                <button
                  key={fps}
                  onClick={() => setExportSettings({ fps: parseInt(fps) as 24 | 30 | 60 })}
                  className={cn(
                    "p-1.5 rounded border text-[11px] transition-colors",
                    exportSettings.fps.toString() === fps 
                      ? "bg-purple-600 border-purple-500 text-white" 
                      : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
                  )}
                >
                  {fps} FPS
                </button>
              ))}
            </div>
          </div>

          {isExporting && (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-400">Exporting...</span>
                <span className="text-white">{exportProgress}%</span>
              </div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-purple-600 transition-all" style={{ width: `${exportProgress}%` }} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleExport} disabled={isExporting || !hasClips} className="w-full bg-purple-600 hover:bg-purple-700 h-7 text-[11px]">
            {isExporting ? 'Exporting...' : 'Export Video'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChromaKeyPanel() {
  const { selectedClipId, getClipById, updateClipChromaKey } = useEditorStore();
  const clip = selectedClipId ? getClipById(selectedClipId) : null;
  const chromaKey = clip?.chromaKey;

  if (!clip) return <p className="text-[10px] text-gray-500 text-center py-4">Select a clip</p>;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white">Green Screen</span>
        <Switch checked={chromaKey?.enabled || false} onCheckedChange={(checked) => updateClipChromaKey(selectedClipId!, { enabled: checked })} />
      </div>

      {chromaKey?.enabled && (
        <>
          <div>
            <label className="text-[9px] text-gray-400 mb-0.5 block">Key Color</label>
            <div className="flex gap-1">
              {['#00ff00', '#0000ff', '#ff0000'].map((color) => (
                <button
                  key={color}
                  onClick={() => updateClipChromaKey(selectedClipId!, { keyColor: color })}
                  className={cn("w-5 h-5 rounded border", chromaKey.keyColor === color ? "border-white ring-1 ring-white" : "border-gray-600")}
                  style={{ backgroundColor: color }}
                />
              ))}
              <input
                type="color"
                value={chromaKey.keyColor}
                onChange={(e) => updateClipChromaKey(selectedClipId!, { keyColor: e.target.value })}
                className="w-5 h-5 rounded cursor-pointer"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[9px] mb-0.5">
              <span className="text-gray-400">Similarity</span>
              <span className="text-gray-500">{chromaKey.similarity}%</span>
            </div>
            <Slider value={[chromaKey.similarity]} min={0} max={100} onValueChange={([v]) => updateClipChromaKey(selectedClipId!, { similarity: v })} className="h-1" />
          </div>

          <div>
            <div className="flex justify-between text-[9px] mb-0.5">
              <span className="text-gray-400">Smoothness</span>
              <span className="text-gray-500">{chromaKey.smoothness}%</span>
            </div>
            <Slider value={[chromaKey.smoothness]} min={0} max={100} onValueChange={([v]) => updateClipChromaKey(selectedClipId!, { smoothness: v })} className="h-1" />
          </div>
        </>
      )}
    </div>
  );
}

function BeautyPanel() {
  const { selectedClipId, getClipById, updateClipBeauty } = useEditorStore();
  const clip = selectedClipId ? getClipById(selectedClipId) : null;
  const beauty = clip?.beauty;

  if (!clip) return <p className="text-[10px] text-gray-500 text-center py-4">Select a clip</p>;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white">Beauty Mode</span>
        <Switch checked={beauty?.enabled || false} onCheckedChange={(checked) => updateClipBeauty(selectedClipId!, { enabled: checked })} />
      </div>

      {beauty?.enabled && (
        <>
          {[
            { key: 'smoothSkin', label: 'Smooth Skin' },
            { key: 'brightenEyes', label: 'Brighten Eyes' },
            { key: 'whitenTeeth', label: 'Whiten Teeth' },
            { key: 'slimFace', label: 'Slim Face' },
          ].map(({ key, label }) => (
            <div key={key}>
              <div className="flex justify-between text-[9px] mb-0.5">
                <span className="text-gray-400">{label}</span>
                <span className="text-gray-500">{beauty[key as keyof typeof beauty]}%</span>
              </div>
              <Slider value={[beauty[key as keyof typeof beauty] as number]} min={0} max={100} onValueChange={([v]) => updateClipBeauty(selectedClipId!, { [key]: v })} className="h-1" />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function PanZoomPanel() {
  const { selectedClipId, getClipById, updateClipPanZoom } = useEditorStore();
  const clip = selectedClipId ? getClipById(selectedClipId) : null;
  const panZoom = clip?.panZoom;

  if (!clip) return <p className="text-[10px] text-gray-500 text-center py-4">Select a clip</p>;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white">Ken Burns Effect</span>
        <Switch checked={panZoom?.enabled || false} onCheckedChange={(checked) => updateClipPanZoom(selectedClipId!, { enabled: checked })} />
      </div>

      {panZoom?.enabled && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex justify-between text-[9px] mb-0.5">
                <span className="text-gray-400">Start Scale</span>
                <span className="text-gray-500">{panZoom.startScale.toFixed(1)}x</span>
              </div>
              <Slider value={[panZoom.startScale * 100]} min={50} max={200} onValueChange={([v]) => updateClipPanZoom(selectedClipId!, { startScale: v / 100 })} className="h-1" />
            </div>
            <div>
              <div className="flex justify-between text-[9px] mb-0.5">
                <span className="text-gray-400">End Scale</span>
                <span className="text-gray-500">{panZoom.endScale.toFixed(1)}x</span>
              </div>
              <Slider value={[panZoom.endScale * 100]} min={50} max={200} onValueChange={([v]) => updateClipPanZoom(selectedClipId!, { endScale: v / 100 })} className="h-1" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ColorGradePanel() {
  const { selectedClipId, getClipById, updateClipColorGrade } = useEditorStore();
  const clip = selectedClipId ? getClipById(selectedClipId) : null;
  const colorGrade = clip?.colorGrade;

  if (!clip) return <p className="text-[10px] text-gray-500 text-center py-4">Select a clip</p>;

  return (
    <div className="space-y-2">
      <div>
        <label className="text-[9px] text-gray-400 mb-1 block">Presets</label>
        <div className="grid grid-cols-4 gap-0.5">
          {colorGradePresets.slice(0, 8).map((preset) => (
            <button
              key={preset.id}
              onClick={() => updateClipColorGrade(selectedClipId!, preset.settings as Record<string, number>)}
              className="p-1 bg-gray-800/50 hover:bg-gray-700 rounded border border-gray-700 hover:border-purple-500 text-center"
            >
              <span className="text-[9px] text-gray-300">{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      <Separator className="bg-gray-700 my-1" />

      {[
        { key: 'exposure', label: 'Exposure', icon: <Sun className="w-2.5 h-2.5" /> },
        { key: 'contrast', label: 'Contrast', icon: <div className="w-2.5 h-2.5 bg-gradient-to-r from-black to-white rounded" /> },
        { key: 'saturation', label: 'Saturation', icon: <Droplet className="w-2.5 h-2.5" /> },
        { key: 'temperature', label: 'Temperature', icon: <div className="w-2.5 h-2.5 bg-gradient-to-r from-blue-500 to-orange-500 rounded" /> },
        { key: 'highlights', label: 'Highlights', icon: <Sun className="w-2.5 h-2.5" /> },
        { key: 'shadows', label: 'Shadows', icon: <div className="w-2.5 h-2.5 bg-gray-600 rounded" /> },
        { key: 'vignette', label: 'Vignette', icon: <div className="w-2.5 h-2.5 border border-gray-400 rounded-full" /> },
      ].map(({ key, label }) => (
        <div key={key}>
          <div className="flex justify-between text-[9px] mb-0.5">
            <span className="text-gray-400">{label}</span>
            <span className="text-gray-500">{colorGrade?.[key as keyof typeof colorGrade] || 0}</span>
          </div>
          <Slider
            value={[colorGrade?.[key as keyof typeof colorGrade] as number || 0]}
            min={-100}
            max={100}
            onValueChange={([v]) => updateClipColorGrade(selectedClipId!, { [key]: v })}
            className="h-1"
          />
        </div>
      ))}
    </div>
  );
}

function MotionPresetsPanel() {
  const { selectedClipId, applyMotionPreset } = useEditorStore();

  if (!selectedClipId) return <p className="text-[10px] text-gray-500 text-center py-4">Select a clip</p>;

  return (
    <div className="space-y-2">
      {['entrance', 'exit', 'emphasis'].map((category) => (
        <div key={category}>
          <h4 className="text-[9px] text-gray-400 font-medium uppercase mb-1">{category}</h4>
          <div className="grid grid-cols-2 gap-0.5">
            {motionPresets.filter(p => p.category === category).slice(0, 4).map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyMotionPreset(selectedClipId, preset)}
                className="p-1.5 bg-gray-800/50 hover:bg-gray-700 rounded border border-gray-700 hover:border-purple-500 text-left"
              >
                <p className="text-[10px] text-gray-300">{preset.name}</p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PropertyPanel() {
  const {
    selectedClipId, getClipById, getMediaById, activePropertyTab, setActivePropertyTab,
    updateClipProperty, tracks, removeTrack, selectedTrackId, selectTrack,
  } = useEditorStore();

  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const [selectedTransition, setSelectedTransition] = useState('none');

  const selectedClip = selectedClipId ? getClipById(selectedClipId) : null;
  const selectedMedia = selectedClip ? getMediaById(selectedClip.mediaId) : null;

  const tabs = [
    { id: 'filters', label: 'Filters', icon: <Filter className="w-3 h-3" /> },
    { id: 'effects', label: 'Effects', icon: <Wand2 className="w-3 h-3" /> },
    { id: 'adjust', label: 'Color', icon: <Palette className="w-3 h-3" /> },
    { id: 'speed', label: 'Speed', icon: <Gauge className="w-3 h-3" /> },
    { id: 'audio', label: 'Audio', icon: <Volume2 className="w-3 h-3" /> },
    { id: 'fade', label: 'Fade', icon: <Sparkles className="w-3 h-3" /> },
    { id: 'chroma', label: 'Chroma', icon: <Layers className="w-3 h-3" /> },
    { id: 'beauty', label: 'Beauty', icon: <Camera className="w-3 h-3" /> },
    { id: 'panzoom', label: 'Pan', icon: <ZoomIn className="w-3 h-3" /> },
    { id: 'motion', label: 'Motion', icon: <Move className="w-3 h-3" /> },
  ];

  const handleVolumeChange = (value: number[]) => {
    if (!selectedClipId) return;
    updateClipProperty(selectedClipId, 'volume', value[0] / 100);
  };

  const handleSpeedChange = (value: number[]) => {
    if (!selectedClipId) return;
    updateClipProperty(selectedClipId, 'speed', value[0]);
  };

  const handleFadeInChange = (value: number[]) => {
    if (!selectedClipId) return;
    updateClipProperty(selectedClipId, 'fadeIn', value[0]);
  };

  const handleFadeOutChange = (value: number[]) => {
    if (!selectedClipId) return;
    updateClipProperty(selectedClipId, 'fadeOut', value[0]);
  };

  const toggleEffect = (effectId: string) => {
    setSelectedEffects(prev => prev.includes(effectId) ? prev.filter(id => id !== effectId) : [...prev, effectId]);
  };

  const canDeleteTrack = (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return false;
    return tracks.filter(t => t.type === track.type).length > 1;
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 border-l border-gray-800">
      {/* Export */}
      <div className="p-1.5 border-b border-gray-800">
        <ExportDialog />
      </div>

      {/* Selected Clip Info */}
      {selectedMedia && (
        <div className="px-2 py-1 border-b border-gray-800 bg-gray-800/30">
          <p className="text-[10px] text-white font-medium truncate">{selectedMedia.name}</p>
          <p className="text-[9px] text-gray-500">{selectedMedia.type} • {selectedClip?.duration.toFixed(1)}s</p>
        </div>
      )}

      {/* Track Management */}
      <div className="px-1.5 py-1.5 border-b border-gray-800">
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
        <div className="border-b border-gray-800 overflow-x-auto">
          <TabsList className="bg-gray-900 flex h-auto p-0.5 gap-0.5 flex-wrap">
            {tabs.map((tab) => (
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

        <ScrollArea className="flex-1 p-1.5">
          {!selectedClip && !['chroma', 'beauty', 'panzoom', 'motion'].includes(activePropertyTab) && (
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
            <div className="grid grid-cols-3 gap-0.5">
              {effects.map((effect) => (
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
                  onClick={() => { if (selectedClipId) updateClipProperty(selectedClipId, 'speed', s); }}
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
            <Separator className="bg-gray-700 my-1" />
            <MotionPresetsPanel />
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

          <TabsContent value="chroma" className="mt-0">
            <ChromaKeyPanel />
          </TabsContent>

          <TabsContent value="beauty" className="mt-0">
            <BeautyPanel />
          </TabsContent>

          <TabsContent value="panzoom" className="mt-0">
            <PanZoomPanel />
          </TabsContent>

          <TabsContent value="motion" className="mt-0">
            <MotionPresetsPanel />
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
