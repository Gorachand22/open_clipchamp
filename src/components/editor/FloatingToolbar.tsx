'use client';

import React from 'react';
import { Maximize, Square, Crop, RotateCcw, RotateCw, FlipHorizontal, FlipVertical, Sun, SunDim } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/store/editorStore';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Type } from 'lucide-react';

function ToolbarButton({ icon, label, onClick, active, disabled }: { icon: React.ReactNode; label: string; onClick?: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={cn(
        'p-1.5 rounded transition-colors',
        active ? 'bg-purple-600 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-700',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      title={label}
    >
      {icon}
    </button>
  );
}

export default function FloatingToolbar() {
  const { selectedClipId, getClipById, updateClipTransform, updateClipProperty, getMediaById } = useEditorStore();
  const selectedClip = selectedClipId ? getClipById(selectedClipId) : null;
  const selectedMedia = selectedClip ? getMediaById(selectedClip.mediaId) : null;
  const transform = selectedClip?.transform;

  const handleFit = () => { if (!selectedClipId) return; updateClipTransform(selectedClipId, { fit: true }); };
  const handleFill = () => { if (!selectedClipId) return; updateClipTransform(selectedClipId, { fit: false }); };
  const handleRotateLeft = () => { if (!selectedClipId || !transform) return; updateClipTransform(selectedClipId, { rotation: (transform.rotation - 90 + 360) % 360 }); };
  const handleRotateRight = () => { if (!selectedClipId || !transform) return; updateClipTransform(selectedClipId, { rotation: (transform.rotation + 90) % 360 }); };
  const handleFlipH = () => { if (!selectedClipId || !transform) return; updateClipTransform(selectedClipId, { flipH: !transform.flipH }); };
  const handleFlipV = () => { if (!selectedClipId || !transform) return; updateClipTransform(selectedClipId, { flipV: !transform.flipV }); };

  const handleOpacityChange = (value: number[]) => { if (!selectedClipId) return; updateClipTransform(selectedClipId, { opacity: value[0] / 100 }); };
  const handleFadeInChange = (value: number[]) => { if (!selectedClipId) return; updateClipProperty(selectedClipId, 'fadeIn', value[0]); };
  const handleFadeOutChange = (value: number[]) => { if (!selectedClipId) return; updateClipProperty(selectedClipId, 'fadeOut', value[0]); };

  const isText = selectedClip?.mediaId.startsWith('text-') || selectedMedia?.type === 'caption';

  const updateTextProp = (prop: string, val: string | number) => {
    if (!selectedClipId || !selectedClip) return;
    updateClipProperty(selectedClipId, 'text', {
      text: selectedClip.text?.text || '',
      ...(selectedClip.text || {}),
      [prop]: val
    });
  };

  if (isText && selectedClip) {
    const fontSize = selectedClip.text?.fontSize || 60;
    const fontFamily = selectedClip.text?.fontFamily || 'Inter, sans-serif';
    const fontColor = selectedClip.text?.color || '#FFFFFF';

    return (
      <div className="flex items-center gap-1.5 bg-gray-800/90 backdrop-blur-sm rounded-lg p-1.5 border border-gray-700">

        {/* Color Picker Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center justify-center w-6 h-6 rounded-full border border-gray-600 overflow-hidden cursor-pointer" title="Text Color" style={{ backgroundColor: fontColor }}>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2 bg-gray-800 border-gray-700 flex flex-wrap gap-1 max-w-[120px]">
            {['#FFFFFF', '#000000', '#FF3B30', '#34C759', '#007AFF', '#FF9500', '#AF52DE', '#FF2D55', '#E5E5EA', '#a855f7'].map(c => (
              <button key={c} onClick={() => updateTextProp('color', c)} className="w-5 h-5 rounded hover:scale-110 transition-transform border border-gray-700" style={{ backgroundColor: c }} />
            ))}
          </PopoverContent>
        </Popover>

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* Font Family */}
        <div className="w-32">
          <Select value={fontFamily} onValueChange={(val) => updateTextProp('fontFamily', val)}>
            <SelectTrigger className="h-7 text-xs bg-transparent border-transparent hover:bg-gray-700/50">
              <SelectValue placeholder="Font" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="Inter, sans-serif" style={{ fontFamily: 'Inter' }}>Inter</SelectItem>
              <SelectItem value="Verdana, sans-serif" style={{ fontFamily: 'Verdana' }}>Verdana</SelectItem>
              <SelectItem value="Calibri, sans-serif" style={{ fontFamily: 'Calibri' }}>Calibri</SelectItem>
              <SelectItem value="'Luckiest Guy', cursive" style={{ fontFamily: "'Luckiest Guy'" }}>Luckiest Guy</SelectItem>
              <SelectItem value="Arial, sans-serif" style={{ fontFamily: 'Arial' }}>Arial</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* Font Size */}
        <div className="w-16">
          <Select value={fontSize.toString()} onValueChange={(val) => updateTextProp('fontSize', parseInt(val))}>
            <SelectTrigger className="h-7 text-xs bg-transparent border-transparent hover:bg-gray-700/50">
              <SelectValue placeholder="Size" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 min-w-[60px]">
              {[12, 16, 24, 32, 48, 60, 72, 96, 120].map(size => (
                <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 bg-gray-800/90 backdrop-blur-sm rounded-lg p-1 border border-gray-700">
      {/* Fit/Fill */}
      <div className="flex items-center gap-0.5 pr-1.5 border-r border-gray-700">
        <ToolbarButton icon={<Maximize className="w-3.5 h-3.5" />} label="Fit" onClick={handleFit} active={transform?.fit} disabled={!selectedClipId} />
        <ToolbarButton icon={<Square className="w-3.5 h-3.5" />} label="Fill" onClick={handleFill} active={!transform?.fit} disabled={!selectedClipId} />
      </div>

      {/* Rotate */}
      <div className="flex items-center gap-0.5 px-1.5 border-r border-gray-700">
        <ToolbarButton icon={<RotateCcw className="w-3.5 h-3.5" />} label="Rotate left" onClick={handleRotateLeft} disabled={!selectedClipId} />
        <ToolbarButton icon={<RotateCw className="w-3.5 h-3.5" />} label="Rotate right" onClick={handleRotateRight} disabled={!selectedClipId} />
      </div>

      {/* Flip */}
      <div className="flex items-center gap-0.5 px-1.5 border-r border-gray-700">
        <ToolbarButton icon={<FlipHorizontal className="w-3.5 h-3.5" />} label="Flip H" onClick={handleFlipH} active={transform?.flipH} disabled={!selectedClipId} />
        <ToolbarButton icon={<FlipVertical className="w-3.5 h-3.5" />} label="Flip V" onClick={handleFlipV} active={transform?.flipV} disabled={!selectedClipId} />
      </div>

      {/* Fade In */}
      <div className="flex items-center px-1.5 border-r border-gray-700">
        <Popover>
          <PopoverTrigger asChild>
            <button disabled={!selectedClipId} className="flex items-center gap-1 p-1.5 rounded text-gray-300 hover:text-white hover:bg-gray-700 disabled:opacity-50">
              <Sun className="w-3.5 h-3.5" />
              <span className="text-[10px]">In</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-40 bg-gray-800 border-gray-700">
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-400">Fade in (seconds)</label>
              <Slider value={[selectedClip?.fadeIn || 0]} min={0} max={5} step={0.1} onValueChange={handleFadeInChange} />
              <span className="text-[10px] text-gray-400">{selectedClip?.fadeIn?.toFixed(1) || 0}s</span>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Fade Out */}
      <div className="flex items-center px-1.5 border-r border-gray-700">
        <Popover>
          <PopoverTrigger asChild>
            <button disabled={!selectedClipId} className="flex items-center gap-1 p-1.5 rounded text-gray-300 hover:text-white hover:bg-gray-700 disabled:opacity-50">
              <SunDim className="w-3.5 h-3.5" />
              <span className="text-[10px]">Out</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-40 bg-gray-800 border-gray-700">
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-400">Fade out (seconds)</label>
              <Slider value={[selectedClip?.fadeOut || 0]} min={0} max={5} step={0.1} onValueChange={handleFadeOutChange} />
              <span className="text-[10px] text-gray-400">{selectedClip?.fadeOut?.toFixed(1) || 0}s</span>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Opacity */}
      <div className="flex items-center pl-1.5">
        <Popover>
          <PopoverTrigger asChild>
            <button disabled={!selectedClipId} className="flex items-center gap-1 p-1.5 rounded text-gray-300 hover:text-white hover:bg-gray-700 disabled:opacity-50">
              <span className="text-[10px]">Opacity</span>
              <span className="text-[10px] text-gray-400">{Math.round((transform?.opacity || 1) * 100)}%</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-40 bg-gray-800 border-gray-700">
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-400">Opacity</label>
              <Slider value={[(transform?.opacity || 1) * 100]} min={0} max={100} step={1} onValueChange={handleOpacityChange} />
              <span className="text-[10px] text-gray-400">{Math.round((transform?.opacity || 1) * 100)}%</span>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
