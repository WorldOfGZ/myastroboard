// ======================
// ISS Passes
// ======================


function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function computeVisibilityScore(pass) {
    const peakAltitudeDeg = Number(pass?.peak_altitude_deg);
    const startMs = Date.parse(pass?.start_time || '');
    const endMs = Date.parse(pass?.end_time || '');

    const altitudeScore = Number.isFinite(peakAltitudeDeg)
        ? clamp(peakAltitudeDeg / 90, 0, 1)
        : 0;

    const durationMinutes = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs
        ? (endMs - startMs) / 60000
        : 0;
    const durationScore = clamp(durationMinutes / 8, 0, 1);

    const score = Math.round(((altitudeScore * 0.7) + (durationScore * 0.3)) * 100);
    return clamp(score, 0, 100);
}

function createVisibilityGauge(scorePercent) {
    const container = document.createElement('div');
    container.className = 'iss-score';

    const label = document.createElement('div');
    label.className = 'iss-score-label';
    label.textContent = `${scorePercent}%`;

    const track = document.createElement('div');
    track.className = 'iss-score-track';

    const fill = document.createElement('div');
    fill.className = 'iss-score-fill';
    fill.style.width = `${scorePercent}%`;
    fill.setAttribute('role', 'progressbar');
    fill.setAttribute('aria-valuemin', '0');
    fill.setAttribute('aria-valuemax', '100');
    fill.setAttribute('aria-valuenow', String(scorePercent));
    fill.setAttribute('aria-label', `Visibility score ${scorePercent}%`);

    track.appendChild(fill);
    container.appendChild(label);
    container.appendChild(track);

    return container;
}

/**
 * Load ISS upcoming passes for current location (next 20 days).
 */
async function loadIss() {
    const container = document.getElementById('iss-display');
    const data = await fetchJSONWithUI('/api/iss/passes?days=20', container, i18n.t('iss.loading_passes'));
    if (!data) return;

    const nextVisible = data.next_visible_passage;
    const passes = Array.isArray(data.passes) ? data.passes : [];

    DOMUtils.clear(container);

    const infoAlert = document.createElement('div');
    infoAlert.className = 'alert alert-info';
    infoAlert.setAttribute('role', 'alert');
    infoAlert.textContent = i18n.t('iss.info_tab', { days: Number(data.window_days || 20) });
    container.appendChild(infoAlert);

    if (nextVisible) {
        const row = document.createElement('div');
        row.className = 'row row-cols-1 mb-3';
        const col = document.createElement('div');
        col.className = 'col';
        const card = document.createElement('div');
        card.className = 'card h-100 border-success';
        const cardHeader = document.createElement('div');
        cardHeader.className = 'card-header fw-bold';
        cardHeader.innerHTML = `<i class="bi bi-check-circle-fill text-success icon-inline" aria-hidden="true"></i>${i18n.t('iss.next_visible_passage')}`;
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body';
        const bodyRow = document.createElement('div');
        bodyRow.className = 'row row-cols-1 row-cols-lg-2';

        const createInfoColumn = (items) => {
            const infoCol = document.createElement('div');
            infoCol.className = 'col mb-2';
            items.forEach(({ label, value }) => {
                const line = document.createElement('div');
                const strong = document.createElement('strong');
                strong.innerHTML = label;
                line.appendChild(strong);
                line.append(' ');
                line.append(value);
                infoCol.appendChild(line);
            });
            return infoCol;
        };

        bodyRow.appendChild(createInfoColumn([
            { label: `<i class="bi bi-clock icon-inline" aria-hidden="true"></i>${i18n.t('iss.start')}`, value: formatTimeThenDateWithSeconds(nextVisible.start_time) },
            { label: `<i class="bi bi-stopwatch icon-inline" aria-hidden="true"></i>${i18n.t('iss.culmination')}`, value: formatTimeThenDateWithSeconds(nextVisible.peak_time) },
            { label: `<i class="bi bi-clock-history icon-inline" aria-hidden="true"></i>${i18n.t('iss.end')}`, value: formatTimeThenDateWithSeconds(nextVisible.end_time) }
        ]));

        bodyRow.appendChild(createInfoColumn([
            { label: `<i class="bi bi-compass icon-inline" aria-hidden="true"></i>${i18n.t('iss.start_alt_az')}`, value: formatAltAz(nextVisible.start_altitude_deg, nextVisible.start_azimuth_cardinal, nextVisible.start_azimuth_deg) },
            { label: `<i class="bi bi-compass icon-inline" aria-hidden="true"></i>${i18n.t('iss.peak_alt_az')}`, value: formatAltAz(nextVisible.peak_altitude_deg, nextVisible.peak_azimuth_cardinal, nextVisible.peak_azimuth_deg) },
            { label: `<i class="bi bi-compass icon-inline" aria-hidden="true"></i>${i18n.t('iss.end_alt_az')}`, value: formatAltAz(nextVisible.end_altitude_deg, nextVisible.end_azimuth_cardinal, nextVisible.end_azimuth_deg) }
        ]));

        cardBody.appendChild(bodyRow);
        card.appendChild(cardHeader);
        card.appendChild(cardBody);
        col.appendChild(card);
        row.appendChild(col);
        container.appendChild(row);
    } else {
        const warning = document.createElement('div');
        warning.className = 'alert alert-warning';
        warning.setAttribute('role', 'alert');
        warning.textContent = i18n.t('iss.no_passes');
        container.appendChild(warning);
    }

    const tableRow = document.createElement('div');
    tableRow.className = 'row row-cols-1';
    const tableCol = document.createElement('div');
    tableCol.className = 'col';
    const tableCard = document.createElement('div');
    tableCard.className = 'card h-100';
    const tableHeader = document.createElement('div');
    tableHeader.className = 'card-header fw-bold';
    tableHeader.innerHTML = `<i class="bi bi-calendar-event text-danger icon-inline" aria-hidden="true"></i>${i18n.t('iss.upcoming_passages')}`;
    const tableResponsive = document.createElement('div');
    tableResponsive.className = 'table-responsive';
    const table = document.createElement('table');
    table.className = 'table table-striped table-hover mb-0 iss-pass-table';
    const thead = document.createElement('thead');
    const headRowTop = document.createElement('tr');
    [
        { text: i18n.t('iss.table_date'), rowSpan: 2 },
        { text: i18n.t('iss.table_visibility'), rowSpan: 2 },
        { text: i18n.t('iss.table_start'), colSpan: 2, className: 'iss-group-head' },
        { text: i18n.t('iss.table_culmination'), colSpan: 2, className: 'iss-group-head' },
        { text: i18n.t('iss.table_end'), colSpan: 2, className: 'iss-group-head' }
    ].forEach((headerConfig) => {
        const th = document.createElement('th');
        th.textContent = headerConfig.text;
        if (headerConfig.rowSpan) th.rowSpan = headerConfig.rowSpan;
        if (headerConfig.colSpan) th.colSpan = headerConfig.colSpan;
        if (headerConfig.className) th.className = headerConfig.className;
        headRowTop.appendChild(th);
    });

    const headRowBottom = document.createElement('tr');
    [i18n.t('iss.table_time'), i18n.t('iss.table_elev'), i18n.t('iss.table_time'), i18n.t('iss.table_elev'), i18n.t('iss.table_time'), i18n.t('iss.table_elev')].forEach((headerText) => {
        const th = document.createElement('th');
        th.className = 'text-center';
        th.textContent = headerText;
        headRowBottom.appendChild(th);
    });

    thead.appendChild(headRowTop);
    thead.appendChild(headRowBottom);

    const tbody = document.createElement('tbody');
    if (passes.length > 0) {
        passes.forEach((pass) => {
            const row = document.createElement('tr');

            const dateCell = document.createElement('td');
            dateCell.textContent = formatDateFull(pass.peak_time);
            row.appendChild(dateCell);

            const visibilityCell = document.createElement('td');
            const visibilityScore = computeVisibilityScore(pass);
            visibilityCell.appendChild(createVisibilityGauge(visibilityScore));
            row.appendChild(visibilityCell);

            [
                formatTimeThenDateWithSeconds(pass.start_time),
                formatAltAz(pass.start_altitude_deg, pass.start_azimuth_cardinal, pass.start_azimuth_deg),
                formatTimeThenDateWithSeconds(pass.peak_time),
                formatAltAz(pass.peak_altitude_deg, pass.peak_azimuth_cardinal, pass.peak_azimuth_deg),
                formatTimeThenDateWithSeconds(pass.end_time),
                formatAltAz(pass.end_altitude_deg, pass.end_azimuth_cardinal, pass.end_azimuth_deg)
            ].forEach((value) => {
                const td = document.createElement('td');
                td.className = 'text-center';
                td.textContent = value;
                row.appendChild(td);
            });
            tbody.appendChild(row);
        });
    } else {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 8;
        cell.className = 'text-center text-muted';
        cell.textContent = i18n.t('iss.not_found');
        row.appendChild(cell);
        tbody.appendChild(row);
    }

    table.appendChild(thead);
    table.appendChild(tbody);
    tableResponsive.appendChild(table);
    tableCard.appendChild(tableHeader);
    tableCard.appendChild(tableResponsive);
    tableCol.appendChild(tableCard);
    tableRow.appendChild(tableCol);
    container.appendChild(tableRow);
}
