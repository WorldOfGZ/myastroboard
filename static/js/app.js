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

    // Init scheduler
    Scheduler.init();

    checkCacheStatus();
    
    // Load initial page
    switchSubTab("forecast", "weather"); 
}

function setupMainTabs() {
    const mainTabBtns = document.querySelectorAll('.main-tab-btn');
    mainTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
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
            const subtabName = e.target.getAttribute('data-subtab');
            const parentTab = e.target.closest('.main-tab-content').id.replace('-tab', '');
            switchSubTab(parentTab, subtabName);
        }
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
    } else if (subtabName === 'sunmoon') { //Forecast sunmoon - Weather
        loadSun();
        loadMoon();
        loadNextMoonPhases();
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
        const response = await fetch(`${API_BASE}/api/timezones`);
        const timezones = await response.json();
        
        const select = document.getElementById('timezone');
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
        const response = await fetch(`${API_BASE}/api/config`);
        const config = await response.json();
        currentConfig = config;
        
        // Populate basic fields
        document.getElementById('location-name').value = config.location?.name || '';
        document.getElementById('latitude-input').value = config.location?.latitude || '';
        document.getElementById('longitude-input').value = config.location?.longitude || '';
        document.getElementById('elevation').value = config.location?.elevation || 0;
        document.getElementById('timezone').value = config.location?.timezone || 'UTC';
        
        // Features
        const features = config.features || {};
        document.getElementById('feature-horizon').checked = features.horizon !== false;
        document.getElementById('feature-objects').checked = features.objects !== false;
        document.getElementById('feature-bodies').checked = features.bodies !== false;
        document.getElementById('feature-comets').checked = features.comets !== false;
        document.getElementById('feature-alttime').checked = features.alttime !== false;
        
        // Constraints
        const useConstraints = config.use_constraints !== false;  // Default to true
        document.getElementById('use-constraints').checked = useConstraints;
        toggleConstraintsFields(useConstraints);
        
        const constraints = config.constraints || {};
        document.getElementById('altitude-min').value = constraints.altitude_constraint_min || 30;
        document.getElementById('altitude-max').value = constraints.altitude_constraint_max || 80;
        document.getElementById('airmass').value = constraints.airmass_constraint || 2;
        document.getElementById('size-min').value = constraints.size_constraint_min || 10;
        document.getElementById('size-max').value = constraints.size_constraint_max || 300;
        document.getElementById('moon-sep').value = constraints.moon_separation_min || 45;
        document.getElementById('time-threshold').value = constraints.fraction_of_time_observable_threshold || 0.5;
        document.getElementById('max-targets').value = constraints.max_number_within_threshold || 60;
        document.getElementById('moon-illumination').checked = constraints.moon_separation_use_illumination !== false;
        document.getElementById('north-ccw').checked = constraints.north_to_east_ccw === true;
                
        // Bucket list
        if (config.bucket_list && config.bucket_list.length > 0) {
            document.getElementById('bucket-list').value = config.bucket_list.join('\n');
        }
        
        // Done list
        if (config.done_list && config.done_list.length > 0) {
            document.getElementById('done-list').value = config.done_list.join('\n');
        }
        
        // Custom targets
        if (config.custom_targets && config.custom_targets.length > 0) {
            document.getElementById('custom-targets').value = formatCustomTargetsAsYAML(config.custom_targets);
        }
        
        // Horizon
        if (config.horizon && config.horizon.anchor_points && config.horizon.anchor_points.length > 0) {
            const horizonYAML = formatHorizonAsYAML(config.horizon);
            document.getElementById('horizon-config').value = horizonYAML;
        } else {
            document.getElementById('horizon-config').value = '';
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
    
    if (selectedCatalogues.length === 0) {
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
        selected_catalogues: selectedCatalogues,
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
        const response = await fetch(`${API_BASE}/api/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        
        const result = await response.json();
        
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

function setupEventListeners() {
    // Configuration save
    document.getElementById('save-config').addEventListener('click', saveConfiguration);
    document.getElementById('save-advanced').addEventListener('click', saveConfiguration);
    document.getElementById('view-config-main').addEventListener('click', viewConfiguration);
    document.getElementById('export-config-main').addEventListener('click', exportConfiguration);
    
    // Run Now button
    document.getElementById('run-now')
        ?.addEventListener('click', Scheduler.trigger);
    
    // Constraints toggle
    document.getElementById('use-constraints').addEventListener('change', (e) => {
        toggleConstraintsFields(e.target.checked);
    });
    
    // Coordinate conversion
    document.getElementById('latitude-input').addEventListener('blur', () => convertCoordinate('latitude'));
    document.getElementById('longitude-input').addEventListener('blur', () => convertCoordinate('longitude'));
    
    // Logs
    document.getElementById('refresh-logs').addEventListener('click', loadLogs);
    document.getElementById('clear-logs-display').addEventListener('click', clearLogsDisplay);
    document.getElementById('log-level').addEventListener('change', loadLogs);
    document.getElementById('log-limit').addEventListener('change', loadLogs);
    
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
        return;
    }
    
    // Try to convert DMS
    try {
        const response = await fetch(`${API_BASE}/api/convert-coordinates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dms: value })
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            convertedEl.textContent = `✓ Decimal: ${data.decimal}`;
            input.value = data.decimal;
        } else {
            errorEl.textContent = `✗ ${data.message}`;
        }
    } catch (error) {
        errorEl.textContent = '✗ Invalid format';
    }
}

let configsData = [];
//View all configs
async function viewConfiguration() {
    try {
        const response = await fetch(`${API_BASE}/api/config/view`);
        const data = await response.json();
        
        if (data.status === 'success') {
            configsData = data.configs;

            const selector = document.getElementById('config-selector');
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

            // Display the modal
            document.getElementById('config-modal').style.display = 'block';
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
    document.getElementById('config-display').textContent = cfg.yaml;
}

// Export uptonight config as YAML
document.getElementById('export-config-from-modal').onclick = () => {
    const selector = document.getElementById('config-selector');
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
        const level = document.getElementById('log-level').value;
        const limit = document.getElementById('log-limit').value;
        const response = await fetch(`${API_BASE}/api/logs?level=${level}&limit=${limit}`);
        const data = await response.json();
        
        const logsContainer = document.getElementById('logs-display');
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
        document.getElementById('logs-display').innerHTML = '<div class="log-error">Error loading logs</div>';
    }
}

async function clearLogsDisplay() {
    await fetch(`${API_BASE}/api/logs/clear`, {
        method: "POST"
    });

    showMessage("success", "Logs cleared");

    document.getElementById('logs-display').innerHTML = '<div class="log-empty">Logs cleared (refresh to reload)</div>';
}

async function loadVersion() {
    try {
        const response = await fetch(`${API_BASE}/api/version`);
        const data = await response.json();
        document.getElementById('version').textContent = `v${data.version}`;
        
        // Check for updates once per page load
        checkForUpdates(data.version);
    } catch (error) {
        console.error('Error loading version:', error);
    }
}

async function checkForUpdates(currentVersion) {
    try {
        // Only check once per session
        if (sessionStorage.getItem('updateChecked')) {
            return;
        }
        
        sessionStorage.setItem('updateChecked', 'true');
        
        // Fetch latest release from GitHub API
        const response = await fetch('https://api.github.com/repos/WorldOfGZ/myastroboard/releases/latest');
        
        if (!response.ok) {
            return; // Silently fail if API is not available
        }
        
        const release = await response.json();
        const latestVersion = release.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present
        const current = currentVersion.replace(/^v/, '');
        
        // Simple version comparison (assumes semantic versioning)
        if (isNewerVersion(current, latestVersion)) {
            showUpdateNotification(release.html_url, latestVersion);
        }
    } catch (error) {
        // Silently fail - don't show errors for update checking
        console.debug('Update check failed:', error);
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
    }
}

// ======================
// UpTonight
// ======================


async function loadCatalogues() {
    try {
        const response = await fetch(`${API_BASE}/api/catalogues`);
        const catalogues = await response.json();
        
        const container = document.getElementById('catalogues-list');
        container.innerHTML = '';
        
        // Ensure Messier is checked by default if no catalogues selected
        const selectedCatalogues = currentConfig.selected_catalogues || ['Messier'];
        
        catalogues.forEach(catalogue => {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = catalogue;
            checkbox.checked = selectedCatalogues.includes(catalogue);
            
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(catalogue));
            container.appendChild(label);
        });
        
    } catch (error) {
        console.error('Error loading catalogues:', error);
    }
}

//Load uptonight results tabs
async function loadUptonightResultsTabs() {
    try {
        const response = await fetch(`${API_BASE}/api/uptonight/outputs`);
        const outputs = await response.json();
        
        const subtabsContainer = document.getElementById('uptonight-subtabs');
        
        // Add catalogue tabs first, then weather tab at the end
        let tabsHTML = '';
        
        if (outputs && outputs.length > 0) {
            outputs.forEach((output, index) => {
                tabsHTML += `<button class="sub-tab-btn" data-subtab="catalogue-${output.target}">📚 ${output.target}</button>`;
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
                        <div class="card">
                            <h2>📚 ${output.target} Results</h2>
                            <div id="catalogue-${output.target}-type-buttons" class="catalogue-type-buttons"></div>
                            <div id="catalogue-${output.target}-content" class="loading">Loading...</div>
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
                activateSubTab('uptonight', `catalogue-${outputs[0].target}`);
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
        const response = await fetch(`${API_BASE}/api/uptonight/reports/${catalogue}`);
        const reports = await response.json();
        //console.log('Catalogue reports:', reports);
        const buttonsContainer = document.getElementById(`catalogue-${catalogue}-type-buttons`);
        const container = document.getElementById(`catalogue-${catalogue}-content`);
        
        if (reports.error) {
            container.innerHTML = `<div class="error-box">${reports.error}</div>`;
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
            buttonsHTML += `<button class="catalogue-type-btn ${!firstType ? 'active' : ''}" onclick="showCatalogueType('${catalogue}', 'plot')">📊 Plot</button>`;
            if (!firstType) firstType = 'plot';
        }
        if (hasReport) {
            buttonsHTML += `<button class="catalogue-type-btn ${!firstType ? 'active' : ''}" onclick="showCatalogueType('${catalogue}', 'report')">🌌 Deep sky objects</button>`;
            if (!firstType) firstType = 'report';
        }
        if (hasBodies) {
            buttonsHTML += `<button class="catalogue-type-btn ${!firstType ? 'active' : ''}" onclick="showCatalogueType('${catalogue}', 'bodies')">🪐 Bodies</button>`;
            if (!firstType) firstType = 'bodies';
        }
        if (hasComets) {
            buttonsHTML += `<button class="catalogue-type-btn ${!firstType ? 'active' : ''}" onclick="showCatalogueType('${catalogue}', 'comets')">☄️ Comets</button>`;
            if (!firstType) firstType = 'comets';
        }
        
        buttonsContainer.innerHTML = buttonsHTML;
        
        // Store the reports data for switching between types
        window.catalogueReports = window.catalogueReports || {};
        window.catalogueReports[catalogue] = reports;
        
        // Show default (first available) view
        if (firstType) {
            showCatalogueType(catalogue, firstType);
        }
        
    } catch (error) {
        console.error('Error loading catalogue results:', error);
        const container = document.getElementById(`catalogue-${catalogue}-content`);
        container.innerHTML = '<div class="error-box">Failed to load catalogue results</div>';
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
            <div class="plot-image">
                <img src="${API_BASE}/api/uptonight/outputs/${catalogue}/uptonight-plot.png" 
                     alt="${catalogue} plot" 
                     onclick="showImagePopup('${catalogue} Plot', this.src)">
            </div>
        `;
    }
    // Show appropriate table based on type (not for plot)
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
        <div class="table-controls">
            <input type="text" id="filter-${catalogue}-${type}" placeholder="Search..." class="filter-input">`;
    
    // Only show foto filter for report and bodies types, not for comets
    // Use shared foto value from localStorage or default to 0.8
    if (type !== 'comets') {
        const savedFotoValue = localStorage.getItem('fotoFilterValue') || '0.8';
        html += `
            <label style="display: flex; align-items: center; gap: 5px;">
                <input type="checkbox" id="foto-filter-${catalogue}-${type}"> Foto >= 
                <input type="number" id="foto-value-${catalogue}-${type}" value="${savedFotoValue}" step="0.1" min="0" max="1" style="width: 80px; padding: 4px;" class="shared-foto-value">
            </label>`;
    }
    
    // Add constellation filter if constellation field exists
    if (constellations.length > 0) {
        html += `
            <select id="constellation-filter-${catalogue}-${type}" class="filter-select">
                <option value="">All Constellations</option>`;
        constellations.forEach(c => {
            html += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
        });
        html += `</select>`;
    }
    
    // Add type filter if type field exists
    if (types.length > 0) {
        html += `
            <select id="type-filter-${catalogue}-${type}" class="filter-select">
                <option value="">All Types</option>`;
        types.forEach(t => {
            html += `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`;
        });
        html += `</select>`;
    }
    
    html += `
        </div>
        <div class="table-wrapper-full">
            <table class="report-table" id="table-${catalogue}-${type}">
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
    
    html += `</tr></thead><tbody>`;
    
    // Generate table rows
    report.forEach((row, idx) => {
        const fotoValue = row['foto'] || row['fraction of time observable'] || 0;
        html += `<tr data-foto="${fotoValue}" data-constellation="${escapeHtml(row.constellation || '')}" data-type="${escapeHtml(row.type || '')}">`;
        
        columns.forEach(col => {
            if (col.key === 'more') {
                // Generate More link that opens a popup
                const popupId = `more-popup-${catalogue}-${type}-${idx}`;
                html += `<td style="text-align: ${col.align}"><a href="#" onclick="showMorePopup('${popupId}'); return false;">📋 More</a></td>`;
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
                        constellation: row['constellation'] || row['const'],
                        mag: row['mag'] || row['visual magnitude'],
                        size: row['size']
                    };
                    const itemDataJson = JSON.stringify(itemData).replace(/"/g, '&quot;');
                    html += `<td style="text-align: ${col.align}"><button class="btn btn-sm astrodex-add-btn" data-item="${itemDataJson}">➕ Add</button></td>`;
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
                            <a href="#" onclick="showImagePopup('${escapeHtml(alttimeSource)} Altitude-Time', '${alttimePath}'); return false;">${displayValue}</a>
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
                <div id="more-popup-${catalogue}-${type}-${idx}" class="more-popup" style="display: none;">
                    <div class="more-popup-content">
                        <span class="more-popup-close" onclick="closeMorePopup('more-popup-${catalogue}-${type}-${idx}')">&times;</span>
                        <h3>Additional Information</h3>
                        <table class="more-info-table"><tbody>`;
            
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
                    showNotification('Failed to add item', 'error');
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

function showImagePopup(title, src) {
    document.getElementById('image-title').textContent = title;
    document.getElementById('image-display').src = src;
    document.getElementById('image-modal').style.display = 'block';
}

function showMorePopup(popupId) {
    const popup = document.getElementById(popupId);
    if (popup) {
        popup.style.display = 'block';
    }
}

function closeMorePopup(popupId) {
    const popup = document.getElementById(popupId);
    if (popup) {
        popup.style.display = 'none';
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
        // Empty is valid
        container.classList.remove('invalid');
        container.classList.remove('valid');
        statusElement.classList.remove('invalid');
        statusElement.classList.remove('valid');
        statusElement.querySelector('.icon').textContent = '⏺';
        statusElement.querySelector('.yaml-validation-message').textContent = 'Ready';
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
