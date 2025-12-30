import { db } from './db.js';

const grid = document.getElementById('tabs-grid');
const searchInput = document.getElementById('search-input');

let allTabs = [];
let screenshots = {};

async function init() {
    try {
        // 1. Fetch all tabs in current window
        const tabs = await chrome.tabs.query({ currentWindow: true });
        // Filter out the extension's own tabs (Overview page)
        allTabs = tabs.filter(tab => !tab.url.startsWith('chrome-extension://'));

        // 2. Fetch all screenshots from DB
        screenshots = await db.getAllScreenshots();

        // 3. Render tabs
        renderTabs(allTabs);

        // 4. Setup Search
        searchInput.addEventListener('input', handleSearch);
        searchInput.focus();

        // 5. Setup Theme
        initTheme();

    } catch (error) {
        console.error('Initialization failed:', error);
    }
}

// Theme Logic
const MODES = ['system', 'light', 'dark'];
let currentModeIndex = 0;

function initTheme() {
    const toggleBtn = document.getElementById('theme-toggle');

    // Load saved preference
    const savedMode = localStorage.getItem('theme_preference') || 'system';
    currentModeIndex = MODES.indexOf(savedMode);
    if (currentModeIndex === -1) currentModeIndex = 0;

    applyTheme(MODES[currentModeIndex]);

    toggleBtn.addEventListener('click', () => {
        currentModeIndex = (currentModeIndex + 1) % MODES.length;
        const newMode = MODES[currentModeIndex];
        applyTheme(newMode);
        localStorage.setItem('theme_preference', newMode);
    });

    // Listen for system changes if in system mode
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (MODES[currentModeIndex] === 'system') {
            applyTheme('system');
        }
    });
}

function applyTheme(mode) {
    const body = document.body;
    const toggleBtn = document.getElementById('theme-toggle');

    let isDark = false;

    if (mode === 'system') {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        toggleBtn.title = "Theme: System";
    } else if (mode === 'dark') {
        isDark = true;
        toggleBtn.title = "Theme: Dark";
    } else {
        isDark = false;
        toggleBtn.title = "Theme: Light";
    }

    if (isDark) {
        body.classList.remove('light-theme');
    } else {
        body.classList.add('light-theme');
    }
}

function renderTabs(tabs) {
    grid.innerHTML = ''; // Clear existing

    tabs.forEach(tab => {
        const card = createTabCard(tab);
        grid.appendChild(card);
    });
}

function createTabCard(tab) {
    const card = document.createElement('div');
    card.className = 'tab-card';
    card.dataset.id = tab.id;
    card.title = tab.title; // Tooltip

    // Click to switch tab
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.close-btn')) {
            chrome.tabs.update(tab.id, { active: true });
            // Optional: Close the overview tab itself if it's a separate tab? 
            // Usually "Overview" is a UI overlay, but here it's a page.
            // If it's a popup or new tab, we might want to close it or just let the browser handle focus.
            // If opened via action, it's a tab. Let's just switch.
        }
    });

    // Header (Favicon + Title)
    const header = document.createElement('div');
    header.className = 'tab-header';

    const favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    favicon.src = tab.favIconUrl || 'icons/icon16.png'; // Fallback icon
    favicon.onerror = () => { favicon.src = 'icons/icon16.png'; }; // Handle broken favicons

    const title = document.createElement('div');
    title.className = 'tab-title';
    title.textContent = tab.title;

    header.appendChild(favicon);
    header.appendChild(title);

    // Thumbnail
    const thumbnail = document.createElement('div');
    thumbnail.className = 'tab-thumbnail';

    const screenshotDataUrl = screenshots[tab.id];
    if (screenshotDataUrl) {
        thumbnail.style.backgroundImage = `url(${screenshotDataUrl})`;
    } else {
        thumbnail.classList.add('fallback');
        // Extract domain for fallback text
        try {
            const url = new URL(tab.url);
            thumbnail.textContent = url.hostname.replace('www.', '');
        } catch (e) {
            thumbnail.textContent = 'Tab';
        }
    }

    // Close Button
    const closeBtn = document.createElement('div');
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = '&#10005;'; // X symbol
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card click
        closeTab(tab.id, card);
    });

    card.appendChild(header);
    card.appendChild(closeBtn); // Add close button before thumbnail so z-index works easily or just absolute pos
    card.appendChild(thumbnail);

    return card;
}

async function closeTab(tabId, cardElement) {
    try {
        await chrome.tabs.remove(tabId);
        // Animate removal
        cardElement.style.transform = 'scale(0.8)';
        cardElement.style.opacity = '0';
        setTimeout(() => {
            cardElement.remove();
            // Update local list
            allTabs = allTabs.filter(t => t.id !== tabId);
        }, 200);

        // Also remove screenshot from DB to keep it clean immediately
        await db.deleteScreenshot(tabId);
    } catch (error) {
        console.error('Failed to close tab:', error);
    }
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase();

    const cards = grid.children;
    for (let card of cards) {
        const tabId = parseInt(card.dataset.id);
        const tab = allTabs.find(t => t.id === tabId);

        if (tab) {
            const matches = tab.title.toLowerCase().includes(query) || tab.url.toLowerCase().includes(query);
            if (matches) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        }
    }
}

// Start
init();
