/**
 * Qwen Automation Side Panel Bridge Script
 *
 * Features:
 * - Auto Tab Detection for Qwen
 * - Dual Mode: Manual + Bridge (MCP)
 * - text_to_image, text_to_video, image_to_video support
 * - Aspect Ratio Selection
 * - Task Queue Management
 * - Download Monitoring
 */

const BRIDGE_URL = 'http://localhost:3000';
const QWEN_URL = 'https://chat.qwen.ai/';

// ── State ─────────────────────────────────────────────────────────────────────

let tasks = [];
let logs = [];
let qwenTabId = null;
let bridgeAvailable = false;
let contentScriptReady = false;
let uploadedImageData = null;
let isProcessing = false;

// ── Initialization ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  addLog('Side panel initialized', 'info');

  // Setup event listeners
  document.getElementById('submit-btn')?.addEventListener('click', submitTask);
  document.getElementById('open-qwen-btn')?.addEventListener('click', openQwenTab);
  document.getElementById('refresh-btn')?.addEventListener('click', refreshAll);
  document.getElementById('clear-log-btn')?.addEventListener('click', clearLogs);
  document.getElementById('mode-select')?.addEventListener('change', handleModeChange);

  // Setup image upload
  setupImageUpload();

  // Start status checks
  checkBridgeStatus();
  checkQwenTab();

  // Periodic updates
  setInterval(checkBridgeStatus, 5000);
  setInterval(checkQwenTab, 5000);
  setInterval(pingContentScript, 2000);
  setInterval(loadTasks, 3000);

  // Connect to background
  connectToBackground();
});

// ── Logging ────────────────────────────────────────────────────────────────────

function addLog(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  logs.unshift({ message, type, timestamp });
  if (logs.length > 100) logs = logs.slice(0, 100);
  renderLogs();
}

function renderLogs() {
  const container = document.getElementById('log-container');
  if (!container) return;

  if (logs.length === 0) {
    container.innerHTML = '<div class="log-entry">No activity yet</div>';
    return;
  }

  container.innerHTML = logs.map(log => `
    <div class="log-entry ${log.type}">[${log.timestamp}] ${escapeHtml(log.message)}</div>
  `).join('');
}

function clearLogs() {
  logs = [];
  renderLogs();
  addLog('Logs cleared', 'info');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// ── Image Upload for image-to-video ────────────────────────────────────────────

function setupImageUpload() {
  const uploadArea = document.getElementById('image-upload-area');
  const imageInput = document.getElementById('image-input');

  if (!uploadArea || !imageInput) return;

  uploadArea.addEventListener('click', () => imageInput.click());

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');

    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleImageFile(file);
    }
  });

  imageInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageFile(file);
    }
  });
}

function handleImageFile(file) {
  const reader = new FileReader();
  reader.onload = (event) => {
    uploadedImageData = event.target.result;

    const placeholder = document.getElementById('upload-placeholder');
    const previewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const uploadArea = document.getElementById('image-upload-area');

    if (placeholder) placeholder.style.display = 'none';
    if (previewContainer) previewContainer.style.display = 'block';
    if (imagePreview) imagePreview.src = uploadedImageData;
    if (uploadArea) uploadArea.classList.add('has-image');

    addLog(`Image loaded: ${file.name}`, 'success');
  };
  reader.readAsDataURL(file);
}

function handleModeChange() {
  const mode = document.getElementById('mode-select')?.value;
  const imageSection = document.getElementById('image-upload-section');

  if (mode === 'imageToVideo') {
    if (imageSection) imageSection.style.display = 'block';
  } else {
    if (imageSection) imageSection.style.display = 'none';
    clearImageUpload();
  }
}

function clearImageUpload() {
  uploadedImageData = null;

  const placeholder = document.getElementById('upload-placeholder');
  const previewContainer = document.getElementById('image-preview-container');
  const uploadArea = document.getElementById('image-upload-area');
  const imageInput = document.getElementById('image-input');

  if (placeholder) placeholder.style.display = 'block';
  if (previewContainer) previewContainer.style.display = 'none';
  if (uploadArea) uploadArea.classList.remove('has-image');
  if (imageInput) imageInput.value = '';
}

// ── Status Checks ──────────────────────────────────────────────────────────────

async function checkBridgeStatus() {
  const statusEl = document.getElementById('bridge-status');
  const modeEl = document.getElementById('mode-status');

  try {
    const response = await fetch(`${BRIDGE_URL}/api/qwen-bridge/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });

    if (response.ok) {
      bridgeAvailable = true;
      if (statusEl) {
        statusEl.textContent = 'Connected';
        statusEl.className = 'status-value connected';
      }
      if (modeEl) {
        modeEl.innerHTML = '<span class="mode-indicator bridge">Bridge</span>';
      }
    } else {
      bridgeAvailable = false;
      if (statusEl) {
        statusEl.textContent = 'Error';
        statusEl.className = 'status-value disconnected';
      }
      if (modeEl) {
        modeEl.innerHTML = '<span class="mode-indicator manual">Manual</span>';
      }
    }
  } catch (e) {
    bridgeAvailable = false;
    if (statusEl) {
      statusEl.textContent = 'Disconnected';
      statusEl.className = 'status-value warning';
    }
    if (modeEl) {
      modeEl.innerHTML = '<span class="mode-indicator manual">Manual</span>';
    }
  }
}

async function checkQwenTab() {
  const statusEl = document.getElementById('qwen-status');

  try {
    const tabs = await chrome.tabs.query({ url: '*://chat.qwen.ai/*' });

    if (tabs.length > 0) {
      qwenTabId = tabs[0].id;
      const isActive = tabs[0].active;

      if (statusEl) {
        statusEl.textContent = isActive ? 'Active ✓' : 'Ready';
        statusEl.className = 'status-value connected';
      }
    } else {
      qwenTabId = null;
      contentScriptReady = false;

      if (statusEl) {
        statusEl.textContent = 'Not detected';
        statusEl.className = 'status-value warning';
      }
    }
  } catch (e) {
    if (statusEl) {
      statusEl.textContent = 'Unknown';
      statusEl.className = 'status-value';
    }
  }
}

async function injectContentScript() {
  if (!qwenTabId) return false;

  try {
    addLog('Injecting content script...', 'info');
    
    // Try to inject the content script programmatically
    await chrome.scripting.executeScript({
      target: { tabId: qwenTabId },
      files: ['assets/content.js']
    });
    
    addLog('Content script injected successfully', 'success');
    
    // Wait for script to initialize
    await new Promise(r => setTimeout(r, 1500));
    return true;
  } catch (e) {
    // Script might already be injected
    addLog('Injection: ' + (e.message || 'already loaded'), 'warning');
    return false;
  }
}

async function pingContentScript() {
  const taskStatusEl = document.getElementById('task-status');

  if (!qwenTabId) {
    contentScriptReady = false;
    if (taskStatusEl) {
      taskStatusEl.textContent = 'No Qwen tab';
      taskStatusEl.className = 'status-value warning';
    }
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(qwenTabId, { type: 'PING' });

    if (response && response.alive) {
      contentScriptReady = true;

      if (response.busy) {
        if (taskStatusEl) {
          taskStatusEl.textContent = `Running: ${(response.currentTask || '').substring(0, 8)}...`;
          taskStatusEl.className = 'status-value connected';
        }
      } else {
        if (taskStatusEl) {
          taskStatusEl.textContent = 'Ready';
          taskStatusEl.className = 'status-value connected';
        }
      }
    } else {
      contentScriptReady = false;
      if (taskStatusEl) {
        taskStatusEl.textContent = 'Reconnecting...';
        taskStatusEl.className = 'status-value warning';
      }
    }
  } catch (e) {
    // Content script not loaded
    contentScriptReady = false;
    if (taskStatusEl) {
      taskStatusEl.textContent = 'Injecting...';
      taskStatusEl.className = 'status-value warning';
    }

    // Try to inject content script
    const injected = await injectContentScript();

    if (injected) {
      // Try ping again after injection
      try {
        const retryResponse = await chrome.tabs.sendMessage(qwenTabId, { type: 'PING' });
        if (retryResponse && retryResponse.alive) {
          contentScriptReady = true;
          if (taskStatusEl) {
            taskStatusEl.textContent = 'Ready';
            taskStatusEl.className = 'status-value connected';
          }
        } else {
          if (taskStatusEl) {
            taskStatusEl.textContent = 'Refresh page';
            taskStatusEl.className = 'status-value disconnected';
          }
        }
      } catch (e2) {
        if (taskStatusEl) {
          taskStatusEl.textContent = 'Refresh page';
          taskStatusEl.className = 'status-value disconnected';
        }
      }
    } else {
      if (taskStatusEl) {
        taskStatusEl.textContent = 'Refresh page';
        taskStatusEl.className = 'status-value disconnected';
      }
    }
  }
}

// ── Tab Management ─────────────────────────────────────────────────────────────

async function openQwenTab() {
  try {
    const tabs = await chrome.tabs.query({ url: '*://chat.qwen.ai/*' });

    if (tabs.length > 0) {
      await chrome.tabs.update(tabs[0].id, { active: true });
      await chrome.windows.update(tabs[0].windowId, { focused: true });
      qwenTabId = tabs[0].id;
      addLog('Switched to Qwen tab', 'success');
    } else {
      const newTab = await chrome.tabs.create({ url: QWEN_URL });
      qwenTabId = newTab.id;
      addLog('Opened new Qwen tab', 'success');
    }
  } catch (e) {
    addLog(`Failed to open Qwen: ${e.message}`, 'error');
  }
}

// ── Task Management ────────────────────────────────────────────────────────────

async function loadTasks() {
  try {
    if (bridgeAvailable) {
      const response = await fetch(`${BRIDGE_URL}/api/qwen-bridge/queue`, {
        signal: AbortSignal.timeout(3000)
      });

      if (response.ok) {
        const data = await response.json();
        tasks = data.tasks || data.queue || [];
        renderTasks();
        return;
      }
    }
  } catch (e) {}

  renderTasks();
}

function renderTasks() {
  const container = document.getElementById('tasks-container');
  if (!container) return;

  if (tasks.length === 0) {
    container.innerHTML = '<div class="empty-state">No tasks in queue</div>';
    return;
  }

  container.innerHTML = tasks.map(task => `
    <div class="task-item ${task.status || 'pending'}">
      <div class="task-id">${(task.id || '').substring(0, 8)}...</div>
      <div class="task-prompt">${escapeHtml(task.prompt || 'No prompt')}</div>
      <div class="task-meta">
        <span>${formatMode(task.mode)}</span>
        <span>${task.aspectRatio || '1:1'}</span>
        <span class="task-status ${task.status || 'pending'}">${task.status || 'pending'}</span>
      </div>
    </div>
  `).join('');
}

function formatMode(mode) {
  const modeMap = {
    'textToImage': 'Text→Image',
    'textToVideo': 'Text→Video',
    'imageToVideo': 'Img→Video'
  };
  return modeMap[mode] || mode || 'Image';
}

async function submitTask() {
  if (isProcessing) {
    addLog('Already processing a task', 'error');
    return;
  }

  const promptInput = document.getElementById('prompt-input');
  const modeSelect = document.getElementById('mode-select');
  const ratioSelect = document.getElementById('ratio-select');
  const submitBtn = document.getElementById('submit-btn');

  const prompt = promptInput?.value?.trim();
  if (!prompt) {
    addLog('Please enter a prompt', 'error');
    return;
  }

  const mode = modeSelect?.value || 'textToImage';
  const aspectRatio = ratioSelect?.value || '1:1';

  // Validate image for image-to-video
  if (mode === 'imageToVideo' && !uploadedImageData) {
    addLog('Please upload an image for image-to-video', 'error');
    return;
  }

  const task = {
    id: crypto.randomUUID(),
    prompt,
    mode,
    aspectRatio,
    imageData: mode === 'imageToVideo' ? uploadedImageData : null,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  // Disable button
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Starting...';
  }
  isProcessing = true;

  try {
    // Ensure Qwen tab exists
    let tabs = await chrome.tabs.query({ url: '*://chat.qwen.ai/*' });
    if (tabs.length === 0) {
      addLog('Opening Qwen tab...', 'info');
      await openQwenTab();
      await new Promise(r => setTimeout(r, 3000));
      tabs = await chrome.tabs.query({ url: '*://chat.qwen.ai/*' });
    }

    if (tabs.length === 0) {
      throw new Error('Could not open Qwen tab');
    }

    qwenTabId = tabs[0].id;

    // Try bridge first if available
    if (bridgeAvailable) {
      try {
        const response = await fetch(`${BRIDGE_URL}/api/qwen-bridge/queue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task)
        });

        if (response.ok) {
          addLog(`Task queued via Bridge: ${task.id.substring(0, 8)}`, 'success');
          if (promptInput) promptInput.value = '';
          clearImageUpload();
          loadTasks();
          return;
        }
      } catch (e) {}
    }

    // Manual mode - execute directly
    addLog(`Starting task (Manual): ${task.id.substring(0, 8)}`, 'info');

    // Wait for content script to be ready
    let ready = false;
    for (let i = 0; i < 6; i++) {
      try {
        const response = await chrome.tabs.sendMessage(qwenTabId, { type: 'PING' });
        if (response?.alive) {
          ready = true;
          break;
        }
      } catch (e) {
        // Try to inject if not responding
        if (i === 0 || i === 3) {
          await injectContentScript();
        }
      }
      await new Promise(r => setTimeout(r, 500));
    }

    // Final check
    if (!ready) {
      try {
        const response = await chrome.tabs.sendMessage(qwenTabId, { type: 'PING' });
        if (response?.alive) {
          ready = true;
        }
      } catch (e) {}
    }

    if (!ready) {
      throw new Error('Content script not ready - please refresh Qwen page');
    }

    // Execute task
    const result = await chrome.tabs.sendMessage(qwenTabId, {
      type: 'EXECUTE_TASK',
      task
    });

    if (result?.success) {
      addLog(`Task completed: ${task.id.substring(0, 8)}`, 'success');
      if (promptInput) promptInput.value = '';
      clearImageUpload();
    } else {
      // Check for usage limit error
      if (result?.errorType === 'usage_limit' || result?.error?.includes('USAGE LIMIT')) {
        addLog('⚠️ USAGE LIMIT - TRY ANOTHER ACCOUNT', 'warning');
      } else {
        throw new Error(result?.error || 'Unknown error');
      }
    }

  } catch (e) {
    // Check if error message contains usage limit
    const errorMsg = e.message || '';
    if (errorMsg.includes('USAGE LIMIT') || errorMsg.includes('usage limit')) {
      addLog('⚠️ USAGE LIMIT - TRY ANOTHER ACCOUNT', 'warning');
    } else {
      addLog(`Error: ${errorMsg}`, 'error');
    }
  } finally {
    isProcessing = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Generate';
    }
    loadTasks();
  }
}

async function refreshAll() {
  addLog('Refreshing...', 'info');
  contentScriptReady = false;

  await checkBridgeStatus();
  await checkQwenTab();
  await loadTasks();

  if (qwenTabId) {
    try {
      const response = await chrome.tabs.sendMessage(qwenTabId, { type: 'PING' });
      if (response?.alive) {
        contentScriptReady = true;
        addLog('Content script ready', 'success');
      }
    } catch (e) {}
  }

  addLog('Refresh complete', 'success');
}

// ── Background Connection ──────────────────────────────────────────────────────

function connectToBackground() {
  try {
    const port = chrome.runtime.connect({ name: 'side-panel' });

    port.onMessage.addListener((message) => {
      switch (message.type) {
        case 'TASK_ADDED':
        case 'TASK_UPDATED':
          loadTasks();
          break;
        case 'DOWNLOAD_COMPLETE':
          addLog(`Download complete: ${message.filename}`, 'success');
          break;
      }
    });

    port.onDisconnect.addListener(() => {
      addLog('Reconnecting to background...', 'warning');
      setTimeout(connectToBackground, 1000);
    });
  } catch (e) {
    addLog('Failed to connect to background', 'error');
  }
}

// ── Message Listener ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'TASK_COMPLETE':
      addLog(`Task complete: ${message.taskId?.substring(0, 8)}`, 'success');
      loadTasks();
      break;
    case 'TASK_ERROR':
      addLog(`Task failed: ${message.error}`, 'error');
      loadTasks();
      break;
    case 'TASK_STATUS_UPDATE':
      const task = tasks.find(t => t.id === message.taskId);
      if (task) {
        task.status = message.status;
        if (message.result) task.result = message.result;
        renderTasks();
      }
      break;
  }
  sendResponse({ received: true });
  return false;
});

console.log('[SidePanel] Bridge script loaded');
