/**
 * Target visibility calendar - "when is this object best this year?"
 *
 * Fetches GET /api/skytonight/visibility-calendar and renders a 12-cell monthly
 * heatmap (plus an optional observable-hours trend chart) into the shared
 * modal_lg_close shell. Opened from the SkyTonight DSO table and from an Astrodex
 * item detail. Deep-sky (fixed-coordinate) targets only.
 */

/* global bootstrap, Chart, DOMUtils, i18n, fetchJSON, API_BASE */

const VC_MODAL_ID = 'modal_lg_close';
let _vcChart = null;
let _vcState = { identifier: null, year: null };

/**
 * Translate helper with an English fallback so the modal still renders if a key
 * is missing in the active language.
 * @param {string} key
 * @param {string} fallback
 * @param {Object} [params]
 * @returns {string}
 */
function _vcT(key, fallback, params) {
    if (typeof i18n !== 'undefined' && i18n.has(key)) {
        return i18n.t(key, params || {});
    }
    let text = fallback;
    if (params) {
        Object.keys(params).forEach((name) => {
            text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), params[name]);
        });
    }
    return text;
}

/** @returns {string} active locale code for Intl formatting */
function _vcLocale() {
    return typeof i18n?.getCurrentLanguage === 'function' ? i18n.getCurrentLanguage() : navigator.language;
}

function _vcDestroyChart() {
    if (_vcChart) {
        _vcChart.destroy();
        _vcChart = null;
    }
}

/**
 * Fetch the calendar for an identifier/year and render it into a container.
 * @param {string} identifier
 * @param {number|null} year
 * @param {HTMLElement} containerEl
 */
async function renderVisibilityCalendarInto(identifier, year, containerEl) {
    const id = (identifier || '').trim();
    if (!id || !containerEl) return;

    _vcState = { identifier: id, year: year || null };
    DOMUtils.clear(containerEl);
    containerEl.appendChild(DOMUtils.createSpinnerWrapper(_vcT('common.loading', 'Loading...')));

    let data;
    try {
        const params = new URLSearchParams({ target: id });
        if (year) params.set('year', String(year));
        data = await fetchJSON(`${API_BASE}/api/skytonight/visibility-calendar?${params.toString()}`);
        if (data && data.error) throw new Error(data.error);
    } catch (err) {
        console.error('Failed to load visibility calendar:', err);
        DOMUtils.clear(containerEl);
        const alert = document.createElement('div');
        alert.className = 'alert alert-danger mb-0';
        alert.textContent = _vcT('visibility_calendar.error', 'Failed to load the visibility calendar.');
        containerEl.appendChild(alert);
        return;
    }

    _vcState.year = data.year;
    _renderVisibilityCalendar(data, containerEl);
}

/**
 * Open the visibility calendar in the shared modal_lg_close shell.
 * @param {string} identifier - catalogue id or name
 * @param {number} [year] - optional 4-digit year (defaults to server's current year)
 */
async function openVisibilityCalendar(identifier, year) {
    const id = (identifier || '').trim();
    if (!id) return;

    const modalEl = document.getElementById(VC_MODAL_ID);
    const titleEl = document.getElementById('modal_lg_close_title');
    const bodyEl = document.getElementById('modal_lg_close_body');
    if (!modalEl || !titleEl || !bodyEl) return;

    titleEl.textContent = `${id} - ${_vcT('visibility_calendar.title', 'Visibility calendar')}`;

    let bsModal = bootstrap.Modal.getInstance(modalEl);
    if (!bsModal) {
        bsModal = new bootstrap.Modal(modalEl, { backdrop: true, focus: true, keyboard: true });
    }
    const onHidden = () => {
        _vcDestroyChart();
        modalEl.removeEventListener('hidden.bs.modal', onHidden);
    };
    modalEl.addEventListener('hidden.bs.modal', onHidden);
    bsModal.show();

    await renderVisibilityCalendarInto(id, year || null, bodyEl);
}

/**
 * Build the card shell + heatmap + chart from an API payload.
 * @param {Object} data
 * @param {HTMLElement} bodyEl
 */
function _renderVisibilityCalendar(data, bodyEl) {
    _vcDestroyChart();
    DOMUtils.clear(bodyEl);

    const card = document.createElement('div');
    card.className = 'card h-100';

    // ── Header: title + year stepper ────────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'card-header d-flex justify-content-between align-items-center gap-2 flex-wrap';
    const title = document.createElement('h5');
    title.className = 'mb-0';
    DOMUtils.append(
        title,
        DOMUtils.createIcon('bi bi-calendar-range icon-inline text-primary'),
        `${data.target?.name || _vcState.identifier} - ${_vcT('visibility_calendar.title', 'Visibility calendar')}`
    );
    header.appendChild(title);
    header.appendChild(_vcYearStepper(data));
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'card-body';

    if (!data.supported) {
        const notice = document.createElement('div');
        notice.className = 'alert alert-info mb-0';
        const reasonKey =
            data.reason === 'moving_target'
                ? 'visibility_calendar.unsupported_moving'
                : 'visibility_calendar.unsupported_not_found';
        const fallback =
            data.reason === 'moving_target'
                ? 'This is a solar-system body or comet - its coordinates change through the year, so a fixed calendar does not apply.'
                : 'Could not resolve coordinates for this target.';
        notice.textContent = _vcT(reasonKey, fallback);
        body.appendChild(notice);
        card.appendChild(body);
        bodyEl.appendChild(card);
        return;
    }

    if (!Array.isArray(data.months) || data.months.length === 0) {
        const notice = document.createElement('div');
        notice.className = 'alert alert-warning mb-0';
        notice.textContent = _vcT('visibility_calendar.no_data_year', 'No data could be computed for this year.');
        body.appendChild(notice);
        card.appendChild(body);
        card.appendChild(_vcFooter(data));
        bodyEl.appendChild(card);
        return;
    }

    body.appendChild(_vcHeatmap(data));

    const chartWrap = document.createElement('div');
    chartWrap.className = 'vc-chart-wrap';
    const canvas = document.createElement('canvas');
    canvas.id = 'vc-trend-canvas';
    chartWrap.appendChild(canvas);
    body.appendChild(chartWrap);

    card.appendChild(body);
    card.appendChild(_vcFooter(data));
    bodyEl.appendChild(card);

    _vcRenderChart(canvas, data);
}

/**
 * Prev/next year controls.
 * @param {Object} data
 * @returns {HTMLElement}
 */
function _vcYearStepper(data) {
    const group = document.createElement('div');
    group.className = 'btn-group btn-group-sm';
    group.setAttribute('role', 'group');

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'btn btn-outline-secondary';
    prev.appendChild(DOMUtils.createIcon('bi bi-chevron-left'));
    prev.setAttribute('aria-label', _vcT('visibility_calendar.prev_year', 'Previous year'));
    prev.addEventListener('click', () => openVisibilityCalendar(_vcState.identifier, (data.year || new Date().getFullYear()) - 1));

    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'btn btn-outline-secondary disabled';
    label.textContent = String(data.year || '');

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'btn btn-outline-secondary';
    next.appendChild(DOMUtils.createIcon('bi bi-chevron-right'));
    next.setAttribute('aria-label', _vcT('visibility_calendar.next_year', 'Next year'));
    next.addEventListener('click', () => openVisibilityCalendar(_vcState.identifier, (data.year || new Date().getFullYear()) + 1));

    group.appendChild(prev);
    group.appendChild(label);
    group.appendChild(next);
    return group;
}

/**
 * 12 DOM cells, one per month, coloured by score bucket. The hours value is shown
 * as text so colour is never the only signal.
 * @param {Object} data
 * @returns {HTMLElement}
 */
function _vcHeatmap(data) {
    const locale = _vcLocale();
    const months = data.months || [];
    const bestScore = months.reduce((max, m) => Math.max(max, m.score || 0), 0);

    const grid = document.createElement('div');
    grid.className = 'vc-grid';

    for (let monthNum = 1; monthNum <= 12; monthNum++) {
        const month = months.find((m) => m.month === monthNum);
        const cell = document.createElement('div');
        cell.className = 'vc-cell';
        cell.setAttribute('tabindex', '0');

        const monthLabel = new Date(data.year || 2000, monthNum - 1, 1).toLocaleDateString(locale, { month: 'short' });
        const nameEl = document.createElement('div');
        nameEl.className = 'vc-cell-month';
        nameEl.textContent = monthLabel;
        cell.appendChild(nameEl);

        if (!month) {
            cell.classList.add('vc-cell--b0');
            const dash = document.createElement('div');
            dash.className = 'vc-cell-hours';
            dash.textContent = '-';
            cell.appendChild(dash);
            grid.appendChild(cell);
            continue;
        }

        cell.classList.add(`vc-cell--b${Math.max(0, Math.min(5, month.bucket || 0))}`);
        if (bestScore > 0 && month.score >= bestScore) {
            cell.classList.add('vc-cell--best');
        }

        const hoursEl = document.createElement('div');
        hoursEl.className = 'vc-cell-hours';
        hoursEl.textContent = _vcT('visibility_calendar.cell_hours', '{h} h', {
            h: (month.moonless_observable_hours ?? 0).toFixed(1),
        });
        cell.appendChild(hoursEl);

        if (month.max_altitude != null) {
            const altEl = document.createElement('div');
            altEl.className = 'vc-cell-alt';
            altEl.textContent = `${Math.round(month.max_altitude)}°`;
            cell.appendChild(altEl);
        }

        const tip = [
            `${monthLabel} ${data.year}`,
            _vcT('visibility_calendar.tip_moonless', 'Moonless observable: {h} h', {
                h: (month.moonless_observable_hours ?? 0).toFixed(1),
            }),
            _vcT('visibility_calendar.tip_observable', 'Observable: {h} h', {
                h: (month.observable_hours ?? 0).toFixed(1),
            }),
            _vcT('visibility_calendar.tip_dark', 'Astronomical dark: {h} h', {
                h: (month.dark_hours ?? 0).toFixed(1),
            }),
            _vcT('visibility_calendar.tip_moon', 'Moon illumination: {p}%', {
                p: Math.round(month.moon_illumination_pct ?? 0),
            }),
        ].join(' — ');
        cell.title = tip;
        cell.setAttribute('aria-label', tip);

        grid.appendChild(cell);
    }

    return grid;
}

/**
 * Footer: bucket legend + the location and constraints the calendar was computed against.
 * @param {Object} data
 * @returns {HTMLElement}
 */
function _vcFooter(data) {
    const footer = document.createElement('div');
    footer.className = 'card-footer text-muted small';

    const legend = document.createElement('div');
    legend.className = 'vc-legend mb-2';
    const legendLabel = document.createElement('span');
    legendLabel.className = 'me-1';
    legendLabel.textContent = _vcT('visibility_calendar.legend_label', 'Fewer'); // "Fewer <-> More moonless hours"
    legend.appendChild(legendLabel);
    for (let bucket = 0; bucket <= 5; bucket++) {
        const swatch = document.createElement('span');
        swatch.className = `vc-legend-swatch vc-cell--b${bucket}`;
        legend.appendChild(swatch);
    }
    const legendMore = document.createElement('span');
    legendMore.className = 'ms-1';
    legendMore.textContent = _vcT('visibility_calendar.legend_more', 'More');
    legend.appendChild(legendMore);
    footer.appendChild(legend);

    const meta = document.createElement('div');
    const c = data.constraints || {};
    const parts = [
        _vcT('visibility_calendar.computed_for', 'Computed for {location}', {
            location: data.location?.name || '-',
        }),
        _vcT('visibility_calendar.altitude_range', 'Altitude {min}° to {max}°', {
            min: Math.round(c.altitude_min ?? 0),
            max: Math.round(c.altitude_max ?? 90),
        }),
    ];
    if (c.has_horizon_profile) {
        parts.push(_vcT('visibility_calendar.horizon_applied', 'custom horizon applied'));
    }
    meta.textContent = parts.join(' · ');
    footer.appendChild(meta);

    return footer;
}

/**
 * Line chart of moonless observable hours per month.
 * @param {HTMLCanvasElement} canvas
 * @param {Object} data
 */
function _vcRenderChart(canvas, data) {
    if (typeof Chart === 'undefined' || !canvas) return;
    const locale = _vcLocale();
    const months = data.months || [];
    const labels = [];
    const moonless = [];
    const observable = [];
    for (let monthNum = 1; monthNum <= 12; monthNum++) {
        const month = months.find((m) => m.month === monthNum);
        labels.push(new Date(data.year || 2000, monthNum - 1, 1).toLocaleDateString(locale, { month: 'short' }));
        // null (not 0) for a month with no computed data, so the line breaks instead of dropping to the floor.
        moonless.push(month ? month.moonless_observable_hours : null);
        observable.push(month ? month.observable_hours : null);
    }

    const rootStyle = getComputedStyle(document.documentElement);
    const primaryRgb = (rootStyle.getPropertyValue('--bs-primary-rgb') || '13, 110, 253').trim();
    const textColor = (rootStyle.getPropertyValue('--text-color') || '#1f2937').trim();
    const theme = (document.documentElement.getAttribute('data-theme') || '').toLowerCase();
    const isDarkLike = theme === 'dark' || theme === 'red';
    const gridColor = isDarkLike ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.10)';

    _vcDestroyChart();
    _vcChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: _vcT('visibility_calendar.series_moonless', 'Moonless observable hours'),
                    data: moonless,
                    borderColor: `rgba(${primaryRgb}, 0.95)`,
                    backgroundColor: `rgba(${primaryRgb}, 0.18)`,
                    fill: true,
                    tension: 0.3,
                    spanGaps: false,
                },
                {
                    label: _vcT('visibility_calendar.series_observable', 'Observable hours'),
                    data: observable,
                    borderColor: 'rgba(120, 120, 120, 0.8)',
                    borderDash: [4, 4],
                    fill: false,
                    tension: 0.3,
                    spanGaps: false,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: textColor } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(1)} h`,
                    },
                },
            },
            scales: {
                x: { ticks: { color: textColor }, grid: { color: gridColor } },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: _vcT('visibility_calendar.axis_hours', 'Hours'), color: textColor },
                    ticks: { color: textColor },
                    grid: { color: gridColor },
                },
            },
        },
    });
}

// Expose for the SkyTonight table and Astrodex detail entry points.
window.openVisibilityCalendar = openVisibilityCalendar;
window.renderVisibilityCalendarInto = renderVisibilityCalendarInto;
