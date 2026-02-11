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

function initializeEquipment() {
    loadAllEquipment();
    setupEquipmentEventListeners();
}

function setupEquipmentEventListeners() {
    // Main equipment buttons
    document.addEventListener('click', (e) => {
        // New equipment buttons
        if (e.target.classList.contains('btn-new-telescope')) showTelescopeModal();
        if (e.target.classList.contains('btn-new-camera')) showCameraModal();
        if (e.target.classList.contains('btn-new-mount')) showMountModal();
        if (e.target.classList.contains('btn-new-filter')) showFilterModal();
        if (e.target.classList.contains('btn-new-accessory')) showAccessoryModal();
        if (e.target.classList.contains('btn-new-combination')) showCombinationModal();
        
        // Edit buttons
        if (e.target.classList.contains('btn-edit-telescope')) showTelescopeModal(e.target.dataset.id);
        if (e.target.classList.contains('btn-edit-camera')) showCameraModal(e.target.dataset.id);
        if (e.target.classList.contains('btn-edit-mount')) showMountModal(e.target.dataset.id);
        if (e.target.classList.contains('btn-edit-filter')) showFilterModal(e.target.dataset.id);
        if (e.target.classList.contains('btn-edit-accessory')) showAccessoryModal(e.target.dataset.id);
        if (e.target.classList.contains('btn-edit-combination')) showCombinationModal(e.target.dataset.id);
        
        // Delete buttons
        if (e.target.classList.contains('btn-delete-telescope')) deleteEquipment('telescopes', e.target.dataset.id);
        if (e.target.classList.contains('btn-delete-camera')) deleteEquipment('cameras', e.target.dataset.id);
        if (e.target.classList.contains('btn-delete-mount')) deleteEquipment('mounts', e.target.dataset.id);
        if (e.target.classList.contains('btn-delete-filter')) deleteEquipment('filters', e.target.dataset.id);
        if (e.target.classList.contains('btn-delete-accessory')) deleteEquipment('accessories', e.target.dataset.id);
        if (e.target.classList.contains('btn-delete-combination')) deleteEquipment('combinations', e.target.dataset.id);
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
        showMessage('error', 'Failed to load equipment data');
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

// --- Combinations Tab (Position 1) ---

function renderCombinationsTab() {
    const container = document.getElementById('equipment-combinations-display');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (equipmentData.combinations.length === 0) {
        container.innerHTML = `
            <div class="col mb-3">
                <div class="card h-100">
                    <div class="card-body">
                        <p class="card-text">
                            No equipment combinations created yet. Create one to analyze your setup!
                        </p>
                    </div>
                </div>
            </div>`;
        return;
    }
    
    const html = equipmentData.combinations.map(combo => {
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
            payloadAlert = `<div class="alert alert-danger alert-sm py-1 px-2 mt-2 fw-light">⚠️ Overweight! ${totalWeight.toFixed(1)}kg > ${mountCapacity}kg max</div>`;
        } else if (isOverRecommended) {
            payloadAlert = `<div class="alert alert-info alert-sm py-1 px-2 mt-2 fw-light">⚠️ Check recommended load: ${totalWeight.toFixed(1)}kg > ${mountRecommended}kg (75%)</div>`;
        } else if (mount) {
            payloadAlert = `<div class="alert alert-success alert-sm py-1 px-2 mt-2 fw-light">✓ Payload: ${totalWeight.toFixed(1)}kg / ${mountCapacity}kg</div>`;
        }
        
        return `
        <div class="col mb-3">
            <div class="card h-100">
                <div class="card-body">
                    <h5 class="card-title mb-1">${escapeHtml(combo.name)}</h5>
                    <p class="card-text">
                        ${telescope ? `<strong>Telescope:</strong> ${escapeHtml(telescope.name)}${telescopeWeight > 0 ? ` (${telescopeWeight}kg)` : ''}<br>` : ''}
                        ${camera ? `<strong>Camera:</strong> ${escapeHtml(camera.name)}${cameraWeight > 0 ? ` (${cameraWeight}kg)` : ''}<br>` : ''}
                        ${mount ? `<strong>Mount:</strong> ${escapeHtml(mount.name)}<br>` : ''}
                        ${combo.filter_ids && combo.filter_ids.length > 0 ? `<strong>Filters:</strong> ${equipmentData.filters.filter(f => combo.filter_ids.includes(f.id)).map(f => escapeHtml(f.name)).join(', ')}<br>` : ''}
                        ${combo.accessory_ids && combo.accessory_ids.length > 0 ? `<strong>Accessories:</strong> ${equipmentData.accessories.filter(a => combo.accessory_ids.includes(a.id)).map(a => escapeHtml(a.name)).join(', ')}${accessoriesWeight > 0 ? ` (${accessoriesWeight}kg)` : ''}<br>` : ''}
                    </p>
                    ${payloadAlert}
                </div>
                <div class="card-footer text-center">
                    <span class="btn-icon-placeholder"></span>
                    <button class="btn btn-outline-secondary btn-edit-combination" data-id="${combo.id}" title="Edit">✏️</button>
                    <button class="btn btn-outline-danger btn-delete-combination" data-id="${combo.id}" title="Delete">🗑️</button>
                </div>
            </div>
        </div>
    `;
    }).join('');
    
    container.innerHTML = html;
}

// --- FOV Calculator Tab (Position 2) ---

function renderFOVCalculatorTab() {
    const container = document.getElementById('equipment-fov-display');
    if (!container) return;
    
    const telescopes = equipmentData.telescopes;
    const cameras = equipmentData.cameras;
    
    let html = `
        <div class="card">
            <div class="card-body">
                <h5 class="card-title">🔭 Field of View Calculator</h5>
                <div class="row mb-3">
                    <div class="col-md-6">
                        <label  for="fov-telescope-select" class="form-label">Telescope</label>
                        <select id="fov-telescope-select" class="form-select">
                            <option value="">Select a telescope...</option>
                            ${telescopes.map(t => `<option value="${t.id}">${escapeHtml(t.name)} (${t.effective_focal_length}mm f/${t.effective_focal_ratio})</option>`).join('')}
                        </select>
                    </div>
                    <div class="col-md-6">
                        <label for="fov-camera-select" class="form-label">Camera</label>
                        <select id="fov-camera-select" class="form-select">
                            <option value="">Select a camera...</option>
                            ${cameras.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${c.pixel_size_um}µm)</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="row mb-3">
                    <div class="col-md-6">
                        <label for="fov-seeing" class="form-label">Seeing Conditions (arcsec)</label>
                        <input type="number" id="fov-seeing" class="form-control" value="2.0" min="0.5" max="5" step="0.1">
                    </div>
                    <div class="col-md-6 d-flex align-items-end">
                        <button class="btn btn-primary w-100 mt-2" onclick="calculateFOVFromUI()">Calculate FOV</button>
                    </div>
                </div>
                <div id="fov-results"></div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

async function calculateFOVFromUI() {
    const telescopeId = document.getElementById('fov-telescope-select')?.value;
    const cameraId = document.getElementById('fov-camera-select')?.value;
    const seeing = parseFloat(document.getElementById('fov-seeing')?.value || 2.0);
    
    if (!telescopeId || !cameraId) {
        showMessage('warning', 'Please select a telescope and a camera');
        return;
    }

    const telescope = equipmentData.telescopes.find(t => t.id === telescopeId);
    const camera = equipmentData.cameras.find(c => c.id === cameraId);
    if (!telescope || !camera) {
        showMessage('warning', 'Selected equipment not found');
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
        
        resultsDiv.innerHTML = `
            <div class="alert alert-success">
                <h6>FOV Calculation Results</h6>
                <table class="table table-sm table-borderless">
                    <tr><td><strong>Horizontal FOV:</strong></td><td>${fov.horizontal_fov_deg.toFixed(3)}°</td></tr>
                    <tr><td><strong>Vertical FOV:</strong></td><td>${fov.vertical_fov_deg.toFixed(3)}°</td></tr>
                    <tr><td><strong>Diagonal FOV:</strong></td><td>${fov.diagonal_fov_deg.toFixed(3)}°</td></tr>
                    <tr><td><strong>Image Scale:</strong></td><td>${fov.image_scale_arcsec_per_px.toFixed(4)}" arcsec/pixel</td></tr>
                    <tr><td><strong>Sampling:</strong></td><td><span class="badge bg-info">${fov.sampling_classification}</span></td></tr>
                </table>
            </div>
        `;
    } catch (error) {
        console.error('Error calculating FOV:', error);
        showMessage('error', 'Failed to calculate FOV');
    }
}

// --- Telescopes Tab (Position 3) ---

function renderTelescopesTab() {
    const container = document.getElementById('equipment-telescopes-display');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (equipmentData.telescopes.length === 0) {
        container.innerHTML = `
            <div class="col mb-3">
                <div class="card h-100">
                    <div class="card-body">
                        <p class="card-text">
                            No telescopes created yet.
                        </p>
                    </div>
                </div>
            </div>`;
        return;
    }
    
    const html = equipmentData.telescopes.map(scope => `
        <div class="col mb-3">
            <div class="card h-100">
                <div class="card-body">
                    <h5 class="card-title mb-1">${escapeHtml(scope.name)}</h5>
                    ${scope.manufacturer ? `<h6 class="card-subtitle mb-2 text-body-secondary">${escapeHtml(scope.manufacturer)}</h6>` : ''}
                    <p class="card-text">
                        <strong>Type:</strong> ${scope.telescope_type}<br>
                        <strong>Aperture:</strong> ${scope.aperture_mm}mm<br>
                        <strong>Native f/:</strong> ${scope.native_focal_ratio}<br>
                        <strong>Effective f/:</strong> ${scope.effective_focal_ratio}<br>
                        ${scope.weight_kg > 0 ? `<strong>Weight:</strong> ${scope.weight_kg}kg` : ''}
                    </p>
                </div>
                <div class="card-footer text-center">
                    <span class="btn-icon-placeholder"></span>
                    <button class="btn btn-outline-secondary btn-edit-telescope" data-id="${scope.id}" title="Edit">✏️</button>
                    <button class="btn btn-outline-danger btn-delete-telescope" data-id="${scope.id}" title="Delete">🗑️</button>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// --- Cameras Tab (Position 4) ---

function renderCamerasTab() {
    const container = document.getElementById('equipment-cameras-display');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (equipmentData.cameras.length === 0) {
        container.innerHTML = `
            <div class="col mb-3">
                <div class="card h-100">
                    <div class="card-body">
                        <p class="card-text">
                            No cameras created yet.
                        </p>
                    </div>
                </div>
            </div>`;
        return;
    }
    
    const html = equipmentData.cameras.map(cam => `
        <div class="col mb-3">
            <div class="card h-100">
                <div class="card-body">
                    <h5 class="card-title mb-1">${escapeHtml(cam.name)}</h5>
                    ${cam.manufacturer ? `<h6 class="card-subtitle mb-2 text-body-secondary">${escapeHtml(cam.manufacturer)}</h6>` : ''}
                    <p class="card-text">
                        <strong>Type:</strong> ${cam.sensor_type}<br>
                        <strong>Resolution:</strong> ${cam.resolution_width_px}×${cam.resolution_height_px}<br>
                        <strong>Pixel Size:</strong> ${cam.pixel_size_um}µm<br>
                        <strong>Diagonal:</strong> ${cam.sensor_diagonal_mm.toFixed(2)}mm<br>
                        ${cam.weight_kg > 0 ? `<strong>Weight:</strong> ${cam.weight_kg}kg` : ''}
                    </p>
                </div>
                <div class="card-footer text-center">
                    <span class="btn-icon-placeholder"></span>
                    <button class="btn btn-outline-secondary btn-edit-camera" data-id="${cam.id}" title="Edit">✏️</button>
                    <button class="btn btn-outline-danger btn-delete-camera" data-id="${cam.id}" title="Delete">🗑️</button>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// --- Mounts Tab (Position 5) ---

function renderMountsTab() {
    const container = document.getElementById('equipment-mounts-display');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (equipmentData.mounts.length === 0) {
        container.innerHTML = `
            <div class="col mb-3">
                <div class="card h-100">
                    <div class="card-body">
                        <p class="card-text">
                            No mounts created yet.
                        </p>
                    </div>
                </div>
            </div>`;
        return;
    }
    
    const html = equipmentData.mounts.map(mount => `
        <div class="col mb-3">
            <div class="card h-100">
                <div class="card-body">
                    <h5 class="card-title mb-1">${escapeHtml(mount.name)}</h5>
                    ${mount.manufacturer ? `<h6 class="card-subtitle mb-2 text-body-secondary">${escapeHtml(mount.manufacturer)}</h6>` : ''}
                    <p class="card-text">
                        <strong>Type:</strong> ${mount.mount_type}<br>
                        <strong>Max Payload:</strong> ${mount.payload_capacity_kg}kg<br>
                        <strong>Guiding:</strong> ${mount.guiding_supported ? '✅ Yes' : '❌ No'}
                    </p>
                </div>
                <div class="card-footer text-center">
                    <span class="btn-icon-placeholder"></span>
                    <button class="btn btn-outline-secondary btn-edit-mount" data-id="${mount.id}" title="Edit">✏️</button>
                    <button class="btn btn-outline-danger btn-delete-mount" data-id="${mount.id}" title="Delete">🗑️</button>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// --- Filters Tab (Position 6) ---

function renderFiltersTab() {
    const container = document.getElementById('equipment-filters-display');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (equipmentData.filters.length === 0) {
        container.innerHTML = `
            <div class="col mb-3">
                <div class="card h-100">
                    <div class="card-body">
                        <p class="card-text">
                            No filters created yet.
                        </p>
                    </div>
                </div>
            </div>`;
        return;
    }
    
    const html = equipmentData.filters.map(filter => `
        <div class="col mb-3">
            <div class="card h-100">
                <div class="card-body">
                    <h5 class="card-title mb-1">${escapeHtml(filter.name)}</h5>
                    ${filter.manufacturer ? `<h6 class="card-subtitle mb-2 text-body-secondary">${escapeHtml(filter.manufacturer)}</h6>` : ''}
                    <p class="card-text">
                        <strong>Type:</strong> ${filter.filter_type}<br>
                        ${filter.central_wavelength_nm ? `<strong>Wavelength:</strong> ${filter.central_wavelength_nm}nm<br>` : ''}
                        ${filter.bandwidth_nm ? `<strong>Bandwidth:</strong> ${filter.bandwidth_nm}nm<br>` : ''}
                        <strong>Use:</strong> ${filter.intended_use || 'General'}
                    </p>
                </div>
                <div class="card-footer text-center">
                    <span class="btn-icon-placeholder"></span>
                    <button class="btn btn-outline-secondary btn-edit-filter" data-id="${filter.id}" title="Edit">✏️</button>
                    <button class="btn btn-outline-danger btn-delete-filter" data-id="${filter.id}" title="Delete">🗑️</button>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// --- Accessories Tab (Position 7) ---

function renderAccessoriesTab() {
    const container = document.getElementById('equipment-accessories-display');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (equipmentData.accessories.length === 0) {
        container.innerHTML = `
            <div class="col mb-3">
                <div class="card h-100">
                    <div class="card-body">
                        <p class="card-text">
                            No accessories created yet.
                        </p>
                    </div>
                </div>
            </div>`;
        return;
    }
    
    const html = equipmentData.accessories.map(accessory => `
        <div class="col mb-3">
            <div class="card h-100">
                <div class="card-body">
                    <h5 class="card-title mb-1">${escapeHtml(accessory.name)}</h5>
                    ${accessory.manufacturer ? `<h6 class="card-subtitle mb-2 text-body-secondary">${escapeHtml(accessory.manufacturer)}</h6>` : ''}
                    <p class="card-text">
                        <strong>Type:</strong> ${escapeHtml(accessory.accessory_type)}<br>
                        ${accessory.weight_kg > 0 ? `<strong>Weight:</strong> ${accessory.weight_kg}kg` : ''}
                    </p>
                </div>
                <div class="card-footer text-center">
                    <span class="btn-icon-placeholder"></span>
                    <button class="btn btn-outline-secondary btn-edit-accessory" data-id="${accessory.id}" title="Edit">✏️</button>
                    <button class="btn btn-outline-danger btn-delete-accessory" data-id="${accessory.id}" title="Delete">🗑️</button>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// ============================================
// CRUD Operations
// ============================================

// --- Telescope Operations ---

async function showTelescopeModal(id = null) {
    const telescope = id ? equipmentData.telescopes.find(t => t.id === id) : null;
    const title = telescope ? 'Edit Telescope' : 'New Telescope';
    
    const modalContent = `
        <form id="telescopeForm" class="form row g-3">
            <div class="col-md-6">
                <label for="telescope-name" class="form-label">Name *</label>
                <input type="text" class="form-control" id="telescope-name" name="name" value="${escapeHtml(telescope?.name || '')}" required>
            </div>
            <div class="col-md-6">
                <label for="telescope-manufacturer" class="form-label">Manufacturer *</label>
                <input type="text" class="form-control" id="telescope-manufacturer" name="manufacturer" value="${escapeHtml(telescope?.manufacturer || '')}" required>
            </div>
            <div class="col-md-12">
                <label for="telescope-type" class="form-label">Type *</label>
                <select class="form-select" id="telescope-type" name="telescope_type" required>
                    <option value="Refractor" ${telescope?.telescope_type === 'Refractor' ? 'selected' : ''}>Refractor</option>
                    <option value="Reflector" ${telescope?.telescope_type === 'Reflector' ? 'selected' : ''}>Reflector</option>
                    <option value="Schmidt-Cassegrain (SCT)" ${telescope?.telescope_type === 'Schmidt-Cassegrain (SCT)' ? 'selected' : ''}>SCT</option>
                    <option value="Ritchey-Chrétien (RC)" ${telescope?.telescope_type === 'Ritchey-Chrétien (RC)' ? 'selected' : ''}>Ritchey-Chrétien</option>
                    <option value="Newtonian" ${telescope?.telescope_type === 'Newtonian' ? 'selected' : ''}>Newtonian</option>
                    <option value="Maksutov-Cassegrain" ${telescope?.telescope_type === 'Maksutov-Cassegrain' ? 'selected' : ''}>Maksutov</option>
                    <option value="Cassegrain" ${telescope?.telescope_type === 'Cassegrain' ? 'selected' : ''}>Cassegrain</option>
                    <option value="Dobsonian" ${telescope?.telescope_type === 'Dobsonian' ? 'selected' : ''}>Dobsonian</option>
                </select>
            </div>
            <div class="col-md-6">
                <label for="telescope-aperture" class="form-label">Aperture (mm) *</label>
                <input type="number" class="form-control" id="telescope-aperture" name="aperture_mm" value="${telescope?.aperture_mm || ''}" required min="10" max="2000">
            </div>
            <div class="col-md-6">
                <label for="telescope-focal-length" class="form-label">Focal Length (mm) *</label>
                <input type="number" class="form-control" id="telescope-focal-length" name="focal_length_mm" value="${telescope?.focal_length_mm || ''}" required min="100" max="20000">
            </div>
            <div class="col-md-6">
                <label for="telescope-reducer-barlow-factor" class="form-label">Reducer/Barlow Factor</label>
                <input type="number" class="form-control" id="telescope-reducer-barlow-factor" name="reducer_barlow_factor" value="${telescope?.reducer_barlow_factor || 1.0}" min="0.1" max="3" step="0.1">
                <small class="form-text text-muted">1.0 = no modification, 0.63 = reducer, 2.0 = barlow</small>
            </div>
            <div class="col-md-6">
                <label for="telescope-weight" class="form-label">Weight (kg)</label>
                <input type="number" class="form-control" id="telescope-weight" name="weight_kg" value="${telescope?.weight_kg || ''}" min="0" max="100" step="0.1">
            </div>
            <div class="col-md-12">
                <label for="telescope-notes" class="form-label">Notes</label>
                <textarea class="form-control" id="telescope-notes" name="notes" rows="2">${escapeHtml(telescope?.notes || '')}</textarea>
            </div>
            <div class="text-end mt-3">
                <button type="submit" class="btn btn-primary">Save</button>
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
        renderCombinationsTab();
        showMessage('success', id ? 'Telescope updated' : 'Telescope created');
    } catch (error) {
        console.error('Error saving telescope:', error);
        showMessage('error', 'Failed to save telescope');
    }
}

// --- Camera Operations ---

async function showCameraModal(id = null) {
    const camera = id ? equipmentData.cameras.find(c => c.id === id) : null;
    const title = camera ? 'Edit Camera' : 'New Camera';
    
    const modalContent = `
        <form id="cameraForm" class="form row g-3">
            <div class="col-md-6">
                <label for="camera-name" class="form-label">Name *</label>
                <input type="text" class="form-control" id="camera-name" name="name" value="${escapeHtml(camera?.name || '')}" required>
            </div>
            <div class="col-md-6">
                <label for="camera-manufacturer" class="form-label">Manufacturer *</label>
                <input type="text" class="form-control" id="camera-manufacturer" name="manufacturer" value="${escapeHtml(camera?.manufacturer || '')}" required>
            </div>
            <div class="col-md-6">
                <label for="camera-sensor-type" class="form-label">Sensor Type *</label>
                <select class="form-select" id="camera-sensor-type" name="sensor_type" required>
                    <option value="CMOS Color" ${camera?.sensor_type === 'CMOS Color' ? 'selected' : ''}>CMOS Color</option>
                    <option value="CMOS Mono" ${camera?.sensor_type === 'CMOS Mono' ? 'selected' : ''}>CMOS Mono</option>
                    <option value="CCD Color" ${camera?.sensor_type === 'CCD Color' ? 'selected' : ''}>CCD Color</option>
                    <option value="CCD Mono" ${camera?.sensor_type === 'CCD Mono' ? 'selected' : ''}>CCD Mono</option>
                </select>
            </div>
            <div class="col-md-6">
                <label for="camera-pixel-size" class="form-label">Pixel Size (µm) *</label>
                <input type="number" class="form-control" id="camera-pixel-size" name="pixel_size_um" value="${camera?.pixel_size_um || ''}" required min="1" max="10" step="0.01">
            </div>
            <div class="col-md-6">
                <label for="camera-sensor-width" class="form-label">Sensor Width (mm) *</label>
                <input type="number" class="form-control" id="camera-sensor-width" name="sensor_width_mm" value="${camera?.sensor_width_mm || ''}" required min="1" max="100" step="0.1">
            </div>
            <div class="col-md-6">
                <label for="camera-sensor-height" class="form-label">Sensor Height (mm) *</label>
                <input type="number" class="form-control" id="camera-sensor-height" name="sensor_height_mm" value="${camera?.sensor_height_mm || ''}" required min="1" max="100" step="0.1">
            </div>
            <div class="col-md-6">
                <label for="camera-resolution-width" class="form-label">Resolution Width (px) *</label>
                <input type="number" class="form-control" id="camera-resolution-width" name="resolution_width_px" value="${camera?.resolution_width_px || ''}" required min="640" max="16000">
            </div>
            <div class="col-md-6">
                <label for="camera-resolution-height" class="form-label">Resolution Height (px) *</label>
                <input type="number" class="form-control" id="camera-resolution-height" name="resolution_height_px" value="${camera?.resolution_height_px || ''}" required min="480" max="12000">
            </div>
            <div class="col-md-6">
                <label for="camera-cooling-supported" class="form-label">Cooling Supported</label>
                <select class="form-select" id="camera-cooling-supported" name="cooling_supported">
                    <option value="false" ${camera?.cooling_supported === false ? 'selected' : ''}>No</option>
                    <option value="true" ${camera?.cooling_supported === true ? 'selected' : ''}>Yes</option>
                </select>
            </div>
            <div class="col-md-6">
                <label for="camera-min-temperature" class="form-label">Min Temperature (°C)</label>
                <input type="number" class="form-control" id="camera-min-temperature" name="min_temperature_c" value="${camera?.min_temperature_c || ''}" min="-50" max="0">
            </div>
            <div class="col-md-6">
                <label for="camera-weight" class="form-label">Weight (kg)</label>
                <input type="number" class="form-control" id="camera-weight" name="weight_kg" value="${camera?.weight_kg || ''}" min="0" max="50" step="0.1">
            </div>
            <div class="col-md-12">
                <label for="camera-notes" class="form-label">Notes</label>
                <textarea class="form-control" id="camera-notes" name="notes" rows="2">${escapeHtml(camera?.notes || '')}</textarea>
            </div>
            <div class="text-end mt-3">
                <button type="submit" class="btn btn-primary">Save</button>
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
        renderCombinationsTab();
        showMessage('success', id ? 'Camera updated' : 'Camera created');
    } catch (error) {
        console.error('Error saving camera:', error);
        showMessage('error', 'Failed to save camera');
    }
}

// --- Mount Operations ---

async function showMountModal(id = null) {
    const mount = id ? equipmentData.mounts.find(m => m.id === id) : null;
    const title = mount ? 'Edit Mount' : 'New Mount';
    
    const modalContent = `
        <form id="mountForm" class="form row g-3">
            <div class="col-md-6">
                <label for="mount-name" class="form-label">Name *</label>
                <input type="text" class="form-control" id="mount-name" name="name" value="${escapeHtml(mount?.name || '')}" required>
            </div>
            <div class="col-md-6">
                <label for="mount-manufacturer" class="form-label">Manufacturer</label>
                <input type="text" class="form-control" id="mount-manufacturer" name="manufacturer" value="${escapeHtml(mount?.manufacturer || '')}" placeholder="e.g., Sky-Watcher, iOptron, ZWO">
            </div>
           <div class="col-md-6">
                <label for="mount-type" class="form-label">Type *</label>
                <select class="form-select" id="mount-type" name="mount_type" required>
                    <option value="Equatorial" ${mount?.mount_type === 'Equatorial' ? 'selected' : ''}>Equatorial</option>
                    <option value="Alt-Azimuth" ${mount?.mount_type === 'Alt-Azimuth' ? 'selected' : ''}>Alt-Azimuth</option>
                    <option value="Dobsonian" ${mount?.mount_type === 'Dobsonian' ? 'selected' : ''}>Dobsonian</option>
                    <option value="Fork Mount" ${mount?.mount_type === 'Fork Mount' ? 'selected' : ''}>Fork Mount</option>
                </select>
            </div>
            <div class="col-md-6">
                <label for="mount-payload-capacity" class="form-label">Payload Capacity (kg) *</label>
                <input type="number" class="form-control" id="mount-payload-capacity" name="payload_capacity_kg" value="${mount?.payload_capacity_kg || ''}" required min="0.1" max="100" step="0.1">
            </div>
            <div class="col-md-6">
                <label for="mount-tracking-accuracy" class="form-label">Tracking Accuracy (arcsec)</label>
                <input type="number" class="form-control" id="mount-tracking-accuracy" name="tracking_accuracy_arcsec" value="${mount?.tracking_accuracy_arcsec || ''}" min="0.1" max="10" step="0.1">
            </div>
            <div class="col-md-6">
                <label for="mount-guiding-supported" class="form-label">Guiding Support</label>
                <select class="form-select" id="mount-guiding-supported" name="guiding_supported">
                    <option value="false" ${mount?.guiding_supported === false ? 'selected' : ''}>No</option>
                    <option value="true" ${mount?.guiding_supported === true ? 'selected' : ''}>Yes</option>
                </select>
            </div>
            <div class="col-md-12">
                <label for="mount-notes" class="form-label">Notes</label>
                <textarea class="form-control" id="mount-notes" name="notes" rows="2">${escapeHtml(mount?.notes || '')}</textarea>
            </div>
            <div class="text-end mt-3">
                <button type="submit" class="btn btn-primary">Save</button>
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
        showMessage('success', id ? 'Mount updated' : 'Mount created');
    } catch (error) {
        console.error('Error saving mount:', error);
        showMessage('error', 'Failed to save mount');
    }
}

// --- Filter Operations ---

async function showFilterModal(id = null) {
    const filter = id ? equipmentData.filters.find(f => f.id === id) : null;
    const title = filter ? 'Edit Filter' : 'New Filter';
    
    const modalContent = `
        <form id="filterForm" class="form row g-3">
            <div class="col-md-6">
                <label for="filter-name" class="form-label">Name *</label>
                <input type="text" class="form-control" id="filter-name" name="name" value="${escapeHtml(filter?.name || '')}" required>
            </div>
            <div class="col-md-6">
                <label for="filter-manufacturer" class="form-label">Manufacturer</label>
                <input type="text" class="form-control" id="filter-manufacturer" name="manufacturer" value="${escapeHtml(filter?.manufacturer || '')}" placeholder="e.g., Baader, Optolong, Antlia">
            </div>
            <div class="col-md-12">
                <label for="filter-type" class="form-label">Type *</label>
                <select class="form-select" id="filter-type" name="filter_type" required>
                    <option value="LRGB" ${filter?.filter_type === 'LRGB' ? 'selected' : ''}>LRGB</option>
                    <option value="Narrowband" ${filter?.filter_type === 'Narrowband' ? 'selected' : ''}>Narrowband</option>
                    <option value="Broadband" ${filter?.filter_type === 'Broadband' ? 'selected' : ''}>Broadband</option>
                    <option value="Luminance" ${filter?.filter_type === 'Luminance' ? 'selected' : ''}>Luminance</option>
                    <option value="RGB" ${filter?.filter_type === 'RGB' ? 'selected' : ''}>RGB</option>
                    <option value="H-Alpha" ${filter?.filter_type === 'H-Alpha' ? 'selected' : ''}>H-Alpha</option>
                    <option value="OIII" ${filter?.filter_type === 'OIII' ? 'selected' : ''}>OIII</option>
                    <option value="SII" ${filter?.filter_type === 'SII' ? 'selected' : ''}>SII</option>
                    <option value="UHC" ${filter?.filter_type === 'UHC' ? 'selected' : ''}>UHC</option>
                    <option value="Light Pollution Reduction" ${filter?.filter_type === 'Light Pollution Reduction' ? 'selected' : ''}>LPR</option>
                    <option value="Solar" ${filter?.filter_type === 'Solar' ? 'selected' : ''}>Solar</option>
                    <option value="Other" ${filter?.filter_type === 'Other' ? 'selected' : ''}>Other</option>
                </select>
            </div>
            <div class="col-md-6">
                <label for="filter-wavelength" class="form-label">Wavelength (nm)</label>
                <input type="number" class="form-control" id="filter-wavelength" name="central_wavelength_nm" value="${filter?.central_wavelength_nm || ''}" min="300" max="2000">
            </div>
            <div class="col-md-6">
                <label for="filter-bandwidth" class="form-label">Bandwidth (nm)</label>
                <input type="number" class="form-control" id="filter-bandwidth" name="bandwidth_nm" value="${filter?.bandwidth_nm || ''}" min="1" max="1000">
            </div>
            <div class="col-md-12">
                <label for="filter-intended-use" class="form-label">Intended Use</label>
                <input type="text" class="form-control" id="filter-intended-use" name="intended_use" value="${escapeHtml(filter?.intended_use || '')}" placeholder="e.g., Emission nebulae, Broadband imaging">
            </div>
            <div class="col-md-12">
                <label for="filter-notes" class="form-label">Notes</label>
                <textarea class="form-control" id="filter-notes" name="notes" rows="2">${escapeHtml(filter?.notes || '')}</textarea>
            </div>
            <div class="text-end mt-3">
                <button type="submit" class="btn btn-primary">Save</button>
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
        showMessage('success', id ? 'Filter updated' : 'Filter created');
    } catch (error) {
        console.error('Error saving filter:', error);
        showMessage('error', 'Failed to save filter');
    }
}

// --- Accessory Operations ---

async function showAccessoryModal(id = null) {
    const accessory = id ? equipmentData.accessories.find(a => a.id === id) : null;
    const title = accessory ? 'Edit Accessory' : 'New Accessory';
    
    const modalContent = `
        <form id="accessoryForm" class="form">
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label for="accessory-name" class="form-label">Name *</label>
                    <input type="text" class="form-control" id="accessory-name" name="name" value="${escapeHtml(accessory?.name || '')}" required>
                </div>
                <div class="col-md-6 mb-3">
                    <label for="accessory-manufacturer" class="form-label">Manufacturer</label>
                    <input type="text" class="form-control" id="accessory-manufacturer" name="manufacturer" value="${escapeHtml(accessory?.manufacturer || '')}">
                </div>
            </div>
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label for="accessory-type" class="form-label">Type *</label>
                    <input type="text" class="form-control" id="accessory-type" name="accessory_type" value="${escapeHtml(accessory?.accessory_type || '')}" required placeholder="e.g., Field Flattener, Focuser, Filter Wheel">
                </div>
                <div class="col-md-6 mb-3">
                    <label for="accessory-weight" class="form-label">Weight (kg)</label>
                    <input type="number" class="form-control" id="accessory-weight" name="weight_kg" value="${accessory?.weight_kg || ''}" min="0" max="50" step="0.1">
                </div>
            </div>
            <div class="mb-3">
                <label for="accessory-notes" class="form-label">Notes</label>
                <textarea class="form-control" id="accessory-notes" name="notes" rows="2">${escapeHtml(accessory?.notes || '')}</textarea>
            </div>
            <div class="text-end mt-3">
                <button type="submit" class="btn btn-primary">Save</button>
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
        showMessage('success', id ? 'Accessory updated' : 'Accessory created');
    } catch (error) {
        console.error('Error saving accessory:', error);
        showMessage('error', 'Failed to save accessory');
    }
}

// --- Combination Operations ---

async function showCombinationModal(id = null) {
    const combination = id ? equipmentData.combinations.find(c => c.id === id) : null;
    const title = combination ? 'Edit Combination' : 'New Combination';
    
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
                <label for="combination-telescope" class="form-label">Telescope (optional)</label>
                <select class="form-select" id="combination-telescope" name="telescope_id">
                    <option value="">None</option>
                    ${telescopes.map(t => `<option value="${t.id}" ${combination?.telescope_id === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
                </select>
            </div>
            <div class="mb-3">
                <label for="combination-camera" class="form-label">Camera (optional)</label>
                <select class="form-select" id="combination-camera" name="camera_id">
                    <option value="">None</option>
                    ${cameras.map(c => `<option value="${c.id}" ${combination?.camera_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
                </select>
            </div>
            <div class="mb-3">
                <label for="combination-mount" class="form-label">Mount (optional)</label>
                <select class="form-select" id="combination-mount" name="mount_id">
                    <option value="">None</option>
                    ${mounts.map(m => `<option value="${m.id}" ${combination?.mount_id === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
                </select>
            </div>
            <div class="mb-3">
                <label for="combination-filters" class="form-label">Filters (optional)</label>
                <div class="checkbox-popup-box overflow-y-auto rounded" id="combination-filters">
                    ${filters.length === 0 ? '<div class="alert alert-info fw-light"><b>No filters available.</b> Please add filters to create combinations.</div>' : ''}
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
                <label for="combination-accessories" class="form-label">Accessories (optional)</label>
                <div class="checkbox-popup-box overflow-y-auto rounded" id="combination-accessories">
                    ${accessories.length === 0 ? '<div class="alert alert-info fw-light"><b>No accessories available.</b> Please add accessories to create combinations.</div>' : ''}
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
                <label for="combination-notes" class="form-label">Notes</label>
                <textarea class="form-control" id="combination-notes" name="notes" rows="2">${escapeHtml(combination?.notes || '')}</textarea>
            </div>
            <div class="text-end mt-3">
                <button type="submit" class="btn btn-primary">Save</button>
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
        showMessage('success', id ? 'Combination updated' : 'Combination created');
    } catch (error) {
        console.error('Error saving combination:', error);
        showMessage('error', 'Failed to save combination');
    }
}

// ============================================
// Analysis
// ============================================

// ============================================
// Delete Equipment
// ============================================

async function deleteEquipment(type, id) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
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
            renderCombinationsTab();
        } else if (type === 'cameras') {
            renderCamerasTab();
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
        
        showMessage('success', 'Item deleted');
    } catch (error) {
        console.error('Error deleting equipment:', error);
        showMessage('error', 'Failed to delete item');
    }
}

// Initialize when module loads
document.addEventListener('DOMContentLoaded', initializeEquipment);
