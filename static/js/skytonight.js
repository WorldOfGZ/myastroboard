// SkyTonight Results Display and Management

let catalogueResults = {};
let currentCatalogueTab = ''; // Track current catalogue for Astrodex integration
let skytonightDisplayAstrodexCache = null;
let skytonightDisplayAstrodexPromise = null;

function tSkyTonightCompat(key, params = {}) {
    const skytonightKey = `skytonight.${key}`;
    return i18n.t(skytonightKey, params);
}

function tSkyTonightType(value) {
    const suffix = strToTranslateKey(value);
    const skytonightKey = `skytonight.type_${suffix}`;
    if (i18n.has(skytonightKey)) {
        return i18n.t(skytonightKey);
    }
    return value;
}

async function getSkyTonightDisplayAstrodex() {
    if (skytonightDisplayAstrodexCache !== null) {
        return skytonightDisplayAstrodexCache;
    }

    if (skytonightDisplayAstrodexPromise) {
        return skytonightDisplayAstrodexPromise;
    }

    skytonightDisplayAstrodexPromise = (async () => {
        const roleUser = await getUserRole();
        const canDisplay = roleUser === 'user' || roleUser === 'admin';
        skytonightDisplayAstrodexCache = canDisplay;
        skytonightDisplayAstrodexPromise = null;
        return canDisplay;
    })();

    return skytonightDisplayAstrodexPromise;
}

// ======================
// Catalogue Management
// ======================

async function loadCatalogues() {
    try {
        const catalogues = await fetchJSON('/api/catalogues');
        
        const container = document.getElementById('catalogues-list');
        if (!container) return; // Element doesn't exist on this page view

        DOMUtils.clear(container);
        
        // Ensure Messier is checked by default if no catalogues selected
        const selectedCatalogues = currentConfig.selected_catalogues || ['Messier'];
        
        catalogues.forEach(catalogue => {
            const checkboxElt = document.createElement('div');
            checkboxElt.className = 'form-check form-switch bg-checkbox';

            const input = document.createElement('input');
            input.className = 'form-check-input';
            input.type = 'checkbox';
            input.value = catalogue;
            input.id = `catalogue-${catalogue}`;
            input.toggleAttribute('checked', selectedCatalogues.includes(catalogue));
            input.setAttribute('switch', '');

            const label = document.createElement('label');
            label.className = 'form-check-label';
            label.setAttribute('for', `catalogue-${catalogue}`);
            label.textContent = catalogue;

            checkboxElt.appendChild(input);
            checkboxElt.appendChild(label);
            container.appendChild(checkboxElt);
        });
        
    } catch (error) {
        console.error('Error loading catalogues:', error);
    }
}

// ======================
// SkyTonight Results Tabs
// ======================

//Load SkyTonight results tabs
async function loadSkyTonightResultsTabs() {
    try {
        const outputs = [{ target: 'SkyTonight', files: [] }];
        
        const subtabsContainer = document.getElementById('skytonight-subtabs');
        let  eltFirstTab = -1; // Index of the first tab to activate by default

        DOMUtils.clear(subtabsContainer);
        
        //console.log('SkyTonight outputs:', outputs);

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
                const li = document.createElement('li');
                li.className = 'nav-item';
                const a = document.createElement('a');
                a.className = 'nav-link sub-tab-btn';
                a.href = '#';
                a.setAttribute('data-subtab', `catalogue-${target}`);
                a.innerHTML = `<i class="bi bi-journal-bookmark-fill text-success icon-inline" aria-hidden="true"></i>${target}`;
                li.appendChild(a);
                subtabsContainer.appendChild(li);
            });
        } else {
            subtabsContainer.textContent = tSkyTonightCompat('no_data_available');
        }
        
        // Create content divs for catalogue tabs
        const skytonightTab = document.getElementById('skytonight-tab');
        
        if (outputs && outputs.length > 0) {
            outputs.forEach((output, index) => {
                const existingDiv = document.getElementById(`catalogue-${output.target}-subtab`);
                if (!existingDiv) {
                    const div = document.createElement('div');
                    div.id = `catalogue-${output.target}-subtab`;
                    div.className = `sub-tab-content`;
                    const wrapper = document.createElement('div');
                    wrapper.className = 'shadow p-2 mb-3 rounded bg-sub-container';
                    const title = document.createElement('h2');
                    title.innerHTML = `<i class="bi bi-journal-bookmark text-success icon-inline" aria-hidden="true"></i>${tSkyTonightCompat('catalogue_results', {catalogue: output.target})}`;
                    const typeButtons = document.createElement('ul');
                    typeButtons.className = 'nav nav-pills sub-tabs';
                    typeButtons.id = `catalogue-${output.target}-type-buttons`;
                    const content = document.createElement('div');
                    content.id = `catalogue-${output.target}-content`;
                    const loadingAlert = document.createElement('div');
                    loadingAlert.className = 'alert alert-info';
                    loadingAlert.textContent = i18n.t('common.loading');
                    content.appendChild(loadingAlert);
                    wrapper.appendChild(title);
                    wrapper.appendChild(typeButtons);
                    wrapper.appendChild(content);
                    div.appendChild(wrapper);
                    skytonightTab.appendChild(div);
                    
                    // Load catalogue data
                    loadCatalogueResults(output.target);
                } else {
                    // Refresh existing tab data to avoid stale badges/state after plan changes.
                    loadCatalogueResults(output.target);
                }
            });
        }

        // Activate first available subtab once DOM is ready
        requestAnimationFrame(() => {
            if (outputs && outputs.length > 0) {
                //Get data-subtab value of the first subtab button
                const firstSubTabBtn = document.querySelector('#skytonight-subtabs > li:nth-child(1) > a');
                const firstSubTab = firstSubTabBtn ? firstSubTabBtn.getAttribute('data-subtab') : null;
                //console.log(`Activating first subtab: ${firstSubTab}`);
                activateSubTab('skytonight', firstSubTab);

                //console.log(`Activating first subtab: catalogue-${outputs[eltFirstTab].target}`);
                //activateSubTab('skytonight', `catalogue-${outputs[eltFirstTab].target}`);
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

        // SkyTonight is the only supported source.
        const reportsSource = 'skytonight';
        let reports;
        try {
            const isSkyTonightAggregate = catalogue === 'SkyTonight';
            reports = await fetchJSON(isSkyTonightAggregate ? '/api/skytonight/reports' : `/api/skytonight/reports/${catalogue}`);
            if (reports.error) {
                throw new Error(reports.error);
            }
        } catch (e) {
            console.warn(`SkyTonight reports unavailable for ${catalogue}:`, e);
            throw e;
        }
        //console.log('Catalogue reports:', reports);
        const buttonsContainer = document.getElementById(`catalogue-${catalogue}-type-buttons`);
        const container = document.getElementById(`catalogue-${catalogue}-content`);
        
        if (reports.error) {
            DOMUtils.clear(container);
            const alert = document.createElement('div');
            alert.className = 'alert alert-danger';
            alert.textContent = reports.error;
            container.appendChild(alert);
            return;
        }
        
        // Create buttons for available data types
        const hasPlot = reports.plot_image;
        const hasReport = reports.report && reports.report.length > 0;
        const hasBodies = reports.bodies && reports.bodies.length > 0;
        const hasComets = reports.comets && reports.comets.length > 0;
        const hasAnyData = !!(hasPlot || hasReport || hasBodies || hasComets);

        const renderButtons = (buttonItems) => {
            DOMUtils.clear(buttonsContainer);
            buttonItems.forEach((buttonItem) => {
                const li = document.createElement('li');
                li.className = 'nav-item';
                const link = document.createElement('a');
                link.className = `nav-link catalogue-type-btn${buttonItem.active ? ' active' : ''}`;
                link.href = '#';
                link.innerHTML = buttonItem.label;
                link.addEventListener('click', (event) => {
                    event.preventDefault();
                    showCatalogueType(catalogue, buttonItem.type);
                });
                li.appendChild(link);
                buttonsContainer.appendChild(li);
            });
        };
        
        // Determine first available type for default selection
        let firstType = null;
        
        // Add buttons in order: Plot, Deep sky objects (Report), Bodies, Comets
        const buttonItems = [];
        if (hasPlot) {
            buttonItems.push({ type: 'plot', label: `<i class="bi bi-bar-chart-line text-success icon-inline" aria-hidden="true"></i>${tSkyTonightCompat('plot')}`, active: !firstType });
            if (!firstType) firstType = 'plot';
        }
        if (hasReport) {
            buttonItems.push({ type: 'report', label: `<i class="bi bi-galaxy icon-inline" aria-hidden="true"></i>${tSkyTonightCompat('deep_sky_objects')}`, active: !firstType });
            if (!firstType) firstType = 'report';
        }
        if (hasBodies) {
            buttonItems.push({ type: 'bodies', label: `<i class="bi bi-globe2 text-warning icon-inline" aria-hidden="true"></i>${tSkyTonightCompat('bodies')}`, active: !firstType });
            if (!firstType) firstType = 'bodies';
        }
        if (hasComets) {
            buttonItems.push({ type: 'comets', label: `<i class="bi bi-comet text-warning icon-inline" aria-hidden="true"></i>${tSkyTonightCompat('comets')}`, active: !firstType });
            if (!firstType) firstType = 'comets';
        }
        if (reportsSource === 'skytonight') {
            buttonItems.push({ type: 'log', label: `<i class="bi bi-journal-text text-danger icon-inline" aria-hidden="true"></i>${tSkyTonightCompat('logs')}`, active: !firstType });
            if (!firstType && hasAnyData) firstType = 'log';
        }
        
        renderButtons(buttonItems);
        
        // Store the reports data for switching between types
        window.catalogueReports = window.catalogueReports || {};
        window.catalogueReportSources = window.catalogueReportSources || {};
        window.catalogueReports[catalogue] = reports;
        window.catalogueReportSources[catalogue] = reportsSource;
        window.catalogueReportsAvailability = window.catalogueReportsAvailability || {};
        window.catalogueReportsAvailability[catalogue] = {};

        // Show a clear empty state instead of forcing an empty log-error view.
        if (!hasAnyData) {
            DOMUtils.clear(container);
            const emptyAlert = document.createElement('div');
            emptyAlert.className = 'alert alert-info mt-3';
            emptyAlert.textContent = tSkyTonightCompat('no_data_available');
            container.appendChild(emptyAlert);
            return;
        }

        // Show default (first available) view
        if (firstType) {
            showCatalogueType(catalogue, firstType);
        }

        //throw new Error('Simulated error in loadCatalogueResults'); // Simulate an error to test error handling

    } catch (error) {
        console.error('Error loading catalogue results:', error);
        const container = document.getElementById(`catalogue-${catalogue}-content`);
        DOMUtils.clear(container);
        const alert = document.createElement('div');
        alert.className = 'alert alert-danger';
        alert.textContent = tSkyTonightCompat('failed_to_load_catalogue_results');
        container.appendChild(alert);
    }
}

async function showCatalogueType(catalogue, type) {
    const displayAstrodex = await getSkyTonightDisplayAstrodex();

    const reports = window.catalogueReports[catalogue];
    const reportSource = window.catalogueReportSources?.[catalogue] || 'skytonight';
    if (!reports) return;

    // Update active button
    const buttons = document.querySelectorAll(`#catalogue-${catalogue}-type-buttons .catalogue-type-btn`);
    buttons.forEach(btn => {
        btn.classList.remove('active');
        let btnType = '';
        switch(type) {
            case 'plot': btnType = tSkyTonightCompat('plot'); break;
            case 'report': btnType = tSkyTonightCompat('deep_sky_objects'); break;
            case 'bodies': btnType = tSkyTonightCompat('bodies'); break;
            case 'comets': btnType = tSkyTonightCompat('comets'); break;
            case 'log': btnType = tSkyTonightCompat('logs'); break;
            case 'reports': btnType = tSkyTonightCompat('reports'); break;
            default: console.warn(`Unknown catalogue type: ${type}`); return;
        }
        if (btn.textContent.includes(btnType)) btn.classList.add('active');
    });

    const container = document.getElementById(`catalogue-${catalogue}-content`);
    DOMUtils.clear(container); // Clear previous content

    // --- Plot ---
    if (type === 'plot' && reports.plot_image) {
        const plotDiv = document.createElement('div');
        plotDiv.className = 'plot-container mt-3';

        const img = document.createElement('img');
        img.src = `${API_BASE}/api/skytonight/outputs/${encodeURIComponent(catalogue)}/${encodeURIComponent(reports.plot_image)}`;
        img.alt = `${catalogue} plot`;
        img.className = 'img-fluid rounded';
        img.onclick = () => showPlotPopup(`${catalogue} Plot`, img.src);

        const info = document.createElement('div');
        info.className = 'text-muted small mt-2';
        info.textContent = tSkyTonightCompat('skytonight_credit');

        plotDiv.appendChild(img);
        plotDiv.appendChild(info);
        container.appendChild(plotDiv);
        return;
    }

    // --- Log ---
    if (type === 'log') {
        const loading = document.createElement('div');
        loading.className = 'loading';
        loading.textContent = tSkyTonightCompat('loading_log_content');
        container.appendChild(loading);

        const loadLogPromise = loadSkytonightLog();

        loadLogPromise.then(logContent => {
            DOMUtils.clear(container);
            const logContainer = document.createElement('div');
            logContainer.className = 'logs-container mt-3 rounded';

            if (typeof logContent === 'string') {
                const pre = document.createElement('pre');
                if (logContent.trim().length === 0) {
                    pre.textContent = tSkyTonightCompat('no_data_available');
                } else {
                    pre.textContent = logContent; // safe
                }
                logContainer.appendChild(pre);
            } else {
                const error = document.createElement('div');
                error.className = 'error-box';
                error.textContent = tSkyTonightCompat('failed_to_load_log_content');
                logContainer.appendChild(error);
            }

            container.appendChild(logContainer);
        });
        return;
    }

    // --- Reports ---
    if (type === 'reports') {
        const alert = document.createElement('div');
        alert.className = 'alert alert-info mt-3';
        alert.textContent = tSkyTonightCompat('no_report_available');
        container.appendChild(alert);
        return;
    }

    // --- Tables ---
    let tableHtml = '';
    if (type === 'report' && reports.report) tableHtml = generateReportTable(reports.report, catalogue, 'report', displayAstrodex);
    else if (type === 'bodies' && reports.bodies) tableHtml = generateReportTable(reports.bodies, catalogue, 'bodies', displayAstrodex);
    else if (type === 'comets' && reports.comets) tableHtml = generateReportTable(reports.comets, catalogue, 'comets', displayAstrodex);

    if (tableHtml) {
        DOMUtils.clear(container);
        const fragment = document.createRange().createContextualFragment(tableHtml);
        container.appendChild(fragment);
    } else {
        const p = document.createElement('p');
        p.textContent = tSkyTonightCompat('failed_to_load_report_content');
        container.appendChild(p);
    }
}

// ======================
// Report Table Generation
// ======================

function generateReportTable(report, catalogue, type, displayAstrodex = true) {
    if (!report || report.length === 0) return `<p>${tSkyTonightCompat('no_target_in_report')}</p>`;
    
    // Define column order and configuration for Report type
    const reportColumns = [
        { key: 'id', label: tSkyTonightCompat('table_id'), align: 'left' },
        { key: 'target name', label: tSkyTonightCompat('table_name'), align: 'left' },
        { key: 'size', label: tSkyTonightCompat('table_size'), align: 'center', unit: "'" },
        { key: 'foto', label: tSkyTonightCompat('table_foto'), align: 'center' },
        { key: 'mag', label: tSkyTonightCompat('table_mag'), align: 'center' },
        { key: 'constellation', label: tSkyTonightCompat('table_constellation'), align: 'center' },
        { key: 'type', label: tSkyTonightCompat('table_type'), align: 'center' },
        { key: 'altitude', label: tSkyTonightCompat('table_altitude'), align: 'center', unit: '°', decimals: 2 },
        { key: 'azimuth', label: tSkyTonightCompat('table_azimuth'), align: 'center', unit: '°', decimals: 2 },
        ...(displayAstrodex ? [{ key: 'astrodex', label: tSkyTonightCompat('table_astrodex'), align: 'center' }] : []),
        ...(displayAstrodex ? [{ key: 'plan_my_night', label: tSkyTonightCompat('table_plan_my_night'), align: 'center' }] : []),
        { key: 'more', label: tSkyTonightCompat('table_more'), align: 'center' }
    ];
    
    // Define column order and configuration for Bodies type
    const bodiesColumns = [
        { key: 'target name', label: tSkyTonightCompat('table_name'), align: 'left' },
        { key: 'altitude', label: tSkyTonightCompat('table_altitude'), align: 'center', unit: '°', decimals: 2 },
        { key: 'azimuth', label: tSkyTonightCompat('table_azimuth'), align: 'center', unit: '°', decimals: 2 },
        { key: 'max altitude time', label: tSkyTonightCompat('table_max_altitude_time'), align: 'center' },
        { key: 'visual magnitude', label: tSkyTonightCompat('table_visual_magnitude'), align: 'center', decimals: 2 },
        { key: 'foto', label: tSkyTonightCompat('table_foto'), align: 'center' },
        { key: 'type', label: tSkyTonightCompat('table_type'), align: 'center' },
        ...(displayAstrodex ? [{ key: 'astrodex', label: tSkyTonightCompat('table_astrodex'), align: 'center' }] : []),
        ...(displayAstrodex ? [{ key: 'plan_my_night', label: tSkyTonightCompat('table_plan_my_night'), align: 'center' }] : []),
        { key: 'more', label: tSkyTonightCompat('table_more'), align: 'center' }
    ];
    
    // Define column order and configuration for Comets type
    const cometsColumns = [
        { key: 'target name', label: tSkyTonightCompat('table_name'), align: 'left' },
        { key: 'altitude', label: tSkyTonightCompat('table_altitude'), align: 'center', unit: '°', decimals: 2 },
        { key: 'azimuth', label: tSkyTonightCompat('table_azimuth'), align: 'center', unit: '°', decimals: 2 },
        { key: 'visual magnitude', label: tSkyTonightCompat('table_visual_magnitude'), align: 'center', decimals: 2 },
        { key: 'distance earth au', label: tSkyTonightCompat('table_distance_earth'), align: 'center', unit: ' au', decimals: 2 },
        ...(displayAstrodex ? [{ key: 'astrodex', label: tSkyTonightCompat('table_astrodex'), align: 'center' }] : []),
        ...(displayAstrodex ? [{ key: 'plan_my_night', label: tSkyTonightCompat('table_plan_my_night'), align: 'center' }] : []),
        { key: 'more', label: tSkyTonightCompat('table_more'), align: 'center' }
    ];
    
    // Fields to show in "More" popup
    let moreFields = ['catalogue_names', 'meridian transit', 'antimeridian transit', 'right ascension', 'declination', 'hmsdms'];
    
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
                <label for="filter-${catalogue}-${type}" class="visually-hidden">${tSkyTonightCompat('search')}</label>
                <input type="text" id="filter-${catalogue}-${type}" placeholder="${tSkyTonightCompat('search_placeholder')}" class="filter-input form-control">
            </div>`;
    
    // Only show foto filter for report and bodies types, not for comets
    // Use shared foto value from localStorage or default to 0.8
    if (type !== 'comets') {
        const savedFotoValue = sanitizeFotoFilterValue(localStorage.getItem('fotoFilterValue'));
        html += `
            <div class="col-12">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="foto-filter-${catalogue}-${type}">
                    <label class="form-check-label" for="inlineFormCheck"> ${tSkyTonightCompat('search_foto')} </label>
                </div>               
            </div>`;
        
        html += `
            <div class="col-12">
                <label for="foto-value-${catalogue}-${type}" class="visually-hidden">${tSkyTonightCompat('search_foto_score')}</label>
                <input type="number" id="foto-value-${catalogue}-${type}" value="${savedFotoValue}" step="0.1" min="0" max="1" class="shared-foto-value form-control">
            </div>`;
    }
    
    // Add constellation filter if constellation field exists
    if (constellations.length > 0) {
        html += `
            <div class="col-12">
                <label class="visually-hidden" for="constellation-filter-${catalogue}-${type}">${tSkyTonightCompat('search_constellations')}</label>
                <select class="form-select filter-select" id="constellation-filter-${catalogue}-${type}">
                    <option value="">${tSkyTonightCompat('search_all_constellations')}</option>`;
        constellations.forEach(c => {
            let label_c = c;
            let translationKey = 'constellations.' + strToTranslateKey(label_c);
            if (i18n.has(translationKey)) {
                label_c = i18n.t(translationKey);
            } else {                // Try uppercase version of the key
                console.warn(`Translation key not found: ${translationKey}`);
            }

            html += `<option value="${escapeHtml(c)}">${escapeHtml(label_c)}</option>`;
        });
        html += `</select>
            </div>`;
    }
    
    // Add type filter if type field exists
    if (types.length > 0) {
        html += `
            <div class="col-12">
                <label class="visually-hidden" for="type-filter-${catalogue}-${type}">${tSkyTonightCompat('search_types')}</label>
                <select id="type-filter-${catalogue}-${type}" class="form-select filter-select">
                    <option value="">${tSkyTonightCompat('search_all_types')}</option>`;
        types.forEach(t => {
            let label_t = t;
            label_t = tSkyTonightType(label_t);

            html += `<option value="${escapeHtml(t)}">${escapeHtml(label_t)}</option>`;
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
                html += `<td style="text-align: ${col.align}"><a href="#" onclick="showMorePopup('${popupId}'); return false;" class="link-underline link-underline-opacity-0"><i class="bi bi-clipboard-data icon-inline" aria-hidden="true"></i>${tSkyTonightCompat('table_more')}</a></td>`;
            } else if (col.key === 'astrodex') {
                // Generate Astrodex action button
                const itemName = row['id'] || row['target name'];
                const isInAstrodex = row['in_astrodex'] || false;
                const itemData = {
                    id: row['id'],
                    'target name': row['target name'],
                    name: itemName,
                    type: row['type'] || row['targettype'],
                    source_type: type,
                    catalogue: catalogue,
                    ra: row['ra'] || row['right ascension'],
                    dec: row['dec'] || row['declination'],
                    constellation: (row['constellation'] || row['const'] || '').toLowerCase(),
                    mag: row['mag'] || row['visual magnitude'],
                    size: row['size']
                };
                const itemDataJson = JSON.stringify(itemData).replace(/"/g, '&quot;');
                
                if(displayAstrodex) {
                    if (isInAstrodex) {
                        html += `<td style="text-align: ${col.align}" data-item="${itemDataJson}"><span class="in-astrodex-badge"><i class="bi bi-check-circle-fill icon-inline" aria-hidden="true"></i>${tSkyTonightCompat('captured')}</span></td>`;
                    } else if (itemName) {
                        html += `<td style="text-align: ${col.align}" data-item="${itemDataJson}"><button class="btn btn-sm btn-outline-primary astrodex-add-btn" data-item="${itemDataJson}"><i class="bi bi-plus-circle icon-inline" aria-hidden="true"></i>${tSkyTonightCompat('add')}</button></td>`;
                    } else {
                        html += `<td style="text-align: ${col.align}">-</td>`;
                    }
                }
            } else if (col.key === 'plan_my_night') {
                const itemName = row['id'] || row['target name'];
                const isInPlanMyNight = row['in_plan_my_night'] || false;
                const planState = row['plan_state'] || 'none';
                const itemData = {
                    id: row['id'],
                    'target name': row['target name'],
                    name: itemName,
                    type: row['type'] || row['targettype'],
                    source_type: type,
                    catalogue: catalogue,
                    ra: row['ra'] || row['right ascension'],
                    dec: row['dec'] || row['declination'],
                    constellation: (row['constellation'] || row['const'] || '').toLowerCase(),
                    mag: row['mag'] || row['visual magnitude'],
                    size: row['size'],
                    foto: row['foto'] || row['fraction of time observable'],
                    alttime_file: row['alttime_file'] || '',
                    catalogue_group_id: row['catalogue_group_id'] || '',
                    catalogue_aliases: row['catalogue_aliases'] || {}
                };
                const itemDataJson = JSON.stringify(itemData).replace(/"/g, '&quot;');

                if (displayAstrodex) {
                    if (isInPlanMyNight) {
                        html += `<td style="text-align: ${col.align}" data-item="${itemDataJson}"><span class="in-astrodex-badge in-plan-my-night-badge"><i class="bi bi-check-circle-fill icon-inline" aria-hidden="true"></i>${tSkyTonightCompat('planned')}</span></td>`;
                    } else if (planState === 'previous') {
                        html += `<td style="text-align: ${col.align}" data-item="${itemDataJson}"><button class="btn btn-sm btn-outline-secondary" disabled title="${tSkyTonightCompat('plan_clear_required')}">${tSkyTonightCompat('add')}</button></td>`;
                    } else if (itemName) {
                        html += `<td style="text-align: ${col.align}" data-item="${itemDataJson}"><button class="btn btn-sm btn-outline-info plan-my-night-add-btn" data-item="${itemDataJson}" data-catalogue="${escapeHtml(catalogue)}"><i class="bi bi-moon-stars-fill icon-inline" aria-hidden="true"></i>${tSkyTonightCompat('add')}</button></td>`;
                    } else {
                        html += `<td style="text-align: ${col.align}">-</td>`;
                    }
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
                } else if (col.key === 'type' && value) { // Type field - try to translate the value
                    value = tSkyTonightType(value);
                } else if (col.key === 'constellation' && value) { // Constellation field - try to translate the value
                    let translationKey = 'constellations.' + strToTranslateKey(value);
                    if (i18n.has(translationKey)) {
                        value = i18n.t(translationKey);
                    }
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
                    // Messier badge: shown in the target name cell when the object is in the Messier catalogue
                    const messierNum = (col.key === 'target name')
                        ? (row['catalogue_names'] && row['catalogue_names']['Messier'] ? row['catalogue_names']['Messier'] : null)
                        : null;
                    const messierBadge = messierNum
                        ? `<span class="messier-badge" title="${escapeHtml(messierNum)}">${escapeHtml(messierNum)}</span>`
                        : '';
                    if (alttimeSource && row['alttime_file'] != '') {
                        const alttimeTargetId = encodeURIComponent(row['alttime_file']);
                        html += `
                        <td style="text-align: ${col.align}" class="alttime-check" data-alttime-id="${escapeHtml(row['alttime_file'])}" data-title="${escapeHtml(alttimeSource)} - ${escapeHtml(tSkyTonightCompat('altitude_time_title'))}">
                            ${messierBadge}<a href="#" class="link-underline link-underline-opacity-0 alttime-popup-link">${displayValue}</a>
                        </td>`;
                    } else {
                        html += `<td style="text-align: ${col.align}">${messierBadge}${displayValue}</td>`;
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

                // Special handling: catalogue names dict → one row per entry
                if (field === 'catalogue_names') {
                    if (value && typeof value === 'object') {
                        const entries = Object.entries(value);
                        if (entries.length > 0) {
                            let sectionLabel = tSkyTonightCompat('catalogue_names');
                            html += `<tr><td colspan="2" class="more-section-header fw-semibold text-muted small pt-2">${escapeHtml(sectionLabel)}</td></tr>`;
                            entries.forEach(([catName, catValue]) => {
                                if (catValue) {
                                    html += `<tr><td class="more-label">${escapeHtml(catName)}</td><td class="more-value">${escapeHtml(String(catValue))}</td></tr>`;
                                }
                            });
                        }
                    }
                    return;
                }

                let label = field.charAt(0).toUpperCase() + field.slice(1);
                let labelTranslations = strToTranslateKey(label);
                const skytonightLabelKey = `skytonight.${labelTranslations}`;
                if (i18n.has(skytonightLabelKey)) {
                    label = i18n.t(skytonightLabelKey);
                } else {
                    console.warn(`Missing translation for: ${skytonightLabelKey}`);
                }
                const hasValue = value !== null && value !== undefined && value !== '';
                let displayValue = hasValue ? String(value) : '–';

                // Apply special formatting for comets fields
                if (type === 'comets') {
                    if (field === 'absolute magnitude' && hasValue && !isNaN(value)) {
                        displayValue = parseFloat(value).toFixed(2);
                    } else if (field === 'distance sun au') {
                        label = tSkyTonightCompat('distance_sun');
                        if (hasValue && !isNaN(value)) {
                            displayValue = parseFloat(value).toFixed(2) + ' au';
                        }
                    } else if (field === 'distance earth au') {
                        if (hasValue && !isNaN(value)) {
                            displayValue = parseFloat(value).toFixed(2) + ' au';
                        }
                    }
                }

                html += `<tr><td class="more-label">${escapeHtml(label)}</td><td class="more-value">${escapeHtml(displayValue)}</td></tr>`;
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
                const normalizedFotoValue = sanitizeFotoFilterValue(fotoValueInput.value);
                fotoValueInput.value = normalizedFotoValue;
                localStorage.setItem('fotoFilterValue', normalizedFotoValue);
                syncFotoValues(normalizedFotoValue);
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
                    showMessage('error', tSkyTonightCompat('failed_to_add_astrodex'));
                }
            });
        });

        // Add event listeners for Plan My Night "Add" buttons
        const addPlanButtons = document.querySelectorAll('.plan-my-night-add-btn');
        addPlanButtons.forEach(button => {
            button.addEventListener('click', async function(e) {
                e.preventDefault();
                try {
                    const itemDataJson = this.getAttribute('data-item');
                    const catalogueName = this.getAttribute('data-catalogue');
                    const itemData = JSON.parse(itemDataJson);

                    if (!itemData || typeof itemData !== 'object' || !itemData.name) {
                        throw new Error('Invalid item data');
                    }

                    const response = await fetchJSON('/api/plan-my-night/targets', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            item: itemData,
                            catalogue: catalogueName || itemData.catalogue || currentCatalogueTab
                        })
                    });

                    if (response && response.status === 'success') {
                        showMessage('success', i18n.t('plan_my_night.target_added'));
                        const referenceItem = response.entry || itemData;
                        updateCataloguePlanMyNightBadge(referenceItem, true);
                        updateCataloguePlanMyNightData(referenceItem, true);

                        const planTab = document.getElementById('plan-my-night-subtab');
                        if (planTab && planTab.classList.contains('active')) {
                            await loadPlanMyNight();
                        }
                    }
                } catch (error) {
                    console.error('Error adding to Plan My Night:', error);
                    if (error.message && error.message.includes('Plan belongs to previous night')) {
                        showMessage('warning', tSkyTonightCompat('plan_clear_required'));
                    } else {
                        showMessage('error', i18n.t('plan_my_night.failed_to_add_target'));
                    }
                }
            });
        });

        // Add event listeners for Alttime popup links (avoid inline onclick quoting issues)
        const alttimeLinks = document.querySelectorAll('.alttime-popup-link');
        alttimeLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const parentCell = this.closest('.alttime-check');
                if (!parentCell) {
                    return;
                }
                const title = parentCell.getAttribute('data-title') || 'Target Altitude-Time';
                const targetId = parentCell.getAttribute('data-alttime-id') || '';
                if (!targetId) {
                    return;
                }
                showAlttimePopup(title, targetId);
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

// ======================
// Table Filtering and Sorting
// ======================

function sanitizeFotoFilterValue(value, fallback = 0.8) {
    const numericValue = Number.parseFloat(value);
    if (!Number.isFinite(numericValue)) {
        return String(fallback);
    }

    const clampedValue = Math.min(1, Math.max(0, numericValue));
    return String(clampedValue);
}

// Sync foto filter value across all Report and Bodies tables
function syncFotoValues(value) {
    const safeValue = sanitizeFotoFilterValue(value);
    const fotoInputs = document.querySelectorAll('.shared-foto-value');
    fotoInputs.forEach(input => {
        if (input.value !== safeValue) {
            input.value = safeValue;
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
    const fotoThreshold = fotoValueInput ? parseFloat(sanitizeFotoFilterValue(fotoValueInput.value)) : 0.8;
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
            if (indicator) indicator.classList.remove('bi-caret-up-fill', 'bi-caret-down-fill');
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
        indicator.classList.remove('bi-caret-up-fill', 'bi-caret-down-fill');

        indicator.classList.add(
            sortDirection === 'asc' ? 'bi-caret-up-fill' : 'bi-caret-down-fill',
            'bi'
        );
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
    
    DOMUtils.clear(tbody);
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

function sanitizeImageSource(rawSrc) {
    if (typeof rawSrc !== 'string') {
        return '';
    }

    const src = rawSrc.trim();
    if (!src) {
        return '';
    }

    // Allow only local relative paths and same-origin http(s) URLs.
    // Block javascript:, data:, blob:, and cross-origin URLs.
    try {
        const parsed = new URL(src, window.location.origin);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return '';
        }
        if (parsed.origin !== window.location.origin) {
            return '';
        }
        return parsed.toString();
    } catch (error) {
        return '';
    }
}

// ======================
// Modal Popups
// ======================

function showPlotPopup(title, src) {
    const modalElement = document.getElementById('modal_full_close');
    if (!modalElement) {
        console.error('Modal element not found');
        return;
    }

    const modal = new bootstrap.Modal(modalElement);

    // Title
    const titleElement = document.getElementById('modal_full_close_title');
    if (titleElement) {
        titleElement.textContent = title; // safe
    }

    const bodyElement = document.getElementById('modal_full_close_body');
    if (bodyElement) {
        // Clear existing content safely
        DOMUtils.clear(bodyElement);

        const safeSrc = sanitizeImageSource(src);
        if (!safeSrc) {
            console.error('Invalid image source');
            return;
        }

        const img = document.createElement('img');
        img.id = 'image-display';
        img.src = safeSrc;
        img.alt = 'Plot';
        img.title = title;            // safe
        img.className = 'img-fluid rounded';

        bodyElement.appendChild(img);
    }

    modal.show();
}

// Altitude-time Chart.js instance — stored so it can be destroyed when the modal closes.
let _alttimeChartInstance = null;

function _destroyAlttimeChart() {
    if (_alttimeChartInstance) {
        _alttimeChartInstance.destroy();
        _alttimeChartInstance = null;
    }
}

/**
 * Show altitude vs time chart for a target in a modal popup.
 * Fetches JSON from /api/skytonight/alttime/<targetId>, renders a Chart.js line
 * chart inside a card shell matching the weather-chart style, and destroys the
 * chart instance when the modal is closed.
 *
 * @param {string} title    - Modal title (target name)
 * @param {string} targetId - SkyTonight target_id used to build the API URL
 */
async function showAlttimePopup(title, targetId) {
    const modalElement = document.getElementById('modal_xl_close');
    if (!modalElement) {
        console.error('Alttime modal element not found');
        return;
    }

    const titleElement = document.getElementById('modal_xl_close_title');
    const bodyElement = document.getElementById('modal_xl_close_body');
    if (titleElement) titleElement.textContent = title;
    if (bodyElement) {
        DOMUtils.clear(bodyElement);
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'text-center p-3';
        loadingDiv.textContent = i18n.t('common.loading');
        bodyElement.appendChild(loadingDiv);
    }

    const modal = new bootstrap.Modal(modalElement);

    // Destroy chart when modal is fully hidden to free canvas resources
    const onHidden = () => {
        _destroyAlttimeChart();
        modalElement.removeEventListener('hidden.bs.modal', onHidden);
    };
    modalElement.addEventListener('hidden.bs.modal', onHidden);

    modal.show();

    let data;
    try {
        data = await fetchJSON(`${API_BASE}/api/skytonight/alttime/${encodeURIComponent(targetId)}`);
        if (data && data.error) throw new Error(data.error);
    } catch (err) {
        console.error('Failed to load alttime data:', err);
        if (bodyElement) {
            DOMUtils.clear(bodyElement);
            const errDiv = document.createElement('div');
            errDiv.className = 'alert alert-danger';
            errDiv.textContent = tSkyTonightCompat('altitude_time_load_error');
            bodyElement.appendChild(errDiv);
        }
        return;
    }

    if (!bodyElement) return;
    DOMUtils.clear(bodyElement);

    // Format times in the observatory's configured timezone, not the browser's.
    const obsTz = data.timezone || 'UTC';
    const tzFmt = new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit', timeZone: obsTz, hour12: false });

    // Build time labels from UTC ISO strings, displayed in observatory timezone.
    const times = (data.times_utc || []).map(t => tzFmt.format(new Date(t + 'Z')));
    const altitudes = data.altitudes || [];
    const altMin = data.altitude_constraint_min ?? 30;
    const altMax = data.altitude_constraint_max ?? 80;

    const nightStart = data.night_start ? tzFmt.format(new Date(data.night_start)) : '';
    const nightEnd   = data.night_end   ? tzFmt.format(new Date(data.night_end))   : '';

    // -----------------------------------------------------------------------
    // Build card shell matching the weather-chart style (createChartShell)
    // -----------------------------------------------------------------------
    const card = document.createElement('div');
    card.className = 'card h-100';

    // Card header
    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-header';
    const cardTitle = document.createElement('h5');
    cardTitle.className = 'mb-0';
    cardTitle.innerHTML = `<i class="bi bi-graph-up-arrow icon-inline text-primary" aria-hidden="true"></i>${escapeHtml(title)}`;
    cardHeader.appendChild(cardTitle);

    // Card body — canvas fills the full width, explicit height like weather charts
    const cardBody = document.createElement('div');
    cardBody.className = 'card-body';
    const canvas = document.createElement('canvas');
    canvas.id = 'alttime-chart-canvas';
    canvas.style.width = '100%';
    canvas.style.height = '300px';
    cardBody.appendChild(canvas);

    // Card footer — legend badges + night window info
    const cardFooter = document.createElement('div');
    cardFooter.className = 'card-footer text-muted small';
    const footerRow = document.createElement('div');
    footerRow.className = 'row align-items-center';

    const legendDefs = [
        { color: 'rgba(13, 110, 253, 0.9)',   label: tSkyTonightCompat('altitude_time_altitude_label') || 'Altitude (°)' },
        { color: 'rgba(40, 167, 69, 0.45)',    label: tSkyTonightCompat('altitude_time_observable_zone') },
    ];
    legendDefs.forEach(item => {
        const col = document.createElement('div');
        col.className = 'col-auto';
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.style.backgroundColor = item.color;
        badge.textContent = item.label;
        col.appendChild(badge);
        footerRow.appendChild(col);
    });

    // Night window text
    if (nightStart && nightEnd) {
        const col = document.createElement('div');
        col.className = 'col-auto ms-auto';
        const span = document.createElement('span');
        span.className = 'text-muted';
        span.textContent = `${tSkyTonightCompat('altitude_time_night_window')}: ${nightStart} – ${nightEnd}`;
        col.appendChild(span);
        footerRow.appendChild(col);
    }

    cardFooter.appendChild(footerRow);
    card.appendChild(cardHeader);
    card.appendChild(cardBody);
    card.appendChild(cardFooter);
    bodyElement.appendChild(card);

    // -----------------------------------------------------------------------
    // Render chart
    // -----------------------------------------------------------------------
    _destroyAlttimeChart();

    const constraintBand  = altitudes.map(() => altMax);
    const constraintFloor = altitudes.map(() => altMin);

    const ctx2d = canvas.getContext('2d');
    _alttimeChartInstance = new Chart(ctx2d, {
        type: 'line',
        data: {
            labels: times,
            datasets: [
                {
                    // Top of observable zone (filled down to floor dataset)
                    label: tSkyTonightCompat('altitude_time_observable_zone'),
                    data: constraintBand,
                    fill: '-1',
                    backgroundColor: 'rgba(40, 167, 69, 0.10)',
                    borderColor: 'rgba(40, 167, 69, 0.35)',
                    borderWidth: 1,
                    borderDash: [4, 4],
                    pointRadius: 0,
                    tension: 0,
                    order: 3,
                },
                {
                    // Bottom of observable zone
                    label: `${altMin}° (min)`,
                    data: constraintFloor,
                    fill: false,
                    borderColor: 'rgba(40, 167, 69, 0.35)',
                    borderWidth: 1,
                    borderDash: [4, 4],
                    pointRadius: 0,
                    tension: 0,
                    order: 3,
                },
                {
                    label: tSkyTonightCompat('altitude_time_altitude_label') || 'Altitude (°)',
                    data: altitudes,
                    fill: false,
                    borderColor: 'rgba(13, 110, 253, 0.9)',
                    backgroundColor: 'rgba(13, 110, 253, 0.15)',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.4,
                    order: 1,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            resizeDelay: 200,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: ctx => {
                            const label = ctx.dataset.label || '';
                            return `${label}: ${Number(ctx.raw).toFixed(1)}°`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    ticks: { maxTicksLimit: 12, maxRotation: 0 },
                    title: { display: true, text: tSkyTonightCompat('altitude_time_x_axis') || 'Time (UTC)' },
                },
                y: {
                    min: 0,
                    max: 90,
                    ticks: { stepSize: 15 },
                    title: { display: true, text: tSkyTonightCompat('altitude_time_y_axis') || 'Altitude (°)' },
                },
            },
        },
    });
}

function showMorePopup(popupId) {
    const popup = document.getElementById(popupId);
    
    if (popup) {
        // Use BS modal
        //Prepare modal title
        const titleElement = document.getElementById('modal_lg_close_title');
        titleElement.textContent = tSkyTonightCompat('more_info');
        
        //Prepare modal content
        const contentElement = document.getElementById('modal_lg_close_body');
        DOMUtils.clear(contentElement);
        Array.from(popup.childNodes).forEach((node) => {
            contentElement.appendChild(node.cloneNode(true));
        });

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

// ======================
// Astrodex Integration
// ======================

/**
 * Update the "Captured" badges in catalogue tables after Astrodex changes
 * @param {string} itemName - Name of the item to update
 * @param {boolean} isInAstrodex - Whether the item is now in Astrodex
 */
async function updateCatalogueCapturedBadge(itemDataOrName, isInAstrodex) {
    if (!itemDataOrName) return;

    const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

    const targetNames = new Set();
    if (typeof itemDataOrName === 'string') {
        targetNames.add(normalize(itemDataOrName));
    } else {
        targetNames.add(normalize(itemDataOrName.name || itemDataOrName['target name'] || itemDataOrName.id));
        const aliases = itemDataOrName.catalogue_aliases;
        if (aliases && typeof aliases === 'object') {
            Object.values(aliases).forEach(name => targetNames.add(normalize(name)));
        }
    }
    targetNames.delete('');
    if (targetNames.size === 0) return;
    
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

            const rawItem = astrodexCell.getAttribute('data-item');
            if (!rawItem) return;

            let rowItemData = null;
            try {
                rowItemData = JSON.parse(rawItem.replace(/&quot;/g, '"'));
            } catch (error) {
                return;
            }

            const rowItemName = rowItemData.name || rowItemData['target name'] || rowItemData.id;
            const rowNormalizedName = normalize(rowItemName);
            if (!targetNames.has(rowNormalizedName)) return;
            
            if (isInAstrodex) {
                DOMUtils.clear(astrodexCell);
                const badge = document.createElement('span');
                badge.className = 'in-astrodex-badge';
                badge.innerHTML = `<i class="bi bi-check-circle-fill icon-inline" aria-hidden="true"></i>${tSkyTonightCompat('captured')}`;
                astrodexCell.appendChild(badge);
            } else {
                const itemDataJson = JSON.stringify(rowItemData);
                DOMUtils.clear(astrodexCell);
                const addButton = document.createElement('button');
                addButton.className = 'btn btn-sm btn-outline-primary astrodex-add-btn';
                addButton.setAttribute('data-item', itemDataJson);
                addButton.innerHTML = `<i class="bi bi-plus-circle icon-inline" aria-hidden="true"></i>${tSkyTonightCompat('add')}`;
                astrodexCell.appendChild(addButton);
            }
        });
    });
}

/**
 * Update the "Planned" badges in catalogue tables after Plan My Night changes
 * @param {object|string} itemDataOrName - Item payload or item name
 * @param {boolean} isPlanned - Whether the item is now in Plan My Night
 */
function updateCataloguePlanMyNightBadge(itemDataOrName, isPlanned) {
    if (!itemDataOrName) return;

    const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

    const targetNames = new Set();
    if (typeof itemDataOrName === 'string') {
        targetNames.add(normalize(itemDataOrName));
    } else {
        targetNames.add(normalize(itemDataOrName.name || itemDataOrName['target name'] || itemDataOrName.id));
        const aliases = itemDataOrName.catalogue_aliases;
        if (aliases && typeof aliases === 'object') {
            Object.values(aliases).forEach(name => targetNames.add(normalize(name)));
        }
    }
    targetNames.delete('');
    if (targetNames.size === 0) return;

    const tables = document.querySelectorAll('table[id^="table-"]');

    tables.forEach(table => {
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const planCell = Array.from(row.cells).find(cell => {
                const badge = cell.querySelector('.in-plan-my-night-badge');
                const button = cell.querySelector('.plan-my-night-add-btn');
                return badge || button;
            });

            if (!planCell) return;

            const rawItem = planCell.getAttribute('data-item');
            if (!rawItem) return;

            let rowItemData = null;
            try {
                rowItemData = JSON.parse(rawItem.replace(/&quot;/g, '"'));
            } catch (error) {
                return;
            }

            const rowItemName = rowItemData.name || rowItemData['target name'] || rowItemData.id;
            const rowNames = new Set([normalize(rowItemName)]);
            const rowAliases = rowItemData.catalogue_aliases;
            if (rowAliases && typeof rowAliases === 'object') {
                Object.values(rowAliases).forEach(name => rowNames.add(normalize(name)));
            }

            const hasMatch = Array.from(rowNames).some(name => name && targetNames.has(name));
            if (!hasMatch) return;

            if (isPlanned) {
                DOMUtils.clear(planCell);
                const badge = document.createElement('span');
                badge.className = 'in-astrodex-badge in-plan-my-night-badge';
                badge.innerHTML = `<i class="bi bi-check-circle-fill icon-inline" aria-hidden="true"></i>${tSkyTonightCompat('planned')}`;
                planCell.appendChild(badge);
            } else {
                const itemDataJson = JSON.stringify(rowItemData);
                DOMUtils.clear(planCell);
                const addButton = document.createElement('button');
                addButton.className = 'btn btn-sm btn-outline-info plan-my-night-add-btn';
                addButton.setAttribute('data-item', itemDataJson);
                addButton.setAttribute('data-catalogue', rowItemData.catalogue || currentCatalogueTab || '');
                addButton.innerHTML = `<i class="bi bi-moon-stars-fill icon-inline" aria-hidden="true"></i>${tSkyTonightCompat('add')}`;
                planCell.appendChild(addButton);
            }
        });
    });
}

/**
 * Keep cached catalogue reports synchronized after Plan My Night mutations.
 * This avoids stale "Add" buttons when switching catalogue/type tabs.
 */
function updateCataloguePlanMyNightData(itemDataOrName, isPlanned) {
    if (!window.catalogueReports || !itemDataOrName) return;

    const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

    const targetNames = new Set();
    if (typeof itemDataOrName === 'string') {
        targetNames.add(normalize(itemDataOrName));
    } else {
        targetNames.add(normalize(itemDataOrName.name || itemDataOrName['target name'] || itemDataOrName.id));
        const aliases = itemDataOrName.catalogue_aliases;
        if (aliases && typeof aliases === 'object') {
            Object.values(aliases).forEach(name => targetNames.add(normalize(name)));
        }
    }
    targetNames.delete('');
    if (targetNames.size === 0) return;

    Object.keys(window.catalogueReports).forEach(catalogue => {
        const reportPayload = window.catalogueReports[catalogue];
        if (!reportPayload || typeof reportPayload !== 'object') return;

        ['report', 'bodies', 'comets'].forEach(key => {
            const rows = reportPayload[key];
            if (!Array.isArray(rows)) return;

            rows.forEach(row => {
                const rowItemName = row.id || row['target name'] || row.name;
                const rowNames = new Set([normalize(rowItemName)]);
                const rowAliases = row.catalogue_aliases;
                if (rowAliases && typeof rowAliases === 'object') {
                    Object.values(rowAliases).forEach(name => rowNames.add(normalize(name)));
                }

                const hasMatch = Array.from(rowNames).some(name => name && targetNames.has(name));
                if (!hasMatch) return;

                row.in_plan_my_night = isPlanned;
                if (isPlanned) {
                    row.plan_state = 'current';
                }
            });
        });
    });
}

// ======================
// Log Management
// ======================

async function loadSkytonightLog() {
    try {
        const result = await fetchJSON('/api/skytonight/log');
        return result.log_content;
    } catch (error) {
        console.error('Error loading SkyTonight log file:', error);
        return null;
    }
}

// ======================
// Report Management
// ======================

