// Equipment Profiles functionality
// Telescope, Camera, Mount, Filter, Accessory, and Combination management

let equipmentData = {
    telescopes: [],
    cameras: [],
    mounts: [],
    filters: [],
    accessories: [],
    combinations: []
};

let equipmentFilters = {
    search: '',
    type: 'all'
};

// ============================================
// Initialize Equipment Module
// ============================================

async function initializeEquipment() {
    // Get role user
    const roleUser = await getUserRole();
    
    // If user is not admin, not user, we don't load equipment management features
    if (roleUser !== 'admin' && roleUser !== 'user') {
        //console.log('User does not have permission to access equipment management');
        return;
    }
    
    loadAllEquipment();
    setupEquipmentEventListeners();
}

function setupEquipmentEventListeners() {
    // Main equipment buttons
    document.addEventListener('click', (e) => {
        // Resolve the actual button even when clicking an inner icon element
        const btn = e.target.closest('button');
        if (!btn) return;

        // New equipment buttons
        if (btn.classList.contains('btn-new-telescope')) showTelescopeModal();
        if (btn.classList.contains('btn-new-camera')) showCameraModal();
        if (btn.classList.contains('btn-new-mount')) showMountModal();
        if (btn.classList.contains('btn-new-filter')) showFilterModal();
        if (btn.classList.contains('btn-new-accessory')) showAccessoryModal();
        if (btn.classList.contains('btn-new-combination')) showCombinationModal();

        // Edit buttons
        if (btn.classList.contains('btn-edit-telescope')) showTelescopeModal(btn.dataset.id);
        if (btn.classList.contains('btn-edit-camera')) showCameraModal(btn.dataset.id);
        if (btn.classList.contains('btn-edit-mount')) showMountModal(btn.dataset.id);
        if (btn.classList.contains('btn-edit-filter')) showFilterModal(btn.dataset.id);
        if (btn.classList.contains('btn-edit-accessory')) showAccessoryModal(btn.dataset.id);
        if (btn.classList.contains('btn-edit-combination')) showCombinationModal(btn.dataset.id);

        // Delete buttons
        if (btn.classList.contains('btn-delete-telescope')) deleteEquipment('telescopes', btn.dataset.id);
        if (btn.classList.contains('btn-delete-camera')) deleteEquipment('cameras', btn.dataset.id);
        if (btn.classList.contains('btn-delete-mount')) deleteEquipment('mounts', btn.dataset.id);
        if (btn.classList.contains('btn-delete-filter')) deleteEquipment('filters', btn.dataset.id);
        if (btn.classList.contains('btn-delete-accessory')) deleteEquipment('accessories', btn.dataset.id);
        if (btn.classList.contains('btn-delete-combination')) deleteEquipment('combinations', btn.dataset.id);
    });
}

// ============================================
// Load Equipment Data
// ============================================

async function loadAllEquipment() {
   
    try {
        const response = await fetchJSON('/api/equipment/summary');
        
        // Load each equipment type
        await loadEquipmentType('telescopes');
        await loadEquipmentType('cameras');
        await loadEquipmentType('mounts');
        await loadEquipmentType('filters');
        await loadEquipmentType('accessories');
        await loadEquipmentType('combinations');
        
        renderAllEquipmentTabs();
    } catch (error) {
        console.error('Error loading equipment:', error);
        showMessage('error', i18n.t('equipment.failed_to_load_equipment'));
    }
}

async function loadEquipmentType(type) {
    try {
        const response = await fetchJSON(`/api/equipment/${type}`);
        equipmentData[type] = response.data || [];
    } catch (error) {
        console.error(`Error loading ${type}:`, error);
        equipmentData[type] = [];
    }
}

// ============================================
// Render Equipment Tabs
// ============================================

function renderAllEquipmentTabs() {
    renderCombinationsTab();
    renderFOVCalculatorTab();
    renderTelescopesTab();
    renderCamerasTab();
    renderMountsTab();
    renderFiltersTab();
    renderAccessoriesTab();
}

function createEmptyStateCard(message) {
    const col = document.createElement('div');
    col.className = 'col mb-3';

    const card = document.createElement('div');
    card.className = 'card h-100';

    const body = document.createElement('div');
    body.className = 'card-body';

    const p = document.createElement('p');
    p.className = 'card-text';
    p.textContent = message;

    body.appendChild(p);
    card.appendChild(body);
    col.appendChild(card);
    return col;
}

function appendInfoLine(container, label, value) {
    if (value === null || value === undefined || value === '') {
        return;
    }
    const strong = document.createElement('strong');
    strong.textContent = `${label}:`;
    container.appendChild(strong);
    container.appendChild(document.createTextNode(` ${value}`));
    container.appendChild(document.createElement('br'));
}

function createCardFooter(editClass, deleteClass, id) {
    const footer = document.createElement('div');
    footer.className = 'card-footer text-center';

    const placeholder = document.createElement('span');
    placeholder.className = 'btn-icon-placeholder';

    const editButton = document.createElement('button');
    editButton.className = `btn btn-outline-secondary ${editClass}`;
    editButton.setAttribute('data-id', id);
    editButton.setAttribute('title', i18n.t('equipment.edit'));
    editButton.appendChild(DOMUtils.createIcon('bi bi-pencil-square'));

    const deleteButton = document.createElement('button');
    deleteButton.className = `btn btn-outline-danger ${deleteClass}`;
    deleteButton.setAttribute('data-id', id);
    deleteButton.setAttribute('title', i18n.t('equipment.delete'));
    deleteButton.appendChild(DOMUtils.createIcon('bi bi-trash'));

    footer.appendChild(placeholder);
    footer.appendChild(editButton);
    footer.appendChild(deleteButton);
    return footer;
}

// --- Combinations Tab (Position 1) ---

function renderCombinationsTab() {
    const container = document.getElementById('equipment-combinations-display');
    if (!container) return;
    
    DOMUtils.clear(container);
    
    if (equipmentData.combinations.length === 0) {
        container.appendChild(createEmptyStateCard(i18n.t('equipment.no_equipment_yet')));
        return;
    }

    equipmentData.combinations.forEach((combo) => {
        const telescope = combo.telescope_id ? equipmentData.telescopes.find(t => t.id === combo.telescope_id) : null;
        const camera = combo.camera_id ? equipmentData.cameras.find(c => c.id === combo.camera_id) : null;
        const mount = combo.mount_id ? equipmentData.mounts.find(m => m.id === combo.mount_id) : null;
        
        // Calculate payload
        const telescopeWeight = telescope?.weight_kg || 0;
        const cameraWeight = camera?.weight_kg || 0;
        const accessoriesWeight = combo.accessory_ids 
            ? equipmentData.accessories
                .filter(a => combo.accessory_ids.includes(a.id))
                .reduce((sum, a) => sum + (a.weight_kg || 0), 0)
            : 0;
        const totalWeight = telescopeWeight + cameraWeight + accessoriesWeight;
        const mountCapacity = mount?.payload_capacity_kg || 0;
        const mountRecommended = mount?.recommended_payload_kg || 0;
        const isOverCapacity = mount && totalWeight > mountCapacity;
        const isOverRecommended = mount && totalWeight > mountRecommended;
        
        let payloadAlert = '';
        if (isOverCapacity) {
            payloadAlert = i18n.t('equipment.overweight', { totalweight: totalWeight.toFixed(1), mountcapacity: mountCapacity });
        } else if (isOverRecommended) {
            payloadAlert = i18n.t('equipment.recommanded_max_payload', { totalweight: totalWeight.toFixed(1), mountrecommended: mountRecommended });
        } else if (mount) {
            payloadAlert = i18n.t('equipment.payload', { totalweight: totalWeight.toFixed(1), mountcapacity: mountCapacity });
        }

        const col = document.createElement('div');
        col.className = 'col mb-3';
        const card = document.createElement('div');
        card.className = 'card h-100';
        const body = document.createElement('div');
        body.className = 'card-body';

        const title = document.createElement('h5');
        title.className = 'card-title mb-1';
        title.textContent = combo.name;
        body.appendChild(title);

        const p = document.createElement('p');
        p.className = 'card-text';
        if (telescope) appendInfoLine(p, i18n.t('equipment.telescope'), `${telescope.name}${telescopeWeight > 0 ? ` (${telescopeWeight}${i18n.t('units.kg')})` : ''}`);
        if (camera) appendInfoLine(p, i18n.t('equipment.camera'), `${camera.name}${cameraWeight > 0 ? ` (${cameraWeight}${i18n.t('units.kg')})` : ''}`);
        if (mount) appendInfoLine(p, i18n.t('equipment.mount'), mount.name);
        if (combo.filter_ids && combo.filter_ids.length > 0) {
            const filterNames = equipmentData.filters.filter(f => combo.filter_ids.includes(f.id)).map(f => f.name).join(', ');
            appendInfoLine(p, i18n.t('equipment.filters'), filterNames);
        }
        if (combo.accessory_ids && combo.accessory_ids.length > 0) {
            const accessoryNames = equipmentData.accessories.filter(a => combo.accessory_ids.includes(a.id)).map(a => a.name).join(', ');
            appendInfoLine(p, i18n.t('equipment.accessories'), `${accessoryNames}${accessoriesWeight > 0 ? ` (${accessoriesWeight}${i18n.t('units.kg')})` : ''}`);
        }
        body.appendChild(p);

        if (payloadAlert) {
            const payloadInfo = document.createElement('div');
            payloadInfo.className = `alert alert-sm py-1 px-2 mt-2 fw-light ${isOverCapacity ? 'alert-danger' : isOverRecommended ? 'alert-info' : 'alert-success'}`;
            payloadInfo.textContent = payloadAlert;
            body.appendChild(payloadInfo);
        }

        card.appendChild(body);
        card.appendChild(createCardFooter('btn-edit-combination', 'btn-delete-combination', combo.id));
        col.appendChild(card);
        container.appendChild(col);
    });
}

// --- FOV Calculator Tab (Position 2) ---

function renderFOVCalculatorTab() {
    const container = document.getElementById('equipment-fov-display');
    if (!container) return;
    
    const telescopes = equipmentData.telescopes;
    const cameras = equipmentData.cameras;
    
    DOMUtils.clear(container);

    const card = document.createElement('div');
    card.className = 'card';
    const body = document.createElement('div');
    body.className = 'card-body';
    const title = document.createElement('h5');
    title.className = 'card-title';
    title.innerHTML = `<i class="bi bi-binoculars icon-inline" aria-hidden="true"></i>${i18n.t('equipment.fov_calculator')}`;
    body.appendChild(title);

    const row1 = document.createElement('div');
    row1.className = 'row mb-3';
    const tCol = document.createElement('div');
    tCol.className = 'col-md-6';
    const tLabel = document.createElement('label');
    tLabel.className = 'form-label';
    tLabel.setAttribute('for', 'fov-telescope-select');
    tLabel.textContent = i18n.t('equipment.telescope');
    const tSelect = document.createElement('select');
    tSelect.id = 'fov-telescope-select';
    tSelect.className = 'form-select';
    const tDefault = document.createElement('option');
    tDefault.value = '';
    tDefault.textContent = i18n.t('equipment.select_telescope');
    tSelect.appendChild(tDefault);
    telescopes.forEach((t) => {
        const option = document.createElement('option');
        option.value = t.id;
        option.textContent = `${t.name} (${t.effective_focal_length}${i18n.t('units.mm')} f/${t.effective_focal_ratio})`;
        tSelect.appendChild(option);
    });
    tCol.appendChild(tLabel);
    tCol.appendChild(tSelect);

    const cCol = document.createElement('div');
    cCol.className = 'col-md-6';
    const cLabel = document.createElement('label');
    cLabel.className = 'form-label';
    cLabel.setAttribute('for', 'fov-camera-select');
    cLabel.textContent = i18n.t('equipment.camera');
    const cSelect = document.createElement('select');
    cSelect.id = 'fov-camera-select';
    cSelect.className = 'form-select';
    const cDefault = document.createElement('option');
    cDefault.value = '';
    cDefault.textContent = i18n.t('equipment.select_camera');
    cSelect.appendChild(cDefault);
    cameras.forEach((c) => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = `${c.name} (${c.pixel_size_um}${i18n.t('units.um')})`;
        cSelect.appendChild(option);
    });
    cCol.appendChild(cLabel);
    cCol.appendChild(cSelect);

    row1.appendChild(tCol);
    row1.appendChild(cCol);

    const row2 = document.createElement('div');
    row2.className = 'row mb-3';
    const seeingCol = document.createElement('div');
    seeingCol.className = 'col-md-6';
    const seeingLabel = document.createElement('label');
    seeingLabel.className = 'form-label';
    seeingLabel.setAttribute('for', 'fov-seeing');
    seeingLabel.textContent = i18n.t('equipment.seeing_cdt');
    const seeingInput = document.createElement('input');
    seeingInput.type = 'number';
    seeingInput.id = 'fov-seeing';
    seeingInput.className = 'form-control';
    seeingInput.value = '2.0';
    seeingInput.min = '0.5';
    seeingInput.max = '5';
    seeingInput.step = '0.1';
    seeingCol.appendChild(seeingLabel);
    seeingCol.appendChild(seeingInput);

    const buttonCol = document.createElement('div');
    buttonCol.className = 'col-md-6 d-flex align-items-end';
    const button = document.createElement('button');
    button.className = 'btn btn-primary w-100 mt-2';
    button.textContent = i18n.t('equipment.calculate_fov');
    button.addEventListener('click', calculateFOVFromUI);
    buttonCol.appendChild(button);

    row2.appendChild(seeingCol);
    row2.appendChild(buttonCol);

    const results = document.createElement('div');
    results.id = 'fov-results';

    body.appendChild(row1);
    body.appendChild(row2);
    body.appendChild(results);
    card.appendChild(body);
    container.appendChild(card);
}

async function calculateFOVFromUI() {
    const telescopeId = document.getElementById('fov-telescope-select')?.value;
    const cameraId = document.getElementById('fov-camera-select')?.value;
    const seeing = parseFloat(document.getElementById('fov-seeing')?.value || 2.0);
    
    if (!telescopeId || !cameraId) {
        showMessage('warning', i18n.t('equipment.please_select_telescope_camera'));
        return;
    }

    const telescope = equipmentData.telescopes.find(t => t.id === telescopeId);
    const camera = equipmentData.cameras.find(c => c.id === cameraId);
    if (!telescope || !camera) {
        showMessage('warning', i18n.t('equipment.selected_equipment_not_found'));
        return;
    }
    
    try {
        const response = await fetchJSON('/api/equipment/fov-calculator', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telescope_focal_length_mm: telescope.effective_focal_length,
                camera_sensor_width_mm: camera.sensor_width_mm,
                camera_sensor_height_mm: camera.sensor_height_mm,
                camera_pixel_size_um: camera.pixel_size_um,
                seeing_arcsec: seeing
            })
        });
        
        const fov = response;
        const resultsDiv = document.getElementById('fov-results');

        DOMUtils.clear(resultsDiv);
        const alert = document.createElement('div');
        alert.className = 'alert alert-success';

        const h6 = document.createElement('h6');
        h6.textContent = i18n.t('equipment.fov_results');
        alert.appendChild(h6);

        const table = document.createElement('table');
        table.className = 'table table-sm table-borderless';

        const rows = [
            [i18n.t('equipment.horizontal_fov'), `${fov.horizontal_fov_deg.toFixed(3)}${i18n.t('units.degrees')}`],
            [i18n.t('equipment.vertical_fov'), `${fov.vertical_fov_deg.toFixed(3)}${i18n.t('units.degrees')}`],
            [i18n.t('equipment.diagonal_fov'), `${fov.diagonal_fov_deg.toFixed(3)}${i18n.t('units.degrees')}`],
            [i18n.t('equipment.image_scale'), `${fov.image_scale_arcsec_per_px.toFixed(4)} ${i18n.t('units.arcsec_per_pixel')}`]
        ];

        rows.forEach(([label, value]) => {
            const tr = document.createElement('tr');
            const td1 = document.createElement('td');
            const strong = document.createElement('strong');
            strong.textContent = `${label}`;
            td1.appendChild(strong);
            const td2 = document.createElement('td');
            td2.textContent = value;
            tr.appendChild(td1);
            tr.appendChild(td2);
            table.appendChild(tr);
        });

        const trSampling = document.createElement('tr');
        const tdSamplingLabel = document.createElement('td');
        const strongSampling = document.createElement('strong');
        strongSampling.textContent = i18n.t('equipment.sampling');
        tdSamplingLabel.appendChild(strongSampling);
        const tdSamplingValue = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = 'badge bg-info';
        badge.textContent = fov.sampling_classification;
        tdSamplingValue.appendChild(badge);
        trSampling.appendChild(tdSamplingLabel);
        trSampling.appendChild(tdSamplingValue);
        table.appendChild(trSampling);

        alert.appendChild(table);
        resultsDiv.appendChild(alert);
    } catch (error) {
        console.error('Error calculating FOV:', error);
        showMessage('error', i18n.t('equipment.failed_to_calculate_fov'));
    }
}

// --- Telescopes Tab (Position 3) ---

function renderTelescopesTab() {
    const container = document.getElementById('equipment-telescopes-display');
    if (!container) return;
    
    DOMUtils.clear(container);
    
    if (equipmentData.telescopes.length === 0) {
        container.appendChild(createEmptyStateCard(i18n.t('equipment.no_telescopes_created_yet')));
        return;
    }

    equipmentData.telescopes.forEach((scope) => {
        const col = document.createElement('div');
        col.className = 'col mb-3';
        const card = document.createElement('div');
        card.className = 'card h-100';
        const body = document.createElement('div');
        body.className = 'card-body';

        const title = document.createElement('h5');
        title.className = 'card-title mb-1';
        title.textContent = scope.name;
        body.appendChild(title);

        if (scope.manufacturer) {
            const subtitle = document.createElement('h6');
            subtitle.className = 'card-subtitle mb-2 text-body-secondary';
            subtitle.textContent = scope.manufacturer;
            body.appendChild(subtitle);
        }

        const p = document.createElement('p');
        p.className = 'card-text';
        appendInfoLine(p, i18n.t('equipment.type'), scope.telescope_type);
        appendInfoLine(p, i18n.t('equipment.aperture'), `${scope.aperture_mm}${i18n.t('units.mm')}`);
        appendInfoLine(p, i18n.t('equipment.native_f'), scope.native_focal_ratio);
        appendInfoLine(p, i18n.t('equipment.effective_f'), scope.effective_focal_ratio);
        if (scope.weight_kg > 0) appendInfoLine(p, i18n.t('equipment.weight'), `${scope.weight_kg}${i18n.t('units.kg')}`);
        body.appendChild(p);

        card.appendChild(body);
        card.appendChild(createCardFooter('btn-edit-telescope', 'btn-delete-telescope', scope.id));
        col.appendChild(card);
        container.appendChild(col);
    });
}

// --- Cameras Tab (Position 4) ---

function renderCamerasTab() {
    const container = document.getElementById('equipment-cameras-display');
    if (!container) return;
    
    DOMUtils.clear(container);
    
    if (equipmentData.cameras.length === 0) {
        container.appendChild(createEmptyStateCard(i18n.t('equipment.no_cameras_created_yet')));
        return;
    }

    equipmentData.cameras.forEach((cam) => {
        const col = document.createElement('div');
        col.className = 'col mb-3';
        const card = document.createElement('div');
        card.className = 'card h-100';
        const body = document.createElement('div');
        body.className = 'card-body';

        const title = document.createElement('h5');
        title.className = 'card-title mb-1';
        title.textContent = cam.name;
        body.appendChild(title);

        if (cam.manufacturer) {
            const subtitle = document.createElement('h6');
            subtitle.className = 'card-subtitle mb-2 text-body-secondary';
            subtitle.textContent = cam.manufacturer;
            body.appendChild(subtitle);
        }

        const p = document.createElement('p');
        p.className = 'card-text';
        appendInfoLine(p, i18n.t('equipment.type'), cam.sensor_type);
        appendInfoLine(p, i18n.t('equipment.resolution'), `${cam.resolution_width_px}x${cam.resolution_height_px}`);
        appendInfoLine(p, i18n.t('equipment.pixel_size'), `${cam.pixel_size_um}${i18n.t('units.um')}`);
        appendInfoLine(p, i18n.t('equipment.diagonal'), `${cam.sensor_diagonal_mm.toFixed(2)}${i18n.t('units.mm')}`);
        if (cam.weight_kg > 0) appendInfoLine(p, i18n.t('equipment.weight'), `${cam.weight_kg}${i18n.t('units.kg')}`);
        body.appendChild(p);

        card.appendChild(body);
        card.appendChild(createCardFooter('btn-edit-camera', 'btn-delete-camera', cam.id));
        col.appendChild(card);
        container.appendChild(col);
    });
}

// --- Mounts Tab (Position 5) ---

function renderMountsTab() {
    const container = document.getElementById('equipment-mounts-display');
    if (!container) return;
    
    DOMUtils.clear(container);
    
    if (equipmentData.mounts.length === 0) {
        container.appendChild(createEmptyStateCard(i18n.t('equipment.no_mounts_created_yet')));
        return;
    }

    equipmentData.mounts.forEach((mount) => {
        const col = document.createElement('div');
        col.className = 'col mb-3';
        const card = document.createElement('div');
        card.className = 'card h-100';
        const body = document.createElement('div');
        body.className = 'card-body';

        const title = document.createElement('h5');
        title.className = 'card-title mb-1';
        title.textContent = mount.name;
        body.appendChild(title);

        if (mount.manufacturer) {
            const subtitle = document.createElement('h6');
            subtitle.className = 'card-subtitle mb-2 text-body-secondary';
            subtitle.textContent = mount.manufacturer;
            body.appendChild(subtitle);
        }

        const p = document.createElement('p');
        p.className = 'card-text';
        appendInfoLine(p, i18n.t('equipment.type'), mount.mount_type);
        appendInfoLine(p, i18n.t('equipment.max_payload'), `${mount.payload_capacity_kg}${i18n.t('units.kg')}`);
        appendInfoLine(p, i18n.t('equipment.guiding'), mount.guiding_supported ? i18n.t('equipment.yes') : i18n.t('equipment.no'));
        body.appendChild(p);

        card.appendChild(body);
        card.appendChild(createCardFooter('btn-edit-mount', 'btn-delete-mount', mount.id));
        col.appendChild(card);
        container.appendChild(col);
    });
}

// --- Filters Tab (Position 6) ---

function renderFiltersTab() {
    const container = document.getElementById('equipment-filters-display');
    if (!container) return;
    
    DOMUtils.clear(container);
    
    if (equipmentData.filters.length === 0) {
        container.appendChild(createEmptyStateCard(i18n.t('equipment.no_filters_created_yet')));
        return;
    }

    equipmentData.filters.forEach((filter) => {
        const col = document.createElement('div');
        col.className = 'col mb-3';
        const card = document.createElement('div');
        card.className = 'card h-100';
        const body = document.createElement('div');
        body.className = 'card-body';

        const title = document.createElement('h5');
        title.className = 'card-title mb-1';
        title.textContent = filter.name;
        body.appendChild(title);

        if (filter.manufacturer) {
            const subtitle = document.createElement('h6');
            subtitle.className = 'card-subtitle mb-2 text-body-secondary';
            subtitle.textContent = filter.manufacturer;
            body.appendChild(subtitle);
        }

        const p = document.createElement('p');
        p.className = 'card-text';
        appendInfoLine(p, i18n.t('equipment.type'), filter.filter_type);
        if (filter.central_wavelength_nm) appendInfoLine(p, i18n.t('equipment.wavelength'), `${filter.central_wavelength_nm}${i18n.t('units.nm')}`);
        if (filter.bandwidth_nm) appendInfoLine(p, i18n.t('equipment.bandwidth'), `${filter.bandwidth_nm}${i18n.t('units.nm')}`);
        appendInfoLine(p, i18n.t('equipment.use'), filter.intended_use || i18n.t('equipment.general'));
        body.appendChild(p);

        card.appendChild(body);
        card.appendChild(createCardFooter('btn-edit-filter', 'btn-delete-filter', filter.id));
        col.appendChild(card);
        container.appendChild(col);
    });
}

// --- Accessories Tab (Position 7) ---

function renderAccessoriesTab() {
    const container = document.getElementById('equipment-accessories-display');
    if (!container) return;
    
    DOMUtils.clear(container);
    
    if (equipmentData.accessories.length === 0) {
        container.appendChild(createEmptyStateCard(i18n.t('equipment.no_accessories_created_yet')));
        return;
    }

    equipmentData.accessories.forEach((accessory) => {
        const col = document.createElement('div');
        col.className = 'col mb-3';
        const card = document.createElement('div');
        card.className = 'card h-100';
        const body = document.createElement('div');
        body.className = 'card-body';

        const title = document.createElement('h5');
        title.className = 'card-title mb-1';
        title.textContent = accessory.name;
        body.appendChild(title);

        if (accessory.manufacturer) {
            const subtitle = document.createElement('h6');
            subtitle.className = 'card-subtitle mb-2 text-body-secondary';
            subtitle.textContent = accessory.manufacturer;
            body.appendChild(subtitle);
        }

        const p = document.createElement('p');
        p.className = 'card-text';
        appendInfoLine(p, i18n.t('equipment.type'), accessory.accessory_type);
        if (accessory.weight_kg > 0) appendInfoLine(p, i18n.t('equipment.weight'), `${accessory.weight_kg}${i18n.t('units.kg')}`);
        body.appendChild(p);

        card.appendChild(body);
        card.appendChild(createCardFooter('btn-edit-accessory', 'btn-delete-accessory', accessory.id));
        col.appendChild(card);
        container.appendChild(col);
    });
}

// ============================================
// CRUD Operations
// ============================================

// --- Telescope Operations ---

async function showTelescopeModal(id = null) {
    const telescope = id ? equipmentData.telescopes.find(t => t.id === id) : null;
    const title = telescope ? i18n.t('equipment.edit_telescope') : i18n.t('equipment.new_telescope');
    
    const modalContent = `
        <form id="telescopeForm" class="form row g-3">
            <div class="col-md-6">
                <label for="telescope-name" class="form-label">${i18n.t('equipment.form_name')} *</label>
                <input type="text" class="form-control" id="telescope-name" name="name" value="${escapeHtml(telescope?.name || '')}" required>
            </div>
            <div class="col-md-6">
                <label for="telescope-manufacturer" class="form-label">${i18n.t('equipment.form_manufacturer')} *</label>
                <input type="text" class="form-control" id="telescope-manufacturer" name="manufacturer" value="${escapeHtml(telescope?.manufacturer || '')}" required placeholder="${i18n.t('equipment.form_manufacturer_placeholder_telescope')}">
            </div>
            <div class="col-md-12">
                <label for="telescope-type" class="form-label">${i18n.t('equipment.form_type')} *</label>
                <select class="form-select" id="telescope-type" name="telescope_type" required>
                    <option value="Refractor" ${telescope?.telescope_type === 'Refractor' ? 'selected' : ''}>${i18n.t('equipment.form_refractor')}</option>
                    <option value="Reflector" ${telescope?.telescope_type === 'Reflector' ? 'selected' : ''}>${i18n.t('equipment.form_reflector')}</option>
                    <option value="Schmidt-Cassegrain (SCT)" ${telescope?.telescope_type === 'Schmidt-Cassegrain (SCT)' ? 'selected' : ''}>${i18n.t('equipment.form_sct')}</option>
                    <option value="Ritchey-Chrétien (RC)" ${telescope?.telescope_type === 'Ritchey-Chrétien (RC)' ? 'selected' : ''}>${i18n.t('equipment.form_rc')}</option>
                    <option value="Newtonian" ${telescope?.telescope_type === 'Newtonian' ? 'selected' : ''}>${i18n.t('equipment.form_newtonian')}</option>
                    <option value="Maksutov-Cassegrain" ${telescope?.telescope_type === 'Maksutov-Cassegrain' ? 'selected' : ''}>${i18n.t('equipment.form_maksutov')}</option>
                    <option value="Cassegrain" ${telescope?.telescope_type === 'Cassegrain' ? 'selected' : ''}>${i18n.t('equipment.form_cassegrain')}</option>
                    <option value="Dobsonian" ${telescope?.telescope_type === 'Dobsonian' ? 'selected' : ''}>${i18n.t('equipment.form_dobsonian')}</option>
                </select>
            </div>
            <div class="col-md-6">
                <label for="telescope-aperture" class="form-label">${i18n.t('equipment.form_aperture')} *</label>
                <input type="number" class="form-control" id="telescope-aperture" name="aperture_mm" value="${telescope?.aperture_mm || ''}" required min="10" max="2000">
            </div>
            <div class="col-md-6">
                <label for="telescope-focal-length" class="form-label">${i18n.t('equipment.form_focal_length')} *</label>
                <input type="number" class="form-control" id="telescope-focal-length" name="focal_length_mm" value="${telescope?.focal_length_mm || ''}" required min="100" max="20000">
            </div>
            <div class="col-md-6">
                <label for="telescope-reducer-barlow-factor" class="form-label">${i18n.t('equipment.form_reducer_barlow_factor')}</label>
                <input type="number" class="form-control" id="telescope-reducer-barlow-factor" name="reducer_barlow_factor" value="${telescope?.reducer_barlow_factor || 1.0}" min="0.1" max="3" step="0.1">
                <small class="form-text text-muted">${i18n.t('equipment.form_reducer_barlow_text')}</small>
            </div>
            <div class="col-md-6">
                <label for="telescope-weight" class="form-label">${i18n.t('equipment.form_weight')}</label>
                <input type="number" class="form-control" id="telescope-weight" name="weight_kg" value="${telescope?.weight_kg || ''}" min="0" max="100" step="0.1">
            </div>
            <div class="col-md-12">
                <label for="telescope-notes" class="form-label">${i18n.t('equipment.form_notes')}</label>
                <textarea class="form-control" id="telescope-notes" name="notes" rows="2">${escapeHtml(telescope?.notes || '')}</textarea>
            </div>
            <div class="text-end mt-3">
                <button type="submit" class="btn btn-primary">${i18n.t('equipment.form_save')}</button>
            </div>
        </form>
    `;

    if (typeof closeModal === 'function') {
        closeModal();
    }
    createModal(title, modalContent, 'lg');

    const bs_modal = new bootstrap.Modal('#modal_lg_close', {
        backdrop: 'static',
        focus: true,
        keyboard: true
    });
    bs_modal.show();

    document.getElementById('telescopeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveTelescope(telescope?.id || '');
    });
}

async function saveTelescope(id) {
    const form = document.getElementById('telescopeForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    try {
        const url = id ? `/api/equipment/telescopes/${id}` : '/api/equipment/telescopes';
        const method = id ? 'PUT' : 'POST';
        
        await fetchJSON(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modal_lg_close'));
        if (modal) {
            document.activeElement?.blur();
            modal.hide();
        }
        await loadEquipmentType('telescopes');
        await loadEquipmentType('combinations');
        renderTelescopesTab();
        renderFOVCalculatorTab();
        renderCombinationsTab();
        showMessage('success', id ? i18n.t('equipment.telescope_updated') : i18n.t('equipment.telescope_created'));
    } catch (error) {
        console.error('Error saving telescope:', error);
        showMessage('error', i18n.t('equipment.failed_to_save_telescope'));
    }
}

// --- Camera Operations ---

async function showCameraModal(id = null) {
    const camera = id ? equipmentData.cameras.find(c => c.id === id) : null;
    const title = camera ? i18n.t('equipment.edit_camera') : i18n.t('equipment.new_camera');
    
    const modalContent = `
        <form id="cameraForm" class="form row g-3">
            <div class="col-md-6">
                <label for="camera-name" class="form-label">${i18n.t('equipment.form_name')} *</label>
                <input type="text" class="form-control" id="camera-name" name="name" value="${escapeHtml(camera?.name || '')}" required>
            </div>
            <div class="col-md-6">
                <label for="camera-manufacturer" class="form-label">${i18n.t('equipment.form_manufacturer')} *</label>
                <input type="text" class="form-control" id="camera-manufacturer" name="manufacturer" value="${escapeHtml(camera?.manufacturer || '')}" required>
            </div>
            <div class="col-md-6">
                <label for="camera-sensor-type" class="form-label">${i18n.t('equipment.form_sensor_type')} *</label>
                <select class="form-select" id="camera-sensor-type" name="sensor_type" required>
                    <option value="CMOS Color" ${camera?.sensor_type === 'CMOS Color' ? 'selected' : ''}>${i18n.t('equipment.form_cmos_color')}</option>
                    <option value="CMOS Mono" ${camera?.sensor_type === 'CMOS Mono' ? 'selected' : ''}>${i18n.t('equipment.form_cmos_mono')}</option>
                    <option value="CCD Color" ${camera?.sensor_type === 'CCD Color' ? 'selected' : ''}>${i18n.t('equipment.form_ccd_color')}</option>
                    <option value="CCD Mono" ${camera?.sensor_type === 'CCD Mono' ? 'selected' : ''}>${i18n.t('equipment.form_ccd_mono')}</option>
                </select>
            </div>
            <div class="col-md-6">
                <label for="camera-pixel-size" class="form-label">${i18n.t('equipment.form_pixel_size')} *</label>
                <input type="number" class="form-control" id="camera-pixel-size" name="pixel_size_um" value="${camera?.pixel_size_um || ''}" required min="1" max="10" step="0.01">
            </div>
            <div class="col-md-6">
                <label for="camera-sensor-width" class="form-label">${i18n.t('equipment.form_sensor_width')} *</label>
                <input type="number" class="form-control" id="camera-sensor-width" name="sensor_width_mm" value="${camera?.sensor_width_mm || ''}" required min="1" max="100" step="0.1">
            </div>
            <div class="col-md-6">
                <label for="camera-sensor-height" class="form-label">${i18n.t('equipment.form_sensor_height')} *</label>
                <input type="number" class="form-control" id="camera-sensor-height" name="sensor_height_mm" value="${camera?.sensor_height_mm || ''}" required min="1" max="100" step="0.1">
            </div>
            <div class="col-md-6">
                <label for="camera-resolution-width" class="form-label">${i18n.t('equipment.form_resolution_width')} *</label>
                <input type="number" class="form-control" id="camera-resolution-width" name="resolution_width_px" value="${camera?.resolution_width_px || ''}" required min="640" max="16000">
            </div>
            <div class="col-md-6">
                <label for="camera-resolution-height" class="form-label">${i18n.t('equipment.form_resolution_height')} *</label>
                <input type="number" class="form-control" id="camera-resolution-height" name="resolution_height_px" value="${camera?.resolution_height_px || ''}" required min="480" max="12000">
            </div>
            <div class="col-md-6">
                <label for="camera-cooling-supported" class="form-label">${i18n.t('equipment.form_cooling_supported')}</label>
                <select class="form-select" id="camera-cooling-supported" name="cooling_supported">
                    <option value="false" ${camera?.cooling_supported === false ? 'selected' : ''}>${i18n.t('equipment.no')}</option>
                    <option value="true" ${camera?.cooling_supported === true ? 'selected' : ''}>${i18n.t('equipment.yes')}</option>
                </select>
            </div>
            <div class="col-md-6">
                <label for="camera-min-temperature" class="form-label">${i18n.t('equipment.form_min_temperature')}</label>
                <input type="number" class="form-control" id="camera-min-temperature" name="min_temperature_c" value="${camera?.min_temperature_c || ''}" min="-50" max="0">
            </div>
            <div class="col-md-6">
                <label for="camera-weight" class="form-label">${i18n.t('equipment.form_weight')}</label>
                <input type="number" class="form-control" id="camera-weight" name="weight_kg" value="${camera?.weight_kg || ''}" min="0" max="50" step="0.1">
            </div>
            <div class="col-md-12">
                <label for="camera-notes" class="form-label">${i18n.t('equipment.form_notes')}</label>
                <textarea class="form-control" id="camera-notes" name="notes" rows="2">${escapeHtml(camera?.notes || '')}</textarea>
            </div>
            <div class="text-end mt-3">
                <button type="submit" class="btn btn-primary">${i18n.t('equipment.form_save')}</button>
            </div>
        </form>
    `;

    if (typeof closeModal === 'function') {
        closeModal();
    }
    createModal(title, modalContent, 'lg');

    const bs_modal = new bootstrap.Modal('#modal_lg_close', {
        backdrop: 'static',
        focus: true,
        keyboard: true
    });
    bs_modal.show();

    document.getElementById('cameraForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveCamera(camera?.id || '');
    });
}

async function saveCamera(id) {
    const form = document.getElementById('cameraForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    data.cooling_supported = data.cooling_supported === 'true';
    
    try {
        const url = id ? `/api/equipment/cameras/${id}` : '/api/equipment/cameras';
        const method = id ? 'PUT' : 'POST';
        
        await fetchJSON(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modal_lg_close'));
        if (modal) {
            document.activeElement?.blur();
            modal.hide();
        }
        await loadEquipmentType('cameras');
        await loadEquipmentType('combinations');
        renderCamerasTab();
        renderFOVCalculatorTab();
        renderCombinationsTab();
        showMessage('success', id ? i18n.t('equipment.camera_updated') : i18n.t('equipment.camera_created'));
    } catch (error) {
        console.error('Error saving camera:', error);
        showMessage('error', i18n.t('equipment.failed_to_save_camera'));
    }
}

// --- Mount Operations ---

async function showMountModal(id = null) {
    const mount = id ? equipmentData.mounts.find(m => m.id === id) : null;
    const title = mount ? i18n.t('equipment.edit_mount') : i18n.t('equipment.new_mount');
    
    const modalContent = `
        <form id="mountForm" class="form row g-3">
            <div class="col-md-6">
                <label for="mount-name" class="form-label">${i18n.t('equipment.form_name')} *</label>
                <input type="text" class="form-control" id="mount-name" name="name" value="${escapeHtml(mount?.name || '')}" required>
            </div>
            <div class="col-md-6">
                <label for="mount-manufacturer" class="form-label">${i18n.t('equipment.form_manufacturer')}</label>
                <input type="text" class="form-control" id="mount-manufacturer" name="manufacturer" value="${escapeHtml(mount?.manufacturer || '')}" placeholder="${i18n.t('equipment.form_manufacturer_placeholder_telescope')}">
            </div>
           <div class="col-md-6">
                <label for="mount-type" class="form-label">${i18n.t('equipment.form_type')} *</label>
                <select class="form-select" id="mount-type" name="mount_type" required>
                    <option value="Equatorial" ${mount?.mount_type === 'Equatorial' ? 'selected' : ''}>${i18n.t('equipment.form_equatorial')}</option>
                    <option value="Alt-Azimuth" ${mount?.mount_type === 'Alt-Azimuth' ? 'selected' : ''}>${i18n.t('equipment.form_altazimuth')}</option>
                    <option value="Dobsonian" ${mount?.mount_type === 'Dobsonian' ? 'selected' : ''}>${i18n.t('equipment.form_dobsonian')}</option>
                    <option value="Fork Mount" ${mount?.mount_type === 'Fork Mount' ? 'selected' : ''}>${i18n.t('equipment.form_fork_mount')}</option>
                </select>
            </div>
            <div class="col-md-6">
                <label for="mount-payload-capacity" class="form-label">${i18n.t('equipment.form_payload_capacity')} *</label>
                <input type="number" class="form-control" id="mount-payload-capacity" name="payload_capacity_kg" value="${mount?.payload_capacity_kg || ''}" required min="0.1" max="100" step="0.1">
            </div>
            <div class="col-md-6">
                <label for="mount-tracking-accuracy" class="form-label">${i18n.t('equipment.form_tracking_accuracy')}</label>
                <input type="number" class="form-control" id="mount-tracking-accuracy" name="tracking_accuracy_arcsec" value="${mount?.tracking_accuracy_arcsec || ''}" min="0.1" max="10" step="0.1">
            </div>
            <div class="col-md-6">
                <label for="mount-guiding-supported" class="form-label">${i18n.t('equipment.form_guiding_support')}</label>
                <select class="form-select" id="mount-guiding-supported" name="guiding_supported">
                    <option value="false" ${mount?.guiding_supported === false ? 'selected' : ''}>${i18n.t('equipment.no')}</option>
                    <option value="true" ${mount?.guiding_supported === true ? 'selected' : ''}>${i18n.t('equipment.yes')}</option>
                </select>
            </div>
            <div class="col-md-12">
                <label for="mount-notes" class="form-label">${i18n.t('equipment.form_notes')}</label>
                <textarea class="form-control" id="mount-notes" name="notes" rows="2">${escapeHtml(mount?.notes || '')}</textarea>
            </div>
            <div class="text-end mt-3">
                <button type="submit" class="btn btn-primary">${i18n.t('equipment.form_save')}</button>
            </div>
        </form>
    `;

    if (typeof closeModal === 'function') {
        closeModal();
    }
    createModal(title, modalContent, 'lg');

    const bs_modal = new bootstrap.Modal('#modal_lg_close', {
        backdrop: 'static',
        focus: true,
        keyboard: true
    });
    bs_modal.show();

    document.getElementById('mountForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveMount(mount?.id || '');
    });
}

async function saveMount(id) {
    const form = document.getElementById('mountForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    data.guiding_supported = data.guiding_supported === 'true';
    
    try {
        const url = id ? `/api/equipment/mounts/${id}` : '/api/equipment/mounts';
        const method = id ? 'PUT' : 'POST';
        
        await fetchJSON(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modal_lg_close'));
        if (modal) {
            document.activeElement?.blur();
            modal.hide();
        }
        await loadEquipmentType('mounts');
        await loadEquipmentType('combinations');
        renderMountsTab();
        renderCombinationsTab();
        showMessage('success', id ? i18n.t('equipment.mount_updated') : i18n.t('equipment.mount_created'));
    } catch (error) {
        console.error('Error saving mount:', error);
        showMessage('error', i18n.t('equipment.failed_to_save_mount'));
    }
}

// --- Filter Operations ---

async function showFilterModal(id = null) {
    const filter = id ? equipmentData.filters.find(f => f.id === id) : null;
    const title = filter ? i18n.t('equipment.edit_filter') : i18n.t('equipment.new_filter');
    
    const modalContent = `
        <form id="filterForm" class="form row g-3">
            <div class="col-md-6">
                <label for="filter-name" class="form-label">${i18n.t('equipment.form_name')} *</label>
                <input type="text" class="form-control" id="filter-name" name="name" value="${escapeHtml(filter?.name || '')}" required>
            </div>
            <div class="col-md-6">
                <label for="filter-manufacturer" class="form-label">${i18n.t('equipment.form_manufacturer')}</label>
                <input type="text" class="form-control" id="filter-manufacturer" name="manufacturer" value="${escapeHtml(filter?.manufacturer || '')}" placeholder="${i18n.t('equipment.form_manufacturer_placeholder_filter')}">
            </div>
            <div class="col-md-12">
                <label for="filter-type" class="form-label">${i18n.t('equipment.form_type')} *</label>
                <select class="form-select" id="filter-type" name="filter_type" required>
                    <option value="LRGB" ${filter?.filter_type === 'LRGB' ? 'selected' : ''}>${i18n.t('equipment.form_lrgb')}</option>
                    <option value="Narrowband" ${filter?.filter_type === 'Narrowband' ? 'selected' : ''}>${i18n.t('equipment.form_narrowband')}</option>
                    <option value="Broadband" ${filter?.filter_type === 'Broadband' ? 'selected' : ''}>${i18n.t('equipment.form_broadband')}</option>
                    <option value="Luminance" ${filter?.filter_type === 'Luminance' ? 'selected' : ''}>${i18n.t('equipment.form_luminance')}</option>
                    <option value="RGB" ${filter?.filter_type === 'RGB' ? 'selected' : ''}>${i18n.t('equipment.form_rgb')}</option>
                    <option value="H-Alpha" ${filter?.filter_type === 'H-Alpha' ? 'selected' : ''}>${i18n.t('equipment.form_h_alpha')}</option>
                    <option value="OIII" ${filter?.filter_type === 'OIII' ? 'selected' : ''}>${i18n.t('equipment.form_oiii')}</option>
                    <option value="SII" ${filter?.filter_type === 'SII' ? 'selected' : ''}>${i18n.t('equipment.form_sii')}</option>
                    <option value="UHC" ${filter?.filter_type === 'UHC' ? 'selected' : ''}>${i18n.t('equipment.form_uhc')}</option>
                    <option value="Light Pollution Reduction" ${filter?.filter_type === 'Light Pollution Reduction' ? 'selected' : ''}>${i18n.t('equipment.form_lpr')}</option>
                    <option value="Solar" ${filter?.filter_type === 'Solar' ? 'selected' : ''}>${i18n.t('equipment.form_solar')}</option>
                    <option value="Other" ${filter?.filter_type === 'Other' ? 'selected' : ''}>${i18n.t('equipment.form_other')}</option>
                </select>
            </div>
            <div class="col-md-6">
                <label for="filter-wavelength" class="form-label">${i18n.t('equipment.form_wavelength')}</label>
                <input type="number" class="form-control" id="filter-wavelength" name="central_wavelength_nm" value="${filter?.central_wavelength_nm || ''}" min="300" max="2000">
            </div>
            <div class="col-md-6">
                <label for="filter-bandwidth" class="form-label">${i18n.t('equipment.form_bandwidth')}</label>
                <input type="number" class="form-control" id="filter-bandwidth" name="bandwidth_nm" value="${filter?.bandwidth_nm || ''}" min="1" max="1000">
            </div>
            <div class="col-md-12">
                <label for="filter-intended-use" class="form-label">${i18n.t('equipment.form_intended_use')}</label>
                <input type="text" class="form-control" id="filter-intended-use" name="intended_use" value="${escapeHtml(filter?.intended_use || '')}" placeholder="${i18n.t('equipment.form_intended_use_placeholder')}">
            </div>
            <div class="col-md-12">
                <label for="filter-notes" class="form-label">${i18n.t('equipment.form_notes')}</label>
                <textarea class="form-control" id="filter-notes" name="notes" rows="2">${escapeHtml(filter?.notes || '')}</textarea>
            </div>
            <div class="text-end mt-3">
                <button type="submit" class="btn btn-primary">${i18n.t('equipment.form_save')}</button>
            </div>
        </form>
    `;

    if (typeof closeModal === 'function') {
        closeModal();
    }
    createModal(title, modalContent, 'lg');

    const bs_modal = new bootstrap.Modal('#modal_lg_close', {
        backdrop: 'static',
        focus: true,
        keyboard: true
    });
    bs_modal.show();

    document.getElementById('filterForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveFilter(filter?.id || '');
    });
}

async function saveFilter(id) {
    const form = document.getElementById('filterForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    try {
        const url = id ? `/api/equipment/filters/${id}` : '/api/equipment/filters';
        const method = id ? 'PUT' : 'POST';
        
        await fetchJSON(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modal_lg_close'));
        if (modal) {
            document.activeElement?.blur();
            modal.hide();
        }
        await loadEquipmentType('filters');
        renderFiltersTab();
        showMessage('success', id ? i18n.t('equipment.filter_updated') : i18n.t('equipment.filter_created'));
    } catch (error) {
        console.error('Error saving filter:', error);
        showMessage('error', i18n.t('equipment.failed_to_save_filter'));
    }
}

// --- Accessory Operations ---

async function showAccessoryModal(id = null) {
    const accessory = id ? equipmentData.accessories.find(a => a.id === id) : null;
    const title = accessory ? i18n.t('equipment.edit_accessory') : i18n.t('equipment.new_accessory');
    
    const modalContent = `
        <form id="accessoryForm" class="form">
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label for="accessory-name" class="form-label">${i18n.t('equipment.form_name')} *</label>
                    <input type="text" class="form-control" id="accessory-name" name="name" value="${escapeHtml(accessory?.name || '')}" required>
                </div>
                <div class="col-md-6 mb-3">
                    <label for="accessory-manufacturer" class="form-label">${i18n.t('equipment.form_manufacturer')}</label>
                    <input type="text" class="form-control" id="accessory-manufacturer" name="manufacturer" value="${escapeHtml(accessory?.manufacturer || '')}">
                </div>
            </div>
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label for="accessory-type" class="form-label">${i18n.t('equipment.form_type')} *</label>
                    <input type="text" class="form-control" id="accessory-type" name="accessory_type" value="${escapeHtml(accessory?.accessory_type || '')}" required placeholder="${i18n.t('equipment.form_type_accessory_placeholder')}">
                </div>
                <div class="col-md-6 mb-3">
                    <label for="accessory-weight" class="form-label">${i18n.t('equipment.form_weight')}</label>
                    <input type="number" class="form-control" id="accessory-weight" name="weight_kg" value="${accessory?.weight_kg || ''}" min="0" max="50" step="0.1">
                </div>
            </div>
            <div class="mb-3">
                <label for="accessory-notes" class="form-label">${i18n.t('equipment.form_notes')}</label>
                <textarea class="form-control" id="accessory-notes" name="notes" rows="2">${escapeHtml(accessory?.notes || '')}</textarea>
            </div>
            <div class="text-end mt-3">
                <button type="submit" class="btn btn-primary">${i18n.t('equipment.form_save')}</button>
            </div>
        </form>
    `;

    if (typeof closeModal === 'function') {
        closeModal();
    }
    createModal(title, modalContent, 'lg');

    const bs_modal = new bootstrap.Modal('#modal_lg_close', {
        backdrop: 'static',
        focus: true,
        keyboard: true
    });
    bs_modal.show();

    document.getElementById('accessoryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveAccessory(accessory?.id || '');
    });
}

async function saveAccessory(id) {
    const form = document.getElementById('accessoryForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    try {
        const url = id ? `/api/equipment/accessories/${id}` : '/api/equipment/accessories';
        const method = id ? 'PUT' : 'POST';
        
        await fetchJSON(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modal_lg_close'));
        if (modal) {
            document.activeElement?.blur();
            modal.hide();
        }
        await loadEquipmentType('accessories');
        await loadEquipmentType('combinations');
        renderAccessoriesTab();
        renderCombinationsTab();
        showMessage('success', id ? i18n.t('equipment.accessory_updated') : i18n.t('equipment.accessory_created'));
    } catch (error) {
        console.error('Error saving accessory:', error);
        showMessage('error', i18n.t('equipment.failed_to_save_accessory'));
    }
}

// --- Combination Operations ---

async function showCombinationModal(id = null) {
    const combination = id ? equipmentData.combinations.find(c => c.id === id) : null;
    const title = combination ? i18n.t('equipment.edit_combination') : i18n.t('equipment.new_combination');
    
    const telescopes = equipmentData.telescopes;
    const cameras = equipmentData.cameras;
    const mounts = equipmentData.mounts;
    const filters = equipmentData.filters;
    const accessories = equipmentData.accessories;
    
    const modalContent = `
        <form id="combinationForm" class="form">
            <div class="mb-3">
                <label class="form-label">Name *</label>
                <input type="text" class="form-control" name="name" value="${escapeHtml(combination?.name || '')}" required>
            </div>
            <div class="mb-3">
                <label for="combination-telescope" class="form-label">${i18n.t('equipment.form_telescope')}</label>
                <select class="form-select" id="combination-telescope" name="telescope_id">
                    <option value="">${i18n.t('equipment.none')}</option>
                    ${telescopes.map(t => `<option value="${t.id}" ${combination?.telescope_id === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
                </select>
            </div>
            <div class="mb-3">
                <label for="combination-camera" class="form-label">${i18n.t('equipment.form_camera')}</label>
                <select class="form-select" id="combination-camera" name="camera_id">
                    <option value="">${i18n.t('equipment.none')}</option>
                    ${cameras.map(c => `<option value="${c.id}" ${combination?.camera_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
                </select>
            </div>
            <div class="mb-3">
                <label for="combination-mount" class="form-label">${i18n.t('equipment.form_mount')}</label>
                <select class="form-select" id="combination-mount" name="mount_id">
                    <option value="">${i18n.t('equipment.none')}</option>
                    ${mounts.map(m => `<option value="${m.id}" ${combination?.mount_id === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
                </select>
            </div>
            <div class="mb-3">
                <label for="combination-filters" class="form-label">${i18n.t('equipment.form_filters')}</label>
                <div class="checkbox-popup-box overflow-y-auto rounded" id="combination-filters">
                    ${filters.length === 0 ? `<div class="alert alert-info fw-light">${i18n.t('equipment.form_no_filters_created')}</div>` : ''}
                    ${filters.map(f => `
                        <div class="form-check">
                            <input class="form-check-input filter-checkbox" type="checkbox" value="${f.id}" 
                                ${combination?.filter_ids?.includes(f.id) ? 'checked' : ''}>
                            <label class="form-check-label">${escapeHtml(f.name)}</label>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="mb-3">
                <label for="combination-accessories" class="form-label">${i18n.t('equipment.form_accessories')}</label>
                <div class="checkbox-popup-box overflow-y-auto rounded" id="combination-accessories">
                    ${accessories.length === 0 ? `<div class="alert alert-info fw-light">${i18n.t('equipment.form_no_accessories_created')}</div>` : ''}
                    ${accessories.map(a => `
                        <div class="form-check">
                            <input class="form-check-input accessory-checkbox" type="checkbox" value="${a.id}" 
                                ${combination?.accessory_ids?.includes(a.id) ? 'checked' : ''}>
                            <label class="form-check-label">${escapeHtml(a.name)}</label>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="mb-3">
                <label for="combination-notes" class="form-label">${i18n.t('equipment.form_notes')}</label>
                <textarea class="form-control" id="combination-notes" name="notes" rows="2">${escapeHtml(combination?.notes || '')}</textarea>
            </div>
            <div class="text-end mt-3">
                <button type="submit" class="btn btn-primary">${i18n.t('equipment.form_save')}</button>
            </div>
        </form>
    `;

    if (typeof closeModal === 'function') {
        closeModal();
    }
    createModal(title, modalContent, 'lg');

    const bs_modal = new bootstrap.Modal('#modal_lg_close', {
        backdrop: 'static',
        focus: true,
        keyboard: true
    });
    bs_modal.show();

    document.getElementById('combinationForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveCombination(combination?.id || '');
    });
}

async function saveCombination(id) {
    const form = document.getElementById('combinationForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // Collect filter checkboxes
    const filterCheckboxes = form.querySelectorAll('.filter-checkbox:checked');
    data.filter_ids = Array.from(filterCheckboxes).map(cb => cb.value);
    
    // Collect accessory checkboxes
    const accessoryCheckboxes = form.querySelectorAll('.accessory-checkbox:checked');
    data.accessory_ids = Array.from(accessoryCheckboxes).map(cb => cb.value);
    
    try {
        const url = id ? `/api/equipment/combinations/${id}` : '/api/equipment/combinations';
        const method = id ? 'PUT' : 'POST';
        
        await fetchJSON(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modal_lg_close'));
        if (modal) {
            document.activeElement?.blur();
            modal.hide();
        }
        await loadEquipmentType('combinations');
        renderCombinationsTab();
        showMessage('success', id ? i18n.t('equipment.combination_updated') : i18n.t('equipment.combination_created'));
    } catch (error) {
        console.error('Error saving combination:', error);
        showMessage('error', i18n.t('equipment.failed_to_save_combination'));
    }
}

// ============================================
// Analysis
// ============================================

// ============================================
// Delete Equipment
// ============================================

async function deleteEquipment(type, id) {
    if (!confirm(i18n.t('equipment.confirm_delete_item'))) return;
    
    try {
        const typeMap = {
            'telescopes': 'telescopes',
            'cameras': 'cameras',
            'mounts': 'mounts',
            'filters': 'filters',
            'accessories': 'accessories',
            'combinations': 'combinations'
        };
        
        await fetchJSON(`/api/equipment/${typeMap[type]}/${id}`, { method: 'DELETE' });
        
        await loadEquipmentType(type);
        
        // Reload combinations if deleting equipment that affects payload or names
        if (['telescopes', 'cameras', 'mounts', 'accessories'].includes(type)) {
            await loadEquipmentType('combinations');
        }
        
        if (type === 'telescopes') {
            renderTelescopesTab();
            renderFOVCalculatorTab();
            renderCombinationsTab();
        } else if (type === 'cameras') {
            renderCamerasTab();
            renderFOVCalculatorTab();
            renderCombinationsTab();
        } else if (type === 'mounts') {
            renderMountsTab();
            renderCombinationsTab();
        } else if (type === 'filters') {
            renderFiltersTab();
        } else if (type === 'accessories') {
            renderAccessoriesTab();
            renderCombinationsTab();
        } else if (type === 'combinations') {
            renderCombinationsTab();
        }
        
        showMessage('success', i18n.t('equipment.item_deleted'));
    } catch (error) {
        console.error('Error deleting equipment:', error);
        showMessage('error', i18n.t('equipment.failed_to_delete_item'));
    }
}

// Initialize when module loads
document.addEventListener('DOMContentLoaded', initializeEquipment);
