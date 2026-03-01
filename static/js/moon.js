// ======================
// Moon 
// ======================

//Load moon data
async function loadMoon() {
    const container = document.getElementById('moon-display');
    const data = await fetchJSONWithUI('/api/moon/report', container, 'Loading Moon data...');
    if (!data) return;

    // Display moon information if moon data is available
    if (data.moon) {
        const moon = data.moon;
        
        // Determine moon emoji based on illumination and phase
        const phaseEmojiMap = {
            "New Moon": "🌑",
            "Waxing Crescent": "🌒",
            "First Quarter": "🌓",
            "Waxing Gibbous": "🌔",
            "Full Moon": "🌕",
            "Waning Gibbous": "🌖",
            "Last Quarter": "🌗",
            "Waning Crescent": "🌘"
        };

        let moonEmoji = phaseEmojiMap[moon.phase_name] || '🌑';
        DOMUtils.clear(container);

        const header = document.createElement('div');
        header.className = 'd-flex flex-row align-items-center mb-3';
        const icon = document.createElement('div');
        icon.className = 'p-2 icon-weather-lg';
        icon.textContent = moonEmoji;
        const titleWrap = document.createElement('div');
        titleWrap.className = 'p-2';
        const phaseTitle = document.createElement('div');
        phaseTitle.className = 'fw-bold fs-4';
        phaseTitle.textContent = moon.phase_name;
        const illum = document.createElement('div');
        illum.textContent = `${moon.illumination_percent.toFixed(0)}% illuminated`;
        titleWrap.appendChild(phaseTitle);
        titleWrap.appendChild(illum);
        header.appendChild(icon);
        header.appendChild(titleWrap);

        const row = document.createElement('div');
        row.className = 'row row-cols-1 row-cols-sm-2 row-cols-lg-2 row-cols-xl-3 p-2 mb-3';

        const createCard = (titleText, lines) => {
            const col = document.createElement('div');
            col.className = 'col mb-3';
            const card = document.createElement('div');
            card.className = 'card h-100';
            const cardHeader = document.createElement('div');
            cardHeader.className = 'card-header fw-bold';
            cardHeader.textContent = titleText;
            const list = document.createElement('ul');
            list.className = 'list-group list-group-flush';
            lines.forEach(({ label, value }) => {
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';
                const left = document.createElement('span');
                left.textContent = label;
                const right = document.createElement('span');
                right.className = 'fw-bold';
                right.textContent = value;
                li.appendChild(left);
                li.appendChild(right);
                list.appendChild(li);
            });
            card.appendChild(cardHeader);
            card.appendChild(list);
            col.appendChild(card);
            return col;
        };

        row.appendChild(createCard('🌑 Moon', [
            { label: '🌅 Rise:', value: formatTimeThenDate(moon.next_moonrise) },
            { label: '🌇 Set:', value: formatTimeThenDate(moon.next_moonset) }
        ]));
        row.appendChild(createCard('📐 Position', [
            { label: '📏 Distance:', value: moon.distance_km ? `${Math.round(moon.distance_km).toLocaleString()} km` : 'N/A' },
            { label: '📐 Altitude:', value: moon.altitude_deg ? `${moon.altitude_deg.toFixed(2)}°` : 'N/A' },
            { label: '🧭 Azimuth:', value: moon.azimuth_deg ? `${moon.azimuth_deg.toFixed(2)}°` : 'N/A' }
        ]));
        row.appendChild(createCard('🌕 Next Events', [
            { label: '🌕 Next Full Moon:', value: formatTimeThenDate(moon.next_full_moon) },
            { label: '🌑 Next New Moon:', value: formatTimeThenDate(moon.next_new_moon) },
            { label: '🌌 Next Dark Night:', value: formatTimeThenDate(moon.next_dark_night_start) }
        ]));

        container.appendChild(header);
        container.appendChild(row);
    }
}

//Load next moon phases
async function loadNextMoonPhases() {
    const container = document.getElementById('moon-planner-display');
    const data = await fetchJSONWithUI('/api/moon/next-7-nights', container, 'Loading Moon planner data...', {
        pendingMessage: 'Cache not ready. Retrying...'
    });
    if (!data) return;

    try {
        // Check if container has weather-grid class, if not add it
        if (!container.classList.contains('weather-grid')) {
            container.classList.add('weather-grid');
        }

        clearContainer(container);

        // if forecast list is available
        if (data.next_7_nights && data.next_7_nights.length > 0) {
            // Class grid to container
            container.className = 'row row-cols-1 row-cols-sm-2 row-cols-lg-4 row-cols-xl-5 row-cols-xxl-6 mb-3';

            // We receive up to 12 hours of data, display all
            data.next_7_nights.forEach(moon => {
                const date = new Date(moon.date);
                const astrophoto_score = moon.astrophoto_score.toFixed(0);
                const dark_hours_illumination = moon.dark_hours.illumination.toFixed(2);
                const dark_hours_practical = moon.dark_hours.practical.toFixed(2);
                const dark_hours_strict = moon.dark_hours.strict.toFixed(2);
                const illumination_percent = moon.moon.illumination_percent.toFixed(0);
                const max_altitude = moon.moon.max_altitude;

                // Determine observation quality based on condition
                let quality = '';
                let qualityClass = '';
                if (astrophoto_score >= 90) {
                    quality = `Excellent - ${astrophoto_score}%`;
                    qualityClass = 'quality-excellent';
                } else if (astrophoto_score >= 70) {
                    quality = `Good - ${astrophoto_score}%`;
                    qualityClass = 'quality-good';
                } else if (astrophoto_score >= 50) {
                    quality = `Fair - ${astrophoto_score}%`;
                    qualityClass = 'quality-fair';
                } else if (astrophoto_score > 30) {
                    quality = `Poor - ${astrophoto_score}%`;
                    qualityClass = 'quality-poor';
                } else {
                    quality = `Bad - ${astrophoto_score}%`;
                    qualityClass = 'quality-bad';
                }

                const item = document.createElement('div');
                item.className = 'col mb-3';
                const card = document.createElement('div');
                card.className = 'card h-100';
                const cardHeader = document.createElement('div');
                cardHeader.className = `card-header quality-box ${qualityClass}`;
                const strong = document.createElement('strong');
                strong.textContent = quality;
                cardHeader.appendChild(strong);

                const cardBody = document.createElement('div');
                cardBody.className = 'card-body';
                const title = document.createElement('h5');
                title.className = 'card-title card-title-weather mb-2';
                title.textContent = formatDateFull(date);
                const list = document.createElement('ul');
                list.className = 'list-group list-group-flush';

                const addItem = (label, value = null) => {
                    const li = document.createElement('li');
                    li.className = 'list-group-item d-flex justify-content-between align-items-center';
                    li.append(label);
                    if (value !== null) {
                        const span = document.createElement('span');
                        span.textContent = value;
                        li.appendChild(span);
                    }
                    list.appendChild(li);
                };

                addItem('🌗 Illumination:', `${illumination_percent}%`);
                addItem('📐 Max Altitude:', `${max_altitude}°`);
                addItem('🌌 Dark-time:');
                addItem(' > Strict:', `${dark_hours_strict} h`);
                addItem(' > Practical:', `${dark_hours_practical} h`);
                addItem(' > Illumination:', `${dark_hours_illumination} h`);

                cardBody.appendChild(title);
                cardBody.appendChild(list);
                card.appendChild(cardHeader);
                card.appendChild(cardBody);
                item.appendChild(card);
                container.appendChild(item);
            });
        }

    } catch (error) {
        console.error('Error loading moon data:', error);
        DOMUtils.clear(container);
        const alert = document.createElement('div');
        alert.className = 'alert alert-danger';
        alert.textContent = 'Failed to load moon data';
        container.appendChild(alert);
    }
}

//Load best observing nights
async function loadBestDarkWindow() {
    const container = document.getElementById('window-display');
    const containerLoader = document.getElementById('window-loader-info-notice');
    containerLoader.textContent = 'Loading best dark window data...';
    containerLoader.style.display = 'block';

    const retryOptions = {
        maxAttempts: 6,
        baseDelayMs: 1000,
        maxDelayMs: 12000,
        timeoutMs: 15000,
        shouldRetryData: (payload) => payload && payload.status === 'pending',
        onRetry: ({ reason, attempt, maxAttempts, waitMs, data }) => {
            const seconds = Math.max(1, Math.round(waitMs / 1000));
            if (reason === 'data' && data && data.message) {
                containerLoader.textContent = `${data.message} Retrying in ${seconds}s (${attempt}/${maxAttempts})`;
                return;
            }
            containerLoader.textContent = `Retrying in ${seconds}s (${attempt}/${maxAttempts})`;
        }
    };

    try {
        // Fake error to catch error display
        //throw new Error('Test error');

        DOMUtils.clear(container);

        // Get dark window
        const data = await fetchJSONWithRetry('/api/moon/dark-window', {}, retryOptions);

        // Cache pending (retries exhausted)
        if (data.status && data.status === 'pending') {
            DOMUtils.clear(container);
            const infoNotice = document.createElement('div');
            infoNotice.className = 'info-notice';
            infoNotice.textContent = data.message || '';
            container.appendChild(infoNotice);
            containerLoader.style.display = 'none';
            return;
        }

        // Check if dark window data exists
        if (!data.next_dark_night || !data.next_dark_night.start || !data.next_dark_night.end) {
            DOMUtils.clear(container);
            const errorBox = document.createElement('div');
            errorBox.className = 'error-box';
            errorBox.textContent = 'No dark window data available';
            container.appendChild(errorBox);
            containerLoader.style.display = 'none';
            return;
        }

        const start = new Date(data.next_dark_night.start);
        const end   = new Date(data.next_dark_night.end);

        // Bloc normal
        const item = document.createElement("div");
        item.className = "col mb-3";
        const card = document.createElement('div');
        card.className = 'card h-100';
        const header = document.createElement('div');
        header.className = 'card-header';
        header.textContent = '🌌 Next Dark Window';
        const list = document.createElement('ul');
        list.className = 'list-group list-group-flush';
        const addTiming = (labelText, valueText) => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            const label = document.createElement('span');
            label.textContent = labelText;
            const value = document.createElement('span');
            value.textContent = valueText;
            li.appendChild(label);
            li.appendChild(value);
            list.appendChild(li);
        };
        addTiming('🌆 Start:', formatTimeThenDate(start));
        addTiming('🌅 End:', formatTimeThenDate(end));
        card.appendChild(header);
        card.appendChild(list);
        item.appendChild(card);
        container.appendChild(item);


        
        const modes = ["strict", "practical", "illumination"];

        const bestWindowsResponse = await fetchJSONWithRetry('/api/tonight/best-window?mode=all', {}, {
            ...retryOptions,
            onRetry: null
        });

        const bestWindowsByMode = bestWindowsResponse && bestWindowsResponse.modes
            ? bestWindowsResponse.modes
            : {};

        for (const mode of modes) {
            const modeData = bestWindowsByMode[mode];

            if (!modeData || modeData.status === 'pending' || modeData.error || !modeData.best_window || !modeData.best_window.start) {
                const errorItem = document.createElement("div");
                errorItem.className = "col mb-3";
                const message = modeData && modeData.status === 'pending'
                    ? modeData.message || 'Cache pending'
                    : 'No dark window';
                const errorCard = document.createElement('div');
                errorCard.className = 'card h-100';
                const errorHeader = document.createElement('div');
                errorHeader.className = 'card-header';
                errorHeader.textContent = mode.toUpperCase();
                const errorBody = document.createElement('div');
                errorBody.className = 'card-body';
                const errorText = document.createElement('div');
                errorText.className = 'card-text';
                errorText.textContent = message;
                errorBody.appendChild(errorText);
                errorCard.appendChild(errorHeader);
                errorCard.appendChild(errorBody);
                errorItem.appendChild(errorCard);
                container.appendChild(errorItem);
                continue;
            }

            let start_txt = "";
            let end_txt = "";

            if(modeData.best_window.start == 'Not found') {
                start_txt = 'Not found';
            } else {
                const start = new Date(modeData.best_window.start);
                start_txt = `${formatTimeThenDate(start)}`;
                
            }
            if(modeData.best_window.end == 'Not found') {
                end_txt = 'Not found';
            } else {
                const end = new Date(modeData.best_window.end);
                end_txt = `${formatTimeThenDate(end)}`;
                
            }

            // Bloc normal
            const item = document.createElement("div");
            item.className = "col mb-3";
            const modeCard = document.createElement('div');
            modeCard.className = 'card h-100';
            const modeHeader = document.createElement('div');
            modeHeader.className = 'card-header';
            modeHeader.textContent = mode.toUpperCase();
            const modeList = document.createElement('ul');
            modeList.className = 'list-group list-group-flush';
            const addModeItem = (labelText, valueText) => {
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';
                li.append(labelText);
                const span = document.createElement('span');
                span.textContent = valueText;
                li.appendChild(span);
                modeList.appendChild(li);
            };
            addModeItem('💯 Score:', String(modeData.best_window.score));
            addModeItem('🌚 Moon condition:', capitalizeWords(modeData.best_window.moon_condition));
            addModeItem('🌗 Start:', start_txt);
            addModeItem('🌗 End:', end_txt);
            modeCard.appendChild(modeHeader);
            modeCard.appendChild(modeList);
            item.appendChild(modeCard);

            container.appendChild(item);
        }

        
        containerLoader.style.display = 'none';



    } catch (error) {
        console.error('Error loading dark window data:', error);
        const containerError = document.getElementById('window-loader-info-notice');
        containerError.className = 'alert alert-danger';
        containerError.textContent = 'Failed to load dark window data';
    }
}