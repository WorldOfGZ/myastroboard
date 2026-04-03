// MyAstroBoard Modern Frontend JavaScript
// Core initialization and navigation

let currentConfig = {};

function getStartupPreferenceValues() {
    const prefs = window.myastroboardUserPreferences || {};
    return {
        startupMainTab: prefs.startup_main_tab || 'forecast-astro',
        startupSubtab: prefs.startup_subtab || 'astro-weather'
    };
}

function getFallbackSubtabForMainTab(mainTab) {
    const parentElement = document.getElementById(`${mainTab}-tab`);
    if (!parentElement) {
        return null;
    }
    const firstSubTabButton = parentElement.querySelector('.sub-tab-btn');
    return firstSubTabButton ? firstSubTabButton.getAttribute('data-subtab') : null;
}

function applyUserStartupPreferences(force = false) {
    if (window.__myastroboardStartupApplied && !force) {
        return;
    }

    const { startupMainTab, startupSubtab } = getStartupPreferenceValues();
    const targetMainButton = document.querySelector(`.main-tab-btn[data-tab="${startupMainTab}"]`);
    const effectiveMainTab = targetMainButton ? startupMainTab : 'forecast-astro';

    switchMainTab(effectiveMainTab);

    const requestedSubtabExists = !!document.querySelector(
        `#${effectiveMainTab}-tab .sub-tab-btn[data-subtab="${startupSubtab}"]`
    );
    const fallbackSubtab = getFallbackSubtabForMainTab(effectiveMainTab);
    const effectiveSubtab = requestedSubtabExists ? startupSubtab : fallbackSubtab;

    if (effectiveSubtab) {
        // switchMainTab already activates/loads a sub-tab; only switch again if it is not the expected one.
        const currentlyActiveSubtab = document
            .querySelector(`#${effectiveMainTab}-tab .sub-tab-btn.active`)
            ?.getAttribute('data-subtab');

        if (currentlyActiveSubtab !== effectiveSubtab) {
            switchSubTab(effectiveMainTab, effectiveSubtab);
        }
    }

    window.__myastroboardStartupApplied = true;
}

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

    // Init SkyTonight scheduler
    SkyTonightScheduler.init();

    checkCacheStatus();

    // Load initial page from user preferences (or fallback defaults)
    applyUserStartupPreferences();
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

    cleanupTransientCharts();

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
    const parentElement = document.getElementById(`${tabName}-tab`);
    if (!parentElement) return;
    parentElement.classList.add('active');

    // Ensure a visible sub-tab content exists when this main tab has sub-tabs.
    const subTabButtons = parentElement.querySelectorAll('.sub-tab-btn');
    if (subTabButtons.length > 0) {
        const activeSubTabButton = parentElement.querySelector('.sub-tab-btn.active') || subTabButtons[0];
        const activeSubTabName = activeSubTabButton?.getAttribute('data-subtab');
        if (activeSubTabName) {
            switchSubTab(tabName, activeSubTabName);
        }
    }
    
    // Load tab-specific content
    if (tabName === 'skytonight') {
        loadSkyTonightResultsTabs();
    } else if (tabName === 'astrodex') {
        loadAstrodex();
    } else if (tabName === 'forecast-weather') {
        loadWeather();
    }
}

function setupSubTabs() {
    // Use event delegation for dynamically added sub-tabs
    document.addEventListener('click', (e) => {
        // Use closest() to handle clicks on children elements (e.g., <span> inside <a>)
        const btn = e.target.closest('.sub-tab-btn');
        if (!btn) return;

        const subtabName = btn.getAttribute('data-subtab');
        if (!subtabName) return;

        // prevent default link behavior
        e.preventDefault();
        
        const parentTab = btn.closest('.main-tab-content').id.replace('-tab', '');
        switchSubTab(parentTab, subtabName);
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
    cleanupTransientCharts();

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
    } else if (subtabName === 'plan-my-night') { //Astrodex tab - Plan My Night
        loadPlanMyNight();
    } else if (subtabName === 'log-export') { //Parameters tab - Log Export
        loadLogLevel();
    } else if (subtabName.startsWith('skytonight-')) { //SkyTonight section tabs
        const skytSection = subtabName.slice('skytonight-'.length);
        if (typeof _showSkyTonightSectionData === 'function') {
            _showSkyTonightSectionData(skytSection);
        }
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


function cleanupTransientCharts() {
    if (typeof destroyAstronomicalCharts === 'function') {
        destroyAstronomicalCharts();
    }
    if (typeof destroyAstroWeatherCharts === 'function') {
        destroyAstroWeatherCharts();
    }
    if (typeof destroyHorizonChart === 'function') {
        destroyHorizonChart();
    }
    if (typeof destroyLunarEclipseChart === 'function') {
        destroyLunarEclipseChart();
    }
    if (typeof destroySolarEclipseChart === 'function') {
        destroySolarEclipseChart();
    }
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
    document.getElementById('export-config-main')?.addEventListener('click', exportConfiguration);

    // Backup / Restore
    document.getElementById('backup-download-btn')?.addEventListener('click', downloadBackup);
    document.getElementById('backup-restore-btn')?.addEventListener('click', restoreBackup);
    initRestoreFileInput();

    // Log Export
    document.getElementById('log-export-btn')?.addEventListener('click', downloadLogExport);
    
    // Run Now button
    document.getElementById('run-now')
        ?.addEventListener('click', SkyTonightScheduler.trigger);
    
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
        checkForUpdates();
        
        // Set up periodic update check every 4 hours (4 * 60 * 60 * 1000 ms)
        setInterval(checkForUpdates, 4 * 60 * 60 * 1000);
        
    } catch (error) {
        console.error('Error loading version:', error);
    }
}

async function checkForUpdates() {
    try {
        // Call backend API which handles caching and GitHub rate limits
        const updateInfo = await fetchJSONWithRetry('/api/version/check-updates', {}, {
            maxAttempts: 2,
            baseDelayMs: 1000,
            maxDelayMs: 3000,
            timeoutMs: 15000
        });
        
        // Show notification if update is available
        if (updateInfo.update_available && updateInfo.release_url) {
            showUpdateNotification(updateInfo.release_url, updateInfo.latest_version);
        }
    } catch (error) {
        // Silently fail - update checks are not critical
        console.debug('Update check failed (non-critical):', error);
    }
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

window.applyUserStartupPreferences = applyUserStartupPreferences;
