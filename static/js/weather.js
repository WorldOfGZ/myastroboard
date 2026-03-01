// ======================
// Weather
// ======================

function createWeatherMetricItem(label, value) {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-center';

    const labelNode = document.createTextNode(label);
    const badge = document.createElement('span');
    badge.className = 'badge text-bg-primary rounded-pill';
    badge.textContent = value;

    li.appendChild(labelNode);
    li.appendChild(badge);
    return li;
}

function createChartShell(title, canvasId, legendItems = [], footerText = '') {
    const card = document.createElement('div');
    card.className = 'card h-100';

    const header = document.createElement('div');
    header.className = 'card-header';
    const h5 = document.createElement('h5');
    h5.className = 'mb-0';
    h5.textContent = title;
    header.appendChild(h5);

    const body = document.createElement('div');
    body.className = 'card-body';
    const canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.style.height = '300px';
    body.appendChild(canvas);

    const footer = document.createElement('div');
    footer.className = 'card-footer text-muted small';
    const row = document.createElement('div');
    row.className = 'row';

    legendItems.forEach((item) => {
        const col = document.createElement('div');
        col.className = 'col-auto';
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.style.backgroundColor = item.color;
        badge.textContent = item.label;
        col.appendChild(badge);
        row.appendChild(col);
    });

    if (footerText) {
        const col = document.createElement('div');
        col.className = 'col-auto';
        const text = document.createElement('span');
        text.className = 'text-muted';
        text.textContent = footerText;
        col.appendChild(text);
        row.appendChild(col);
    }

    footer.appendChild(row);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);
    return card;
}

//Load Weather forecast
async function loadWeather() {
    const container = document.getElementById('weather-display');
    const containerLocation = document.getElementById('weather-location');
    
    const data = await fetchJSONWithUI('/api/weather/forecast', container, 'Loading weather data...');
    if (!data) return;
    
    
    
    // Clear containers
    clearContainer(containerLocation);
    clearContainer(container);

    // If data location is available
    if (data.location) {
        const nameCol = document.createElement('div');
        nameCol.className = 'col mb-3';
        const nameCard = document.createElement('div');
        nameCard.className = 'card h-100';
        const nameBody = document.createElement('div');
        nameBody.className = 'card-body';
        const nameP = document.createElement('p');
        nameP.className = 'card-text';
        const nameStrong = document.createElement('strong');
        nameStrong.textContent = data.location.name;
        nameP.appendChild(nameStrong);
        nameBody.appendChild(nameP);
        nameCard.appendChild(nameBody);
        nameCol.appendChild(nameCard);

        const coordCol = document.createElement('div');
        coordCol.className = 'col mb-3';
        const coordCard = document.createElement('div');
        coordCard.className = 'card h-100';
        const coordBody = document.createElement('div');
        coordBody.className = 'card-body';
        const coordP = document.createElement('p');
        coordP.className = 'card-text';
        coordP.textContent = `Lat: ${data.location.latitude.toFixed(2)}°\nLon: ${data.location.longitude.toFixed(2)}°\nElevation: ${data.location.elevation} m`;
        coordP.style.whiteSpace = 'pre-line';
        coordBody.appendChild(coordP);
        coordCard.appendChild(coordBody);
        coordCol.appendChild(coordCard);

        const tzCol = document.createElement('div');
        tzCol.className = 'col mb-3';
        const tzCard = document.createElement('div');
        tzCard.className = 'card h-100';
        const tzBody = document.createElement('div');
        tzBody.className = 'card-body';
        const tzP = document.createElement('p');
        tzP.className = 'card-text';
        tzP.textContent = `Timezone: ${data.location.timezone}`;
        tzBody.appendChild(tzP);
        tzCard.appendChild(tzBody);
        tzCol.appendChild(tzCard);

        containerLocation.appendChild(nameCol);
        containerLocation.appendChild(coordCol);
        containerLocation.appendChild(tzCol);
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
            item.className = 'col mb-3';
            const card = document.createElement('div');
            card.className = 'card h-100';

            const cardHeader = document.createElement('div');
            cardHeader.className = `card-header quality-box ${qualityClass}`;
            const headerStrong = document.createElement('strong');
            headerStrong.textContent = quality;
            cardHeader.appendChild(headerStrong);

            const cardBody = document.createElement('div');
            cardBody.className = 'card-body';
            const title = document.createElement('h5');
            title.className = 'card-title card-title-weather';
            title.textContent = date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});

            const list = document.createElement('ul');
            list.className = 'list-group list-group-flush';
            list.appendChild(createWeatherMetricItem('☁️ Cloud Cover:', `${cloudCover}%`));
            list.appendChild(createWeatherMetricItem(' > Low:', `${cloudCoverL}%`));
            list.appendChild(createWeatherMetricItem(' > Mid:', `${cloudCoverM}%`));
            list.appendChild(createWeatherMetricItem(' > High:', `${cloudCoverH}%`));
            list.appendChild(createWeatherMetricItem('💧 Humidity:', `${humidity}%`));
            list.appendChild(createWeatherMetricItem('🌡️ Temperature:', `${temp}°C`));
            list.appendChild(createWeatherMetricItem('💎 Dew Point:', `${dewPoint}°C`));
            list.appendChild(createWeatherMetricItem('🔽 Pressure:', `${pressure} hPa`));
            list.appendChild(createWeatherMetricItem('💨 Wind:', `${windSpeed} km/h`));

            cardBody.appendChild(title);
            cardBody.appendChild(list);
            card.appendChild(cardHeader);
            card.appendChild(cardBody);
            item.appendChild(card);
            container.appendChild(item);
        });
    }
}

// Global chart instances
let cloudConditionsChartInstance = null;
let seeingConditionsChartInstance = null;

function isCompactChart() {
    return window.matchMedia('(max-width: 575.98px)').matches;
}
//Load Astronomical Charts
async function loadAstronomicalCharts() {
    const loadingDiv = document.getElementById('astro-charts-loading');
    const containerDiv = document.getElementById('astro-charts-container');
    const errorDiv = document.getElementById('astro-charts-error');
    
    // Show loading, hide others
    loadingDiv.style.display = 'block';
    errorDiv.style.display = 'none';
    
    try {
        //Fake error
        //throw('Fake');

        const data = await fetchJSONWithRetry('/api/weather/forecast', {}, {
            maxAttempts: 6,
            baseDelayMs: 1000,
            maxDelayMs: 12000,
            timeoutMs: 15000,
            shouldRetryData: (payload) => payload && payload.status === 'pending',
            onRetry: ({ reason, attempt, maxAttempts, waitMs, data: retryData }) => {
                const seconds = Math.max(1, Math.round(waitMs / 1000));
                const message = reason === 'data' && retryData && retryData.message
                    ? retryData.message
                    : 'Loading astronomical charts...';
                loadingDiv.textContent = `${message} Retrying in ${seconds}s (${attempt}/${maxAttempts})`;
            }
        });

        if (data.status === 'pending') {
            throw new Error(data.message || 'Cache not ready');
        }

        //console.log(data);
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Hide loading, show charts
        loadingDiv.style.display = 'none';
        
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
        const container1 = document.getElementById('cloudConditionsChartContainer');
        if (container1) {
            DOMUtils.clear(container1);
            container1.appendChild(createChartShell('☁️ Clouds & 💨 Wind', 'cloudConditionsChart', [
                { label: 'Cloudless', color: '#22c55e' },
                { label: 'Condition', color: '#ef4444' },
                { label: 'Fog', color: '#808080' }
            ], 'Percentage (%)'));
        }
        
        const ctx1 = document.getElementById('cloudConditionsChart');
        if (!ctx1) return;
        const ctx1_2d = ctx1.getContext('2d');
        const compactChart = isCompactChart();
        cloudConditionsChartInstance = new Chart(ctx1_2d, {
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
                        display: false
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
                        max: 105,
                        ticks: {
                            stepSize: 20,
                            callback: function(value) {
                                if (value === 105) {
                                    return '';
                                }
                                return value + '%';
                            }
                        },
                        afterBuildTicks: function(axis) {
                            axis.ticks = [0, 20, 40, 60, 80, 100, 105].map(value => ({ value }));
                        }
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
        const container2 = document.getElementById('seeingConditionsChartContainer');
        if (container2) {
            DOMUtils.clear(container2);
            container2.appendChild(createChartShell('👁️ Seeing & ✨ Atmospheric Conditions', 'seeingConditionsChart', [
                { label: 'Fog', color: '#808080' },
                { label: 'Condition', color: '#ef4444' },
                { label: 'Seeing', color: '#f97316' },
                { label: 'Transparency', color: '#1e3a8a' },
                { label: 'Lifted Index', color: '#06b6d4' },
                { label: 'Precipitation', color: '#2563eb' }
            ], ''));
        }
        
        const ctx2 = document.getElementById('seeingConditionsChart');
        if (!ctx2) return;
        const ctx2_2d = ctx2.getContext('2d');
        const compactChart2 = isCompactChart();
        seeingConditionsChartInstance = new Chart(ctx2_2d, {
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
                        display: false
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
                        max: 105,
                        ticks: {
                            stepSize: 20,
                            callback: function(value) {
                                if (value === 105) {
                                    return '';
                                }
                                return value + '%';
                            }
                        },
                        afterBuildTicks: function(axis) {
                            axis.ticks = [0, 20, 40, 60, 80, 100, 105].map(value => ({ value }));
                        }
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
                        }
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
        //Hide containerDiv
        containerDiv.style.display = 'none';
    }
}