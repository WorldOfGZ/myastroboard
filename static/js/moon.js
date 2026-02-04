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
            <div class="moon-header">
                <div class="moon-icon">${moonEmoji}</div>
                <div class="moon-details">
                    <div class="moon-phase">${moon.phase_name}</div>
                    <div class="moon-illumination">${moon.illumination_percent.toFixed(0)}% illuminated</div>
                </div>
            </div>
            <div class="moon-info">
                <div class="moon-section">
                    <div class="moon-section-title">🌑 Moon</div>
                    <div class="moon-row">
                        <span class="moon-label">🌅 Rise:</span>
                        <span class="moon-value">${new Date(moon.next_moonrise).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(moon.next_moonrise).toLocaleDateString([], {month: "numeric", day: "numeric"})})</span>
                    </div>
                    <div class="moon-row">
                        <span class="moon-label">🌇 Set:</span>
                        <span class="moon-value">${new Date(moon.next_moonset).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(moon.next_moonset).toLocaleDateString([], {month: "numeric", day: "numeric"})})</span>
                    </div>
                </div>
                <div class="moon-section">
                    <div class="moon-section-title">📐 Position</div>
                    <div class="moon-row">
                        <span class="moon-label">📏 Distance:</span>
                        <span class="moon-value">${moon.distance_km ? Math.round(moon.distance_km).toLocaleString() + ' km' : 'N/A'}</span>
                    </div>
                    <div class="moon-row">
                        <span class="moon-label">📐 Altitude:</span>
                        <span class="moon-value">${moon.altitude_deg}°</span>
                    </div>
                    <div class="moon-row">
                        <span class="moon-label">🧭 Azimuth:</span>
                        <span class="moon-value">${moon.azimuth_deg}°</span>
                    </div>
                </div>
                <div class="moon-section">
                    <div class="moon-section-title">🌕 Next Events</div>
                    <div class="moon-row">
                        <span class="moon-label">🌕 Next Full Moon:</span>
                        <span class="moon-value">${new Date(moon.next_full_moon).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(moon.next_full_moon).toLocaleDateString([], {month: "numeric", day: "numeric"})})</span>
                    </div>
                    <div class="moon-row">
                        <span class="moon-label">🌑 Next New Moon:</span>
                        <span class="moon-value">${new Date(moon.next_new_moon).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(moon.next_new_moon).toLocaleDateString([], {month: "numeric", day: "numeric"})})</span>
                    </div>
                    <div class="moon-row">
                        <span class="moon-label">🌌 Next Dark Night:</span>
                        <span class="moon-value">${new Date(moon.next_dark_night_start).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(moon.next_dark_night_start).toLocaleDateString([], {month: "numeric", day: "numeric"})})</span>
                    </div>
                </div>
            </div>
        `;
    }
}

//Load next moon phases
async function loadNextMoonPhases() {
    const container = document.getElementById('moon-planner-display');
    container.innerHTML = '<div class="loading">Loading Moon planner data...</div>';

    try {
        const response = await fetch(`${API_BASE}/api/moon/next-7-nights`);
        const data = await response.json();
        
        //console.log(data);

        if (data.error) {
            // Remove grid classes if error
            container.classList.remove('weather-grid');
            container.innerHTML = `<div class="error-box">${data.error}</div>`;
            return;
        }

        // Cache pending
        if (data.status && data.status === 'pending') {
            container.classList.remove('weather-grid');
            container.innerHTML = `<div class="info-notice">${data.message}</div>`;
            return;
        }

        // Check if container has weather-grid class, if not add it
        if (!container.classList.contains('weather-grid')) {
            container.classList.add('weather-grid');
        }
        
        container.innerHTML = '';

        // if forecast list is available
        if (data.next_7_nights && data.next_7_nights.length > 0) {
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
                item.className = 'weather-item';
                item.innerHTML = `
                    <div class="weather-time">${date.toLocaleDateString()}</div>
                    <div class="weather-quality ${qualityClass}">${quality}</div>
                    <div class="weather-astro-info">
                        <div class="weather-row">
                            <span class="weather-label">🌗 Illumination:</span>
                            <span class="weather-value">${illumination_percent}%</span>
                        </div>
                        <div class="weather-row">
                            <span class="weather-label">📐 Max Altitude:</span>
                            <span class="weather-value">${max_altitude}%</span>
                        </div>
                        <div class="weather-row">
                            <span class="weather-label">🌌 Dark-time:</span>
                            <span class="weather-value">&nbsp;</span>
                        </div>
                        <div class="weather-row">
                            <span class="weather-label">&nbsp;>&nbsp;Strict:</span>
                            <span class="weather-value">${dark_hours_strict} h</span>
                        </div>
                        <div class="weather-row">
                            <span class="weather-label">&nbsp;>&nbsp;Practical:</span>
                            <span class="weather-value">${dark_hours_practical} h</span>
                        </div>
                        <div class="weather-row">
                            <span class="weather-label">&nbsp;>&nbsp;Illumination:</span>
                            <span class="weather-value">${dark_hours_illumination} h</span>
                        </div>
                    </div>
                `;
                container.appendChild(item);
            });
        }
    
    } catch (error) {
        console.error('Error loading moon data:', error);
        container.innerHTML = '<div class="error-box">Failed to load moon data</div>';
    }
}

//Load best observing nights
async function loadBestDarkWindow() {
    const container = document.getElementById('window-display');
    const containerLoader = document.getElementById('window-loader-info-notice');
    containerLoader.innerHTML = '<div class="loading">Loading best dark window data...</div>';
    containerLoader.style.display = 'block';

    try {

        container.innerHTML = '';

        // Get dark window
        const response = await fetch(
            `${API_BASE}/api/moon/dark-window`
        );

        const data = await response.json();        

        // Cache pending
        if (data.status && data.status === 'pending') {
            container.innerHTML = `<div class="info-notice">${data.message}</div>`;
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
        item.className = "weather-item";

        item.innerHTML = `
            <div class="weather-time">Dark Window</div>

            <div class="weather-astro-info">
                <div class="weather-row">
                    <span class="weather-label">🌆 Start:</span>
                    <span class="weather-value">
                        ${start.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}
                        (${start.toLocaleDateString([], {month: "numeric", day: "numeric"})})
                    </span>
                </div>

                <div class="weather-row">
                    <span class="weather-label">🌅 End:</span>
                    <span class="weather-value">
                        ${end.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}
                        (${end.toLocaleDateString([], {month: "numeric", day: "numeric"})})
                    </span>
                </div>
            </div>
        `;
        container.appendChild(item);


        
        const modes = ["strict", "practical", "illumination"];

        for (const mode of modes) {

            const response = await fetch(
                `${API_BASE}/api/tonight/best-window?mode=${mode}`
            );

            const data = await response.json();
            //console.log(data);

            // Si erreur → affiche un bloc d’erreur mais continue
            if (data.error || !data.best_window || !data.best_window.start) {
                const errorItem = document.createElement("div");
                errorItem.className = "weather-item";
                errorItem.innerHTML = `
                    <div class="weather-time">${mode.toUpperCase()}</div>
                    <div class="error-box">No dark window</div>
                `;
                container.appendChild(errorItem);
                continue;
            }

            let start_txt = "";
            let end_txt = "";

            if(data.best_window.start == 'Not found') {
                start_txt = 'Not found';
            } else {
                const start = new Date(data.best_window.start);
                start_txt = `${start.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})} (${start.toLocaleDateString([], {month: "numeric", day: "numeric"})})`;
                
            }
            if(data.best_window.end == 'Not found') {
                end_txt = 'Not found';
            } else {
                const end = new Date(data.best_window.end);
                end_txt = `${end.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})} (${end.toLocaleDateString([], {month: "numeric", day: "numeric"})})`;
                
            }


            // Bloc normal
            const item = document.createElement("div");
            item.className = "weather-item";

            item.innerHTML = `
                <div class="weather-time">${mode.toUpperCase()}</div>

                <div class="weather-astro-info">
                    <div class="weather-row">
                        <span class="weather-label">💯 Score:</span>
                        <span class="weather-value">${data.best_window.score}</span>
                    </div>
                    <div class="weather-row">
                        <span class="weather-label">🌚 Moon condition:</span>
                        <span class="weather-value">${data.best_window.moon_condition}</span>
                    </div>
                    <div class="weather-row">
                        <span class="weather-label">🌗 Start:</span>
                        <span class="weather-value">${start_txt}</span>
                    </div>
                    <div class="weather-row">
                        <span class="weather-label">🌗 End:</span>
                        <span class="weather-value">${end_txt}</span>
                    </div>
                </div>
            `;

            container.appendChild(item);
        }

        
        containerLoader.style.display = 'none';



    } catch (error) {
        console.error('Error loading dark window data:', error);
        container.innerHTML = '<div class="error-box">Failed to load dark window data</div>';
    }
}