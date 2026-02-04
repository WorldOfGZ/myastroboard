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
            errorDiv.innerHTML = `<div class="error-box">Failed to load astrophotography weather data: ${error.message}</div>`;
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
    
    container.innerHTML = `
        <div class="astro-conditions-grid">
            <div class="astro-condition-card">
                <div class="astro-condition-header">
                    <span class="astro-icon">👁️</span>
                    <span class="astro-title">Seeing</span>
                </div>
                <div class="astro-condition-content">
                    <div class="astro-main-value">${conditions.seeing_pickering}/10</div>
                    <div class="astro-quality-text ${seeingQuality.class}">${seeingQuality.text}</div>
                    <div class="astro-detail">Pickering Scale</div>
                </div>
            </div>
            
            <div class="astro-condition-card">
                <div class="astro-condition-header">
                    <span class="astro-icon">✨</span>
                    <span class="astro-title">Transparency</span>
                </div>
                <div class="astro-condition-content">
                    <div class="astro-main-value">${conditions.limiting_magnitude}m</div>
                    <div class="astro-quality-text ${transparencyQuality.class}">${transparencyQuality.text}</div>
                    <div class="astro-detail">Limiting Magnitude</div>
                </div>
            </div>
            
            <div class="astro-condition-card">
                <div class="astro-condition-header">
                    <span class="astro-icon">☁️</span>
                    <span class="astro-title">Cloud Layers</span>
                </div>
                <div class="astro-condition-content">
                    <div class="astro-main-value">${Math.round(conditions.cloud_discrimination)}%</div>
                    <div class="astro-quality-text">${getCloudQualityText(conditions.cloud_discrimination)}</div>
                    <div class="astro-detail">Discrimination Score</div>
                </div>
            </div>
            
            <div class="astro-condition-card">
                <div class="astro-condition-header">
                    <span class="astro-icon">💧</span>
                    <span class="astro-title">Dew Risk</span>
                </div>
                <div class="astro-condition-content">
                    <div class="astro-main-value">${Math.round(conditions.dew_point_spread * 10) / 10}°C</div>
                    <div class="astro-quality-text ${dewRiskColor}">${conditions.dew_risk_level}</div>
                    <div class="astro-detail">Temperature Spread</div>
                </div>
            </div>
            
            <div class="astro-condition-card">
                <div class="astro-condition-header">
                    <span class="astro-icon">🎯</span>
                    <span class="astro-title">Tracking</span>
                </div>
                <div class="astro-condition-content">
                    <div class="astro-main-value">${conditions.tracking_stability_score}%</div>
                    <div class="astro-quality-text ${trackingQuality.class}">${trackingQuality.text}</div>
                    <div class="astro-detail">Wind Stability</div>
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
    
    if (!periods || periods.length === 0) {
        container.innerHTML = `
            <div class="astro-no-periods">
                <div class="astro-icon">😔</div>
                <div class="astro-message">No optimal observation periods found in the next 24 hours</div>
            </div>
        `;
        return;
    }
    
    const periodsHtml = periods.map((period, index) => {
        const startTime = new Date(period.start);
        const endTime = new Date(period.end);
        const duration = period.duration_hours;
        
        return `
            <div class="astro-period-card">
                <div class="astro-period-rank">#${index + 1}</div>
                <div class="astro-period-content">
                    <div class="astro-period-time">
                        <div class="astro-time-range">
                            ${startTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} - 
                            ${endTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                        </div>
                        <div class="astro-date-range">
                            ${startTime.toLocaleDateString([], {month: 'short', day: 'numeric'})}
                            ${startTime.toDateString() !== endTime.toDateString() ? 
                                ' - ' + endTime.toLocaleDateString([], {month: 'short', day: 'numeric'}) : ''}
                        </div>
                    </div>
                    <div class="astro-period-details">
                        <div class="astro-duration">
                            <span class="astro-label">Duration:</span>
                            <span class="astro-value">${duration.toFixed(1)}h</span>
                        </div>
                        <div class="astro-quality">
                            <span class="astro-label">Quality:</span>
                            <span class="astro-value quality-${getQualityClass(period.average_quality)}">${period.average_quality.toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = `
        <div class="astro-periods-header">
            <h3>🌟 Best Observation Windows</h3>
            <div class="astro-periods-subtitle">Optimal periods for astrophotography in the next 24 hours</div>
        </div>
        <div class="astro-periods-list">
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
            <div class="astro-no-alerts">
                <div class="astro-icon">✅</div>
                <div class="astro-message">No weather alerts for astrophotography</div>
            </div>
        `;
        return;
    }
    
    const alertsHtml = alerts.map(alert => {
        const alertTime = new Date(alert.time);
        const severityIcon = getSeverityIcon(alert.severity);
        const severityClass = getSeverityClass(alert.severity);
        
        return `
            <div class="astro-alert ${severityClass}">
                <div class="astro-alert-header">
                    <div class="astro-alert-icon">${severityIcon}</div>
                    <div class="astro-alert-type">${alert.type.replace('_', ' ')}</div>
                    <div class="astro-alert-time">${alertTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
                </div>
                <div class="astro-alert-message">${alert.message}</div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = `
        <div class="astro-alerts-header">
            <h3>⚠️ Weather Alerts</h3>
            <div class="astro-alerts-subtitle">Conditions affecting astrophotography in the next 6 hours</div>
        </div>
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
    if (cloudValue >= 80) return 'EXCELLENT';
    if (cloudValue >= 60) return 'GOOD';
    if (cloudValue >= 40) return 'FAIR';
    return 'POOR';
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

function getSeverityClass(severity) {
    return `severity-${severity.toLowerCase()}`;
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