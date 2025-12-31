// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'CAPTURE_TAB') {
        captureTab().then(dataUrl => {
            sendResponse({ success: true, dataUrl: dataUrl });
        }).catch(error => {
            console.error('Capture failed:', error);
            sendResponse({ success: false, error: error.toString() });
        });
        return true; // Keep channel open for async response
    }
});

async function captureTab() {
    if (typeof html2canvas === 'undefined') {
        throw new Error('html2canvas not loaded');
    }

    const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: false,
        logging: false,
        height: window.innerHeight,
        width: window.innerWidth,
        windowHeight: window.innerHeight,
        windowWidth: window.innerWidth,
        ignoreElements: (element) => {
            // Ignore scrollbars if possible, or specific elements if needed
            return false;
        }
    });

    return canvas.toDataURL('image/jpeg', 0.5); // Use JPEG quality 50 to match previous logic
}
