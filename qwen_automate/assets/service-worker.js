/**
 * Qwen Automation Background Service Worker
 *
 * Features:
 * - Side panel management
 * - Qwen tab detection and management
 * - Download monitoring and filename routing
 * - Manual task queue for offline mode
 * - Message routing between content script and side panel
 */

console.log('[QwenAutomate] Background service worker started');

// ── State ─────────────────────────────────────────────────────────────────────

let downloadFolder = '';
let downloadPrefix = '';
const manualTaskQueue = [];
const sidePanelPorts = new Set();

// ── Side Panel Setup ───────────────────────────────────────────────────────────

async function setupSidePanel() {
  if (chrome.sidePanel) {
    try {
      await chrome.sidePanel.setOptions({
        path: 'src/ui/side-panel/index.html',
        enabled: true
      });
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      console.log('[QwenAutomate] Side panel configured');
    } catch (e) {
      console.error('[QwenAutomate] Side panel setup failed:', e);
    }
  }
}

setupSidePanel();

// ── Extension Install/Update Handler ──────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  await setupSidePanel();

  if (details.reason === 'install') {
    console.log('[QwenAutomate] Extension installed');
    // Open Qwen on first install
    await openQwenTab();
  } else if (details.reason === 'update') {
    console.log('[QwenAutomate] Extension updated to version', chrome.runtime.getManifest().version);
  }
});

// ── Action Click Handler ──────────────────────────────────────────────────────

chrome.action.onClicked.addListener(async (tab) => {
  if (chrome.sidePanel && tab.id !== undefined) {
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (e) {
      console.error('[QwenAutomate] Failed to open side panel:', e);
    }
  }
});

// ── Message Handler ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[QwenAutomate] Background received:', message.type);

  switch (message.type) {
    // Download setup
    case 'SETUP_DOWNLOAD': {
      const { folder, prefix } = message;
      if (typeof folder === 'string') {
        downloadFolder = folder.trim() ? `${folder.trim()}/` : '';
      }
      if (typeof prefix === 'string') {
        downloadPrefix = prefix.trim();
      }
      sendResponse({ success: true });
      break;
    }

    // Get Qwen tabs
    case 'GET_QWEN_TAB': {
      chrome.tabs.query({ url: '*://chat.qwen.ai/*' }, (tabs) => {
        sendResponse({
          tabs: tabs.map(t => ({
            id: t.id,
            url: t.url,
            active: t.active,
            title: t.title
          }))
        });
      });
      return true; // Async response
    }

    // Open Qwen tab
    case 'OPEN_QWEN_TAB': {
      openQwenTab().then(() => sendResponse({ success: true }));
      return true;
    }

    // Download image/video
    case 'DOWNLOAD_IMAGE': {
      const { url, filename } = message;
      const fullFilename = `${downloadFolder}${downloadPrefix}${filename}`;

      chrome.downloads.download({
        url: url,
        filename: fullFilename,
        saveAs: false
      }, (downloadId) => {
        const error = chrome.runtime?.lastError;
        sendResponse(!error && downloadId
          ? { success: true, downloadId }
          : { success: false, error: error?.message }
        );
      });
      return true;
    }

    // Manual task queue management
    case 'ADD_MANUAL_TASK': {
      const task = {
        ...message.task,
        status: 'pending',
        addedAt: Date.now()
      };
      manualTaskQueue.push(task);
      console.log('[QwenAutomate] Added manual task:', task.id);
      broadcastToSidePanels({ type: 'TASK_ADDED', task });
      sendResponse({ success: true, task });
      break;
    }

    case 'GET_MANUAL_TASKS': {
      sendResponse({ tasks: manualTaskQueue });
      break;
    }

    case 'CLEAR_COMPLETED_TASKS': {
      const before = manualTaskQueue.length;
      for (let i = manualTaskQueue.length - 1; i >= 0; i--) {
        if (manualTaskQueue[i].status === 'completed' ||
            manualTaskQueue[i].status === 'failed') {
          manualTaskQueue.splice(i, 1);
        }
      }
      console.log('[QwenAutomate] Cleared', before - manualTaskQueue.length, 'tasks');
      sendResponse({ success: true });
      break;
    }

    // Task status update from content script
    case 'TASK_STATUS_UPDATE': {
      const { taskId, status, result } = message;
      const task = manualTaskQueue.find(t => t.id === taskId);
      if (task) {
        task.status = status;
        task.result = result;
        console.log('[QwenAutomate] Task', taskId, 'updated to', status);
        broadcastToSidePanels({ type: 'TASK_UPDATED', task });
      }
      sendResponse({ received: true });
      break;
    }

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return false;
});

// ── Helper Functions ───────────────────────────────────────────────────────────

async function openQwenTab() {
  try {
    const tabs = await chrome.tabs.query({ url: '*://chat.qwen.ai/*' });
    if (tabs.length > 0 && tabs[0].id) {
      await chrome.tabs.update(tabs[0].id, { active: true });
      if (tabs[0].windowId) {
        await chrome.windows.update(tabs[0].windowId, { focused: true });
      }
      console.log('[QwenAutomate] Focused existing Qwen tab');
    } else {
      await chrome.tabs.create({ url: 'https://chat.qwen.ai/' });
      console.log('[QwenAutomate] Opened new Qwen tab');
    }
  } catch (e) {
    console.error('[QwenAutomate] Failed to open Qwen tab:', e);
  }
}

function broadcastToSidePanels(message) {
  for (const port of sidePanelPorts) {
    try {
      port.postMessage(message);
    } catch (e) {
      // Port might be disconnected
      sidePanelPorts.delete(port);
    }
  }
}

// ── Side Panel Connection Handler ──────────────────────────────────────────────

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'side-panel') {
    sidePanelPorts.add(port);
    console.log('[QwenAutomate] Side panel connected');

    // Register download filename handler when side panel is open
    if (sidePanelPorts.size === 1) {
      if (!chrome.downloads.onDeterminingFilename.hasListener(handleDownloadFilename)) {
        chrome.downloads.onDeterminingFilename.addListener(handleDownloadFilename);
      }
    }

    port.onDisconnect.addListener(() => {
      sidePanelPorts.delete(port);
      console.log('[QwenAutomate] Side panel disconnected');

      // Remove listener when no side panels connected
      if (sidePanelPorts.size === 0) {
        if (chrome.downloads.onDeterminingFilename.hasListener(handleDownloadFilename)) {
          chrome.downloads.onDeterminingFilename.removeListener(handleDownloadFilename);
        }
      }
    });
  }
});

// ── Download Filename Handler ──────────────────────────────────────────────────

const downloadUrlMap = new Map();

function handleDownloadFilename(downloadItem, suggest) {
  // Only handle downloads from our extension
  if (downloadItem.byExtensionId && downloadItem.byExtensionId !== chrome.runtime.id) {
    return;
  }

  // Check if it's a video or image
  const isVideo = /\.(mp4|webm)$/i.test(downloadItem.filename || downloadItem.url);
  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(downloadItem.filename || downloadItem.url);

  if (!isVideo && !isImage) {
    return;
  }

  // Check if we have a mapped filename for this URL
  if (downloadUrlMap.has(downloadItem.url)) {
    suggest({ filename: downloadUrlMap.get(downloadItem.url) });
    downloadUrlMap.delete(downloadItem.url);
    return;
  }

  // Apply folder and prefix
  const originalFilename = downloadItem.filename || 'download';
  const basename = originalFilename.split('/').pop() || originalFilename;
  const newFilename = `${downloadFolder}${downloadPrefix}${basename}`;

  console.log('[QwenAutomate] Routing download:', originalFilename, '→', newFilename);
  suggest({ filename: newFilename });
}

// ── Download Completion Handler ────────────────────────────────────────────────

chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state && delta.state.current === 'complete') {
    chrome.downloads.search({ id: delta.id }, (results) => {
      if (results && results.length > 0) {
        const item = results[0];
        const filename = item.filename || '';

        console.log('[QwenAutomate] Download complete:', filename);

        // Check if this looks like a Qwen-generated file
        if (filename.includes('qwen') || downloadPrefix || downloadFolder) {
          // Extract task ID from filename if present
          const match = filename.match(/([a-f0-9\-]{36})[_\.]/);
          if (match) {
            const taskId = match[1];
            const type = /\.(mp4|webm)$/i.test(filename) ? 'video' : 'image';

            console.log('[QwenAutomate] Completed task download:', taskId, type);

            // Notify bridge
            fetch('http://localhost:3000/api/qwen-bridge/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                taskId,
                type: 'download_complete',
                contentType: type,
                filename
              })
            }).catch(() => {});

            // Notify side panels
            broadcastToSidePanels({
              type: 'DOWNLOAD_COMPLETE',
              taskId,
              filename,
              contentType: type
            });
          }
        }
      }
    });
  }
});

console.log('[QwenAutomate] Background service worker ready');
