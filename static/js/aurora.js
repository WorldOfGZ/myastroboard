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

    //console.log("Aurora data received:", data);
    
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
        const probabilityLevel = current.probability_level || '';
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
                        <div class="p-2 icon-weather-lg">${escapeHtml(emoji)}</div>
                        <div class="p-2">
                            <div class="fw-bold fs-4">${escapeHtml(current.visibility_level)}</div>
                            <div class="text-muted">${escapeHtml(current.visibility_description)}</div>
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
                                <span>🔴 Kp Index:</span>
                                <span class="fw-bold">
                                    ${current.kp_index.toFixed(1)} / ${current.kp_index_max.toFixed(1)}
                                </span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span>📊 Aurora Probability:</span>
                                <span class="fw-bold">${probability.toFixed(0)}%${probabilityLevel ? ` (${escapeHtml(probabilityLevel)})` : ''}</span>
                            </li>
                            <li class="list-group-item">
                                <div class="progress mb-2 mt-1" role="progressbar" aria-valuenow="${probability.toFixed(0)}" aria-valuemin="0" aria-valuemax="100">
                                    <div class="progress-bar" style="width: ${probability.toFixed(0)}%; background-color: ${escapeHtml(probabilityColor)};"></div>
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
                                <span>⏰ Local Time:</span>
                                <span class="fw-bold">
                                    ${escapeHtml(current.best_viewing_window.start_hour)}:00 - ${escapeHtml(current.best_viewing_window.end_hour)}:00
                                </span>
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
                                    <small>${escapeHtml(description)}</small>
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
                                <div class="alert alert-info" role="alert">
                                    The Kp index values are provided by NOAA. Sudden changes between 'Now' and forecasted values may indicate predicted geomagnetic events or storms.<br>
                                    These forecasts are subject to change and reflect NOAA's latest predictions.
                                </div>
                                <div class="row row-cols-2 row-cols-sm-3 row-cols-lg-4 text-center g-3">
                                ${data.forecast.slice(0, 8).map((f,i)=>{
                                    const kp = f.kp_index || 0;
                                    let color='danger';
                                    if(kp>=7) color='success';
                                    else if(kp>=5) color='warning';
                                    const size = 24 + kp*2; // Round bubble slightly larger if Kp is high

                                    return `
                                    <div class="col d-flex flex-column align-items-center">
                                        <div class="fw-bold small mb-1">${formatTimeThenDate(new Date(f.timestamp))}</div>
                                        <div class="rounded-circle bg-${color} shadow-sm mb-1" 
                                            style="width:${size}px; height:${size}px; line-height:${size}px;"></div>
                                        <div class="small">Kp ${kp.toFixed(1)}<br>
                                        ${probability.toFixed(0)}%${probabilityLevel ? ` (${escapeHtml(probabilityLevel)})` : ''}</div>
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
        // Error block
        const errorBlock = document.createElement('div');
        errorBlock.className = 'alert alert-warning';
        errorBlock.setAttribute('role', 'alert');
        errorBlock.textContent = 'Failed to load aurora predictions. Please try again later.';
        container.appendChild(errorBlock);
    }
}

