// ======================
// Moon 
// ======================

//Load moon data
async function loadMoon() {
    const container = document.getElementById('moon-display');
    const data = await fetchJSONWithUI('/api/moon/report', container, 'Loading Moon data...');
    if (!data) return;

    // Display moon information if moon data is available
    if (data.moon) {
        const moon = data.moon;
        
        // Determine moon emoji based on illumination and phase
        const phaseEmojiMap = {
            "New Moon": "🌑",
            "Waxing Crescent": "🌒",
            "First Quarter": "🌓",
            "Waxing Gibbous": "🌔",
            "Full Moon": "🌕",
            "Waning Gibbous": "🌖",
            "Last Quarter": "🌗",
            "Waning Crescent": "🌘"
        };

        let moonEmoji = phaseEmojiMap[moon.phase_name] || '🌑';

        container.innerHTML = `
            <div class="d-flex flex-row align-items-center mb-3">
                <div class="p-2 icon-weather-lg">${moonEmoji}</div>
                <div class="p-2">
                    <div class="fw-bold fs-4">${moon.phase_name}</div>
                    <div>${moon.illumination_percent.toFixed(0)}% illuminated</div>
                </div>
            </div>

            <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-2 row-cols-xl-3 p-2 mb-3">
                <div class="col mb-3">
                    <div class="card h-100">
                        <div class="card-header fw-bold">🌑 Moon</div>
                        <ul class="list-group list-group-flush">
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                🌅 Rise:
                                <span class="fw-bold fs-6">
                                    ${new Date(moon.next_moonrise).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(moon.next_moonrise).toLocaleDateString([], {month: "numeric", day: "numeric"})})
                                </span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                🌇 Set:
                                <span class="fw-bold fs-6">
                                    ${new Date(moon.next_moonset).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(moon.next_moonset).toLocaleDateString([], {month: "numeric", day: "numeric"})})
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>
                
                <div class="col mb-3">
                    <div class="card h-100">
                        <div class="card-header fw-bold">📐 Position</div>
                        <ul class="list-group list-group-flush">
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                📏 Distance:
                                <span class="fw-bold fs-6">
                                    ${moon.distance_km ? Math.round(moon.distance_km).toLocaleString() + ' km' : 'N/A'}
                                </span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                📐 Altitude:
                                <span class="fw-bold fs-6">
                                    ${moon.altitude_deg}°
                                </span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                🧭 Azimuth:
                                <span class="fw-bold fs-6">
                                    ${moon.azimuth_deg}°
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>
                
                <div class="col mb-3">
                    <div class="card h-100">
                        <div class="card-header fw-bold">🌕 Next Events</div>
                        <ul class="list-group list-group-flush">
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                               🌕 Next Full Moon:
                                <span class="fw-bold fs-6">
                                    ${new Date(moon.next_full_moon).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(moon.next_full_moon).toLocaleDateString([], {month: "numeric", day: "numeric"})})
                                </span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                🌑 Next New Moon:
                                <span class="fw-bold fs-6">
                                    ${new Date(moon.next_new_moon).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(moon.next_new_moon).toLocaleDateString([], {month: "numeric", day: "numeric"})})
                                </span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                🌌 Next Dark Night:
                                <span class="fw-bold fs-6">
                                    ${new Date(moon.next_dark_night_start).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(moon.next_dark_night_start).toLocaleDateString([], {month: "numeric", day: "numeric"})})
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>

            </div>
        `;
    }
}

//Load next moon phases
async function loadNextMoonPhases() {
    const container = document.getElementById('moon-planner-display');
    const data = await fetchJSONWithUI('/api/moon/next-7-nights', container, 'Loading Moon planner data...', {
        pendingMessage: 'Cache not ready. Retrying...'
    });
    if (!data) return;

    try {
        // Check if container has weather-grid class, if not add it
        if (!container.classList.contains('weather-grid')) {
            container.classList.add('weather-grid');
        }

        clearContainer(container);

        // if forecast list is available
        if (data.next_7_nights && data.next_7_nights.length > 0) {
            // Class grid to container
            container.className = 'row row-cols-1 row-cols-sm-2 row-cols-lg-4 row-cols-xl-5 row-cols-xxl-6 p-2 mb-3';

            // We receive up to 12 hours of data, display all
            data.next_7_nights.forEach(moon => {
                const date = new Date(moon.date);
                const astrophoto_score = moon.astrophoto_score.toFixed(0);
                const dark_hours_illumination = moon.dark_hours.illumination.toFixed(2);
                const dark_hours_practical = moon.dark_hours.practical.toFixed(2);
                const dark_hours_strict = moon.dark_hours.strict.toFixed(2);
                const illumination_percent = moon.moon.illumination_percent.toFixed(0);
                const max_altitude = moon.moon.max_altitude;

                // Determine observation quality based on condition
                let quality = '';
                let qualityClass = '';
                if (astrophoto_score >= 90) {
                    quality = `Excellent - ${astrophoto_score}%`;
                    qualityClass = 'quality-excellent';
                } else if (astrophoto_score >= 70) {
                    quality = `Good - ${astrophoto_score}%`;
                    qualityClass = 'quality-good';
                } else if (astrophoto_score >= 50) {
                    quality = `Fair - ${astrophoto_score}%`;
                    qualityClass = 'quality-fair';
                } else if (astrophoto_score > 30) {
                    quality = `Poor - ${astrophoto_score}%`;
                    qualityClass = 'quality-poor';
                } else {
                    quality = `Bad - ${astrophoto_score}%`;
                    qualityClass = 'quality-bad';
                }

                const item = document.createElement('div');
                item.className = 'col mb-3';
                item.innerHTML = `
                    <div class="card h-100">
                        <div class="card-header ${qualityClass}">
                            <strong>${quality}</strong>
                        </div>
                        <div class="card-body">
                            <h5 class="card-title card-title-weather">${date.toLocaleDateString()}</h5>
                            <ul class="list-group list-group-flush">
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    🌗 Illumination:
                                    <span>${illumination_percent}%</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    📐 Max Altitude:
                                    <span >${max_altitude}°</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    🌌 Dark-time:
                                </li>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    &nbsp;>&nbsp;Strict:
                                    <span>${dark_hours_strict} h</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    &nbsp;>&nbsp;Practical:
                                    <span>${dark_hours_practical} h</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    &nbsp;>&nbsp;Illumination:
                                    <span>${dark_hours_illumination} h</span>
                                </li>                         
                            </ul>
                        </div>
                    </div>
                `;
                container.appendChild(item);
            });
        }

    } catch (error) {
        console.error('Error loading moon data:', error);
        container.innerHTML = '<div class="alert alert-danger">Failed to load moon data</div>';
    }
}

//Load best observing nights
async function loadBestDarkWindow() {
    const container = document.getElementById('window-display');
    const containerLoader = document.getElementById('window-loader-info-notice');
    containerLoader.innerHTML = 'Loading best dark window data...';
    containerLoader.style.display = 'block';

    const retryOptions = {
        maxAttempts: 6,
        baseDelayMs: 1000,
        maxDelayMs: 12000,
        timeoutMs: 15000,
        shouldRetryData: (payload) => payload && payload.status === 'pending',
        onRetry: ({ reason, attempt, maxAttempts, waitMs, data }) => {
            const seconds = Math.max(1, Math.round(waitMs / 1000));
            if (reason === 'data' && data && data.message) {
                containerLoader.innerHTML = `${data.message} Retrying in ${seconds}s (${attempt}/${maxAttempts})`;
                return;
            }
            containerLoader.innerHTML = `Retrying in ${seconds}s (${attempt}/${maxAttempts})`;
        }
    };

    try {
        // Fake error to catch error display
        //throw new Error('Test error');

        container.innerHTML = '';

        // Get dark window
        const data = await fetchJSONWithRetry('/api/moon/dark-window', {}, retryOptions);

        // Cache pending (retries exhausted)
        if (data.status && data.status === 'pending') {
            container.innerHTML = `<div class="info-notice">${data.message}</div>`;
            containerLoader.style.display = 'none';
            return;
        }

        // Check if dark window data exists
        if (!data.next_dark_night || !data.next_dark_night.start || !data.next_dark_night.end) {
            container.innerHTML = '<div class="error-box">No dark window data available</div>';
            containerLoader.style.display = 'none';
            return;
        }

        const start = new Date(data.next_dark_night.start);
        const end   = new Date(data.next_dark_night.end);

        // Bloc normal
        const item = document.createElement("div");
        item.className = "col mb-3";

        item.innerHTML = `
            <div class="card h-100">
                <div class="card-header">
                    🌌 Next Dark Window
                </div>
                <ul class="list-group list-group-flush">
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        🌆 Start:
                        <span>
                            ${start.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}
                            (${start.toLocaleDateString([], {month: "numeric", day: "numeric"})})
                        </span>
                    </li>
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        🌅 End:
                        <span>
                            ${end.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}
                            (${end.toLocaleDateString([], {month: "numeric", day: "numeric"})})
                        </span>
                    </li>
                </ul>
            </div>
        `;
        container.appendChild(item);


        
        const modes = ["strict", "practical", "illumination"];

        const bestWindowsResponse = await fetchJSONWithRetry('/api/tonight/best-window?mode=all', {}, {
            ...retryOptions,
            onRetry: null
        });

        const bestWindowsByMode = bestWindowsResponse && bestWindowsResponse.modes
            ? bestWindowsResponse.modes
            : {};

        for (const mode of modes) {
            const modeData = bestWindowsByMode[mode];

            if (!modeData || modeData.status === 'pending' || modeData.error || !modeData.best_window || !modeData.best_window.start) {
                const errorItem = document.createElement("div");
                errorItem.className = "col mb-3";
                const message = modeData && modeData.status === 'pending'
                    ? modeData.message || 'Cache pending'
                    : 'No dark window';
                errorItem.innerHTML = `
                    <div class="card h-100">
                        <div class="card-header">
                            ${mode.toUpperCase()}
                        </div>
                        <div class="card-body">
                            <div class="card-text">
                                ${message}
                            </div>
                        </div>
                    </div>
                `;
                container.appendChild(errorItem);
                continue;
            }

            let start_txt = "";
            let end_txt = "";

            if(modeData.best_window.start == 'Not found') {
                start_txt = 'Not found';
            } else {
                const start = new Date(modeData.best_window.start);
                start_txt = `${start.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})} (${start.toLocaleDateString([], {month: "numeric", day: "numeric"})})`;
                
            }
            if(modeData.best_window.end == 'Not found') {
                end_txt = 'Not found';
            } else {
                const end = new Date(modeData.best_window.end);
                end_txt = `${end.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})} (${end.toLocaleDateString([], {month: "numeric", day: "numeric"})})`;
                
            }

            // Bloc normal
            const item = document.createElement("div");
            item.className = "col mb-3";

            item.innerHTML = `
                <div class="card h-100">
                    <div class="card-header">
                        ${mode.toUpperCase()}
                    </div>
                    <ul class="list-group list-group-flush">
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            💯 Score:
                            <span>${modeData.best_window.score}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            🌚 Moon condition:
                            <span>${modeData.best_window.moon_condition}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            🌗 Start:
                            <span>${start_txt}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            🌗 End:
                            <span>${end_txt}</span>
                        </li>
                    </ul>
                </div>
            `;

            container.appendChild(item);
        }

        
        containerLoader.style.display = 'none';



    } catch (error) {
        console.error('Error loading dark window data:', error);
        const containerError = document.getElementById('window-loader-info-notice');
        containerError.className = 'alert alert-danger';
        containerError.innerHTML = 'Failed to load dark window data';
    }
}