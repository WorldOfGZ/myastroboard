// MyAstroBoard Modern Frontend JavaScript
// Core initialization and navigation

let currentConfig = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

// ======================
// Navigation Tabs
// ======================

async function initializeApp() {
    setupMainTabs(); 
    setupSubTabs();
    await loadTimezones();
    await loadConfiguration();  // Wait for config to load before loading catalogues
    await loadCatalogues();  // Also await catalogues to ensure proper sequencing
    setupEventListeners();
    loadVersion();

    // Init uptonight scheduler
    UptonightScheduler.init();

    checkCacheStatus();
    
    // Load initial page
    switchSubTab("forecast-astro", "astro-weather"); 
}

function setupMainTabs() {
    const mainTabBtns = document.querySelectorAll('.main-tab-btn');
    mainTabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = btn.getAttribute('data-tab');
            switchMainTab(tabName);
        });
    });
}

function switchMainTab(tabName) {
    //console.log(`Switching to main tab: ${tabName}`);

    // Forach .main-tab-dropdown remove "active" class
    document.querySelectorAll('.main-tab-dropdown').forEach(dropdown => {
        dropdown.classList.remove('active');
    });

    // Update button states
    document.querySelectorAll('.main-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');

            // Find the parent <li class="dropdown">
            const dropdownLi = btn.closest('.dropdown');

            if (dropdownLi) {
                // Find the toggle inside that dropdown
                const toggle = dropdownLi.querySelector('.main-tab-dropdown');
                if (toggle) {
                    toggle.classList.add('active');
                }
            }
        }
    });    
    
    // Update content visibility
    document.querySelectorAll('.main-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Load tab-specific content
    if (tabName === 'uptonight') {
        loadUptonightResultsTabs();
    } else if (tabName === 'astrodex') {
        loadAstrodex();
    } else if (tabName === 'forecast-weather') {
        loadWeather();
    }
}

function setupSubTabs() {
    // Use event delegation for dynamically added sub-tabs
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('sub-tab-btn')) {
            // if element clicked has no id, we exit to prevent errors when clicking on elements that are not sub-tab buttons
            const subtabId = e.target.getAttribute('data-subtab');
            if (!subtabId) return;

            // prevent default link behavior
            e.preventDefault();
            const subtabName = e.target.getAttribute('data-subtab');
            const parentTab = e.target.closest('.main-tab-content').id.replace('-tab', '');
            switchSubTab(parentTab, subtabName);
        }
    });
}

function setupNavbarAutoCollapse() {
    const navbarCollapse = document.getElementById('navBarMyAstroBoard');
    if (!navbarCollapse) return;

    navbarCollapse.addEventListener('click', (event) => {
        const link = event.target.closest('.nav-link');
        if (!link) return;

        // Ignore dropdown toggles
        if (link.matches('[data-bs-toggle="dropdown"]')) return;

        if (!navbarCollapse.classList.contains('show')) return;

        const collapseInstance = bootstrap.Collapse.getInstance(navbarCollapse);
        (collapseInstance || new bootstrap.Collapse(navbarCollapse)).hide();
    });
}

function switchSubTab(parentTab, subtabName) {
    activateSubTab(parentTab, subtabName);

    //console.log(`Switched to sub-tab: ${subtabName} under main tab: ${parentTab}`);

    // Stop metrics auto-refresh when switching away from metrics tab
    if (subtabName !== 'metrics') {
        stopMetricsAutoRefresh();
    }

    // Load subtab-specific content
    if (subtabName === 'logs') { //Parameters tab - Logs
        loadLogs();
    } else if (subtabName === 'users') { //Parameters tab - Users
        loadUsers();
    } else if (subtabName === 'metrics') { //Parameters tab - Metrics
        startMetricsAutoRefresh();
    } else if (subtabName === 'weather') { //Weather Forecast tab - Weather
        loadWeather();
    } else if (subtabName === 'astro-weather') { //Astro Forecast tab - Astrophotography Weather
        loadAstroWeather();
    } else if (subtabName === 'window') { //Astro Forecast tab - Best Observation Window
        loadBestDarkWindow();
    } else if (subtabName === 'trend') { //Weather Forecast tab - Observation Conditions
        loadAstronomicalCharts();
    } else if (subtabName === 'moon') { //Astro Forecast tab - Moon
        loadMoon();
        loadNextMoonPhases();
        loadLunarEclipse();
    } else if (subtabName === 'sun') { //Astro Forecast tab - Sun
        loadSun();
        loadSolarEclipse();
    } else if (subtabName === 'aurora') { //Astro Forecast tab - Aurora Borealis
        loadAurora();
    } else if (subtabName === 'iss') { //Astro Forecast tab - ISS
        loadIss();
    } else if (subtabName === 'calendar') { //Astro Forecast tab - Events Calendar
        clearEventsCache();
        loadAndDisplayEvents();
    }
}

function activateSubTab(parentTab, subtabName) {
    const parentElement = document.getElementById(`${parentTab}-tab`);
    if (!parentElement) return;

    const buttons = parentElement.querySelectorAll('.sub-tab-btn');
    const contents = parentElement.querySelectorAll('.sub-tab-content');

    buttons.forEach(b => b.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));

    const btn = parentElement.querySelector(`.sub-tab-btn[data-subtab="${subtabName}"]`);
    const content = document.getElementById(`${subtabName}-subtab`);

    if (btn) btn.classList.add('active');
    if (content) content.classList.add('active');
}

function setupModalAccessibility() {
    const modalIds = ['modal_sm_close', 'modal_lg_close', 'modal_xl_close', 'modal_full_close'];
    
    modalIds.forEach(modalId => {
        const modalElement = document.getElementById(modalId);
        if (!modalElement) return;
        
        // When modal is shown, set aria-hidden to false
        modalElement.addEventListener('show.bs.modal', () => {
            modalElement.setAttribute('aria-hidden', 'false');
        });
        
        // When modal is hidden, set aria-hidden to true
        modalElement.addEventListener('hide.bs.modal', () => {
            modalElement.setAttribute('aria-hidden', 'true');
        });
    });
}

function setupEventListeners() {
    setupNavbarAutoCollapse();
    setupModalAccessibility();

    // Configuration save
    document.getElementById('save-config')?.addEventListener('click', saveConfiguration);
    document.getElementById('save-advanced')?.addEventListener('click', saveConfiguration);
    document.getElementById('view-config-main')?.addEventListener('click', viewConfiguration);
    document.getElementById('export-config-main')?.addEventListener('click', exportConfiguration);
    
    // Run Now button
    document.getElementById('run-now')
        ?.addEventListener('click', UptonightScheduler.trigger);
    
    // Constraints toggle
    document.getElementById('use-constraints')?.addEventListener('change', (e) => {
        toggleConstraintsFields(e.target.checked);
    });
    
    // Coordinate conversion
    document.getElementById('latitude-input')?.addEventListener('blur', () => convertCoordinate('latitude'));
    document.getElementById('longitude-input')?.addEventListener('blur', () => convertCoordinate('longitude'));
    
    // Logs
    document.getElementById('refresh-logs')?.addEventListener('click', loadLogs);
    document.getElementById('clear-logs-display')?.addEventListener('click', clearLogsDisplay);
    document.getElementById('log-level')?.addEventListener('change', loadLogs);
    document.getElementById('log-limit')?.addEventListener('change', loadLogs);
    
    // Config modal
    const modal = document.getElementById('config-modal');
    const closeBtn = document.querySelector('.close');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    // Image modal
    const imageModal = document.getElementById('image-modal');
    const closeImageBtn = document.querySelector('.close-image');
    
    if (closeImageBtn) {
        closeImageBtn.addEventListener('click', () => {
            imageModal.style.display = 'none';
        });
    }
    
    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
        if (event.target === imageModal) {
            imageModal.style.display = 'none';
        }
    });
    
    // Initialize YAML editors with validation
    initializeYAMLEditors();
}

// ======================
// Version Management
// ======================

async function loadVersion() {
    try {
        const data = await fetchJSON('/api/version');
        const versionElement = document.getElementById('version');
        if (versionElement) {
            versionElement.textContent = `v${data.version}`;
        }
        
        // Check for updates immediately after page load
        checkForUpdates(data.version);
        
        // Set up periodic update check every 4 hours (4 * 60 * 60 * 1000 ms)
        setInterval(() => {
            checkForUpdates(data.version);
        }, 4 * 60 * 60 * 1000);
        
    } catch (error) {
        console.error('Error loading version:', error);
    }
}

async function checkForUpdates(currentVersion) {
    try {
        //console.debug(`Checking for updates... Current version: ${currentVersion}`);
        
        // Fetch latest release from GitHub API
        const release = await fetchJSONWithRetry('https://api.github.com/repos/WorldOfGZ/myastroboard/releases/latest', {}, {
            maxAttempts: 3,
            baseDelayMs: 1000,
            maxDelayMs: 8000,
            timeoutMs: 10000
        });
        const latestVersion = release.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present
        const current = currentVersion.replace(/^v/, '');
        
        //console.debug(`Version comparison: current=${current}, latest=${latestVersion}`);
        
        // Simple version comparison (assumes semantic versioning)
        if (isNewerVersion(current, latestVersion)) {
            //console.debug('Update available! Showing notification...');
            showUpdateNotification(release.html_url, latestVersion);
        } else {
            //console.debug('No update needed - current version is up to date');
        }
    } catch (error) {
        // Log errors for debugging but don't show to users
        console.warn('Update check failed:', error);
    }
}

function isNewerVersion(currentVersion, latestVersion) {
    // Simple semantic version comparison
    const currentParts = currentVersion.split('.').map(Number);
    const latestParts = latestVersion.split('.').map(Number);
    
    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
        const current = currentParts[i] || 0;
        const latest = latestParts[i] || 0;
        
        if (latest > current) {
            return true;
        } else if (latest < current) {
            return false;
        }
    }
    
    return false; // Versions are equal
}

function showUpdateNotification(releaseUrl, version) {
    const notification = document.getElementById('update-notification');
    const link = document.getElementById('update-link');
    
    if (notification && link) {
        link.href = releaseUrl;
        link.textContent = `See version v${version}`;
        notification.style.display = 'block';
        //console.debug(`Update notification shown for version v${version}`);
    } else {
        console.warn('Update notification elements not found in DOM');
        if (!notification) console.warn('Missing element: update-notification');
        if (!link) console.warn('Missing element: update-link');
    }
}
