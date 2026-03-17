/**
 * OpenMosaic Bridge – Side Panel Automation Script
 *
 * Injected after React mounts (see index.html).
 * Polls POST /api/grok-bridge/tasks, drives the Side Panel UI,
 * then watches chrome.downloads to call /complete.
 */

const OM_BASE = "http://localhost:3000";
const POLL_MS = 3000;

let busy = false;

// ── Utilities ──────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Find a button whose trimmed innerText contains `text` (case-insensitive). */
function btn(text) {
    const lower = text.toLowerCase();
    return [...document.querySelectorAll("button")].find(
        b => b.innerText.trim().toLowerCase().includes(lower)
    ) ?? null;
}

/** Fill a React textarea/input with a value (fires React's onChange). */
function fillReact(el, value) {
    const proto = (el.tagName === "TEXTAREA") ? HTMLTextAreaElement : HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Click a custom React dropdown and pick an option by visible text.
 */
async function pickDropdownOption(label, optionText) {
    // 1. Find section containing the label text
    const allText = [...document.querySelectorAll("div, span, p, label, button")];

    // Find the most specific text element containing the label (case insensitive)
    const labelLower = label.toLowerCase();
    const labelEls = allText.filter(el =>
        el.innerText &&
        el.innerText.toLowerCase().includes(labelLower) &&
        el.children.length < 3 // Ignore giant wrapper divs that contain the whole page
    );

    if (labelEls.length === 0) {
        console.warn("[OpenMosaic] Could not find any label matching:", label);
        return false;
    }

    // Sort by smallest string length to get the most exact match
    labelEls.sort((a, b) => a.innerText.length - b.innerText.length);
    const bestLabel = labelEls[0];

    // 2. Find the trigger button near this label
    // Walk up the DOM 2-3 levels to find the field container, look for a button or combobox inside
    let trigger = null;
    let container = bestLabel;

    for (let i = 0; i < 5; i++) {
        if (!container) break;
        // Look for typical React select triggers inside this level
        const possibleTriggers = container.querySelectorAll("button, [role='combobox'], [class*='select'], div, svg");
        for (const pt of possibleTriggers) {
            // make sure it's an actual interactive dropdown box logic, usually has chevron or is a button
            if (pt !== bestLabel && pt.innerText) {
                // Heuristic: check if this is the trigger that shows the current selected value with a chevron near it
                if (pt.tagName === "BUTTON" || pt.getAttribute("role") === "combobox" || pt.innerHTML.includes("<svg")) {
                    trigger = pt;
                    break;
                }
            }
        }
        if (trigger) break;

        // Alternative heuristic: if the label is adjacent to the trigger div (e.g. Flexbox layout)
        if (container.nextElementSibling) {
            const nextNode = container.nextElementSibling;
            if (nextNode.innerHTML && nextNode.innerHTML.includes("<svg") && nextNode.innerText) {
                trigger = nextNode;
                break;
            }
        }
        container = container.parentElement;
    }

    if (!trigger) {
        console.warn("[OpenMosaic] Found label, but no dropdown trigger for:", label);
        return false;
    }

    trigger.click();
    await sleep(400);

    // 3. Find the option in the now-open list
    const optionLower = optionText.toLowerCase();
    const allOptions = [...document.querySelectorAll("li, [role='option'], span, div")];

    let optionEl = allOptions.find(el =>
        el.innerText &&
        el.innerText.toLowerCase().includes(optionLower) &&
        el.children.length === 0
    );

    if (optionEl) {
        // React select dropdowns attach the 'onClick' event to the wrapper <li>, not the text span.
        const clickableWrapper = optionEl.closest("li, [role='option']") || optionEl;
        clickableWrapper.click();
        await sleep(300);
        return true;
    }

    // Close the dropdown if we failed
    trigger.click();
    await sleep(200);
    console.warn("[OpenMosaic] Option not found in dropdown:", optionText);
    return false;
}

// ── Automation Steps ────────────────────────────────────────────────────────

async function switchTab(name) {
    const b = btn(name);
    if (b) { b.click(); await sleep(450); }
}

/** Maps task.mode to the mode button label in the Control tab */
const MODE_LABELS = {
    textToImage: "Text to Image",
    textToVideo: "Text to Video",
    imageToVideo: "Frame to Video",
    imageToImage: "Image to Image",
};

/** Maps task.aspectRatio (e.g. "16:9") to the option text shown in the dropdown */
const AR_OPTION_TEXT = {
    "16:9": "16:9 (YouTube)",
    "9:16": "9:16 (TikTok)",
    "1:1": "1:1 (Square)",
    "2:3": "2:3",
    "3:2": "3:2",
    "4:5": "4:5"
};

async function applySettings(task) {
    await switchTab("Setting");

    // ─ Aspect Ratio ─
    const arText = AR_OPTION_TEXT[task.aspectRatio] ?? "16:9";
    // Try several label spellings the extension may use
    const found = await pickDropdownOption("Aspect Ratio", arText)
        || await pickDropdownOption("Default Aspect Ratio", arText)
        || await pickDropdownOption("aspect ratio", arText);
    if (!found) console.warn("[OpenMosaic] Aspect ratio not set using text:", arText);

    // ─ Auto Download Quality → 720p ─
    await pickDropdownOption("Auto Download Quality", "720p")
        || await pickDropdownOption("Download Quality", "720p")
        || await pickDropdownOption("Quality", "720p");

    // Save if available
    const saveBtn = btn("Save Settings") ?? btn("Save");
    if (saveBtn) { saveBtn.click(); await sleep(400); }

    await switchTab("Control");
}

async function selectMode(task) {
    const label = MODE_LABELS[task.mode] ?? "Text to Image";
    const b = btn(label);
    if (b) { b.click(); await sleep(450); }
    else console.warn("[OpenMosaic] Mode button not found:", label);
}

async function fillAndRun(taskId, prompt) {
    // Route the next download to the openmosaic folder (if Chrome allows it)
    chrome.runtime.sendMessage({ type: "SETUP_DOWNLOAD", folder: "", prefix: taskId + "_" });

    // Fill prompt
    const ta = document.querySelector("textarea");
    if (ta) { fillReact(ta, prompt); await sleep(400); }
    else console.warn("[OpenMosaic] No textarea for prompt");

    // Click Run
    const run = btn("Run");
    if (!run) {
        console.warn("[OpenMosaic] No Run button – aborting");
        return postFailure(taskId, "Run button not found");
    }

    // Record exact precise start time so we can find the download even if its name is stripped
    const startTimeStamp = new Date().toISOString();
    run.click();
    console.log("[OpenMosaic] 🚀 Clicked Run for task", taskId, "at", startTimeStamp);

    // Wait until the UI finishes
    await waitForCompletion(taskId, startTimeStamp);
}

async function waitForCompletion(taskId, startTimeStamp, maxMs = 300_000) {
    const deadline = Date.now() + maxMs;
    let lastDownloadId = null;

    while (Date.now() < deadline) {
        await sleep(2000);

        // Check if extension ui shows Generation Complete
        const complete = document.body.innerText.includes("Generation Complete");
        const sending = btn("Sending");

        if (complete && !sending) {
            // Give the download a moment to start
            await sleep(3000);

            // Scan chrome.downloads for any file that started AFTER we clicked Run
            const matched = await findOurDownload(startTimeStamp);
            if (matched) {
                lastDownloadId = matched.id;
                await waitForDownloadFinish(matched.id, deadline, taskId);
                break;
            } else {
                // If we didn't find one, wait a bit longer just in case Chrome is slow
                console.warn("[OpenMosaic] Generation complete, but no recent download found yet...");
            }
        }
    }

    busy = false; // Release lock
}

/** Poll chrome.downloads.search for the PRECISE first file (_a.jpg) or video started AFTER our exact prompt time */
function findOurDownload(startTimeISO) {
    return new Promise(resolve => {
        const queryTime = new Date(startTimeISO).getTime();

        chrome.downloads.search({
            orderBy: ["-startTime"], // Newest first
            limit: 20
        }, items => {
            // Filter all items that started after we clicked Run
            const recentItems = items.filter(it => {
                if (!it.filename) return false;
                return new Date(it.startTime).getTime() >= queryTime;
            });

            // If it's a video, just take the first one
            const video = recentItems.find(it => /\.(mp4|webm)$/i.test(it.filename));
            if (video) return resolve(video);

            // If it's an image, Grok batches them. We ONLY want the first one "_a.jpg" or "_1.jpg" or the first image we see if no suffix
            const images = recentItems.filter(it => /\.(png|jpg|jpeg|webp)$/i.test(it.filename));
            if (images.length > 0) {
                // Try to find the "_a" explicitly to avoid grabbing a half-downloaded "_d"
                const firstBatchImage = images.find(it => /_[1a]\.(png|jpg|jpeg|webp)$/i.test(it.filename));
                resolve(firstBatchImage || images[images.length - 1]); // fallback to oldest recent image
            } else {
                resolve(null);
            }
        });
    });
}

/** Wait until a download item reaches 'complete', then call /complete */
function waitForDownloadFinish(dlId, deadline, taskId) {
    return new Promise(resolve => {
        function check() {
            if (Date.now() > deadline) { resolve(); return; }
            chrome.downloads.search({ id: dlId }, ([item]) => {
                if (!item) { resolve(); return; }

                if (item.state === "complete") {
                    // We only grabbed the first image/video, so we don't need a debounce anymore!
                    // Proceed with completion
                    notifyComplete(item, taskId);

                    // Cancel the rest of the batch to keep the user's filesystem clean
                    const basename = item.filename.replace(/_[1a-zA-Z0-9]\.(png|jpg|jpeg|webp)$/i, '');
                    chrome.downloads.search({ state: "in_progress" }, activeDls => {
                        for (const active of activeDls) {
                            if (active.filename && active.filename.startsWith(basename) && active.id !== item.id) {
                                chrome.downloads.cancel(active.id);
                                console.log("[OpenMosaic] Cancelled redundant batch image:", active.filename);
                            }
                        }
                    });

                    resolve();
                } else if (item.state === "interrupted") {
                    console.error("[OpenMosaic] Download interrupted!", item.filename);
                    postFailure(taskId, "Chrome download interrupted: " + item.filename);
                    resolve();
                } else {
                    setTimeout(check, 1500);
                }
            });
        }
        check();
    });
}

/** POST the completed download filepath to /api/grok-bridge/complete */
async function notifyComplete(dlItem, originalTaskId) {
    const type = dlItem.filename.endsWith(".mp4") ? "video" : "image";
    console.log("[OpenMosaic] Download done →", dlItem.filename, "task:", originalTaskId);
    try {
        await fetch(`${OM_BASE}/api/grok-bridge/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId: originalTaskId, type, dataBase64: dlItem.filename }),
        });
    } catch (e) { console.error("[OpenMosaic] /complete failed:", e); }
}

async function postFailure(taskId, message) {
    try {
        await fetch(`${OM_BASE}/api/grok-bridge/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId, error: message }),
        });
    } catch (_) { }
    busy = false;
}

// ── Main Handler ────────────────────────────────────────────────────────────

async function handleTask(task) {
    busy = true;
    console.log("[OpenMosaic] ▶ Handling task", task.id, task.mode, task.aspectRatio);
    try {
        await switchTab("Control");      // ensure we start on Control
        await applySettings(task);       // Setting tab → aspect ratio + 720p quality → back to Control
        await selectMode(task);          // click the mode button
        await fillAndRun(task.id, task.prompt);
    } catch (err) {
        console.error("[OpenMosaic] Task error:", err);
        await postFailure(task.id, String(err));
    }
}

// ── Polling Loop ────────────────────────────────────────────────────────────

async function poll() {
    if (!busy) {
        try {
            const res = await fetch(`${OM_BASE}/api/grok-bridge/tasks`, { cache: "no-store" });
            if (res.ok) {
                const { tasks } = await res.json();
                if (tasks?.length) await handleTask(tasks[0]);
            }
        } catch (_) { /* server not ready yet */ }
    }
    setTimeout(poll, POLL_MS);
}

// Start after React has fully mounted
setTimeout(poll, 2500);
