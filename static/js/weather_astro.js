// ======================
// Astrophotography Weather
// ======================

// Global variables for astro weather
let astroWeatherData = null;
let astroWeatherUpdateInterval = null;

/**
 * Load comprehensive astrophotography weather analysis
 */
async function loadAstroWeather() {
    const container = document.getElementById('astro-weather-display');
    const loadingDiv = document.getElementById('astro-weather-loading');
    const errorDiv = document.getElementById('astro-weather-error');
    
    if (loadingDiv) loadingDiv.style.display = 'block';
    if (errorDiv) errorDiv.style.display = 'none';
    if (container) container.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE}/api/weather/astro-analysis?hours=24`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        astroWeatherData = data;
        
        if (loadingDiv) loadingDiv.style.display = 'none';
        if (container) container.style.display = 'block';
        
        // Render different sections
        renderCurrentAstroConditions(data.current_conditions);
        renderBestObservationPeriods(data.best_observation_periods);
        renderAstroWeatherCharts(data.hourly_data);
        renderWeatherAlerts(data.weather_alerts);
        
        //console.log('Astro weather data loaded:', data);
        
    } catch (error) {
        console.error('Error loading astro weather:', error);
        
        if (loadingDiv) loadingDiv.style.display = 'none';
        if (errorDiv) {
            errorDiv.style.display = 'block';
            errorDiv.innerHTML = `
                <div class="col">
                    <div class="card h-100 bg-danger-subtle">
                        <div class="card-body">
                            <h5 class="card-title">☁️ Error...</h5>
                            <p class="card-text">Failed to load astrophotography weather data: ${error.message}</p>
                        </div>
                    </div>
                </div>
            `;
        }
    }
}

/**
 * Render current astrophotography conditions summary
 */
function renderCurrentAstroConditions(conditions) {
    const container = document.getElementById('astro-current-conditions');
    if (!container || !conditions) return;
    
    // Quality indicators
    const seeingQuality = getSeeingQualityText(conditions.seeing_pickering);
    const transparencyQuality = getTransparencyQualityText(conditions.transparency_score);
    const dewRiskColor = getDewRiskColor(conditions.dew_risk_level);
    const trackingQuality = getTrackingQualityText(conditions.tracking_stability_score);
    const cloudQuality = getCloudQualityText(conditions.cloud_discrimination);
    
    container.innerHTML = `
        <div class="col mb-3">
            <div class="card h-100">
                <div class="card-body">👁️ Seeing</div>
                <div class="card-body text-center">
                    <div class="astro-main-value text-primary">${conditions.seeing_pickering}/10</div>
                    <div class="astro-quality-text ${seeingQuality.class}">${seeingQuality.text}</div>
                    <div class="fw-light fst-italic">Pickering Scale</div>
                </div>
            </div>
        </div>

        <div class="col mb-3">
            <div class="card h-100">
                <div class="card-body">✨ Transparency</div>
                <div class="card-body text-center">
                    <div class="astro-main-value text-primary">${conditions.limiting_magnitude}m</div>
                    <div class="astro-quality-text ${transparencyQuality.class}">${transparencyQuality.text}</div>
                    <div class="fw-light fst-italic">Limiting Magnitude</div>
                </div>
            </div>
        </div>

        <div class="col mb-3">
            <div class="card h-100">
                <div class="card-body">☁️ Cloud Layers</div>
                <div class="card-body text-center">
                    <div class="astro-main-value text-primary">${Math.round(conditions.cloud_discrimination)}%</div>
                    <div class="astro-quality-text ${cloudQuality.class}">${cloudQuality.text}</div>
                    <div class="fw-light fst-italic">Discrimination Score</div>
                </div>
            </div>
        </div>

        <div class="col mb-3">
            <div class="card h-100">
                <div class="card-body">💧 Dew Risk</div>
                <div class="card-body text-center">
                    <div class="astro-main-value text-primary">${Math.round(conditions.dew_point_spread * 10) / 10}°C</div>
                    <div class="astro-quality-text ${dewRiskColor}">${conditions.dew_risk_level}</div>
                    <div class="fw-light fst-italic">Temperature Spread</div>
                </div>
            </div>
        </div>

        <div class="col mb-3">
            <div class="card h-100">
                <div class="card-body">🎯 Tracking</div>
                <div class="card-body text-center">
                    <div class="astro-main-value text-primary">${conditions.tracking_stability_score}%</div>
                    <div class="astro-quality-text ${trackingQuality.class}">${trackingQuality.text}</div>
                    <div class="fw-light fst-italic">Wind Stability</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render best observation periods
 */
function renderBestObservationPeriods(periods) {
    const container = document.getElementById('astro-best-periods');
    if (!container) return;

    // Fake periods for testing
    /*
    periods = [
        {
            start: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
            end: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
            duration_hours: 2,
            average_quality: 85.5
        },
        {
            start: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
            end: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString(),
            duration_hours: 2,
            average_quality: 78.2
        }
    ];
    //*/
    
    if (!periods || periods.length === 0) {
        container.innerHTML = `
            <h1 class="astro-icon text-center">😔</h1>
            <div class="text-center">No optimal observation periods found in the next 24 hours</div>
        `;
        return;
    }
    
    const periodsHtml = periods.map((period, index) => {
        const startTime = new Date(period.start);
        const endTime = new Date(period.end);
        const duration = period.duration_hours;
        
        return `
            <div class="col mb-3">
                <div class="card h-100">
                    <div class="card-body">
                        <div class="card-text fw-bold">
                            ${startTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} - 
                            ${endTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                        </div>
                        <div class="card-text fw-bold">
                            ${startTime.toLocaleDateString([], {month: 'short', day: 'numeric'})}
                            ${startTime.toDateString() !== endTime.toDateString() ? 
                                ' - ' + endTime.toLocaleDateString([], {month: 'short', day: 'numeric'}) : ''}
                        </div>
                    </div>
                    <ul class="list-group list-group-flush">
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            Duration:
                            <span class="badge text-bg-primary rounded-pill">${duration.toFixed(1)}h</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            Quality:
                            <span class="badge text-bg-primary rounded-pill">${period.average_quality.toFixed(1)}%</span>
                        </li>
                    </ul>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = `
        <div class="row row-cols-2 row-cols-sm-2 row-cols-lg-4 row-cols-xl-6 p-2">
            ${periodsHtml}
        </div>
    `;
}

/**
 * Render astrophotography weather charts
 */
function renderAstroWeatherCharts(hourlyData) {
    if (!hourlyData || hourlyData.length === 0) return;
    
    const labels = hourlyData.map(item => {
        const date = new Date(item.datetime);
        return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    });
    
    // Seeing and Transparency Chart
    renderSeeingTransparencyChart(labels, hourlyData);
    
    // Cloud Layers Chart  
    renderCloudLayersChart(labels, hourlyData);
    
    // Dew Point and Tracking Chart
    renderDewTrackingChart(labels, hourlyData);
}

/**
 * Render seeing and transparency chart
 */
function renderSeeingTransparencyChart(labels, data) {
    const ctx = document.getElementById('astro-seeing-chart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (window.astroSeeingChart) {
        window.astroSeeingChart.destroy();
    }
    
    const seeingData = data.map(item => item.seeing_pickering * 10); // Convert to percentage scale
    const transparencyData = data.map(item => item.transparency_score);
    
    window.astroSeeingChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Seeing (Pickering × 10)',
                    data: seeingData,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Transparency',
                    data: transparencyData,
                    borderColor: 'rgb(168, 85, 247)',
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: true,
                    text: '👁️ Seeing & ✨ Transparency Forecast'
                },
                legend: {
                    display: true
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Quality Score (%)'
                    },
                    min: 0,
                    max: 100
                }
            }
        }
    });
}

/**
 * Render cloud layers discrimination chart
 */
function renderCloudLayersChart(labels, data) {
    const ctx = document.getElementById('astro-clouds-chart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (window.astroCloudsChart) {
        window.astroCloudsChart.destroy();
    }
    
    const highCloudImpact = data.map(item => item.high_cloud_impact);
    const midCloudImpact = data.map(item => item.mid_cloud_impact);
    const lowCloudImpact = data.map(item => item.low_cloud_impact);
    
    window.astroCloudsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'High Cloud Impact',
                    data: highCloudImpact,
                    borderColor: 'rgb(34, 197, 94)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    borderWidth: 2,
                    tension: 0.4
                },
                {
                    label: 'Mid Cloud Impact',
                    data: midCloudImpact,
                    borderColor: 'rgb(251, 191, 36)',
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    borderWidth: 2,
                    tension: 0.4
                },
                {
                    label: 'Low Cloud Impact',
                    data: lowCloudImpact,
                    borderColor: 'rgb(239, 68, 68)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: true,
                    text: '☁️ Cloud Layer Impact Analysis'
                },
                legend: {
                    display: true
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Cloud Impact (%)'
                    },
                    min: 0,
                    max: 100
                }
            }
        }
    });
}

/**
 * Render dew point and tracking stability chart
 */
function renderDewTrackingChart(labels, data) {
    const ctx = document.getElementById('astro-conditions-chart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (window.astroConditionsChart) {
        window.astroConditionsChart.destroy();
    }
    
    const dewRiskScore = data.map(item => item.dew_risk_score);
    const trackingScore = data.map(item => item.tracking_stability_score);
    
    window.astroConditionsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Dew Risk Score',
                    data: dewRiskScore,
                    borderColor: 'rgb(6, 182, 212)',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    borderWidth: 3,
                    tension: 0.4
                },
                {
                    label: 'Tracking Stability',
                    data: trackingScore,
                    borderColor: 'rgb(245, 101, 101)',
                    backgroundColor: 'rgba(245, 101, 101, 0.1)',
                    borderWidth: 3,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: true,
                    text: '💧 Dew Risk & 🎯 Tracking Stability'
                },
                legend: {
                    display: true
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Score (0-100%)'
                    },
                    min: 0,
                    max: 100
                }
            }
        }
    });
}

/**
 * Render weather alerts for astrophotography
 */
function renderWeatherAlerts(alerts) {
    const container = document.getElementById('astro-weather-alerts');
    if (!container) return;
    
    if (!alerts || alerts.length === 0) {
        container.innerHTML = `
            <div class="alert alert-success" role="alert">
                <div class="fw-bold">
                    <span>✅ No weather alerts for astrophotography</span>
                </div>
            </div>
        `;
        return;
    }
    
    const alertsHtml = alerts.map(alert => {
        const alertTime = new Date(alert.time);
        const severityIcon = getSeverityIcon(alert.severity);
        
        return `
            <div class="alert alert-${alert.severity === 'HIGH' ? 'danger' : 'warning'}" role="alert">
                <div class="fw-bold">
                    <span>${severityIcon}</span>
                    <span>${alert.type.replace('_', ' ')}</span>
                    <span>${alertTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
                </div>
                <div>${alert.message}</div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = `
        <div class="mb-2">Conditions affecting astrophotography in the next 6 hours</div>
        <div class="astro-alerts-list">
            ${alertsHtml}
        </div>
    `;
}

/**
 * Helper functions for quality assessments
 */

function getSeeingQualityText(seeingValue) {
    if (seeingValue >= 8) return { text: 'EXCELLENT', class: 'quality-excellent' };
    if (seeingValue >= 6) return { text: 'GOOD', class: 'quality-good' };
    if (seeingValue >= 4) return { text: 'FAIR', class: 'quality-fair' };
    return { text: 'POOR', class: 'quality-poor' };
}

function getTransparencyQualityText(transparencyValue) {
    if (transparencyValue >= 80) return { text: 'EXCELLENT', class: 'quality-excellent' };
    if (transparencyValue >= 60) return { text: 'GOOD', class: 'quality-good' };
    if (transparencyValue >= 40) return { text: 'FAIR', class: 'quality-fair' };
    return { text: 'POOR', class: 'quality-poor' };
}

function getCloudQualityText(cloudValue) {
    if (cloudValue >= 80) return { text: 'EXCELLENT', class: 'quality-excellent' };
    if (cloudValue >= 60) return { text: 'GOOD', class: 'quality-good' };
    if (cloudValue >= 40) return { text: 'FAIR', class: 'quality-fair' };
    return { text: 'POOR', class: 'quality-poor' };
}

function getTrackingQualityText(trackingValue) {
    if (trackingValue >= 80) return { text: 'EXCELLENT', class: 'quality-excellent' };
    if (trackingValue >= 60) return { text: 'GOOD', class: 'quality-good' };
    if (trackingValue >= 40) return { text: 'FAIR', class: 'quality-fair' };
    return { text: 'POOR', class: 'quality-poor' };
}

function getDewRiskColor(riskLevel) {
    switch (riskLevel) {
        case 'MINIMAL': return 'dew-minimal';
        case 'LOW': return 'dew-low';
        case 'MODERATE': return 'dew-moderate';
        case 'HIGH': return 'dew-high';
        case 'CRITICAL': return 'dew-critical';
        default: return 'dew-unknown';
    }
}

function getQualityClass(quality) {
    if (quality >= 80) return 'excellent';
    if (quality >= 60) return 'good';
    if (quality >= 40) return 'fair';
    return 'poor';
}

function getSeverityIcon(severity) {
    switch (severity) {
        case 'HIGH': return '🔴';
        case 'MEDIUM': return '🟡';
        case 'LOW': return '🟢';
        default: return 'ℹ️';
    }
}

/**
 * Auto-refresh functionality for astro weather
 */
function startAstroWeatherAutoRefresh() {
    // Refresh every 10 minutes
    astroWeatherUpdateInterval = setInterval(loadAstroWeather, 600000);
}

function stopAstroWeatherAutoRefresh() {
    if (astroWeatherUpdateInterval) {
        clearInterval(astroWeatherUpdateInterval);
        astroWeatherUpdateInterval = null;
    }
}

/**
 * Initialize astrophotography weather module
 */
function initAstroWeather() {
    // Load initial data
    loadAstroWeather();
    
    // Start auto-refresh
    startAstroWeatherAutoRefresh();
    
    //console.log('Astrophotography weather module initialized');
}

// Export functions for global use
window.loadAstroWeather = loadAstroWeather;
window.initAstroWeather = initAstroWeather;