/**
 * Qwen Bridge API - Queue Endpoint
 *
 * Manages the task queue for Qwen automation.
 * GET: Returns all tasks
 * POST: Adds a new task
 * DELETE: Clears completed/failed tasks
 */

import { NextResponse } from 'next/server';

// Use global store for tasks
const taskStore = (global as any).__qwenTasks || new Map<string, any>();
(global as any).__qwenTasks = taskStore;

export async function GET() {
  const tasks = Array.from(taskStore.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({
    tasks,
    count: tasks.length,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.prompt) {
      return NextResponse.json({
        success: false,
        error: 'Prompt is required',
      }, { status: 400 });
    }

    const taskId = body.id || `qwen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const task = {
      id: taskId,
      prompt: body.prompt,
      mode: body.mode || 'image', // 'image' or 'video'
      aspectRatio: body.aspectRatio || '9:16',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      result: null,
      error: null,
    };

    taskStore.set(taskId, task);

    console.log(`[QwenBridge] Task added: ${taskId} - ${task.mode} - ${task.aspectRatio}`);

    return NextResponse.json({
      success: true,
      taskId,
      task,
    });
  } catch (error) {
    console.error('[QwenBridge] Error adding task:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to add task',
    }, { status: 500 });
  }
}

export async function DELETE() {
  // Clear completed and failed tasks
  let cleared = 0;
  for (const [id, task] of taskStore.entries()) {
    if (task.status === 'completed' || task.status === 'failed') {
      taskStore.delete(id);
      cleared++;
    }
  }

  return NextResponse.json({
    success: true,
    cleared,
    message: `Cleared ${cleared} tasks`,
  });
}
