import { db } from './db.js';

// Configuration
const SCREENSHOT_QUALITY = 50; // 0-100
const MAX_WIDTH = 640; // Resize to this width to save space

async function captureAndSaveTab(tabId) {
    try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === 'complete' && tab.active) {
            // Skip restricted URLs that cannot be captured
            if (tab.url.startsWith('chrome://') ||
                tab.url.startsWith('edge://') ||
                tab.url.startsWith('about:') ||
                tab.url.startsWith('chrome-extension://') ||
                tab.url.includes('chrome.google.com/webstore')) {
                console.log(`Skipping capture for restricted URL: ${tab.url}`);
                return;
            }

            // captureVisibleTab returns a data URL (JPEG by default if not specified, but we can specify)
            const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
                format: 'jpeg',
                quality: SCREENSHOT_QUALITY
            });

            if (dataUrl) {
                // Optional: Resize image before saving to save even more space
                // For now, we'll save the raw capture (which is already compressed by quality setting)
                // To resize, we'd need an OffscreenCanvas or similar, which is complex in SW.
                // Let's stick to the quality setting for now.
                await db.saveScreenshot(tabId, dataUrl);
                console.log(`Saved screenshot for tab ${tabId}`);
            }
        }
    } catch (error) {
        console.error(`Failed to capture tab ${tabId}:`, error);
        // Attempt to log more specific permission info
        if (error.message.includes("permission")) {
            console.error("Permission error: Ensure the extension has 'Allow access to file URLs' if testing local files, and that host permissions are granted.");
        }
    }
}

// Listen for tab activation (user switches to a tab)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    // Capture quickly after switching (150ms allows for paint)
    setTimeout(() => captureAndSaveTab(activeInfo.tabId), 150);
});

// Listen for tab updates (page load completes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
        // Wait a bit for dynamic content to settle, but not too long
        setTimeout(() => captureAndSaveTab(tabId), 500);
    }
});

// Listen for tab removal to clean up
chrome.tabs.onRemoved.addListener(async (tabId) => {
    await db.deleteScreenshot(tabId);
    console.log(`Deleted screenshot for tab ${tabId}`);
});

// Initial capture of the current tab when extension loads/reloads
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
        captureAndSaveTab(tabs[0].id);
    }
});

// Handle the extension action click
chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: 'overview.html' });
});
