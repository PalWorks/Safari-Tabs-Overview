import { db } from './db.js';

// Configuration
const SCREENSHOT_QUALITY = 50; // 0-100
const MAX_WIDTH = 640; // Resize to this width to save space

// Resize image using OffscreenCanvas
async function resizeImage(dataUrl, targetWidth) {
    try {
        // Create a bitmap from the Data URL
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const bitmap = await createImageBitmap(blob);

        // Calculate new height
        const aspectRatio = bitmap.height / bitmap.width;
        const targetHeight = Math.round(targetWidth * aspectRatio);

        // Create OffscreenCanvas
        const canvas = new OffscreenCanvas(targetWidth, targetHeight);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

        // Convert back to Blob/DataURL (WebP for better compression)
        const compressedBlob = await canvas.convertToBlob({
            type: 'image/webp',
            quality: 0.8
        });

        // Convert Blob to DataURL for storage
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(compressedBlob);
        });
    } catch (error) {
        console.error('Resize failed, using original:', error);
        return dataUrl; // Fallback to original if resize fails
    }
}

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
                // Resize image before saving to save space (Target width 600px)
                const resizedDataUrl = await resizeImage(dataUrl, 600);

                await db.saveScreenshot(tabId, resizedDataUrl);
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
// Handle the extension action click
chrome.action.onClicked.addListener(async () => {
    const url = chrome.runtime.getURL('overview.html');

    // Check if the overview tab is already open
    const tabs = await chrome.tabs.query({ url: url });

    if (tabs.length > 0) {
        // If open, activate the first one and reload it
        const tab = tabs[0];
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.tabs.reload(tab.id);
    } else {
        // If not open, create a new one
        await chrome.tabs.create({ url: 'overview.html' });
    }
});
