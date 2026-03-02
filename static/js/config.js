// Configuration Management

let configsData = [];

// ======================
// Timezone Management
// ======================

async function loadTimezones() {
    try {
        const timezones = await fetchJSON('/api/timezones');

        //console.log(`Loaded ${timezones.length} timezones from API`);
        
        const select = document.getElementById('timezone');
        if (!select) return; // Element doesn't exist on this page view
        
        DOMUtils.clear(select);
        
        timezones.forEach(tz => {
            const option = document.createElement('option');
            option.value = tz.name;
            option.textContent = `${tz.name} (UTC${tz.offset})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading timezones:', error);
    }
}

// ======================
// Configuration Load/Save
// ======================

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

        // Astrodex options
        const astrodexPrivate = document.getElementById('astrodex-private');
        if (astrodexPrivate) astrodexPrivate.checked = config.astrodex?.private !== false;
        
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
        custom_targets: customTargets, 
        astrodex: {
            private: document.getElementById('astrodex-private').checked
        }
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

// ======================
// Coordinate Conversion
// ======================

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

// ======================
// Configuration View/Export
// ======================

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
            titleElement.textContent = '📄 UpTonight Configurations';
            
            //Prepare modal content
            const contentElement = document.getElementById('modal_lg_close_body');
            if (!contentElement) {
                console.error('Modal body element not found');
                showMessage('error', 'Configuration modal not properly initialized');
                return;
            }
            DOMUtils.clear(contentElement);
            const selectorRow = document.createElement('div');
            selectorRow.className = 'row row-cols-lg-auto g-3 align-items-center mb-3';
            const selectorCol = document.createElement('div');
            selectorCol.className = 'col-12';
            const selectorLabel = document.createElement('label');
            selectorLabel.className = 'visually-hidden';
            selectorLabel.setAttribute('for', 'config-selector');
            selectorLabel.textContent = 'Select configuration';
            const selectorElement = document.createElement('select');
            selectorElement.className = 'form-select';
            selectorElement.id = 'config-selector';
            selectorCol.appendChild(selectorLabel);
            selectorCol.appendChild(selectorElement);
            selectorRow.appendChild(selectorCol);

            const configDisplay = document.createElement('pre');
            configDisplay.id = 'config-display';
            configDisplay.className = 'border p-3 bg-dark text-light rounded';

            const exportButton = document.createElement('button');
            exportButton.id = 'export-config-from-modal';
            exportButton.className = 'btn btn-primary';
            exportButton.textContent = '⬇️ Export this config as YAML';

            contentElement.appendChild(selectorRow);
            contentElement.appendChild(configDisplay);
            contentElement.appendChild(exportButton);

            const selector = document.getElementById('config-selector');
            if (!selector) {
                console.error('Config selector element not found');
                showMessage('error', 'Configuration selector not properly initialized');
                return;
            }
            DOMUtils.clear(selector); // clear previous options

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
                        DOMUtils.clear(bodyElement);
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

// ======================
// YAML Parsing and Formatting
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

// ======================
// YAML Editor with Validation
// ======================

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
