import type { MediaType } from '@/types/editor';

/**
 * Robust handler for importing dropped/chosen files into the Media Library.
 * Extracts correct duration from video and audio files, generates video thumbnails,
 * and passes the result to the store's addMedia action.
 */
export async function importFilesToStore(files: File[], addMedia: (media: any) => void) {
    files.forEach(file => {
        const type: MediaType = file.type.startsWith('video/')
            ? 'video'
            : file.type.startsWith('audio/')
                ? 'audio'
                : file.type.startsWith('image/')
                    ? 'image'
                    : 'video';

        const src = URL.createObjectURL(file);

        if (type === 'image') {
            addMedia({ name: file.name, type, duration: 5, src, thumbnail: src });
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
