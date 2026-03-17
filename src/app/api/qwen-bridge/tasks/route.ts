/**
 * Qwen Bridge API - Tasks Endpoint
 *
 * Returns pending tasks for the extension to process.
 * Called by the content script polling loop.
 */

import { NextResponse } from 'next/server';

// Use global store for tasks
const taskStore = (global as any).__qwenTasks || new Map<string, any>();
(global as any).__qwenTasks = taskStore;

export async function GET() {
  // Get pending tasks, oldest first
  const pendingTasks = Array.from(taskStore.values())
    .filter(t => t.status === 'pending')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Return at most one task at a time
  return NextResponse.json({
    tasks: pendingTasks.slice(0, 1),
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const task = {
      ...body,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    taskStore.set(task.id, task);

    return NextResponse.json({
      success: true,
      taskId: task.id,
      message: 'Task added to queue',
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to add task',
    }, { status: 400 });
  }
}
