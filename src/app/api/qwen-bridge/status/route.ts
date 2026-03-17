/**
 * Qwen Bridge API - Status Endpoint
 *
 * Returns the current status of the Qwen automation bridge.
 */

import { NextResponse } from 'next/server';

// In-memory task storage (use Redis/database in production)
const taskStore = (global as any).__qwenTasks || new Map<string, any>();
(global as any).__qwenTasks = taskStore;

export async function GET() {
  const tasks = Array.from(taskStore.values());
  const pending = tasks.filter(t => t.status === 'pending').length;
  const running = tasks.filter(t => t.status === 'running').length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const failed = tasks.filter(t => t.status === 'failed').length;

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    queue: {
      pending,
      running,
      completed,
      failed,
      total: tasks.length,
    },
  });
}
