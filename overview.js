import { db } from './db.js';

const grid = document.getElementById('tabs-grid');
const searchInput = document.getElementById('search-input');
const sidebar = document.getElementById('sidebar');
const sidebarList = document.getElementById('sidebar-list');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarTitle = document.getElementById('sidebar-title');
const backBtn = document.getElementById('back-btn');
const viewTitle = document.getElementById('view-title');

let allTabs = [];
let tabGroups = [];
let screenshots = {};
let currentFilter = 'all'; // 'all' or groupId
let currentSort = 'date-newest'; // Default sort

// SVG Icons
const FOLDER_ICON_SVG = `
<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
<path d="M20 6H12L10 4H4C2.89543 4 2 4.89543 2 6V18C2 19.1046 2.89543 20 4 20H20C21.1046 20 22 19.1046 22 18V8C22 6.89543 21.1046 6 20 6Z"/>
</svg>`;

const GENERIC_FAVICON_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999' width='16' height='16'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z'/%3E%3C/svg%3E`;

async function init() {
    try {
        // 1. Initial Data Fetch
        await refreshData();

        // 2. Setup Search
        searchInput.addEventListener('input', handleSearch);
        searchInput.focus();

        // 3. Setup Theme
        initTheme();

        // 4. Setup Sidebar Toggle
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                updateSidebarTitleVisibility();
            });
        }

        // 5. Setup Back Button
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                switchFilter('all');
            });
        }

        // 6. Setup Sorting
        setupSorting();

        // 7. Auto-Refresh on Tab Focus
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                refreshData();
            }
        });

    } catch (error) {
        console.error('Initialization failed:', error);
    }
}

async function refreshData() {
    try {
        // Fetch all tabs and groups
        const [tabs, groups] = await Promise.all([
            chrome.tabs.query({ currentWindow: true }),
            chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT })
        ]);

        // Filter out extension tabs
        allTabs = tabs.filter(tab => !tab.url.startsWith('chrome-extension://'));
        tabGroups = groups;

        // Fetch screenshots
        screenshots = await db.getAllScreenshots();

        // Validate Current Filter (if group was deleted)
        if (currentFilter !== 'all') {
            const groupExists = tabGroups.some(g => g.id === currentFilter);
            if (!groupExists) {
                currentFilter = 'all';
            }
        }

        // Update UI
        renderSidebar();
        renderGrid();

        // Update Sidebar Toggle State
        if (sidebarToggle) {
            if (tabGroups.length === 0) {
                sidebarToggle.style.opacity = '0.5';
                sidebarToggle.style.pointerEvents = 'none';
                if (sidebarTitle) sidebarTitle.style.display = 'none';
            } else {
                sidebarToggle.style.opacity = '1';
                sidebarToggle.style.pointerEvents = 'auto';
                if (sidebarTitle) sidebarTitle.style.display = ''; // Reset to default (flex/block)
            }
        }

    } catch (error) {
        console.error('Data refresh failed:', error);
    }
}

function setupSorting() {
    const sortBtn = document.getElementById('sort-btn');
    const sortMenu = document.getElementById('sort-menu');
    const sortOptions = document.querySelectorAll('.sort-option');

    if (!sortBtn || !sortMenu) return;

    // Toggle Menu
    sortBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sortMenu.classList.toggle('hidden');
    });

    // Close Menu on Outside Click
    document.addEventListener('click', (e) => {
        if (!sortMenu.contains(e.target) && !sortBtn.contains(e.target)) {
            sortMenu.classList.add('hidden');
        }
    });

    // Handle Option Click
    sortOptions.forEach(option => {
        option.addEventListener('click', () => {
            const sortType = option.dataset.sort;
            currentSort = sortType;

            // Update Active State
            sortOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');

            // Close Menu and Re-render
            sortMenu.classList.add('hidden');
            renderGrid();
        });
    });

    // Set initial active state
    const defaultOption = document.querySelector(`.sort-option[data-sort="${currentSort}"]`);
    if (defaultOption) defaultOption.classList.add('active');
}

function updateSidebarTitleVisibility() {
    if (!sidebarTitle) return;

    // If sidebar is collapsed, HIDE title (as per user request: "visible only when expanded")
    // Wait, user said: "visible only when the hamburger menu is clicked" -> which implies when sidebar is OPEN/EXPANDED.
    // Actually, usually "hamburger menu clicked" means "menu is open".
    // Let's assume: Open Sidebar = Title Visible. Collapsed Sidebar = Title Hidden.

    if (sidebar.classList.contains('collapsed')) {
        sidebarTitle.classList.add('hidden');
    } else {
        sidebarTitle.classList.remove('hidden');
    }
}

function renderSidebar() {
    sidebarList.innerHTML = '';

    // Only show sidebar if groups exist
    if (tabGroups.length > 0) {
        sidebar.classList.remove('hidden');
        updateSidebarTitleVisibility(); // Ensure correct initial state
    } else {
        sidebar.classList.add('hidden');
        return;
    }

    // "All Tabs" Item
    const allItem = document.createElement('div');
    allItem.className = `sidebar-item ${currentFilter === 'all' ? 'active' : ''}`;
    allItem.innerHTML = `<div class="group-dot" style="background-color: var(--text-color)"></div> All Tabs`;
    allItem.addEventListener('click', () => switchFilter('all'));
    sidebarList.appendChild(allItem);

    // Group Items
    tabGroups.forEach(group => {
        const item = document.createElement('div');
        item.className = `sidebar-item ${currentFilter === group.id ? 'active' : ''}`;

        // Chrome group colors map to CSS colors (simplified)
        const colorMap = {
            grey: '#5f6368',
            blue: '#1a73e8',
            red: '#d93025',
            yellow: '#f9ab00',
            green: '#188038',
            pink: '#e52592',
            purple: '#9334e6',
            cyan: '#12b5cb',
            orange: '#fa903e'
        };
        const color = colorMap[group.color] || group.color;

        item.innerHTML = `<div class="group-dot" style="background-color: ${color}"></div> ${group.title || 'Untitled Group'}`;
        item.addEventListener('click', () => switchFilter(group.id));
        sidebarList.appendChild(item);
    });
}

function switchFilter(filter) {
    currentFilter = filter;
    renderSidebar(); // Re-render to update active state
    renderGrid();
}

function sortTabs(tabs) {
    return tabs.sort((a, b) => {
        switch (currentSort) {
            case 'title-asc':
                return a.title.localeCompare(b.title);
            case 'title-desc':
                return b.title.localeCompare(a.title);
            case 'domain-asc':
                try {
                    const hostA = new URL(a.url).hostname.replace('www.', '');
                    const hostB = new URL(b.url).hostname.replace('www.', '');
                    return hostA.localeCompare(hostB);
                } catch (e) { return 0; }
            case 'domain-desc':
                try {
                    const hostA = new URL(a.url).hostname.replace('www.', '');
                    const hostB = new URL(b.url).hostname.replace('www.', '');
                    return hostB.localeCompare(hostA);
                } catch (e) { return 0; }
            case 'date-newest':
                return b.id - a.id; // Higher ID = Newer
            case 'date-oldest':
                return a.id - b.id; // Lower ID = Older
            default:
                return 0;
        }
    });
}

function renderGrid() {
    grid.innerHTML = '';
    const query = searchInput.value.toLowerCase();

    let tabsToRender = [];
    let currentGroup = null;

    if (currentFilter === 'all') {
        // Update View Header
        if (viewTitle) viewTitle.textContent = 'All Tabs';
        if (backBtn) backBtn.classList.add('hidden');

        // In "All Tabs" view:
        // 1. Show Group Cards for groups
        // 2. Show Loose Tabs (groupId === -1)

        // Render Group Cards first
        tabGroups.forEach(group => {
            // Check if group matches search (if search exists)
            // OR if any tab in group matches search
            const groupTabs = allTabs.filter(t => t.groupId === group.id);
            const matchesSearch = !query ||
                (group.title && group.title.toLowerCase().includes(query)) ||
                groupTabs.some(t => t.title.toLowerCase().includes(query) || t.url.toLowerCase().includes(query));

            if (matchesSearch) {
                const card = createGroupCard(group, groupTabs.length);
                grid.appendChild(card);
            }
        });

        // Render Loose Tabs
        tabsToRender = allTabs.filter(t => t.groupId === -1);

    } else {
        // Specific Group View
        currentGroup = tabGroups.find(g => g.id === currentFilter);

        // Update View Header
        if (viewTitle) viewTitle.textContent = currentGroup ? (currentGroup.title || 'Untitled Group') : 'Group';
        if (backBtn) backBtn.classList.remove('hidden');

        tabsToRender = allTabs.filter(t => t.groupId === currentFilter);
    }

    // Filter tabs by search query
    if (query) {
        tabsToRender = tabsToRender.filter(t =>
            t.title.toLowerCase().includes(query) ||
            t.url.toLowerCase().includes(query)
        );
    }

    // Sort Tabs
    tabsToRender = sortTabs(tabsToRender);

    // Render Tab Cards
    tabsToRender.forEach(tab => {
        const card = createTabCard(tab);
        grid.appendChild(card);
    });
}

function createGroupCard(group, count) {
    const card = document.createElement('div');
    card.className = 'tab-card group-card';
    card.title = `Group: ${group.title || 'Untitled'}`;

    const folder = document.createElement('div');
    folder.className = 'group-folder';

    // Color styling
    const colorMap = {
        grey: '#5f6368',
        blue: '#1a73e8',
        red: '#d93025',
        yellow: '#f9ab00',
        green: '#188038',
        pink: '#e52592',
        purple: '#9334e6',
        cyan: '#12b5cb',
        orange: '#fa903e'
    };
    const color = colorMap[group.color] || 'var(--text-secondary)';
    folder.style.borderColor = color;

    folder.innerHTML = `
        <div class="group-icon" style="color: ${color}">${FOLDER_ICON_SVG}</div>
        <div class="tab-title" style="flex-grow: 0; font-weight: bold; color: var(--text-color);">${group.title || 'Untitled Group'}</div>
        <div class="group-count">${count} Tabs</div>
    `;

    // Single click to enter group
    card.addEventListener('click', () => {
        switchFilter(group.id);
    });

    card.appendChild(folder);
    return card;
}

function createTabCard(tab) {
    const card = document.createElement('div');
    card.className = 'tab-card';
    card.dataset.id = tab.id;
    card.title = tab.title;

    card.addEventListener('click', (e) => {
        if (!e.target.closest('.close-btn')) {
            chrome.tabs.update(tab.id, { active: true });
        }
    });

    // Header
    const header = document.createElement('div');
    header.className = 'tab-header';

    const favicon = document.createElement('img');
    favicon.className = 'tab-favicon';

    // Favicon Fallback Logic
    if (tab.favIconUrl && (tab.favIconUrl.startsWith('http') || tab.favIconUrl.startsWith('data:'))) {
        favicon.src = tab.favIconUrl;
    } else {
        favicon.src = GENERIC_FAVICON_SVG;
    }

    favicon.onerror = () => { favicon.src = GENERIC_FAVICON_SVG; };

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
    closeBtn.innerHTML = '&#10005;';
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(tab.id, card);
    });

    card.appendChild(header);
    card.appendChild(closeBtn);
    card.appendChild(thumbnail);

    return card;
}

async function closeTab(tabId, cardElement) {
    try {
        await chrome.tabs.remove(tabId);
        cardElement.style.transform = 'scale(0.8)';
        cardElement.style.opacity = '0';
        setTimeout(() => {
            cardElement.remove();
            allTabs = allTabs.filter(t => t.id !== tabId);
            // If in group view and empty, maybe switch back? 
            // For now, stay.
        }, 200);
        await db.deleteScreenshot(tabId);
    } catch (error) {
        console.error('Failed to close tab:', error);
    }
}

function handleSearch(e) {
    renderGrid();
}

// Theme Logic
const MODES = ['system', 'light', 'dark'];
let currentModeIndex = 0;

function initTheme() {
    const toggleBtn = document.getElementById('theme-toggle');
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

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (MODES[currentModeIndex] === 'system') {
            applyTheme('system');
        }
    });
}

// Theme Icons
const SUN_ICON_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>`;

const MOON_ICON_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>`;

const SYSTEM_ICON_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" xmlns="http://www.w3.org/2000/svg"><path d="M12,22 C17.5228475,22 22,17.5228475 22,12 C22,6.4771525 17.5228475,2 12,2 C6.4771525,2 2,6.4771525 2,12 C2,17.5228475 6.4771525,22 12,22 Z M12,20.5 L12,3.5 C16.6944204,3.5 20.5,7.30557963 20.5,12 C20.5,16.6944204 16.6944204,20.5 12,20.5 Z"/></svg>`;

function applyTheme(mode) {
    const body = document.body;
    const toggleBtn = document.getElementById('theme-toggle');
    let isDark = false;

    if (mode === 'system') {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        toggleBtn.title = "Theme: System";
        toggleBtn.innerHTML = SYSTEM_ICON_SVG;
    } else if (mode === 'dark') {
        isDark = true;
        toggleBtn.title = "Theme: Dark";
        toggleBtn.innerHTML = MOON_ICON_SVG;
    } else {
        isDark = false;
        toggleBtn.title = "Theme: Light";
        toggleBtn.innerHTML = SUN_ICON_SVG;
    }

    if (isDark) {
        body.classList.remove('light-theme');
    } else {
        body.classList.add('light-theme');
    }
}

init();
