// ======================
// Sun 
// ======================

//Load Sun data for today
async function loadSun() {
    const container = document.getElementById('sun-display');
    const data = await fetchJSONWithUI('/api/sun/today', container, 'Loading Sun data...', {
        pendingMessage: 'Cache not ready. Retrying...'
    });
    if (!data) return;

    try {
        // Empty container
        clearContainer(container);

        // Display sun information
        container.innerHTML = `
            <div class="d-flex flex-row align-items-center mb-3">
                <div class="p-2 icon-weather-lg">☀️</div>
                <div class="p-2">
                    <div class="fw-bold fs-4">Sun & Twilight Times</div>
                    <div>For astronomical observation planning</div>
                </div>
            </div>

            <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-2 row-cols-xl-4 p-2 mb-3">
                <div class="col mb-3">
                    <div class="card h-100">
                        <div class="card-header fw-bold">☀️ Sun</div>
                        <ul class="list-group list-group-flush">
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                🌇 Set:
                                <span class="fw-bold fs-6">
                                    ${new Date(data.sun.sunset).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(data.sun.sunset).toLocaleDateString([], {month: "numeric", day: "numeric"})})
                                </span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                🌅 Rise:
                                <span class="fw-bold fs-6">
                                    ${new Date(data.sun.sunrise).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(data.sun.sunrise).toLocaleDateString([], {month: "numeric", day: "numeric"})})
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>
                
                <div class="col mb-3">
                    <div class="card h-100">
                        <div class="card-header fw-bold">🌆 Civil Twilight</div>
                        <ul class="list-group list-group-flush">
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                Dusk:
                                <span class="fw-bold fs-6">
                                    ${new Date(data.sun.civil_dusk).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(data.sun.civil_dusk).toLocaleDateString([], {month: "numeric", day: "numeric"})})
                                </span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                Dawn:
                                <span class="fw-bold fs-6">
                                    ${new Date(data.sun.civil_dawn).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(data.sun.civil_dawn).toLocaleDateString([], {month: "numeric", day: "numeric"})})
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>
                
                <div class="col mb-3">
                    <div class="card h-100">
                        <div class="card-header fw-bold">⚓ Nautical Twilight</div>
                        <ul class="list-group list-group-flush">
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                Dusk:
                                <span class="fw-bold fs-6">
                                    ${new Date(data.sun.nautical_dusk).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(data.sun.nautical_dusk).toLocaleDateString([], {month: "numeric", day: "numeric"})})
                                </span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                Dawn:
                                <span class="fw-bold fs-6">
                                    ${new Date(data.sun.nautical_dawn).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(data.sun.nautical_dawn).toLocaleDateString([], {month: "numeric", day: "numeric"})})
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div class="col mb-3">
                    <div class="card h-100">
                        <div class="card-header fw-bold">🌌 Astronomical Twilight</div>
                        <ul class="list-group list-group-flush">
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                Dusk:
                                <span class="fw-bold fs-6">
                                    ${new Date(data.sun.astronomical_dusk).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(data.sun.astronomical_dusk).toLocaleDateString([], {month: "numeric", day: "numeric"})})
                                </span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                Dawn:
                                <span class="fw-bold fs-6">
                                    ${new Date(data.sun.astronomical_dawn).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${new Date(data.sun.astronomical_dawn).toLocaleDateString([], {month: "numeric", day: "numeric"})})
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>

            </div>
        `;
    } catch (error) {
        console.error('Error loading weather:', error);
        container.innerHTML = '<div class="error-box">Failed to load Sun data</div>';
    }
}