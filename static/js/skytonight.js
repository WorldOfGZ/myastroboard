// SkyTonight Results Display and Management

let catalogueResults = {};
let currentCatalogueTab = 'SkyTonight'; // Always 'SkyTonight' in the new single-section layout
let skytonightDisplayAstrodexCache = null;
let skytonightDisplayAstrodexPromise = null;
let _skytCurrentSection = 'plot'; // Active section: 'plot' | 'report' | 'bodies' | 'comets' | 'log'
let _skytSectionCache = {};       // Cached response per section key

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
// Interactive Sky Map (Plotly scatterpolar)
// ======================

/**
 * Render an interactive polar sky-dome chart into `container`.
 *
 * Coordinate mapping:
 *   r     = 90 - altitude  →  centre = zenith (alt 90°), edge = horizon (alt 0°)
 *   theta = azimuth (CW from N)  →  N at top, E at right, matching compass convention
 *
 * All targets (DSOs, bodies, comets) are plotted at their peak-altitude position
 * for tonight, sized by AstroScore and coloured by object type.
 */
async function _renderSkyMap(reports, container) {
    DOMUtils.clear(container);

    if (typeof Plotly === 'undefined') {
        const w = document.createElement('div');
        w.className = 'alert alert-warning mt-3';
        w.textContent = tSkyTonightCompat('no_data_available');
        container.appendChild(w);
        return;
    }

    // ── fetch trajectory data from backend ───────────────────────────────────
    let skymap;
    try {
        skymap = await fetchJSON('/api/skytonight/skymap');
    } catch (_) {
        const err = document.createElement('div');
        err.className = 'alert alert-danger mt-3';
        err.textContent = tSkyTonightCompat('no_data_available');
        container.appendChild(err);
        return;
    }

    const targets = (skymap && skymap.targets) || [];
    if (targets.length === 0) {
        const info = document.createElement('div');
        info.className = 'alert alert-info mt-3';
        info.textContent = tSkyTonightCompat('no_data_available');
        container.appendChild(info);
        return;
    }

    // ── colour palette (cycling) ────────────────────────────────────────────
    const PALETTE = [
        '#4dabf7','#ffd43b','#51cf66','#ff8c00','#f783ac',
        '#a9e34b','#74c0fc','#ff6b6b','#cc5de8','#20c997',
        '#fd7e14','#748ffc','#e599f7','#94d82d','#63e6be',
        '#ff922b','#339af0','#f06595','#a9e34b','#845ef7',
    ];

    // ── category → marker symbol for the numbered start dot ─────────────────
    const CAT_SYMBOL = {
        'Galaxy': 'circle',
        'Nebula': 'diamond',
        'Planetary Nebula': 'diamond',
        'Star Cluster': 'square',
        'Open Cluster': 'square',
        'Globular Cluster': 'circle',
    };

    // ── theme ────────────────────────────────────────────────────────────────
    const isDark  = document.documentElement.getAttribute('data-bs-theme') !== 'light';
    const skyBg   = isDark ? '#07101f' : '#d9eaf7';
    const gridClr = isDark ? 'rgba(180,210,255,0.12)' : 'rgba(40,60,120,0.15)';
    const tickClr = isDark ? '#9ab0cc' : '#334466';

    // ── build traces, keeping an index map per target ────────────────────────
    const traces = [];
    const traceMap = []; // [{arcIdx, dotIdx, target}] in same order as targets[]

    targets.forEach((tgt, i) => {
        const color    = PALETTE[i % PALETTE.length];
        const alt      = tgt.alt;
        const az       = tgt.az;
        const label    = String(tgt.n);
        const scoreStr = tgt.score != null ? (tgt.score * 100).toFixed(0) + '%' : '—';
        const tooltip  = `<b>${label}: ${escapeHtml(tgt.name)}</b><br>` +
                         `${escapeHtml(tgt.type || tgt.category)}<br>` +
                         `AstroScore: ${scoreStr}<br>` +
                         (tgt.constellation ? `${escapeHtml(tgt.constellation)}<br>` : '');

        const r     = alt.map(a => Math.max(0, 90 - a));
        const theta = az;

        const arcIdx = traces.length;
        traces.push({
            type: 'scatterpolar', mode: 'lines',
            name: `${label}: ${tgt.name}`,
            r, theta,
            line: { color, width: 1.8 },
            hoverinfo: 'skip',
            showlegend: false,
        });

        const dotSymbol = CAT_SYMBOL[tgt.type] || (tgt.category === 'bodies' ? 'star' : 'x');
        const dotIdx = traces.length;
        traces.push({
            type: 'scatterpolar', mode: 'markers+text',
            name: `${label}: ${tgt.name}`,
            r: [r[0]], theta: [theta[0]],
            text: [label],
            textposition: 'top center',
            textfont: { color, size: 9 },
            hovertext: [tooltip],
            hoverinfo: 'text',
            marker: {
                symbol: dotSymbol, color, size: 8, opacity: 0.95,
                line: { color: isDark ? '#111' : '#fff', width: 1 },
            },
            showlegend: false,
        });

        traceMap.push({ arcIdx, dotIdx, target: tgt });
    });

    // ── Plotly layout ─────────────────────────────────────────────────────────
    const plotLayout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor:  'rgba(0,0,0,0)',
        height: 480,
        polar: {
            bgcolor: skyBg,
            radialaxis: {
                range: [0, 90],
                tickvals:  [0, 30, 60, 90],
                ticktext:  ['90°', '60°', '30°', '0°'],
                tickfont:  { size: 9, color: tickClr },
                gridcolor: gridClr, linecolor: gridClr, showline: true,
            },
            angularaxis: {
                direction: 'clockwise', rotation: 90,
                tickvals:  [0, 45, 90, 135, 180, 225, 270, 315],
                ticktext:  ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
                tickfont:  { size: 11, color: tickClr },
                gridcolor: gridClr,
            },
        },
        showlegend: false,
        margin: { t: 10, r: 10, b: 10, l: 10 },
        font:   { color: tickClr },
    };

    const plotConfig = {
        responsive:             true,
        displaylogo:            false,
        modeBarButtonsToRemove: ['sendDataToCloud', 'toImage'],
    };

    // ── DOM: outer row ────────────────────────────────────────────────────────
    const row = document.createElement('div');
    row.className = 'row g-3 mt-1';
    container.appendChild(row);

    // ── Left column: chart card ───────────────────────────────────────────────
    const colChart = document.createElement('div');
    colChart.className = 'col-12 col-xl-8';
    row.appendChild(colChart);

    const chartCard = document.createElement('div');
    chartCard.className = 'card h-100';
    colChart.appendChild(chartCard);

    const chartHeader = document.createElement('div');
    chartHeader.className = 'card-header d-flex justify-content-between align-items-center';

    const chartTitle = document.createElement('span');
    chartTitle.className = 'fw-semibold';
    chartTitle.innerHTML = `<i class="bi bi-globe2 icon-inline" aria-hidden="true"></i>${tSkyTonightCompat('sky_map_title')}`;

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'btn btn-sm btn-outline-secondary';
    resetBtn.innerHTML = `<i class="bi bi-arrows-fullscreen icon-inline" aria-hidden="true"></i>${tSkyTonightCompat('sky_map_reset_view')}`;

    chartHeader.appendChild(chartTitle);
    chartHeader.appendChild(resetBtn);
    chartCard.appendChild(chartHeader);

    const chartBody = document.createElement('div');
    chartBody.className = 'card-body p-2';
    chartCard.appendChild(chartBody);

    const hint = document.createElement('div');
    hint.className = 'text-muted small mb-2';
    hint.innerHTML = `<i class="bi bi-info-circle icon-inline" aria-hidden="true"></i>${tSkyTonightCompat('sky_map_hint')}`;
    chartBody.appendChild(hint);

    const mapDiv = document.createElement('div');
    mapDiv.className = 'sky-map-plotly';
    chartBody.appendChild(mapDiv);

    Plotly.newPlot(mapDiv, traces, plotLayout, plotConfig);

    resetBtn.addEventListener('click', () => {
        Plotly.relayout(mapDiv, {
            'polar.radialaxis.range': [0, 90],
            'polar.radialaxis.autorange': false,
        });
    });

    const ro = new ResizeObserver(() => Plotly.Plots.resize(mapDiv));
    ro.observe(mapDiv);

    // ── Right column: filters + legend card ──────────────────────────────────
    const colLegend = document.createElement('div');
    colLegend.className = 'col-12 col-xl-4';
    row.appendChild(colLegend);

    const legendCard = document.createElement('div');
    legendCard.className = 'card h-100';
    colLegend.appendChild(legendCard);

    const legendHeader = document.createElement('div');
    legendHeader.className = 'card-header fw-semibold';
    legendHeader.innerHTML = `<i class="bi bi-funnel icon-inline" aria-hidden="true"></i>${tSkyTonightCompat('sky_map_legend_title')}`;
    legendCard.appendChild(legendHeader);

    const legendBody = document.createElement('div');
    legendBody.className = 'card-body p-2';
    legendCard.appendChild(legendBody);

    // ── Filter state ──────────────────────────────────────────────────────────
    const activeCategories = new Set(['deep_sky', 'bodies', 'comets']);
    let minScore = 0.65;
    let messierOnly = false;
    const allConstellations = [...new Set(
        targets.map(t => t.constellation).filter(c => c && c.trim())
    )].sort();
    const activeConstellations = new Set(allConstellations);

    // ── Group toggle buttons ──────────────────────────────────────────────────
    const groupDefs = [
        { cat: 'deep_sky', key: 'sky_map_filter_dso' },
        { cat: 'bodies',   key: 'sky_map_filter_bodies' },
        { cat: 'comets',   key: 'sky_map_filter_comets' },
    ];

    // Only show group buttons for categories that actually have targets
    const presentCats = new Set(targets.map(t => t.category));
    const visibleGroups = groupDefs.filter(g => presentCats.has(g.cat));

    if (visibleGroups.length > 1) {
        const groupRow = document.createElement('div');
        groupRow.className = 'd-flex gap-2 flex-wrap mb-2';
        legendBody.appendChild(groupRow);

        visibleGroups.forEach(({ cat, key }) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-sm btn-primary sky-map-filter-btn';
            btn.dataset.cat = cat;
            btn.textContent = tSkyTonightCompat(key);
            btn.addEventListener('click', () => {
                if (activeCategories.has(cat)) {
                    activeCategories.delete(cat);
                    btn.classList.replace('btn-primary', 'btn-outline-secondary');
                } else {
                    activeCategories.add(cat);
                    btn.classList.replace('btn-outline-secondary', 'btn-primary');
                }
                applyFilters();
            });
            groupRow.appendChild(btn);
        });
    }

    // ── Messier-only toggle (only shown when deep_sky targets are present) ────
    const hasMessier = targets.some(t => t.category === 'deep_sky' && t.messier);
    if (hasMessier) {
        const messierRow = document.createElement('div');
        messierRow.className = 'd-flex gap-2 flex-wrap mb-2';
        legendBody.appendChild(messierRow);

        const messierBtn = document.createElement('button');
        messierBtn.type = 'button';
        messierBtn.className = 'btn btn-sm btn-outline-secondary sky-map-filter-btn';
        messierBtn.innerHTML = '<i class="bi bi-star icon-inline" aria-hidden="true"></i>Messier';
        messierBtn.title = tSkyTonightCompat('sky_map_filter_dso') + ' — Messier only';
        messierBtn.addEventListener('click', () => {
            messierOnly = !messierOnly;
            if (messierOnly) {
                messierBtn.classList.replace('btn-outline-secondary', 'btn-warning');
            } else {
                messierBtn.classList.replace('btn-warning', 'btn-outline-secondary');
            }
            applyFilters();
        });
        messierRow.appendChild(messierBtn);
    }

    // ── AstroScore slider ─────────────────────────────────────────────────────
    const sliderWrap = document.createElement('div');
    sliderWrap.className = 'mb-3';
    legendBody.appendChild(sliderWrap);

    const sliderLabel = document.createElement('label');
    sliderLabel.className = 'form-label small text-muted mb-1';
    const sliderLabelText = document.createTextNode(
        `${tSkyTonightCompat('sky_map_min_score')}: `
    );
    const sliderValueSpan = document.createElement('span');
    sliderValueSpan.className = 'fw-semibold';
    sliderValueSpan.textContent = '0%';
    sliderLabel.appendChild(sliderLabelText);
    sliderLabel.appendChild(sliderValueSpan);
    sliderWrap.appendChild(sliderLabel);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'form-range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '5';
    slider.value = '65';
    sliderValueSpan.textContent = '65%';
    slider.addEventListener('input', () => {
        minScore = parseInt(slider.value, 10) / 100;
        sliderValueSpan.textContent = `${slider.value}%`;
        applyFilters();
    });
    sliderWrap.appendChild(slider);

    // ── Constellation filter ───────────────────────────────────────────────────
    const constBtnMap = {};
    if (allConstellations.length > 1) {
        const constSection = document.createElement('div');
        constSection.className = 'mb-2';
        legendBody.appendChild(constSection);

        const constLabelRow = document.createElement('div');
        constLabelRow.className = 'd-flex align-items-center justify-content-between mb-1';
        constSection.appendChild(constLabelRow);

        const constLabel = document.createElement('span');
        constLabel.className = 'form-label small text-muted mb-0';
        constLabel.textContent = tSkyTonightCompat('sky_map_filter_constellation');
        constLabelRow.appendChild(constLabel);

        const resetConstBtn = document.createElement('button');
        resetConstBtn.type = 'button';
        resetConstBtn.className = 'btn btn-sm btn-link p-0 text-muted';
        resetConstBtn.title = 'Show all constellations';
        resetConstBtn.innerHTML = '<i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i>';
        constLabelRow.appendChild(resetConstBtn);

        const constBtnWrap = document.createElement('div');
        constBtnWrap.className = 'sky-map-constellation-filter d-flex flex-wrap gap-1';
        constSection.appendChild(constBtnWrap);

        allConstellations.forEach(name => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'btn btn-sm btn-primary sky-map-filter-btn';
            b.textContent = name;
            b.dataset.constellation = name;
            b.addEventListener('click', () => {
                if (activeConstellations.has(name)) {
                    activeConstellations.delete(name);
                    b.classList.replace('btn-primary', 'btn-outline-secondary');
                } else {
                    activeConstellations.add(name);
                    b.classList.replace('btn-outline-secondary', 'btn-primary');
                }
                applyFilters();
            });
            constBtnWrap.appendChild(b);
            constBtnMap[name] = b;
        });

        resetConstBtn.addEventListener('click', () => {
            allConstellations.forEach(name => {
                activeConstellations.add(name);
                constBtnMap[name].classList.replace('btn-outline-secondary', 'btn-primary');
            });
            applyFilters();
        });
    }

    // ── Legend table ──────────────────────────────────────────────────────────
    const statsLine = document.createElement('div');
    statsLine.className = 'text-muted small text-end mb-1';
    statsLine.textContent = tSkyTonightCompat('sky_map_count', { count: targets.length });
    legendBody.appendChild(statsLine);

    const tblWrap = document.createElement('div');
    tblWrap.className = 'sky-map-legend-wrap';
    legendBody.appendChild(tblWrap);

    const tbl = document.createElement('table');
    tbl.className = 'table table-sm table-hover table-borderless sky-map-legend mb-0';
    tblWrap.appendChild(tbl);

    const thead = tbl.createTHead();
    const hr = thead.insertRow();
    [
        tSkyTonightCompat('sky_map_col_rank'),
        tSkyTonightCompat('sky_map_col_name'),
        tSkyTonightCompat('sky_map_col_type'),
        tSkyTonightCompat('sky_map_col_score'),
        tSkyTonightCompat('sky_map_col_constellation'),
    ].forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        th.scope = 'col';
        hr.appendChild(th);
    });

    const tbody = tbl.createTBody();
    const legendRows = [];

    targets.forEach((tgt, i) => {
        const color    = PALETTE[i % PALETTE.length];
        const scoreVal = tgt.score != null ? Math.round(tgt.score * 100) + '%' : '—';
        const tableRow = tbody.insertRow();
        tableRow.dataset.cat   = tgt.category;
        tableRow.dataset.score = tgt.score != null ? tgt.score : '0';

        [
            { text: tgt.n,                       colored: true },
            { text: tgt.name,                    colored: false },
            { text: tgt.type || tgt.category,    colored: false },
            { text: scoreVal,                    colored: false },
            { text: tgt.constellation || '—',    colored: false },
        ].forEach(({ text, colored }) => {
            const td = tableRow.insertCell();
            td.textContent = text;
            if (colored) {
                td.style.color = color;
                td.style.fontWeight = 'bold';
            }
        });

        legendRows.push(tableRow);
    });

    // ── Filter logic ──────────────────────────────────────────────────────────
    function applyFilters() {
        const visArr = new Array(traces.length).fill(true);
        traceMap.forEach(({ arcIdx, dotIdx, target }) => {
            const show = activeCategories.has(target.category) &&
                         (target.score == null || target.score >= minScore) &&
                         (!messierOnly || target.category !== 'deep_sky' || target.messier) &&
                         (allConstellations.length === 0 || !target.constellation || activeConstellations.has(target.constellation));
            visArr[arcIdx] = show;
            visArr[dotIdx] = show;
        });
        Plotly.restyle(mapDiv, { visible: visArr });

        let visible = 0;
        legendRows.forEach((tableRow, i) => {
            const tgt  = targets[i];
            const show = activeCategories.has(tgt.category) &&
                         (tgt.score == null || tgt.score >= minScore) &&
                         (!messierOnly || tgt.category !== 'deep_sky' || tgt.messier) &&
                         (allConstellations.length === 0 || !tgt.constellation || activeConstellations.has(tgt.constellation));
            tableRow.style.display = show ? '' : 'none';
            if (show) visible++;
        });
        statsLine.textContent = tSkyTonightCompat('sky_map_count', { count: visible });
    }

    // Apply initial filter (default slider is 65 %)
    applyFilters();
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
// SkyTonight Section UI  (5 direct section buttons replacing the old subtab)
// ======================

/**
 * Main entry point — called when the SkyTonight tab is activated,
 * after a calculation finishes, or after plan changes that need badge refresh.
 * Builds/refreshes the 5 section buttons and ensures content wrappers exist.
 */
async function loadSkyTonightResultsTabs() {
    // Invalidate section caches so fresh data is fetched on next view
    _skytSectionCache = {};
    currentCatalogueTab = 'SkyTonight';

    _buildSkyTonightSectionButtons();
    // Show + load the current (or default) section
    activateSubTab('skytonight', `skytonight-${_skytCurrentSection}`);
    await _showSkyTonightSectionData(_skytCurrentSection);
}

/**
 * Build the 5 section navigation buttons in #skytonight-subtabs and ensure
 * the corresponding sub-tab-content divs exist in #skytonight-tab.
 * Follows the same pattern as other tabs (sub-tab-btn / sub-tab-content).
 */
function _buildSkyTonightSectionButtons() {
    const navContainer = document.getElementById('skytonight-subtabs');
    if (!navContainer) return;
    DOMUtils.clear(navContainer);

    const skytonightTab = document.getElementById('skytonight-tab');

    const sections = [
        { key: 'plot',   icon: 'bi-bar-chart-line text-success', labelKey: 'plot' },
        { key: 'report', icon: 'bi-galaxy',                      labelKey: 'deep_sky_objects' },
        { key: 'bodies', icon: 'bi-globe2 text-warning',         labelKey: 'bodies' },
        { key: 'comets', icon: 'bi-comet text-warning',          labelKey: 'comets' },
        { key: 'log',    icon: 'bi-journal-text text-danger',    labelKey: 'logs' },
    ];

    sections.forEach(sec => {
        const subtabName = `skytonight-${sec.key}`;

        // ── Nav button ──────────────────────────────────────────────────────
        const li = document.createElement('li');
        li.className = 'nav-item';
        const a = document.createElement('a');
        a.className = `nav-link sub-tab-btn${sec.key === _skytCurrentSection ? ' active' : ''}`;
        a.href = '#';
        a.setAttribute('data-subtab', subtabName);
        a.innerHTML = `<i class="bi ${sec.icon} icon-inline" aria-hidden="true"></i> <span>${tSkyTonightCompat(sec.labelKey)}</span>`;
        li.appendChild(a);
        navContainer.appendChild(li);

        // ── Content wrapper (created once, reused on re-renders) ────────────
        if (!document.getElementById(`${subtabName}-subtab`)) {
            const contentDiv = document.createElement('div');
            contentDiv.id = `${subtabName}-subtab`;
            contentDiv.className = 'sub-tab-content';

            const wrapper = document.createElement('div');
            wrapper.className = 'shadow p-2 mb-3 rounded bg-sub-container';

            const h2 = document.createElement('h2');
            h2.innerHTML = `<i class="bi ${sec.icon} icon-inline" aria-hidden="true"></i> <span>${tSkyTonightCompat(sec.labelKey)}</span>`;
            wrapper.appendChild(h2);

            const dataDiv = document.createElement('div');
            dataDiv.id = `skytonight-${sec.key}-data`;
            wrapper.appendChild(dataDiv);

            contentDiv.appendChild(wrapper);
            skytonightTab.appendChild(contentDiv);
        }
    });
}

/**
 * Called by app.js switchSubTab when a skytonight-* subtab is activated.
 * Loads data into the already-visible sub-tab-content div.
 *
 * @param {string} sectionKey  'plot' | 'report' | 'bodies' | 'comets' | 'log'
 */
async function _showSkyTonightSectionData(sectionKey) {
    _skytCurrentSection = sectionKey;

    const dataDiv = document.getElementById(`skytonight-${sectionKey}-data`);
    if (!dataDiv) return;

    if (sectionKey === 'plot') {
        await _renderSkyMap(null, dataDiv);
        return;
    }

    if (sectionKey === 'log') {
        await _showSkyTonightLogSection(dataDiv);
        return;
    }

    await _showSkyTonightDataSection(sectionKey, dataDiv);
}

async function _showSkyTonightLogSection(container) {
    DOMUtils.clear(container);
    const loading = document.createElement('div');
    loading.className = 'alert alert-info';
    loading.textContent = tSkyTonightCompat('loading_log_content');
    container.appendChild(loading);

    const logContent = await loadSkytonightLog();
    DOMUtils.clear(container);

    if (typeof logContent !== 'string') {
        const err = document.createElement('div');
        err.className = 'alert alert-danger';
        err.textContent = tSkyTonightCompat('failed_to_load_log_content');
        container.appendChild(err);
        return;
    }

    const lines = logContent.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'alert alert-info';
        empty.textContent = tSkyTonightCompat('no_data_available');
        container.appendChild(empty);
        return;
    }

    const frag = document.createDocumentFragment();
    lines.forEach(line => {
        let entry;
        try { entry = JSON.parse(line); } catch {
            const pre = document.createElement('pre');
            pre.className = 'small text-muted my-1';
            pre.textContent = line;
            frag.appendChild(pre);
            return;
        }

        const { timestamp, status, payload } = entry;
        const isError = status && status.includes('error');

        const card = document.createElement('div');
        card.className = `card mb-2 border-${isError ? 'danger' : 'success'}`;

        // Header
        const header = document.createElement('div');
        header.className = 'card-header d-flex align-items-center gap-2 py-1';

        const badge = document.createElement('span');
        badge.className = `badge bg-${isError ? 'danger' : 'success'}`;
        badge.textContent = status || '?';
        header.appendChild(badge);

        const tsEl = document.createElement('small');
        tsEl.className = 'text-muted ms-auto';
        if (timestamp) {
            try { tsEl.textContent = new Date(timestamp).toLocaleString(); }
            catch { tsEl.textContent = timestamp; }
        }
        header.appendChild(tsEl);
        card.appendChild(header);

        // Body — key/value rows from payload
        if (payload && typeof payload === 'object') {
            const body = document.createElement('div');
            body.className = 'card-body py-2 px-3 small';

            Object.entries(payload).forEach(([key, value]) => {
                const row = document.createElement('div');
                row.className = 'd-flex gap-2 align-items-baseline border-bottom py-1';

                const keyEl = document.createElement('span');
                keyEl.className = 'fw-semibold text-nowrap';
                keyEl.style.minWidth = '10rem';
                keyEl.textContent = key.replace(/_/g, ' ');

                const valEl = document.createElement('span');
                valEl.className = 'text-break';
                if (typeof value === 'object' && value !== null) {
                    valEl.textContent = JSON.stringify(value);
                } else if (typeof value === 'boolean') {
                    valEl.innerHTML = value
                        ? '<i class="bi bi-check-circle-fill text-success" aria-hidden="true"></i>'
                        : '<i class="bi bi-x-circle-fill text-danger" aria-hidden="true"></i>';
                } else {
                    valEl.textContent = String(value ?? '\u2014');
                }

                row.appendChild(keyEl);
                row.appendChild(valEl);
                body.appendChild(row);
            });

            card.appendChild(body);
        }

        frag.appendChild(card);
    });
    container.appendChild(frag);
}

async function _showSkyTonightDataSection(sectionKey, container) {
    const displayAstrodex = await getSkyTonightDisplayAstrodex();

    DOMUtils.clear(container);
    // Show loading indicator
    const loading = document.createElement('div');
    loading.className = 'alert alert-info';
    loading.textContent = i18n.t('common.loading');
    container.appendChild(loading);

    try {
        let data;
        if (_skytSectionCache[sectionKey]) {
            data = _skytSectionCache[sectionKey];
        } else {
            const endpoint = {
                report: '/api/skytonight/data/dso',
                bodies: '/api/skytonight/data/bodies',
                comets: '/api/skytonight/data/comets',
            }[sectionKey];
            data = await fetchJSON(endpoint);
            if (data.error) throw new Error(data.error);
            _skytSectionCache[sectionKey] = data;

            // Keep window.catalogueReports in sync for badge update functions
            window.catalogueReports = window.catalogueReports || {};
            window.catalogueReportSources = window.catalogueReportSources || {};
            if (!window.catalogueReports['SkyTonight']) {
                window.catalogueReports['SkyTonight'] = { report: [], bodies: [], comets: [] };
            }
            if (sectionKey === 'report') window.catalogueReports['SkyTonight'].report = data.report || [];
            if (sectionKey === 'bodies') window.catalogueReports['SkyTonight'].bodies = data.bodies || [];
            if (sectionKey === 'comets') window.catalogueReports['SkyTonight'].comets = data.comets || [];
            window.catalogueReportSources['SkyTonight'] = 'skytonight';
        }

        DOMUtils.clear(container);

        // Banner when a calculation is still running
        if (data.in_progress) {
            const banner = document.createElement('div');
            banner.className = 'alert alert-warning d-flex align-items-center gap-2 mb-2';
            banner.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>${tSkyTonightCompat('calculation_in_progress')}`;
            container.appendChild(banner);
        }

        const dataKey = { report: 'report', bodies: 'bodies', comets: 'comets' }[sectionKey];
        const tableData = data[dataKey];

        if (!tableData || tableData.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'alert alert-info mt-3';
            empty.textContent = data.available
                ? tSkyTonightCompat('no_target_in_report')
                : tSkyTonightCompat('no_data_available');
            container.appendChild(empty);
            return;
        }

        const tableType = sectionKey === 'report' ? 'report' : sectionKey;
        const tableHtml = generateReportTable(tableData, 'SkyTonight', tableType, displayAstrodex);
        const fragment = document.createRange().createContextualFragment(tableHtml);
        container.appendChild(fragment);

    } catch (err) {
        console.error(`Error loading SkyTonight ${sectionKey} section:`, err);
        DOMUtils.clear(container);
        const errAlert = document.createElement('div');
        errAlert.className = 'alert alert-danger mt-3';
        errAlert.textContent = tSkyTonightCompat('failed_to_load_catalogue_results');
        container.appendChild(errAlert);
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

