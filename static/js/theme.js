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

    const setTheme = (mode) => {
        const safeMode = modes.has(mode) ? mode : 'auto';
        localStorage.setItem(storageKey, safeMode);
        applyTheme(safeMode);
        updatePickers(safeMode);
    };

    const init = () => {
        const initialMode = getStoredMode();
        applyTheme(initialMode);

        if (mediaQuery) {
            mediaQuery.addEventListener('change', () => {
                if (getStoredMode() === 'auto') {
                    applyTheme('auto');
                }
            });
        }

        document.addEventListener('DOMContentLoaded', () => {
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
