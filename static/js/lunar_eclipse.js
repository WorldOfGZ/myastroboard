// ======================
// Lunar Eclipse
// ======================

// Load Lunar Eclipse data
async function loadLunarEclipse() {
    const container = document.getElementById('lunar-eclipse-display');
    const data = await fetchJSONWithUI('/api/moon/next-eclipse', container, 'Loading Lunar Eclipse data...', {
        pendingMessage: 'Cache not ready. Retrying...'
    });
    if (!data) return;

    try {
        clearContainer(container);

        // Check if eclipse data is available
        if (!data.lunar_eclipse) {
            DOMUtils.clear(container);
            const alert = document.createElement('div');
            alert.className = 'alert alert-info';
            alert.setAttribute('role', 'alert');
            alert.textContent = `ℹ️ ${data.message || 'No lunar eclipse data available'}`;
            container.appendChild(alert);
            return;
        }

        const eclipse = data.lunar_eclipse;        

        let visibilityBadge = '';
        if (!eclipse.visible) {
            visibilityBadge = '<span class="badge bg-danger">Not visible</span>';
        } else {
            visibilityBadge = '<span class="badge bg-success">Visible</span>';
        }

        let scoreColor = 'secondary';
        if (eclipse.astrophotography_score >= 9) scoreColor = 'success';
        else if (eclipse.astrophotography_score >= 7.5) scoreColor = 'info';
        else if (eclipse.astrophotography_score >= 6) scoreColor = 'warning';
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

        const createListItem = (labelText, valueText) => {
            const item = document.createElement('li');
            item.className = 'list-group-item d-flex justify-content-between align-items-center';
            const label = document.createElement('span');
            label.textContent = labelText;
            const value = document.createElement('span');
            value.className = 'fw-bold';
            value.textContent = valueText;
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
        overviewList.appendChild(createListItem(
            'Total Duration:',
            eclipse.total_duration_minutes > 0 ? `${eclipse.total_duration_minutes} min` : 'None'
        ));
        overviewList.appendChild(createListItem(
            'Partial Duration:',
            eclipse.partial_duration_minutes > 0 ? `${eclipse.partial_duration_minutes} min` : 'None'
        ));
        overview.card.appendChild(overviewList);
        row.appendChild(overview.col);

        const timing = createCardCol('⏱️ Timing');
        const timingList = createList();
        timingList.appendChild(createListItem('Partial begin:', formatTimeThenDate(eclipse.partial_begin)));
        if (eclipse.total_begin) {
            timingList.appendChild(createListItem('Total begin:', formatTimeThenDate(eclipse.total_begin)));
            timingList.appendChild(createListItem('Total end:', formatTimeThenDate(eclipse.total_end)));
        }
        timingList.appendChild(createListItem('Partial end:', formatTimeThenDate(eclipse.partial_end)));
        timing.card.appendChild(timingList);
        row.appendChild(timing.col);

        const position = createCardCol('📍 Position at Peak');
        const positionList = createList();
        positionList.appendChild(createListItem('Peak Time:', formatTimeThenDate(eclipse.peak_time)));
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
            chartContainer.id = 'lunar-eclipse-chart-container';
            container.appendChild(chartContainer);
        }

        // Create altitude vs time chart if data available
        if (eclipse.altitude_vs_time && eclipse.altitude_vs_time.length > 0) {
            renderLunarEclipseAltitudeChart(eclipse.altitude_vs_time);
        }

    } catch (error) {
        console.error('Error loading lunar eclipse data:', error);
        DOMUtils.clear(container);
        const errorBox = document.createElement('div');
        errorBox.className = 'error-box';
        errorBox.textContent = 'Failed to load Lunar Eclipse data';
        container.appendChild(errorBox);
    }
}

// Render altitude vs time chart
function renderLunarEclipseAltitudeChart(altitudeData) {
    const container = document.getElementById('lunar-eclipse-chart-container');
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
    chartCanvas.id = 'lunar-eclipse-altitude-chart';
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
    badge.style.backgroundColor = '#C0C0C0';
    badge.textContent = 'Moon Altitude';
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

    const ctx = document.getElementById('lunar-eclipse-altitude-chart');
    if (!ctx) return;
    
    const ctx_2d = ctx.getContext('2d');
    new Chart(ctx_2d, {
        type: 'line',
        data: {
            labels: times,
            datasets: [{
                label: 'Moon Altitude (°)',
                data: altitudes,
                borderColor: '#C0C0C0',
                backgroundColor: 'rgba(192, 192, 192, 0.1)',
                borderWidth: 2,
                tension: 0.1,
                fill: true,
                pointRadius: 2,
                pointBackgroundColor: '#C0C0C0',
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
