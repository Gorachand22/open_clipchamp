'use client';

import React from 'react';
import { Maximize, Square, Crop, RotateCcw, RotateCw, FlipHorizontal, FlipVertical, Sun, SunDim } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/store/editorStore';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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
  const { selectedClipId, getClipById, updateClipTransform, updateClipProperty } = useEditorStore();
  const selectedClip = selectedClipId ? getClipById(selectedClipId) : null;
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
