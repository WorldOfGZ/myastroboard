# MyAstroBoard - Internationalization (i18n) System

## Overview

MyAstroBoard implements a structured multilingual system supporting English and French. The i18n system ensures all user-facing content can be translated while maintaining code structure and preventing hardcoded strings.

**Current Status**: 🚀 Proof of Concept - Initial structure in place for `astro-weather` tab and weather alerts

## Architecture

### Components

```
MyAstroBoard i18n System
│
├── Frontend (JavaScript)
│   ├── static/js/i18n.js         # Global i18n manager
│   ├── static/i18n/en.json       # English translations
│   └── static/i18n/fr.json       # French translations
│
└── Backend (Python)
    └── backend/i18n_utils.py     # Translation utilities
```

### Language Support

| Language | Code | Status | Translation | Type |
|----------|------|--------|--------------|--------------|
| English | `en` | ✅ Active | Human | Default | 
| French | `fr` | ✅ Active | Human | - | 

## Frontend Implementation

### i18n.js - The Global Manager

The `static/js/i18n.js` file provides the `i18nManager` class that:

- **Loads translation files** from `static/i18n/[language].json`
- **Detects browser language** automatically
- **Manages language switching** with persistent storage (localStorage)
- **Handles placeholders** in translation strings
- **Provides fallback** to English for missing keys
- **Dispatches events** when language changes

### Using Translations in HTML

Use the `data-i18n` attribute on HTML elements:

```html
<h2 data-i18n="astro_weather.section_title">🌡️ Current Conditions</h2>
<p data-i18n="common.loading">Loading...</p>
```

Then activate with JavaScript after page load:

```javascript
window.addEventListener('load', () => {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = i18n.t(key);
    });
});
```

### Using Translations in JavaScript

```javascript
// Simple translation
const msg = i18n.t('common.loading');

// Translation with parameters
const alert = i18n.t('weather_alerts.critical_dew_risk', { time: '14:30' });

// Check language
const lang = i18n.getCurrentLanguage();  // Returns 'en' or 'fr'

// Switch language
await i18n.setLanguage('fr');
```

### Language Switching Pattern

```javascript
// User clicks language selector
async function switchLanguage(lang) {
    await i18n.setLanguage(lang);
    // i18nLanguageChanged event is dispatched
}

// Components listen for language changes
window.addEventListener('i18nLanguageChanged', (e) => {
    const newLang = e.detail.language;
    // Example pdate dynamic content
    refreshWeatherDisplay();
});
```

### Language Selector Component

**Location**: Footer of the application (next to theme selector)

The language selector provides users with a manual way to switch between supported languages. It's implemented as a dropdown select in the footer.

**Files Involved**:
- `templates/index.html` - HTML interface with `<select id="language-select-footer">`
- `static/js/language-selector.js` - JavaScript controller (LanguageSelector class)
- `static/css/bs_main.css` - Styling for the selector

**Features**:
- ✅ Dropdown selector with English and French options
- ✅ Automatically displays current language
- ✅ Updates URL and localStorage on selection
- ✅ Triggers i18nLanguageChanged event for UI updates
- ✅ Responsive design (works on mobile)
- ✅ Matches theme selector styling

**How It Works**:

```html
<!-- HTML structure in footer -->
<div class="footer-language">
    <label class="language-label" for="language-select-footer" data-i18n="common.language">Language</label>
    <select id="language-select-footer" class="form-select form-select-sm language-select">
        <option value="en">English</option>
        <option value="fr">Français</option>
    </select>
</div>
```

**JavaScript Behavior**:

```javascript
// LanguageSelector class (language-selector.js)
class LanguageSelector {
    // 1. Detects current language from i18n manager
    // 2. Sets selector to current language value
    // 3. Listens for user selection changes
    // 4. Calls i18n.setLanguage() to switch language
    // 5. Updates all data-i18n elements on page
    // 6. Listens for i18nLanguageChanged events
}

// Usage - happens automatically on page load:
window.languageSelector = new LanguageSelector();
```

**User Experience**:

1. User opens the application (language auto-detected from browser settings)
2. User clicks the language dropdown in the footer
3. User selects new language (e.g., "Français")
4. All page content is refreshed to French
5. Selection is saved in localStorage and persists across sessions

## Backend Implementation


### i18n_utils.py - Backend Support

The `backend/i18n_utils.py` module provides:

- **Translation loading** from JSON files
- **Key lookup** with dot notation support
- **Placeholder replacement** for parameterized messages
- **Language management** per request
- **Alert creation** with translated messages

### Using Translations in Python

```python
from i18n_utils import I18nManager, get_translated_message

# Simple usage
msg = get_translated_message('common.loading', language='fr')

# Manager for multiple operations
manager = I18nManager('en')
title = manager.t('astro_weather.section_title')
caption = manager.t('weather_alerts.critical_dew_risk', time='14:30')
```

### Translating API Responses

```python
from i18n_utils import create_translated_alert, I18nManager

@app.route('/api/weather/alerts', methods=['GET'])
def get_weather_alerts():
    language = request.args.get('lang', 'en')
    
    # Create alert with translated message
    alert = create_translated_alert(
        alert_type='DEW_WARNING',
        severity='HIGH',
        time='2026-03-03T14:30:00',
        language=language
    )
    
    return jsonify({'alerts': [alert]})
```

## Translation Keys Structure

Keys use dot notation for organization:

```
namespace.section.key
   ↓       ↓      ↓
   |       |      └─ Specific translation
   |       └────────── Logical grouping
   └────────────────── Feature/Component
```

### Example Key Organization

```json
{
  "common": {
    "loading": "Loading...",
    "error": "Error"
  },
  
  "astro_weather": {
    "section_title": "🌡️ Current Conditions",
    "loading_message": "☁️ Loading...",
    "alerts_title": "⚠️ Weather Alerts",
    "no_data": "No data available"
  },
  
  "weather_alerts": {
    "alert_dew_warning": "Critical dew risk",
    "alert_wind_warning": "Critical wind conditions",
    "critical_dew_risk": "Critical dew risk starting at {time}",
    "starting_at": "Starting at"
  }
}
```

## Current Coverage

### HTML Templates ✅

**`templates/index.html`** - Astro-Weather tab + Language Selector (Proof of Concept)
- Section titles and headings
- Loading states
- Horizon graph labels
- Best observation periods
- Weather alerts section
- Advanced analysis section
- Language selector dropdown in footer

### JavaScript Files ✅ (Language Selector Complete)

**`static/js/language-selector.js`** - Language selector UI controller
- Dropdown selection handler
- Current language detection
- Page content translation on language change
- UI update coordination with i18n manager
- Auto-initialization on page load

### JavaScript Files 🔄 (Ready for implementation)

**`static/js/weather_astro.js`** - Astrophotography weather analysis
- Chart titles and labels
- Condition descriptions
- Error messages

**`static/js/weather_alerts.js`** - Weather alert system
- Alert type messages
- Severity labels
- Timestamp formatting

### CSS Files ✅

**`static/css/bs_main.css`** - Language selector styling
- `.footer-language` - Language selector container
- `.language-select` - Select element styling
- Responsive layout for mobile

### Backend Files 🔄 (Ready for implementation)

**`backend/weather_astro.py`** - Weather analysis engine
- Alert messages (DEW_WARNING, WIND_WARNING, etc.)
- Analysis descriptions
- Condition labels

## Implementation Guide

### Step 1: Add Translation Keys

Add keys to `static/i18n/en.json` and `static/i18n/fr.json`:

```json
{
  "my_component": {
    "title": "My Component Title",
    "description": "Component description"
  }
}
```

### Step 2: Use in HTML

```html
<h3 data-i18n="my_component.title">My Component Title</h3>
```

### Step 3: Activate with JavaScript

```javascript
// Auto-translate on page load
document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = i18n.t(el.getAttribute('data-i18n'));
});

// Or for dynamic content
statusDiv.textContent = i18n.t('my_component.description');
```

### Step 4: Handle Language Changes

```javascript
window.addEventListener('i18nLanguageChanged', () => {
    // Re-render components with new language
    refreshComponent();
});
```

## File Locations & File Structure

```
myastroboard/
├── templates/
│   └── index.html                   # ✅ Proof of concept: astro-weather tab + language selector
├── static/
│   ├── i18n/
│   │   ├── en.json                  # ✅ English translations
│   │   └── fr.json                  # ✅ French translations
│   ├── css/
│   │   └── bs_main.css              # ✅ Language selector styling
│   └── js/
│       ├── i18n.js                  # ✅ i18n manager
│       ├── language-selector.js     # ✅ Language selector UI controller
│       ├── weather_astro.js         # 🔄 Ready for implementation
│       └── weather_alerts.js        # 🔄 Ready for implementation
└── backend/
    └── i18n_utils.py                # ✅ Backend utilities
```

## Testing the System

### Manual Testing Checklist

- [ ] **Browser language detection** - Fresh browser in French locale shows French UI
- [ ] **Language switching** - Click language selector dropdown and UI updates
- [ ] **Selector updates** - Dropdown reflects current language after switching
- [ ] **LocalStorage persistence** - Refresh page, selected language persists
- [ ] **Fallback mechanism** - Missing keys show fallback English
- [ ] **Placeholder replacement** - Alert with `{time}` parameter displays correctly
- [ ] **API responses** - Backend returns translated alert messages
- [ ] **HTML attributes** - `data-i18n` attributes translate on page load
- [ ] **Dynamic content** - JavaScript-generated content uses `i18n.t()`

### Test with Different Languages

```javascript
// Test French
await i18n.setLanguage('fr');
console.log(i18n.t('common.loading'));  // Should show "Chargement..."

// Test English
await i18n.setLanguage('en');
console.log(i18n.t('common.loading'));  // Should show "Loading..."
```

### Translation Completeness Checker

Use the helper script to compare all translation files in `static/i18n` against `en.json`.

**Script location**: `scripts/translate_checker.py`

**Run command**:

```bash
py scripts/translate_checker.py
```

The script prints a clear console report with:

- **Global completion percentage by language** compared to `en.json`
- **Missing keys by file** (full key paths)
- **Missing keys count by language**

Example of expected output sections:

- `TRANSLATION COMPLETENESS SUMMARY`
- `MISSING KEYS BY FILE`
- `MISSING KEYS COUNT BY LANGUAGE`

## Common Patterns

### Pattern 1: Static HTML Content

```html
<!-- Set in HTML -->
<h2 data-i18n="namespace.key">Default English Text</h2>

<!-- Translate on load -->
<script>
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = i18n.t(key);
    });
</script>
```

### Pattern 2: Dynamic JavaScript Content

```javascript
function renderAlert(data) {
    const element = document.createElement('div');
    
    // Use i18n for text
    element.textContent = i18n.t('weather_alerts.alert_types.' + data.type);
    
    return element;
}
```

### Pattern 3: Parameterized Messages

```javascript
// In translation file
"weather_alerts": {
    "dew_warning": "Critical dew risk starting at {time}"
}

// In code
const msg = i18n.t('weather_alerts.dew_warning', { time: '14:30' });
// Result: "Critical dew risk starting at 14:30"
```

### Pattern 4: Language-Specific Formatting

```python
from i18n_utils import I18nManager

manager = I18nManager('fr')

# Get different formats for different languages
time_format = manager.t('common.time_format')  # Could return "HH:mm" or different
```

## Best Practices

### DO ✅

- ✅ Use `i18n.t()` for all user-visible text
- ✅ Organize keys by component/feature
- ✅ Use descriptive, context-aware key names
- ✅ Provide fallback English translations
- ✅ Test with multiple languages
- ✅ Uses placeholders for dynamic values: `{variable}`
- ✅ Keep emoji outside translation keys (add in HTML/template)
- ✅ Document key purposes in code comments
- ✅ Verify translation accuracy for scientific terms

### DON'T ❌

- ❌ Hardcode user-visible strings in JavaScript/HTML
- ❌ Use string interpolation without translation keys
- ❌ Create inconsistent naming for similar concepts
- ❌ Mix translated and hardcoded content
- ❌ Use HTML entities in translation values
- ❌ Forget to test with actual language changes
- ❌ Store user language preference only in memory (use localStorage)

## Performance Considerations

- **Translation files cached** - JSON loaded once per language
- **Minimal overhead** - Simple object lookups for t() calls
- **No lazy loading needed** - Small file sizes (en.json < 5KB)
- **Event-driven updates** - Only UI needing language change updates

## Future Enhancements

These are planned for future phases:

1. **Translation Management UI** - Allow admins to manage translations
2. **Additional Languages** - German, Spanish, Italian, etc.
3. **Pluralization Support** - Handle singular/plural forms
4. **Date/Time Localization** - Format dates per language
5. **RTL Language Support** - Arabic, Hebrew support
6. **Translation Export** - Generate translation files for external translators
7. **Missing Key Detection** - Automatic detection of untranslated content
8. **Namespace-specific Loading** - Lazy load only needed translations

## Architecture Decisions

### Why JSON Files?

- Simple, human-readable format
- Easy to version control
- No database dependency
- Works in Docker easily
- Lightweight

### Why localStorage for Language?

- Persistent user preference
- Works offline
- No server round-trip needed
- Survives page refreshes

### Why Dot Notation Keys?

- Organized, hierarchical structure
- Namespace collision prevention
- Descriptive, self-documenting
- Easy to find related translations

## Migration Path

For existing hardcoded strings:

1. Identify all user-facing text
2. Create keys in translation files
3. Replace hardcoded strings with `i18n.t()` calls
4. Test with multiple languages
5. Remove hardcoded fallback text

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Translations show key instead of text | Check if key exists in JSON file, verify path is case-sensitive |
| Language doesn't change | Ensure `i18nLanguageChanged` event listener is attached, check localStorage |
| Missing translations in API response | Verify `i18n_utils.py` imports correctly, check translation file path |
| Slow translation loading | Translations are cached; check network for first load |

## Resources

- [i18n.js](../static/js/i18n.js) - Frontend manager
- [i18n_utils.py](../backend/i18n_utils.py) - Backend utilities
- [English Translations](../static/i18n/en.json)
- [French Translations](../static/i18n/fr.json)
- [Copilot Instructions](../copilot-instructions.md) - Full i18n guidelines

## Contributing Translations

To contribute new translations or improve existing ones:

1. Fork the repository
2. Edit translation file: `static/i18n/[language].json`
3. Maintain key structure and placeholder format
4. Test with UI in actual browser
5. Submit pull request

Translations must be:
- **Accurate** - Especially for scientific astronomy terms
- **Consistent** - Use same terminology throughout
- **Complete** - All keys translated, no missing entries
- **Tested** - Verified in actual UI

---

**Last Updated**: March 3, 2026  
**Proof of Concept**: ✅ Complete (Astro-Weather tab, Weather Alerts, Language Selector)  
**Next Phase**: Full implementation across all components and additional languages
