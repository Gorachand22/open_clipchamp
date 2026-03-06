'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Eye, EyeOff, Volume2, VolumeX, Lock, Unlock, Video, Music, Layers, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/store/editorStore';
import TimelineClip from './TimelineClip';
import type { Track } from '@/types/editor';

interface TimelineTrackProps {
  track: Track;
  zoom: number;
  currentTime: number;
  canDelete?: boolean;
  onDelete?: () => void;
}

export default function TimelineTrack({ track, zoom, currentTime, canDelete = false, onDelete }: TimelineTrackProps) {
  const { toggleTrackMute, toggleTrackLock, selectedClipId } = useEditorStore();

  const { setNodeRef, isOver } = useDroppable({
    id: `track-${track.id}`,
    data: { type: 'track', trackId: track.id, trackType: track.type },
  });

  const trackHeight = track.height;

  const getTrackIcon = () => {
    switch (track.type) {
      case 'video': return <Video className="w-3 h-3" />;
      case 'audio': return <Music className="w-3 h-3" />;
      case 'overlay': return <Layers className="w-3 h-3" />;
    }
  };

  const getTrackColor = () => {
    switch (track.type) {
      case 'video': return 'text-purple-400';
      case 'audio': return 'text-green-400';
      case 'overlay': return 'text-blue-400';
    }
  };

  const getTrackGradient = () => {
    switch (track.type) {
      case 'video': return 'from-purple-900/20 to-transparent';
      case 'audio': return 'from-green-900/20 to-transparent';
      case 'overlay': return 'from-blue-900/20 to-transparent';
    }
  };

  return (
    <div className="flex border-b border-gray-700/50 group" style={{ height: trackHeight + 4 }}>
      {/* Track Header */}
      <div className="w-[200px] flex-shrink-0 bg-gray-800 border-r border-gray-700 px-2 py-1.5 flex items-center gap-2">
        <div className={cn('flex items-center gap-1.5 flex-1 min-w-0')}>
          <span className={cn(getTrackColor())}>{getTrackIcon()}</span>
          <span className="text-xs text-gray-300 truncate font-medium">{track.name}</span>
        </div>
        
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => toggleTrackMute(track.id)}
            className={cn(
              'p-1 rounded transition-colors',
              track.muted ? 'text-red-400 hover:text-red-300' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700'
            )}
            title={track.muted ? 'Unmute' : 'Mute'}
          >
            {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          </button>
          
          <button
            onClick={() => toggleTrackLock(track.id)}
            className={cn(
              'p-1 rounded transition-colors',
              track.locked ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700'
            )}
            title={track.locked ? 'Unlock' : 'Lock'}
          >
            {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
          </button>
          
          {canDelete && (
            <button
              onClick={onDelete}
              className="p-1 rounded transition-colors text-gray-500 hover:text-red-400 hover:bg-gray-700 opacity-0 group-hover:opacity-100"
              title="Delete track"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Track Content */}
      <div
        ref={setNodeRef}
        className={cn(
          'relative flex-1 bg-gradient-to-r min-w-0',
          getTrackGradient(),
          isOver && 'bg-purple-500/10 ring-1 ring-inset ring-purple-500/50',
          track.locked && 'opacity-60'
        )}
        style={{ height: trackHeight + 4 }}
      >
        {/* Clips */}
        {track.clips.map((clip) => (
          <TimelineClip key={clip.id} clip={clip} track={track} zoom={zoom} isSelected={selectedClipId === clip.id} />
        ))}

        {/* Empty audio placeholder */}
        {track.type === 'audio' && track.clips.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-0.5 opacity-15">
              {Array.from({ length: 200 }).map((_, i) => (
                <div key={i} className="w-0.5 bg-green-400 rounded-full" style={{ height: `${4 + Math.abs(Math.sin(i * 0.3)) * 16}px` }} />
              ))}
            </div>
          </div>
        )}

        {/* Drop indicator */}
        {isOver && (
          <div className="absolute inset-0 border-2 border-dashed border-purple-500 rounded pointer-events-none" />
        )}
      </div>
    </div>
  );
}
