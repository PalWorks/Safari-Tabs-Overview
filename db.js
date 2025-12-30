// db.js
const DB_NAME = 'TabsOverviewDB';
const DB_VERSION = 1;
const STORE_NAME = 'screenshots';

export const db = {
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
