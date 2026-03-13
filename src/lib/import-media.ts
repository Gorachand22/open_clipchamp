import type { MediaType } from '@/types/editor';

/**
 * Robust handler for importing dropped/chosen files into the Media Library.
 * Extracts correct duration from video and audio files, generates video thumbnails,
 * and passes the result to the store's addMedia action.
 */
export async function importFilesToStore(files: File[], addMedia: (media: any) => void) {
    files.forEach(file => {
        const nameLower = file.name.toLowerCase();
        let type: MediaType = 'video';

        if (nameLower.endsWith('.srt') || nameLower.endsWith('.vtt')) {
            type = 'caption';
        } else if (file.type.startsWith('video/')) {
            type = 'video';
        } else if (file.type.startsWith('audio/')) {
            type = 'audio';
        } else if (file.type.startsWith('image/')) {
            type = 'image';
        }

        const src = URL.createObjectURL(file);

        if (type === 'image') {
            addMedia({ name: file.name, type, duration: 5, src, thumbnail: src });
            return;
        }

        if (type === 'caption') {
            file.text().then(text => {
                const lines = text.split(/\r?\n/);
                const captions: { id: string, startTime: number, endTime: number, text: string }[] = [];
                let currentCaption: { id: string, startTime: number, endTime: number, text: string[] } | null = null;

                // Regex supports HH:MM:SS.ms OR MM:SS.ms
                const timeRegex = /(?:(\d{2,}):)?(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(?:(\d{2,}):)?(\d{2}):(\d{2})[,.](\d{3})/;

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) {
                        if (currentCaption && currentCaption.text.length > 0) {
                            captions.push({
                                ...currentCaption,
                                text: currentCaption.text.join('\n')
                            });
                            currentCaption = null;
                        }
                        continue;
                    }

                    if (trimmed === 'WEBVTT' || trimmed.startsWith('Kind:') || trimmed.startsWith('Language:')) {
                        continue;
                    }

                    const timeMatch = trimmed.match(timeRegex);
                    if (timeMatch) {
                        const [, h1, m1, s1, ms1, h2, m2, s2, ms2] = timeMatch;
                        const hr1 = h1 ? parseInt(h1) : 0;
                        const hr2 = h2 ? parseInt(h2) : 0;
                        const startTime = hr1 * 3600 + parseInt(m1) * 60 + parseInt(s1) + parseInt(ms1) / 1000;
                        const endTime = hr2 * 3600 + parseInt(m2) * 60 + parseInt(s2) + parseInt(ms2) / 1000;

                        currentCaption = { id: Math.random().toString(36).substr(2, 9), startTime, endTime, text: [] };
                    } else if (currentCaption) {
                        // Ignore index numbers often present in SRT
                        if (!trimmed.match(/^\d+$/)) {
                            currentCaption.text.push(trimmed);
                        }
                    }
                }

                // Push last if no trailing newline
                if (currentCaption && currentCaption.text.length > 0) {
                    captions.push({
                        ...currentCaption,
                        text: currentCaption.text.join('\n')
                    });
                }

                const duration = captions.length > 0 ? captions[captions.length - 1].endTime : 10;
                addMedia({ name: file.name, type, duration, captions, src });
            });
            return;
        }

        // Extract real duration from video/audio by creating a temporary DOM element
        const mediaEl = document.createElement(type === 'video' ? 'video' : 'audio');
        mediaEl.preload = 'metadata';

        mediaEl.onloadedmetadata = () => {
            const duration = isFinite(mediaEl.duration) ? Math.round(mediaEl.duration * 10) / 10 : 10;

            // Generate thumbnail for video using a canvas frame capture
            let thumbnail: string | undefined;
            if (type === 'video') {
                const canvas = document.createElement('canvas');
                canvas.width = 160;
                canvas.height = 90;
                const ctx = canvas.getContext('2d');
                if (ctx && mediaEl instanceof HTMLVideoElement) {
                    try {
                        // Seek to 0.1s to avoid black frames and draw
                        mediaEl.currentTime = 0.1;
                        mediaEl.onseeked = () => {
                            ctx.drawImage(mediaEl, 0, 0, 160, 90);
                            thumbnail = canvas.toDataURL('image/jpeg', 0.7);
                            addMedia({ name: file.name, type, duration, src, thumbnail });
                        };
                        return;
                    } catch { }
                }
            }
            addMedia({ name: file.name, type, duration, src, thumbnail });
        };

        mediaEl.onerror = () => {
            // Fallback
            addMedia({ name: file.name, type, duration: 10, src });
        };

        mediaEl.src = src;
    });
}
