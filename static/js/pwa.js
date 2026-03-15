(function registerPWA() {
    if (!('serviceWorker' in navigator)) {
        return;
    }

    let deferredInstallPrompt = null;

    function getInstallButtons() {
        return Array.from(document.querySelectorAll('[data-pwa-install]'));
    }

    function getInstallStatusNodes() {
        return Array.from(document.querySelectorAll('[data-pwa-install-status]'));
    }

    function setInstallButtonsVisible(visible) {
        getInstallButtons().forEach((button) => {
            button.hidden = !visible;
            button.disabled = !visible;
        });
    }

    function setInstallStatus(message) {
        getInstallStatusNodes().forEach((statusNode) => {
            const hasMessage = Boolean(message);
            statusNode.hidden = !hasMessage;
            statusNode.textContent = message || '';
        });
    }

    function t(key) {
        return (typeof i18n !== 'undefined' && i18n && typeof i18n.t === 'function') ? i18n.t(key) : key;
    }

    function setInstallStatusKey(key) {
        setInstallStatus(t(key));
    }

    function isStandaloneMode() {
        return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    }

    function isIOSMobile() {
        return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    }

    async function onInstallButtonClick() {
        if (!deferredInstallPrompt) {
            setInstallStatusKey('pwa.install_prompt_unavailable');
            return;
        }

        deferredInstallPrompt.prompt();
        const choiceResult = await deferredInstallPrompt.userChoice;

        if (choiceResult.outcome !== 'accepted') {
            setInstallStatusKey('pwa.install_dismissed');
            setInstallButtonsVisible(true);
        }

        deferredInstallPrompt = null;
    }

    window.addEventListener('beforeinstallprompt', (event) => {
        deferredInstallPrompt = event;
        setInstallButtonsVisible(true);
        setInstallStatusKey('pwa.install_ready');
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        setInstallButtonsVisible(false);
        setInstallStatusKey('pwa.install_success');
    });

    window.addEventListener('load', async () => {
        if (isStandaloneMode()) {
            setInstallButtonsVisible(false);
            setInstallStatusKey('pwa.running_installed');
        } else if (isIOSMobile()) {
            setInstallButtonsVisible(false);
            setInstallStatusKey('pwa.ios_add_to_home');
        }

        getInstallButtons().forEach((button) => {
            button.addEventListener('click', onInstallButtonClick);
        });

        try {
            const appVersionMeta = document.querySelector('meta[name="app-version"]');
            let appVersion = appVersionMeta ? String(appVersionMeta.content || '').trim() : '';

            if (!appVersion) {
                try {
                    const response = await fetch('/api/version', { cache: 'no-store' });
                    if (response.ok) {
                        const payload = await response.json();
                        appVersion = String(payload?.version || '').trim();
                    }
                } catch (_) {
                    // Keep fallback below if version endpoint is unavailable.
                }
            }

            if (!appVersion) {
                appVersion = 'dev';
            }

            await navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(appVersion)}`, {
                scope: '/',
                updateViaCache: 'none'
            });
        } catch (error) {
            console.warn('PWA service worker registration failed:', error);
            setInstallStatusKey('pwa.offline_support_unavailable');
        }
    });

    window.addEventListener('i18nLanguageChanged', () => {
        if (deferredInstallPrompt) {
            setInstallStatusKey('pwa.install_ready');
        }
    });
})();
