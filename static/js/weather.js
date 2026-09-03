// ======================
// Weather
// ======================


function createChartShell(iconClass, labelText, canvasId, legendItems = [], footerText = '') {
    const card = document.createElement('div');
    card.className = 'card h-100';

    const header = document.createElement('div');
    header.className = 'card-header';
    const h5 = document.createElement('h5');
    h5.className = 'mb-0';
    DOMUtils.append(h5, DOMUtils.createIcon(iconClass), labelText);
    header.appendChild(h5);

    const body = document.createElement('div');
    body.className = 'card-body';
    const canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.className = 'trend-chart-canvas';
    body.appendChild(canvas);

    const footer = document.createElement('div');
    footer.className = 'card-footer text-muted small';
    const row = document.createElement('div');
    row.className = 'row chart-legend-row';

    legendItems.forEach((item, idx) => {
        const col = document.createElement('div');
        col.className = 'col-auto';
        const badge = document.createElement('span');
        badge.className = 'badge chart-legend-badge';
        badge.style.backgroundColor = item.color;
        badge.textContent = item.label;
        badge.dataset.legendIndex = String(idx);
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

// Wire the footer legend badges (built by createChartShell) so clicking one toggles its
// dataset. Keeps the project's footer-badge legend convention while adding click-to-isolate.
// Requires legendItems order to match chart.data.datasets order 1:1.
function makeChartLegendInteractive(cardEl, chart) {
    if (!cardEl || !chart) return;
    cardEl.querySelectorAll('.chart-legend-badge[data-legend-index]').forEach((badge) => {
        const idx = Number(badge.dataset.legendIndex);
        if (!Number.isInteger(idx) || !chart.data.datasets[idx]) return;
        badge.setAttribute('role', 'button');
        badge.tabIndex = 0;
        const toggle = () => {
            const wasVisible = chart.isDatasetVisible(idx);
            chart.setDatasetVisibility(idx, !wasVisible);
            badge.classList.toggle('chart-legend-badge--off', wasVisible);
            chart.update();
        };
        badge.addEventListener('click', toggle);
        badge.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
        });
    });
}

function toFiniteNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function formatMetricNumber(value, decimals = 0) {
    const num = toFiniteNumber(value);
    return num == null ? 'N/A' : num.toFixed(decimals);
}

function formatMetricInteger(value) {
    const num = toFiniteNumber(value);
    return num == null ? 'N/A' : Math.round(num).toString();
}

//Load Weather forecast
async function loadWeather() {
    const container = document.getElementById('weather-display');
    const containerLocation = document.getElementById('weather-location');

    const data = await fetchJSONWithUI('/api/weather/forecast', container, i18n.t('weather.loading_text'), {
        wrapInCard: true,
        cardTitle: i18n.t('weather.loading_title'),
        cardIcon: 'bi-cloud-sun'
    });
    if (!data) return;

    //console.log('Weather forecast data:', data);

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
        coordP.textContent = `${i18n.t('weather.latitude')}${data.location.latitude.toFixed(2)}${i18n.t('units.degrees')}\n${i18n.t('weather.longitude')}${data.location.longitude.toFixed(2)}${i18n.t('units.degrees')}\n${i18n.t('weather.elevation')}${data.location.elevation} ${i18n.t('units.meters')}`;
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
        tzP.textContent = `${i18n.t('weather.timezone')}${formatTimezoneWithOffset(data.location.timezone)}`;
        tzBody.appendChild(tzP);
        tzCard.appendChild(tzBody);
        tzCol.appendChild(tzCard);

        containerLocation.appendChild(nameCol);
        containerLocation.appendChild(coordCol);
        containerLocation.appendChild(tzCol);

        // Append Bortle/SQM to the timezone card if configured (non-blocking)
        fetchJSON('/api/skyquality').then(sq => {
            if (sq && sq.bortle != null) {
                const sqP = document.createElement('p');
                sqP.className = 'card-text mt-2';
                const bortleLabel = i18n.t(`settings.sky_quality_bortle_${sq.bortle}`);
                let sqText = `${i18n.t('weather.bortle')}${bortleLabel}`;
                if (sq.sqm != null) {
                    sqText += `\n${i18n.t('weather.sqm')}${sq.sqm} mag/arcsec²`;
                }
                sqP.textContent = sqText;
                sqP.style.whiteSpace = 'pre-line';
                tzBody.appendChild(sqP);
            }
        }).catch(() => { });
    }

    // if forecast list is available
    if (data.hourly && data.hourly.length > 0) {
        const now = Date.now();
        const configuredTimezone = data?.location?.timezone || 'UTC';
        // We receive up to 12 hours of data; skip entries that are already in the past
        data.hourly.filter(forecast => new Date(forecast.date).getTime() >= now).forEach(forecast => {
            const cloudCover = formatMetricInteger(forecast.cloud_cover);
            const cloudCoverL = formatMetricInteger(forecast.cloud_cover_low);
            const cloudCoverM = formatMetricInteger(forecast.cloud_cover_mid);
            const cloudCoverH = formatMetricInteger(forecast.cloud_cover_high);
            const humidity = formatMetricInteger(forecast.relative_humidity_2m);
            const temp = formatMetricNumber(forecast.temperature_2m, 1);
            const pressure = formatMetricInteger(forecast.surface_pressure);
            const windSpeed = formatMetricInteger(forecast.wind_speed_10m);
            const precipitation = formatMetricNumber(forecast.precipitation, 1);
            const dewPoint = formatMetricNumber(forecast.dew_point_2m, 1);
            // `condition` is the app-wide observation score (0-10) x10, served per hour by
            // /api/weather/forecast from the astro_weather cache. Bands mirror the
            // "Score de la Nuit" cards (>=8/6/4/2 on the 0-10 scale) so the same hour reads
            // the same quality label everywhere.
            const condition = toFiniteNumber(forecast.condition);

            let quality = '';
            let qualityClass = '';
            if (condition == null) {
                quality = i18n.t('common.quality_scale.unknown');
                qualityClass = 'quality-bad';
            } else if (condition >= 80) {
                quality = i18n.t('common.quality_scale.excellent');
                qualityClass = 'quality-excellent';
            } else if (condition >= 60) {
                quality = i18n.t('common.quality_scale.good');
                qualityClass = 'quality-good';
            } else if (condition >= 40) {
                quality = i18n.t('common.quality_scale.fair');
                qualityClass = 'quality-fair';
            } else if (condition >= 20) {
                quality = i18n.t('common.quality_scale.poor');
                qualityClass = 'quality-poor';
            } else {
                quality = i18n.t('common.quality_scale.bad');
                qualityClass = 'quality-bad';
            }

            const item = document.createElement('div');
            item.className = 'col mb-3';
            const card = document.createElement('div');
            card.className = 'card h-100';

            // Header: time on the left, quality label on the right
            const cardHeader = document.createElement('div');
            cardHeader.className = `card-header d-flex justify-content-between align-items-center quality-box ${qualityClass}`;
            const timeEl = document.createElement('span');
            timeEl.className = 'fw-semibold';
            timeEl.textContent = formatTimeOnlyInTimezone(forecast.date, configuredTimezone);
            const qualityEl = document.createElement('span');
            qualityEl.className = 'weather-quality-label';
            qualityEl.textContent = quality;
            cardHeader.appendChild(timeEl);
            cardHeader.appendChild(qualityEl);

            const cardBody = document.createElement('div');
            cardBody.className = 'card-body p-2';

            // 2-column metric grid
            const metricGrid = document.createElement('div');
            metricGrid.className = 'weather-metric-grid';
            metricGrid.appendChild(createForecastMetricCell('bi-thermometer-half', 'text-danger', `${temp}${i18n.t('units.temperature_celsius')}`, i18n.t('weather.temperature')));
            metricGrid.appendChild(createForecastMetricCell('bi-droplet', 'text-primary', `${humidity}${i18n.t('units.percent')}`, i18n.t('weather.humidity')));
            metricGrid.appendChild(createForecastMetricCell('bi-droplet-half', 'text-primary', `${dewPoint}${i18n.t('units.temperature_celsius')}`, i18n.t('weather.dew_point')));
            metricGrid.appendChild(createForecastMetricCell('bi-speedometer2', '', `${pressure} ${i18n.t('units.hpa')}`, i18n.t('weather.pressure')));
            metricGrid.appendChild(createForecastMetricCell('bi-wind', '', `${windSpeed} ${i18n.t('units.wind_speed_kmh')}`, i18n.t('weather.wind')));
            metricGrid.appendChild(createForecastMetricCell('bi-cloud-rain', 'text-primary', `${precipitation} ${i18n.t('units.precipitation_mm')}`, i18n.t('weather.precipitation')));
            metricGrid.appendChild(createForecastMetricCell('bi-clouds', '', `${cloudCover}${i18n.t('units.percent')}`, i18n.t('weather.cloud_cover')));

            // Cloud layer breakdown
            const cloudLayers = document.createElement('div');
            cloudLayers.className = 'weather-cloud-layers';
            [
                [i18n.t('weather.low'), cloudCoverL],
                [i18n.t('weather.mid'), cloudCoverM],
                [i18n.t('weather.high'), cloudCoverH],
            ].forEach(([label, val]) => {
                const s = document.createElement('span');
                s.className = 'weather-cloud-layer-item';
                s.textContent = `${label} ${val}${i18n.t('units.percent')}`;
                cloudLayers.appendChild(s);
            });

            cardBody.appendChild(metricGrid);
            cardBody.appendChild(cloudLayers);
            card.appendChild(cardHeader);
            card.appendChild(cardBody);
            item.appendChild(card);
            container.appendChild(item);
        });
    }

    const weatherSection = container ? container.closest('.bg-sub-container') : null;
    if (weatherSection) {
        const existingFooter = weatherSection.querySelector('.js-weather-data-source-footer');
        if (existingFooter && existingFooter.parentNode) {
            existingFooter.parentNode.removeChild(existingFooter);
        }
        const footer = createDataSourceFooter({
            text: i18n.t('weather.footer_source'),
            links: [
                { href: 'https://open-meteo.com/', label: 'Open-Meteo' }
            ]
        });
        footer.classList.add('js-weather-data-source-footer');
        weatherSection.appendChild(footer);
    }
}

// ============================================================
// Observation Conditions  (Weather -> "trend" sub-tab)
// An astrophotographer's fast go / no-go scan for the coming night:
//   Block 1  Night score           - the one number (identical to the navbar pill)
//   Block 2  Sky                    - cloud cover (total + layers), fog, precipitation
//   Block 3  Atmosphere & tracking  - seeing, transparency, mount stability, lifted index
// Every series comes from /api/weather/astro-analysis (the jet-stream-aware engine, kept warm
// in the astro_weather cache), so the numbers match the pill and the Astrophotography tab.
// ============================================================

const TREND_MIN_HOURS = 6;

let nightScoreChartInstance = null;
let skyChartInstance = null;
let atmosphereChartInstance = null;
let astroChartsRequestInFlight = null;

function updateAstroChartsLoadingMessage(message) {
    const loadingDiv = document.getElementById('astro-charts-loading');
    if (!loadingDiv) return;
    loadingDiv.replaceChildren(DOMUtils.createSpinnerWrapper(message));
}

function destroyAstronomicalCharts() {
    [nightScoreChartInstance, skyChartInstance, atmosphereChartInstance].forEach(c => {
        if (c) c.destroy();
    });
    nightScoreChartInstance = null;
    skyChartInstance = null;
    atmosphereChartInstance = null;
}

// Saturated line colours for the score bands - same green / amber / red language as the
// "Score de la Nuit" cards (text-success / text-warning / text-danger).
const TREND_SCORE_COLORS = { good: '#22c55e', fair: '#f59e0b', poor: '#ef4444' };
function _scoreBandColor(score0to100) {
    if (score0to100 >= 60) return TREND_SCORE_COLORS.good;
    if (score0to100 >= 40) return TREND_SCORE_COLORS.fair;
    return TREND_SCORE_COLORS.poor;
}

// Fog probability (%) from relative humidity - mirrors
// backend/weather/weather_openmeteo.py::_enrich_hourly_dataframe so this view keeps the same
// fog series it had before, now derived client-side from the astro-analysis payload.
function _fogPercent(rh) {
    const h = toFiniteNumber(rh);
    if (h == null) return null;
    if (h > 90) return Math.min(100, (h - 90) * 10);
    if (h > 80) return Math.min(100, (h - 80) * 5);
    return 0;
}

// Slice the hourly series to the coming night: from now to ~2 h past dawn, never fewer than
// TREND_MIN_HOURS, capped at what the forecast covers. Derived from the is_day flags.
function _trendWindow(hourly) {
    const cutoff = Date.now() - 30 * 60 * 1000;
    const future = hourly.filter(h => new Date(h.datetime).getTime() >= cutoff);
    if (future.length === 0) return [];

    const firstNight = future.findIndex(h => h.is_day === 0);
    let endIdx;
    if (firstNight === -1) {
        endIdx = future.length - 1; // no night in range (polar day) - show all we have
    } else {
        endIdx = firstNight;
        while (endIdx + 1 < future.length && future[endIdx + 1].is_day === 0) endIdx += 1;
        endIdx += 2; // keep ~2 h past dawn for the pack-up window
    }
    endIdx = Math.min(future.length - 1, Math.max(endIdx, TREND_MIN_HOURS - 1));
    return future.slice(0, endIdx + 1);
}

// Longest run of observation_score >= 6 among the dark hours -> { start, end } labels, or null.
function _bestTrendWindow(rows, tz) {
    let best = null;
    let run = null;
    const flush = () => {
        if (run && (!best || (run.end - run.start) > (best.end - best.start))) best = run;
        run = null;
    };
    rows.forEach((h, i) => {
        if (h.is_day === 0 && (toFiniteNumber(h.observation_score) ?? 0) >= 6) {
            run = run || { start: i, end: i };
            run.end = i;
        } else {
            flush();
        }
    });
    flush();
    if (!best) return null;
    const endRow = rows[Math.min(best.end + 1, rows.length - 1)];
    return {
        start: formatTimeOnlyInTimezone(rows[best.start].datetime, tz),
        end: formatTimeOnlyInTimezone(endRow.datetime, tz),
    };
}

// Chart.js inline plugin: shade the daytime (is_day === 1) spans so the dark hours stand out.
function _dayNightShading(isDay) {
    return {
        id: 'dayNightShading',
        beforeDatasetsDraw(chart) {
            const area = chart.chartArea;
            const xScale = chart.scales.x;
            if (!area || !xScale || !isDay || isDay.length === 0) return;
            const half = (area.right - area.left) / isDay.length / 2;
            const ctx = chart.ctx;
            ctx.save();
            ctx.fillStyle = 'rgba(148, 163, 184, 0.16)'; // slate - subtle in light and dark
            let spanStart = null;
            for (let i = 0; i <= isDay.length; i++) {
                const daytime = i < isDay.length && isDay[i] === 1;
                if (daytime && spanStart === null) spanStart = i;
                if (!daytime && spanStart !== null) {
                    const left = Math.max(area.left, xScale.getPixelForValue(spanStart) - half);
                    const right = Math.min(area.right, xScale.getPixelForValue(i - 1) + half);
                    if (right > left) ctx.fillRect(left, area.top, right - left, area.bottom - area.top);
                    spanStart = null;
                }
            }
            ctx.restore();
        },
    };
}

// Tooltip that appends the right unit per axis (e.g. % on the left axis, mm / degC on the right).
function _trendTooltip(unitByAxis) {
    return {
        callbacks: {
            label: (c) => {
                if (c.parsed.y == null) return null;
                const unit = unitByAxis[c.dataset.yAxisID] || '';
                return `${c.dataset.label}: ${Math.round(c.parsed.y * 10) / 10}${unit}`;
            },
        },
    };
}

// On a phone the axis titles (especially the rotated right-hand one) eat most of the plot
// width, so drop them there - the card header and the legend key already name the scale.
function _isNarrowViewport() {
    try {
        return window.matchMedia('(max-width: 575.98px)').matches;
    } catch (_) {
        return false;
    }
}

// Shared time (x) axis: horizontal labels, thinned automatically to fit the width.
function _timeAxis() {
    return { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 13 } };
}

// Shared 0-105 % axis with quality-scale ticks, matching the app's other observation charts.
function _percentAxis(titleText) {
    return {
        type: 'linear',
        position: 'left',
        title: { display: !_isNarrowViewport(), text: titleText },
        min: 0,
        max: 105,
        ticks: {
            callback: (value) => (value === 105 ? '' : value + i18n.t('units.percent')),
        },
        afterBuildTicks: (axis) => {
            axis.ticks = [0, 20, 40, 60, 80, 100, 105].map(value => ({ value }));
        },
    };
}

// Build one trend chart: shell + Chart.js line chart + interactive footer legend + day/night
// shading. legendItems order must match datasets order 1:1, unless `legendKey` is set - then
// the footer badges are just a colour key (e.g. the score bands) and are not click-to-toggle.
function _buildTrendChart({ containerId, canvasId, icon, title, axisLabel, labels, isDay, datasets, legendItems, scales, legendKey, tooltip }) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    DOMUtils.clear(container);
    // Footer text is left empty: the y-axis title + the legend badges already name the scale.
    const card = createChartShell(icon, title, canvasId, legendItems, '');
    container.appendChild(card);

    const canvas = document.getElementById(canvasId);
    const ctx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
    if (!ctx) return null;

    const chart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            // monotone keeps the curves smooth without the wild over/undershoot a plain
            // tension gives when the data spikes (very visible on a narrow screen).
            elements: {
                line: { cubicInterpolationMode: 'monotone', tension: 0.3 },
                point: { radius: 0, hoverRadius: 4, hitRadius: 12 },
            },
            plugins: { legend: { display: false }, tooltip: tooltip || {} },
            scales: scales || {
                y: _percentAxis(axisLabel),
                x: _timeAxis(),
            },
        },
        plugins: [_dayNightShading(isDay)],
    });
    if (!legendKey) makeChartLegendInteractive(card, chart);
    return chart;
}

// Caption under the hero chart: current score + the best window tonight.
function _renderTrendCaption(rows, tz, scoreSeries) {
    const host = document.getElementById('nightScoreChartContainer');
    if (!host) return;
    const existing = host.querySelector('.trend-score-caption');
    if (existing) existing.remove();

    const caption = document.createElement('p');
    caption.className = 'trend-score-caption text-muted small mt-2 mb-0';

    const nowScore = scoreSeries.find(s => s != null);
    if (nowScore != null) {
        const strong = document.createElement('strong');
        strong.textContent = `${i18n.t('weather.chart_score_now')} ${(nowScore / 10).toFixed(1)}/10`;
        caption.appendChild(strong);
    }

    const win = _bestTrendWindow(rows, tz);
    DOMUtils.append(
        caption,
        nowScore != null ? '  -  ' : '',
        win
            ? i18n.t('weather.chart_best_window', { start: win.start, end: win.end })
            : i18n.t('weather.chart_no_good_window')
    );

    host.appendChild(caption);
}

//Load Astronomical Charts (Weather -> Observation Conditions)
async function loadAstronomicalCharts() {
    if (astroChartsRequestInFlight) {
        return astroChartsRequestInFlight;
    }

    astroChartsRequestInFlight = (async () => {
        const loadingDiv = document.getElementById('astro-charts-loading');
        const containerDiv = document.getElementById('astro-charts-container');
        const errorDiv = document.getElementById('astro-charts-error');

        loadingDiv.style.display = 'block';
        containerDiv.style.display = '';
        updateAstroChartsLoadingMessage(i18n.t('weather.loading_astro_chart'));
        errorDiv.style.display = 'none';

        try {
            const currentLang = (typeof i18n !== 'undefined' && typeof i18n.getCurrentLanguage === 'function')
                ? i18n.getCurrentLanguage()
                : 'en';
            const data = await fetchJSONWithRetry(`/api/weather/astro-analysis?hours=24&lang=${encodeURIComponent(currentLang)}`, {}, {
                maxAttempts: 8,
                baseDelayMs: 1000,
                maxDelayMs: 15000,
                timeoutMs: 20000,
                shouldRetryData: (payload) => payload && payload.status === 'pending',
                onRetry: ({ attempt, maxAttempts, waitMs }) => {
                    const seconds = Math.max(1, Math.round(waitMs / 1000));
                    updateAstroChartsLoadingMessage(`${i18n.t('weather.loading_astro_chart')} ${i18n.t('common.retrying_in', { seconds, attempt, maxAttempts })}`);
                }
            });

            if (data.status === 'pending') {
                throw new Error(i18n.t('weather.loading_astro_failed'));
            }
            if (data.error) {
                throw new Error(data.error);
            }

            const tz = data.location?.timezone || 'UTC';
            const rows = _trendWindow(data.hourly_data || []);
            if (rows.length === 0) {
                throw new Error(i18n.t('weather.loading_astro_failed'));
            }

            loadingDiv.style.display = 'none';

            const labels = rows.map(h => formatTimeOnlyInTimezone(h.datetime, tz));
            const isDay = rows.map(h => (h.is_day === 1 ? 1 : 0));
            const score = rows.map(h => {
                const s = toFiniteNumber(h.observation_score);
                return s == null ? null : Math.round(s * 100) / 10; // 0-10 -> 0-100
            });
            const cloudlessOf = (v) => { const n = toFiniteNumber(v); return n == null ? null : 100 - n; };

            destroyAstronomicalCharts();

            // -- Block 1: Night score (hero) --
            nightScoreChartInstance = _buildTrendChart({
                containerId: 'nightScoreChartContainer',
                canvasId: 'nightScoreChart',
                icon: 'bi bi-moon-stars icon-inline',
                title: i18n.t('weather.chart_nightscore_title'),
                axisLabel: i18n.t('weather.chart_nightscore_axis'),
                labels,
                isDay,
                legendKey: true,
                datasets: [{
                    label: i18n.t('weather.chart_nightscore_title'),
                    data: score,
                    borderColor: TREND_SCORE_COLORS.good,
                    backgroundColor: 'rgba(100, 116, 139, 0.10)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 2.5,
                    pointHoverRadius: 4,
                    pointBackgroundColor: (c) => _scoreBandColor(toFiniteNumber(c.raw) ?? 0),
                    pointBorderColor: (c) => _scoreBandColor(toFiniteNumber(c.raw) ?? 0),
                    segment: {
                        borderColor: (seg) => _scoreBandColor(Math.min(
                            seg.p0.parsed.y ?? 0, seg.p1.parsed.y ?? 0)),
                    }
                }],
                legendItems: [
                    { label: i18n.t('common.quality_scale.good'), color: TREND_SCORE_COLORS.good },
                    { label: i18n.t('common.quality_scale.fair'), color: TREND_SCORE_COLORS.fair },
                    { label: i18n.t('common.quality_scale.poor'), color: TREND_SCORE_COLORS.poor },
                    { label: i18n.t('weather.chart_daytime'), color: 'rgba(148, 163, 184, 0.55)' }
                ],
                tooltip: {
                    callbacks: {
                        labelColor: (c) => {
                            const col = _scoreBandColor(toFiniteNumber(c.raw) ?? 0);
                            return { borderColor: col, backgroundColor: col };
                        },
                        label: (c) => `${i18n.t('weather.chart_nightscore_title')}: ${(c.parsed.y / 10).toFixed(1)}/10`
                    }
                }
            });
            _renderTrendCaption(rows, tz, score);

            // -- Block 2: Sky --
            skyChartInstance = _buildTrendChart({
                containerId: 'skyChartContainer',
                canvasId: 'skyChart',
                icon: 'bi bi-clouds icon-inline',
                title: i18n.t('weather.chart_sky_title'),
                axisLabel: i18n.t('weather.chart_percentage'),
                labels,
                isDay,
                datasets: [
                    {
                        label: i18n.t('weather.chart_fog'),
                        data: rows.map(h => _fogPercent(h.relative_humidity_2m)),
                        type: 'bar', backgroundColor: 'rgba(148, 163, 184, 0.35)',
                        borderColor: 'rgba(148, 163, 184, 0.6)', borderWidth: 1, order: 20, yAxisID: 'y'
                    },
                    {
                        label: i18n.t('weather.chart_precipitation'),
                        data: rows.map(h => toFiniteNumber(h.precipitation) ?? 0),
                        type: 'bar', backgroundColor: 'rgba(37, 99, 235, 0.5)',
                        borderColor: 'rgb(37, 99, 235)', borderWidth: 1, order: 19, yAxisID: 'y2'
                    },
                    {
                        label: i18n.t('weather.chart_cloudless'),
                        data: rows.map(h => cloudlessOf(h.cloud_cover)),
                        borderColor: 'rgb(34, 197, 94)', backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        borderWidth: 2.5, fill: false, tension: 0.35, order: 1, yAxisID: 'y'
                    },
                    {
                        label: i18n.t('weather.chart_cloudless_high'),
                        data: rows.map(h => cloudlessOf(h.cloud_cover_high)),
                        borderColor: 'rgba(71, 85, 105, 0.85)', borderWidth: 1, borderDash: [2, 2],
                        fill: false, tension: 0.35, pointRadius: 0, order: 5, yAxisID: 'y'
                    },
                    {
                        label: i18n.t('weather.chart_cloudless_mid'),
                        data: rows.map(h => cloudlessOf(h.cloud_cover_mid)),
                        borderColor: 'rgba(100, 116, 139, 0.7)', borderWidth: 1, borderDash: [4, 3],
                        fill: false, tension: 0.35, pointRadius: 0, order: 6, yAxisID: 'y'
                    },
                    {
                        label: i18n.t('weather.chart_cloudless_low'),
                        data: rows.map(h => cloudlessOf(h.cloud_cover_low)),
                        borderColor: 'rgba(148, 163, 184, 0.6)', borderWidth: 1, borderDash: [6, 3],
                        fill: false, tension: 0.35, pointRadius: 0, order: 7, yAxisID: 'y'
                    }
                ],
                legendItems: [
                    { label: i18n.t('weather.chart_fog'), color: '#94a3b8' },
                    { label: i18n.t('weather.chart_precipitation'), color: '#2563eb' },
                    { label: i18n.t('weather.chart_cloudless'), color: '#22c55e' },
                    { label: i18n.t('weather.chart_cloudless_high'), color: '#475569' },
                    { label: i18n.t('weather.chart_cloudless_mid'), color: '#64748b' },
                    { label: i18n.t('weather.chart_cloudless_low'), color: '#94a3b8' }
                ],
                scales: {
                    y: _percentAxis(i18n.t('weather.chart_percentage')),
                    y2: {
                        type: 'linear', position: 'right', min: 0,
                        title: { display: !_isNarrowViewport(), text: `${i18n.t('weather.chart_precipitation')} (${i18n.t('units.precipitation_mm')})` },
                        grid: { drawOnChartArea: false }
                    },
                    x: _timeAxis()
                },
                tooltip: _trendTooltip({ y: i18n.t('units.percent'), y2: ` ${i18n.t('units.precipitation_mm')}` })
            });

            // -- Block 3: Atmosphere & tracking --
            atmosphereChartInstance = _buildTrendChart({
                containerId: 'atmosphereChartContainer',
                canvasId: 'atmosphereChart',
                icon: 'bi bi-eye icon-inline',
                title: i18n.t('weather.chart_atmosphere_title'),
                axisLabel: i18n.t('weather.chart_percentage'),
                labels,
                isDay,
                datasets: [
                    {
                        label: i18n.t('astro_weather.seeing'),
                        data: rows.map(h => { const n = toFiniteNumber(h.seeing_pickering); return n == null ? null : n * 10; }),
                        borderColor: 'rgb(249, 115, 22)', backgroundColor: 'rgba(249, 115, 22, 0.1)',
                        borderWidth: 2, fill: false, tension: 0.35, order: 1, yAxisID: 'y'
                    },
                    {
                        label: i18n.t('astro_weather.transparency'),
                        data: rows.map(h => toFiniteNumber(h.transparency_score)),
                        borderColor: 'rgb(168, 85, 247)', backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        borderWidth: 2, fill: false, tension: 0.35, order: 2, yAxisID: 'y'
                    },
                    {
                        label: i18n.t('astro_weather.tracking'),
                        data: rows.map(h => toFiniteNumber(h.tracking_stability_score)),
                        borderColor: 'rgb(14, 165, 233)', backgroundColor: 'rgba(14, 165, 233, 0.1)',
                        borderWidth: 2, fill: false, tension: 0.35, order: 3, yAxisID: 'y'
                    },
                    {
                        label: i18n.t('weather.chart_lifted_index'),
                        data: rows.map(h => toFiniteNumber(h.lifted_index)),
                        borderColor: 'rgb(6, 182, 212)', borderWidth: 2, borderDash: [5, 4],
                        fill: false, tension: 0.35, pointRadius: 0, order: 4, yAxisID: 'y1'
                    }
                ],
                legendItems: [
                    { label: i18n.t('astro_weather.seeing'), color: '#f97316' },
                    { label: i18n.t('astro_weather.transparency'), color: '#a855f7' },
                    { label: i18n.t('astro_weather.tracking'), color: '#0ea5e9' },
                    { label: i18n.t('weather.chart_lifted_index'), color: '#06b6d4' }
                ],
                scales: {
                    y: _percentAxis(i18n.t('weather.chart_percentage')),
                    y1: {
                        type: 'linear', position: 'right',
                        title: { display: !_isNarrowViewport(), text: `${i18n.t('weather.chart_lifted_index')} (${i18n.t('units.temperature_celsius')})` },
                        grid: { drawOnChartArea: false }
                    },
                    x: _timeAxis()
                },
                tooltip: _trendTooltip({ y: i18n.t('units.percent'), y1: ` ${i18n.t('units.temperature_celsius')}` })
            });

            const trendSection = containerDiv ? containerDiv.closest('.bg-sub-container') : null;
            if (trendSection) {
                const existingTrendFooter = trendSection.querySelector('.js-trend-data-source-footer');
                if (existingTrendFooter && existingTrendFooter.parentNode) {
                    existingTrendFooter.parentNode.removeChild(existingTrendFooter);
                }
                const trendFooter = createDataSourceFooter({
                    text: i18n.t('weather.footer_source'),
                    links: [
                        { href: 'https://open-meteo.com/', label: 'Open-Meteo' }
                    ]
                });
                trendFooter.classList.add('js-trend-data-source-footer');
                trendSection.appendChild(trendFooter);
            }

        } catch (error) {
            console.error('Error loading astronomical charts:', error);
            loadingDiv.style.display = 'none';
            containerDiv.style.display = 'none';
            // Show the actual error reason rather than the generic static text
            errorDiv.textContent = error.message || i18n.t('weather.loading_astro_failed');
            errorDiv.style.display = 'block';
        } finally {
            astroChartsRequestInFlight = null;
        }
    })();

    return astroChartsRequestInFlight;
}
