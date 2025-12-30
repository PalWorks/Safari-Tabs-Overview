// db.js

// CONFIGURATION
// Set to true to use chrome.storage.local (requires 'unlimitedStorage' permission)
// Set to false to use IndexedDB (default)
const USE_LOCAL_STORAGE = false;

// ==========================================
// Adapter: IndexedDB (Original Implementation)
// ==========================================
const DB_NAME = 'TabsOverviewDB';
const DB_VERSION = 1;
const STORE_NAME = 'screenshots';

const idbAdapter = {
    async open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = (event) => reject('Database error: ' + event.target.error);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'tabId' });
                }
            };
            request.onsuccess = (event) => resolve(event.target.result);
        });
    },

    async saveScreenshot(tabId, dataUrl) {
        const database = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put({ tabId, screenshot: dataUrl, timestamp: Date.now() });
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    },

    async getScreenshot(tabId) {
        const database = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(tabId);
            request.onsuccess = (event) => resolve(event.target.result ? event.target.result.screenshot : null);
            request.onerror = (event) => reject(event.target.error);
        });
    },

    async deleteScreenshot(tabId) {
        const database = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(tabId);
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    },

    async getAllScreenshots() {
        const database = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = (event) => {
                const result = {};
                event.target.result.forEach(item => {
                    result[item.tabId] = item.screenshot;
                });
                resolve(result);
            };
            request.onerror = (event) => reject(event.target.error);
        });
    }
};

// ==========================================
// Adapter: Chrome Local Storage
// ==========================================
const localStorageAdapter = {
    getKey(tabId) {
        return `thumb_${tabId}`;
    },

    async saveScreenshot(tabId, dataUrl) {
        const key = this.getKey(tabId);
        await chrome.storage.local.set({ [key]: dataUrl });
    },

    async getScreenshot(tabId) {
        const key = this.getKey(tabId);
        const result = await chrome.storage.local.get(key);
        return result[key] || null;
    },

    async deleteScreenshot(tabId) {
        const key = this.getKey(tabId);
        await chrome.storage.local.remove(key);
    },

    async getAllScreenshots() {
        const allData = await chrome.storage.local.get(null);
        const result = {};
        for (const [key, value] of Object.entries(allData)) {
            if (key.startsWith('thumb_')) {
                const id = parseInt(key.replace('thumb_', ''));
                result[id] = value;
            }
        }
        return result;
    }
};

// ==========================================
// Main Export (Facade)
// ==========================================
export const db = {
    async saveScreenshot(tabId, dataUrl) {
        if (USE_LOCAL_STORAGE) {
            return localStorageAdapter.saveScreenshot(tabId, dataUrl);
        }
        return idbAdapter.saveScreenshot(tabId, dataUrl);
    },

    async getScreenshot(tabId) {
        if (USE_LOCAL_STORAGE) {
            return localStorageAdapter.getScreenshot(tabId);
        }
        return idbAdapter.getScreenshot(tabId);
    },

    async deleteScreenshot(tabId) {
        if (USE_LOCAL_STORAGE) {
            return localStorageAdapter.deleteScreenshot(tabId);
        }
        return idbAdapter.deleteScreenshot(tabId);
    },

    async getAllScreenshots() {
        if (USE_LOCAL_STORAGE) {
            return localStorageAdapter.getAllScreenshots();
        }
        return idbAdapter.getAllScreenshots();
    }
};
