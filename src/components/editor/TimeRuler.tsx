'use client';

import React from 'react';
import { formatTimeShort } from '@/types/editor';

interface TimeRulerProps {
  zoom: number;
  duration: number;
}

export default function TimeRuler({ zoom, duration }: TimeRulerProps) {
  const getInterval = () => {
    if (zoom >= 150) return 1;
    if (zoom >= 100) return 2;
    if (zoom >= 50) return 5;
    if (zoom >= 25) return 10;
    return 15;
  };

  const interval = getInterval();
  const markers: number[] = [];
  for (let i = 0; i <= duration + interval; i += interval) {
    markers.push(i);
  }

  const minorTickCount = zoom >= 100 ? 10 : zoom >= 50 ? 5 : 2;

  return (
    <div className="flex h-7 bg-gray-800 border-b border-gray-700 flex-shrink-0">
      {/* Track header spacer */}
      <div className="w-[200px] flex-shrink-0 border-r border-gray-700 bg-gray-800 flex items-center px-2">
        <span className="text-[10px] text-gray-500">TIME</span>
      </div>
      
      {/* Time markers */}
      <div className="flex-1 flex">
        {markers.map((time, index) => (
          <div
            key={time}
            className="flex-shrink-0 flex flex-col justify-end border-l border-gray-700"
            style={{ width: interval * zoom }}
          >
            <span className="text-[10px] text-gray-400 px-1 font-mono">
              {formatTimeShort(time)}
            </span>
            {/* Minor ticks */}
            <div className="flex w-full h-2">
              {Array.from({ length: minorTickCount }).map((_, i) => (
                <div key={i} className="flex-1 border-l border-gray-700/50" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
