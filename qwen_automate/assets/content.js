/**
 * Qwen Automation Content Script for chat.qwen.ai
 *
 * Features:
 * - text_to_image: Creates image from text prompt
 * - text_to_video: Creates video from text prompt
 * - image_to_video: Creates video from image + prompt
 * - Aspect Ratio Selection: 1:1, 9:16, 16:9, 3:4, 4:3
 * - Download Monitoring: Downloads ONLY the most recent generated content
 * - Works on existing chat sessions - no refresh needed
 */

(function() {
  'use strict';

  console.log("[QwenAutomate] Content script loading...");

  const BRIDGE_BASE = "http://localhost:3000";
  const POLL_MS = 3000;

  let busy = false;
  let bridgeAvailable = false;
  let currentTask = null;
  let generationStartTime = null;
  let preGenerationContentCount = { videos: 0, images: 0 };

  // ── SELECTORS (Based on actual Qwen HTML structure) ───────────────────────────

  const SELECTORS = {
    // Textarea input
    textarea: 'textarea.message-input-textarea',

    // Send button (inside .chat-prompt-send-button)
    sendButton: '.chat-prompt-send-button button.send-button',

    // Mode selector (+ button near input area - NOT sidebar +)
    modeTrigger: '.message-input-column-footer .mode-select .ant-dropdown-trigger',
    modeOpenButton: '.mode-select-open',

    // Current mode display
    currentMode: '.mode-select-current-mode',

    // Dropdown menu (visible dropdown)
    dropdown: '.ant-dropdown:not(.ant-dropdown-hidden)',
    dropdownMenu: '.ant-dropdown-menu',

    // Dropdown items with data-menu-id
    dropdownItem: '.ant-dropdown-menu-item',
    createImageItem: '[data-menu-id$="-t2i"]',
    createVideoItem: '[data-menu-id$="-t2v"]',

    // Aspect ratio selector
    aspectRatioTrigger: '.size-selector .ant-dropdown-trigger',
    aspectRatioText: '.selector-text .ant-space-item',

    // File input for image upload
    fileInput: 'input#filesUpload[type="file"]',

    // Upload progress / attachment indicators
    attachmentPreview: '.message-input-attachments, .attachment-preview, [class*="attachment"]',
    uploadProgress: '.upload-progress, .uploading, [class*="upload-progress"], [class*="uploading"], .ant-spin',

    // Download button on generated content
    downloadButton: '.qwen-chat-package-comp-new-action-control-container-download',
    downloadIcon: '[class*="download"]',

    // Generated content
    generatedVideo: 'video[src*="cdn.qwenlm.ai"], video[src*="blob:"], .qwen-video video',
    generatedImage: 'img[src*="cdn.qwenlm.ai"], img[src*="blob:"], .chat-response-media-render img',

    // Message containers to track count
    messageContainer: '.chat-message-item, .qwen-chat-package-comp-new-chat-message-item',

    // Loading indicator
    loadingIndicator: '.qwen-chat-package-comp-new-chat-message-item-content-loading, [class*="generating"], .qwen-loading',
  };

  // Aspect ratio options
  const ASPECT_RATIOS = {
    '1:1': ['1:1', 'square', '正方形'],
    '9:16': ['9:16', 'portrait', '竖屏', 'vertical'],
    '16:9': ['16:9', 'landscape', '横屏', 'horizontal'],
    '3:4': ['3:4'],
    '4:3': ['4:3']
  };

  // ── Utility Functions ──────────────────────────────────────────────────────────

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function clickElement(element, name = "element") {
    if (!element) {
      console.warn(`[QwenAutomate] ${name} not found`);
      return false;
    }

    try {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(100);

      if (element.disabled || element.getAttribute('aria-disabled') === 'true') {
        console.warn(`[QwenAutomate] ${name} is disabled`);
        return false;
      }

      element.click();
      console.log(`[QwenAutomate] Clicked ${name}`);
      await sleep(300);
      return true;
    } catch (e) {
      console.error(`[QwenAutomate] Failed to click ${name}:`, e);
      return false;
    }
  }

  async function fillReactTextarea(textarea, value) {
    if (!textarea) return false;

    try {
      textarea.focus();
      textarea.click();
      await sleep(100);

      textarea.value = '';

      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype, 'value'
      )?.set;

      if (nativeSetter) {
        nativeSetter.call(textarea, value);
      } else {
        textarea.value = value;
      }

      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      textarea.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
      textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

      console.log('[QwenAutomate] Filled textarea with prompt');
      return true;
    } catch (e) {
      console.error('[QwenAutomate] Failed to fill textarea:', e);
      return false;
    }
  }

  function countExistingContent() {
    const videos = document.querySelectorAll(SELECTORS.generatedVideo);
    const images = document.querySelectorAll(SELECTORS.generatedImage);
    return {
      videos: videos.length,
      images: images.length
    };
  }

  // ── Core Automation Functions ──────────────────────────────────────────────────

  async function selectMode(mode) {
    console.log('[QwenAutomate] Selecting mode:', mode);

    let targetSelector = null;
    let modeLabel = '';

    if (mode === 'text_to_image' || mode === 'textToImage') {
      targetSelector = SELECTORS.createImageItem;
      modeLabel = 'Create Image';
    } else if (mode === 'text_to_video' || mode === 'textToVideo' || mode === 'image_to_video' || mode === 'imageToVideo') {
      targetSelector = SELECTORS.createVideoItem;
      modeLabel = 'Create Video';
    } else {
      console.log('[QwenAutomate] Unknown mode, skipping mode selection');
      return true;
    }

    const modeTrigger = document.querySelector(SELECTORS.modeTrigger);
    const modeOpenBtn = document.querySelector(SELECTORS.modeOpenButton);
    let triggerBtn = modeTrigger || modeOpenBtn;

    if (!triggerBtn) {
      console.warn('[QwenAutomate] Mode trigger not found, continuing anyway');
      return true;
    }

    await clickElement(triggerBtn, 'mode selector (+)');
    await sleep(600);

    let dropdown = null;
    for (let i = 0; i < 10; i++) {
      dropdown = document.querySelector(SELECTORS.dropdown);
      if (dropdown && dropdown.offsetParent !== null) break;
      await sleep(200);
    }

    if (!dropdown) {
      console.warn('[QwenAutomate] Dropdown not found after clicking mode trigger');
      return true;
    }

    console.log('[QwenAutomate] Dropdown found, looking for:', modeLabel);

    let targetItem = dropdown.querySelector(targetSelector);

    if (targetItem) {
      console.log('[QwenAutomate] Found menu item by data-menu-id:', targetSelector);
      await clickElement(targetItem, modeLabel);
      await sleep(500);
      return true;
    }

    const items = dropdown.querySelectorAll(SELECTORS.dropdownItem);
    console.log('[QwenAutomate] Found', items.length, 'dropdown items');

    for (const item of items) {
      const text = (item.textContent || '').toLowerCase().trim();
      console.log('[QwenAutomate] Dropdown item text:', text);

      if (mode === 'text_to_image' || mode === 'textToImage') {
        if (text.includes('create image') || (text.includes('image') && !text.includes('video'))) {
          await clickElement(item, 'Create Image');
          await sleep(500);
          return true;
        }
      } else {
        if (text.includes('create video') || text.includes('video')) {
          await clickElement(item, 'Create Video');
          await sleep(500);
          return true;
        }
      }
    }

    console.warn('[QwenAutomate] Could not find matching menu item for mode:', mode);
    document.body.click();
    await sleep(200);
    return true;
  }

  async function selectAspectRatio(ratio, retries = 3) {
    console.log('[QwenAutomate] Selecting aspect ratio:', ratio, 'retries left:', retries);

    if (!ratio) return true;

    const ratioLabels = ASPECT_RATIOS[ratio];
    if (!ratioLabels) {
      console.warn('[QwenAutomate] Unknown aspect ratio:', ratio);
      return true;
    }

    // Wait for aspect ratio element to appear (important for image_to_video)
    let ratioTrigger = null;
    for (let i = 0; i < 10; i++) {
      ratioTrigger = document.querySelector(SELECTORS.aspectRatioTrigger);
      if (ratioTrigger && ratioTrigger.offsetParent !== null) {
        break;
      }
      console.log('[QwenAutomate] Waiting for aspect ratio trigger...', i);
      await sleep(500);
    }

    if (!ratioTrigger || ratioTrigger.offsetParent === null) {
      console.warn('[QwenAutomate] Aspect ratio trigger not found after waiting');
      if (retries > 0) {
        console.log('[QwenAutomate] Retrying aspect ratio selection...');
        await sleep(1000);
        return selectAspectRatio(ratio, retries - 1);
      }
      return true;
    }

    // Check current ratio
    const ratioTextEl = document.querySelector(SELECTORS.aspectRatioText);
    if (ratioTextEl) {
      const currentText = (ratioTextEl.textContent || '').toLowerCase();
      console.log('[QwenAutomate] Current aspect ratio text:', currentText);
      if (currentText.includes(ratio.toLowerCase())) {
        console.log('[QwenAutomate] Already at correct aspect ratio');
        return true;
      }
    }

    // Click aspect ratio trigger
    console.log('[QwenAutomate] Clicking aspect ratio trigger...');
    await clickElement(ratioTrigger, 'aspect ratio selector');
    await sleep(600);

    // Wait for dropdown to appear
    let dropdown = null;
    for (let i = 0; i < 5; i++) {
      dropdown = document.querySelector(SELECTORS.dropdown);
      if (dropdown && dropdown.offsetParent !== null) {
        break;
      }
      await sleep(300);
    }

    if (!dropdown) {
      console.warn('[QwenAutomate] Aspect ratio dropdown not found');
      document.body.click();
      await sleep(200);
      return true;
    }

    console.log('[QwenAutomate] Dropdown found, looking for ratio:', ratio);

    // Find and click the matching ratio option
    const items = dropdown.querySelectorAll(SELECTORS.dropdownItem);
    console.log('[QwenAutomate] Found', items.length, 'dropdown items');

    for (const item of items) {
      const text = (item.textContent || '').toLowerCase().trim();
      console.log('[QwenAutomate] Ratio option:', text);

      for (const label of ratioLabels) {
        if (text.includes(label.toLowerCase())) {
          console.log('[QwenAutomate] Found matching ratio:', label);
          await clickElement(item, `ratio "${label}"`);
          await sleep(500);

          // Verify the change
          const newTextEl = document.querySelector(SELECTORS.aspectRatioText);
          if (newTextEl) {
            const newText = (newTextEl.textContent || '').toLowerCase();
            console.log('[QwenAutomate] Aspect ratio after selection:', newText);
          }

          return true;
        }
      }
    }

    console.warn('[QwenAutomate] Could not find ratio option:', ratio);
    document.body.click();
    await sleep(200);

    // Retry if failed
    if (retries > 0) {
      console.log('[QwenAutomate] Retrying aspect ratio selection...');
      await sleep(1000);
      return selectAspectRatio(ratio, retries - 1);
    }

    return true;
  }

  /**
   * Upload image for image-to-video
   * Simulates a paste event on the textarea to upload image
   */
  async function uploadImageForVideo(imageData) {
    console.log('[QwenAutomate] Uploading image for image-to-video...');

    // Convert base64 to File
    let file;
    if (imageData.startsWith('data:')) {
      const response = await fetch(imageData);
      const blob = await response.blob();
      const ext = blob.type.split('/')[1] || 'png';
      file = new File([blob], `image.${ext}`, { type: blob.type || 'image/png' });
      console.log('[QwenAutomate] Created file:', file.name, 'size:', file.size);
    } else {
      throw new Error('Invalid image data format - expected base64 data URL');
    }

    // Find the textarea to focus
    const textarea = document.querySelector(SELECTORS.textarea);
    if (textarea) {
      textarea.focus();
      await sleep(200);
    }

    // Try Method 1: Simulate paste event on document/textarea
    try {
      const clipboardData = new DataTransfer();
      clipboardData.items.add(file);

      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboardData
      });

      // Try pasting on textarea first
      if (textarea) {
        textarea.dispatchEvent(pasteEvent);
        console.log('[QwenAutomate] Paste event dispatched to textarea');
      }

      // Also try on document
      document.dispatchEvent(pasteEvent);
      console.log('[QwenAutomate] Paste event dispatched to document');

      await sleep(1000);
    } catch (e) {
      console.warn('[QwenAutomate] Paste event failed:', e.message);
    }

    // Try Method 2: Set file input directly (fallback)
    let fileInput = document.querySelector(SELECTORS.fileInput);
    if (fileInput) {
      console.log('[QwenAutomate] Trying file input method...');

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;

      // Trigger events
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      fileInput.dispatchEvent(new Event('input', { bubbles: true }));

      console.log('[QwenAutomate] File input events triggered');
    }

    // Try Method 3: Drag and drop simulation
    try {
      const dropZone = textarea?.closest('.message-input, [class*="input"]') || document.body;

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer
      });

      dropZone.dispatchEvent(dropEvent);
      console.log('[QwenAutomate] Drop event dispatched');

      await sleep(500);
    } catch (e) {
      console.warn('[QwenAutomate] Drop event failed:', e.message);
    }

    console.log('[QwenAutomate] Upload triggered, waiting for completion...');

    // Wait for upload to complete
    await waitForUploadComplete();

    console.log('[QwenAutomate] Upload complete!');
    return true;
  }

  /**
   * Wait for image upload to complete
   * Monitors for upload progress and checks for attachment preview
   */
  async function waitForUploadComplete(timeout = 30000) {
    console.log('[QwenAutomate] Waiting for upload to complete...');
    const startTime = Date.now();
    let uploadStarted = false;

    // Initial wait for upload to start
    await sleep(1500);

    while (Date.now() - startTime < timeout) {
      // Check for upload progress/spinner
      const progressEl = document.querySelector(SELECTORS.uploadProgress);
      if (progressEl && progressEl.offsetParent !== null) {
        uploadStarted = true;
        console.log('[QwenAutomate] Upload in progress...');
        await sleep(1000);
        continue;
      }

      // Check for attachment preview (means upload is done)
      const attachmentArea = document.querySelector(SELECTORS.attachmentPreview);
      if (attachmentArea) {
        const previewImg = attachmentArea.querySelector('img, [class*="image"], [class*="preview"]');
        if (previewImg) {
          console.log('[QwenAutomate] Attachment preview found - upload complete!');
          await sleep(500);
          return true;
        }
      }

      // Check for any attached image in input area
      const attachedImg = document.querySelector('.message-input-attachments img, [class*="attachment"] img, .attachment-preview img');
      if (attachedImg) {
        console.log('[QwenAutomate] Attached image found - upload complete!');
        await sleep(500);
        return true;
      }

      // If upload was started but now no progress, check if complete
      if (uploadStarted) {
        // Give extra time after progress disappears
        await sleep(500);
        const img = document.querySelector('.message-input-attachments img, [class*="attachment"] img');
        if (img) {
          console.log('[QwenAutomate] Upload completed after progress');
          return true;
        }
      }

      await sleep(500);
    }

    console.warn('[QwenAutomate] Upload wait timeout - continuing anyway');
    return true;
  }

  async function enterPrompt(prompt) {
    console.log('[QwenAutomate] Entering prompt');

    const textarea = document.querySelector(SELECTORS.textarea);
    if (!textarea) {
      throw new Error('Textarea not found');
    }

    await fillReactTextarea(textarea, prompt);
    await sleep(300);
    return true;
  }

  async function clickSendButton() {
    console.log('[QwenAutomate] Clicking send button');

    const sendBtn = document.querySelector(SELECTORS.sendButton);
    if (!sendBtn) {
      throw new Error('Send button not found');
    }

    // Wait for button to be enabled (max 15 seconds to allow for upload)
    let attempts = 0;
    while (sendBtn.disabled && attempts < 75) {
      await sleep(200);
      attempts++;
    }

    if (sendBtn.disabled) {
      console.warn('[QwenAutomate] Send button still disabled after waiting, attempting click anyway');
    }

    await clickElement(sendBtn, 'send button');
    return true;
  }

  async function waitForGeneration(timeout = 300000) {
    console.log('[QwenAutomate] Waiting for generation...');
    console.log('[QwenAutomate] Pre-generation content count:', preGenerationContentCount);

    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      await sleep(2000);

      // Check for loading/generating indicator
      const loading = document.querySelector(SELECTORS.loadingIndicator);
      if (loading && loading.offsetParent !== null) {
        console.log('[QwenAutomate] Still generating...');
        continue;
      }

      // Count current content
      const currentCount = countExistingContent();
      console.log('[QwenAutomate] Current content count:', currentCount);

      // Check if NEW video appeared
      if (currentCount.videos > preGenerationContentCount.videos) {
        console.log('[QwenAutomate] NEW video detected!');
        await sleep(2000);
        const downloadResult = await downloadNewestContent('video');
        return { success: true, type: 'video', downloaded: downloadResult };
      }

      // Check if NEW image appeared
      if (currentCount.images > preGenerationContentCount.images) {
        console.log('[QwenAutomate] NEW image detected!');
        await sleep(1500);
        const downloadResult = await downloadNewestContent('image');
        return { success: true, type: 'image', downloaded: downloadResult };
      }

      // Check for error messages
      const errorResult = checkForErrors();
      if (errorResult) {
        return errorResult;
      }
    }

    return { success: false, error: 'Timeout waiting for generation' };
  }

  /**
   * Check for various error messages on the page
   * Returns error object if found, null otherwise
   */
  function checkForErrors() {
    // Check for error elements
    const errorSelectors = [
      '[class*="error"]',
      '[role="alert"]',
      '.ant-message-error',
      '.ant-notification-error',
      '[class*="limit"]',
      '[class*="warning"]'
    ];

    for (const selector of errorSelectors) {
      const errorEl = document.querySelector(selector);
      if (errorEl && errorEl.textContent && errorEl.offsetParent !== null) {
        const errorText = errorEl.textContent.toLowerCase();

        // Check for usage limit errors
        if (errorText.includes('usage limit') ||
            errorText.includes('daily limit') ||
            errorText.includes('rate limit') ||
            errorText.includes('limit exceeded') ||
            errorText.includes('reached the daily') ||
            errorText.includes('try again later') ||
            errorText.includes('wait') && errorText.includes('hour')) {

          console.error('[QwenAutomate] ⚠️ USAGE LIMIT DETECTED - TRY ANOTHER ACCOUNT');
          return {
            success: false,
            error: '⚠️ USAGE LIMIT - TRY ANOTHER ACCOUNT',
            errorType: 'usage_limit',
            originalError: errorEl.textContent
          };
        }

        // Check for connection errors
        if (errorText.includes('issue connecting') ||
            errorText.includes('connection') ||
            errorText.includes('network')) {

          console.error('[QwenAutomate] Connection error:', errorEl.textContent);
          return { success: false, error: 'Connection error: ' + errorEl.textContent };
        }

        // Generic error
        if (errorText.length > 5) {
          console.error('[QwenAutomate] Error detected:', errorEl.textContent);
          return { success: false, error: errorEl.textContent };
        }
      }
    }

    // Also check page text for specific error messages
    const bodyText = document.body.innerText;
    if (bodyText.includes('daily usage limit') ||
        bodyText.includes('reached the daily') ||
        bodyText.includes('usage limit') && bodyText.includes('wait')) {

      console.error('[QwenAutomate] ⚠️ USAGE LIMIT DETECTED (found in page) - TRY ANOTHER ACCOUNT');
      return {
        success: false,
        error: '⚠️ USAGE LIMIT - TRY ANOTHER ACCOUNT',
        errorType: 'usage_limit'
      };
    }

    return null;
  }

  async function downloadNewestContent(contentType) {
    console.log('[QwenAutomate] Looking for download button for newest', contentType);

    const messages = document.querySelectorAll(SELECTORS.messageContainer);
    console.log('[QwenAutomate] Found', messages.length, 'message containers');

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      let contentElement = null;

      if (contentType === 'video') {
        contentElement = message.querySelector(SELECTORS.generatedVideo);
      } else {
        contentElement = message.querySelector(SELECTORS.generatedImage);
      }

      if (contentElement) {
        console.log('[QwenAutomate] Found content in message', i);

        let downloadBtn = message.querySelector(SELECTORS.downloadButton);

        if (!downloadBtn) {
          const downloadIcons = message.querySelectorAll('[class*="download"]');
          for (const icon of downloadIcons) {
            const btn = icon.closest('button, [role="button"], .anticon');
            if (btn) {
              downloadBtn = btn;
              break;
            }
          }
        }

        if (!downloadBtn) {
          const parent = contentElement.closest('.qwen-chat-package-comp-new-chat-message-item');
          if (parent) {
            downloadBtn = parent.querySelector('button [class*="download"]') ||
                          parent.querySelector('[class*="download"]');
            if (downloadBtn && downloadBtn.tagName !== 'BUTTON') {
              downloadBtn = downloadBtn.closest('button');
            }
          }
        }

        if (downloadBtn) {
          console.log('[QwenAutomate] Found download button, clicking...');
          await clickElement(downloadBtn, 'download button for newest ' + contentType);
          await sleep(2000);
          return true;
        }

        console.log('[QwenAutomate] Could not find download button for newest content');
        return false;
      }
    }

    // Fallback
    const allDownloadBtns = document.querySelectorAll('[class*="download"]');
    if (allDownloadBtns.length > 0) {
      const lastBtn = allDownloadBtns[allDownloadBtns.length - 1];
      const btn = lastBtn.closest('button, [role="button"]') || lastBtn;
      console.log('[QwenAutomate] Using fallback: clicking last download button');
      await clickElement(btn, 'fallback download button');
      await sleep(2000);
      return true;
    }

    return false;
  }

  // ── Task Execution ──────────────────────────────────────────────────────────────

  async function executeTask(task) {
    if (busy) {
      return { success: false, error: 'Already processing another task' };
    }

    busy = true;
    currentTask = task;
    generationStartTime = Date.now();
    console.log('[QwenAutomate] ▶ Starting task:', task.id, 'mode:', task.mode);

    const result = { success: false, error: null };

    try {
      // Record content count BEFORE starting
      preGenerationContentCount = countExistingContent();
      console.log('[QwenAutomate] Content count before task:', preGenerationContentCount);

      // Handle image-to-video with special flow
      if (task.mode === 'image_to_video' || task.mode === 'imageToVideo') {
        if (!task.imageData) {
          throw new Error('image_to_video requires imageData');
        }

        // Step 1: Upload image FIRST
        console.log('[QwenAutomate] Image-to-video: Step 1 - Upload image');
        await uploadImageForVideo(task.imageData);
        await sleep(2000);  // Wait longer after upload

        // Step 2: Select "Create Video" mode
        console.log('[QwenAutomate] Image-to-video: Step 2 - Select Create Video mode');
        await selectMode('text_to_video');
        await sleep(1500);  // Wait for UI to update after mode selection

        // Step 3: Select aspect ratio (IMPORTANT - wait for UI to be ready)
        if (task.aspectRatio) {
          console.log('[QwenAutomate] Image-to-video: Step 3 - Select aspect ratio:', task.aspectRatio);
          // Extra wait to ensure aspect ratio selector is visible after mode change
          await sleep(500);
          await selectAspectRatio(task.aspectRatio);
          await sleep(500);
        }

        // Step 4: Enter prompt
        if (task.prompt) {
          console.log('[QwenAutomate] Image-to-video: Step 4 - Enter prompt');
          await enterPrompt(task.prompt);
          await sleep(300);
        }

        // Step 5: Click send
        console.log('[QwenAutomate] Image-to-video: Step 5 - Click send');
        await clickSendButton();

      } else {
        // Standard flow for text-to-image and text-to-video

        // Step 1: Select mode
        await selectMode(task.mode);
        await sleep(500);

        // Step 2: Select aspect ratio
        if (task.aspectRatio) {
          await selectAspectRatio(task.aspectRatio);
          await sleep(300);
        }

        // Step 3: Enter prompt
        if (task.prompt) {
          await enterPrompt(task.prompt);
        }

        // Step 4: Click send
        await clickSendButton();
      }

      // Wait for generation to complete
      const genResult = await waitForGeneration(task.timeout || 300000);
      if (!genResult.success) {
        throw new Error(genResult.error || 'Generation failed');
      }

      result.success = true;
      result.type = genResult.type;
      result.downloaded = genResult.downloaded;
      console.log('[QwenAutomate] ✓ Task completed:', task.id);

      try {
        chrome.runtime.sendMessage({
          type: 'TASK_STATUS_UPDATE',
          taskId: task.id,
          status: 'completed',
          result: genResult.type
        });
      } catch (e) {}

      if (bridgeAvailable) {
        try {
          await fetch(`${BRIDGE_BASE}/api/qwen-bridge/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId: task.id,
              type: 'success',
              contentType: genResult.type
            })
          });
        } catch (e) {}
      }

    } catch (error) {
      console.error('[QwenAutomate] ✗ Task error:', error);
      result.error = error.message;

      try {
        chrome.runtime.sendMessage({
          type: 'TASK_STATUS_UPDATE',
          taskId: task.id,
          status: 'failed',
          result: error.message
        });
      } catch (e) {}

      if (bridgeAvailable) {
        try {
          await fetch(`${BRIDGE_BASE}/api/qwen-bridge/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId: task.id,
              error: error.message
            })
          });
        } catch (e) {}
      }
    }

    busy = false;
    currentTask = null;
    generationStartTime = null;
    return result;
  }

  // ── Message Handler ────────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[QwenAutomate] Received message:', message.type);

    switch (message.type) {
      case 'PING':
        sendResponse({
          alive: true,
          busy: busy,
          currentTask: currentTask?.id || null,
          url: window.location.href
        });
        return false;

      case 'EXECUTE_TASK':
        if (busy) {
          sendResponse({ success: false, error: 'Already processing' });
          return false;
        }
        executeTask(message.task).then(result => sendResponse(result));
        return true;

      case 'GET_STATUS':
        sendResponse({
          alive: true,
          busy: busy,
          currentTask: currentTask?.id || null,
          url: window.location.href,
          contentCount: countExistingContent()
        });
        return false;

      default:
        return false;
    }
  });

  // ── Bridge Polling ─────────────────────────────────────────────────────────────

  async function checkBridgeStatus() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(`${BRIDGE_BASE}/api/qwen-bridge/status`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      bridgeAvailable = response.ok;
    } catch (e) {
      bridgeAvailable = false;
    }
  }

  async function pollBridgeForTasks() {
    if (busy || !bridgeAvailable) return;

    try {
      const response = await fetch(`${BRIDGE_BASE}/api/qwen-bridge/tasks`, {
        cache: 'no-store'
      });

      if (response.ok) {
        const { tasks } = await response.json();
        if (tasks?.length > 0) {
          console.log('[QwenAutomate] Found bridge task');
          await executeTask(tasks[0]);
        }
      }
    } catch (e) {}
  }

  // ── Initialization ─────────────────────────────────────────────────────────────

  function init() {
    console.log('[QwenAutomate] Content script initializing...');
    console.log('[QwenAutomate] Document readyState:', document.readyState);
    console.log('[QwenAutomate] URL:', window.location.href);
    console.log('[QwenAutomate] ✓ Content script ready - listening for messages');

    setTimeout(() => {
      checkBridgeStatus();
      const pollLoop = async () => {
        await checkBridgeStatus();
        await pollBridgeForTasks();
        setTimeout(pollLoop, POLL_MS);
      };
      pollLoop();
    }, 2000);
  }

  try {
    init();
    console.log('[QwenAutomate] Content script loaded successfully');
  } catch (e) {
    console.error('[QwenAutomate] Content script initialization error:', e);
  }

})();
