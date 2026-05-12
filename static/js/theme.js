(() => {
    const storageKey = 'myastroboard-theme';
    const modes = new Set(['auto', 'light', 'dark', 'red']);
    const root = document.documentElement;
    const mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    const getStoredMode = () => {
        const stored = localStorage.getItem(storageKey);
        return modes.has(stored) ? stored : 'auto';
    };

    const resolveMode = (mode) => {
        if (mode === 'auto') {
            return mediaQuery && mediaQuery.matches ? 'dark' : 'light';
        }
        return mode;
    };

    const applyTheme = (mode) => {
        const resolved = resolveMode(mode);
        root.setAttribute('data-theme', resolved);
        root.setAttribute('data-bs-theme', resolved === 'light' ? 'light' : 'dark');
        root.setAttribute('data-theme-mode', mode);
    };

    const updatePickers = (mode) => {
        document.querySelectorAll('[data-theme-picker]').forEach((picker) => {
            if (picker.value !== mode) {
                picker.value = mode;
            }
        });
    };

    const CHART_THEME = {
        light: {
            color: '#4b4b4b',
            gridColor: 'rgba(15, 23, 42, 0.1)',
            borderColor: 'rgba(15, 23, 42, 0.1)',
        },
        dark: {
            color: '#a1a1aa',
            gridColor: 'rgba(148, 163, 184, 0.2)',
            borderColor: 'rgba(148, 163, 184, 0.2)',
        },
        red: {
            color: '#e6a3a3',
            gridColor: 'rgba(255, 120, 120, 0.2)',
            borderColor: 'rgba(255, 120, 120, 0.2)',
        },
    };

    const applyChartDefaults = (mode) => {
        if (typeof Chart === 'undefined') return;
        const resolved = resolveMode(mode);
        const t = CHART_THEME[resolved] || CHART_THEME.light;
        Chart.defaults.color = t.color;
        Chart.defaults.borderColor = t.borderColor;
        if (Chart.defaults.scale) {
            Chart.defaults.scale.grid = Chart.defaults.scale.grid || {};
            Chart.defaults.scale.grid.color = t.gridColor;
            Chart.defaults.scale.ticks = Chart.defaults.scale.ticks || {};
            Chart.defaults.scale.ticks.color = t.color;
        }
        // Also patch all registered scale defaults (x, y, linear, category…)
        if (Chart.defaults.scales) {
            Object.values(Chart.defaults.scales).forEach(scale => {
                if (scale.grid) scale.grid.color = t.gridColor;
                if (scale.ticks) scale.ticks.color = t.color;
            });
        }
    };

    const setTheme = (mode) => {
        const safeMode = modes.has(mode) ? mode : 'auto';
        localStorage.setItem(storageKey, safeMode);
        applyTheme(safeMode);
        updatePickers(safeMode);
        applyChartDefaults(safeMode);
    };

    const init = () => {
        const initialMode = getStoredMode();
        applyTheme(initialMode);

        if (mediaQuery) {
            mediaQuery.addEventListener('change', () => {
                if (getStoredMode() === 'auto') {
                    applyTheme('auto');
                    applyChartDefaults('auto');
                }
            });
        }

        document.addEventListener('DOMContentLoaded', () => {
            applyChartDefaults(getStoredMode());
            updatePickers(getStoredMode());
            document.querySelectorAll('[data-theme-picker]').forEach((picker) => {
                picker.addEventListener('change', (event) => {
                    setTheme(event.target.value);
                });
            });
        });
    };

    init();
    window.MyAstroBoardTheme = { setTheme };
})();
