/**
 * Editor Events - Server-Sent Events endpoint
 *
 * The browser connects here via EventSource to receive real-time commands
 * from the MCP server (OpenCode IDE → MCP route → editorControl → SSE → browser).
 */

import { editorControl } from '@/lib/editor-control';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  let controller: ReadableStreamDefaultController<Uint8Array>;
  let closed = false;

  const enc = new TextEncoder();
  const send = (data: object) => {
    if (closed) return;
    try {
      controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch {
      closed = true;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;

      // Confirm connection
      send({ type: 'connected', clientId, timestamp: Date.now() });
      editorControl.registerClient(clientId);

      // Send current editor snapshot immediately
      const snap = editorControl.getSnapshot();
      if (snap) send({ type: 'snapshot', data: snap });

      // Listen for new snapshots (browser pushes state → backend → new SSE clients)
      const onSnapshot = (snap: object) => send({ type: 'snapshot', data: snap });
      editorControl.on('snapshot', onSnapshot);

      // Listen for command broadcasts (MCP tool calls → browser action)
      const onBroadcast = (msg: { type: string; data: unknown; timestamp: number }) => {
        send({ type: 'command', command: msg.type, data: msg.data, timestamp: msg.timestamp });
      };
      editorControl.on('broadcast', onBroadcast);

      // Keep-alive ping every 20 seconds (prevents proxy timeouts)
      const keepAlive = setInterval(() => {
        if (closed) { clearInterval(keepAlive); return; }
        try {
          controller.enqueue(enc.encode(': ping\n\n'));
        } catch {
          closed = true;
          clearInterval(keepAlive);
        }
      }, 20000);

      // Cleanup function
      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepAlive);
        editorControl.off('snapshot', onSnapshot);
        editorControl.off('broadcast', onBroadcast);
        editorControl.unregisterClient(clientId);
      };

      // Store cleanup on controller for the cancel handler
      (controller as any)._cleanup = cleanup;
    },

    cancel() {
      const cleanup = (controller as any)._cleanup;
      if (cleanup) cleanup();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
      'Access-Control-Allow-Origin': '*',
    },
  });
}
