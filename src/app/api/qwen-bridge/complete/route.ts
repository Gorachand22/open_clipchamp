/**
 * Qwen Bridge API - Complete Endpoint
 *
 * Called by the extension when a task is complete or has failed.
 * Updates the task status and stores the result.
 */

import { NextResponse } from 'next/server';

// Use global store for tasks
const taskStore = (global as any).__qwenTasks || new Map<string, any>();
(global as any).__qwenTasks = taskStore;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { taskId, success, type, urls, error, filename } = body;

    if (!taskId) {
      return NextResponse.json({
        success: false,
        error: 'taskId is required',
      }, { status: 400 });
    }

    const task = taskStore.get(taskId);
    if (!task) {
      return NextResponse.json({
        success: false,
        error: 'Task not found',
      }, { status: 404 });
    }

    // Update task
    const updatedTask = {
      ...task,
      status: success ? 'completed' : 'failed',
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      result: success ? {
        type,
        urls: urls || [],
        filename,
      } : null,
      error: error || null,
    };

    taskStore.set(taskId, updatedTask);

    console.log(`[QwenBridge] Task ${taskId} ${success ? 'completed' : 'failed'}`);
    if (success && urls?.length > 0) {
      console.log(`[QwenBridge] Generated content URLs:`, urls.map(u => u.url?.substring(0, 50)));
    }

    // Also emit to editor control for real-time updates
    const { editorControl } = await import('@/lib/editor-control');
    editorControl.broadcast('qwen_task_complete', updatedTask);

    return NextResponse.json({
      success: true,
      task: updatedTask,
    });
  } catch (error) {
    console.error('[QwenBridge] Error completing task:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to complete task',
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const taskId = url.searchParams.get('taskId');

  if (taskId) {
    const task = taskStore.get(taskId);
    if (!task) {
      return NextResponse.json({
        success: false,
        error: 'Task not found',
      }, { status: 404 });
    }
    return NextResponse.json({ task });
  }

  // Return all completed tasks
  const completedTasks = Array.from(taskStore.values())
    .filter(t => t.status === 'completed')
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

  return NextResponse.json({
    tasks: completedTasks,
    count: completedTasks.length,
  });
}
