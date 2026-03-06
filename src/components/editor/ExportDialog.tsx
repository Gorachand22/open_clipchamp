'use client';

import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export default function ExportDialog() {
  const { exportSettings, setExportSettings, tracks, mediaLibrary, duration } = useEditorStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [fileName, setFileName] = useState('open_clipchamp');

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);

    // Simulate export progress
    const interval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    // Simulate export completion
    setTimeout(() => {
      clearInterval(interval);
      setExportProgress(100);
      setIsExporting(false);

      // Create a mock download
      const blob = new Blob(['Video content placeholder'], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName || 'open_clipchamp'}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    }, 2500);
  };

  const getResolution = () => {
    switch (exportSettings.quality) {
      case '720p': return '1280 x 720';
      case '1080p': return '1920 x 1080';
      case '4K': return '3840 x 2160';
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-purple-600 hover:bg-purple-700 text-white gap-2 h-9">
          <Download className="w-4 h-4" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Export Video</DialogTitle>
          <DialogDescription className="text-gray-400">
            Choose your export settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm text-gray-300">File Name</label>
            <Input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
              placeholder="open_clipchamp"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-300">Quality</label>
            <Select
              value={exportSettings.quality}
              onValueChange={(v) => setExportSettings({ quality: v as '720p' | '1080p' | '4K' })}
            >
              <SelectTrigger className="bg-gray-700 border-gray-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                <SelectItem value="720p">720p HD (1280 x 720)</SelectItem>
                <SelectItem value="1080p">1080p Full HD (1920 x 1080)</SelectItem>
                <SelectItem value="4K">4K Ultra HD (3840 x 2160)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-300">Format</label>
            <Select
              value={exportSettings.format}
              onValueChange={(v) => setExportSettings({ format: v as 'mp4' | 'webm' | 'gif' })}
            >
              <SelectTrigger className="bg-gray-700 border-gray-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                <SelectItem value="mp4">MP4 (H.264)</SelectItem>
                <SelectItem value="webm">WebM (VP9)</SelectItem>
                <SelectItem value="gif">GIF (Animated)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-300">Frame Rate</label>
            <Select
              value={exportSettings.fps.toString()}
              onValueChange={(v) => setExportSettings({ fps: parseInt(v) as 30 | 60 })}
            >
              <SelectTrigger className="bg-gray-700 border-gray-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                <SelectItem value="30">30 FPS</SelectItem>
                <SelectItem value="60">60 FPS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Export Summary */}
          <div className="bg-gray-700/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Resolution</span>
              <span className="text-white">{getResolution()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Duration</span>
              <span className="text-white">{Math.ceil(duration)}s</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Clips</span>
              <span className="text-white">{tracks.reduce((acc, t) => acc + t.clips.length, 0)}</span>
            </div>
          </div>

          {/* Progress Bar */}
          {isExporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Exporting...</span>
                <span className="text-white">{exportProgress}%</span>
              </div>
              <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-600 transition-all duration-200"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="bg-purple-600 hover:bg-purple-700 w-full"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export Video
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
