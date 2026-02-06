// Astrodex functionality
// Pokédex-style collection system for astrophotography objects

let astrodexData = {
    items: [],
    stats: {}
};

let currentAstrodexItem = null;
let astrodexFilters = {
    search: '',
    type: 'all',
    hasPhotos: 'all',
    sortBy: 'name',
    sortOrder: 'asc'
};

// ============================================
// Helper Functions
// ============================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeForJs(text) {
    // Escape for JavaScript string context (single and double quotes, backslashes, etc.)
    return text.replace(/\\/g, '\\\\')
               .replace(/'/g, "\\'")
               .replace(/"/g, '\\"')
               .replace(/\n/g, '\\n')
               .replace(/\r/g, '\\r');
}

function formatDate(dateString) {
    // Format date from YYYY-MM-DD to DD/MM/YYYY
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// ============================================
// Astrodex Data Loading
// ============================================

async function loadAstrodex() {
    try {
        const response = await fetchJSON('/api/astrodex');
        astrodexData.items = response.items || [];
        astrodexData.stats = response.stats || {};
        
        renderAstrodexView();
    } catch (error) {
        console.error('Error loading astrodex:', error);
        showMessage('error', 'Failed to load Astrodex');
    }
}

// ============================================
// Astrodex Rendering
// ============================================

function renderAstrodexView() {
    const container = document.getElementById('astrodex-content');
    if (!container) return;
    
    // Render stats
    renderAstrodexStats();
    
    // Apply filters and sorting
    const filteredItems = filterAndSortAstrodexItems();
    
    // Render items grid
    renderAstrodexGrid(filteredItems);
}

function renderAstrodexStats() {
    const statsContainer = document.getElementById('astrodex-stats');
    if (!statsContainer) return;
    
    const stats = astrodexData.stats;
    statsContainer.innerHTML = `
        <div class="col">
            <div class="card h-100">
                <div class="card-body text-center">
                    <div class="astrodex-insight-value text-primary">${stats.total_items || 0}</div>
                    <div class="fw-light fst-italic">Total Objects</div>
                </div>
            </div>
        </div>
        <div class="col">
            <div class="card h-100">
                <div class="card-body text-center">
                    <div class="astrodex-insight-value text-primary">${stats.items_with_pictures || 0}</div>
                    <div class="fw-light fst-italic">With Photos</div>
                </div>
            </div>
        </div>
        <div class="col">
            <div class="card h-100">
                <div class="card-body text-center">
                    <div class="astrodex-insight-value text-primary">${stats.total_pictures || 0}</div>
                    <div class="fw-light fst-italic">Total Photos</div>
                </div>
            </div>
        </div>
        <div class="col">
            <div class="card h-100">
                <div class="card-body text-center">
                    <div class="astrodex-insight-value text-primary">${Object.keys(stats.types || {}).length}</div>
                    <div class="fw-light fst-italic">Object Types</div>
                </div>
            </div>
        </div>
    `;
}

function renderAstrodexGrid(items) {
    const gridContainer = document.getElementById('astrodex-grid');
    if (!gridContainer) return;
    
    if (items.length === 0) {
        gridContainer.innerHTML = `
            <div class="col">
                <div class="card h-100">
                    <div class="card-body text-center">
                        <b>📚 Your Astrodex is empty</b><br>
                        Start adding celestial objects you've captured!
                    </div>
                    <div class="card-footer text-center">
                        <button class="btn btn-outline-primary" data-action="add-astrodex-item">
                            ➕ Add First Object
                        </button>
                    </div>
                </div>
            </div>
        `;
        return;
    }
    
    gridContainer.innerHTML = items.map(item => {
        const mainPicture = getMainPicture(item);
        const imageUrl = mainPicture 
            ? `/api/astrodex/images/${mainPicture.filename}`
            : '/static/default_astro_object.svg';
        
        const photoCount = item.pictures ? item.pictures.length : 0;
        
        // Escape values for safe HTML insertion
        const escapedName = escapeHtml(item.name);
        const escapedImageUrl = escapeHtml(imageUrl);
        const escapedId = escapeHtml(item.id);
        
        // Escape for JavaScript context
        const jsEscapedName = escapeForJs(item.name);
        const jsEscapedImageUrl = escapeForJs(imageUrl);
        const jsEscapedId = escapeForJs(item.id);
        
        return `
            <div class="col mb-3">
                <div class="card h-100">
                    <div class="astrodex-card-image rounded" data-item-id="${jsEscapedId}" tabindex="0" role="button" aria-label="View ${escapedName} photos" style="cursor: pointer;" title="Click to view photos">
                        <img src="${escapedImageUrl}" alt="${escapedName}" loading="lazy" class="card-img-top">
                        ${photoCount > 0 ? `<div class="photo-badge">${photoCount} 📷</div>` : ''}
                    </div>
                    <div class="card-body astrodex-card-body" data-item-id="${jsEscapedId}" tabindex="0" role="button" aria-label="View ${escapedName} details" style="cursor: pointer;">
                        <div class="astrodex-card-title">${escapedName}</div>
                        <div class="astrodex-card-type">${escapeHtml(item.type || 'Unknown')}</div>
                        ${item.constellation ? `<div class="astrodex-card-constellation">📍 ${escapeHtml(item.constellation)}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getMainPicture(item) {
    if (!item.pictures || item.pictures.length === 0) {
        return null;
    }
    
    // Find main picture
    for (const picture of item.pictures) {
        if (picture.is_main) {
            return picture;
        }
    }
    
    // If no main picture is set, return first picture
    return item.pictures[0];
}

// ============================================
// Filtering and Sorting
// ============================================

function filterAndSortAstrodexItems() {
    let items = [...astrodexData.items];
    
    // Apply search filter
    if (astrodexFilters.search) {
        const searchLower = astrodexFilters.search.toLowerCase();
        items = items.filter(item => 
            item.name.toLowerCase().includes(searchLower) ||
            (item.type && item.type.toLowerCase().includes(searchLower)) ||
            (item.constellation && item.constellation.toLowerCase().includes(searchLower))
        );
    }
    
    // Apply type filter
    if (astrodexFilters.type !== 'all') {
        items = items.filter(item => item.type === astrodexFilters.type);
    }
    
    // Apply photo filter
    if (astrodexFilters.hasPhotos === 'yes') {
        items = items.filter(item => item.pictures && item.pictures.length > 0);
    } else if (astrodexFilters.hasPhotos === 'no') {
        items = items.filter(item => !item.pictures || item.pictures.length === 0);
    }
    
    // Apply sorting
    items.sort((a, b) => {
        let compareA, compareB;
        
        switch (astrodexFilters.sortBy) {
            case 'name':
                compareA = a.name.toLowerCase();
                compareB = b.name.toLowerCase();
                break;
            case 'type':
                compareA = (a.type || '').toLowerCase();
                compareB = (b.type || '').toLowerCase();
                break;
            case 'date':
                compareA = new Date(a.created_at || 0);
                compareB = new Date(b.created_at || 0);
                break;
            case 'photos':
                compareA = a.pictures ? a.pictures.length : 0;
                compareB = b.pictures ? b.pictures.length : 0;
                break;
            default:
                return 0;
        }
        
        if (compareA < compareB) return astrodexFilters.sortOrder === 'asc' ? -1 : 1;
        if (compareA > compareB) return astrodexFilters.sortOrder === 'asc' ? 1 : -1;
        return 0;
    });
    
    return items;
}

function updateAstrodexFilter(filterName, value) {
    astrodexFilters[filterName] = value;
    renderAstrodexView();
}

// ============================================
// Add Item to Astrodex
// ============================================

async function addToAstrodex(itemData) {
    try {
        const response = await fetchJSON('/api/astrodex/items', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(itemData)
        });
        
        if (response.status === 'success') {
            // No alert on success - just redirect to item
            await loadAstrodex();
            
            // Update catalogue badges if the function exists (from app.js)
            if (typeof updateCatalogueCapturedBadge === 'function') {
                updateCatalogueCapturedBadge(itemData.name, true);
            }
            
            return true;
        } else {
            showMessage('error', response.error || 'Failed to add item');
            return false;
        }
    } catch (error) {
        console.error('Error adding to astrodex:', error);
        if (error.message && error.message.includes('already exists')) {
            showMessage('warning', 'This object is already in your Astrodex');
        } else {
            showMessage('error', 'Failed to add to Astrodex');
        }
        return false;
    }
}

async function addFromCatalogue(catalogueItem) {
    // Extract item name from catalogue data
    const itemName = catalogueItem.id || catalogueItem['target name'] || catalogueItem.name;
    
    if (!itemName) {
        showMessage('error', 'Invalid item data');
        return;
    }
    
    // Detect type properly - check for comet designation patterns
    let itemType = catalogueItem.type || catalogueItem.targettype || 'Unknown';
    
    // If type is still Unknown, try to detect from catalogue or name patterns
    if (itemType === 'Unknown' || !itemType) {
        const catalogue = catalogueItem.catalogue || currentCatalogueTab || '';
        const catalogueLower = catalogue.toLowerCase();
        
        // Force comet type if from comets catalogue
        if (catalogueLower.includes('comet')) {
            itemType = 'Comet';
        } else if (itemName.match(/^C\/\d{4}\s+[A-Z]\d+/i) || itemName.match(/^\d+P\//i)) {
            // Comet designation like C/2023 A1 or 24P/Schaumasse
            itemType = 'Comet';
        }
    }
    
    const itemData = {
        name: itemName,
        type: itemType,
        catalogue: catalogueItem.catalogue || currentCatalogueTab || '',
        constellation: catalogueItem.constellation || catalogueItem.const || ''
    };
    
    const success = await addToAstrodex(itemData);
    
    // On success, switch to Astrodex tab and show the item detail
    if (success) {
        switchMainTab('astrodex');
        // Wait for tab to switch and data to reload
        await new Promise(resolve => {
            const checkInterval = setInterval(() => {
                const addedItem = astrodexData.items.find(item => item.name === itemName);
                if (addedItem) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 50);
            // Timeout after 2 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
            }, 2000);
        });
        
        const addedItem = astrodexData.items.find(item => item.name === itemName);
        if (addedItem) {
            showAstrodexItemDetail(addedItem.id);
        }
    }
}

function showAddAstrodexItemModal() {
    //console.log("Opening Add to Astrodex modal");

    closeModal(); // Close any existing modal to avoid stacking

    createModal('Add to Astrodex', `
        <form id="add-astrodex-form" class="form">
            <div class="row mb-3">
                <label for="item-name" class="col-sm-3 col-form-label fw-bold">Object Name *</label>
                <div class="col-sm-9">
                    <input type="text" id="item-name" class="form-control" required>
                </div>
            </div>
            <div class="row mb-3">
                <label for="item-type" class="col-sm-3 col-form-label fw-bold">Type</label>
                <div class="col-sm-9">
                    <select id="item-type" class="form-control">
                        <option value="Galaxy">Galaxy</option>
                        <option value="Nebula">Nebula</option>
                        <option value="Planetary Nebula">Planetary Nebula</option>
                        <option value="Star Cluster">Star Cluster</option>
                        <option value="Open Cluster">Open Cluster</option>
                        <option value="Globular Cluster">Globular Cluster</option>
                        <option value="Planet">Planet</option>
                        <option value="Moon">Moon</option>
                        <option value="Sun">Sun</option>
                        <option value="Comet">Comet</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
            </div>            
            <div class="row mb-3">
                <label for="item-constellation" class="col-sm-3 col-form-label fw-bold">Constellation</label>
                <div class="col-sm-9">
                    <input type="text" id="item-constellation" class="form-control">
                </div>
            </div>
            <div class="row mb-3">
                <label for="item-notes" class="col-sm-3 col-form-label fw-bold">Notes</label>
                <div class="col-sm-9">
                    <textarea id="item-notes" class="form-control" rows="3"></textarea>
                </div>
            </div>
            <div class="text-end">
                <button type="submit" class="btn btn-primary">Add to Astrodex</button>
            </div>
        </form>
    `, 'lg');
    
    document.getElementById('add-astrodex-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const itemData = {
            name: document.getElementById('item-name').value,
            type: document.getElementById('item-type').value,
            constellation: document.getElementById('item-constellation').value,
            notes: document.getElementById('item-notes').value
        };
        
        const success = await addToAstrodex(itemData);
        if (success) {
            closeModal();
        }
    });

    // Show the modal
    const bs_modal = new bootstrap.Modal('#modal_lg_close', {
        backdrop: 'static', 
        focus: true,
        keyboard: true
    }); 
    bs_modal.show();

    // Event listener when modal is closed
    document.getElementById('modal_lg_close').addEventListener('hidden.bs.modal', () => {
        // Remove previous event listeners to prevent duplicates
        const form = document.getElementById('add-astrodex-form');
        if (form) {
            form.removeEventListener('submit', async (e) => {
                e.preventDefault();
            });
        }

        //Remove self listener to prevent duplicates if modal is opened again
        document.getElementById('modal_lg_close').removeEventListener('hidden.bs.modal', () => {});
    });
}

// ============================================
// Item Detail View
// ============================================

async function showAstrodexItemDetail(itemId) { 
    const item = astrodexData.items.find(i => i.id === itemId);
    if (!item) return;
    
    currentAstrodexItem = item;
    
    const mainPicture = getMainPicture(item);
    const imageUrl = mainPicture 
        ? `/api/astrodex/images/${mainPicture.filename}`
        : '/static/default_astro_object.svg';
    
    // Escape values for safe HTML insertion
    const escapedName = escapeHtml(item.name);
    const escapedImageUrl = escapeHtml(imageUrl);
    
    // Escape for JavaScript context
    const jsEscapedName = escapeForJs(item.name);
    const jsEscapedImageUrl = escapeForJs(imageUrl);
    
    const modal = createModal(item.name, `                    
        <h3>Object Information</h3>
        <form id="edit-item-form-${item.id}">
            <div class="row mb-3">
                <label for="edit-type-${item.id}" class="col-sm-2 col-form-label fw-bold">Type</label>
                <div class="col-sm-10">
                    <select id="edit-type-${item.id}" class="form-control" data-action="update-field" data-item-id="${item.id}" data-field="type">
                        <option value="Galaxy" ${item.type === 'Galaxy' ? 'selected' : ''}>Galaxy</option>
                        <option value="Nebula" ${item.type === 'Nebula' ? 'selected' : ''}>Nebula</option>
                        <option value="Planetary Nebula" ${item.type === 'Planetary Nebula' ? 'selected' : ''}>Planetary Nebula</option>
                        <option value="Star Cluster" ${item.type === 'Star Cluster' ? 'selected' : ''}>Star Cluster</option>
                        <option value="Open Cluster" ${item.type === 'Open Cluster' ? 'selected' : ''}>Open Cluster</option>
                        <option value="Globular Cluster" ${item.type === 'Globular Cluster' ? 'selected' : ''}>Globular Cluster</option>
                        <option value="Planet" ${item.type === 'Planet' ? 'selected' : ''}>Planet</option>
                        <option value="Moon" ${item.type === 'Moon' ? 'selected' : ''}>Moon</option>
                        <option value="Comet" ${item.type === 'Comet' ? 'selected' : ''}>Comet</option>
                        <option value="Sun" ${item.type === 'Sun' ? 'selected' : ''}>Sun</option>
                        <option value="Other" ${item.type === 'Other' ? 'selected' : ''}>Other</option>
                        <option value="Unknown" ${item.type === 'Unknown' || !item.type ? 'selected' : ''}>Unknown</option>
                    </select>
                </div>
            </div>

            <div class="row mb-3">
                <label for="catalogue-${item.id}" class="col-sm-2 col-form-label fw-bold">Catalogue</label>
                <div class="col-sm-10">
                    <input type="text" id="catalogue-${item.id}" class="form-control" value="${escapeHtml(item.catalogue || '')}" data-field="catalogue" readonly>
                </div>
            </div>

            <div class="row mb-3">
                <label for="edit-constellation-${item.id}" class="col-sm-2 col-form-label fw-bold">Constellation</label>
                <div class="col-sm-10">
                    <input type="text" id="edit-constellation-${item.id}" class="form-control" value="${escapeHtml(item.constellation || '')}" data-action="update-field" data-item-id="${item.id}" data-field="constellation" placeholder="Optional">
                </div>
            </div>

            <div class="row mb-3">
                <label for="edit-notes-${item.id}" class="col-sm-2 col-form-label fw-bold">Notes</label>
                <div class="col-sm-10">
                    <textarea id="edit-notes-${item.id}" class="form-control" rows="3" data-action="update-field" data-item-id="${item.id}" data-field="notes" placeholder="Add your notes...">${escapeHtml(item.notes || '')}</textarea>
                </div>
            </div>
        </form>

        <div class="mt-3 mb-3 text-end">
            <button class="btn btn-sm btn-primary me-3" data-action="add-picture" data-item-id="${item.id}">📷 Add Photo</button>
            <button class="btn btn-sm btn-danger" data-action="delete-item" data-item-id="${item.id}">🗑️ Remove</button>
        </div>

        <h3>Photos (${item.pictures ? item.pictures.length : 0})</h3>
        <div class="astrodex-pictures row row-cols-2 row-cols-md-4 g-4">
            ${renderPicturesGrid(item)}
        </div>

    `, 'xl');

    // Show the modal
    const bs_modal = new bootstrap.Modal('#modal_xl_close', {
        backdrop: 'static',
        focus: true,
        keyboard: true
    });
    bs_modal.show();
}

function renderPicturesGrid(item) {
    if (!item.pictures || item.pictures.length === 0) {
        return `
            <div class="col">
                <div class="card h-100">
                    <div class="card-body text-center">
                        <p>No photos yet</p>
                        <button class="btn btn-primary" data-action="add-picture" data-item-id="${item.id}">Add First Photo</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    return item.pictures.map(picture => {
        // Escape values for safe HTML insertion
        const escapedName = escapeHtml(item.name);
        const imageUrl = `/api/astrodex/images/${picture.filename}`;
        const escapedImageUrl = escapeHtml(imageUrl);
        
        // Escape for JavaScript context
        const jsEscapedName = escapeForJs(item.name);
        const jsEscapedImageUrl = escapeForJs(imageUrl);
        
        return `
            <div class="col">
                <div class="card h-100">
                    <div class="astrodex-card-image-no-hover rounded">
                        <img src="${escapedImageUrl}" class="card-img-top" alt="Photo" >
                        ${picture.is_main ? '<div class="main-badge">⭐ Main</div>' : ''}
                    </div>
                    <div class="card-body">
                        <p class="card-text">
                            ${picture.date ? `<div>📅 ${escapeHtml(formatDate(picture.date))}</div>` : ''}
                            ${picture.exposition_time ? `<div>⏱️ ${escapeHtml(picture.exposition_time)}</div>` : ''}
                            ${picture.device ? `<div>🔭 ${escapeHtml(picture.device)}</div>` : ''}
                        </p>
                    </div>
                    <div class="card-footer text-center">
                        ${!picture.is_main ? `<button class="btn btn-outline-light" data-action="set-main-picture" data-item-id="${escapeForJs(item.id)}" data-picture-id="${escapeForJs(picture.id)}" title="Set as main">⭐</button>` : '<span class="btn-icon-placeholder"></span>'}
                        <button class="btn btn-outline-light" data-action="edit-picture" data-item-id="${escapeForJs(item.id)}" data-picture-id="${escapeForJs(picture.id)}" title="Edit">✏️</button>
                        <button class="btn btn-danger" data-action="delete-picture" data-item-id="${escapeForJs(item.id)}" data-picture-id="${escapeForJs(picture.id)}" title="Delete">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// Picture Management
// ============================================

function showAddPictureModal(itemId) {
    closeModal(); // Close current modal to avoid stacking

    // Get current date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Get autocomplete suggestions from user's previous photos
    const allPictures = [];
    astrodexData.items.forEach(item => {
        if (item.pictures) {
            allPictures.push(...item.pictures);
        }
    });
    
    // Extract unique values for autocomplete
    const devices = [...new Set(allPictures.map(p => p.device).filter(d => d))];
    const filters = [...new Set(allPictures.map(p => p.filters).filter(f => f))];
    const isos = [...new Set(allPictures.map(p => p.iso).filter(i => i))];
    
    // Create datalist options
    const deviceOptions = devices.map(d => `<option value="${escapeHtml(d)}">`).join('');
    const filterOptions = filters.map(f => `<option value="${escapeHtml(f)}">`).join('');
    const isoOptions = isos.map(i => `<option value="${escapeHtml(i)}">`).join('');
    
    createModal('Add Photo', `
        <form id="add-picture-form" class="form">
            <div class="row mb-3">
                <label for="picture-file" class="col-sm-3 col-form-label">Image File *</label>
                <div class="col-sm-9">
                    <input type="file" class="form-control" id="picture-file" accept="image/*" required>
                </div>
            </div>
            <div class="row mb-3">
                <label for="picture-date" class="col-sm-3 col-form-label">Observation Date</label>
                <div class="col-sm-9">
                    <input type="date" class="form-control" id="picture-date" value="${today}">
                </div>
            </div>
            <div class="row mb-3">
                <label for="picture-exposition" class="col-sm-3 col-form-label">Exposition Time</label>
                <div class="col-sm-9">
                    <input type="text" class="form-control" id="picture-exposition" placeholder="e.g., 120x30s">
                </div>
            </div>
            <div class="row mb-3">
                <label for="picture-device" class="col-sm-3 col-form-label">Device/Telescope</label>
                <div class="col-sm-9">
                    <input type="text" class="form-control" id="picture-device" list="device-list" autocomplete="off">
                    <datalist id="device-list">
                        ${deviceOptions}
                    </datalist>
                </div>
            </div>
            <div class="row mb-3">
                <label for="picture-filters" class="col-sm-3 col-form-label">Filters</label>
                <div class="col-sm-9">
                    <input type="text" class="form-control" id="picture-filters" placeholder="e.g., LRGB, Ha-OIII" list="filters-list" autocomplete="off">
                    <datalist id="filters-list">
                        ${filterOptions}
                    </datalist>
                </div>
            </div>
            <div class="row mb-3">
                <label for="picture-iso" class="col-sm-3 col-form-label">ISO</label>
                <div class="col-sm-9">
                    <input type="text" class="form-control" id="picture-iso" list="iso-list" autocomplete="off">
                    <datalist id="iso-list">
                        ${isoOptions}
                    </datalist>
                </div>
            </div>
            <div class="row mb-3">
                <label for="picture-frames" class="col-sm-3 col-form-label">Number of Frames</label>
                <div class="col-sm-9">
                    <input type="text" class="form-control" id="picture-frames">
                </div>
            </div>
            <div class="row mb-3">
                <label for="picture-notes" class="col-sm-3 col-form-label">Notes</label>
                <div class="col-sm-9">
                    <textarea id="picture-notes" class="form-control" rows="3"></textarea>
                </div>
            </div>
            <div class="form-actions text-end">
                <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
                <button type="submit" class="btn btn-primary">Upload Photo</button>
            </div>
        </form>
    `, 'lg');

    // Open the modal
    const bs_modal = new bootstrap.Modal('#modal_lg_close', {
        backdrop: 'static',
        focus: true,
        keyboard: true
    });
    bs_modal.show();
    
    document.getElementById('add-picture-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await uploadPicture(itemId);
    });    

    // Event listener when modal is closed
    document.getElementById('modal_lg_close').addEventListener('hidden.bs.modal', () => {
        //Remove event listener
        const pictureForm = document.getElementById('add-picture-form');
        if (pictureForm) {
            pictureForm.removeEventListener('submit', async (e) => {
                e.preventDefault();
            });
        }

        //Remove self listener to prevent duplicates if modal is opened again
        document.getElementById('modal_lg_close').removeEventListener('hidden.bs.modal', () => {});
    });
}

async function uploadPicture(itemId) {
    const fileInput = document.getElementById('picture-file');
    const file = fileInput.files[0];
    
    if (!file) {
        showMessage('error', 'Please select an image');
        return;
    }
    
    // Find the submit button and disable it to prevent multiple submissions
    const submitButton = document.querySelector('#add-picture-form button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    
    try {
        // Disable button and show loading state
        submitButton.disabled = true;
        submitButton.textContent = 'Uploading...';
        
        // Upload file first
        const formData = new FormData();
        formData.append('file', file);
        
        const uploadResponse = await fetch('/api/astrodex/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        
        if (!uploadResponse.ok) {
            throw new Error('Upload failed');
        }
        
        const uploadResult = await uploadResponse.json();
        
        // Add picture metadata
        const pictureData = {
            filename: uploadResult.filename,
            date: document.getElementById('picture-date').value,
            exposition_time: document.getElementById('picture-exposition').value,
            device: document.getElementById('picture-device').value,
            filters: document.getElementById('picture-filters').value,
            iso: document.getElementById('picture-iso').value,
            frames: document.getElementById('picture-frames').value,
            notes: document.getElementById('picture-notes').value
        };
        
        const response = await fetchJSON(`/api/astrodex/items/${itemId}/pictures`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(pictureData)
        });
        
        if (response.status === 'success') {
            // No alert on success
            await loadAstrodex();
            closeModal();
            showAstrodexItemDetail(itemId);
            // Modal closes, so no need to re-enable button
        }
    } catch (error) {
        console.error('Error uploading picture:', error);
        showMessage('error', 'Failed to upload photo');
        // Re-enable button on error so user can retry
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
}

async function setMainPicture(itemId, pictureId) {
    try {
        await fetchJSON(`/api/astrodex/items/${itemId}/pictures/${pictureId}/main`, {
            method: 'POST'
        });
        
        // No alert on success
        await loadAstrodex();
        closeModal();
        //showAstrodexItemDetail(itemId);
    } catch (error) {
        console.error('Error setting main picture:', error);
        showMessage('error', 'Failed to update main photo');
    }
}

async function deletePicture(itemId, pictureId) {
    if (window.confirm("Are you sure you want to delete this photo? This action cannot be undone.")) {
        async () => {
            try {
                await fetchJSON(`/api/astrodex/items/${itemId}/pictures/${pictureId}`, {
                    method: 'DELETE'
                });
                
                showMessage('success', 'Photo deleted');
                await loadAstrodex();
                showAstrodexItemDetail(itemId);
            } catch (error) {
                console.error('Error deleting picture:', error);
                showMessage('error', 'Failed to delete photo');
            }
        },
        () => {
            // On cancel, reopen the item detail view
            showAstrodexItemDetail(itemId);
        }
    }
}

// ============================================
// Item Management
// ============================================

async function deleteAstrodexItem(itemId) {
    // Get the item name before deleting
    const item = astrodexData.items.find(i => i.id === itemId);
    const itemName = item ? item.name : null;
    
    
    if (window.confirm("Are you sure you want to remove this object from your Astrodex? This will also delete all associated photos. This action cannot be undone.")) {
        async () => {
            try {
                await fetchJSON(`/api/astrodex/items/${itemId}`, {
                    method: 'DELETE'
                });
                
                showMessage('success', 'Object removed from Astrodex');
                await loadAstrodex();
                
                // Update catalogue badges if the function exists (from app.js)
                if (itemName && typeof updateCatalogueCapturedBadge === 'function') {
                    updateCatalogueCapturedBadge(itemName, false);
                }
                
                closeModal();
            } catch (error) {
                console.error('Error deleting item:', error);
                showMessage('error', 'Failed to remove object');
            }
        },
        () => {
            // On cancel, reopen the item detail view
            showAstrodexItemDetail(itemId);
        }
    }
}

async function updateItemField(itemId, field, value) {
    try {
        const updates = {};
        updates[field] = value;
        
        await fetchJSON(`/api/astrodex/items/${itemId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
        });
        
        // Update local data
        const item = astrodexData.items.find(i => i.id === itemId);
        if (item) {
            item[field] = value;
        }
        
        showMessage('success', 'Updated successfully');
    } catch (error) {
        console.error('Error updating item:', error);
        showMessage('error', 'Failed to update item');
    }
}

function showEditPictureModal(itemId, pictureId) {
    closeModal(); // Close current modal to avoid stacking

    const item = astrodexData.items.find(i => i.id === itemId);
    if (!item) return;
    
    const picture = item.pictures.find(p => p.id === pictureId);
    if (!picture) return;
    
    createModal('Edit Photo', `
        <form id="edit-picture-form" class="form">
            <div class="row mb-3">
                <label for="edit-picture-date" class="col-sm-3 col-form-label">Observation Date</label>
                <div class="col-sm-9">
                    <input type="date" class="form-control" id="edit-picture-date" value="${picture.date || ''}">
                </div>
            </div>
            <div class="row mb-3">
                <label for="edit-picture-exposition" class="col-sm-3 col-form-label">Exposition Time</label>
                <div class="col-sm-9">
                    <input type="text" class="form-control" id="edit-picture-exposition" placeholder="e.g., 120x30s" value="${escapeHtml(picture.exposition_time || '')}">
                </div>
            </div>
            <div class="row mb-3">
                <label for="edit-picture-device" class="col-sm-3 col-form-label">Device/Telescope</label>
                <div class="col-sm-9">
                    <input type="text" class="form-control" id="edit-picture-device" list="device-list" autocomplete="off" value="${escapeHtml(picture.device || '')}">
                </div>
            </div>
            <div class="row mb-3">
                <label for="edit-picture-filters" class="col-sm-3 col-form-label">Filters</label>
                <div class="col-sm-9">
                    <input type="text" class="form-control" id="edit-picture-filters" placeholder="e.g., LRGB, Ha-OIII" list="filters-list" autocomplete="off" value="${escapeHtml(picture.filters || '')}">
                </div>
            </div>
            <div class="row mb-3">
                <label for="edit-picture-iso" class="col-sm-3 col-form-label">ISO</label>
                <div class="col-sm-9">
                    <input type="text" class="form-control" id="edit-picture-iso" list="iso-list" autocomplete="off" value="${escapeHtml(picture.iso || '')}">
                </div>
            </div>
            <div class="row mb-3">
                <label for="edit-picture-frames" class="col-sm-3 col-form-label">Number of Frames</label>
                <div class="col-sm-9">
                    <input type="text" class="form-control" id="edit-picture-frames" value="${escapeHtml(picture.frames || '')}">
                </div>
            </div>
            <div class="row mb-3">
                <label for="edit-picture-notes" class="col-sm-3 col-form-label">Notes</label>
                <div class="col-sm-9">
                    <textarea id="edit-picture-notes" class="form-control" rows="3">${escapeHtml(picture.notes || '')}</textarea>
                </div>
            </div>
            <div class="form-actions text-end">
                <button type="submit" class="btn btn-primary">Save Changes</button>
            </div>
        </form>
    `, 'lg');
    
    // Open the modal
    const bs_modal = new bootstrap.Modal('#modal_lg_close', {
        backdrop: 'static',
        focus: true,
        keyboard: true
    });
    bs_modal.show();

    document.getElementById('edit-picture-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await updatePicture(itemId, pictureId);
    });
       

    // Event listener when modal is closed
    document.getElementById('modal_lg_close').addEventListener('hidden.bs.modal', () => {
        //Remove event listener
        const pictureForm = document.getElementById('edit-picture-form');
        if (pictureForm) {
            pictureForm.removeEventListener('submit', async (e) => {
                e.preventDefault();
            });
        }

        //Remove self listener to prevent duplicates if modal is opened again
        document.getElementById('modal_lg_close').removeEventListener('hidden.bs.modal', () => {});
    });
}

async function updatePicture(itemId, pictureId) {
    try {
        const pictureData = {
            date: document.getElementById('edit-picture-date').value,
            exposition_time: document.getElementById('edit-picture-exposition').value,
            device: document.getElementById('edit-picture-device').value,
            filters: document.getElementById('edit-picture-filters').value,
            iso: document.getElementById('edit-picture-iso').value,
            frames: document.getElementById('edit-picture-frames').value,
            notes: document.getElementById('edit-picture-notes').value
        };
        
        await fetchJSON(`/api/astrodex/items/${itemId}/pictures/${pictureId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(pictureData)
        });
        
        // No alert on success
        await loadAstrodex();
        closeModal();
        showAstrodexItemDetail(itemId);
    } catch (error) {
        console.error('Error updating picture:', error);
        showMessage('error', 'Failed to update photo');
    }
}

function showPictureSlideshow(itemId) {
    const item = astrodexData.items.find(i => i.id === itemId);
    if (!item || !item.pictures || item.pictures.length === 0) {
        // No pictures, do nothing
        return;
    }
    
    let currentIndex = 0;
    let keyHandler = null; // Store the handler reference for cleanup
    let bs_modal = null; // Store bootstrap modal reference
    
    function updateModalContent() {
        const picture = item.pictures[currentIndex];
        const imageUrl = `/api/astrodex/images/${picture.filename}`;
        
        const pictureInfo = `
            <div class="slideshow-info mt-4">
                <div class="row mb-3">
                    <div class="col text-center">
                        <span class="badge bg-primary fs-6">Photo ${currentIndex + 1} of ${item.pictures.length}</span>
                    </div>
                </div>
                <div class="row g-3">
                    ${picture.date ? `
                        <div class="col-md-6">
                            <div class="d-flex align-items-center">
                                <span class="me-2">📅</span>
                                <div>
                                    <small class="text-muted d-block">Observation Date</small>
                                    <strong>${escapeHtml(formatDate(picture.date))}</strong>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    ${picture.exposition_time ? `
                        <div class="col-md-6">
                            <div class="d-flex align-items-center">
                                <span class="me-2">⏱️</span>
                                <div>
                                    <small class="text-muted d-block">Exposition Time</small>
                                    <strong>${escapeHtml(picture.exposition_time)}</strong>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    ${picture.device ? `
                        <div class="col-md-6">
                            <div class="d-flex align-items-center">
                                <span class="me-2">🔭</span>
                                <div>
                                    <small class="text-muted d-block">Device/Telescope</small>
                                    <strong>${escapeHtml(picture.device)}</strong>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    ${picture.filters ? `
                        <div class="col-md-6">
                            <div class="d-flex align-items-center">
                                <span class="me-2">🎨</span>
                                <div>
                                    <small class="text-muted d-block">Filters</small>
                                    <strong>${escapeHtml(picture.filters)}</strong>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    ${picture.iso ? `
                        <div class="col-md-6">
                            <div class="d-flex align-items-center">
                                <span class="me-2">📷</span>
                                <div>
                                    <small class="text-muted d-block">ISO</small>
                                    <strong>${escapeHtml(picture.iso)}</strong>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    ${picture.frames ? `
                        <div class="col-md-6">
                            <div class="d-flex align-items-center">
                                <span class="me-2">🎞️</span>
                                <div>
                                    <small class="text-muted d-block">Frames</small>
                                    <strong>${escapeHtml(picture.frames)}</strong>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
                ${picture.notes ? `
                    <div class="row mt-3">
                        <div class="col">
                            <div class="d-flex align-items-start">
                                <span class="me-2">📝</span>
                                <div>
                                    <small class="text-muted d-block">Notes</small>
                                    <p class="mb-0">${escapeHtml(picture.notes)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        const leftArrow = item.pictures.length > 1 && currentIndex > 0 ? `
            <button type="button" class="btn btn-dark btn-lg slideshow-arrow slideshow-prev position-absolute top-50 start-0 translate-middle-y ms-3" aria-label="Previous photo" style="z-index: 10; opacity: 0.7; border-radius: 50%; width: 50px; height: 50px;">
                <i class="fas fa-chevron-left"></i>
            </button>
        ` : '';
        
        const rightArrow = item.pictures.length > 1 && currentIndex < item.pictures.length - 1 ? `
            <button type="button" class="btn btn-dark btn-lg slideshow-arrow slideshow-next position-absolute top-50 end-0 translate-middle-y me-3" aria-label="Next photo" style="z-index: 10; opacity: 0.7; border-radius: 50%; width: 50px; height: 50px;">
                <i class="fas fa-chevron-right"></i>
            </button>
        ` : '';
        
        const modalContent = `
            <div class="slideshow-body">
                <div class="slideshow-container position-relative text-center mb-4">
                    <img src="${escapeHtml(imageUrl)}" alt="Photo ${currentIndex + 1}" class="slideshow-image img-fluid" style="max-height: 70vh; border-radius: 8px;">
                    ${leftArrow}
                    ${rightArrow}
                </div>
                ${pictureInfo}
            </div>
        `;
        
        // Update the modal content
        const modalBody = document.getElementById('modal_xl_close_body');
        if (modalBody) {
            modalBody.innerHTML = modalContent;
            
            // Re-attach event listeners to navigation buttons
            attachNavigationListeners();
        }
    }
    
    function attachNavigationListeners() {
        if (item.pictures.length <= 1) return;
        
        const prevBtn = document.querySelector('.slideshow-prev');
        const nextBtn = document.querySelector('.slideshow-next');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (currentIndex > 0) {
                    currentIndex--;
                    updateModalContent();
                }
            });
            
            // Add hover effects
            prevBtn.addEventListener('mouseenter', () => {
                prevBtn.style.opacity = '1';
            });
            prevBtn.addEventListener('mouseleave', () => {
                prevBtn.style.opacity = '0.7';
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (currentIndex < item.pictures.length - 1) {
                    currentIndex++;
                    updateModalContent();
                }
            });
            
            // Add hover effects
            nextBtn.addEventListener('mouseenter', () => {
                nextBtn.style.opacity = '1';
            });
            nextBtn.addEventListener('mouseleave', () => {
                nextBtn.style.opacity = '0.7';
            });
        }
    }
    
    function setupKeyboardNavigation() {
        // Remove old keyboard handler if exists
        if (keyHandler) {
            document.removeEventListener('keydown', keyHandler);
        }
        
        // Create and add new keyboard handler
        keyHandler = (e) => {
            if (e.key === 'ArrowLeft' && currentIndex > 0) {
                e.preventDefault();
                currentIndex--;
                updateModalContent();
            } else if (e.key === 'ArrowRight' && currentIndex < item.pictures.length - 1) {
                e.preventDefault();
                currentIndex++;
                updateModalContent();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                if (bs_modal) {
                    bs_modal.hide();
                }
            }
        };
        
        document.addEventListener('keydown', keyHandler);
    }
    
    // Create modal using existing Bootstrap structure
    createModal(`${escapeHtml(item.name)} - Photos`, '', 'xl');
    
    // Show the modal
    bs_modal = new bootstrap.Modal('#modal_xl_close', {
        backdrop: 'static',
        focus: true,
        keyboard: true
    });
    
    // Setup cleanup when modal is hidden
    document.getElementById('modal_xl_close').addEventListener('hidden.bs.modal', function cleanup() {
        // Remove keyboard handler
        if (keyHandler) {
            document.removeEventListener('keydown', keyHandler);
            keyHandler = null;
        }
        
        // Remove this event listener to prevent duplicates
        document.getElementById('modal_xl_close').removeEventListener('hidden.bs.modal', cleanup);
    });
    
    // Initialize content and show modal
    updateModalContent();
    setupKeyboardNavigation();
    bs_modal.show();
}

// ============================================
// Utility Functions
// ============================================

function toggleAstrodexSortOrder() {
    const button = document.getElementById('astrodex-sort-order');
    if (astrodexFilters.sortOrder === 'asc') {
        astrodexFilters.sortOrder = 'desc';
        button.textContent = '⬇️ Descending';
    } else {
        astrodexFilters.sortOrder = 'asc';
        button.textContent = '⬆️ Ascending';
    }
    renderAstrodexView();
}

function createModal(title, content, size = 'lg') {
    //console.log('Creating modal with title:', title);

    //Prepare modal title
    const titleElement = document.getElementById(`modal_${size}_close_title`);
    titleElement.innerHTML = `${title}`;
    
    //Prepare modal content
    const contentElement = document.getElementById(`modal_${size}_close_body`);
    contentElement.innerHTML = `${content}`;
}

function closeModal() {
    //Close all bs modals to prevent stacking
    const modals = document.querySelectorAll('.modal.show');
    modals.forEach(modal => {
        const bs_modal = bootstrap.Modal.getInstance(modal);
        if (bs_modal) {
            bs_modal.hide();
        }
    });

    //Remove any existing close modal event listeners to prevent duplicates
    const closeButtons = document.querySelectorAll('[data-action="close-modal"], [data-action="cleanup-close-modal"]');
    closeButtons.forEach(button => {
        button.removeEventListener('click', handleModalClick);
    });
}

function handleModalClick(event) {

    if (event.target.classList.contains('modal-overlay')) {
        closeModal();
    }
}

// ============================================
// Event Listeners Initialization
// ============================================

function initializeAstrodexEventListeners() {
    // Use event delegation for dynamically created elements
    const astrodexTab = document.getElementById('astrodex-tab');
    if (!astrodexTab) return;
    
    // ============================================
    // Event delegation on document.body for modals and dynamic content
    // ============================================
    
    // Handle clicks on modals and dynamic elements (anywhere in document)
    document.body.addEventListener('click', (e) => {
        const target = e.target;
        const button = target.closest('button');
        
        // Handle buttons with data-action
        if (button) {
            const action = button.getAttribute('data-action');
            const itemId = button.getAttribute('data-item-id');
            const pictureId = button.getAttribute('data-picture-id');
            
            switch(action) {
                case 'close-modal':
                    e.preventDefault();
                    closeModal();
                    break;
                case 'cleanup-close-modal':
                    e.preventDefault();
                    cleanupAndCloseModal();
                    break;
                case 'add-picture':
                    e.preventDefault();
                    showAddPictureModal(itemId);
                    break;
                case 'delete-item':
                    e.preventDefault();
                    deleteAstrodexItem(itemId);
                    break;
                case 'set-main-picture':
                    e.preventDefault();
                    setMainPicture(itemId, pictureId);
                    break;
                case 'edit-picture':
                    e.preventDefault();
                    showEditPictureModal(itemId, pictureId);
                    break;
                case 'delete-picture':
                    e.preventDefault();
                    deletePicture(itemId, pictureId);
                    break;
            }
        }
        
        // Handle modal overlay clicks
        if (target.classList.contains('modal-overlay')) {
            handleModalClick(e);
        }
    });
    
    // ============================================
    // Event delegation on #astrodex-tab for tab-specific content
    // ============================================
    
    // Handle clicks on Astrodex tab
    astrodexTab.addEventListener('click', (e) => {
        const target = e.target;
        const button = target.closest('button');
        const cardImage = target.closest('.astrodex-card-image');
        const cardBody = target.closest('.astrodex-card-body');
        
        // Handle buttons with data-action (tab-specific)
        /*if (button) {
            const action = button.getAttribute('data-action');
            const itemId = button.getAttribute('data-item-id');
            
            switch(action) {
                case 'add-astrodex-item':
                    e.preventDefault();
                    showAddAstrodexItemModal();
                    break;
            }
        }*/
        
        // Handle card image clicks (slideshow)
        if (cardImage && !button) {
            const itemId = cardImage.getAttribute('data-item-id');
            if (itemId) {
                showPictureSlideshow(itemId);
            }
        }
        
        // Handle card body clicks (detail view)
        if (cardBody && !button && !cardImage) {
            const itemId = cardBody.getAttribute('data-item-id');
            if (itemId) {
                showAstrodexItemDetail(itemId);
            }
        }
        
        // Handle picture image clicks in detail view
        if (target.tagName === 'IMG' && target.closest('.astrodex-pictures-grid')) {
            const pictureImg = target.closest('[data-picture-url]');
            if (pictureImg) {
                const name = pictureImg.getAttribute('data-picture-name');
                const url = pictureImg.getAttribute('data-picture-url');
                showImagePopup(name, url);
            }
        }
    });
    
    // Handle keyboard events on Astrodex tab
    astrodexTab.addEventListener('keydown', (e) => {
        const target = e.target;
        
        if (e.key === 'Enter' || e.key === ' ') {
            const cardImage = target.closest('.astrodex-card-image');
            const cardBody = target.closest('.astrodex-card-body');
            const pictureImg = target.closest('[data-picture-url]');
            
            if (cardImage) {
                e.preventDefault();
                const itemId = cardImage.getAttribute('data-item-id');
                if (itemId) showPictureSlideshow(itemId);
            } else if (cardBody) {
                e.preventDefault();
                const itemId = cardBody.getAttribute('data-item-id');
                if (itemId) showAstrodexItemDetail(itemId);
            } else if (pictureImg) {
                e.preventDefault();
                const name = pictureImg.getAttribute('data-picture-name');
                const url = pictureImg.getAttribute('data-picture-url');
                showImagePopup(name, url);
            }
        }
    });
    
    // Handle change events on document.body for modal form fields
    document.body.addEventListener('change', (e) => {
        const target = e.target;
        const action = target.getAttribute('data-action');
        const itemId = target.getAttribute('data-item-id');
        const field = target.getAttribute('data-field');
        
        if (action === 'update-field' && itemId && field) {
            updateItemField(itemId, field, target.value);
        }
    });
    
    // Handle change events on filter/sort controls
    const searchInput = document.getElementById('astrodex-search');
    const typeFilter = document.getElementById('astrodex-type-filter');
    const photoFilter = document.getElementById('astrodex-photo-filter');
    const sortSelect = document.getElementById('astrodex-sort');
    const sortOrderBtn = document.getElementById('astrodex-sort-order');
    const addObjectBtn = document.querySelector('#astrodex-tab .btn-primary[data-action="add-astrodex-item"]');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            updateAstrodexFilter('search', e.target.value);
        });
    }
    
    if (typeFilter) {
        typeFilter.addEventListener('change', (e) => {
            updateAstrodexFilter('type', e.target.value);
        });
    }
    
    if (photoFilter) {
        photoFilter.addEventListener('change', (e) => {
            updateAstrodexFilter('hasPhotos', e.target.value);
        });
    }
    
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            updateAstrodexFilter('sortBy', e.target.value);
        });
    }
    
    if (sortOrderBtn) {
        sortOrderBtn.addEventListener('click', () => {
            toggleAstrodexSortOrder();
        });
    }
    
    if (addObjectBtn) {
        addObjectBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showAddAstrodexItemModal();
        });
    }
}

// Initialize event listeners when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAstrodexEventListeners);
} else {
    initializeAstrodexEventListeners();
}
