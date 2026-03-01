// ======================
// ISS Passes
// ======================

function formatTimeThenDateWithSeconds(isoString, locale = navigator.language) {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);

    const timeFormatter = new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    const dateFormatter = new Intl.DateTimeFormat(locale, {
        month: 'numeric',
        day: 'numeric'
    });

    return `${timeFormatter.format(date)} (${dateFormatter.format(date)})`;
}

function formatAltAz(altitudeDeg, azimuthCardinal, azimuthDeg) {
    const safeAlt = Number.isFinite(Number(altitudeDeg)) ? `${Number(altitudeDeg).toFixed(1)}°` : 'N/A';
    const safeCardinal = escapeHtml(azimuthCardinal || 'N/A');
    const safeAz = Number.isFinite(Number(azimuthDeg)) ? `${Number(azimuthDeg).toFixed(1)}°` : 'N/A';
    return `${safeAlt} / ${safeCardinal} (${safeAz})`;
}

/**
 * Load ISS upcoming passes for current location (next 20 days).
 */
async function loadIss() {
    const container = document.getElementById('iss-display');
    const data = await fetchJSONWithUI('/api/iss/passes?days=20', container, 'Loading ISS passages...');
    if (!data) return;

    const nextVisible = data.next_visible_passage;
    const passes = Array.isArray(data.passes) ? data.passes : [];

    DOMUtils.clear(container);

    const infoAlert = document.createElement('div');
    infoAlert.className = 'alert alert-info';
    infoAlert.setAttribute('role', 'alert');
    infoAlert.textContent = `ISS visible passages for the next ${Number(data.window_days || 20)} days (sunlit ISS and dark-enough sky), computed for your configured location and timezone.`;
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
        cardHeader.textContent = '✅ Next visible passage';
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
                strong.textContent = `${label} `;
                line.appendChild(strong);
                line.append(value);
                infoCol.appendChild(line);
            });
            return infoCol;
        };

        bodyRow.appendChild(createInfoColumn([
            { label: '🕐 Start:', value: formatTimeThenDateWithSeconds(nextVisible.start_time) },
            { label: '⏱️ Culmination:', value: formatTimeThenDateWithSeconds(nextVisible.peak_time) },
            { label: '🕔 End:', value: formatTimeThenDateWithSeconds(nextVisible.end_time) }
        ]));

        bodyRow.appendChild(createInfoColumn([
            { label: '📐 Start Alt/Az:', value: formatAltAz(nextVisible.start_altitude_deg, nextVisible.start_azimuth_cardinal, nextVisible.start_azimuth_deg) },
            { label: '📐 Peak Alt/Az:', value: formatAltAz(nextVisible.peak_altitude_deg, nextVisible.peak_azimuth_cardinal, nextVisible.peak_azimuth_deg) },
            { label: '📐 End Alt/Az:', value: formatAltAz(nextVisible.end_altitude_deg, nextVisible.end_azimuth_cardinal, nextVisible.end_azimuth_deg) }
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
        warning.textContent = 'No visible ISS passage found in the selected forecast window.';
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
    tableHeader.textContent = '📅 Upcoming ISS passages';
    const tableResponsive = document.createElement('div');
    tableResponsive.className = 'table-responsive';
    const table = document.createElement('table');
    table.className = 'table table-striped table-hover mb-0';
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    [
        'Date',
        'Start',
        'Start Elev / Az',
        'Culmination',
        'Culmination Elev / Az',
        'End',
        'End Elev / Az'
    ].forEach((headerText) => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    const tbody = document.createElement('tbody');
    if (passes.length > 0) {
        passes.forEach((pass) => {
            const row = document.createElement('tr');
            [
                formatDateFull(pass.peak_time),
                formatTimeThenDateWithSeconds(pass.start_time),
                formatAltAz(pass.start_altitude_deg, pass.start_azimuth_cardinal, pass.start_azimuth_deg),
                formatTimeThenDateWithSeconds(pass.peak_time),
                formatAltAz(pass.peak_altitude_deg, pass.peak_azimuth_cardinal, pass.peak_azimuth_deg),
                formatTimeThenDateWithSeconds(pass.end_time),
                formatAltAz(pass.end_altitude_deg, pass.end_azimuth_cardinal, pass.end_azimuth_deg)
            ].forEach((value) => {
                const td = document.createElement('td');
                td.textContent = value;
                row.appendChild(td);
            });
            tbody.appendChild(row);
        });
    } else {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 7;
        cell.className = 'text-center text-muted';
        cell.textContent = 'No visible ISS passages found.';
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
