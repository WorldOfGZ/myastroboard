// Plan My Night frontend module

let planMyNightPollTimer = null;

function isPlanEditRole(role) {
    return role === 'admin' || role === 'user';
}

function clearPlanPollTimer() {
    if (planMyNightPollTimer) {
        clearTimeout(planMyNightPollTimer);
        planMyNightPollTimer = null;
    }
}

async function refreshAstrodexAfterPlanAction() {
    if (typeof loadAstrodex === 'function') {
        try {
            await loadAstrodex();
        } catch (error) {
            console.error('Error refreshing astrodex after Plan My Night action:', error);
        }
    }
}

async function loadPlanMyNight() {
    clearPlanPollTimer();

    const container = document.getElementById('plan-my-night-display');
    if (!container) return;

    DOMUtils.clear(container);

    const loading = document.createElement('div');
    loading.className = 'alert alert-info';
    loading.textContent = i18n.t('common.loading');
    container.appendChild(loading);

    try {
        const payload = await fetchJSON('/api/plan-my-night');
        renderPlanMyNight(payload);

        // Keep timeline/current target fresh while tab remains visible.
        planMyNightPollTimer = setTimeout(() => {
            const tab = document.getElementById('plan-my-night-subtab');
            if (tab && tab.classList.contains('active')) {
                loadPlanMyNight();
            }
        }, 60000);
    } catch (error) {
        DOMUtils.clear(container);
        const alert = document.createElement('div');
        alert.className = 'alert alert-danger';
        alert.textContent = i18n.t('plan_my_night.failed_to_load');
        container.appendChild(alert);
    }
}

function makePlanActionButton(labelKey, className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = i18n.t(labelKey);
    button.addEventListener('click', onClick);
    return button;
}

function makePlanIconActionButton(labelKey, className, iconClass, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `${className} plan-icon-btn`;
    button.title = i18n.t(labelKey);
    button.setAttribute('aria-label', i18n.t(labelKey));

    const icon = document.createElement('i');
    icon.className = `${iconClass} icon-inline`;
    icon.setAttribute('aria-hidden', 'true');
    button.appendChild(icon);

    button.addEventListener('click', onClick);
    return button;
}

function getPlanTargetTypeDisplayName(value) {
    const normalizedValue = (value || '').toString().trim();
    if (!normalizedValue) {
        return '-';
    }

    const translationKey = 'uptonight.type_' + strToTranslateKey(normalizedValue);
    if (i18n.has(translationKey)) {
        return i18n.t(translationKey);
    }

    return normalizedValue;
}

function getPlanConstellationDisplayName(value) {
    const normalizedValue = (value || '').toString().trim();
    if (!normalizedValue) {
        return '-';
    }

    const translationKey = 'constellations.' + strToTranslateKey(normalizedValue);
    if (i18n.has(translationKey)) {
        return i18n.t(translationKey);
    }

    return capitalizeWords(normalizedValue);
}

function formatPlanNumericValue(value, decimals = 2) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const parsed = Number.parseFloat(String(value));
    if (!Number.isFinite(parsed)) {
        return String(value);
    }

    return parsed.toFixed(decimals);
}

function parsePlanDurationToMinutes(value) {
    const text = String(value || '').trim();
    if (!text) {
        return 0;
    }

    const parts = text.split(':');
    if (parts.length !== 2) {
        return 0;
    }

    const hours = Number.parseInt(parts[0], 10);
    const minutes = Number.parseInt(parts[1], 10);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || minutes < 0 || minutes > 59) {
        return 0;
    }

    return (hours * 60) + minutes;
}

function formatMinutesAsHourMinute(minutes) {
    const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
    const hours = Math.floor(safeMinutes / 60);
    const remainingMinutes = safeMinutes % 60;
    return `${hours}h${String(remainingMinutes).padStart(2, '0')}`;
}

function computePlannedCoverage(entries, plan) {
    const nightStart = plan && plan.night_start ? new Date(plan.night_start) : null;
    const nightEnd = plan && plan.night_end ? new Date(plan.night_end) : null;

    let nightMinutes = 0;
    if (nightStart instanceof Date && !Number.isNaN(nightStart.getTime()) &&
        nightEnd instanceof Date && !Number.isNaN(nightEnd.getTime()) &&
        nightEnd > nightStart) {
        nightMinutes = Math.round((nightEnd.getTime() - nightStart.getTime()) / 60000);
    }

    let plannedMinutes = 0;
    (entries || []).forEach(entry => {
        const explicitMinutes = Number.parseInt(String(entry.planned_minutes ?? ''), 10);
        if (Number.isFinite(explicitMinutes) && explicitMinutes >= 0) {
            plannedMinutes += explicitMinutes;
            return;
        }
        plannedMinutes += parsePlanDurationToMinutes(entry.planned_duration);
    });

    const fillPercentRaw = nightMinutes > 0 ? (plannedMinutes / nightMinutes) * 100 : 0;
    const fillPercent = Math.max(0, fillPercentRaw);
    const overflowMinutes = Math.max(0, plannedMinutes - nightMinutes);

    return {
        nightMinutes,
        plannedMinutes,
        fillPercent,
        overflowMinutes,
    };
}

function getCoverageStatus(fillPercent) {
    const safePercent = Number(fillPercent) || 0;
    if (safePercent > 100) {
        return { key: 'overloaded', className: 'text-bg-danger' };
    }
    if (safePercent >= 80) {
        return { key: 'optimal', className: 'text-bg-success' };
    }
    return { key: 'underplanned', className: 'text-bg-warning' };
}

function renderPlanMyNight(payload) {
    const container = document.getElementById('plan-my-night-display');
    if (!container) return;

    DOMUtils.clear(container);

    if (!isPlanEditRole(payload.role)) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-info';
        alert.textContent = i18n.t('plan_my_night.read_only_message');
        container.appendChild(alert);
        return;
    }

    const state = payload.state || 'none';
    const plan = payload.plan;
    const timeline = payload.timeline || {};

    const toolbar = document.createElement('div');
    toolbar.className = 'd-flex gap-2 mb-3 flex-wrap';

    if (state !== 'none' && plan) {
        if (state === 'current') {
            const exportCsvBtn = makePlanActionButton('plan_my_night.export_csv', 'btn btn-primary btn-sm', async () => {
                const lang = typeof i18n?.getCurrentLanguage === 'function' ? i18n.getCurrentLanguage() : 'en';
                window.location.href = `/api/plan-my-night/export.csv?lang=${encodeURIComponent(lang)}`;
            });
            const exportPdfBtn = makePlanActionButton('plan_my_night.export_pdf', 'btn btn-success btn-sm', async () => {
                const lang = typeof i18n?.getCurrentLanguage === 'function' ? i18n.getCurrentLanguage() : 'en';
                window.location.href = `/api/plan-my-night/export.pdf?lang=${encodeURIComponent(lang)}`;
            });
            toolbar.appendChild(exportCsvBtn);
            toolbar.appendChild(exportPdfBtn);
        }

        const clearButton = makePlanActionButton('plan_my_night.clear_plan', 'btn btn-danger btn-sm', async () => {
            const confirmClear = window.confirm(i18n.t('plan_my_night.confirm_clear'));
            if (!confirmClear) return;
            await fetchJSON('/api/plan-my-night/clear', { method: 'DELETE' });
            showMessage('success', i18n.t('plan_my_night.plan_cleared'));
            await loadPlanMyNight();
            await loadUptonightResultsTabs();
        });
        toolbar.appendChild(clearButton);
    }

    if (toolbar.children.length > 0) {
        container.appendChild(toolbar);
    }

    if (state === 'none' || !plan) {
        const info = document.createElement('div');
        info.className = 'alert alert-info';
        info.textContent = i18n.t('plan_my_night.no_plan_message');
        container.appendChild(info);
        return;
    }

    if (state === 'previous') {
        const warning = document.createElement('div');
        warning.className = 'alert alert-warning';
        warning.textContent = i18n.t('plan_my_night.previous_plan_message');
        container.appendChild(warning);
    }

    if (timeline.is_inside_night && payload.current_banner) {
        const banner = document.createElement('div');
        banner.className = 'alert alert-success plan-current-banner';
        banner.textContent = i18n.t('plan_my_night.current_target_banner', {
            target: payload.current_banner.name || payload.current_banner.target_name || 'N/A'
        });
        container.appendChild(banner);
    }

    const summary = document.createElement('div');
    summary.className = 'card mb-3';
    const summaryBody = document.createElement('div');
    summaryBody.className = 'card-body';

    const title = document.createElement('h5');
    title.className = 'card-title';
    title.textContent = i18n.t('plan_my_night.night_summary');

    const nightRange = document.createElement('div');
    nightRange.className = 'text-muted';
    nightRange.textContent = `${formatDateTime(plan.night_start)} -> ${formatDateTime(plan.night_end)}`;

    summaryBody.appendChild(title);
    summaryBody.appendChild(nightRange);

    const entries = Array.isArray(plan.entries) ? plan.entries : [];
    const coverage = computePlannedCoverage(entries, plan);

    const coverageWrap = document.createElement('div');
    coverageWrap.className = 'mt-3';

    const coverageHeader = document.createElement('div');
    coverageHeader.className = 'd-flex align-items-center justify-content-between gap-2 mb-1 flex-wrap';

    const coverageLabel = document.createElement('div');
    coverageLabel.className = 'small text-muted';
    coverageLabel.textContent = i18n.t('plan_my_night.planned_fill_progress', {
        progress: coverage.fillPercent.toFixed(1),
        planned: formatMinutesAsHourMinute(coverage.plannedMinutes),
        total: formatMinutesAsHourMinute(coverage.nightMinutes)
    });

    const coverageStatus = getCoverageStatus(coverage.fillPercent);
    const coverageBadge = document.createElement('span');
    coverageBadge.className = `badge ${coverageStatus.className}`;
    coverageBadge.textContent = i18n.t(`plan_my_night.coverage_status_${coverageStatus.key}`);

    coverageHeader.appendChild(coverageLabel);
    coverageHeader.appendChild(coverageBadge);

    const coverageProgress = document.createElement('div');
    coverageProgress.className = 'progress';
    const coverageProgressBar = document.createElement('div');
    coverageProgressBar.className = `progress-bar ${coverage.fillPercent > 100 ? 'bg-danger' : 'bg-success'}`;
    coverageProgressBar.style.width = `${Math.max(0, Math.min(100, coverage.fillPercent))}%`;
    coverageProgressBar.setAttribute('role', 'progressbar');
    coverageProgressBar.setAttribute('aria-valuemin', '0');
    coverageProgressBar.setAttribute('aria-valuemax', '100');
    coverageProgressBar.setAttribute('aria-valuenow', String(Math.round(Math.min(100, coverage.fillPercent))));
    coverageProgress.appendChild(coverageProgressBar);

    coverageWrap.appendChild(coverageHeader);
    coverageWrap.appendChild(coverageProgress);
    summaryBody.appendChild(coverageWrap);

    if (coverage.overflowMinutes > 0) {
        const overflowAlert = document.createElement('div');
        overflowAlert.className = 'alert alert-warning mt-2 mb-0 py-2';
        overflowAlert.textContent = i18n.t('plan_my_night.overflow_warning', {
            overflow: formatMinutesAsHourMinute(coverage.overflowMinutes)
        });
        summaryBody.appendChild(overflowAlert);
    }

    const timelineWrap = document.createElement('div');
    timelineWrap.className = 'mt-3';

    const progressLabel = document.createElement('div');
    progressLabel.className = 'small text-muted mb-1';
    progressLabel.textContent = i18n.t('plan_my_night.timeline_progress', {
        progress: (timeline.progress_percent || 0).toFixed(1)
    });

    const progress = document.createElement('div');
    progress.className = 'progress';
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar bg-info';
    progressBar.style.width = `${Math.max(0, Math.min(100, timeline.progress_percent || 0))}%`;
    progressBar.setAttribute('role', 'progressbar');
    progressBar.setAttribute('aria-valuemin', '0');
    progressBar.setAttribute('aria-valuemax', '100');
    progressBar.setAttribute('aria-valuenow', String(Math.round(timeline.progress_percent || 0)));
    progress.appendChild(progressBar);

    timelineWrap.appendChild(progressLabel);
    timelineWrap.appendChild(progress);

    summaryBody.appendChild(timelineWrap);
    summary.appendChild(summaryBody);
    container.appendChild(summary);

    if (!entries.length) {
        const empty = document.createElement('div');
        empty.className = 'alert alert-info';
        empty.textContent = i18n.t('plan_my_night.empty_plan_targets');
        container.appendChild(empty);
        return;
    }

    const timelineList = document.createElement('ul');
    timelineList.className = 'timeline-with-icons plan-my-night-timeline';

    const civilStartItem = document.createElement('li');
    civilStartItem.className = 'timeline-item mb-3 rounded p-2 ps-3 plan-boundary-item';
    const civilStartBadge = document.createElement('span');
    civilStartBadge.className = 'timeline-icon plan-time-badge plan-boundary-badge';
    civilStartBadge.textContent = formatTimeOnly(plan.night_start);
    civilStartItem.appendChild(civilStartBadge);
    const civilStartTitle = document.createElement('h5');
    civilStartTitle.className = 'fw-bold mb-1';
    civilStartTitle.textContent = i18n.t('plan_my_night.astronomical_night_start');
    civilStartItem.appendChild(civilStartTitle);
    const civilStartDescription = document.createElement('p');
    civilStartDescription.className = 'text-muted mb-0';
    civilStartDescription.textContent = formatDateTime(plan.night_start);
    civilStartItem.appendChild(civilStartDescription);
    timelineList.appendChild(civilStartItem);

    entries.forEach((entry, index) => {
        const item = document.createElement('li');
        item.className = 'timeline-item mb-3 rounded p-2 ps-3 plan-target-item';
        if (entry.id && entry.id === timeline.current_target_id) {
            item.classList.add('plan-target-current');
        }
        if (entry.done) {
            item.classList.add('plan-target-done');
        }

        const startTimeText = entry.timeline_start ? formatTimeOnly(entry.timeline_start) : '--:--';
        const startBadge = document.createElement('span');
        startBadge.className = 'timeline-icon plan-time-badge';
        if (entry.id && entry.id === timeline.current_target_id) {
            startBadge.classList.add('plan-time-badge-current');
        }
        if (entry.done) {
            startBadge.classList.add('plan-time-badge-done');
        }
        startBadge.textContent = startTimeText;
        item.appendChild(startBadge);

        const top = document.createElement('div');
        top.className = 'd-flex justify-content-between align-items-start gap-2 flex-wrap';

        const head = document.createElement('div');
        const name = document.createElement('h5');
        name.className = 'fw-bold mb-1';
        name.textContent = `${index + 1}. ${entry.name || entry.target_name || 'N/A'}`;

        const targetTypeLabel = getPlanTargetTypeDisplayName(entry.type);
        const constellationLabel = getPlanConstellationDisplayName(entry.constellation);
        const meta = document.createElement('p');
        meta.className = 'text-muted mb-1';
        meta.textContent = `${entry.catalogue || '-'} | ${targetTypeLabel} | ${constellationLabel}`;

        const timeRange = document.createElement('p');
        timeRange.className = 'text-muted fw-bold mb-0';
        timeRange.textContent = `${startTimeText} -> ${entry.timeline_end ? formatTimeOnly(entry.timeline_end) : '--:--'}`;

        head.appendChild(name);
        head.appendChild(meta);
        head.appendChild(timeRange);

        const controls = document.createElement('div');
        controls.className = 'd-flex gap-1 flex-wrap';

        if (entry.in_astrodex) {
            const capturedBadge = document.createElement('span');
            capturedBadge.className = 'in-astrodex-badge';
            capturedBadge.innerHTML = `<i class="bi bi-check-circle-fill icon-inline" aria-hidden="true"></i>${i18n.t('uptonight.captured')}`;
            controls.appendChild(capturedBadge);
        } else {
            const addToAstrodexBtn = makePlanActionButton('plan_my_night.add_to_astrodex', 'btn btn-primary btn-sm', async () => {
                const response = await fetchJSON(`/api/plan-my-night/targets/${encodeURIComponent(entry.id)}/add-to-astrodex`, { method: 'POST' });
                if (response && response.reason === 'already_in_astrodex') {
                    showMessage('info', i18n.t('plan_my_night.already_in_astrodex'));
                } else {
                    showMessage('success', i18n.t('plan_my_night.added_to_astrodex'));
                }
                await loadPlanMyNight();
                await loadUptonightResultsTabs();
                await refreshAstrodexAfterPlanAction();
            });
            controls.appendChild(addToAstrodexBtn);
        }

        if (state !== 'previous') {
            const doneBtn = makePlanActionButton(
                entry.done ? 'plan_my_night.mark_undone' : 'plan_my_night.mark_done',
                entry.done ? 'btn btn-secondary btn-sm' : 'btn btn-success btn-sm',
                async () => {
                    await fetchJSON(`/api/plan-my-night/targets/${encodeURIComponent(entry.id)}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ done: !entry.done })
                    });
                    await loadPlanMyNight();
                }
            );
            controls.appendChild(doneBtn);

            const removeBtn = makePlanActionButton('plan_my_night.remove_target', 'btn btn-danger btn-sm', async () => {
                await fetchJSON(`/api/plan-my-night/targets/${encodeURIComponent(entry.id)}`, { method: 'DELETE' });
                await loadPlanMyNight();
                await loadUptonightResultsTabs();
            });
            controls.appendChild(removeBtn);
        }

        top.appendChild(head);
        top.appendChild(controls);
        item.appendChild(top);

        const details = document.createElement('div');
        details.className = 'mt-2 d-flex gap-2 align-items-center flex-wrap';

        const durationLabel = document.createElement('label');
        durationLabel.className = 'form-label mb-0 small';
        durationLabel.textContent = i18n.t('plan_my_night.photo_duration');

        const durationInput = document.createElement('input');
        durationInput.type = 'text';
        durationInput.className = 'form-control form-control-sm plan-duration-input';
        durationInput.value = entry.planned_duration || '01:00';
        durationInput.disabled = state === 'previous';

        details.appendChild(durationLabel);
        details.appendChild(durationInput);

        if (state !== 'previous') {
            const durationSaveBtn = makePlanActionButton('plan_my_night.save_duration', 'btn btn-secondary btn-sm', async () => {
                await fetchJSON(`/api/plan-my-night/targets/${encodeURIComponent(entry.id)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ planned_duration: durationInput.value })
                });
                await loadPlanMyNight();
            });
            details.appendChild(durationSaveBtn);

            const moveUpBtn = makePlanIconActionButton('plan_my_night.move_up', 'btn btn-secondary btn-sm', 'bi bi-arrow-up', async () => {
                await fetchJSON(`/api/plan-my-night/targets/${encodeURIComponent(entry.id)}/reorder`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ new_index: index - 1 })
                });
                await loadPlanMyNight();
            });
            moveUpBtn.disabled = index === 0;
            details.appendChild(moveUpBtn);

            const moveDownBtn = makePlanIconActionButton('plan_my_night.move_down', 'btn btn-secondary btn-sm', 'bi bi-arrow-down', async () => {
                await fetchJSON(`/api/plan-my-night/targets/${encodeURIComponent(entry.id)}/reorder`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ new_index: index + 1 })
                });
                await loadPlanMyNight();
            });
            moveDownBtn.disabled = index === entries.length - 1;
            details.appendChild(moveDownBtn);
        }

        item.appendChild(details);

        const astroInfoValues = [];
        const rightAscensionLabel = i18n.t('uptonight.right_ascension');
        const declinationLabel = i18n.t('uptonight.declination');
        const magLabel = i18n.t('uptonight.table_mag');
        const sizeLabel = i18n.t('uptonight.table_size');
        const fotoLabel = i18n.t('uptonight.table_foto');

        if (entry.ra) {
            astroInfoValues.push(`${rightAscensionLabel}: ${entry.ra}`);
        }
        if (entry.dec) {
            astroInfoValues.push(`${declinationLabel}: ${entry.dec}`);
        }

        const magnitudeValue = formatPlanNumericValue(entry.mag, 2);
        if (magnitudeValue !== null) {
            astroInfoValues.push(`${magLabel}: ${magnitudeValue}`);
        }

        const sizeValue = formatPlanNumericValue(entry.size, 2);
        if (sizeValue !== null) {
            astroInfoValues.push(`${sizeLabel}: ${sizeValue}'`);
        }

        const fotoValue = formatPlanNumericValue(entry.foto, 2);
        if (fotoValue !== null) {
            astroInfoValues.push(`${fotoLabel}: ${fotoValue}`);
        }

        if (astroInfoValues.length) {
            const astroInfo = document.createElement('p');
            astroInfo.className = 'text-muted mb-1 mt-2';
            astroInfo.textContent = astroInfoValues.join(' | ');
            item.appendChild(astroInfo);
        }

        const hasAlttime = entry.catalogue && entry.alttime_file;
        if (hasAlttime && typeof showAlttimePopup === 'function') {
            const alttimeButton = document.createElement('button');
            alttimeButton.type = 'button';
            alttimeButton.className = 'btn btn-info btn-sm mt-1';
            alttimeButton.innerHTML = `<i class="bi bi-graph-up-arrow icon-inline" aria-hidden="true"></i>${i18n.t('features.feature_alttime')}`;
            alttimeButton.addEventListener('click', () => {
                const alttimePath = `${API_BASE}/api/uptonight/outputs/${encodeURIComponent(entry.catalogue)}/${encodeURIComponent(entry.alttime_file)}`;
                showAlttimePopup(`${entry.name || entry.target_name || 'Target'} Altitude-Time`, alttimePath);
            });
            item.appendChild(alttimeButton);
        }

        timelineList.appendChild(item);
    });

    const civilEndItem = document.createElement('li');
    civilEndItem.className = 'timeline-item mb-0 rounded p-2 ps-3 plan-boundary-item';
    const civilEndBadge = document.createElement('span');
    civilEndBadge.className = 'timeline-icon plan-time-badge plan-boundary-badge';
    civilEndBadge.textContent = formatTimeOnly(plan.night_end);
    civilEndItem.appendChild(civilEndBadge);
    const civilEndTitle = document.createElement('h5');
    civilEndTitle.className = 'fw-bold mb-1';
    civilEndTitle.textContent = i18n.t('plan_my_night.astronomical_night_end');
    civilEndItem.appendChild(civilEndTitle);
    const civilEndDescription = document.createElement('p');
    civilEndDescription.className = 'text-muted mb-0';
    civilEndDescription.textContent = formatDateTime(plan.night_end);
    civilEndItem.appendChild(civilEndDescription);
    timelineList.appendChild(civilEndItem);

    container.appendChild(timelineList);
}

window.addEventListener('beforeunload', () => {
    clearPlanPollTimer();
});
