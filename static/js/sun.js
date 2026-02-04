// ======================
// Sun 
// ======================

//Load Sun data for today
async function loadSun() {
    const container = document.getElementById('sun-display');
    container.innerHTML = '<div class="loading">Loading Sun data...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/api/sun/today`);
        const data = await response.json();
        
        //console.log(data);

        if (data.error) {
            container.innerHTML = `<div class="error-box">${data.error}</div>`;
            return;
        }

        // Cache pending
        if (data.status && data.status === 'pending') {
            container.innerHTML = `<div class="info-notice">${data.message}</div>`;
            return;
        }
        
        // Empty container
        container.innerHTML = '';
        

        // Display sun information
        container.innerHTML = `
            <div class="sun-header">
                <div class="sun-icon">☀️</div>
                <div class="sun-details">
                    <div class="sun-title">Sun & Twilight Times</div>
                    <div class="sun-subtitle">For astronomical observation planning</div>
                </div>
            </div>
            <div class="sun-info">
                <div class="sun-section">
                    <div class="sun-section-title">☀️ Sun</div>
                    <div class="sun-row">
                        <span class="sun-label">🌇 Set:</span>
                        <span class="sun-value">
                            ${new Date(data.sun.sunset).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(data.sun.sunset).toLocaleDateString([], {month: "numeric", day: "numeric"})})
                        </span>
                    </div>
                    <div class="sun-row">
                        <span class="sun-label">🌅 Rise:</span>
                        <span class="sun-value">
                            ${new Date(data.sun.sunrise).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(data.sun.sunrise).toLocaleDateString([], {month: "numeric", day: "numeric"})})
                        </span>
                    </div>
                </div>
                <div class="sun-section">
                    <div class="sun-section-title">🌆 Civil Twilight</div>
                    <div class="sun-row">
                        <span class="sun-label">Dusk:</span>
                        <span class="sun-value">
                            ${new Date(data.sun.civil_dusk).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(data.sun.civil_dusk).toLocaleDateString([], {month: "numeric", day: "numeric"})})
                        </span>
                    </div>
                    <div class="sun-row">
                        <span class="sun-label">Dawn:</span>
                        <span class="sun-value">
                            ${new Date(data.sun.civil_dawn).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(data.sun.civil_dawn).toLocaleDateString([], {month: "numeric", day: "numeric"})})
                        </span>
                    </div>
                </div>
                <div class="sun-section">
                    <div class="sun-section-title">⚓ Nautical Twilight</div>
                    <div class="sun-row">
                        <span class="sun-label">Dusk:</span>
                        <span class="sun-value">
                            ${new Date(data.sun.nautical_dusk).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(data.sun.nautical_dusk).toLocaleDateString([], {month: "numeric", day: "numeric"})})
                        </span>
                    </div>
                    <div class="sun-row">
                        <span class="sun-label">Dawn:</span>
                        <span class="sun-value">
                            ${new Date(data.sun.nautical_dawn).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(data.sun.nautical_dawn).toLocaleDateString([], {month: "numeric", day: "numeric"})})
                        </span>
                    </div>
                </div>
                <div class="sun-section">
                    <div class="sun-section-title">🌌 Astronomical Twilight</div>
                    <div class="sun-row">
                        <span class="sun-label">Dusk:</span>
                        <span class="sun-value">
                            ${new Date(data.sun.astronomical_dusk).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(data.sun.astronomical_dusk).toLocaleDateString([], {month: "numeric", day: "numeric"})})
                        </span>
                    </div>
                    <div class="sun-row">
                        <span class="sun-label">Dawn:</span>
                        <span class="sun-value">
                            ${new Date(data.sun.astronomical_dawn).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(data.sun.astronomical_dawn).toLocaleDateString([], {month: "numeric", day: "numeric"})})
                        </span>
                    </div>
                    <div class="sun-row">
                        <span class="sun-label">True Night hours:</span>
                        <span class="sun-value">${data.sun.true_night_hours}</span>
                    </div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading weather:', error);
        container.innerHTML = '<div class="error-box">Failed to load Sun data</div>';
    }
}