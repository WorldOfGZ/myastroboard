// UpTonight Results Display and Management

let catalogueResults = {};
let currentCatalogueTab = ''; // Track current catalogue for Astrodex integration

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
// UpTonight Results Tabs
// ======================

//Load uptonight results tabs
async function loadUptonightResultsTabs() {
    try {
        const outputs = await fetchJSON('/api/uptonight/outputs');
        
        const subtabsContainer = document.getElementById('uptonight-subtabs');
        let  eltFirstTab = -1; // Index of the first tab to activate by default

        DOMUtils.clear(subtabsContainer);
        
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
            subtabsContainer.textContent = i18n.t('uptonight.no_data_available');
        }
        
        // Create content divs for catalogue tabs
        const uptontightTab = document.getElementById('uptonight-tab');
        
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
                    title.innerHTML = `<i class="bi bi-journal-bookmark text-success icon-inline" aria-hidden="true"></i>${i18n.t('uptonight.catalogue_results', {catalogue: output.target})}`;
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
                    uptontightTab.appendChild(div);
                    
                    // Load catalogue data
                    loadCatalogueResults(output.target);
                }
            });
        }

        // Activate first available subtab once DOM is ready
        requestAnimationFrame(() => {
            if (outputs && outputs.length > 0) {
                //Get data-subtab value of the first subtab button
                const firstSubTabBtn = document.querySelector('#uptonight-subtabs > li:nth-child(1) > a');
                const firstSubTab = firstSubTabBtn ? firstSubTabBtn.getAttribute('data-subtab') : null;
                //console.log(`Activating first subtab: ${firstSubTab}`);
                activateSubTab('uptonight', firstSubTab);

                //console.log(`Activating first subtab: catalogue-${outputs[eltFirstTab].target}`);
                //activateSubTab('uptonight', `catalogue-${outputs[eltFirstTab].target}`);
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
            buttonItems.push({ type: 'plot', label: `<i class="bi bi-bar-chart-line text-success icon-inline" aria-hidden="true"></i>${i18n.t('uptonight.plot')}`, active: !firstType });
            if (!firstType) firstType = 'plot';
        }
        if (hasReport) {
            buttonItems.push({ type: 'report', label: `<i class="bi bi-galaxy icon-inline" aria-hidden="true"></i>${i18n.t('uptonight.deep_sky_objects')}`, active: !firstType });
            if (!firstType) firstType = 'report';
        }
        if (hasBodies) {
            buttonItems.push({ type: 'bodies', label: `<i class="bi bi-globe2 text-warning icon-inline" aria-hidden="true"></i>${i18n.t('uptonight.bodies')}`, active: !firstType });
            if (!firstType) firstType = 'bodies';
        }
        if (hasComets) {
            buttonItems.push({ type: 'comets', label: `<i class="bi bi-comet text-warning icon-inline" aria-hidden="true"></i>${i18n.t('uptonight.comets')}`, active: !firstType });
            if (!firstType) firstType = 'comets';
        }
        
        // Check if log file exists and add log button
        // Check if report files exist and add reports button  
        Promise.all([
            checkCatalogueLogExists(catalogue),
            checkCatalogueReportsAvailable(catalogue)
        ]).then(([logExists, reportsAvailable]) => {
            const enrichedButtons = [...buttonItems.map((button, index) => ({ ...button, active: index === 0 }))];
            if (logExists) {
                enrichedButtons.push({ type: 'log', label: `<i class="bi bi-journal-text text-danger icon-inline" aria-hidden="true"></i>${i18n.t('uptonight.logs')}`, active: false });
            }
            if (reportsAvailable && reportsAvailable.has_any) {
                enrichedButtons.push({ type: 'reports', label: `<i class="bi bi-journal-code icon-inline" aria-hidden="true"></i>${i18n.t('uptonight.reports')}`, active: false });
            }
            renderButtons(enrichedButtons);
            
            // Store reports availability for later use
            if (reportsAvailable) {
                window.catalogueReportsAvailability = window.catalogueReportsAvailability || {};
                window.catalogueReportsAvailability[catalogue] = reportsAvailable.available;
            }
        });

        renderButtons(buttonItems);
        
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
        DOMUtils.clear(container);
        const alert = document.createElement('div');
        alert.className = 'alert alert-danger';
        alert.textContent = i18n.t('uptonight.failed_to_load_catalogue_results');
        container.appendChild(alert);
    }
}

async function showCatalogueType(catalogue, type) {
           
    // Get role user
    const roleUser = await getUserRole();
    // Display Astrodex if roleUser is user or admin
    const displayAstrodex = roleUser === 'user' || roleUser === 'admin';

    const reports = window.catalogueReports[catalogue];
    if (!reports) return;

    // Update active button
    const buttons = document.querySelectorAll(`#catalogue-${catalogue}-type-buttons .catalogue-type-btn`);
    buttons.forEach(btn => {
        btn.classList.remove('active');
        let btnType = '';
        switch(type) {
            case 'plot': btnType = i18n.t('uptonight.plot'); break;
            case 'report': btnType = i18n.t('uptonight.deep_sky_objects'); break;
            case 'bodies': btnType = i18n.t('uptonight.bodies'); break;
            case 'comets': btnType = i18n.t('uptonight.comets'); break;
            case 'log': btnType = i18n.t('uptonight.logs'); break;
            case 'reports': btnType = i18n.t('uptonight.reports'); break;
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
        img.src = `${API_BASE}/api/uptonight/outputs/${encodeURIComponent(catalogue)}/uptonight-plot.png`;
        img.alt = `${catalogue} plot`;
        img.className = 'img-fluid rounded';
        img.onclick = () => showPlotPopup(`${catalogue} Plot`, img.src);

        const info = document.createElement('div');
        info.className = 'text-muted small mt-2';
        info.append(i18n.t('uptonight.uptonight_credit') + ' ');
        const link = document.createElement('a');
        link.href = 'https://github.com/mawinkler/uptonight';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'mawinkler/uptonight';
        info.appendChild(link);
        info.append('.');

        plotDiv.appendChild(img);
        plotDiv.appendChild(info);
        container.appendChild(plotDiv);
        return;
    }

    // --- Log ---
    if (type === 'log') {
        const loading = document.createElement('div');
        loading.className = 'loading';
        loading.textContent = i18n.t('uptonight.loading_log_content');
        container.appendChild(loading);

        loadCatalogueLog(catalogue).then(logContent => {
            DOMUtils.clear(container);
            const logContainer = document.createElement('div');
            logContainer.className = 'logs-container mt-3 rounded';

            if (logContent) {
                const pre = document.createElement('pre');
                pre.textContent = logContent; // safe
                logContainer.appendChild(pre);
            } else {
                const error = document.createElement('div');
                error.className = 'error-box';
                error.textContent = i18n.t('uptonight.failed_to_load_log_content');
                logContainer.appendChild(error);
            }

            container.appendChild(logContainer);
        });
        return;
    }

    // --- Reports ---
    if (type === 'reports') {
        const availability = window.catalogueReportsAvailability?.[catalogue] || {};
        const dropdownOptions = [];
        if (availability.general) dropdownOptions.push(['general', 'General']);
        if (availability.bodies) dropdownOptions.push(['bodies', 'Bodies']);
        if (availability.comets) dropdownOptions.push(['comets', 'Comets']);

        if (!dropdownOptions.length) {
            const alert = document.createElement('div');
            alert.className = 'alert alert-info mt-3';
            alert.textContent = i18n.t('uptonight.no_report_available');
            container.appendChild(alert);
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'mt-3';

        const selectDiv = document.createElement('div');
        selectDiv.className = 'mb-3';

        const label = document.createElement('label');
        label.className = 'form-label';
        label.setAttribute('for', `report-selector-${catalogue}`);
        label.textContent = i18n.t('uptonight.select_report_type');
        selectDiv.appendChild(label);

        const select = document.createElement('select');
        select.className = 'form-select';
        select.id = `report-selector-${catalogue}`;
        select.onchange = () => loadSelectedReport(catalogue, select.value);

        dropdownOptions.forEach(([val, text]) => {
            const option = document.createElement('option');
            option.value = val;
            option.textContent = text;
            select.appendChild(option);
        });

        selectDiv.appendChild(select);
        wrapper.appendChild(selectDiv);

        const reportContent = document.createElement('div');
        reportContent.id = `report-content-${catalogue}`;
        reportContent.className = 'logs-container rounded';

        const loading = document.createElement('div');
        loading.className = 'loading';
        loading.textContent = i18n.t('uptonight.loading_report_content');
        reportContent.appendChild(loading);

        wrapper.appendChild(reportContent);
        container.appendChild(wrapper);

        const firstReportType = availability.general ? 'general' : (availability.bodies ? 'bodies' : 'comets');
        loadSelectedReport(catalogue, firstReportType);
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
        p.textContent = i18n.t('uptonight.failed_to_load_report_content');
        container.appendChild(p);
    }
}

// ======================
// Report Table Generation
// ======================

function generateReportTable(report, catalogue, type, displayAstrodex = true) {
    if (!report || report.length === 0) return `<p>${i18n.t('uptonight.no_target_in_report')}</p>`;
    
    // Define column order and configuration for Report type
    const reportColumns = [
        { key: 'id', label: i18n.t('uptonight.table_id'), align: 'left' },
        { key: 'target name', label: i18n.t('uptonight.table_name'), align: 'left' },
        { key: 'size', label: i18n.t('uptonight.table_size'), align: 'center', unit: "'" },
        { key: 'foto', label: i18n.t('uptonight.table_foto'), align: 'center' },
        { key: 'mag', label: i18n.t('uptonight.table_mag'), align: 'center' },
        { key: 'constellation', label: i18n.t('uptonight.table_constellation'), align: 'center' },
        { key: 'type', label: i18n.t('uptonight.table_type'), align: 'center' },
        { key: 'altitude', label: i18n.t('uptonight.table_altitude'), align: 'center', unit: '°', decimals: 2 },
        { key: 'azimuth', label: i18n.t('uptonight.table_azimuth'), align: 'center', unit: '°', decimals: 2 },
        ...(displayAstrodex ? [{ key: 'astrodex', label: i18n.t('uptonight.table_astrodex'), align: 'center' }] : []),
        { key: 'more', label: i18n.t('uptonight.table_more'), align: 'center' }
    ];
    
    // Define column order and configuration for Bodies type
    const bodiesColumns = [
        { key: 'target name', label: i18n.t('uptonight.table_name'), align: 'left' },
        { key: 'altitude', label: i18n.t('uptonight.table_altitude'), align: 'center', unit: '°', decimals: 2 },
        { key: 'azimuth', label: i18n.t('uptonight.table_azimuth'), align: 'center', unit: '°', decimals: 2 },
        { key: 'max altitude time', label: i18n.t('uptonight.table_max_altitude_time'), align: 'center' },
        { key: 'visual magnitude', label: i18n.t('uptonight.table_visual_magnitude'), align: 'center', decimals: 2 },
        { key: 'foto', label: i18n.t('uptonight.table_foto'), align: 'center' },
        { key: 'type', label: i18n.t('uptonight.table_type'), align: 'center' },
        ...(displayAstrodex ? [{ key: 'astrodex', label: i18n.t('uptonight.table_astrodex'), align: 'center' }] : []),
        { key: 'more', label: i18n.t('uptonight.table_more'), align: 'center' }
    ];
    
    // Define column order and configuration for Comets type
    const cometsColumns = [
        { key: 'target name', label: i18n.t('uptonight.table_name'), align: 'left' },
        { key: 'altitude', label: i18n.t('uptonight.table_altitude'), align: 'center', unit: '°', decimals: 2 },
        { key: 'azimuth', label: i18n.t('uptonight.table_azimuth'), align: 'center', unit: '°', decimals: 2 },
        { key: 'visual magnitude', label: i18n.t('uptonight.table_visual_magnitude'), align: 'center', decimals: 2 },
        { key: 'distance earth au', label: i18n.t('uptonight.table_distance_earth'), align: 'center', unit: ' au', decimals: 2 },
        ...(displayAstrodex ? [{ key: 'astrodex', label: i18n.t('uptonight.table_astrodex'), align: 'center' }] : []),
        { key: 'more', label: i18n.t('uptonight.table_more'), align: 'center' }
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
                <label for="filter-${catalogue}-${type}" class="visually-hidden">${i18n.t('uptonight.search')}</label>
                <input type="text" id="filter-${catalogue}-${type}" placeholder="${i18n.t('uptonight.search_placeholder')}" class="filter-input form-control">
            </div>`;
    
    // Only show foto filter for report and bodies types, not for comets
    // Use shared foto value from localStorage or default to 0.8
    if (type !== 'comets') {
        const savedFotoValue = sanitizeFotoFilterValue(localStorage.getItem('fotoFilterValue'));
        html += `
            <div class="col-12">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="foto-filter-${catalogue}-${type}">
                    <label class="form-check-label" for="inlineFormCheck"> ${i18n.t('uptonight.search_foto')} </label>
                </div>               
            </div>`;
        
        html += `
            <div class="col-12">
                <label for="foto-value-${catalogue}-${type}" class="visually-hidden">${i18n.t('uptonight.search_foto_score')}</label>
                <input type="number" id="foto-value-${catalogue}-${type}" value="${savedFotoValue}" step="0.1" min="0" max="1" class="shared-foto-value form-control">
            </div>`;
    }
    
    // Add constellation filter if constellation field exists
    if (constellations.length > 0) {
        html += `
            <div class="col-12">
                <label class="visually-hidden" for="constellation-filter-${catalogue}-${type}">${i18n.t('uptonight.search_constellations')}</label>
                <select class="form-select filter-select" id="constellation-filter-${catalogue}-${type}">
                    <option value="">${i18n.t('uptonight.search_all_constellations')}</option>`;
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
                <label class="visually-hidden" for="type-filter-${catalogue}-${type}">${i18n.t('uptonight.search_types')}</label>
                <select id="type-filter-${catalogue}-${type}" class="form-select filter-select">
                    <option value="">${i18n.t('uptonight.search_all_types')}</option>`;
        types.forEach(t => {
            let label_t = t;
            let translationKey = 'uptonight.type_' + strToTranslateKey(label_t);
            if (i18n.has(translationKey)) {
                label_t = i18n.t(translationKey);
            } else { 
                console.warn(`Translation key not found: ${translationKey}`);
            }

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
                html += `<td style="text-align: ${col.align}"><a href="#" onclick="showMorePopup('${popupId}'); return false;" class="link-underline link-underline-opacity-0"><i class="bi bi-clipboard-data icon-inline" aria-hidden="true"></i>${i18n.t('uptonight.table_more')}</a></td>`;
            } else if (col.key === 'astrodex') {
                // Generate Astrodex action button
                const itemName = row['id'] || row['target name'];
                const isInAstrodex = row['in_astrodex'] || false;
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
                
                if(displayAstrodex) {
                    if (isInAstrodex) {
                        html += `<td style="text-align: ${col.align}" data-item="${itemDataJson}"><span class="in-astrodex-badge"><i class="bi bi-check-circle-fill icon-inline" aria-hidden="true"></i>${i18n.t('uptonight.captured')}</span></td>`;
                    } else if (itemName) {
                        html += `<td style="text-align: ${col.align}" data-item="${itemDataJson}"><button class="btn btn-sm btn-outline-primary astrodex-add-btn" data-item="${itemDataJson}"><i class="bi bi-plus-circle icon-inline" aria-hidden="true"></i>${i18n.t('uptonight.add')}</button></td>`;
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
                    // If translation exists
                    let translationKey = 'uptonight.type_' + strToTranslateKey(value);
                    if (i18n.has(translationKey)) {
                        value = i18n.t(translationKey);
                    } 
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
                    let labelTranslations = strToTranslateKey(label);
                    if (i18n.has(`uptonight.${labelTranslations}`)) {
                        label = i18n.t(`uptonight.${labelTranslations}`);
                    } else {
                        console.warn(`Missing translation for: uptonight.${labelTranslations}`);
                    }
                    let displayValue = String(value);
                    
                    // Apply special formatting for comets fields
                    if (type === 'comets') {
                        if (field === 'absolute magnitude' && !isNaN(value)) {
                            displayValue = parseFloat(value).toFixed(2);
                        } else if (field === 'distance sun au' && !isNaN(value)) {
                            label = i18n.t('uptonight.distance_sun');
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
                    showMessage('error', i18n.t('uptonight.failed_to_add_astrodex'));
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

        const img = document.createElement('img');
        img.id = 'image-display';
        img.src = src;                // property assignment = safe
        img.alt = 'Plot';
        img.title = title;            // safe
        img.className = 'img-fluid rounded';

        bodyElement.appendChild(img);
    }

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
        // Clear existing content safely
        DOMUtils.clear(bodyElement);

        const img = document.createElement('img');
        img.id = 'image-display';
        img.src = src;                // property assignment = safe
        img.alt = 'Altitude-Time Plot';
        img.title = title;            // safe
        img.className = 'img-fluid rounded';

        bodyElement.appendChild(img);
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
        titleElement.textContent = i18n.t('uptonight.more_info');
        
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
                badge.innerHTML = `<i class="bi bi-check-circle-fill icon-inline" aria-hidden="true"></i>${i18n.t('uptonight.captured')}`;
                astrodexCell.appendChild(badge);
            } else {
                const itemDataJson = JSON.stringify(rowItemData);
                DOMUtils.clear(astrodexCell);
                const addButton = document.createElement('button');
                addButton.className = 'btn btn-sm btn-outline-primary astrodex-add-btn';
                addButton.setAttribute('data-item', itemDataJson);
                addButton.innerHTML = `<i class="bi bi-plus-circle icon-inline" aria-hidden="true"></i>${i18n.t('uptonight.add')}`;
                astrodexCell.appendChild(addButton);
            }
        });
    });
}

// ======================
// Log Management
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
// Report Management
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

        DOMUtils.clear(contentDiv);
        
        const loading = document.createElement('div');
        loading.className = 'loading';
        loading.textContent = i18n.t('uptonight.loading_report_content');
        contentDiv.appendChild(loading);

        const result = await fetchJSON(`/api/uptonight/reports/${catalogue}/${reportType}`);

        DOMUtils.clear(contentDiv);

        if (result && result.report_content) {
            const pre = document.createElement('pre');
            pre.textContent = result.report_content; // SAFE
            contentDiv.appendChild(pre);
        } else {
            const alert = document.createElement('div');
            alert.className = 'alert alert-warning';
            alert.textContent = i18n.t('uptonight.report_empty');
            contentDiv.appendChild(alert);
        }

    } catch (error) {
        console.error('Error loading report:', error);
        const contentDiv = document.getElementById(`report-content-${catalogue}`);
        if (contentDiv) {
            DOMUtils.clear(contentDiv);
            const alert = document.createElement('div');
            alert.className = 'alert alert-danger';
            alert.textContent = i18n.t('uptonight.failed_to_load_report_content');
            contentDiv.appendChild(alert);
        }
    }
}
