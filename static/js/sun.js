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
                                <span>🌇 Set:</span>
                                <span class="fw-bold">
                                    ${formatTimeThenDate(new Date(data.sun.sunset))}
                                </span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span>🌅 Rise:</span>
                                <span class="fw-bold">
                                    ${formatTimeThenDate(new Date(data.sun.sunrise))}
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
                                <span>Dusk:</span>
                                <span class="fw-bold">
                                    ${formatTimeThenDate(new Date(data.sun.civil_dusk))}
                                </span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span>Dawn:</span>
                                <span class="fw-bold">
                                    ${formatTimeThenDate(new Date(data.sun.civil_dawn))}
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
                                <span>Dusk:</span>
                                <span class="fw-bold">
                                    ${formatTimeThenDate(new Date(data.sun.nautical_dusk))}
                                </span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span>Dawn:</span>
                                <span class="fw-bold">
                                    ${formatTimeThenDate(new Date(data.sun.nautical_dawn))}
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
                                <span>Dusk:</span>
                                <span class="fw-bold">
                                    ${formatTimeThenDate(new Date(data.sun.astronomical_dusk))}
                                </span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span>Dawn:</span>
                                <span class="fw-bold">
                                    ${formatTimeThenDate(new Date(data.sun.astronomical_dawn))}
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