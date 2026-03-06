/**
 * Editor Events API - Server-Sent Events for real-time updates
 */

import { editorControl } from '@/lib/editor-control';

export const dynamic = 'force-dynamic';

export async function GET() {
  const clientId = Math.random().toString(36).substring(7);
  
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      
      // Send connection message
      controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`));
      editorControl.registerClient(clientId);
      
      // Send current snapshot
      const snap = editorControl.getSnapshot();
      if (snap) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'snapshot', data: snap })}\n\n`));
      }
      
      // Listen for broadcasts
      const onBroadcast = (msg: any) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'event', ...msg })}\n\n`));
        } catch {}
      };
      
      const onSnapshot = (s: any) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'snapshot', data: s })}\n\n`));
        } catch {}
      };
      
      editorControl.on('broadcast', onBroadcast);
      editorControl.on('snapshot', onSnapshot);
      
      // Keepalive
      const ping = setInterval(() => {
        try { controller.enqueue(enc.encode(': ping\n\n')); } catch { clearInterval(ping); }
      }, 15000);
      
      // Cleanup stored on controller
      (controller as any)._cleanup = () => {
        clearInterval(ping);
        editorControl.off('broadcast', onBroadcast);
        editorControl.off('snapshot', onSnapshot);
        editorControl.unregisterClient(clientId);
      };
    },
    cancel() {
      if ((this as any)._cleanup) (this as any)._cleanup();
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
