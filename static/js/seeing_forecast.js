// ======================
// Seeing Forecast (7Timer)
// ======================

function getSeeingBadgeClass(seeingValue) {
    const v = Number(seeingValue);
    if (!Number.isFinite(v)) return 'text-secondary';
    if (v <= 1) return 'text-success';
    if (v <= 2) return 'text-primary';
    if (v <= 3) return 'text-warning';
    return 'text-danger';
}

function renderSeeingForecastRows(forecast) {
    const table = document.createElement('table');
    table.className = 'table table-striped table-hover mb-0';

    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    ['common.time_label', 'seeing_forecast.current_seeing', 'common.quality'].forEach((key) => {
        const th = document.createElement('th');
        th.textContent = i18n.t(key);
        trh.appendChild(th);
    });
    thead.appendChild(trh);

    const tbody = document.createElement('tbody');
    (forecast || []).forEach((point) => {
        const tr = document.createElement('tr');

        const tdTime = document.createElement('td');
        tdTime.textContent = formatTimeThenDate(point.time);

        const tdSeeing = document.createElement('td');
        const badgeClass = getSeeingBadgeClass(point.seeing);
        tdSeeing.innerHTML = `<span class="fw-bold ${badgeClass}">${point.seeing}</span>`;

        const tdDesc = document.createElement('td');
        tdDesc.textContent = point.description || i18n.t('common.quality_scale.unknown');

        tr.appendChild(tdTime);
        tr.appendChild(tdSeeing);
        tr.appendChild(tdDesc);
        tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    return table;
}

async function loadSeeingForecast() {
    const container = document.getElementById('seeing-forecast-display');
    const data = await fetchJSONWithUI('/api/seeing-forecast', container, i18n.t('seeing_forecast.loading_forecast'));
    if (!data) return;

    DOMUtils.clear(container);

    const seeingData = data.seeing_forecast;
    if (!seeingData) {
        const warning = document.createElement('div');
        warning.className = 'alert alert-warning';
        warning.setAttribute('role', 'alert');
        warning.textContent = data.message_key ? i18n.t(data.message_key) : (data.message || i18n.t('seeing_forecast.no_data'));
        container.appendChild(warning);
        return;
    }

    if (seeingData.message_key || seeingData.message) {
        const notice = document.createElement('div');
        notice.className = 'alert alert-warning';
        notice.setAttribute('role', 'alert');
        notice.textContent = seeingData.message_key ? i18n.t(seeingData.message_key) : seeingData.message;
        container.appendChild(notice);
    }

    const infoAlert = document.createElement('div');
    infoAlert.className = 'alert alert-info';
    infoAlert.setAttribute('role', 'alert');
    infoAlert.innerHTML = `<i class="bi bi-bullseye icon-inline" aria-hidden="true"></i>${i18n.t('seeing_forecast.planetary_imaging')}`;
    container.appendChild(infoAlert);

    const topRow = document.createElement('div');
    topRow.className = 'row row-cols-1 row-cols-lg-2 g-3 mb-3';

    const currentCol = document.createElement('div');
    currentCol.className = 'col';
    const currentCard = document.createElement('div');
    currentCard.className = 'card h-100';
    currentCard.innerHTML = `
        <div class="card-header fw-bold">
            <i class="bi bi-eye icon-inline" aria-hidden="true"></i>${i18n.t('seeing_forecast.current_seeing')}
        </div>
        <div class="card-body">
            <div class="fs-3 fw-bold ${getSeeingBadgeClass(seeingData.now)}">${seeingData.now ?? '-'}</div>
            <div class="text-muted">${seeingData.now_description || i18n.t('common.quality_scale.unknown')}</div>
            <small class="text-muted">${i18n.t('seeing_forecast.data_source')}</small>
        </div>
    `;
    currentCol.appendChild(currentCard);

    const bestCol = document.createElement('div');
    bestCol.className = 'col';
    const bestCard = document.createElement('div');
    bestCard.className = 'card h-100';
    const bw = seeingData.best_window;
    if (bw) {
        bestCard.innerHTML = `
            <div class="card-header fw-bold">
                <i class="bi bi-clock-history icon-inline" aria-hidden="true"></i>${i18n.t('seeing_forecast.best_window')}
            </div>
            <div class="card-body">
                <div><strong>${i18n.t('common.time_label')}:</strong> ${formatTimeThenDate(bw.start)}</div>
                <div><strong>${i18n.t('common.duration')}</strong> ${bw.duration_hours}h</div>
                <div><strong>${i18n.t('common.quality')}:</strong> <span class="${getSeeingBadgeClass(bw.seeing)}">${bw.description || bw.seeing}</span></div>
            </div>
        `;
    } else {
        bestCard.innerHTML = `
            <div class="card-header fw-bold">
                <i class="bi bi-clock-history icon-inline" aria-hidden="true"></i>${i18n.t('seeing_forecast.best_window')}
            </div>
            <div class="card-body text-muted">${i18n.t('seeing_forecast.no_data')}</div>
        `;
    }
    bestCol.appendChild(bestCard);

    topRow.appendChild(currentCol);
    topRow.appendChild(bestCol);
    container.appendChild(topRow);

    const forecastCard = document.createElement('div');
    forecastCard.className = 'card h-100';
    const header = document.createElement('div');
    header.className = 'card-header fw-bold';
    header.innerHTML = `<i class="bi bi-calendar-event text-danger icon-inline" aria-hidden="true"></i>${i18n.t('seeing_forecast.forecast')}`;
    const body = document.createElement('div');
    body.className = 'table-responsive';
    body.appendChild(renderSeeingForecastRows(seeingData.forecast));

    forecastCard.appendChild(header);
    forecastCard.appendChild(body);
    container.appendChild(forecastCard);
}
