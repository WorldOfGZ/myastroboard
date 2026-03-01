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

    const nextVisibleHtml = nextVisible ? `
        <div class="row row-cols-1 mb-3">
            <div class="col">
                <div class="card h-100 border-success">
                    <div class="card-header fw-bold">✅ Next visible passage</div>
                    <div class="card-body">
                        <div class="row row-cols-1 row-cols-lg-2">
                            <div class="col mb-2">
                                <div><strong>🕐 Start:</strong> ${formatTimeThenDateWithSeconds(nextVisible.start_time)}</div>
                                <div><strong>⏱️ Culmination:</strong> ${formatTimeThenDateWithSeconds(nextVisible.peak_time)}</div>
                                <div><strong>🕔 End:</strong> ${formatTimeThenDateWithSeconds(nextVisible.end_time)}</div>
                            </div>
                            <div class="col mb-2">
                                <div><strong>📐 Start Alt/Az:</strong> ${formatAltAz(nextVisible.start_altitude_deg, nextVisible.start_azimuth_cardinal, nextVisible.start_azimuth_deg)}</div>
                                <div><strong>📐 Peak Alt/Az:</strong> ${formatAltAz(nextVisible.peak_altitude_deg, nextVisible.peak_azimuth_cardinal, nextVisible.peak_azimuth_deg)}</div>
                                <div><strong>📐 End Alt/Az:</strong> ${formatAltAz(nextVisible.end_altitude_deg, nextVisible.end_azimuth_cardinal, nextVisible.end_azimuth_deg)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    ` : `
        <div class="alert alert-warning" role="alert">
            No visible ISS passage found in the selected forecast window.
        </div>
    `;

    const rowsHtml = passes.map(pass => {
        return `
            <tr>
                <td>${formatDateFull(pass.peak_time)}</td>
                <td>${formatTimeThenDateWithSeconds(pass.start_time)}</td>
                <td>${formatAltAz(pass.start_altitude_deg, pass.start_azimuth_cardinal, pass.start_azimuth_deg)}</td>
                <td>${formatTimeThenDateWithSeconds(pass.peak_time)}</td>
                <td>${formatAltAz(pass.peak_altitude_deg, pass.peak_azimuth_cardinal, pass.peak_azimuth_deg)}</td>
                <td>${formatTimeThenDateWithSeconds(pass.end_time)}</td>
                <td>${formatAltAz(pass.end_altitude_deg, pass.end_azimuth_cardinal, pass.end_azimuth_deg)}</td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="alert alert-info" role="alert">
            ISS visible passages for the next ${Number(data.window_days || 20)} days (sunlit ISS and dark-enough sky), computed for your configured location and timezone.
        </div>

        ${nextVisibleHtml}

        <div class="row row-cols-1">
            <div class="col">
                <div class="card h-100">
                    <div class="card-header fw-bold">📅 Upcoming ISS passages</div>
                    <div class="table-responsive">
                        <table class="table table-striped table-hover mb-0">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Start</th>
                                    <th>Start Elev / Az</th>
                                    <th>Culmination</th>
                                    <th>Culmination Elev / Az</th>
                                    <th>End</th>
                                    <th>End Elev / Az</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml || '<tr><td colspan="7" class="text-center text-muted">No visible ISS passages found.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
}
