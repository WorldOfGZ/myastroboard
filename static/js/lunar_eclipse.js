// ======================
// Lunar Eclipse
// ======================

// Load Lunar Eclipse data
async function loadLunarEclipse() {
    const container = document.getElementById('lunar-eclipse-display');
    const data = await fetchJSONWithUI('/api/moon/next-eclipse', container, 'Loading Lunar Eclipse data...', {
        pendingMessage: 'Cache not ready. Retrying...'
    });
    if (!data) return;

    try {
        clearContainer(container);

        // Check if eclipse data is available
        if (!data.lunar_eclipse) {
            container.innerHTML = `
                <div class="alert alert-info" role="alert">
                    ℹ️ ${data.message || 'No lunar eclipse data available'}
                </div>
            `;
            return;
        }

        const eclipse = data.lunar_eclipse;

        // Helper function to format ISO date to local time string
        function formatEclipseTime(isoString) {
            if (!isoString) return 'N/A';
            const date = new Date(isoString);
            return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'}) + 
                   ' (' + date.toLocaleDateString([], {month: "numeric", day: "numeric"}) + ')';
        }

        let visibilityBadge = '';
        if (!eclipse.visible) {
            visibilityBadge = '<span class="badge bg-danger">Not visible</span>';
        } else {
            visibilityBadge = '<span class="badge bg-success">Visible</span>';
        }

        let scoreColor = 'secondary';
        if (eclipse.astrophotography_score >= 9) scoreColor = 'success';
        else if (eclipse.astrophotography_score >= 7.5) scoreColor = 'info';
        else if (eclipse.astrophotography_score >= 6) scoreColor = 'warning';
        else if (eclipse.astrophotography_score > 0) scoreColor = 'danger';

        // Build altitude vs time chart
        let altitudeChartHTML = '';
        if (eclipse.altitude_vs_time && eclipse.altitude_vs_time.length > 0) {
            altitudeChartHTML = `
                <div id="lunar-eclipse-chart-container"></div>
            `;
        }

        container.innerHTML = `
            <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-2 row-cols-xl-4 p-2 mb-3">
                <div class="col mb-3">
                    <div class="card h-100">
                        <div class="card-header fw-bold">📊 Overview</div>
                        <ul class="list-group list-group-flush">
                            <li class="list-group-item">
                                <div class="d-flex justify-content-between">
                                    <span>Type:</span>
                                    <span class="fw-bold">${eclipse.type}</span>
                                </div>
                            </li>
                            <li class="list-group-item">
                                <div class="d-flex justify-content-between">
                                    <span>Visibility:</span>
                                    <span>${visibilityBadge}</span>
                                </div>
                            </li>
                            <li class="list-group-item">
                                <div class="d-flex justify-content-between">
                                    <span>Total Duration:</span>
                                    <span class="fw-bold">${eclipse.total_duration_minutes > 0 ? eclipse.total_duration_minutes + ' min' : 'None'}</span>
                                </div>
                            </li>
                            <li class="list-group-item">
                                <div class="d-flex justify-content-between">
                                    <span>Partial Duration:</span>
                                    <span class="fw-bold">${eclipse.partial_duration_minutes} min</span>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>

                <div class="col mb-3">
                    <div class="card h-100">
                        <div class="card-header fw-bold">⏱️ Timing</div>
                        <ul class="list-group list-group-flush">
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                Partial begin:
                                <span class="fw-bold fs-6">${formatEclipseTime(eclipse.partial_begin)}</span>
                            </li>
                            ${eclipse.total_begin ? `
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                Total begin:
                                <span class="fw-bold fs-6">${formatEclipseTime(eclipse.total_begin)}</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                Total end:
                                <span class="fw-bold fs-6">${formatEclipseTime(eclipse.total_end)}</span>
                            </li>
                            ` : ''}
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                Partial end:
                                <span class="fw-bold fs-6">${formatEclipseTime(eclipse.partial_end)}</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div class="col mb-3">
                    <div class="card h-100">
                        <div class="card-header fw-bold">📍 Position at Peak</div>
                        <ul class="list-group list-group-flush">
                            <li class="list-group-item">
                                <div class="d-flex justify-content-between mb-2">
                                    <span>Peak Time:</span>
                                    <span class="fw-bold small">${formatEclipseTime(eclipse.peak_time)}</span>
                                </div>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                Altitude:
                                <span class="fw-bold fs-6">${eclipse.peak_altitude_deg.toFixed(2)}°</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                Azimuth:
                                <span class="fw-bold fs-6">${eclipse.peak_azimuth_deg.toFixed(2)}°</span>
                            </li>
                            <li class="list-group-item">
                                <div class="text-muted small">
                                    Direction: ${getCardinalDirection(eclipse.peak_azimuth_deg)}
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>

                <div class="col mb-3">
                    <div class="card h-100">
                        <div class="card-header fw-bold">⭐ Astrophotography Score</div>
                        <div class="p-3" style="text-align: center;">
                            <div class="display-4 fw-bold" style="color: var(--bs-${scoreColor});">
                                ${eclipse.astrophotography_score.toFixed(1)}/10
                            </div>
                            <div class="badge bg-${scoreColor} mt-2">
                                ${eclipse.score_classification}
                            </div>
                            <div class="small text-muted mt-2">
                                Score based on type, visibility, altitude, and duration
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            ${altitudeChartHTML}
        `;

        // Create altitude vs time chart if data available
        if (eclipse.altitude_vs_time && eclipse.altitude_vs_time.length > 0) {
            renderLunarEclipseAltitudeChart(eclipse.altitude_vs_time);
        }

    } catch (error) {
        console.error('Error loading lunar eclipse data:', error);
        container.innerHTML = '<div class="error-box">Failed to load Lunar Eclipse data</div>';
    }
}

// Helper function to get cardinal direction from azimuth
function getCardinalDirection(azimuth) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round((azimuth % 360) / 22.5);
    return directions[index % 16];
}

// Render altitude vs time chart
function renderLunarEclipseAltitudeChart(altitudeData) {
    const container = document.getElementById('lunar-eclipse-chart-container');
    if (!container || !altitudeData || altitudeData.length === 0) return;

    const times = altitudeData.map(p => p.time);
    const altitudes = altitudeData.map(p => p.altitude_deg);

    // Create card HTML structure
    container.innerHTML = `
        <div class="col-12 mb-3">
            <div class="card h-100">
                <div class="card-header">
                    <h5 class="mb-0">📈 Altitude vs Time</h5>
                </div>
                <div class="card-body">
                    <canvas id="lunar-eclipse-altitude-chart" style="height: 300px;"></canvas>
                </div>
                <div class="card-footer text-muted small">
                    <div class="row">
                        <div class="col-auto">
                            <span class="badge" style="background-color: #C0C0C0;">Moon Altitude</span>
                        </div>
                        <div class="col-auto">
                            <span class="text-muted">Degrees (°) | Local Time</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const ctx = document.getElementById('lunar-eclipse-altitude-chart');
    if (!ctx) return;
    
    const ctx_2d = ctx.getContext('2d');
    new Chart(ctx_2d, {
        type: 'line',
        data: {
            labels: times,
            datasets: [{
                label: 'Moon Altitude (°)',
                data: altitudes,
                borderColor: '#C0C0C0',
                backgroundColor: 'rgba(192, 192, 192, 0.1)',
                borderWidth: 2,
                tension: 0.1,
                fill: true,
                pointRadius: 2,
                pointBackgroundColor: '#C0C0C0',
                pointBorderColor: '#fff',
                pointBorderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 90,
                    title: {
                        display: true,
                        text: 'Altitude (degrees)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Local Time'
                    }
                }
            }
        }
    });
}
