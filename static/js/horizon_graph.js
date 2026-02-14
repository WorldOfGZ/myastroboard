/**
 * Horizon Graph Visualization
 * Displays sun and moon altitude vs time for the current day (00:00 to 24:00)
 * Uses Chart.js to render altitude curves
 */

/**
 * Load and display horizon graph data
 */
async function loadHorizonGraph() {
    const container = document.getElementById('horizon-graph-display');
    if (!container) return;
    
    const loadingDiv = document.getElementById('horizon-graph-loading');
    const errorDiv = document.getElementById('horizon-graph-error');
    
    if (loadingDiv) loadingDiv.style.display = 'block';
    if (errorDiv) errorDiv.style.display = 'none';
    if (container) container.style.display = 'none';
    
    try {
        const data = await fetchJSONWithRetry('/api/astro/horizon-graph', {}, {
            maxAttempts: 8,
            baseDelayMs: 1000,
            maxDelayMs: 15000,
            timeoutMs: 20000,
            shouldRetryData: (payload) => payload && payload.status === 'pending',
            onRetry: ({ reason, attempt, maxAttempts, waitMs, data: retryData }) => {
                if (!loadingDiv) return;
                const seconds = Math.max(1, Math.round(waitMs / 1000));
                const message = reason === 'data' && retryData && retryData.message
                    ? retryData.message
                    : 'Loading horizon graph data...';
                loadingDiv.innerHTML = `${message} Retrying in ${seconds}s (${attempt}/${maxAttempts})`;
            }
        });

        if (data.status === 'pending') {
            throw new Error(data.message || 'Cache not ready');
        }
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        if (loadingDiv) loadingDiv.style.display = 'none';
        if (container) container.style.display = 'block';
        
        // Render horizon graph
        if (data.horizon_data) {
            renderHorizonChart(data.horizon_data);
        } else {
            if (container) {
                container.innerHTML = '<div class="alert alert-warning">No horizon data available</div>';
            }
        }
        
    } catch (error) {
        console.error('Error loading horizon graph:', error);
        
        if (loadingDiv) loadingDiv.style.display = 'none';
        if (errorDiv) {
            errorDiv.style.display = 'block';
            errorDiv.innerHTML = `
                <div class="col">
                    <div class="card h-100 bg-danger-subtle">
                        <div class="card-body">
                            <h5 class="card-title">Error...</h5>
                            <p class="card-text">Failed to load horizon graph data: ${error.message}</p>
                        </div>
                    </div>
                </div>
            `;
        }
    }
}

/**
 * Render horizon graph using Chart.js
 */
function renderHorizonChart(horizonData) {
    const container = document.getElementById('horizon-graph-display');
    if (!container || !horizonData) return;
    
    // Prepare data
    const sunData = horizonData.sun_data || [];
    const moonData = horizonData.moon_data || [];
    
    // Extract times and altitudes (keep negative values to show below horizon)
    const sunAltitudes = sunData.map(point => ({ x: point.hour, y: point.altitude_deg })) || [];
    const moonAltitudes = moonData.map(point => ({ x: point.hour, y: point.altitude_deg })) || [];
    const now = new Date();
    const currentTimeValue = sunData.length > 0
        ? now.getHours() + now.getMinutes() / 60
        : null;
    const currentTimeLabel = currentTimeValue !== null
        ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        : '';
    const currentTimeLine = currentTimeValue !== null
        ? [{ x: currentTimeValue, y: -90 }, { x: currentTimeValue, y: 90 }]
        : [];
    
    // Create canvas for chart
    container.innerHTML = `
        <div class="col-12 mb-3">
            <div class="card h-100">
                <div class="card-header">
                    <h5 class="mb-0">🌅 Horizon Graph</h5>
                </div>
                <div class="card-body">
                    <canvas id="horizonCanvas" style="height: 350px;"></canvas>
                </div>
                <div class="card-footer text-muted small">
                    <div class="row">
                        <div class="col-auto">
                            <span class="badge" style="background-color: #FDB813;">☀️ Sun</span>
                        </div>
                        <div class="col-auto">
                            <span class="badge" style="background-color: #C0C0C0;">🌙 Moon</span>
                        </div>
                        <div class="col-auto">
                            <span class="badge bg-secondary">━ Horizon (0°)</span>
                        </div>
                        <div class="col-auto">
                            <span class="badge" style="background-color: #ef4444;">┃ Now ${currentTimeLabel || ''}</span>
                        </div>
                        <div class="col-auto">
                            <span class="text-muted">Altitude (-90° to +90°) | Date: ${horizonData.date}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Render chart
    const canvasElement = document.getElementById('horizonCanvas');
    if (!canvasElement) return;
    
    const ctx = canvasElement.getContext('2d');
    
    new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Sun Altitude',
                    data: sunAltitudes,
                    parsing: false,
                    borderColor: '#FDB813',
                    backgroundColor: 'rgba(253, 184, 19, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointBackgroundColor: '#FDB813',
                    pointBorderColor: '#FDB813',
                    pointHoverRadius: 5,
                    yAxisID: 'y'
                },
                {
                    label: 'Moon Altitude',
                    data: moonAltitudes,
                    parsing: false,
                    borderColor: '#C0C0C0',
                    backgroundColor: 'rgba(192, 192, 192, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointBackgroundColor: '#C0C0C0',
                    pointBorderColor: '#C0C0C0',
                    pointHoverRadius: 5,
                    yAxisID: 'y'
                },
                ...(currentTimeLine.length
                    ? [{
                        label: 'Now',
                        data: currentTimeLine,
                        parsing: false,
                        borderColor: '#ef4444',
                        borderWidth: 2,
                        borderDash: [4, 4],
                        pointRadius: 0,
                        fill: false,
                        tension: 0,
                        yAxisID: 'y'
                    }]
                    : [])
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
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callback: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(1) + '°';
                            }
                            return label;
                        }
                    }
                },
                // Add horizon and current time markers
                annotation: {
                    annotations: {
                        horizon: {
                            type: 'line',
                            yMin: 0,
                            yMax: 0,
                            borderColor: '#666666',
                            borderWidth: 3,
                            borderDash: [5, 5],
                            label: {
                                display: true,
                                content: ['Horizon']
                            }
                        },
                        currentTime: null
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Altitude (degrees)',
                        font: {
                            size: 12
                        }
                    },
                    min: -90,
                    max: 90,
                    ticks: {
                        callback: function(value) {
                            return value + '°';
                        }
                    },
                    grid: {
                        drawBorder: true,
                        color: function(context) {
                            // Make horizon line (0°) bolder
                            if (context.tick.value === 0) {
                                return 'rgba(102, 102, 102, 0.8)';
                            }
                            return 'rgba(200, 200, 200, 0.2)';
                        },
                        lineWidth: function(context) {
                            // Make horizon line (0°) thicker
                            if (context.tick.value === 0) {
                                return 3;
                            }
                            return 1;
                        }
                    }
                },
                x: {
                    type: 'linear',
                    min: 0,
                    max: 24,
                    title: {
                        display: true,
                        text: 'Local Time (24h format)',
                        font: {
                            size: 12
                        }
                    },
                    ticks: {
                        maxTicksLimit: 12,
                        callback: function(value) {
                            const hour = Math.floor(value);
                            return `${String(hour).padStart(2, '0')}:00`;
                        }
                    }
                }
            }
        }
    });
}

