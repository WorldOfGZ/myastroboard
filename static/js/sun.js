// ======================
// Sun 
// ======================

//Load Sun data for today
async function loadSun() {
    const container = document.getElementById('sun-display');
    const data = await fetchJSONWithUI('/api/sun/today', container, 'Loading Sun data...', {
        pendingMessage: 'Cache not ready. Retrying...'
    });
    if (!data) return;

    try {
        // Empty container
        clearContainer(container);

        // Display sun information
        const header = document.createElement('div');
        header.className = 'd-flex flex-row align-items-center mb-3';

        const icon = document.createElement('div');
        icon.className = 'p-2 icon-weather-lg';
        icon.textContent = '☀️';
        const titleWrap = document.createElement('div');
        titleWrap.className = 'p-2';
        const title = document.createElement('div');
        title.className = 'fw-bold fs-4';
        title.textContent = 'Sun & Twilight Times';
        const subtitle = document.createElement('div');
        subtitle.textContent = 'For astronomical observation planning';
        titleWrap.appendChild(title);
        titleWrap.appendChild(subtitle);
        header.appendChild(icon);
        header.appendChild(titleWrap);

        const cardsRow = document.createElement('div');
        cardsRow.className = 'row row-cols-1 row-cols-sm-2 row-cols-lg-2 row-cols-xl-4 p-2 mb-3';

        const createTimeCard = (cardTitle, duskLabel, duskValue, dawnLabel, dawnValue) => {
            const col = document.createElement('div');
            col.className = 'col mb-3';
            const card = document.createElement('div');
            card.className = 'card h-100';
            const cardHeader = document.createElement('div');
            cardHeader.className = 'card-header fw-bold';
            cardHeader.textContent = cardTitle;

            const list = document.createElement('ul');
            list.className = 'list-group list-group-flush';

            const createItem = (label, value) => {
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';
                const labelSpan = document.createElement('span');
                labelSpan.textContent = label;
                const valueSpan = document.createElement('span');
                valueSpan.className = 'fw-bold';
                valueSpan.textContent = value;
                li.appendChild(labelSpan);
                li.appendChild(valueSpan);
                return li;
            };

            list.appendChild(createItem(duskLabel, duskValue));
            list.appendChild(createItem(dawnLabel, dawnValue));
            card.appendChild(cardHeader);
            card.appendChild(list);
            col.appendChild(card);
            return col;
        };

        cardsRow.appendChild(createTimeCard(
            '☀️ Sun',
            '🌇 Set:',
            formatTimeThenDate(new Date(data.sun.sunset)),
            '🌅 Rise:',
            formatTimeThenDate(new Date(data.sun.sunrise))
        ));
        cardsRow.appendChild(createTimeCard(
            '🌆 Civil Twilight',
            'Dusk:',
            formatTimeThenDate(new Date(data.sun.civil_dusk)),
            'Dawn:',
            formatTimeThenDate(new Date(data.sun.civil_dawn))
        ));
        cardsRow.appendChild(createTimeCard(
            '⚓ Nautical Twilight',
            'Dusk:',
            formatTimeThenDate(new Date(data.sun.nautical_dusk)),
            'Dawn:',
            formatTimeThenDate(new Date(data.sun.nautical_dawn))
        ));
        cardsRow.appendChild(createTimeCard(
            '🌌 Astronomical Twilight',
            'Dusk:',
            formatTimeThenDate(new Date(data.sun.astronomical_dusk)),
            'Dawn:',
            formatTimeThenDate(new Date(data.sun.astronomical_dawn))
        ));

        container.appendChild(header);
        container.appendChild(cardsRow);
    } catch (error) {
        console.error('Error loading weather:', error);
        DOMUtils.clear(container);
        const errorBox = document.createElement('div');
        errorBox.className = 'error-box';
        errorBox.textContent = 'Failed to load Sun data';
        container.appendChild(errorBox);
    }
}