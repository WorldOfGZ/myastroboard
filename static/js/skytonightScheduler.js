/* =====================
    skytonightScheduler
    (SkyTonight execution)
   ===================== */

const SkyTonightScheduler = (() => {

    const state = {
        isExecuting: false,
        pollInterval: null,
        mode: 'idle', // idle | manual | scheduled
    };

    // Guard against transient is_executing=false flicker during thread start.
    // We only call finish() after two consecutive false responses.
    let _notExecutingCount = 0;

    let last_catalogue_executed = null;

    const els = {
        banner: () => document.getElementById('global-scheduler-banner'),
        progress: () => document.getElementById('global-scheduler-progress'),
        detail: () => document.getElementById('global-scheduler-detail'),
        button: () => document.getElementById('run-now'),
    };

    async function fetchStatus() {
        return fetchJSONWithRetry('/api/skytonight/scheduler/status', {}, {
            maxAttempts: 3,
            baseDelayMs: 1000,
            maxDelayMs: 5000,
            timeoutMs: 8000
        });
    }

    async function trigger() {
        try {
            blockButton();
            state.mode = 'manual';

            const data = await fetchJSONWithRetry('/api/skytonight/scheduler/trigger', {
                method: 'POST'
            }, {
                maxAttempts: 1,
                timeoutMs: 10000
            });

            if (data.status !== 'triggered') {
                throw new Error('Trigger failed');
            }

            startPolling(2000);
        } catch (e) {
            console.error(e);
            resetUI();
            showMessage('error', 'Failed to trigger scheduler');
        }
    }

    function render(status) {
        
        if (status.is_executing) {
            _notExecutingCount = 0;
            state.isExecuting = true;
            showBanner();
            blockButton();

            const p = status.progress;
            const duration = p?.execution_duration_seconds
                ? ` (${formatDuration(p.execution_duration_seconds)})`
                : '';

            if (p?.phase && p.phase !== '') {
                // Phase-based progress from skytonight_calculator
                const phaseLabel = i18n.t(`scheduler.phase_${p.phase}`, {}, p.phase);
                if (p.phase_total > 0) {
                    els.progress().textContent =
                        `${phaseLabel} — ${p.phase_processed}/${p.phase_total}${duration}`;
                } else {
                    els.progress().textContent = `${phaseLabel}${duration}`;
                }
                els.detail().textContent = '';
            } else if (p?.current_catalogue && p.total_catalogues > 0) {
                // Legacy per-catalogue progress
                els.progress().textContent =
                    `${i18n.t('scheduler.processing')} ${p.current_index}/${p.total_catalogues}${duration}`;
                els.detail().textContent =
                    `${i18n.t('scheduler.current')} ${p.current_catalogue}`;
                last_catalogue_executed = p.current_catalogue;
            } else {
                els.progress().textContent =
                    i18n.t('scheduler.processing_catalogues') + duration;
                els.detail().textContent = '';
            }
        } else if (state.isExecuting) {
            _notExecutingCount++;
            if (_notExecutingCount >= 2) {
                // Two consecutive false responses — execution genuinely finished.
                loadSkyTonightResultsTabs();
                last_catalogue_executed = null;
                state.isExecuting = false;
                _notExecutingCount = 0;
                finish();
            }
            // else: keep banner up, wait for confirmation next poll
        }
    }

    function finish() {
        stopPolling();

        els.progress().innerHTML = `<i class="bi bi-check-circle-fill text-success icon-inline" aria-hidden="true"></i>${i18n.t('scheduler.complete')}`;
        els.detail().textContent =
            i18n.t('scheduler.success');

        showMessage(
            'success',
            state.mode === 'manual'
                ? i18n.t('scheduler.manual_complete')
                : i18n.t('scheduler.scheduled_complete')
        );

        setTimeout(resetUI, state.mode === 'manual' ? 3000 : 5000);
        state.mode = 'idle';
    }

    async function poll() {
        try {
            const status = await fetchStatus();
            render(status);
        } catch (e) {
            console.error('SkyTonight scheduler polling error', e);
            stopPolling();
            resetUI();
        }
    }

    function startPolling(interval) {
        if (state.pollInterval) return;
        state.pollInterval = setInterval(poll, interval);
    }

    function stopPolling() {
        clearInterval(state.pollInterval);
        state.pollInterval = null;
    }

    function showBanner() {
        els.banner().style.display = 'block';
    }

    function hideBanner() {
        els.banner().style.display = 'none';
    }

    function blockButton() {
        const btn = els.button();
        if (!btn) return;
        btn.disabled = true;
        btn.innerHTML = `<i class="bi bi-hourglass-split icon-inline" aria-hidden="true"></i>${i18n.t('scheduler.status_running')}`;
    }

    function resetButton() {
        const btn = els.button();
        if (!btn) return;
        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-play-fill icon-inline" aria-hidden="true"></i>${i18n.t('scheduler.run_now')}`;
    }

    function resetUI() {
        hideBanner();
        resetButton();
    }

    function init() {
        startPolling(3000); // Detect scheduled runs
    }

    function genericMessageLoadingDiv(catalogue) {
        //If subtab exists
        const subtabElement = document.getElementById(`catalogue-${catalogue}-subtab`);
        if(subtabElement) {
            DOMUtils.clear(subtabElement);
            const wrapper = document.createElement('div');
            wrapper.className = 'shadow p-2 mb-3 rounded bg-sub-container';

            const title = document.createElement('h2');
            title.innerHTML = `<i class="bi bi-journal-bookmark icon-inline" aria-hidden="true"></i>${i18n.t('scheduler.results_title', { catalogue })}`;

            const tabs = document.createElement('ul');
            tabs.className = 'nav nav-pills sub-tabs';
            tabs.id = `catalogue-${catalogue}-type-buttons`;

            const content = document.createElement('div');
            content.id = `catalogue-${catalogue}-content`;
            content.className = 'loading';
            content.textContent = i18n.t('scheduler.currently_loading_catalogue', { catalogue });

            wrapper.appendChild(title);
            wrapper.appendChild(tabs);
            wrapper.appendChild(content);
            subtabElement.appendChild(wrapper);
            return;
        }


        const div = document.createElement('div');
        div.className = 'loading-message';
        div.textContent = i18n.t('scheduler.loading_results_for', { catalogue });
        return div;
    }

    return {
        init,
        trigger,
    };
})();