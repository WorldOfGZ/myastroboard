// ======================
// Solar Eclipse
// ======================

// Load Solar Eclipse data
async function loadSolarEclipse() {
    const container = document.getElementById('solar-eclipse-display');
    const data = await fetchJSONWithUI('/api/sun/next-eclipse', container, 'Loading Solar Eclipse data...', {
        pendingMessage: 'Cache not ready. Retrying...'
    });
    if (!data) return;

    try {
        clearContainer(container);

        // Check if eclipse data is available
        if (!data.solar_eclipse) {
            DOMUtils.clear(container);
            const alert = document.createElement('div');
            alert.className = 'alert alert-info';
            alert.setAttribute('role', 'alert');
            alert.textContent = `ℹ️ ${data.message || 'No solar eclipse data available'}`;
            container.appendChild(alert);
            return;
        }

        const eclipse = data.solar_eclipse;

        let visibilityBadge = '';
        if (!eclipse.visible) {
            visibilityBadge = '<span class="badge bg-danger">Not visible</span>';
        } else {
            visibilityBadge = '<span class="badge bg-success">Visible</span>';
        }

        let scoreColor = 'secondary';
        if (eclipse.astrophotography_score >= 8.5) scoreColor = 'success';
        else if (eclipse.astrophotography_score >= 7) scoreColor = 'info';
        else if (eclipse.astrophotography_score >= 5) scoreColor = 'warning';
        else if (eclipse.astrophotography_score > 0) scoreColor = 'danger';

        DOMUtils.clear(container);

        const row = document.createElement('div');
        row.className = 'row row-cols-1 row-cols-sm-2 row-cols-lg-2 row-cols-xl-4 mb-3';

        const createCardCol = (titleText) => {
            const col = document.createElement('div');
            col.className = 'col mb-3';
            const card = document.createElement('div');
            card.className = 'card h-100';
            const header = document.createElement('div');
            header.className = 'card-header fw-bold';
            header.textContent = titleText;
            card.appendChild(header);
            col.appendChild(card);
            return { col, card };
        };

        const createList = () => {
            const list = document.createElement('ul');
            list.className = 'list-group list-group-flush';
            return list;
        };

        const createListItem = (labelText, valueNodeOrText) => {
            const item = document.createElement('li');
            item.className = 'list-group-item d-flex justify-content-between align-items-center';
            const label = document.createElement('span');
            label.textContent = labelText;
            const value = document.createElement('span');
            if (typeof valueNodeOrText === 'string') {
                value.className = 'fw-bold';
                value.textContent = valueNodeOrText;
            } else {
                value.appendChild(valueNodeOrText);
            }
            item.appendChild(label);
            item.appendChild(value);
            return item;
        };

        const overview = createCardCol('📊 Overview');
        const overviewList = createList();
        overviewList.appendChild(createListItem('Type:', eclipse.type));
        const visibilityItem = document.createElement('li');
        visibilityItem.className = 'list-group-item d-flex justify-content-between align-items-center';
        const visibilityLabel = document.createElement('span');
        visibilityLabel.textContent = 'Visibility:';
        const visibilityValue = document.createElement('span');
        const visibilityBadgeNode = document.createElement('span');
        visibilityBadgeNode.className = `badge ${eclipse.visible ? 'bg-success' : 'bg-danger'}`;
        visibilityBadgeNode.textContent = eclipse.visible ? 'Visible' : 'Not visible';
        visibilityValue.appendChild(visibilityBadgeNode);
        visibilityItem.appendChild(visibilityLabel);
        visibilityItem.appendChild(visibilityValue);
        overviewList.appendChild(visibilityItem);
        overviewList.appendChild(createListItem('Magnitude:', eclipse.magnitude.toFixed(4)));
        overviewList.appendChild(createListItem('Obscuration:', `${eclipse.obscuration_percent.toFixed(1)}%`));
        overview.card.appendChild(overviewList);
        row.appendChild(overview.col);

        const timing = createCardCol('⏱️ Timing');
        const timingList = createList();
        timingList.appendChild(createListItem('Start:', formatTimeThenDate(eclipse.start_time)));
        timingList.appendChild(createListItem('Peak:', formatTimeThenDate(eclipse.peak_time)));
        timingList.appendChild(createListItem('End:', formatTimeThenDate(eclipse.end_time)));
        timingList.appendChild(createListItem('Duration:', `${eclipse.duration_minutes} min`));
        timing.card.appendChild(timingList);
        row.appendChild(timing.col);

        const position = createCardCol('📍 Position at Peak');
        const positionList = createList();
        positionList.appendChild(createListItem('Altitude:', `${eclipse.peak_altitude_deg.toFixed(2)}°`));
        positionList.appendChild(createListItem('Azimuth:', `${eclipse.peak_azimuth_deg.toFixed(2)}°`));
        positionList.appendChild(createListItem('Direction:', getCardinalDirection(eclipse.peak_azimuth_deg)));
        position.card.appendChild(positionList);
        row.appendChild(position.col);

        const score = createCardCol('⭐ Astrophotography Score');
        const scoreBody = document.createElement('div');
        scoreBody.className = 'p-3';
        scoreBody.style.textAlign = 'center';
        const scoreValue = document.createElement('div');
        scoreValue.className = 'display-4 fw-bold';
        scoreValue.style.color = `var(--bs-${scoreColor})`;
        scoreValue.textContent = `${eclipse.astrophotography_score.toFixed(1)}/10`;
        const scoreBadge = document.createElement('div');
        scoreBadge.className = `badge bg-${scoreColor} mt-2`;
        scoreBadge.textContent = eclipse.score_classification;
        const scoreHint = document.createElement('div');
        scoreHint.className = 'small text-muted mt-2';
        scoreHint.textContent = 'Score based on type, visibility, altitude, and duration';
        scoreBody.appendChild(scoreValue);
        scoreBody.appendChild(scoreBadge);
        scoreBody.appendChild(scoreHint);
        score.card.appendChild(scoreBody);
        row.appendChild(score.col);

        container.appendChild(row);

        if (eclipse.altitude_vs_time && eclipse.altitude_vs_time.length > 0) {
            const chartContainer = document.createElement('div');
            chartContainer.id = 'solar-eclipse-chart-container';
            container.appendChild(chartContainer);
        }

        // Create altitude vs time chart if data available
        if (eclipse.altitude_vs_time && eclipse.altitude_vs_time.length > 0) {
            renderSolarEclipseAltitudeChart(eclipse.altitude_vs_time);
        }

    } catch (error) {
        console.error('Error loading solar eclipse data:', error);
        DOMUtils.clear(container);
        const errorBox = document.createElement('div');
        errorBox.className = 'error-box';
        errorBox.textContent = 'Failed to load Solar Eclipse data';
        container.appendChild(errorBox);
    }
}

// Render altitude vs time chart
function renderSolarEclipseAltitudeChart(altitudeData) {
    const container = document.getElementById('solar-eclipse-chart-container');
    if (!container || !altitudeData || altitudeData.length === 0) return;

    const times = altitudeData.map(p => p.time);
    const altitudes = altitudeData.map(p => p.altitude_deg);

    DOMUtils.clear(container);
    const col = document.createElement('div');
    col.className = 'col-12 mb-3';
    const card = document.createElement('div');
    card.className = 'card h-100';
    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-header';
    const title = document.createElement('h5');
    title.className = 'mb-0';
    title.textContent = '📈 Altitude vs Time';
    cardHeader.appendChild(title);

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body';
    const chartCanvas = document.createElement('canvas');
    chartCanvas.id = 'solar-eclipse-altitude-chart';
    chartCanvas.style.height = '300px';
    cardBody.appendChild(chartCanvas);

    const cardFooter = document.createElement('div');
    cardFooter.className = 'card-footer text-muted small';
    const footerRow = document.createElement('div');
    footerRow.className = 'row';
    const badgeCol = document.createElement('div');
    badgeCol.className = 'col-auto';
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.style.backgroundColor = '#FDB813';
    badge.textContent = 'Sun Altitude';
    badgeCol.appendChild(badge);
    const textCol = document.createElement('div');
    textCol.className = 'col-auto';
    const text = document.createElement('span');
    text.className = 'text-muted';
    text.textContent = 'Degrees (°) | Local Time';
    textCol.appendChild(text);
    footerRow.appendChild(badgeCol);
    footerRow.appendChild(textCol);
    cardFooter.appendChild(footerRow);

    card.appendChild(cardHeader);
    card.appendChild(cardBody);
    card.appendChild(cardFooter);
    col.appendChild(card);
    container.appendChild(col);

    const ctx = document.getElementById('solar-eclipse-altitude-chart');
    if (!ctx) return;
    
    const ctx_2d = ctx.getContext('2d');
    new Chart(ctx_2d, {
        type: 'line',
        data: {
            labels: times,
            datasets: [{
                label: 'Sun Altitude (°)',
                data: altitudes,
                borderColor: '#FDB813',
                backgroundColor: 'rgba(253, 184, 19, 0.1)',
                borderWidth: 2,
                tension: 0.1,
                fill: true,
                pointRadius: 2,
                pointBackgroundColor: '#FDB813',
                pointBorderColor: '#fff',
                pointBorderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 90,
                    title: {
                        display: true,
                        text: 'Altitude (degrees)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Local Time'
                    }
                }
            }
        }
    });
}
