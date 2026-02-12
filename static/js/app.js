// MyAstroBoard Modern Frontend JavaScript

let currentConfig = {};
let catalogueResults = {};
let currentCatalogueTab = ''; // Track current catalogue for Astrodex integration

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
    loadTimezones();
    await loadConfiguration();  // Wait for config to load before loading catalogues
    await loadCatalogues();  // Also await catalogues to ensure proper sequencing
    setupEventListeners();
    loadVersion();

    // Init uptonight scheduler
    UptonightScheduler.init();

    checkCacheStatus();
    
    // Load initial page
    switchSubTab("forecast", "weather"); 
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
    // Update button states
    document.querySelectorAll('.main-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
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
    }
}

function setupSubTabs() {
    // Use event delegation for dynamically added sub-tabs
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('sub-tab-btn')) {
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
        const target = event.target;
        if (!target || !target.closest('.nav-link')) return;

        if (!navbarCollapse.classList.contains('show')) return;

        const collapseInstance = bootstrap.Collapse.getInstance(navbarCollapse);
        (collapseInstance || new bootstrap.Collapse(navbarCollapse)).hide();
    });
}

function switchSubTab(parentTab, subtabName) {
    activateSubTab(parentTab, subtabName);

    // Load subtab-specific content
    if (subtabName === 'logs') { //Parameters tab - Logs
        loadLogs();
    } else if (subtabName === 'users') { //Parameters tab - Users
        loadUsers();
    } else if (subtabName === 'weather') { //Forecast tab - Weather
        loadWeather();
    } else if (subtabName === 'astro-weather') { //Forecast tab - Astrophotography Weather
        loadAstroWeather();
    } else if (subtabName === 'window') { //Forecast tab - Best Observation Window
        loadBestDarkWindow();
    } else if (subtabName === 'trend') { //Forecast tab - Observation Conditions
        loadAstronomicalCharts();
    } else if (subtabName === 'moon') { //Forecast moon - Weather
        loadMoon();
        loadNextMoonPhases();
    } else if (subtabName === 'sun') { //Forecast sun - Weather
        loadSun();
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

// ======================
// Utils
// ======================

async function loadTimezones() {
    try {
        const timezones = await fetchJSON('/api/timezones');
        
        const select = document.getElementById('timezone');
        if (!select) return; // Element doesn't exist on this page view
        
        select.innerHTML = '';
        
        timezones.forEach(tz => {
            const option = document.createElement('option');
            option.value = tz;
            option.textContent = tz;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading timezones:', error);
    }
}

async function loadConfiguration() {
    try {
        const config = await fetchJSON('/api/config');
        currentConfig = config;
        
        // Populate basic fields - check if elements exist before setting values
        const locationName = document.getElementById('location-name');
        if (locationName) locationName.value = config.location?.name || '';
        
        const latInput = document.getElementById('latitude-input');
        if (latInput) latInput.value = config.location?.latitude || '';
        
        const lonInput = document.getElementById('longitude-input');
        if (lonInput) lonInput.value = config.location?.longitude || '';
        
        const elevation = document.getElementById('elevation');
        if (elevation) elevation.value = config.location?.elevation || 0;
        
        const timezone = document.getElementById('timezone');
        if (timezone) timezone.value = config.location?.timezone || 'UTC';
        
        // Features
        const features = config.features || {};
        const featureHorizon = document.getElementById('feature-horizon');
        if (featureHorizon) featureHorizon.checked = features.horizon !== false;
        
        const featureObjects = document.getElementById('feature-objects');
        if (featureObjects) featureObjects.checked = features.objects !== false;
        
        const featureBodies = document.getElementById('feature-bodies');
        if (featureBodies) featureBodies.checked = features.bodies !== false;
        
        const featureComets = document.getElementById('feature-comets');
        if (featureComets) featureComets.checked = features.comets !== false;
        
        const featureAlttime = document.getElementById('feature-alttime');
        if (featureAlttime) featureAlttime.checked = features.alttime !== false;
        
        // Constraints
        const useConstraints = config.use_constraints !== false;  // Default to true
        const useConstraintsEl = document.getElementById('use-constraints');
        if (useConstraintsEl) {
            useConstraintsEl.checked = useConstraints;
            toggleConstraintsFields(useConstraints);
        }
        
        const constraints = config.constraints || {};
        
        const altMin = document.getElementById('altitude-min');
        if (altMin) altMin.value = constraints.altitude_constraint_min || 30;
        
        const altMax = document.getElementById('altitude-max');
        if (altMax) altMax.value = constraints.altitude_constraint_max || 80;
        
        const airmass = document.getElementById('airmass');
        if (airmass) airmass.value = constraints.airmass_constraint || 2;
        
        const sizeMin = document.getElementById('size-min');
        if (sizeMin) sizeMin.value = constraints.size_constraint_min || 10;
        
        const sizeMax = document.getElementById('size-max');
        if (sizeMax) sizeMax.value = constraints.size_constraint_max || 300;
        
        const moonSep = document.getElementById('moon-sep');
        if (moonSep) moonSep.value = constraints.moon_separation_min || 45;
        
        const timeThreshold = document.getElementById('time-threshold');
        if (timeThreshold) timeThreshold.value = constraints.fraction_of_time_observable_threshold || 0.5;
        
        const maxTargets = document.getElementById('max-targets');
        if (maxTargets) maxTargets.value = constraints.max_number_within_threshold || 60;
        
        const moonIllumination = document.getElementById('moon-illumination');
        if (moonIllumination) moonIllumination.checked = constraints.moon_separation_use_illumination !== false;
        
        const northCCW = document.getElementById('north-ccw');
        if (northCCW) northCCW.checked = constraints.north_to_east_ccw === true;
                
        // Bucket list
        const bucketList = document.getElementById('bucket-list');
        if (bucketList && config.bucket_list && config.bucket_list.length > 0) {
            bucketList.value = config.bucket_list.join('\n');
        }
        
        // Done list
        const doneList = document.getElementById('done-list');
        if (doneList && config.done_list && config.done_list.length > 0) {
            doneList.value = config.done_list.join('\n');
        }
        
        // Custom targets
        const customTargets = document.getElementById('custom-targets');
        if (customTargets && config.custom_targets && config.custom_targets.length > 0) {
            customTargets.value = formatCustomTargetsAsYAML(config.custom_targets);
        }
        
        // Horizon
        const horizonConfig = document.getElementById('horizon-config');
        if (horizonConfig) {
            if (config.horizon && config.horizon.anchor_points && config.horizon.anchor_points.length > 0) {
                const horizonYAML = formatHorizonAsYAML(config.horizon);
                horizonConfig.value = horizonYAML;
            } else {
                horizonConfig.value = '';
            }
        }
        
    } catch (error) {
        console.error('Error loading configuration:', error);
        showMessage('error', 'Failed to load configuration');
    }
}

async function saveConfiguration() {
    // Validate at least one catalogue selected
    const selectedCatalogues = Array.from(
        document.querySelectorAll('#catalogues-list input:checked')
    ).map(cb => cb.value);
    const uniqueCatalogues = Array.from(new Set(selectedCatalogues));
    
    if (uniqueCatalogues.length === 0) {
        showMessage('error', 'At least one catalogue must be selected');
        return;
    }
    
    // Parse bucket list
    const bucketListText = document.getElementById('bucket-list').value.trim();
    const bucketList = bucketListText ? bucketListText.split('\n').map(s => s.trim()).filter(s => s) : [];
    
    // Parse done list
    const doneListText = document.getElementById('done-list').value.trim();
    const doneList = doneListText ? doneListText.split('\n').map(s => s.trim()).filter(s => s) : [];
    
    // Parse custom targets
    const customTargetsText = document.getElementById('custom-targets').value.trim();
    let customTargets = [];
    if (customTargetsText) {
        try {
            customTargets = parseCustomTargetsYAML(customTargetsText);
        } catch (e) {
            showMessage('error', 'Invalid custom targets format');
            return;
        }
    }
    
    // Parse horizon
    const horizonText = document.getElementById('horizon-config').value.trim();
    let horizon = null;
    if (horizonText) {
        try {
            horizon = parseHorizonYAML(horizonText);
            // Only include horizon if it has anchor_points
            if (!horizon.anchor_points || horizon.anchor_points.length === 0) {
                horizon = null;
            }
        } catch (e) {
            showMessage('error', 'Invalid horizon format');
            return;
        }
    }
    
    const config = {
        location: {
            name: document.getElementById('location-name').value,
            latitude: parseFloat(document.getElementById('latitude-input').value),
            longitude: parseFloat(document.getElementById('longitude-input').value),
            elevation: parseFloat(document.getElementById('elevation').value || 0),
            timezone: document.getElementById('timezone').value
        },
        selected_catalogues: uniqueCatalogues,
        use_constraints: document.getElementById('use-constraints').checked,
        features: {
            horizon: document.getElementById('feature-horizon').checked,
            objects: document.getElementById('feature-objects').checked,
            bodies: document.getElementById('feature-bodies').checked,
            comets: document.getElementById('feature-comets').checked,
            alttime: document.getElementById('feature-alttime').checked
        },
        constraints: {
            altitude_constraint_min: parseFloat(document.getElementById('altitude-min').value),
            altitude_constraint_max: parseFloat(document.getElementById('altitude-max').value),
            airmass_constraint: parseFloat(document.getElementById('airmass').value),
            size_constraint_min: parseFloat(document.getElementById('size-min').value),
            size_constraint_max: parseFloat(document.getElementById('size-max').value),
            moon_separation_min: parseFloat(document.getElementById('moon-sep').value),
            moon_separation_use_illumination: document.getElementById('moon-illumination').checked,
            fraction_of_time_observable_threshold: parseFloat(document.getElementById('time-threshold').value),
            max_number_within_threshold: parseInt(document.getElementById('max-targets').value),
            north_to_east_ccw: document.getElementById('north-ccw').checked
        },
        bucket_list: bucketList,
        done_list: doneList,
        custom_targets: customTargets
    };
    
    // Only add horizon if it has anchor_points
    if (horizon && horizon.anchor_points && horizon.anchor_points.length > 0) {
        config.horizon = horizon;
    }
    
    try {
        const result = await fetchJSON('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        
        if (result.status === 'success') {
            showMessage('success', '✅ Configuration saved successfully!');
            currentConfig = config;
            // Reload catalogues to reflect the saved selection
            loadCatalogues();
        } else {
            showMessage('error', `❌ ${result.message || 'Failed to save configuration'}`);
        }
    } catch (error) {
        console.error('Error saving configuration:', error);
        showMessage('error', '❌ Failed to save configuration');
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

function toggleConstraintsFields(enabled) {
    const fieldsContainer = document.getElementById('constraints-fields');
    if (fieldsContainer) {
        fieldsContainer.style.opacity = enabled ? '1' : '0.5';
        fieldsContainer.style.pointerEvents = enabled ? 'auto' : 'none';
        
        // Disable/enable all inputs
        const inputs = fieldsContainer.querySelectorAll('input');
        inputs.forEach(input => {
            input.disabled = !enabled;
        });
    }
    
    // Also disable/enable the 2 checkboxes below the constraints section
    const moonIllumination = document.getElementById('moon-illumination');
    const northCcw = document.getElementById('north-ccw');
    
    if (moonIllumination) {
        moonIllumination.disabled = !enabled;
        moonIllumination.parentElement.style.opacity = enabled ? '1' : '0.5';
    }
    if (northCcw) {
        northCcw.disabled = !enabled;
        northCcw.parentElement.style.opacity = enabled ? '1' : '0.5';
    }
}

async function convertCoordinate(type) {

    const inputId = `${type}-input`;
    const convertedId = `${type}-converted`;
    const errorId = `${type}-error`;
    
    const input = document.getElementById(inputId);
    const value = input.value.trim();
    
    const convertedEl = document.getElementById(convertedId);
    const errorEl = document.getElementById(errorId);
    
    // Clear previous messages
    convertedEl.textContent = '';
    errorEl.textContent = '';
    
    if (!value) return;
    
    // Check if it's already decimal
    if (!isNaN(value)) {
        convertedEl.textContent = `✓ Decimal: ${parseFloat(value).toFixed(6)}`;
        input.classList.add('is-valid');
        input.classList.remove('is-invalid');
        return;
    }
    
    // Try to convert DMS
    try {
        const data = await fetchJSON('/api/convert-coordinates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dms: value })
        });
        
        if (data.status === 'success') {
            convertedEl.textContent = `✓ Decimal: ${data.decimal}`;
            input.value = data.decimal;
            input.classList.add('is-valid');
            input.classList.remove('is-invalid');
        } else {
            errorEl.textContent = `✗ ${data.message}`;
            input.classList.add('is-invalid');
            input.classList.remove('is-valid');
        }
    } catch (error) {
        errorEl.textContent = '✗ Invalid format';
        input.classList.add('is-invalid');
        input.classList.remove('is-valid');
    }
}

let configsData = [];
//View all configs
async function viewConfiguration() {
    
    try {
        //throw new Error('Simulated error for testing'); // Simulate an error to test error handling

        const data = await fetchJSON('/api/config/view');
        
        if (data.status === 'success') {
            configsData = data.configs;

            //Prepare modal title
            const titleElement = document.getElementById('modal_lg_close_title');
            if (!titleElement) {
                console.error('Modal title element not found');
                showMessage('error', 'Configuration modal not properly initialized');
                return;
            }
            titleElement.innerHTML = `📄 UpTonight Configurations`;
            
            //Prepare modal content
            const contentElement = document.getElementById('modal_lg_close_body');
            if (!contentElement) {
                console.error('Modal body element not found');
                showMessage('error', 'Configuration modal not properly initialized');
                return;
            }
            contentElement.innerHTML = `
                <!-- Dropdown to select config -->
                <div class="row row-cols-lg-auto g-3 align-items-center mb-3">
                    <div class="col-12">
                        <label class="visually-hidden" for="config-selector">Select configuration</label>
                        <select class="form-select" id="config-selector">
                        </select>
                    </div>
                </div>

                <!-- Content YAML/JSON -->
                <pre id="config-display" class="border p-3 bg-dark text-light rounded"></pre>

                <button id="export-config-from-modal" class="btn btn-primary">⬇️ Export this config as YAML</button>
            `;

            const selector = document.getElementById('config-selector');
            if (!selector) {
                console.error('Config selector element not found');
                showMessage('error', 'Configuration selector not properly initialized');
                return;
            }
            selector.innerHTML = ''; // clear previous options

            // Add options for each config
            configsData.forEach((cfg, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = cfg.name;
                selector.appendChild(option);
            });

            // Display the first config by default
            displayConfig(0);

            // Change config
            selector.onchange = (e) => displayConfig(e.target.value);

            // Export uptonight config as YAML
            const exportBtn = document.getElementById('export-config-from-modal');
            if (exportBtn) {
                exportBtn.onclick = () => {
                    const selector = document.getElementById('config-selector');
                    if (!selector) {
                        console.error('Config selector not found during export');
                        return;
                    }
                    const cfg = configsData[selector.value];
                    if (!cfg) return;

                    const blob = new Blob([cfg.yaml], { type: 'text/yaml' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = cfg.name;
                    a.click();
                    URL.revokeObjectURL(url);
                };
            }

            // Display the modal modal_lg_close
            const bs_modal = new bootstrap.Modal('#modal_lg_close', {
                backdrop: 'static',
                focus: true,
                keyboard: true
            });
            bs_modal.show();

            //On modal close, clear the display and events to prevent memory leaks
            const modal = document.getElementById('modal_lg_close');
            if (modal) {
                modal.addEventListener('hidden.bs.modal', () => {

                    // Remove event listeners
                    const selector = document.getElementById('config-selector');
                    if (selector) {
                        selector.onchange = null;
                    }
                    const exportBtn = document.getElementById('export-config-from-modal');
                    if (exportBtn) {
                        exportBtn.onclick = null;
                    }

                    const titleElement = document.getElementById('modal_lg_close_title');
                    if (titleElement) {
                        titleElement.textContent = '';
                    }
                    const bodyElement = document.getElementById('modal_lg_close_body');
                    if (bodyElement) {
                        bodyElement.innerHTML = '';
                    }
                    configsData = [];

                    // Self destroy this event listener to prevent accumulation if user opens/closes modal multiple times
                    modal.removeEventListener('hidden.bs.modal', arguments.callee);
                });
            }


        } else {
            showMessage('error', 'Failed to load configuration view');
        }
    } catch (error) {
        console.error('Error viewing configuration:', error);
        showMessage('error', 'Failed to view configuration');
    }
}

// Function to display a selected config
function displayConfig(index) {
    const cfg = configsData[index];
    if (!cfg) return;
    const displayElement = document.getElementById('config-display');
    if (!displayElement) {
        console.error('Config display element not found');
        return;
    }
    displayElement.textContent = cfg.yaml;
}

//Export general configuration
async function exportConfiguration() {
    try {
        window.location.href = `${API_BASE}/api/config/export`;
        showMessage('success', 'Configuration exported');
    } catch (error) {
        console.error('Error exporting configuration:', error);
        showMessage('error', 'Failed to export configuration');
    }
}

async function loadLogs() {
    try {
        const logLevelElement = document.getElementById('log-level');
        const logLimitElement = document.getElementById('log-limit');
        
        if (!logLevelElement || !logLimitElement) {
            console.error('Log filter elements not found');
            return;
        }
        
        const level = logLevelElement.value;
        const limit = logLimitElement.value;
        const data = await fetchJSON(`/api/logs?level=${level}&limit=${limit}`);
        
        const logsContainer = document.getElementById('logs-display');
        if (!logsContainer) {
            console.error('Logs display container not found');
            return;
        }
        
        logsContainer.innerHTML = '';
        
        if (data.logs && data.logs.length > 0) {
            // Add log info header
            const logInfo = document.createElement('div');
            logInfo.className = 'log-info-header';
            logInfo.innerHTML = `<strong>Showing ${data.showing} of ${data.total} log entries</strong>`;
            logsContainer.appendChild(logInfo);
            
            // Display logs in chronological order (newest last)
            data.logs.forEach(log => {
                const logEntry = document.createElement('div');
                logEntry.className = 'log-entry';
                
                if (log.includes('ERROR') || log.includes('CRITICAL')) {
                    logEntry.classList.add('log-error');
                } else if (log.includes('WARNING')) {
                    logEntry.classList.add('log-warning');
                } else if (log.includes('INFO')) {
                    logEntry.classList.add('log-info');
                } else if (log.includes('DEBUG')) {
                    logEntry.classList.add('log-debug');
                }
                
                logEntry.textContent = log;
                logsContainer.appendChild(logEntry);
            });
            
            // Auto-scroll to bottom to show latest logs
            logsContainer.scrollTop = logsContainer.scrollHeight;
        } else {
            logsContainer.innerHTML = '<div class="log-empty">No logs available yet</div>';
        }
    } catch (error) {
        console.error('Error loading logs:', error);
        const logsDisplay = document.getElementById('logs-display');
        if (logsDisplay) {
            logsDisplay.innerHTML = '<div class="log-error">Error loading logs</div>';
        }
    }
}

async function clearLogsDisplay() {
    await fetchJSON('/api/logs/clear', {
        method: 'POST'
    });

    showMessage("success", "Logs cleared");

    const logsDisplay = document.getElementById('logs-display');
    if (logsDisplay) {
        logsDisplay.innerHTML = '<div class="log-empty">Logs cleared (refresh to reload)</div>';
    }
}

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

// ======================
// UpTonight
// ======================


async function loadCatalogues() {
    try {
        const catalogues = await fetchJSON('/api/catalogues');
        
        const container = document.getElementById('catalogues-list');
        if (!container) return; // Element doesn't exist on this page view

        container.innerHTML = '';
        
        // Ensure Messier is checked by default if no catalogues selected
        const selectedCatalogues = currentConfig.selected_catalogues || ['Messier'];
        
        catalogues.forEach(catalogue => {
            const checkboxElt = document.createElement('div');
            checkboxElt.className = 'form-check form-switch bg-checkbox';
            checkboxElt.innerHTML = `
                <input class="form-check-input" type="checkbox" value="${catalogue}" id="catalogue-${catalogue}" ${selectedCatalogues.includes(catalogue) ? 'checked' : ''} switch>
                <label class="form-check-label" for="catalogue-${catalogue}">${catalogue}</label>
            `;
            container.appendChild(checkboxElt);
        });
        
    } catch (error) {
        console.error('Error loading catalogues:', error);
    }
}

//Load uptonight results tabs
async function loadUptonightResultsTabs() {
    try {
        const outputs = await fetchJSON('/api/uptonight/outputs');
        
        const subtabsContainer = document.getElementById('uptonight-subtabs');
        let  eltFirstTab = -1; // Index of the first tab to activate by default

        // Init var
        let tabsHTML = '';
        
        //console.log('Uptonight outputs:', outputs);

        //Make the tab links for each catalogue output
        if (outputs && outputs.length > 0) {
            // Make an array with only output.target
            const targets = outputs.map(output => output.target);
            // Reorder alphabetically targets
            targets.sort((a, b) => a.localeCompare(b));

            targets.forEach((target, index) => {
                if (eltFirstTab === -1) {
                    eltFirstTab = index;
                }
                tabsHTML += `
                    <li class="nav-item">
                        <a class="nav-link sub-tab-btn" href="#" data-subtab="catalogue-${target}">📚 ${target}</a>
                    </li>`;
            });
        } else {
            tabsHTML = 'Currently no data available for UpTonight service.';
        }
        
        subtabsContainer.innerHTML = tabsHTML;
        
        // Create content divs for catalogue tabs
        const uptontightTab = document.getElementById('uptonight-tab');
        
        if (outputs && outputs.length > 0) {
            outputs.forEach((output, index) => {
                const existingDiv = document.getElementById(`catalogue-${output.target}-subtab`);
                if (!existingDiv) {
                    const div = document.createElement('div');
                    div.id = `catalogue-${output.target}-subtab`;
                    div.className = `sub-tab-content`;
                    div.innerHTML = `
                        <div class="shadow p-2 mb-3 rounded bg-sub-container">
                            <h2>📚 ${output.target} Results</h2>
                            <ul class="nav nav-pills sub-tabs" id="catalogue-${output.target}-type-buttons"></ul>
                            <div id="catalogue-${output.target}-content"><div class="alert alert-info">Loading...</div></div>
                        </div>
                    `;
                    uptontightTab.appendChild(div);
                    
                    // Load catalogue data
                    loadCatalogueResults(output.target);
                }
            });
        }

        // Activate first available subtab once DOM is ready
        requestAnimationFrame(() => {
            if (outputs && outputs.length > 0) {


                activateSubTab('uptonight', `catalogue-${outputs[eltFirstTab].target}`);
            }
        });
                
    } catch (error) {
        console.error('Error loading results tabs:', error);
    }
}

async function loadCatalogueResults(catalogue) {
    //console.log(`Loading results for catalogue: ${catalogue}`);
    currentCatalogueTab = catalogue; // Track current catalogue
    try {
        const reports = await fetchJSON(`/api/uptonight/reports/${catalogue}`);
        //console.log('Catalogue reports:', reports);
        const buttonsContainer = document.getElementById(`catalogue-${catalogue}-type-buttons`);
        const container = document.getElementById(`catalogue-${catalogue}-content`);
        
        if (reports.error) {
            container.innerHTML = `<div class="alert alert-danger">${reports.error}</div>`;
            return;
        }
        
        // Create buttons for available data types
        let buttonsHTML = '';
        const hasPlot = reports.plot_image;
        const hasReport = reports.report && reports.report.length > 0;
        const hasBodies = reports.bodies && reports.bodies.length > 0;
        const hasComets = reports.comets && reports.comets.length > 0;
        
        // Determine first available type for default selection
        let firstType = null;
        
        // Add buttons in order: Plot, Deep sky objects (Report), Bodies, Comets
        if (hasPlot) {
            buttonsHTML += `<li class="nav-item"><a class="nav-link catalogue-type-btn ${!firstType ? 'active' : ''}" onclick="showCatalogueType('${catalogue}', 'plot')">📊 Plot</a></li>`;
            if (!firstType) firstType = 'plot';
        }
        if (hasReport) {
            buttonsHTML += `<li class="nav-item"><a class="nav-link catalogue-type-btn ${!firstType ? 'active' : ''}" onclick="showCatalogueType('${catalogue}', 'report')">🌌 Deep sky objects</a></li>`;
            if (!firstType) firstType = 'report';
        }
        if (hasBodies) {
            buttonsHTML += `<li class="nav-item"><a class="nav-link catalogue-type-btn ${!firstType ? 'active' : ''}" onclick="showCatalogueType('${catalogue}', 'bodies')">🪐 Bodies</a></li>`;
            if (!firstType) firstType = 'bodies';
        }
        if (hasComets) {
            buttonsHTML += `<li class="nav-item"><a class="nav-link catalogue-type-btn ${!firstType ? 'active' : ''}" onclick="showCatalogueType('${catalogue}', 'comets')">☄️ Comets</a></li>`;
            if (!firstType) firstType = 'comets';
        }
        
        // Check if log file exists and add log button
        // Check if report files exist and add reports button  
        Promise.all([
            checkCatalogueLogExists(catalogue),
            checkCatalogueReportsAvailable(catalogue)
        ]).then(([logExists, reportsAvailable]) => {
            if (logExists) {
                buttonsHTML += `<li class="nav-item"><a class="nav-link catalogue-type-btn" onclick="showCatalogueType('${catalogue}', 'log')">📄 Log</a></li>`;
            }
            if (reportsAvailable && reportsAvailable.has_any) {
                buttonsHTML += `<li class="nav-item"><a class="nav-link catalogue-type-btn" onclick="showCatalogueType('${catalogue}', 'reports')">📑 Reports</a></li>`;
            }
            buttonsContainer.innerHTML = buttonsHTML;
            
            // Store reports availability for later use
            if (reportsAvailable) {
                window.catalogueReportsAvailability = window.catalogueReportsAvailability || {};
                window.catalogueReportsAvailability[catalogue] = reportsAvailable.available;
            }
        });
        
        buttonsContainer.innerHTML = buttonsHTML;
        
        // Store the reports data for switching between types
        window.catalogueReports = window.catalogueReports || {};
        window.catalogueReports[catalogue] = reports;
        
        // Show default (first available) view
        if (firstType) {
            showCatalogueType(catalogue, firstType);
        }

        //throw new Error('Simulated error in loadCatalogueResults'); // Simulate an error to test error handling

    } catch (error) {
        console.error('Error loading catalogue results:', error);
        const container = document.getElementById(`catalogue-${catalogue}-content`);
        container.innerHTML = '<div class="alert alert-danger">Failed to load catalogue results</div>';
    }
}

function showCatalogueType(catalogue, type) {
    const reports = window.catalogueReports[catalogue];
    if (!reports) return;
    
    // Update active button
    const buttons = document.querySelectorAll(`#catalogue-${catalogue}-type-buttons .catalogue-type-btn`);
    buttons.forEach(btn => {
        btn.classList.remove('active');
        let btnType = '';
        switch(type) {
            case 'plot':
                btnType = 'Plot';
                break;
            case 'report':
                btnType = 'Deep sky objects';
                break;
            case 'bodies':
                btnType = 'Bodies';
                break;
            case 'comets':
                btnType = 'Comets';
                break;
            case 'log':
                btnType = 'Log';
                break;
            case 'reports':
                btnType = 'Reports';
                break;
            default:
                console.warn(`Unknown catalogue type: ${type}`);
                return;
        }
        if (btn.textContent.includes(btnType)) {
            btn.classList.add('active');
        }
    });
    
    const container = document.getElementById(`catalogue-${catalogue}-content`);
    let html = '';
    
    // Show plot if type is 'plot' and plot exists
    if (type === 'plot' && reports.plot_image) {
        html += `
            <div class="plot-container mt-3">
                <img src="${API_BASE}/api/uptonight/outputs/${catalogue}/uptonight-plot.png" 
                     alt="${catalogue} plot" 
                     class="img-fluid rounded" 
                     onclick="showPlotPopup('${catalogue} Plot', this.src)">
            </div>
        `;
    }
    // Show log content if type is 'log'
    else if (type === 'log') {
        container.innerHTML = '<div class="loading">Loading log content...</div>';
        loadCatalogueLog(catalogue).then(logContent => {
            if (logContent) {
                // Helper function to escape HTML
                function escapeHtml(text) {
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                }
                
                html = `
                    <div class="logs-container mt-3 rounded">
                        <pre>${escapeHtml(logContent)}</pre>
                    </div>
                `;
            } else {
                html = '<div class="error-box">Failed to load log content</div>';
            }
            container.innerHTML = html;
        });
        return; // Early return for async log loading
    }
    // Show reports content with dropdown selector if type is 'reports'
    else if (type === 'reports') {
        const availability = window.catalogueReportsAvailability?.[catalogue] || {};
        
        // Helper function to escape HTML
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // Build dropdown options based on available reports
        let dropdownOptions = '';
        if (availability.general) {
            dropdownOptions += '<option value="general">General</option>';
        }
        if (availability.bodies) {
            dropdownOptions += '<option value="bodies">Bodies</option>';
        }
        if (availability.comets) {
            dropdownOptions += '<option value="comets">Comets</option>';
        }
        
        // If no reports available, show message
        if (!dropdownOptions) {
            container.innerHTML = '<div class="alert alert-info mt-3">No reports available for this catalogue.</div>';
            return;
        }
        
        // Create the reports interface with dropdown
        html = `
            <div class="mt-3">
                <div class="mb-3">
                    <label for="report-selector-${catalogue}" class="form-label">Select Report Type:</label>
                    <select class="form-select" id="report-selector-${catalogue}" onchange="loadSelectedReport('${catalogue}', this.value)">
                        ${dropdownOptions}
                    </select>
                </div>
                <div id="report-content-${catalogue}" class="logs-container rounded">
                    <div class="loading">Loading report content...</div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Load the first available report by default
        const firstReportType = availability.general ? 'general' : (availability.bodies ? 'bodies' : 'comets');
        loadSelectedReport(catalogue, firstReportType);
        return; // Early return for async report loading
    }
    // Show appropriate table based on type (not for plot or log)
    else if (type === 'report' && reports.report) {
        html += generateReportTable(reports.report, catalogue, 'report');
    } else if (type === 'bodies' && reports.bodies) {
        html += generateReportTable(reports.bodies, catalogue, 'bodies');
    } else if (type === 'comets' && reports.comets) {
        html += generateReportTable(reports.comets, catalogue, 'comets');
    }
    
    container.innerHTML = html || '<p>No data available</p>';
}

function generateReportTable(report, catalogue, type) {
    if (!report || report.length === 0) return '<p>No targets in report</p>';
    
    // Helper function to escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Define column order and configuration for Report type
    const reportColumns = [
        { key: 'id', label: 'ID', align: 'left' },
        { key: 'target name', label: 'Target name', align: 'left' },
        { key: 'size', label: 'Size', align: 'center', unit: "'" },
        { key: 'foto', label: 'Foto', align: 'center' },
        { key: 'mag', label: 'Mag', align: 'center' },
        { key: 'constellation', label: 'Constellation', align: 'center' },
        { key: 'type', label: 'Type', align: 'center' },
        { key: 'altitude', label: 'Altitude', align: 'center', unit: '°', decimals: 2 },
        { key: 'azimuth', label: 'Azimuth', align: 'center', unit: '°', decimals: 2 },
        { key: 'astrodex', label: 'Astrodex', align: 'center' },
        { key: 'more', label: 'More', align: 'center' }
    ];
    
    // Define column order and configuration for Bodies type
    const bodiesColumns = [
        { key: 'target name', label: 'Target name', align: 'left' },
        { key: 'altitude', label: 'Altitude', align: 'center', unit: '°', decimals: 2 },
        { key: 'azimuth', label: 'Azimuth', align: 'center', unit: '°', decimals: 2 },
        { key: 'max altitude time', label: 'Max altitude time', align: 'center' },
        { key: 'visual magnitude', label: 'Visual magnitude', align: 'center', decimals: 2 },
        { key: 'foto', label: 'Foto', align: 'center' },
        { key: 'type', label: 'Type', align: 'center' },
        { key: 'astrodex', label: 'Astrodex', align: 'center' },
        { key: 'more', label: 'More', align: 'center' }
    ];
    
    // Define column order and configuration for Comets type
    const cometsColumns = [
        { key: 'target name', label: 'Target name', align: 'left' },
        { key: 'altitude', label: 'Altitude', align: 'center', unit: '°', decimals: 2 },
        { key: 'azimuth', label: 'Azimuth', align: 'center', unit: '°', decimals: 2 },
        { key: 'visual magnitude', label: 'Visual magnitude', align: 'center', decimals: 2 },
        { key: 'distance earth au', label: 'Distance Earth', align: 'center', unit: ' au', decimals: 2 },
        { key: 'astrodex', label: 'Astrodex', align: 'center' },
        { key: 'more', label: 'More', align: 'center' }
    ];
    
    // Fields to show in "More" popup
    let moreFields = ['meridian transit', 'antimeridian transit', 'right ascension', 'declination', 'hmsdms'];
    
    // Select columns based on type
    let columns;
    if (type === 'report') {
        columns = reportColumns;
    } else if (type === 'bodies') {
        columns = bodiesColumns;
    } else if (type === 'comets') {
        columns = cometsColumns;
        // Comets have different fields in More popup
        moreFields = ['absolute magnitude', 'distance sun au', 'rise time', 'set time', 'hmsdms'];
    } else {
        // For other types, use all keys
        columns = Object.keys(report[0]).map(key => ({
            key: key,
            label: key.charAt(0).toUpperCase() + key.slice(1),
            align: 'left'
        }));
    }
    
    // Extract unique values for constellation and type filters
    const constellations = [...new Set(report.map(r => r.constellation).filter(c => c))].sort();
    const types = [...new Set(report.map(r => r.type).filter(t => t))].sort();
    
    let html = `
        <div class="row row-cols-lg-auto g-3 align-items-center mt-3">
            <div class="col-12">
                <label for="filter-${catalogue}-${type}" class="visually-hidden">Search</label>
                <input type="text" id="filter-${catalogue}-${type}" placeholder="Search..." class="filter-input form-control">
            </div>`;
    
    // Only show foto filter for report and bodies types, not for comets
    // Use shared foto value from localStorage or default to 0.8
    if (type !== 'comets') {
        const savedFotoValue = localStorage.getItem('fotoFilterValue') || '0.8';
        html += `
            <div class="col-12">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="foto-filter-${catalogue}-${type}">
                    <label class="form-check-label" for="inlineFormCheck"> Foto >= </label>
                </div>               
            </div>`;
        
        html += `
            <div class="col-12">
                <label for="foto-value-${catalogue}-${type}" class="visually-hidden">Foto score</label>
                <input type="number" id="foto-value-${catalogue}-${type}" value="${savedFotoValue}" step="0.1" min="0" max="1" class="shared-foto-value form-control">
            </div>`;
    }
    
    // Add constellation filter if constellation field exists
    if (constellations.length > 0) {
        html += `
            <div class="col-12">
                <label class="visually-hidden" for="constellation-filter-${catalogue}-${type}">Constellations</label>
                <select class="form-select filter-select" id="constellation-filter-${catalogue}-${type}">
                    <option value="">All Constellations</option>`;
        constellations.forEach(c => {
            html += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
        });
        html += `</select>
            </div>`;
    }
    
    // Add type filter if type field exists
    if (types.length > 0) {
        html += `
            <div class="col-12">
                <label class="visually-hidden" for="type-filter-${catalogue}-${type}">Types</label>
                <select id="type-filter-${catalogue}-${type}" class="form-select filter-select">
                    <option value="">All Types</option>`;
        types.forEach(t => {
            html += `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`;
        });
        html += `</select>
            </div>`;
    }
    
    html += `
        </div>
        <div class="table-responsive mt-3">
            <table class="table table-striped table-hover table-sm" id="table-${catalogue}-${type}">
                <thead>
                    <tr>
    `;
    
    // Generate table headers
    columns.forEach(col => {
        if (col.key === 'more' || col.key === 'astrodex') {
            html += `<th style="text-align: ${col.align}">${col.label}</th>`;
        } else {
            html += `<th class="sortable" data-column="${escapeHtml(col.key)}" onclick="sortTable('${escapeHtml(catalogue)}', '${escapeHtml(col.key)}', '${escapeHtml(type)}')" style="text-align: ${col.align}">${escapeHtml(col.label)} <span class="sort-indicator"></span></th>`;
        }
    });
    
    html += `</tr></thead><tbody class="table-group-divider">`;
    
    // Generate table rows
    report.forEach((row, idx) => {
        const fotoValue = row['foto'] || row['fraction of time observable'] || 0;
        html += `<tr data-foto="${fotoValue}" data-constellation="${escapeHtml(row.constellation || '')}" data-type="${escapeHtml(row.type || '')}">`;
        
        columns.forEach(col => {
            if (col.key === 'more') {
                // Generate More link that opens a popup
                const popupId = `more-popup-${catalogue}-${type}-${idx}`;
                html += `<td style="text-align: ${col.align}"><a href="#" onclick="showMorePopup('${popupId}'); return false;" class="link-underline link-underline-opacity-0">📋 More</a></td>`;
            } else if (col.key === 'astrodex') {
                // Generate Astrodex action button
                const itemName = row['id'] || row['target name'];
                const isInAstrodex = row['in_astrodex'] || false;
                
                if (isInAstrodex) {
                    html += `<td style="text-align: ${col.align}"><span class="in-astrodex-badge">✓ Captured</span></td>`;
                } else if (itemName) {
                    // Use data attributes to avoid JSON injection issues
                    const itemData = {
                        id: row['id'],
                        'target name': row['target name'],
                        name: itemName,
                        type: row['type'] || row['targettype'],
                        catalogue: catalogue,
                        ra: row['ra'] || row['right ascension'],
                        dec: row['dec'] || row['declination'],
                        constellation: (row['constellation'] || row['const'] || '').toLowerCase(),
                        mag: row['mag'] || row['visual magnitude'],
                        size: row['size']
                    };
                    const itemDataJson = JSON.stringify(itemData).replace(/"/g, '&quot;');
                    html += `<td style="text-align: ${col.align}"><button class="btn btn-sm btn-outline-primary astrodex-add-btn" data-item="${itemDataJson}">➕ Add</button></td>`;
                } else {
                    html += `<td style="text-align: ${col.align}">-</td>`;
                }
            } else {
                let value = row[col.key];
                
                // Format values
                if (col.key === 'target name' && value) {
                    value = String(value).replace(/\s*\([^)]*\)/g, '');
                } else if (col.key === 'foto' && typeof value === 'number') {
                    value = value.toFixed(2);
                } else if (col.key === 'mag' && !isNaN(value) && value !== null) {
                    value = parseFloat(value).toFixed(2);
                } else if (col.key === 'visual magnitude' && !isNaN(value) && value !== null) {
                    value = parseFloat(value).toFixed(2);
                } else if (col.decimals && !isNaN(value) && value !== null) {
                    // Apply decimal rounding for fields with decimals config
                    value = parseFloat(value).toFixed(col.decimals);
                }
                
                // Add unit if specified
                let displayValue = value !== null && value !== undefined && value !== '' ? escapeHtml(String(value)) : '';
                if (col.unit && displayValue) {
                    displayValue += col.unit;
                }
                
                // Make ID or Target name clickable for alttime popup if file exists
                if ((col.key === 'id' || col.key === 'target name')) {
                    // Use ID if available, otherwise use target name for generating alttime filename
                    const alttimeSource = row['id'] || row['target name'];
                    if (alttimeSource && row['alttime_file'] != '') {
                        //console.log('Generating alttime path for:', row['alttime_file']);

                        const alttimePath = `${API_BASE}/api/uptonight/outputs/${catalogue}/${row['alttime_file']}`;
                        html += `
                        <td style="text-align: ${col.align}" class="alttime-check" data-path="${alttimePath}" data-title="${escapeHtml(alttimeSource)} Altitude-Time">
                            <a href="#" class="link-underline link-underline-opacity-0" onclick="showAlttimePopup('${escapeHtml(alttimeSource)} Altitude-Time', '${alttimePath}'); return false;">${displayValue}</a>
                        </td>`;
                    } else {
                        html += `<td style="text-align: ${col.align}">${displayValue}</td>`;
                    }
                } else {
                    html += `<td style="text-align: ${col.align}">${displayValue}</td>`;
                }
            }
        });
        
        html += `</tr>`;
    });
    
    html += `</tbody></table>`;
    
    // Create all hidden popups AFTER the table (for report, bodies, and comets types)
    if (type === 'report' || type === 'bodies' || type === 'comets') {
        report.forEach((row, idx) => {
            html += `
                <div id="more-popup-${catalogue}-${type}-${idx}" style="display: none;">
                    <div class="table-responsive">
                        <table class="table table-striped"><tbody>`;
            
            moreFields.forEach(field => {
                let value = row[field];
                if (value !== null && value !== undefined) {
                    let label = field.charAt(0).toUpperCase() + field.slice(1);
                    let displayValue = String(value);
                    
                    // Apply special formatting for comets fields
                    if (type === 'comets') {
                        if (field === 'absolute magnitude' && !isNaN(value)) {
                            displayValue = parseFloat(value).toFixed(2);
                        } else if (field === 'distance sun au' && !isNaN(value)) {
                            label = 'Distance Sun';
                            displayValue = parseFloat(value).toFixed(2) + ' au';
                        }
                    }
                    
                    html += `<tr><td class="more-label">${escapeHtml(label)}</td><td class="more-value">${escapeHtml(displayValue)}</td></tr>`;
                }
            });
            
            html += `
                        </tbody></table>
                    </div>
                </div>`;
        });
    }
    
    html += `</div>`;
    
    // Add event listeners for filtering
    setTimeout(() => {
        const filterInput = document.getElementById(`filter-${catalogue}-${type}`);
        const fotoCheckbox = document.getElementById(`foto-filter-${catalogue}-${type}`);
        const fotoValueInput = document.getElementById(`foto-value-${catalogue}-${type}`);
        const constellationSelect = document.getElementById(`constellation-filter-${catalogue}-${type}`);
        const typeSelect = document.getElementById(`type-filter-${catalogue}-${type}`);
        
        // Load saved checkbox state from localStorage and apply it
        if (fotoCheckbox) {
            const savedCheckboxState = localStorage.getItem('fotoFilterEnabled');
            if (savedCheckboxState === 'true') {
                fotoCheckbox.checked = true;
            }
        }
        
        if (filterInput) {
            filterInput.addEventListener('input', () => filterTable(catalogue, type));
        }
        if (fotoCheckbox) {
            fotoCheckbox.addEventListener('change', () => {
                // Save checkbox state to localStorage and sync across all tables
                localStorage.setItem('fotoFilterEnabled', fotoCheckbox.checked);
                syncFotoCheckboxes(fotoCheckbox.checked);
                filterTable(catalogue, type);
            });
        }
        if (fotoValueInput) {
            fotoValueInput.addEventListener('input', () => {
                // Save foto value to localStorage and sync across all tables
                localStorage.setItem('fotoFilterValue', fotoValueInput.value);
                syncFotoValues(fotoValueInput.value);
                filterTable(catalogue, type);
            });
        }
        if (constellationSelect) {
            constellationSelect.addEventListener('change', () => filterTable(catalogue, type));
        }
        if (typeSelect) {
            typeSelect.addEventListener('change', () => filterTable(catalogue, type));
        }
        
        // Add event listeners for Astrodex "Add" buttons
        const addButtons = document.querySelectorAll('.astrodex-add-btn');
        addButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                try {
                    const itemDataJson = this.getAttribute('data-item');
                    const itemData = JSON.parse(itemDataJson);
                    
                    // Validate the parsed object structure
                    if (!itemData || typeof itemData !== 'object') {
                        throw new Error('Invalid item data');
                    }
                    
                    // Ensure required fields exist
                    if (!itemData.name) {
                        throw new Error('Item name is required');
                    }
                    
                    addFromCatalogue(itemData);
                } catch (error) {
                    console.error('Error adding to astrodex:', error);
                    showMessage('error', 'Failed to add item');
                }
            });
        });
        
        // Apply default sorting based on table type
        applyDefaultSort(catalogue, type);
        
        // Apply filter if checkbox was checked
        if (fotoCheckbox && fotoCheckbox.checked) {
            filterTable(catalogue, type);
        }
    }, 100);
    
    return html;
}

// Sync foto filter value across all Report and Bodies tables
function syncFotoValues(value) {
    const fotoInputs = document.querySelectorAll('.shared-foto-value');
    fotoInputs.forEach(input => {
        if (input.value !== value) {
            input.value = value;
        }
    });
}

function syncFotoCheckboxes(checked) {
    const fotoCheckboxes = document.querySelectorAll('[id^="foto-filter-"]');
    fotoCheckboxes.forEach(checkbox => {
        if (checkbox.checked !== checked) {
            checkbox.checked = checked;
        }
    });
}

// Apply default sorting to tables
function applyDefaultSort(catalogue, type) {
    let defaultColumn = '';
    let defaultDirection = 'desc';
    
    if (type === 'report') {
        defaultColumn = 'foto';
        defaultDirection = 'desc';
    } else if (type === 'bodies') {
        defaultColumn = 'foto';
        defaultDirection = 'desc';
    } else if (type === 'comets') {
        defaultColumn = 'target name';
        defaultDirection = 'asc';
    }
    
    if (defaultColumn) {
        // Trigger the sort
        const table = document.getElementById(`table-${catalogue}-${type}`);
        if (!table) return;
        
        const thead = table.querySelector('thead');
        const th = thead.querySelector(`th[data-column="${defaultColumn}"]`);
        
        if (th) {
            // Set the sort state to opposite of desired, since sortTable will toggle
            const oppositeDirection = defaultDirection === 'asc' ? 'desc' : 'asc';
            th.setAttribute('data-sort', oppositeDirection);
            
            // Call sortTable which will toggle to the desired direction
            sortTable(catalogue, defaultColumn, type);
        }
    }
}

function filterTable(catalogue, type) {
    const filterInput = document.getElementById(`filter-${catalogue}-${type}`);
    const fotoCheckbox = document.getElementById(`foto-filter-${catalogue}-${type}`);
    const fotoValueInput = document.getElementById(`foto-value-${catalogue}-${type}`);
    const constellationSelect = document.getElementById(`constellation-filter-${catalogue}-${type}`);
    const typeSelect = document.getElementById(`type-filter-${catalogue}-${type}`);
    const table = document.getElementById(`table-${catalogue}-${type}`);
    
    if (!table) return;
    
    const filterText = filterInput ? filterInput.value.toLowerCase() : '';
    const fotoFilter = fotoCheckbox ? fotoCheckbox.checked : false;
    const fotoThreshold = fotoValueInput ? parseFloat(fotoValueInput.value) : 0.8;
    const constellationFilter = constellationSelect ? constellationSelect.value : '';
    const typeFilter = typeSelect ? typeSelect.value : '';
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const fotoValue = parseFloat(row.getAttribute('data-foto')) || 0;
        const constellation = row.getAttribute('data-constellation') || '';
        const rowType = row.getAttribute('data-type') || '';
        
        const matchesFilter = !filterText || text.includes(filterText);
        const matchesFoto = !fotoFilter || fotoValue >= fotoThreshold;
        const matchesConstellation = !constellationFilter || constellation === constellationFilter;
        const matchesType = !typeFilter || rowType === typeFilter;
        
        row.style.display = (matchesFilter && matchesFoto && matchesConstellation && matchesType) ? '' : 'none';
    });
}

function showPlotPopup(title, src) {
    // Modal modal_full_close
    const modalElement = document.getElementById('modal_full_close');
    if (!modalElement) {
        console.error('Modal element not found');
        return;
    }
    
    const modal = new bootstrap.Modal(modalElement);

    // Prepare modal content
    const titleElement = document.getElementById('modal_full_close_title');
    if (titleElement) {
        titleElement.textContent = title;
    }
    
    const bodyElement = document.getElementById('modal_full_close_body');
    if (bodyElement) {
        bodyElement.innerHTML = `
            <img 
                id="image-display" 
                src="${src}" 
                alt="Plot" 
                title="${title}" 
                class="img-fluid rounded" 
            >
        `;
    }

    // Show the modal
    modal.show();
}

function showAlttimePopup(title, src) {
    // Modal modal_xl_close
    const modalElement = document.getElementById('modal_xl_close');
    if (!modalElement) {
        console.error('Modal element not found');
        return;
    }
    
    const modal = new bootstrap.Modal(modalElement);

    // Prepare modal content
    const titleElement = document.getElementById('modal_xl_close_title');
    if (titleElement) {
        titleElement.textContent = title;
    }
    
    const bodyElement = document.getElementById('modal_xl_close_body');
    if (bodyElement) {
        bodyElement.innerHTML = `
            <img 
                id="image-display" 
                src="${src}" 
                alt="Altitude-Time Plot" 
                title="${title}" 
                class="img-fluid rounded" 
            >
        `;
    }

    // Show the modal
    modal.show();
}

function showMorePopup(popupId) {
    const popup = document.getElementById(popupId);
    
    if (popup) {
        // Use BS modal
        //Prepare modal title
        const titleElement = document.getElementById('modal_lg_close_title');
        titleElement.innerHTML = `More informations`;
        
        //Prepare modal content
        const contentElement = document.getElementById('modal_lg_close_body');
        contentElement.innerHTML = popup.innerHTML;

        const bs_modal = new bootstrap.Modal('#modal_lg_close', {
            backdrop: 'static',
            focus: true,
            keyboard: true
        });
        bs_modal.show();

    }
}

// Close popup when clicking outside
window.addEventListener('click', function(event) {
    if (event.target.classList.contains('more-popup')) {
        event.target.style.display = 'none';
    }
});

function sortTable(catalogue, column, type) {
    // Simple client-side sorting implementation with type parameter
    const table = document.getElementById(`table-${catalogue}-${type}`);
    if (!table) return;
    
    const tbody = table.querySelector('tbody');
    const thead = table.querySelector('thead');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    // Get current sort state for this column
    const th = thead.querySelector(`th[data-column="${column}"]`);
    const currentSort = th.getAttribute('data-sort') || 'none';
    
    // Clear other columns' sort indicators (but preserve current column state for toggle logic)
    thead.querySelectorAll('th').forEach(header => {
        if (header !== th) {
            header.setAttribute('data-sort', 'none');
            const indicator = header.querySelector('.sort-indicator');
            if (indicator) indicator.textContent = '';
        }
    });
    
    // Toggle sort direction
    let sortDirection = 'asc';
    if (currentSort === 'asc') {
        sortDirection = 'desc';
    } else if (currentSort === 'desc') {
        sortDirection = 'asc';
    }
    
    th.setAttribute('data-sort', sortDirection);
    const indicator = th.querySelector('.sort-indicator');
    if (indicator) {
        indicator.textContent = sortDirection === 'asc' ? '▲' : '▼';
    }
    
    // Sort rows
    rows.sort((a, b) => {
        const aVal = a.querySelector(`td:nth-child(${getColumnIndex(table, column)})`).textContent;
        const bVal = b.querySelector(`td:nth-child(${getColumnIndex(table, column)})`).textContent;
        
        let comparison = 0;
        if (!isNaN(aVal) && !isNaN(bVal)) {
            comparison = parseFloat(aVal) - parseFloat(bVal);
        } else {
            comparison = aVal.localeCompare(bVal);
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    tbody.innerHTML = '';
    rows.forEach(row => tbody.appendChild(row));
}

function getColumnIndex(table, columnName) {
    const headers = table.querySelectorAll('th');
    for (let i = 0; i < headers.length; i++) {
        // Use data-column attribute for reliable matching
        if (headers[i].getAttribute('data-column') === columnName) {
            return i + 1;
        }
    }
    return 1;
}


// ======================
// YAML Editors
// ======================

function parseCustomTargetsYAML(yamlText) {
    const targets = [];
    const lines = yamlText.split('\n');
    let currentTarget = null;
    
    // Simple YAML parser for custom targets
    // Note: This is a simplified parser that handles basic YAML structures
    // Limitations: Does not support nested objects, arrays within values, or complex YAML features
    // For production use with complex YAML, consider using a proper YAML library
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        if (trimmed.startsWith('- name:')) {
            if (currentTarget) targets.push(currentTarget);
            currentTarget = { name: trimmed.split(':')[1].trim() };
        } else if (currentTarget) {
            const parts = trimmed.split(':');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join(':').trim(); // Handle colons in values
                
                if (key === 'size' || key === 'mag') {
                    currentTarget[key] = parseFloat(value);
                } else {
                    currentTarget[key] = value;
                }
            }
        }
    }
    
    if (currentTarget) targets.push(currentTarget);
    return targets;
}

function formatCustomTargetsAsYAML(targets) {
    return targets.map(target => {
        let yaml = `- name: ${target.name}\n`;
        if (target.description) yaml += `  description: ${target.description}\n`;
        if (target.type) yaml += `  type: ${target.type}\n`;
        if (target.constellation) yaml += `  constellation: ${target.constellation}\n`;
        if (target.size) yaml += `  size: ${target.size}\n`;
        if (target.ra) yaml += `  ra: ${target.ra}\n`;
        if (target.dec) yaml += `  dec: ${target.dec}\n`;
        if (target.mag) yaml += `  mag: ${target.mag}\n`;
        return yaml;
    }).join('');
}

function parseHorizonYAML(yamlText) {
    const lines = yamlText.split('\n');
    const horizon = { step_size: 5, anchor_points: [] };
    let inAnchorPoints = false;
    let currentPoint = null;
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        if (trimmed.startsWith('step_size:')) {
            horizon.step_size = parseInt(trimmed.split(':')[1].trim());
        } else if (trimmed.startsWith('anchor_points:')) {
            inAnchorPoints = true;
        } else if (inAnchorPoints) {
            if (trimmed.startsWith('- alt:')) {
                if (currentPoint) horizon.anchor_points.push(currentPoint);
                currentPoint = { alt: parseFloat(trimmed.split(':')[1].trim()) };
            } else if (currentPoint && trimmed.startsWith('az:')) {
                currentPoint.az = parseFloat(trimmed.split(':')[1].trim());
            }
        }
    }
    
    if (currentPoint) horizon.anchor_points.push(currentPoint);
    return horizon;
}

function formatHorizonAsYAML(horizon) {
    let yaml = `step_size: ${horizon.step_size}\n`;
    yaml += `anchor_points:\n`;
    
    if (horizon.anchor_points && horizon.anchor_points.length > 0) {
        horizon.anchor_points.forEach(point => {
            yaml += `  - alt: ${point.alt}\n`;
            yaml += `    az: ${point.az}\n`;
        });
    }
    
    return yaml;
}

// YAML Editor with validation
function initializeYAMLEditors() {
    const yamlEditors = [
        { id: 'custom-targets', containerId: 'custom-targets-container', statusId: 'custom-targets-status' },
        { id: 'horizon-config', containerId: 'horizon-config-container', statusId: 'horizon-config-status' },
        { id: 'bucket-list', containerId: 'bucket-list-container', statusId: 'bucket-list-status' },
        { id: 'done-list', containerId: 'done-list-container', statusId: 'done-list-status' }
    ];
    
    yamlEditors.forEach(editor => {
        const textarea = document.getElementById(editor.id);
        const container = document.getElementById(editor.containerId);
        const status = document.getElementById(editor.statusId);
        
        if (!textarea || !container || !status) return;
        
        // Validate on input
        textarea.addEventListener('input', () => {
            validateYAML(textarea, container, status);
        });
        
        // Validate on initial load
        validateYAML(textarea, container, status);
    });
}

function validateYAML(textarea, container, statusElement) {
    const value = textarea.value.trim();
    
    if (!value) {
        //console.log('YAML is empty, skipping validation');
        // Empty is valid
        container.classList.remove('invalid');
        container.classList.remove('valid');
        statusElement.classList.remove('invalid');
        statusElement.classList.remove('valid');
        statusElement.querySelector('.icon').textContent = '&nbsp;';
        statusElement.querySelector('.yaml-validation-message').textContent = '';
        return;
    }
    
    try {
        // Simple YAML validation - check for basic syntax issues
        const lines = value.split('\n');
        let isValid = true;
        let errorMessage = '';
        
        // Check indentation consistency
        const indentations = new Set();
        let lastIndent = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Skip empty lines and comments
            if (!line.trim() || line.trim().startsWith('#')) continue;
            
            // Count leading spaces
            const leadingSpaces = line.match(/^(\s*)/)[0].length;
            
            // Check if indentation is consistent (multiples of 2)
            if (leadingSpaces % 2 !== 0) {
                isValid = false;
                errorMessage = `Line ${i + 1}: Indentation should be multiple of 2 spaces`;
                break;
            }
            
            // Check for tabs (should use spaces)
            if (line.includes('\t')) {
                isValid = false;
                errorMessage = `Line ${i + 1}: Use spaces instead of tabs`;
                break;
            }
            
            // Check for basic YAML structure
            if (line.trim().startsWith('-')) {
                // List item
                if (leadingSpaces === 0 && lastIndent > 0) {
                    // New list at root level after indented content
                }
                lastIndent = leadingSpaces;
            } else if (line.includes(':')) {
                // Key-value pair
                const colonIndex = line.indexOf(':');
                const afterColon = line.substring(colonIndex + 1).trim();
                
                // Check if value after colon has proper spacing
                if (line[colonIndex + 1] && line[colonIndex + 1] !== ' ' && line[colonIndex + 1] !== '\n') {
                    isValid = false;
                    errorMessage = `Line ${i + 1}: Add space after colon`;
                    break;
                }
                
                lastIndent = leadingSpaces;
            }
        }
        
        if (isValid) {
            container.classList.remove('invalid');
            container.classList.add('valid');
            statusElement.classList.remove('invalid');
            statusElement.classList.add('valid');
            statusElement.querySelector('.icon').textContent = '✓';
            statusElement.querySelector('.yaml-validation-message').textContent = 'Valid YAML syntax';
        } else {
            container.classList.remove('valid');
            container.classList.add('invalid');
            statusElement.classList.remove('valid');
            statusElement.classList.add('invalid');
            statusElement.querySelector('.icon').textContent = '✗';
            statusElement.querySelector('.yaml-validation-message').textContent = errorMessage;
        }
    } catch (error) {
        container.classList.remove('valid');
        container.classList.add('invalid');
        statusElement.classList.remove('valid');
        statusElement.classList.add('invalid');
        statusElement.querySelector('.icon').textContent = '✗';
        statusElement.querySelector('.yaml-validation-message').textContent = 'Invalid YAML syntax';
    }
}

/**
 * Update the "✓ Captured" badges in catalogue tables after Astrodex changes
 * @param {string} itemName - Name of the item to update
 * @param {boolean} isInAstrodex - Whether the item is now in Astrodex
 */
async function updateCatalogueCapturedBadge(itemName, isInAstrodex) {
    if (!itemName) return;
    
    // Find all table rows with matching item name
    const tables = document.querySelectorAll('table[id^="table-"]');
    
    tables.forEach(table => {
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            // Find the astrodex column cell
            const astrodexCell = Array.from(row.cells).find(cell => {
                const badge = cell.querySelector('.in-astrodex-badge');
                const button = cell.querySelector('.astrodex-add-btn');
                return badge || button;
            });
            
            if (!astrodexCell) return;
            
            // Check if this row is for our item
            const button = astrodexCell.querySelector('.astrodex-add-btn');
            if (button) {
                try {
                    const itemData = JSON.parse(button.getAttribute('data-item').replace(/&quot;/g, '"'));
                    const rowItemName = itemData.name || itemData['target name'] || itemData.id;
                    
                    if (rowItemName === itemName) {
                        // Update the cell
                        if (isInAstrodex) {
                            // Replace button with badge
                            astrodexCell.innerHTML = '<span class="in-astrodex-badge">✓ Captured</span>';
                        }
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            } else {
                // Check if badge exists and we need to remove it
                const badge = astrodexCell.querySelector('.in-astrodex-badge');
                if (badge && !isInAstrodex) {
                    // Find the item name from other cells in this row
                    const nameCell = row.querySelector('td:nth-child(1)');
                    if (nameCell && nameCell.textContent.trim() === itemName) {
                        // Item was removed from Astrodex - add back the button
                        // Get catalogue from table ID
                        const tableId = table.id;
                        const match = tableId.match(/table-([^-]+)-/);
                        const catalogue = match ? match[1] : '';
                        
                        // Create a basic item data for the button
                        const itemData = {
                            name: itemName,
                            catalogue: catalogue
                        };
                        const itemDataJson = JSON.stringify(itemData).replace(/"/g, '&quot;');
                        astrodexCell.innerHTML = `<button class="btn btn-sm astrodex-add-btn" data-item="${itemDataJson}">➕ Add</button>`;
                    }
                }
            }
        });
    });
}

// ======================
// Log Management Functions
// ======================

async function checkCatalogueLogExists(catalogue) {
    try {
        const result = await fetchJSON(`/api/uptonight/logs/${catalogue}/exists`);
        return result.log_exists;
    } catch (error) {
        console.error('Error checking log file existence:', error);
        return false;
    }
}

async function loadCatalogueLog(catalogue) {
    try {
        const result = await fetchJSON(`/api/uptonight/logs/${catalogue}`);
        return result.log_content;
    } catch (error) {
        console.error('Error loading log file:', error);
        return null;
    }
}

// ======================
// Report Management Functions
// ======================

async function checkCatalogueReportsAvailable(catalogue) {
    try {
        const result = await fetchJSON(`/api/uptonight/reports/${catalogue}/available`);
        return result;
    } catch (error) {
        console.error('Error checking reports availability:', error);
        return null;
    }
}

async function loadSelectedReport(catalogue, reportType) {
    try {
        const contentDiv = document.getElementById(`report-content-${catalogue}`);
        if (!contentDiv) return;
        
        contentDiv.innerHTML = '<div class="loading">Loading report content...</div>';
        
        const result = await fetchJSON(`/api/uptonight/reports/${catalogue}/${reportType}`);
        
        if (result && result.report_content) {
            // Helper function to escape HTML
            function escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }
            
            contentDiv.innerHTML = `<pre>${escapeHtml(result.report_content)}</pre>`;
        } else {
            contentDiv.innerHTML = '<div class="alert alert-warning">Report file is empty or not available.</div>';
        }
    } catch (error) {
        console.error('Error loading report:', error);
        const contentDiv = document.getElementById(`report-content-${catalogue}`);
        if (contentDiv) {
            contentDiv.innerHTML = '<div class="alert alert-danger">Failed to load report content.</div>';
        }
    }
}
