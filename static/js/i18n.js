// ==========================================
// Internationalization (i18n) Management
// ==========================================

/**
 * Global i18n manager for MyAstroBoard
 * Handles multi-language support with nested key access
 * 
 * Usage:
 *   i18n.t('common.loading')                    // Get string
 *   i18n.t('weather_alerts.critical_dew_risk', {time: '14:30'})  // Get with placeholders
 *   i18n.setLanguage('fr')                      // Switch language
 *   i18n.getCurrentLanguage()                   // Get current language
 */
class I18nManager {
    constructor() {
        this.translations = {};
        this.currentLanguage = this.detectLanguage();
        this.fallbackLanguage = 'en';
        this.loadedLanguages = new Set();
        
        // Initialize with default language
        this.loadLanguage(this.currentLanguage);
    }

    /**
     * Detect browser language preference
     * Falls back to English if unsupported
     */
    detectLanguage() {
        // Check if language preference is stored in localStorage
        const stored = localStorage.getItem('myastroboard_language');
        if (stored) {
            return stored;
        }

        // Get browser language
        const browserLang = navigator.language || navigator.userLanguage;
        const shortLang = browserLang.split('-')[0]; // e.g., 'en' from 'en-US'

        // Only support en and fr for now
        const supportedLanguages = ['en', 'fr'];
        return supportedLanguages.includes(shortLang) ? shortLang : 'en';
    }

    /**
     * Load translation file for a language
     */
    async loadLanguage(lang) {
        if (this.loadedLanguages.has(lang)) {
            this.currentLanguage = lang;
            localStorage.setItem('myastroboard_language', lang);
            //console.log(`[i18n] Language already loaded: ${lang}`);
            return;
        }

        try {
            const url = `/static/i18n/${lang}.json?v=${window.APP_VERSION || ''}`;
            //console.log(`[i18n] Loading language from: ${url}`);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load ${lang} translations (HTTP ${response.status})`);
            }

            const translations = await response.json();
            this.translations[lang] = translations;
            this.loadedLanguages.add(lang);
            this.currentLanguage = lang;
            localStorage.setItem('myastroboard_language', lang);

            //console.log(`[i18n] Language loaded successfully: ${lang}`, translations);
        } catch (error) {
            console.error(`[i18n] Error loading language ${lang}:`, error);
            // Fall back to English if loading fails
            if (lang !== this.fallbackLanguage && !this.loadedLanguages.has(lang)) {
                console.log(`[i18n] Falling back to ${this.fallbackLanguage}`);
                await this.loadLanguage(this.fallbackLanguage);
            }
        }
    }

    /**
     * Get translated string by key path (e.g., 'common.loading')
     * Supports nested objects with dot notation
     * 
     * @param {string} key - The translation key (dot-separated path)
     * @param {object} params - Optional parameters for placeholder replacement
     * @returns {string} The translated string or key if not found
     */
    t(key, params = {}) {
        const keys = key.split('.');
        let current = this.translations[this.currentLanguage];

        // Debug logging for missing translations
        if (!current) {
            console.warn(`[i18n] Translations not loaded for ${this.currentLanguage}, key: ${key}`);
        }

        // Navigate through nested object
        for (const k of keys) {
            if (current && typeof current === 'object' && k in current) {
                current = current[k];
            } else {
                // Fallback to English if key not found
                if (this.currentLanguage !== this.fallbackLanguage) {
                    current = this.translations[this.fallbackLanguage];
                    for (const fallbackKey of keys) {
                        if (current && typeof current === 'object' && fallbackKey in current) {
                            current = current[fallbackKey];
                        } else {
                            console.debug(`[i18n] Missing translation key: ${key} (fallback also not found)`);
                            return key; // Return key itself if not found
                        }
                    }
                } else {
                    console.debug(`[i18n] Missing translation key: ${key}`);
                    return key; // Return key itself if not found
                }
            }
        }

        let result = typeof current === 'string' ? current : key;

        // Replace placeholders in the format {key}
        for (const [paramKey, paramValue] of Object.entries(params)) {
            const placeholder = `{${paramKey}}`;
            result = result.replaceAll(placeholder, String(paramValue));
        }

        return result;
    }

    /**
     * Get all translations for a namespace
     * Useful for bulk operations
     * 
     * @param {string} namespace - The namespace (e.g., 'common')
     * @returns {object} The translation object or empty object if not found
     */
    getNamespace(namespace) {
        const trans = this.translations[this.currentLanguage];
        return (trans && trans[namespace]) ? trans[namespace] : {};
    }

    /**
     * Set current language
     * 
     * @param {string} lang - Language code to set
     */
    async setLanguage(lang) {
        if (lang === this.currentLanguage) return;
        await this.loadLanguage(lang);
        this.dispatchLanguageChangeEvent();
    }

    /**
     * Get current language
     * 
     * @returns {string} Current language code
     */
    getCurrentLanguage() {
        return this.currentLanguage;
    }

    /**
     * Get list of supported languages
     * 
     * @returns {array} Array of language codes
     */
    getSupportedLanguages() {
        return ['en', 'fr'];
    }

    /**
     * Check if a translation key exists
     * 
     * @param {string} key - The translation key
     * @returns {boolean} True if key exists
     */
    has(key) {
        const keys = key.split('.');
        let current = this.translations[this.currentLanguage];

        for (const k of keys) {
            if (current && typeof current === 'object' && k in current) {
                current = current[k];
            } else {
                return false;
            }
        }

        return typeof current === 'string';
    }

    /**
     * Dispatch custom event when language changes
     * Allows UI components to update when language changes
     */
    dispatchLanguageChangeEvent() {
        const event = new CustomEvent('i18nLanguageChanged', {
            detail: { language: this.currentLanguage }
        });
        window.dispatchEvent(event);
    }

    /**
     * Get HTML lang attribute value
     * @returns {string} Language code for html lang attribute
     */
    getHtmlLang() {
        // Map internal codes to html lang codes
        const htmlLangMap = {
            'en': 'en-US',
            'fr': 'fr-FR'
        };
        return htmlLangMap[this.currentLanguage] || this.currentLanguage;
    }
}

// Initialize global i18n instance
const i18n = new I18nManager();

// Set html lang attribute when language changes
window.addEventListener('i18nLanguageChanged', (e) => {
    document.documentElement.lang = i18n.getHtmlLang();
});

// Set initial html lang
document.documentElement.lang = i18n.getHtmlLang();

/**
 * Utility function to update element text content with translation
 * Useful for dynamic content updates
 * 
 * @param {HTMLElement} element - The element to update
 * @param {string} key - The translation key
 * @param {object} params - Optional parameters for placeholders
 */
function updateElementText(element, key, params = {}) {
    if (element) {
        element.textContent = i18n.t(key, params);
    }
}

/**
 * Utility function to update element HTML with translation
 * Use carefully to avoid XSS - only use with static translation keys, never with dynamic content
 * 
 * @param {HTMLElement} element - The element to update
 * @param {string} key - The translation key
 * @param {object} params - Optional parameters for placeholders
 */
function updateElementHTML(element, key, params = {}) {
    if (element) {
        element.innerHTML = i18n.t(key, params);
    }
}

// Listen for language changes and update UI
window.addEventListener('i18nLanguageChanged', () => {
    console.log('[i18n] Language changed, triggering UI update');
    // This event can be used by individual components to refresh their content
});
