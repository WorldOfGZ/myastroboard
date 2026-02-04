// ======================
// Weather
// ======================

//Load Weather forecast
async function loadWeather() {
    const container = document.getElementById('weather-display');
    const containerLocation = document.getElementById('weather-location');
    
    const data = await fetchJSONWithUI('/api/weather/forecast', container, 'Loading weather data...');
    if (!data) return;
    
    clearContainer(containerLocation);
    
    // Add grid class for weather display layout
    addClass(container, 'weather-grid');
    clearContainer(container);

    // If data location is available
    if (data.location) {
        
        const locationItem = document.createElement('div');
        locationItem.className = 'weather-location-grid';
        locationItem.innerHTML = `
            <div class="weather-item"><strong>${data.location.name}</strong></div>
            <div class="weather-item"><strong>Lat:</strong> ${data.location.latitude.toFixed(2)}°<br><strong>Lon:</strong> ${data.location.longitude.toFixed(2)}°<br><strong>Elevation:</strong> ${data.location.elevation} m</div>
            <div class="weather-item"><strong>Timezone:</strong> ${data.location.timezone}</div>
        `;
        containerLocation.appendChild(locationItem);
    }

    // if forecast list is available
    if (data.hourly && data.hourly.length > 0) {
        // We receive up to 12 hours of data, display all
        data.hourly.forEach(forecast => {
            const date = new Date(forecast.date);
            const cloudCover = Math.round(forecast.cloud_cover);
            const cloudCoverL = Math.round(forecast.cloud_cover_low);
            const cloudCoverM = Math.round(forecast.cloud_cover_mid);
            const cloudCoverH = Math.round(forecast.cloud_cover_high);
            const humidity = Math.round(forecast.relative_humidity_2m);
            const temp = forecast.temperature_2m.toFixed(1);
            const pressure = Math.round(forecast.surface_pressure);
            const windSpeed = Math.round(forecast.wind_speed_10m);
            const dewPoint = forecast.dew_point_2m.toFixed(1);
            const condition = forecast.condition.toFixed(1);

            // Determine observation quality based on condition
            let quality = '';
            let qualityClass = '';
            if (condition >= 90) {
                quality = 'Excellent';
                qualityClass = 'quality-excellent';
            } else if (condition >= 70) {
                quality = 'Good';
                qualityClass = 'quality-good';
            } else if (condition >= 50) {
                quality = 'Fair';
                qualityClass = 'quality-fair';
            } else if (condition > 30) {
                quality = 'Poor';
                qualityClass = 'quality-poor';
            } else {
                quality = 'Bad';
                qualityClass = 'quality-bad';
            }

            const item = document.createElement('div');
            item.className = 'weather-item';
            item.innerHTML = `
                <div class="weather-time">${date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
                <div class="weather-quality ${qualityClass}">${quality}</div>
                <div class="weather-astro-info">
                    <div class="weather-row">
                        <span class="weather-label">☁️ Cloud Cover:</span>
                        <span class="weather-value">${cloudCover}%</span>
                    </div>
                    <div class="weather-row">
                        <span class="weather-label">&nbsp;>&nbsp;Low:</span>
                        <span class="weather-value">${cloudCoverL}%</span>
                    </div>
                    <div class="weather-row">
                        <span class="weather-label">&nbsp;>&nbsp;Mid:</span>
                        <span class="weather-value">${cloudCoverM}%</span>
                    </div>
                    <div class="weather-row">
                        <span class="weather-label">&nbsp;>&nbsp;High:</span>
                        <span class="weather-value">${cloudCoverH}%</span>
                    </div>
                    <div class="weather-row">
                        <span class="weather-label">💧 Humidity:</span>
                        <span class="weather-value">${humidity}%</span>
                    </div>
                    <div class="weather-row">
                        <span class="weather-label">🌡️ Temperature:</span>
                        <span class="weather-value">${temp}°C</span>
                    </div>
                    <div class="weather-row">
                        <span class="weather-label">💎 Dew Point:</span>
                        <span class="weather-value">${dewPoint}°C</span>
                    </div>
                    <div class="weather-row">
                        <span class="weather-label">🔽 Pressure:</span>
                        <span class="weather-value">${pressure} hPa</span>
                    </div>
                    <div class="weather-row">
                        <span class="weather-label">💨 Wind:</span>
                        <span class="weather-value">${windSpeed} km/h</span>
                    </div>
                </div>
            `;
            container.appendChild(item);
        });
    }
}

// Global chart instances
let cloudConditionsChartInstance = null;
let seeingConditionsChartInstance = null;
//Load Astronomical Charts
async function loadAstronomicalCharts() {
    const loadingDiv = document.getElementById('astro-charts-loading');
    const containerDiv = document.getElementById('astro-charts-container');
    const errorDiv = document.getElementById('astro-charts-error');
    
    // Show loading, hide others
    loadingDiv.style.display = 'block';
    containerDiv.style.display = 'none';
    errorDiv.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE}/api/weather/forecast`);
        const data = await response.json();

        //console.log(data);
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Hide loading, show charts
        loadingDiv.style.display = 'none';
        containerDiv.style.display = 'block';
        
        // Extract data for charts
        const labels = data.hourly.map(item => {
            const date = new Date(item.date);
            return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
        });
        
        const condition = data.hourly.map(item => item.condition);
        const cloudless = data.hourly.map(item => item.cloudless);
        const cloudHigh = data.hourly.map(item => item.cloudless_high);
        const cloudMid = data.hourly.map(item => item.cloudless_mid);
        const cloudLow = data.hourly.map(item => item.cloudless_low);
        const calm = data.hourly.map(item => item.calm);
        const fog = data.hourly.map(item => item.fog);
        const seeing = data.hourly.map(item => item.seeing);
        const transparency = data.hourly.map(item => item.transparency);
        const liftedIndex = data.hourly.map(item => item.lifted_index);
        const precipitation = data.hourly.map(item => item.precipitation);
        
        // Destroy existing charts if they exist
        if (cloudConditionsChartInstance) {
            cloudConditionsChartInstance.destroy();
        }
        if (seeingConditionsChartInstance) {
            seeingConditionsChartInstance.destroy();
        }
        
        // Chart 1: Cloud Conditions & Wind
        const ctx1 = document.getElementById('cloudConditionsChart').getContext('2d');
        cloudConditionsChartInstance = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Fog',
                        data: fog,
                        type: 'bar',
                        backgroundColor: 'rgba(128, 128, 128, 0.3)',
                        borderColor: 'rgba(128, 128, 128, 0.5)',
                        borderWidth: 1,
                        order: 10,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Condition',
                        data: condition,
                        borderColor: 'rgb(239, 68, 68)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.4,
                        order: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Cloudless',
                        data: cloudless,
                        borderColor: 'rgb(34, 197, 94)',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        order: 2,
                        yAxisID: 'y'
                    },
                    {
                        label: 'H (Cloudless High)',
                        data: cloudHigh,
                        borderColor: 'rgb(74, 222, 128)',
                        backgroundColor: 'rgba(74, 222, 128, 0.1)',
                        borderWidth: 2,
                        borderDash: [2, 2],
                        fill: false,
                        tension: 0.4,
                        order: 3,
                        yAxisID: 'y'
                    },
                    {
                        label: 'M (Cloudless Mid)',
                        data: cloudMid,
                        borderColor: 'rgb(134, 239, 172)',
                        backgroundColor: 'rgba(134, 239, 172, 0.1)',
                        borderWidth: 2,
                        borderDash: [2, 2],
                        fill: false,
                        tension: 0.4,
                        order: 4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'L (Cloudless Low)',
                        data: cloudLow,
                        borderColor: 'rgb(187, 247, 208)',
                        backgroundColor: 'rgba(187, 247, 208, 0.1)',
                        borderWidth: 2,
                        borderDash: [2, 2],
                        fill: false,
                        tension: 0.4,
                        order: 5,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Calm',
                        data: calm,
                        borderColor: 'rgb(220, 38, 38)',
                        backgroundColor: 'rgba(220, 38, 38, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        order: 6,
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
                    legend: {
                        display: true,
                        position: 'top',
                    },
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += Math.round(context.parsed.y * 10) / 10 + '%';
                                return label;
                            }
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
                            text: 'Percentage (%)'
                        },
                        min: 0,
                        max: 100
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    }
                }
            }
        });
        
        // Chart 2: Seeing & Atmospheric Conditions
        const ctx2 = document.getElementById('seeingConditionsChart').getContext('2d');
        seeingConditionsChartInstance = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Fog',
                        data: fog,
                        type: 'bar',
                        backgroundColor: 'rgba(128, 128, 128, 0.3)',
                        borderColor: 'rgba(128, 128, 128, 0.5)',
                        borderWidth: 1,
                        order: 10,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Condition',
                        data: condition,
                        borderColor: 'rgb(239, 68, 68)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.4,
                        order: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Seeing',
                        data: seeing,
                        borderColor: 'rgb(249, 115, 22)',
                        backgroundColor: 'rgba(249, 115, 22, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        order: 2,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Transparency',
                        data: transparency,
                        borderColor: 'rgb(30, 58, 138)',
                        backgroundColor: 'rgba(30, 58, 138, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        order: 3,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Lifted Index',
                        data: liftedIndex,
                        borderColor: 'rgb(6, 182, 212)',
                        backgroundColor: 'rgba(6, 182, 212, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        order: 4,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Precipitation',
                        data: precipitation,
                        borderColor: 'rgb(37, 99, 235)',
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.4,
                        order: 5,
                        yAxisID: 'y1'
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
                    legend: {
                        display: true,
                        position: 'top',
                    },
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.dataset.yAxisID === 'y') {
                                    label += Math.round(context.parsed.y * 10) / 10 + '%';
                                } else if (context.dataset.yAxisID === 'y1') {
                                    // Check if it's precipitation or temperature based on label
                                    if (context.dataset.label === 'Precipitation') {
                                        label += Math.round(context.parsed.y * 100) / 100 + 'mm';
                                    } else {
                                        label += Math.round(context.parsed.y * 10) / 10 + '°C';
                                    }
                                }
                                return label;
                            }
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
                            text: 'Percentage (%)'
                        },
                        min: 0,
                        max: 100
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Temp (°C) / Precip (mm)'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Error loading astronomical charts:', error);
        loadingDiv.style.display = 'none';
        errorDiv.style.display = 'block';
    }
}