/* =====================================================
   Observation Log (v1.3) - static/js/observation_sessions.js

   The "Log" step of the Plan -> Observe -> Log -> Astrodex loop: a private,
   chronological record of what was actually captured on each night.

   Rendered entirely with explicit DOM APIs (no innerHTML, no
   DOMUtils.setTrustedHTML) per the project's XSS rules - this is a new file, so
   no legacy HTML-template exception applies.
   ===================================================== */

const OBSERVATION_LOG_API = '/api/observation-sessions';
const _OBS_CUSTOM_LOCATION_VALUE = '__other__';
const _OBS_NO_COMBINATION_VALUE = '';

// 7Timer's ASTRO scales, shared with the backend: seeing 1=best..8=worst,
// transparency 1=worst..8=best.
const _OBS_SKY_SCALE = [1, 2, 3, 4, 5, 6, 7, 8];

let observationLogData = {
    sessions: [],
    stats: {},
    canEdit: false,
};

let observationLogFilters = {
    search: '',
    locationId: '',
    combinationId: '',
    minRating: '',
    fromDate: '',
    toDate: '',
    sort: 'date',
    order: 'desc',
};

// Which session's detail view is open, or null while the list is showing.
let observationLogOpenSessionId = null;

// Reference data loaded alongside the session list (locations, equipment, plans).
let observationLogLocations = [];
let observationLogActiveLocationId = null;
let observationLogCombinations = [];
let observationLogPlans = [];

let _observationLocationMap = null;
let _observationCoordinatesDebounce = null;

// ============================================
// Small shared helpers
// ============================================

/** Bootstrap icon class for star `i` (1-5) of a 0-5, 0.5-step rating `value`.
 *
 * NOTE: intentionally duplicated from astrodex.js's `_starIconClass` /
 * `_buildRatingWidget` / `_buildStarRatingDisplay` trio so the two feature files stay
 * independently deployable. If you fix a rounding/threshold bug here, apply the same fix
 * in static/js/astrodex.js. */
function _obsStarIconClass(value, i) {
    if (value >= i) return 'bi bi-star-fill text-warning';
    if (value >= i - 0.5) return 'bi bi-star-half text-warning';
    return 'bi bi-star text-warning';
}

/** Read-only star display for an entry row. Returns a <span> node. */
function _obsBuildStarRatingDisplay(rating) {
    const wrap = document.createElement('span');
    const value = Number(rating) || 0;
    for (let i = 1; i <= 5; i++) {
        wrap.appendChild(DOMUtils.createIcon(_obsStarIconClass(value, i)));
    }
    const label = document.createElement('span');
    label.className = 'ms-1';
    label.textContent = value.toFixed(1);
    wrap.appendChild(label);
    return wrap;
}

/** Interactive 0-5 (half-star step) rating widget - see _obsStarIconClass's duplication note. */
function _obsBuildRatingWidget(prefix, currentRating) {
    const wrap = document.createElement('div');
    wrap.className = 'd-flex align-items-center gap-1';
    wrap.id = `${prefix}-rating-widget`;
    wrap.dataset.rating = currentRating != null ? String(currentRating) : '';

    const renderStars = () => {
        DOMUtils.clear(wrap);
        const value = parseFloat(wrap.dataset.rating) || 0;
        for (let i = 1; i <= 5; i++) {
            const starWrap = document.createElement('span');
            starWrap.className = 'd-inline-flex align-items-center justify-content-center observation-log-rating-star';
            starWrap.title = i18n.t('observation_log.rating');
            starWrap.appendChild(DOMUtils.createIcon(_obsStarIconClass(value, i)));
            starWrap.addEventListener('click', (event) => {
                const rect = starWrap.getBoundingClientRect();
                const clickedHalf = (event.clientX - rect.left) < (rect.width / 2);
                const newValue = clickedHalf ? i - 0.5 : i;
                wrap.dataset.rating = (value === newValue) ? '' : String(newValue);
                renderStars();
            });
            wrap.appendChild(starWrap);
        }
        const label = document.createElement('span');
        label.className = 'text-muted small ms-1';
        label.textContent = value > 0 ? value.toFixed(1) : i18n.t('observation_log.not_rated');
        wrap.appendChild(label);
    };

    renderStars();
    return wrap;
}

/** Read a widget built by _obsBuildRatingWidget(), or null when unrated. */
function _obsGetRatingWidgetValue(prefix) {
    const raw = document.getElementById(`${prefix}-rating-widget`)?.dataset.rating;
    return raw ? parseFloat(raw) : null;
}

/** Build a labelled Bootstrap column wrapping one form control. */
function _obsField(columnClass, labelText, control, controlId) {
    const col = document.createElement('div');
    col.className = columnClass;
    const label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = labelText;
    if (controlId) label.htmlFor = controlId;
    col.appendChild(label);
    col.appendChild(control);
    return col;
}

function _obsInput(id, type, value, extra = {}) {
    const input = document.createElement('input');
    input.type = type;
    input.className = 'form-control';
    input.id = id;
    input.value = value == null ? '' : String(value);
    Object.entries(extra).forEach(([key, val]) => input.setAttribute(key, val));
    return input;
}

function _obsSelect(id, options, selectedValue) {
    const select = document.createElement('select');
    select.className = 'form-select';
    select.id = id;
    options.forEach(({ value, label }) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        if (String(value) === String(selectedValue ?? '')) option.selected = true;
        select.appendChild(option);
    });
    return select;
}

function _obsSectionHeader(text) {
    const col = document.createElement('div');
    col.className = 'col-12';
    const heading = document.createElement('h6');
    heading.className = 'text-muted border-bottom pb-1 mb-0 mt-2';
    heading.textContent = text;
    col.appendChild(heading);
    return col;
}

function _obsNumberOrNull(elementId) {
    const raw = document.getElementById(elementId)?.value;
    if (raw === undefined || raw === null || String(raw).trim() === '') return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
}

function _obsTodayIso() {
    return new Date().toISOString().split('T')[0];
}

/** Format an entry's integration time as a compact "1h30" / "45 min" label. */
function _obsFormatIntegration(minutes) {
    const value = Number(minutes);
    if (!Number.isFinite(value) || value <= 0) return '';
    const hours = Math.floor(value / 60);
    const rest = Math.round(value % 60);
    return hours > 0 ? `${hours}h${String(rest).padStart(2, '0')}` : i18n.t('observation_log.minutes_short', { minutes: rest });
}

/** Best-effort name of a session's combination, falling back to its frozen snapshot. */
function _obsCombinationLabel(session) {
    const live = observationLogCombinations.find(combo => combo.id === session.combination_id);
    return live?.name || session.combination_name || '';
}

// ============================================
// Data loading
// ============================================

async function loadObservationSessions() {
    const container = document.getElementById('observation-log-display');
    if (!container) return;

    DOMUtils.setLoading(container, i18n.t('common.loading'));

    try {
        const role = typeof getUserRole === 'function' ? await getUserRole() : 'user';
        observationLogData.canEdit = role === 'user' || role === 'admin';

        const payload = await fetchJSON(OBSERVATION_LOG_API);
        observationLogData.sessions = payload.sessions || [];
        observationLogData.stats = payload.stats || {};

        await Promise.all([_obsLoadLocations(), _obsLoadCombinations(), _obsLoadPlans()]);

        renderObservationLogStats();
        if (observationLogOpenSessionId
            && observationLogData.sessions.some(session => session.id === observationLogOpenSessionId)) {
            renderObservationSessionDetail(observationLogOpenSessionId);
        } else {
            observationLogOpenSessionId = null;
            renderObservationSessionsList();
        }
    } catch (error) {
        console.error('Error loading observation sessions:', error);
        showMessage('error', i18n.t('observation_log.failed_to_load'));
        DOMUtils.clear(container);
    }
}

async function _obsLoadLocations() {
    if (typeof fetchMyLocations !== 'function') return;
    try {
        const data = await fetchMyLocations();
        observationLogLocations = data?.locations || [];
        observationLogActiveLocationId = data?.active_location_id ?? null;
    } catch (error) {
        console.warn('Observation Log: location presets unavailable', error);
        observationLogLocations = [];
    }
}

async function _obsLoadCombinations() {
    try {
        const response = await fetchJSON('/api/equipment/combinations');
        const own = response.data || [];
        const shared = (response.shared_from_others || []).map(combo => ({ ...combo, is_own: false }));
        observationLogCombinations = [...own, ...shared];
    } catch (error) {
        console.warn('Observation Log: equipment combinations unavailable', error);
        observationLogCombinations = [];
    }
}

/** Plans available to import from. Both 'current' and 'previous' count: a plan flips to
 * 'previous' the moment the night ends, which is exactly when logging happens. */
async function _obsLoadPlans() {
    try {
        const response = await fetchJSON('/api/plan-my-night/list');
        observationLogPlans = (response.plans || []).filter(
            plan => (plan.state === 'current' || plan.state === 'previous') && (plan.entries_count || 0) > 0
        );
    } catch (error) {
        console.warn('Observation Log: plan list unavailable', error);
        observationLogPlans = [];
    }
}

// ============================================
// Stats header
// ============================================

function renderObservationLogStats() {
    const container = document.getElementById('observation-log-stats');
    if (!container) return;
    DOMUtils.clear(container);

    const stats = observationLogData.stats || {};
    const cards = [
        { value: stats.total_sessions ?? 0, label: i18n.t('observation_log.stat_sessions') },
        { value: stats.total_entries ?? 0, label: i18n.t('observation_log.stat_targets') },
        {
            value: _obsFormatIntegration(stats.total_integration_minutes) || '0',
            label: i18n.t('observation_log.stat_integration'),
        },
        { value: stats.total_frame_count ?? 0, label: i18n.t('observation_log.stat_frames') },
    ];

    cards.forEach(({ value, label }) => {
        const col = document.createElement('div');
        col.className = 'col';
        const card = document.createElement('div');
        card.className = 'card h-100 text-center';
        const body = document.createElement('div');
        body.className = 'card-body';
        const valueEl = document.createElement('div');
        valueEl.className = 'observation-log-stat-value';
        valueEl.textContent = String(value);
        const labelEl = document.createElement('div');
        labelEl.className = 'text-muted small';
        labelEl.textContent = label;
        body.appendChild(valueEl);
        body.appendChild(labelEl);
        card.appendChild(body);
        col.appendChild(card);
        container.appendChild(col);
    });
}

// ============================================
// Session list view
// ============================================

/** Apply the client-side filter/sort state. Session counts are personal and modest, so
 * everything is filtered in the browser - no server-side paging needed. */
function _obsFilteredSessions() {
    const { search, locationId, combinationId, minRating, fromDate, toDate, sort, order } = observationLogFilters;
    const needle = search.trim().toLowerCase();

    const matches = observationLogData.sessions.filter(session => {
        if (locationId && session.location_id !== locationId) return false;
        if (combinationId && session.combination_id !== combinationId) return false;
        if (fromDate && String(session.date || '') < fromDate) return false;
        if (toDate && String(session.date || '') > toDate) return false;
        if (minRating && (_obsSessionAverageRating(session) ?? -1) < Number(minRating)) return false;
        if (!needle) return true;

        const haystack = [
            session.date,
            session.location_name,
            session.combination_name,
            session.notes,
            ...(session.entries || []).map(entry => entry.name),
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(needle);
    });

    const direction = order === 'asc' ? 1 : -1;
    return matches.sort((a, b) => {
        let result = 0;
        if (sort === 'entries') {
            result = (a.entries?.length || 0) - (b.entries?.length || 0);
        } else if (sort === 'integration') {
            result = _obsSessionIntegration(a) - _obsSessionIntegration(b);
        } else if (sort === 'rating') {
            result = (_obsSessionAverageRating(a) ?? -1) - (_obsSessionAverageRating(b) ?? -1);
        } else {
            result = String(a.date || '').localeCompare(String(b.date || ''));
        }
        return result * direction;
    });
}

function _obsSessionIntegration(session) {
    return (session.entries || []).reduce((total, entry) => total + (Number(entry.integration_minutes) || 0), 0);
}

function _obsSessionFrames(session) {
    return (session.entries || []).reduce((total, entry) => total + (Number(entry.frame_count) || 0), 0);
}

/** Mean of the *rated* entries only - unrated targets are excluded rather than counted as zero. */
function _obsSessionAverageRating(session) {
    const ratings = (session.entries || [])
        .map(entry => Number(entry.rating))
        .filter(value => Number.isFinite(value));
    if (!ratings.length) return null;
    return ratings.reduce((total, value) => total + value, 0) / ratings.length;
}

function renderObservationSessionsList() {
    const container = document.getElementById('observation-log-display');
    if (!container) return;

    observationLogOpenSessionId = null;
    DOMUtils.clear(container);
    container.appendChild(_obsBuildListToolbar());
    container.appendChild(_obsBuildFilterBar());

    // Results live in their own container so a filter change can refresh just the cards -
    // rebuilding the whole view on every keystroke would blow away the search input's focus
    // and caret position.
    const results = document.createElement('div');
    results.id = 'observation-log-results';
    container.appendChild(results);
    _obsRenderSessionGrid();
}

function _obsRenderSessionGrid() {
    const results = document.getElementById('observation-log-results');
    if (!results) return;
    DOMUtils.clear(results);

    const sessions = _obsFilteredSessions();
    if (!sessions.length) {
        const empty = document.createElement('div');
        empty.className = 'observation-log-empty';
        empty.textContent = observationLogData.sessions.length
            ? i18n.t('observation_log.no_match')
            : i18n.t('observation_log.empty');
        results.appendChild(empty);
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3 mt-1';
    sessions.forEach(session => grid.appendChild(_obsBuildSessionCard(session)));
    results.appendChild(grid);
}

function _obsBuildListToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'd-flex flex-wrap gap-2 align-items-center mb-2';

    const title = document.createElement('h3');
    title.className = 'h5 mb-0 me-auto';
    title.textContent = i18n.t('observation_log.my_sessions');
    toolbar.appendChild(title);

    if (!observationLogData.canEdit) return toolbar;

    const newButton = document.createElement('button');
    newButton.type = 'button';
    newButton.id = 'observation-log-new-session';
    newButton.className = 'btn btn-success btn-sm';
    DOMUtils.append(
        newButton,
        DOMUtils.createIcon('bi bi-plus-circle icon-inline'),
        i18n.t('observation_log.new_session')
    );
    newButton.addEventListener('click', () => showObservationSessionForm(null));
    toolbar.appendChild(newButton);

    // Only offered when there is actually something importable (a current or previous
    // plan that has targets) - otherwise the button is a dead end.
    if (observationLogPlans.length) {
        const importButton = document.createElement('button');
        importButton.type = 'button';
        importButton.id = 'observation-log-import-plan';
        importButton.className = 'btn btn-info btn-sm';
        DOMUtils.append(
            importButton,
            DOMUtils.createIcon('bi bi-box-arrow-in-down icon-inline'),
            i18n.t('observation_log.import_from_plan')
        );
        importButton.addEventListener('click', () => showObservationImportFromPlanModal());
        toolbar.appendChild(importButton);
    }

    return toolbar;
}

function _obsBuildFilterBar() {
    const row = document.createElement('div');
    row.className = 'row g-2 mb-2';

    const search = _obsInput('observation-log-search', 'search', observationLogFilters.search, {
        placeholder: i18n.t('observation_log.search_placeholder'),
    });
    search.addEventListener('input', () => {
        observationLogFilters.search = search.value;
        _obsRenderSessionGrid();
    });
    row.appendChild(_obsField('col-6 col-lg-3', i18n.t('observation_log.filter_search'), search, search.id));

    const fromDate = _obsInput('observation-log-from', 'date', observationLogFilters.fromDate);
    fromDate.addEventListener('change', () => {
        observationLogFilters.fromDate = fromDate.value;
        _obsRenderSessionGrid();
    });
    row.appendChild(_obsField('col-6 col-lg-2', i18n.t('observation_log.filter_from'), fromDate, fromDate.id));

    const toDate = _obsInput('observation-log-to', 'date', observationLogFilters.toDate);
    toDate.addEventListener('change', () => {
        observationLogFilters.toDate = toDate.value;
        _obsRenderSessionGrid();
    });
    row.appendChild(_obsField('col-6 col-lg-2', i18n.t('observation_log.filter_to'), toDate, toDate.id));

    const locationOptions = [{ value: '', label: i18n.t('observation_log.filter_all_locations') }];
    observationLogLocations.forEach(loc => locationOptions.push({ value: loc.id, label: loc.name || '?' }));
    const locationSelect = _obsSelect('observation-log-location-filter', locationOptions, observationLogFilters.locationId);
    locationSelect.addEventListener('change', () => {
        observationLogFilters.locationId = locationSelect.value;
        _obsRenderSessionGrid();
    });
    row.appendChild(_obsField('col-6 col-lg-2', i18n.t('observation_log.location'), locationSelect, locationSelect.id));

    const comboOptions = [{ value: '', label: i18n.t('observation_log.filter_all_combinations') }];
    observationLogCombinations.forEach(combo => comboOptions.push({ value: combo.id, label: combo.name || '?' }));
    const comboSelect = _obsSelect('observation-log-combination-filter', comboOptions, observationLogFilters.combinationId);
    comboSelect.addEventListener('change', () => {
        observationLogFilters.combinationId = comboSelect.value;
        _obsRenderSessionGrid();
    });
    row.appendChild(_obsField('col-6 col-lg-2', i18n.t('observation_log.equipment'), comboSelect, comboSelect.id));

    const ratingOptions = [{ value: '', label: i18n.t('observation_log.filter_any_rating') }];
    [1, 2, 3, 4, 5].forEach(value => ratingOptions.push({
        value: String(value),
        label: i18n.t('observation_log.filter_min_rating', { rating: value }),
    }));
    const ratingSelect = _obsSelect('observation-log-rating-filter', ratingOptions, observationLogFilters.minRating);
    ratingSelect.addEventListener('change', () => {
        observationLogFilters.minRating = ratingSelect.value;
        _obsRenderSessionGrid();
    });
    row.appendChild(_obsField('col-6 col-lg-2', i18n.t('observation_log.rating'), ratingSelect, ratingSelect.id));

    const sortGroup = document.createElement('div');
    sortGroup.className = 'input-group';
    const sortSelect = _obsSelect('observation-log-sort', [
        { value: 'date', label: i18n.t('observation_log.sort_by_date') },
        { value: 'entries', label: i18n.t('observation_log.sort_by_targets') },
        { value: 'integration', label: i18n.t('observation_log.sort_by_integration') },
        { value: 'rating', label: i18n.t('observation_log.sort_by_rating') },
    ], observationLogFilters.sort);
    sortSelect.addEventListener('change', () => {
        observationLogFilters.sort = sortSelect.value;
        _obsRenderSessionGrid();
    });
    const orderButton = document.createElement('button');
    orderButton.type = 'button';
    orderButton.className = 'btn btn-primary';
    orderButton.title = i18n.t('observation_log.toggle_sort_order');
    orderButton.appendChild(DOMUtils.createIcon(
        observationLogFilters.order === 'asc' ? 'bi bi-sort-down-alt' : 'bi bi-sort-up-alt'
    ));
    orderButton.addEventListener('click', () => {
        observationLogFilters.order = observationLogFilters.order === 'asc' ? 'desc' : 'asc';
        DOMUtils.clear(orderButton);
        orderButton.appendChild(DOMUtils.createIcon(
            observationLogFilters.order === 'asc' ? 'bi bi-sort-down-alt' : 'bi bi-sort-up-alt'
        ));
        _obsRenderSessionGrid();
    });
    sortGroup.appendChild(sortSelect);
    sortGroup.appendChild(orderButton);
    row.appendChild(_obsField('col-12 col-lg-3', i18n.t('observation_log.sort'), sortGroup, sortSelect.id));

    return row;
}

function _obsBuildSessionCard(session) {
    const col = document.createElement('div');
    col.className = 'col';

    const card = document.createElement('div');
    card.className = 'card h-100 observation-log-session-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    const open = () => renderObservationSessionDetail(session.id);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            open();
        }
    });

    const body = document.createElement('div');
    body.className = 'card-body';

    const header = document.createElement('div');
    header.className = 'd-flex justify-content-between align-items-start gap-2';
    const date = document.createElement('span');
    date.className = 'observation-log-session-date';
    date.textContent = session.date || '';
    header.appendChild(date);

    const entryCount = document.createElement('span');
    entryCount.className = 'badge bg-primary';
    entryCount.textContent = i18n.t('observation_log.target_count', { count: (session.entries || []).length });
    header.appendChild(entryCount);
    body.appendChild(header);

    const metaParts = [session.location_name, _obsCombinationLabel(session)].filter(Boolean);
    if (metaParts.length) {
        const meta = document.createElement('div');
        meta.className = 'observation-log-meta mt-1';
        meta.textContent = metaParts.join(' · ');
        body.appendChild(meta);
    }

    const summary = document.createElement('div');
    summary.className = 'observation-log-meta mt-2 d-flex flex-wrap gap-2 align-items-center';
    const integration = _obsFormatIntegration(_obsSessionIntegration(session));
    if (integration) {
        const badge = document.createElement('span');
        badge.className = 'badge bg-secondary';
        badge.textContent = i18n.t('observation_log.integration_badge', { value: integration });
        summary.appendChild(badge);
    }
    const frames = _obsSessionFrames(session);
    if (frames > 0) {
        const badge = document.createElement('span');
        badge.className = 'badge bg-secondary';
        badge.textContent = i18n.t('observation_log.frames_badge', { count: frames });
        summary.appendChild(badge);
    }
    const average = _obsSessionAverageRating(session);
    if (average != null) summary.appendChild(_obsBuildStarRatingDisplay(average));
    if (summary.childNodes.length) body.appendChild(summary);

    if (session.notes) {
        const notes = document.createElement('p');
        notes.className = 'observation-log-meta mt-2 mb-0';
        notes.textContent = session.notes;
        body.appendChild(notes);
    }

    card.appendChild(body);
    col.appendChild(card);
    return col;
}

// ============================================
// Session detail view
// ============================================

function renderObservationSessionDetail(sessionId) {
    const container = document.getElementById('observation-log-display');
    const session = observationLogData.sessions.find(item => item.id === sessionId);
    if (!container || !session) {
        renderObservationSessionsList();
        return;
    }

    observationLogOpenSessionId = sessionId;
    DOMUtils.clear(container);

    const toolbar = document.createElement('div');
    toolbar.className = 'd-flex flex-wrap gap-2 align-items-center mb-3';

    const backButton = document.createElement('button');
    backButton.type = 'button';
    backButton.id = 'observation-log-back';
    backButton.className = 'btn btn-dark btn-sm';
    DOMUtils.append(backButton, DOMUtils.createIcon('bi bi-arrow-left icon-inline'), i18n.t('observation_log.back_to_list'));
    backButton.addEventListener('click', () => renderObservationSessionsList());
    toolbar.appendChild(backButton);

    const heading = document.createElement('h3');
    heading.className = 'h5 mb-0 me-auto';
    heading.textContent = i18n.t('observation_log.session_of', { date: session.date || '' });
    toolbar.appendChild(heading);

    if (observationLogData.canEdit) {
        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'btn btn-primary btn-sm';
        DOMUtils.append(editButton, DOMUtils.createIcon('bi bi-pencil icon-inline'), i18n.t('observation_log.edit_session'));
        editButton.addEventListener('click', () => showObservationSessionForm(session));
        toolbar.appendChild(editButton);

        const addEntryButton = document.createElement('button');
        addEntryButton.type = 'button';
        addEntryButton.id = 'observation-log-add-target';
        addEntryButton.className = 'btn btn-success btn-sm';
        DOMUtils.append(addEntryButton, DOMUtils.createIcon('bi bi-plus-circle icon-inline'), i18n.t('observation_log.add_target'));
        addEntryButton.addEventListener('click', () => showObservationEntryForm(session.id, null));
        toolbar.appendChild(addEntryButton);

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'btn btn-danger btn-sm';
        DOMUtils.append(deleteButton, DOMUtils.createIcon('bi bi-trash icon-inline'), i18n.t('observation_log.delete_session'));
        deleteButton.addEventListener('click', () => deleteObservationSession(session.id));
        toolbar.appendChild(deleteButton);
    }

    container.appendChild(toolbar);
    container.appendChild(_obsBuildSessionSummaryCard(session));
    container.appendChild(_obsBuildEntriesList(session));
}

function _obsBuildSessionSummaryCard(session) {
    const card = document.createElement('div');
    card.className = 'card mb-3';
    const body = document.createElement('div');
    body.className = 'card-body';

    const grid = document.createElement('div');
    grid.className = 'row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-2';

    const seeingLabel = session.seeing != null
        ? i18n.t('observation_log.seeing_value', { value: session.seeing })
        : '';
    const transparencyLabel = session.transparency != null
        ? i18n.t('observation_log.transparency_value', { value: session.transparency })
        : '';

    const rows = [
        [i18n.t('observation_log.location'), session.location_name || i18n.t('observation_log.no_location')],
        [i18n.t('observation_log.equipment'), _obsCombinationLabel(session) || i18n.t('observation_log.no_equipment')],
        [i18n.t('observation_log.start_time'), session.start_time || '—'],
        [i18n.t('observation_log.end_time'), session.end_time || '—'],
        [i18n.t('observation_log.sqm'), session.sqm != null ? String(session.sqm) : '—'],
        [i18n.t('observation_log.seeing'), seeingLabel || '—'],
        [i18n.t('observation_log.transparency'), transparencyLabel || '—'],
        [i18n.t('observation_log.total_integration'), _obsFormatIntegration(_obsSessionIntegration(session)) || '—'],
    ];

    rows.forEach(([label, value]) => {
        const col = document.createElement('div');
        col.className = 'col';
        const labelEl = document.createElement('div');
        labelEl.className = 'text-muted small';
        labelEl.textContent = label;
        const valueEl = document.createElement('div');
        valueEl.className = 'observation-log-entry-name';
        valueEl.textContent = value;
        col.appendChild(labelEl);
        col.appendChild(valueEl);
        grid.appendChild(col);
    });

    body.appendChild(grid);

    if (session.notes) {
        const notes = document.createElement('p');
        notes.className = 'mt-3 mb-0';
        notes.textContent = session.notes;
        body.appendChild(notes);
    }

    card.appendChild(body);
    return card;
}

function _obsBuildEntriesList(session) {
    const wrap = document.createElement('div');
    const entries = session.entries || [];

    if (!entries.length) {
        const empty = document.createElement('div');
        empty.className = 'observation-log-empty';
        empty.textContent = i18n.t('observation_log.no_targets');
        wrap.appendChild(empty);
        return wrap;
    }

    entries.forEach(entry => wrap.appendChild(_obsBuildEntryRow(session, entry)));
    return wrap;
}

function _obsBuildEntryRow(session, entry) {
    const row = document.createElement('div');
    row.className = 'observation-log-entry-row p-2 mb-2';

    const header = document.createElement('div');
    header.className = 'd-flex flex-wrap justify-content-between align-items-center gap-2';

    const identity = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'observation-log-entry-name';
    name.textContent = entry.name || '';
    identity.appendChild(name);

    const subtitleParts = [entry.type, entry.constellation, entry.catalogue].filter(Boolean);
    if (subtitleParts.length) {
        const subtitle = document.createElement('div');
        subtitle.className = 'observation-log-meta';
        subtitle.textContent = subtitleParts.join(' · ');
        identity.appendChild(subtitle);
    }
    header.appendChild(identity);

    const numbers = document.createElement('div');
    numbers.className = 'd-flex flex-wrap align-items-center gap-2';
    if (entry.frame_count) {
        const badge = document.createElement('span');
        badge.className = 'badge bg-secondary';
        badge.textContent = i18n.t('observation_log.frames_badge', { count: entry.frame_count });
        numbers.appendChild(badge);
    }
    const integration = _obsFormatIntegration(entry.integration_minutes);
    if (integration) {
        const badge = document.createElement('span');
        badge.className = 'badge bg-secondary';
        badge.textContent = i18n.t('observation_log.integration_badge', { value: integration });
        numbers.appendChild(badge);
    }
    if (entry.rating != null) numbers.appendChild(_obsBuildStarRatingDisplay(entry.rating));
    header.appendChild(numbers);

    row.appendChild(header);

    if (entry.notes) {
        const notes = document.createElement('div');
        notes.className = 'observation-log-meta mt-1';
        notes.textContent = entry.notes;
        row.appendChild(notes);
    }

    row.appendChild(_obsBuildEntryActions(session, entry));
    return row;
}

function _obsBuildEntryActions(session, entry) {
    const actions = document.createElement('div');
    actions.className = 'd-flex flex-wrap align-items-center gap-2 mt-2';

    // Astrodex status is shown, never clicked into existence: the item link appears on
    // its own as soon as a frame count is logged (see the backend's auto-link).
    if (entry.astrodex_item_id) {
        const badge = document.createElement('span');
        badge.className = 'badge bg-success';
        DOMUtils.append(
            badge,
            DOMUtils.createIcon('bi bi-check-circle icon-inline'),
            entry.astrodex_picture_id
                ? i18n.t('observation_log.in_astrodex_with_photo')
                : i18n.t('observation_log.in_astrodex')
        );
        actions.appendChild(badge);
    }

    if (entry.alttime_file && typeof showAlttimePopup === 'function') {
        const chartButton = document.createElement('button');
        chartButton.type = 'button';
        chartButton.className = 'btn btn-info btn-sm';
        DOMUtils.append(
            chartButton,
            DOMUtils.createIcon('bi bi-graph-up-arrow icon-inline'),
            i18n.t('observation_log.view_altitude_chart')
        );
        chartButton.addEventListener('click', () => {
            const title = `${entry.name || ''} - ${i18n.t('skytonight.altitude_time_title')}`;
            showAlttimePopup(title, entry.alttime_file, session.location_id);
        });
        actions.appendChild(chartButton);
    }

    if (!observationLogData.canEdit) return actions;

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'btn btn-primary btn-sm';
    DOMUtils.append(editButton, DOMUtils.createIcon('bi bi-pencil icon-inline'), i18n.t('observation_log.edit_target'));
    editButton.addEventListener('click', () => showObservationEntryForm(session.id, entry));
    actions.appendChild(editButton);

    const attachButton = document.createElement('button');
    attachButton.type = 'button';
    attachButton.className = 'btn btn-outline-primary btn-sm';
    DOMUtils.append(
        attachButton,
        DOMUtils.createIcon('bi bi-image icon-inline'),
        i18n.t('observation_log.attach_picture')
    );
    attachButton.addEventListener('click', () => showObservationAttachPictureModal(session.id, entry.id));
    actions.appendChild(attachButton);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'btn btn-danger btn-sm';
    DOMUtils.append(deleteButton, DOMUtils.createIcon('bi bi-trash icon-inline'), i18n.t('observation_log.delete_target'));
    deleteButton.addEventListener('click', () => deleteObservationEntry(session.id, entry.id));
    actions.appendChild(deleteButton);

    return actions;
}

// ============================================
// Location picker (3-state preset / custom / none + minimap)
// ============================================

/** Location <select> + free-text fallback + minimap, mirroring astrodex.js's picture
 * location picker. `session` omitted -> new-session defaults (active location). */
function _obsBuildLocationFields(session) {
    const fragment = document.createDocumentFragment();

    const hasPreset = !!session?.location_id;
    const hasCustom = !!session && !hasPreset && !!session.location_name;
    const selected = session === null || session === undefined
        ? (observationLogActiveLocationId || '')
        : (hasPreset ? session.location_id : (hasCustom ? _OBS_CUSTOM_LOCATION_VALUE : ''));

    const options = [{ value: '', label: i18n.t('observation_log.no_location') }];
    observationLogLocations.forEach(loc => options.push({ value: loc.id, label: loc.name || '?' }));
    options.push({ value: _OBS_CUSTOM_LOCATION_VALUE, label: i18n.t('observation_log.other_location') });

    const select = _obsSelect('observation-session-location', options, selected);
    select.addEventListener('change', () => {
        _obsToggleCustomLocationFields();
        _obsPrefillSqmFromPreset();
        _obsUpdateLocationMap();
    });
    fragment.appendChild(_obsField('col-md-6', i18n.t('observation_log.location'), select, select.id));

    const nameInput = _obsInput('observation-session-location-name', 'text', hasCustom ? session.location_name : '', {
        placeholder: i18n.t('observation_log.custom_location_placeholder'),
    });
    nameInput.addEventListener('input', _obsOnCoordinatesChanged);
    const nameBlock = _obsField('col-md-6', i18n.t('observation_log.custom_location_name'), nameInput, nameInput.id);
    nameBlock.id = 'observation-session-location-name-block';

    const latInput = _obsInput(
        'observation-session-location-lat',
        'number',
        hasCustom && session.location_latitude != null ? session.location_latitude : '',
        { step: 'any', min: '-90', max: '90', placeholder: '48.85' }
    );
    latInput.addEventListener('input', _obsOnCoordinatesChanged);
    const latBlock = _obsField('col-md-3', i18n.t('observation_log.custom_location_lat'), latInput, latInput.id);
    latBlock.id = 'observation-session-location-lat-block';

    const lngInput = _obsInput(
        'observation-session-location-lng',
        'number',
        hasCustom && session.location_longitude != null ? session.location_longitude : '',
        { step: 'any', min: '-180', max: '180', placeholder: '2.35' }
    );
    lngInput.addEventListener('input', _obsOnCoordinatesChanged);
    const lngBlock = _obsField('col-md-3', i18n.t('observation_log.custom_location_lng'), lngInput, lngInput.id);
    lngBlock.id = 'observation-session-location-lng-block';

    [nameBlock, latBlock, lngBlock].forEach(block => {
        if (!hasCustom) block.style.display = 'none';
        fragment.appendChild(block);
    });

    const mapBlock = document.createElement('div');
    mapBlock.className = 'col-12';
    mapBlock.id = 'observation-session-location-map-block';
    mapBlock.style.display = 'none';
    const mapDiv = document.createElement('div');
    mapDiv.className = 'rounded observation-log-location-map';
    mapDiv.id = 'observation-session-location-map';
    mapBlock.appendChild(mapDiv);
    fragment.appendChild(mapBlock);

    return fragment;
}

function _obsToggleCustomLocationFields() {
    const isOther = document.getElementById('observation-session-location')?.value === _OBS_CUSTOM_LOCATION_VALUE;
    ['name', 'lat', 'lng'].forEach(part => {
        const block = document.getElementById(`observation-session-location-${part}-block`);
        if (block) block.style.display = isOther ? '' : 'none';
    });
}

function _obsOnCoordinatesChanged() {
    clearTimeout(_observationCoordinatesDebounce);
    _observationCoordinatesDebounce = setTimeout(() => _obsUpdateLocationMap(), 400);
}

function _obsEffectiveCoordinates() {
    const value = document.getElementById('observation-session-location')?.value || '';
    if (!value) return null;
    if (value === _OBS_CUSTOM_LOCATION_VALUE) {
        const lat = parseFloat(document.getElementById('observation-session-location-lat')?.value);
        const lng = parseFloat(document.getElementById('observation-session-location-lng')?.value);
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    }
    const preset = observationLogLocations.find(loc => loc.id === value);
    const lat = Number(preset?.latitude);
    const lng = Number(preset?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/** Only one session modal is ever open at a time, so a single shared map instance
 * (torn down and rebuilt on change) is simpler than updating one in place. */
async function _obsUpdateLocationMap() {
    const block = document.getElementById('observation-session-location-map-block');
    const container = document.getElementById('observation-session-location-map');
    if (!block || !container) return;

    const coords = _obsEffectiveCoordinates();
    if (!coords) {
        block.style.display = 'none';
        _obsDestroyLocationMap();
        return;
    }

    block.style.display = '';
    if (typeof _ensureLocationsLeafletLoaded === 'function') {
        try {
            await _ensureLocationsLeafletLoaded();
        } catch (error) {
            console.warn('Leaflet failed to load; session location map unavailable', error);
            block.style.display = 'none';
            return;
        }
    }
    if (!document.body.contains(container)) return; // modal closed while Leaflet was loading
    if (typeof L === 'undefined') return;

    _obsDestroyLocationMap();
    _observationLocationMap = L.map(container, { scrollWheelZoom: false, zoomControl: false })
        .setView([coords.lat, coords.lng], 9);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(_observationLocationMap);
    L.marker([coords.lat, coords.lng]).addTo(_observationLocationMap);
}

function _obsDestroyLocationMap() {
    if (!_observationLocationMap) return;
    try {
        _observationLocationMap.remove();
    } catch (error) {
        console.debug('Session location map already removed', error);
    }
    _observationLocationMap = null;
}

function _obsCollectLocationFields() {
    const value = document.getElementById('observation-session-location')?.value || '';
    if (value === _OBS_CUSTOM_LOCATION_VALUE) {
        return {
            location_id: null,
            location_name: document.getElementById('observation-session-location-name')?.value.trim() || '',
            location_latitude: _obsNumberOrNull('observation-session-location-lat'),
            location_longitude: _obsNumberOrNull('observation-session-location-lng'),
        };
    }
    return { location_id: value || null, location_name: null };
}

/** Pre-fill SQM from the newly selected preset's own configured value, but never
 * overwrite a number the user already typed - measured SQM varies night to night. */
function _obsPrefillSqmFromPreset() {
    const sqmInput = document.getElementById('observation-session-sqm');
    if (!sqmInput || sqmInput.value.trim() !== '') return;
    const presetId = document.getElementById('observation-session-location')?.value;
    const preset = observationLogLocations.find(loc => loc.id === presetId);
    if (preset?.sqm != null) sqmInput.value = String(preset.sqm);
}

/** Seeing/transparency prefill from the live 7Timer forecast - only meaningful when the
 * session is being logged for today, since forecasts don't cover past dates. */
async function _obsPrefillSkyConditionsIfToday() {
    const dateInput = document.getElementById('observation-session-date');
    if (!dateInput || dateInput.value !== _obsTodayIso()) return;

    const seeingSelect = document.getElementById('observation-session-seeing');
    const transparencySelect = document.getElementById('observation-session-transparency');
    if (!seeingSelect || !transparencySelect) return;
    if (seeingSelect.value !== '' && transparencySelect.value !== '') return;

    try {
        const forecast = await fetchJSON('/api/seeing-forecast');
        if (seeingSelect.value === '' && forecast?.now != null) {
            seeingSelect.value = String(forecast.now);
        }
        const currentSlot = (forecast?.forecast || [])[0];
        if (transparencySelect.value === '' && currentSlot?.transparency != null) {
            transparencySelect.value = String(currentSlot.transparency);
        }
    } catch (error) {
        console.debug('Seeing forecast unavailable for session prefill', error);
    }
}

// ============================================
// Session create/edit modal
// ============================================

function _obsBuildCombinationOptions(session) {
    const forceIncludeId = session?.combination_id || null;
    const options = [{ value: _OBS_NO_COMBINATION_VALUE, label: i18n.t('observation_log.no_equipment') }];
    observationLogCombinations
        .filter(combo => !combo.is_disabled || combo.id === forceIncludeId)
        .forEach(combo => {
            const label = combo.owner_username
                ? `${combo.name} ${i18n.t('equipment.shared_fov_suffix', { username: combo.owner_username })}`
                : combo.name;
            options.push({ value: combo.id, label });
        });
    return options;
}

function showObservationSessionForm(session) {
    closeModal();

    const form = document.createElement('form');
    form.className = 'form row g-3';
    form.id = 'observation-session-form';

    form.appendChild(_obsSectionHeader(i18n.t('observation_log.section_when_where')));

    const dateInput = _obsInput('observation-session-date', 'date', session?.date || _obsTodayIso(), { required: 'required' });
    dateInput.addEventListener('change', () => _obsPrefillSkyConditionsIfToday());
    form.appendChild(_obsField('col-md-4', `${i18n.t('observation_log.date')} *`, dateInput, dateInput.id));

    const startInput = _obsInput('observation-session-start', 'datetime-local', _obsToLocalInput(session?.start_time));
    form.appendChild(_obsField('col-md-4', i18n.t('observation_log.start_time'), startInput, startInput.id));

    const endInput = _obsInput('observation-session-end', 'datetime-local', _obsToLocalInput(session?.end_time));
    form.appendChild(_obsField('col-md-4', i18n.t('observation_log.end_time'), endInput, endInput.id));

    form.appendChild(_obsBuildLocationFields(session));

    form.appendChild(_obsSectionHeader(i18n.t('observation_log.section_equipment')));
    const comboSelect = _obsSelect(
        'observation-session-combination',
        _obsBuildCombinationOptions(session),
        session?.combination_id || ''
    );
    form.appendChild(_obsField('col-md-6', i18n.t('observation_log.equipment'), comboSelect, comboSelect.id));

    form.appendChild(_obsSectionHeader(i18n.t('observation_log.section_sky')));
    const sqmInput = _obsInput('observation-session-sqm', 'number', session?.sqm ?? '', {
        step: '0.01', min: '0', max: '30', placeholder: '21.2',
    });
    form.appendChild(_obsField('col-md-4', i18n.t('observation_log.sqm'), sqmInput, sqmInput.id));

    const seeingOptions = [{ value: '', label: i18n.t('observation_log.not_recorded') }];
    _OBS_SKY_SCALE.forEach(value => seeingOptions.push({
        value: String(value),
        label: i18n.t('observation_log.seeing_value', { value }),
    }));
    const seeingSelect = _obsSelect('observation-session-seeing', seeingOptions, session?.seeing ?? '');
    form.appendChild(_obsField('col-md-4', i18n.t('observation_log.seeing'), seeingSelect, seeingSelect.id));

    const transparencyOptions = [{ value: '', label: i18n.t('observation_log.not_recorded') }];
    _OBS_SKY_SCALE.forEach(value => transparencyOptions.push({
        value: String(value),
        label: i18n.t('observation_log.transparency_value', { value }),
    }));
    const transparencySelect = _obsSelect('observation-session-transparency', transparencyOptions, session?.transparency ?? '');
    form.appendChild(_obsField('col-md-4', i18n.t('observation_log.transparency'), transparencySelect, transparencySelect.id));

    const notes = document.createElement('textarea');
    notes.className = 'form-control';
    notes.id = 'observation-session-notes';
    notes.rows = 3;
    notes.value = session?.notes || '';
    form.appendChild(_obsField('col-12', i18n.t('observation_log.notes'), notes, notes.id));

    const actions = document.createElement('div');
    actions.className = 'col-12 text-end';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn btn-primary';
    submit.textContent = session ? i18n.t('observation_log.save_session') : i18n.t('observation_log.create_session');
    actions.appendChild(submit);
    form.appendChild(actions);

    createModal(
        session ? i18n.t('observation_log.edit_session') : i18n.t('observation_log.new_session'),
        form,
        'lg'
    );

    const modalElement = document.getElementById('modal_lg_close');
    new bootstrap.Modal(modalElement, { backdrop: 'static', focus: true, keyboard: true }).show();

    // Leaflet must measure a fully laid-out, visible container - initializing while the
    // modal is still mid fade-in gives it the wrong size and only the top-left tile renders.
    modalElement.addEventListener('shown.bs.modal', () => _obsUpdateLocationMap(), { once: true });
    modalElement.addEventListener('hidden.bs.modal', () => _obsDestroyLocationMap(), { once: true });

    if (!session) {
        _obsPrefillSqmFromPreset();
        _obsPrefillSkyConditionsIfToday();
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        await saveObservationSession(session?.id || null, submit);
    });
}

/** ISO timestamp -> the value format a datetime-local input expects (and back via _obsFromLocalInput). */
function _obsToLocalInput(isoValue) {
    if (!isoValue) return '';
    const parsed = new Date(isoValue);
    if (Number.isNaN(parsed.getTime())) return '';
    const pad = (value) => String(value).padStart(2, '0');
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`
        + `T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function _obsFromLocalInput(elementId) {
    const raw = document.getElementById(elementId)?.value;
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function saveObservationSession(sessionId, submitButton) {
    const payload = {
        date: document.getElementById('observation-session-date')?.value || '',
        start_time: _obsFromLocalInput('observation-session-start'),
        end_time: _obsFromLocalInput('observation-session-end'),
        combination_id: document.getElementById('observation-session-combination')?.value || null,
        sqm: _obsNumberOrNull('observation-session-sqm'),
        seeing: _obsNumberOrNull('observation-session-seeing'),
        transparency: _obsNumberOrNull('observation-session-transparency'),
        notes: document.getElementById('observation-session-notes')?.value || '',
        ..._obsCollectLocationFields(),
    };

    if (!payload.date) {
        showMessage('error', i18n.t('observation_log.date_required'));
        return;
    }

    const originalLabel = submitButton?.textContent;
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = i18n.t('common.loading');
    }

    try {
        const response = await fetchJSON(
            sessionId ? `${OBSERVATION_LOG_API}/${sessionId}` : OBSERVATION_LOG_API,
            {
                method: sessionId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }
        );
        observationLogOpenSessionId = sessionId || response?.data?.id || null;
        closeModal();
        await loadObservationSessions();
    } catch (error) {
        console.error('Error saving observation session:', error);
        showMessage('error', i18n.t('observation_log.failed_to_save_session'));
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalLabel;
        }
    }
}

async function deleteObservationSession(sessionId) {
    if (!confirm(i18n.t('observation_log.confirm_delete_session'))) return;
    try {
        await fetchJSON(`${OBSERVATION_LOG_API}/${sessionId}`, { method: 'DELETE' });
        observationLogOpenSessionId = null;
        await loadObservationSessions();
    } catch (error) {
        console.error('Error deleting observation session:', error);
        showMessage('error', i18n.t('observation_log.failed_to_delete_session'));
    }
}

// ============================================
// Entry create/edit modal
// ============================================

function showObservationEntryForm(sessionId, entry) {
    closeModal();

    const form = document.createElement('form');
    form.className = 'form row g-3';
    form.id = 'observation-entry-form';

    form.appendChild(_obsSectionHeader(i18n.t('observation_log.section_target')));

    const nameInput = _obsInput('observation-entry-name', 'text', entry?.name || '', {
        required: 'required',
        placeholder: i18n.t('observation_log.target_name_placeholder'),
        autocomplete: 'off',
    });
    // A frozen snapshot: identity fields are captured once, never re-resolved afterwards.
    if (entry) nameInput.readOnly = true;
    form.appendChild(_obsField('col-md-6', `${i18n.t('observation_log.target_name')} *`, nameInput, nameInput.id));

    const catalogueInput = _obsInput('observation-entry-catalogue', 'text', entry?.catalogue || '');
    if (entry) catalogueInput.readOnly = true;
    form.appendChild(_obsField('col-md-6', i18n.t('observation_log.catalogue'), catalogueInput, catalogueInput.id));

    const typeInput = _obsInput('observation-entry-type', 'text', entry?.type || '');
    if (entry) typeInput.readOnly = true;
    form.appendChild(_obsField('col-md-6', i18n.t('observation_log.object_type'), typeInput, typeInput.id));

    const constellationInput = _obsInput('observation-entry-constellation', 'text', entry?.constellation || '');
    if (entry) constellationInput.readOnly = true;
    form.appendChild(_obsField('col-md-6', i18n.t('observation_log.constellation'), constellationInput, constellationInput.id));

    if (!entry) {
        // Same catalogue-lookup autofill as Astrodex's add-item modal.
        const lookupCol = document.createElement('div');
        lookupCol.className = 'col-12';
        const lookupHint = document.createElement('div');
        lookupHint.className = 'form-text';
        lookupHint.id = 'observation-entry-lookup-hint';
        lookupHint.textContent = i18n.t('observation_log.lookup_hint');
        lookupCol.appendChild(lookupHint);
        form.appendChild(lookupCol);
        nameInput.addEventListener('change', () => _obsLookupTarget(nameInput.value));
    }

    form.appendChild(_obsSectionHeader(i18n.t('observation_log.section_capture')));

    const framesInput = _obsInput('observation-entry-frames', 'number', entry?.frame_count ?? '', { min: '0', step: '1' });
    framesInput.addEventListener('input', _obsRecomputeIntegration);
    form.appendChild(_obsField('col-md-4', i18n.t('observation_log.frame_count'), framesInput, framesInput.id));

    const subExposureInput = _obsInput('observation-entry-sub-exposure', 'number', entry?.sub_exposure_seconds ?? '', {
        min: '0', step: 'any', placeholder: '180',
    });
    subExposureInput.addEventListener('input', _obsRecomputeIntegration);
    form.appendChild(_obsField('col-md-4', i18n.t('observation_log.sub_exposure'), subExposureInput, subExposureInput.id));

    const integrationInput = _obsInput('observation-entry-integration', 'number', entry?.integration_minutes ?? '', {
        min: '0', step: 'any',
    });
    // Once typed by hand, the auto-computation stops overwriting it.
    integrationInput.addEventListener('input', () => { integrationInput.dataset.userEdited = 'true'; });
    form.appendChild(_obsField('col-md-4', i18n.t('observation_log.integration_minutes'), integrationInput, integrationInput.id));

    const ratingCol = document.createElement('div');
    ratingCol.className = 'col-12';
    const ratingLabel = document.createElement('label');
    ratingLabel.className = 'form-label d-block';
    ratingLabel.textContent = i18n.t('observation_log.rating');
    ratingCol.appendChild(ratingLabel);
    ratingCol.appendChild(_obsBuildRatingWidget('observation-entry', entry?.rating ?? null));
    form.appendChild(ratingCol);

    const notes = document.createElement('textarea');
    notes.className = 'form-control';
    notes.id = 'observation-entry-notes';
    notes.rows = 3;
    notes.value = entry?.notes || '';
    form.appendChild(_obsField('col-12', i18n.t('observation_log.notes'), notes, notes.id));

    const actions = document.createElement('div');
    actions.className = 'col-12 text-end';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn btn-primary';
    submit.textContent = entry ? i18n.t('observation_log.save_target') : i18n.t('observation_log.add_target');
    actions.appendChild(submit);
    form.appendChild(actions);

    createModal(
        entry ? i18n.t('observation_log.edit_target') : i18n.t('observation_log.add_target'),
        form,
        'lg'
    );
    new bootstrap.Modal('#modal_lg_close', { backdrop: 'static', focus: true, keyboard: true }).show();

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        await saveObservationEntry(sessionId, entry?.id || null, submit);
    });
}

/** Convenience only: frames x sub-exposure -> integration minutes. The server never
 * recomputes this, so an explicitly typed integration value is left alone. */
function _obsRecomputeIntegration() {
    const frames = _obsNumberOrNull('observation-entry-frames');
    const subExposure = _obsNumberOrNull('observation-entry-sub-exposure');
    const integrationInput = document.getElementById('observation-entry-integration');
    if (!integrationInput || !frames || !subExposure) return;
    if (integrationInput.dataset.userEdited === 'true') return;
    integrationInput.value = String(Math.round((frames * subExposure / 60) * 100) / 100);
}

async function _obsLookupTarget(name) {
    const hint = document.getElementById('observation-entry-lookup-hint');
    const query = (name || '').trim();
    if (!query) return;

    try {
        const result = await fetchJSON(`/api/astrodex/catalogue-lookup?name=${encodeURIComponent(query)}`);
        if (!result?.found) {
            if (hint) hint.textContent = i18n.t('observation_log.lookup_not_found');
            return;
        }
        const nameInput = document.getElementById('observation-entry-name');
        const typeInput = document.getElementById('observation-entry-type');
        const constellationInput = document.getElementById('observation-entry-constellation');
        const catalogueInput = document.getElementById('observation-entry-catalogue');
        if (nameInput && result.preferred_name) nameInput.value = result.preferred_name;
        if (typeInput && !typeInput.value) typeInput.value = result.object_type || '';
        if (constellationInput && !constellationInput.value) constellationInput.value = result.constellation || '';
        if (catalogueInput && !catalogueInput.value) {
            catalogueInput.value = Object.keys(result.catalogue_names || {})[0] || '';
        }
        if (hint) hint.textContent = i18n.t('observation_log.lookup_found');
    } catch (error) {
        console.debug('Catalogue lookup failed', error);
    }
}

async function saveObservationEntry(sessionId, entryId, submitButton) {
    const payload = {
        frame_count: _obsNumberOrNull('observation-entry-frames'),
        sub_exposure_seconds: _obsNumberOrNull('observation-entry-sub-exposure'),
        integration_minutes: _obsNumberOrNull('observation-entry-integration'),
        rating: _obsGetRatingWidgetValue('observation-entry'),
        notes: document.getElementById('observation-entry-notes')?.value || '',
    };

    if (!entryId) {
        payload.name = document.getElementById('observation-entry-name')?.value.trim() || '';
        payload.catalogue = document.getElementById('observation-entry-catalogue')?.value.trim() || '';
        payload.type = document.getElementById('observation-entry-type')?.value.trim() || '';
        payload.constellation = document.getElementById('observation-entry-constellation')?.value.trim() || '';
        if (!payload.name) {
            showMessage('error', i18n.t('observation_log.target_name_required'));
            return;
        }
    }

    const originalLabel = submitButton?.textContent;
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = i18n.t('common.loading');
    }

    try {
        const url = entryId
            ? `${OBSERVATION_LOG_API}/${sessionId}/entries/${entryId}`
            : `${OBSERVATION_LOG_API}/${sessionId}/entries`;
        await fetchJSON(url, {
            method: entryId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        observationLogOpenSessionId = sessionId;
        closeModal();
        await loadObservationSessions();
    } catch (error) {
        console.error('Error saving observation entry:', error);
        showMessage('error', i18n.t('observation_log.failed_to_save_target'));
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalLabel;
        }
    }
}

async function deleteObservationEntry(sessionId, entryId) {
    if (!confirm(i18n.t('observation_log.confirm_delete_target'))) return;
    try {
        await fetchJSON(`${OBSERVATION_LOG_API}/${sessionId}/entries/${entryId}`, { method: 'DELETE' });
        observationLogOpenSessionId = sessionId;
        await loadObservationSessions();
    } catch (error) {
        console.error('Error deleting observation entry:', error);
        showMessage('error', i18n.t('observation_log.failed_to_delete_target'));
    }
}

// ============================================
// Attach picture (manual half of the Astrodex linkage)
// ============================================

function showObservationAttachPictureModal(sessionId, entryId) {
    closeModal();

    const form = document.createElement('form');
    form.className = 'form row g-3';
    form.id = 'observation-attach-picture-form';

    const hint = document.createElement('div');
    hint.className = 'col-12 form-text';
    hint.textContent = i18n.t('observation_log.attach_picture_hint');
    form.appendChild(hint);

    const fileInput = _obsInput('observation-picture-file', 'file', '', { accept: 'image/*', required: 'required' });
    form.appendChild(_obsField('col-12', `${i18n.t('observation_log.image_file')} *`, fileInput, fileInput.id));

    const notes = document.createElement('textarea');
    notes.className = 'form-control';
    notes.id = 'observation-picture-notes';
    notes.rows = 2;
    form.appendChild(_obsField('col-12', i18n.t('observation_log.picture_notes'), notes, notes.id));

    const actions = document.createElement('div');
    actions.className = 'col-12 text-end';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn btn-primary';
    submit.textContent = i18n.t('observation_log.attach_picture');
    actions.appendChild(submit);
    form.appendChild(actions);

    createModal(i18n.t('observation_log.attach_picture'), form, 'lg');
    new bootstrap.Modal('#modal_lg_close', { backdrop: 'static', focus: true, keyboard: true }).show();

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        await attachObservationEntryPicture(sessionId, entryId, submit);
    });
}

async function attachObservationEntryPicture(sessionId, entryId, submitButton) {
    const file = document.getElementById('observation-picture-file')?.files?.[0];
    if (!file) {
        showMessage('error', i18n.t('observation_log.please_select_image'));
        return;
    }

    const originalLabel = submitButton?.textContent;
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = i18n.t('observation_log.uploading');
    }

    try {
        // Step 1: the existing, unchanged Astrodex upload route - no parallel upload
        // endpoint exists, and the file lands straight in Astrodex's own image directory.
        const formData = new FormData();
        formData.append('file', file);
        const uploadResponse = await fetchWithRetry('/api/astrodex/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include',
        }, { maxAttempts: 1, timeoutMs: 30000 });

        if (!uploadResponse.ok) throw new Error('Upload failed');
        const uploadResult = await uploadResponse.json();

        // Step 2: attach it to this entry's Astrodex item (created on the fly if needed).
        const notesValue = document.getElementById('observation-picture-notes')?.value || '';
        const body = { filename: uploadResult.filename };
        if (notesValue.trim()) body.notes = notesValue;

        await fetchJSON(`${OBSERVATION_LOG_API}/${sessionId}/entries/${entryId}/astrodex-picture`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        observationLogOpenSessionId = sessionId;
        closeModal();
        await loadObservationSessions();
    } catch (error) {
        console.error('Error attaching picture to observation entry:', error);
        showMessage('error', i18n.t('observation_log.failed_to_attach_picture'));
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalLabel;
        }
    }
}

// ============================================
// Import from Plan
// ============================================

/** Plan "combination scope" ids and a session's imported_from marker both use 'default'
 * for the no-equipment plan, so normalize before comparing. */
function _obsNormalizePlanScope(value) {
    return value || 'default';
}

function showObservationImportFromPlanModal() {
    closeModal();

    const form = document.createElement('form');
    form.className = 'form row g-3';
    form.id = 'observation-import-plan-form';

    const hint = document.createElement('div');
    hint.className = 'col-12 form-text';
    hint.textContent = i18n.t('observation_log.import_from_plan_hint');
    form.appendChild(hint);

    const options = observationLogPlans.map(plan => ({
        value: _obsNormalizePlanScope(plan.combination_id),
        label: i18n.t('observation_log.import_plan_option', {
            name: plan.combination_name || i18n.t('observation_log.no_equipment'),
            date: String(plan.night_start || '').slice(0, 10),
            count: plan.entries_count || 0,
        }),
    }));
    const planSelect = _obsSelect('observation-import-plan', options, options[0]?.value);
    form.appendChild(_obsField('col-12', i18n.t('observation_log.plan_to_import'), planSelect, planSelect.id));

    const actions = document.createElement('div');
    actions.className = 'col-12 text-end';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn btn-primary';
    submit.textContent = i18n.t('observation_log.import_from_plan');
    actions.appendChild(submit);
    form.appendChild(actions);

    createModal(i18n.t('observation_log.import_from_plan'), form, 'lg');
    new bootstrap.Modal('#modal_lg_close', { backdrop: 'static', focus: true, keyboard: true }).show();

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        closeModal();
        await importObservationSessionFromPlan(planSelect.value);
    });
}

/**
 * Import a Plan My Night plan into the Observation Log.
 *
 * Also called from plan_my_night.js's "Log this session" button. When exactly one
 * session created today already came from the same plan, offer to merge the new targets
 * into it instead of starting a second session for the same night.
 *
 * @param {string} planCombinationId - 'default' or an equipment combination id
 * @param {boolean} switchToTab - move to the Observation Log sub-tab afterwards
 */
async function importObservationSessionFromPlan(planCombinationId, switchToTab = false) {
    const scope = _obsNormalizePlanScope(planCombinationId);

    try {
        if (!observationLogData.sessions.length) {
            const payload = await fetchJSON(OBSERVATION_LOG_API);
            observationLogData.sessions = payload.sessions || [];
        }

        const today = _obsTodayIso();
        const candidates = observationLogData.sessions.filter(session =>
            _obsNormalizePlanScope(session.imported_from_plan_combination_id) === scope
            && String(session.created_at || '').slice(0, 10) === today
        );

        let sessionId = null;
        if (candidates.length === 1 && confirm(i18n.t('observation_log.confirm_merge_into_session', {
            date: candidates[0].date || '',
        }))) {
            sessionId = candidates[0].id;
        }

        const body = { combination_id: scope === 'default' ? null : scope };
        if (sessionId) body.session_id = sessionId;

        const response = await fetchJSON(`${OBSERVATION_LOG_API}/from-plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        observationLogOpenSessionId = response?.data?.id || sessionId;

        if (switchToTab && typeof switchSubTab === 'function') {
            switchSubTab('astrodex', 'observation-log');
        } else {
            await loadObservationSessions();
        }
    } catch (error) {
        console.error('Error importing plan into an observation session:', error);
        showMessage('error', i18n.t('observation_log.failed_to_import_plan'));
    }
}

// Re-render dynamic labels when the language changes (static data-i18n nodes are
// handled globally by i18n.js).
window.addEventListener('i18nLanguageChanged', () => {
    if (!document.getElementById('observation-log-subtab')?.classList.contains('active')) return;
    renderObservationLogStats();
    if (observationLogOpenSessionId) {
        renderObservationSessionDetail(observationLogOpenSessionId);
    } else {
        renderObservationSessionsList();
    }
});
