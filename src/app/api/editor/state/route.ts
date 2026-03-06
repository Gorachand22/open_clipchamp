/**
 * Editor State API
 * REST endpoint for IDE to query and manipulate editor state
 */

import { NextRequest, NextResponse } from 'next/server';
import { editorControl, EditorSnapshot, editorControlTools } from '@/lib/editor-control';

export async function GET() {
  const snapshot = editorControl.getSnapshot();
  
  if (!snapshot) {
    return NextResponse.json({
      success: false,
      error: 'Editor not initialized',
    }, { status: 503 });
  }

  return NextResponse.json({ success: true, snapshot });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { operation, params } = body;

    if (!operation) {
      return NextResponse.json({ error: 'Operation required' }, { status: 400 });
    }

    const toolMap: Record<string, (p: any) => Promise<any>> = {
      'get_state': editorControlTools.get_editor_state,
      'set_playhead': editorControlTools.set_playhead,
      'play': editorControlTools.start_playback,
      'pause': editorControlTools.pause_playback,
      'set_aspect_ratio': editorControlTools.set_aspect_ratio,
      'add_track': editorControlTools.add_track,
      'remove_track': editorControlTools.remove_track,
      'add_clip': editorControlTools.add_clip,
      'remove_clip': editorControlTools.remove_clip,
      'move_clip': editorControlTools.move_clip,
      'import_media': editorControlTools.import_media,
      'add_generated': editorControlTools.add_generated_content,
    };

    const toolFn = toolMap[operation];
    if (!toolFn) {
      return NextResponse.json({ error: `Unknown: ${operation}` }, { status: 400 });
    }

    return NextResponse.json(await toolFn(params || {}));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const snapshot = await request.json();
    editorControl.updateSnapshot(snapshot as EditorSnapshot);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
