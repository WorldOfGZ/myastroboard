// ======================
// Aurora Borealis Predictions
// ======================

/**
 * Load aurora borealis predictions
 */
async function loadAurora() {
    const container = document.getElementById('aurora-display');
    const data = await fetchJSONWithUI('/api/aurora/predictions', container, 'Loading Aurora Borealis predictions...');
    if (!data) return;

    // Display aurora information if data is available
    if (data.current) {
        const current = data.current;
        const location = data.location;
        
        // Determine aurora emoji based on visibility level
        const visibilityEmojiMap = {
            "None": "😴",
            "Very Low": "🌌",
            "Low": "🌌",
            "Moderate": "✨",
            "Good": "🌌",
            "Excellent": "🎆",
            "Severe Storm": "⚡"
        };

        const emoji = visibilityEmojiMap[current.visibility_level] || '🌌';

        // Determine color for probability bar
        const probability = current.probability || 0;
        let probabilityColor = '#dc3545'; // red
        if (probability > 70) {
            probabilityColor = '#28a745'; // green
        } else if (probability > 40) {
            probabilityColor = '#ffc107'; // yellow
        }

        container.innerHTML = `
            <div class="row row-cols-1 mb-3">
                <div class="col">
                    <div class="d-flex flex-row align-items-center">
                        <div class="p-2 icon-weather-lg">${emoji}</div>
                        <div class="p-2">
                            <div class="fw-bold fs-4">${current.visibility_level}</div>
                            <div class="text-muted">${current.visibility_description}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-2 row-cols-xl-3">
                <div class="col mb-3">
                    <div class="card h-100">
                        <div class="card-header fw-bold">⚡ Geomagnetic Activity</div>
                        <ul class="list-group list-group-flush">
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                🔴 Kp Index:
                                <span class="fw-bold fs-6">
                                    ${current.kp_index.toFixed(1)} / ${current.kp_index_max}
                                </span>
                            </li>
                            <li class="list-group-item">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <span>📊 Aurora Probability:</span>
                                    <span class="fw-bold">${probability.toFixed(0)}%</span>
                                </div>
                                <div class="progress" role="progressbar" aria-valuenow="${probability}" aria-valuemin="0" aria-valuemax="100">
                                    <div class="progress-bar" style="width: ${probability}%; background-color: ${probabilityColor};"></div>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>

                <div class="col mb-3">
                    <div class="card h-100">
                        <div class="card-header fw-bold">🕐 Best Viewing Window</div>
                        <ul class="list-group list-group-flush">
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                ⏰ Local Time:
                                <span class="fw-bold fs-6">
                                    ${current.best_viewing_window.start_hour}:00 - ${current.best_viewing_window.end_hour}:00
                                </span>
                            </li>
                            <li class="list-group-item">
                                <small class="text-muted">${current.best_viewing_window.description}</small>
                            </li>
                            <li class="list-group-item">
                                <small class="text-muted">
                                    <strong>📍 Location:</strong> ${location.latitude.toFixed(2)}°, ${location.longitude.toFixed(2)}°
                                </small>
                            </li>
                        </ul>
                    </div>
                </div>

                <div class="col mb-3">
                    <div class="card h-100">
                        <div class="card-header fw-bold">🎨 Expected Colors</div>
                        <ul class="list-group list-group-flush">
                            ${Object.entries(current.color_description).map(([color, description]) => `
                                <li class="list-group-item">
                                    <small>${description}</small>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            </div>

            <div class="row row-cols-1 mb-3">
                <div class="col">
                    <div class="card h-100">
                        <div class="card-header fw-bold">📈 Aurora Scale Guide</div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-auto">
                                    <small>
                                        <div><strong>0-2:</strong> No aurora</div>
                                        <div><strong>3:</strong> Very High latitudes</div>
                                        <div><strong>4:</strong> High latitudes possible</div>
                                    </small>
                                </div>
                                <div class="col-auto">
                                    <small>
                                        <div><strong>5:</strong> Northern regions likely</div>
                                        <div><strong>6:</strong> Wider view possible</div>
                                        <div><strong>7+:</strong> Low latitude possible</div>
                                    </small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            ${data.forecast && data.forecast.length > 0 ? `
                <div class="row row-cols-1 mb-3">
                    <div class="col">
                        <div class="card h-100">
                            <div class="card-header fw-bold">📅 Forecast</div>
                            <div class="card-body">
                                <div class="row row-cols-2 row-cols-sm-3 row-cols-lg-4">
                                    ${data.forecast.slice(0, 8).map((forecast, index) => {
                                        const kp = forecast.kp_index || 0;
                                        let color = '#dc3545';
                                        if (kp >= 7) color = '#28a745';
                                        else if (kp >= 5) color = '#ffc107';
                                        
                                        return `
                                            <div class="col">
                                                <div class="text-center p-2">
                                                    <div class="fw-bold small">+${index}h</div>
                                                    <div style="font-size: 24px; color: ${color};">◯</div>
                                                    <div class="small">Kp ${kp.toFixed(1)}</div>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ` : ''}

            <div class="row row-cols-1 mb-3">
                <div class="col">
                    <div class="alert alert-info" role="alert">
                        <strong>📌 Tips for Aurora Hunting:</strong>
                        <ul class="mb-0 mt-2">
                            <li>Travel away from light pollution (cities) for best viewing</li>
                            <li>Look towards the northern horizon during the recommended window</li>
                            <li>Dress warmly - aurora hunting can require waiting outside in cold</li>
                            <li>Higher Kp index means aurora could be visible further south</li>
                            <li>Green aurora is most common, red is from high altitude oxygen</li>
                            <li>Better visibility on clear, moonless nights</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="alert alert-warning" role="alert">
                Failed to load aurora predictions. Please try again later.
            </div>
        `;
    }
}

/**
 * Set up aurora update auto-refresh
 */
let auroraUpdateInterval;

function setupAuroraAutoRefresh() {
    // Refresh every 10 minutes (600000 ms)
    auroraUpdateInterval = setInterval(loadAurora, 600000);
}

function clearAuroraAutoRefresh() {
    if (auroraUpdateInterval) {
        clearInterval(auroraUpdateInterval);
    }
}
