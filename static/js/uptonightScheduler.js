/* =====================
   uptonightScheduler
   (UpTonight execution)
   ===================== */

const UptonightScheduler = (() => {

    const state = {
        isExecuting: false,
        pollInterval: null,
        mode: 'idle', // idle | manual | scheduled
    };

    let last_catalogue_executed = null;

    const els = {
        banner: () => document.getElementById('global-scheduler-banner'),
        progress: () => document.getElementById('global-scheduler-progress'),
        detail: () => document.getElementById('global-scheduler-detail'),
        button: () => document.getElementById('run-now'),
    };

    async function fetchStatus() {
        return fetchJSONWithRetry('/api/scheduler/status', {}, {
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

            const data = await fetchJSONWithRetry('/api/scheduler/trigger', {
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
            showBanner();
            blockButton();

            const p = status.progress;
            if (p?.current_catalogue && p.total_catalogues > 0) {
                const duration = p.execution_duration_seconds
                    ? ` (${formatDuration(p.execution_duration_seconds)})`
                    : '';
                els.progress().textContent =
                    `${i18n.t('scheduler.processing')} ${p.current_index}/${p.total_catalogues}${duration}`;
                els.detail().textContent =
                    `${i18n.t('scheduler.current')} ${p.current_catalogue}`;
                genericMessageLoadingDiv(p.current_catalogue);

                //If current catalogue is different as previous, reload page
                if (last_catalogue_executed !== null && last_catalogue_executed !== p.current_catalogue) {
                    //Only if DOM catalogue-LBN-subtab exists
                    if (document.getElementById(`catalogue-${last_catalogue_executed}-subtab`)) {
                        loadCatalogueResults(last_catalogue_executed);
                    }
                }
                //Remember current catalogue
                last_catalogue_executed = p.current_catalogue;
            } else {
                els.progress().textContent =
                    i18n.t('scheduler.processing_catalogues');
                els.detail().textContent = '';
            }
        } else if (state.isExecuting) {
            //The last execution is never triggered before
            if (document.getElementById(`catalogue-${last_catalogue_executed}-subtab`)) {
                loadCatalogueResults(last_catalogue_executed);
            }
            //Reload results tabs because of possible catalogue checkbox changes
            loadUptonightResultsTabs();
            last_catalogue_executed = null;
            finish();
        }

        state.isExecuting = status.is_executing;
    }

    function finish() {
        stopPolling();

        els.progress().textContent = `✅ ${i18n.t('scheduler.complete')}`;
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
            console.error('Uptonight scheduler polling error', e);
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
        btn.textContent = `⏳ ${i18n.t('scheduler.status_running')}`;
    }

    function resetButton() {
        const btn = els.button();
        if (!btn) return;
        btn.disabled = false;
        btn.textContent = `▶️ ${i18n.t('scheduler.run_now')}`;
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
            title.textContent = `📚 ${i18n.t('scheduler.results_title', { catalogue })}`;

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