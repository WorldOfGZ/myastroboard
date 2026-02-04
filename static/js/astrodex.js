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
        showNotification('Failed to load Astrodex', 'error');
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
        <div class="astrodex-stat-card">
            <div class="stat-value">${stats.total_items || 0}</div>
            <div class="stat-label">Total Objects</div>
        </div>
        <div class="astrodex-stat-card">
            <div class="stat-value">${stats.items_with_pictures || 0}</div>
            <div class="stat-label">With Photos</div>
        </div>
        <div class="astrodex-stat-card">
            <div class="stat-value">${stats.total_pictures || 0}</div>
            <div class="stat-label">Total Photos</div>
        </div>
        <div class="astrodex-stat-card">
            <div class="stat-value">${Object.keys(stats.types || {}).length}</div>
            <div class="stat-label">Object Types</div>
        </div>
    `;
}

function renderAstrodexGrid(items) {
    const gridContainer = document.getElementById('astrodex-grid');
    if (!gridContainer) return;
    
    if (items.length === 0) {
        gridContainer.innerHTML = `
            <div class="astrodex-empty">
                <div class="empty-icon">📚</div>
                <div class="empty-title">Your Astrodex is empty</div>
                <div class="empty-text">Start adding celestial objects you've captured!</div>
                <button class="btn" data-action="add-astrodex-item">
                    ➕ Add First Object
                </button>
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
            <div class="astrodex-card">
                <div class="astrodex-card-image" data-item-id="${jsEscapedId}" tabindex="0" role="button" aria-label="View ${escapedName} photos" style="cursor: pointer;" title="Click to view photos">
                    <img src="${escapedImageUrl}" alt="${escapedName}" loading="lazy">
                    ${photoCount > 0 ? `<div class="photo-badge">${photoCount} 📷</div>` : ''}
                </div>
                <div class="astrodex-card-body" data-item-id="${jsEscapedId}" tabindex="0" role="button" aria-label="View ${escapedName} details" style="cursor: pointer;">
                    <div class="astrodex-card-title">${escapedName}</div>
                    <div class="astrodex-card-type">${escapeHtml(item.type || 'Unknown')}</div>
                    ${item.constellation ? `<div class="astrodex-card-constellation">📍 ${escapeHtml(item.constellation)}</div>` : ''}
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
            showNotification(response.error || 'Failed to add item', 'error');
            return false;
        }
    } catch (error) {
        console.error('Error adding to astrodex:', error);
        if (error.message && error.message.includes('already exists')) {
            showNotification('This object is already in your Astrodex', 'warning');
        } else {
            showNotification('Failed to add to Astrodex', 'error');
        }
        return false;
    }
}

async function addFromCatalogue(catalogueItem) {
    // Extract item name from catalogue data
    const itemName = catalogueItem.id || catalogueItem['target name'] || catalogueItem.name;
    
    if (!itemName) {
        showNotification('Invalid item data', 'error');
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
    const modal = createModal('Add to Astrodex', `
        <form id="add-astrodex-form" class="form">
            <div class="form-group">
                <label for="item-name">Object Name *</label>
                <input type="text" id="item-name" class="form-control" required>
            </div>
            <div class="form-group">
                <label for="item-type">Type</label>
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
            <div class="form-group">
                <label for="item-constellation">Constellation</label>
                <input type="text" id="item-constellation" class="form-control">
            </div>
            <div class="form-group">
                <label for="item-notes">Notes</label>
                <textarea id="item-notes" class="form-control" rows="3"></textarea>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
                <button type="submit" class="btn btn-primary">Add to Astrodex</button>
            </div>
        </form>
    `);
    
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
        <div class="astrodex-detail">
            <div class="astrodex-detail-top">
                <div class="astrodex-detail-image-container">
                    <img src="${escapedImageUrl}" alt="${escapedName}" class="astrodex-detail-image">
                </div>
                <div class="astrodex-detail-info">
                    <h3>Object Information</h3>
                    <form id="edit-item-form-${item.id}">
                        <div class="info-row">
                            <span>Type:</span> 
                            <select id="edit-type-${item.id}" class="form-control-inline" data-action="update-field" data-item-id="${item.id}" data-field="type">
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
                        ${item.catalogue ? `<div class="info-row"><span>Catalogue:</span> <span>${escapeHtml(item.catalogue)}</span></div>` : ''}
                        <div class="info-row">
                            <span>Constellation:</span> 
                            <input type="text" id="edit-constellation-${item.id}" class="form-control-inline" value="${escapeHtml(item.constellation || '')}" data-action="update-field" data-item-id="${item.id}" data-field="constellation" placeholder="Optional">
                        </div>
                        <div class="info-row">
                            <span>Notes:</span>
                        </div>
                        <textarea id="edit-notes-${item.id}" class="form-control" rows="3" data-action="update-field" data-item-id="${item.id}" data-field="notes" placeholder="Add your notes...">${escapeHtml(item.notes || '')}</textarea>
                    </form>
                    <div class="astrodex-detail-actions">
                        <button class="btn btn-sm" data-action="add-picture" data-item-id="${item.id}">📷 Add Photo</button>
                        <button class="btn btn-sm btn-danger" data-action="delete-item" data-item-id="${item.id}">🗑️ Remove</button>
                    </div>
                </div>
            </div>
            <div class="astrodex-detail-bottom">
                <h3>Photos (${item.pictures ? item.pictures.length : 0})</h3>
                <div class="astrodex-pictures">
                    ${renderPicturesGrid(item)}
                </div>
            </div>
        </div>
    `, 'modal-large');
}

function renderPicturesGrid(item) {
    if (!item.pictures || item.pictures.length === 0) {
        return `
            <div class="no-pictures">
                <p>No photos yet</p>
                <button class="btn" data-action="add-picture" data-item-id="${item.id}">Add First Photo</button>
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
        <div class="picture-card ${picture.is_main ? 'main-picture' : ''}">
            <img src="${escapedImageUrl}" alt="Photo" data-picture-name="${jsEscapedName} - Photo" data-picture-url="${jsEscapedImageUrl}" tabindex="0" role="button" aria-label="View photo of ${escapedName} larger" style="cursor: pointer;" title="Click to view larger">
            ${picture.is_main ? '<div class="main-badge">⭐ Main</div>' : ''}
            <div class="picture-info">
                ${picture.date ? `<div>📅 ${escapeHtml(formatDate(picture.date))}</div>` : ''}
                ${picture.exposition_time ? `<div>⏱️ ${escapeHtml(picture.exposition_time)}</div>` : ''}
                ${picture.device ? `<div>🔭 ${escapeHtml(picture.device)}</div>` : ''}
            </div>
            <div class="picture-actions">
                ${!picture.is_main ? `<button class="btn-icon" data-action="set-main-picture" data-item-id="${escapeForJs(item.id)}" data-picture-id="${escapeForJs(picture.id)}" title="Set as main">⭐</button>` : '<span class="btn-icon-placeholder"></span>'}
                <button class="btn-icon" data-action="edit-picture" data-item-id="${escapeForJs(item.id)}" data-picture-id="${escapeForJs(picture.id)}" title="Edit">✏️</button>
                <button class="btn-icon btn-danger" data-action="delete-picture" data-item-id="${escapeForJs(item.id)}" data-picture-id="${escapeForJs(picture.id)}" title="Delete">🗑️</button>
            </div>
        </div>
        `;
    }).join('');
}

// ============================================
// Picture Management
// ============================================

function showAddPictureModal(itemId) {
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
    
    const modal = createModal('Add Photo', `
        <form id="add-picture-form" class="form">
            <div class="form-group">
                <label for="picture-file">Image File *</label>
                <input type="file" id="picture-file" class="form-control" accept="image/*" required>
            </div>
            <div class="form-group">
                <label for="picture-date">Observation Date</label>
                <input type="date" id="picture-date" class="form-control" value="${today}">
            </div>
            <div class="form-group">
                <label for="picture-exposition">Exposition Time</label>
                <input type="text" id="picture-exposition" class="form-control" placeholder="e.g., 120x30s">
            </div>
            <div class="form-group">
                <label for="picture-device">Device/Telescope</label>
                <input type="text" id="picture-device" class="form-control" list="device-list" autocomplete="off">
                <datalist id="device-list">
                    ${deviceOptions}
                </datalist>
            </div>
            <div class="form-group">
                <label for="picture-filters">Filters</label>
                <input type="text" id="picture-filters" class="form-control" placeholder="e.g., LRGB, Ha-OIII" list="filters-list" autocomplete="off">
                <datalist id="filters-list">
                    ${filterOptions}
                </datalist>
            </div>
            <div class="form-group">
                <label for="picture-iso">ISO</label>
                <input type="text" id="picture-iso" class="form-control" list="iso-list" autocomplete="off">
                <datalist id="iso-list">
                    ${isoOptions}
                </datalist>
            </div>
            <div class="form-group">
                <label for="picture-frames">Number of Frames</label>
                <input type="text" id="picture-frames" class="form-control">
            </div>
            <div class="form-group">
                <label for="picture-notes">Notes</label>
                <textarea id="picture-notes" class="form-control" rows="2"></textarea>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
                <button type="submit" class="btn btn-primary">Upload Photo</button>
            </div>
        </form>
    `);
    
    document.getElementById('add-picture-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await uploadPicture(itemId);
    });
}

async function uploadPicture(itemId) {
    const fileInput = document.getElementById('picture-file');
    const file = fileInput.files[0];
    
    if (!file) {
        showNotification('Please select an image', 'error');
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
        showNotification('Failed to upload photo', 'error');
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
        showAstrodexItemDetail(itemId);
    } catch (error) {
        console.error('Error setting main picture:', error);
        showNotification('Failed to update main photo', 'error');
    }
}

async function deletePicture(itemId, pictureId) {
    showConfirmModal(
        'Delete Photo',
        'Are you sure you want to delete this photo? This action cannot be undone.',
        async () => {
            try {
                await fetchJSON(`/api/astrodex/items/${itemId}/pictures/${pictureId}`, {
                    method: 'DELETE'
                });
                
                showNotification('Photo deleted', 'success');
                await loadAstrodex();
                showAstrodexItemDetail(itemId);
            } catch (error) {
                console.error('Error deleting picture:', error);
                showNotification('Failed to delete photo', 'error');
            }
        },
        () => {
            // On cancel, reopen the item detail view
            showAstrodexItemDetail(itemId);
        }
    );
}

// ============================================
// Item Management
// ============================================

async function deleteAstrodexItem(itemId) {
    // Get the item name before deleting
    const item = astrodexData.items.find(i => i.id === itemId);
    const itemName = item ? item.name : null;
    
    showConfirmModal(
        'Remove from Astrodex',
        'Are you sure you want to remove this object from your Astrodex? This will also delete all associated photos. This action cannot be undone.',
        async () => {
            try {
                await fetchJSON(`/api/astrodex/items/${itemId}`, {
                    method: 'DELETE'
                });
                
                showNotification('Object removed from Astrodex', 'success');
                await loadAstrodex();
                
                // Update catalogue badges if the function exists (from app.js)
                if (itemName && typeof updateCatalogueCapturedBadge === 'function') {
                    updateCatalogueCapturedBadge(itemName, false);
                }
                
                closeModal();
            } catch (error) {
                console.error('Error deleting item:', error);
                showNotification('Failed to remove object', 'error');
            }
        },
        () => {
            // On cancel, reopen the item detail view
            showAstrodexItemDetail(itemId);
        }
    );
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
        
        showNotification('Updated successfully', 'success');
    } catch (error) {
        console.error('Error updating item:', error);
        showNotification('Failed to update', 'error');
    }
}

function showEditPictureModal(itemId, pictureId) {
    const item = astrodexData.items.find(i => i.id === itemId);
    if (!item) return;
    
    const picture = item.pictures.find(p => p.id === pictureId);
    if (!picture) return;
    
    const modal = createModal('Edit Photo', `
        <form id="edit-picture-form" class="form">
            <div class="form-group">
                <label for="edit-picture-date">Observation Date</label>
                <input type="date" id="edit-picture-date" class="form-control" value="${picture.date || ''}">
            </div>
            <div class="form-group">
                <label for="edit-picture-exposition">Exposition Time</label>
                <input type="text" id="edit-picture-exposition" class="form-control" value="${escapeHtml(picture.exposition_time || '')}" placeholder="e.g., 120x30s">
            </div>
            <div class="form-group">
                <label for="edit-picture-device">Device/Telescope</label>
                <input type="text" id="edit-picture-device" class="form-control" value="${escapeHtml(picture.device || '')}">
            </div>
            <div class="form-group">
                <label for="edit-picture-filters">Filters</label>
                <input type="text" id="edit-picture-filters" class="form-control" value="${escapeHtml(picture.filters || '')}" placeholder="e.g., LRGB, Ha-OIII">
            </div>
            <div class="form-group">
                <label for="edit-picture-iso">ISO</label>
                <input type="text" id="edit-picture-iso" class="form-control" value="${escapeHtml(picture.iso || '')}">
            </div>
            <div class="form-group">
                <label for="edit-picture-frames">Number of Frames</label>
                <input type="text" id="edit-picture-frames" class="form-control" value="${escapeHtml(picture.frames || '')}">
            </div>
            <div class="form-group">
                <label for="edit-picture-notes">Notes</label>
                <textarea id="edit-picture-notes" class="form-control" rows="2">${escapeHtml(picture.notes || '')}</textarea>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Changes</button>
            </div>
        </form>
    `);
    
    document.getElementById('edit-picture-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await updatePicture(itemId, pictureId);
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
        showNotification('Failed to update photo', 'error');
    }
}

function showPictureSlideshow(itemId) {
    const item = astrodexData.items.find(i => i.id === itemId);
    if (!item || !item.pictures || item.pictures.length === 0) {
        // No pictures, just show the default image popup
        const imageUrl = '/static/default_astro_object.svg';
        showImagePopup(item ? item.name : 'Object', imageUrl);
        return;
    }
    
    let currentIndex = 0;
    let keyHandler = null; // Store the handler reference for cleanup
    
    function renderSlide() {
        const picture = item.pictures[currentIndex];
        const imageUrl = `/api/astrodex/images/${picture.filename}`;
        
        const pictureInfo = `
            <div class="slideshow-info">
                <div class="slideshow-counter">Photo ${currentIndex + 1} of ${item.pictures.length}</div>
                ${picture.date ? `<div>📅 ${escapeHtml(formatDate(picture.date))}</div>` : ''}
                ${picture.exposition_time ? `<div>⏱️ ${escapeHtml(picture.exposition_time)}</div>` : ''}
                ${picture.device ? `<div>🔭 ${escapeHtml(picture.device)}</div>` : ''}
                ${picture.filters ? `<div>🎨 Filters: ${escapeHtml(picture.filters)}</div>` : ''}
                ${picture.iso ? `<div>📷 ISO: ${escapeHtml(picture.iso)}</div>` : ''}
                ${picture.frames ? `<div>🎞️ Frames: ${escapeHtml(picture.frames)}</div>` : ''}
                ${picture.notes ? `<div class="slideshow-notes">📝 ${escapeHtml(picture.notes)}</div>` : ''}
            </div>
        `;
        
        const navigation = item.pictures.length > 1 ? `
            <button class="slideshow-arrow slideshow-prev" ${currentIndex === 0 ? 'disabled' : ''} aria-label="Previous photo">
                <span>‹</span>
            </button>
            <button class="slideshow-arrow slideshow-next" ${currentIndex === item.pictures.length - 1 ? 'disabled' : ''} aria-label="Next photo">
                <span>›</span>
            </button>
        ` : '';
        
        const modalHTML = `
            <div id="custom-modal" class="modal-overlay modal-slideshow">
                <div class="modal-content slideshow-modal">
                    <div class="modal-header">
                        <h2>${escapeHtml(item.name)} - Photos</h2>
                        <button class="modal-close" data-action="cleanup-close-modal">×</button>
                    </div>
                    <div class="modal-body slideshow-body">
                        <div class="slideshow-container">
                            <img src="${escapeHtml(imageUrl)}" alt="Photo ${currentIndex + 1}" class="slideshow-image">
                            ${navigation}
                        </div>
                        ${pictureInfo}
                    </div>
                </div>
            </div>
        `;
        
        // Don't close existing modal - slideshow should stack on top with higher z-index
        // Remove any existing slideshow modal first
        const existingSlideshow = document.querySelector('.modal-slideshow');
        if (existingSlideshow) {
            existingSlideshow.remove();
        }
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add event listeners to navigation buttons
        if (item.pictures.length > 1) {
            const prevBtn = document.querySelector('.slideshow-prev');
            const nextBtn = document.querySelector('.slideshow-next');
            
            if (prevBtn && currentIndex > 0) {
                prevBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    currentIndex--;
                    // Remove old keyboard handler before rendering new slide
                    if (keyHandler) {
                        document.removeEventListener('keydown', keyHandler);
                    }
                    renderSlide();
                });
            }
            if (nextBtn && currentIndex < item.pictures.length - 1) {
                nextBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    currentIndex++;
                    // Remove old keyboard handler before rendering new slide
                    if (keyHandler) {
                        document.removeEventListener('keydown', keyHandler);
                    }
                    renderSlide();
                });
            }
            
            // Remove old keyboard handler if exists
            if (keyHandler) {
                document.removeEventListener('keydown', keyHandler);
            }
            
            // Create and add new keyboard handler
            keyHandler = (e) => {
                if (e.key === 'ArrowLeft' && currentIndex > 0) {
                    e.preventDefault();
                    currentIndex--;
                    document.removeEventListener('keydown', keyHandler);
                    renderSlide();
                } else if (e.key === 'ArrowRight' && currentIndex < item.pictures.length - 1) {
                    e.preventDefault();
                    currentIndex++;
                    document.removeEventListener('keydown', keyHandler);
                    renderSlide();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    document.removeEventListener('keydown', keyHandler);
                    closeModal();
                }
            };
            
            document.addEventListener('keydown', keyHandler);
        }
    }
    
    // Make cleanup function available globally for the close button
    window.cleanupAndCloseModal = function() {
        if (keyHandler) {
            document.removeEventListener('keydown', keyHandler);
            keyHandler = null;
        }
        closeModal();
    };
    
    renderSlide();
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

function showNotification(message, type = 'info') {
    // Create auto-disappearing notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style based on notification type
    let bgColor, textColor;
    switch(type) {
        case 'error':
            bgColor = '#fee';
            textColor = '#c33';
            break;
        case 'success':
            bgColor = '#efe';
            textColor = '#363';
            break;
        case 'warning':
            bgColor = '#fff3cd';
            textColor = '#856404';
            break;
        default: // info
            bgColor = '#e7f3ff';
            textColor = '#004085';
    }
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${bgColor};
        color: ${textColor};
        border-radius: 5px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10001;
        animation: slideIn 0.3s ease-out;
        font-weight: 500;
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function createModal(title, content, className = '') {
    // Close any existing modal
    closeModal();
    
    const modalHTML = `
        <div id="custom-modal" class="modal-overlay ${className}">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="modal-close" data-action="close-modal">×</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeModal() {
    const modal = document.getElementById('custom-modal');
    if (modal) {
        modal.remove();
    }
}

function handleModalClick(event) {
    if (event.target.classList.contains('modal-overlay')) {
        closeModal();
    }
}

/**
 * Show a confirmation modal with confirm/cancel buttons
 * @param {string} title - Modal title
 * @param {string} message - Confirmation message
 * @param {Function} onConfirm - Callback when user confirms
 * @param {Function} onCancel - Optional callback when user cancels
 */
function showConfirmModal(title, message, onConfirm, onCancel = null) {
    // Close any existing modal
    closeModal();
    
    const modalHTML = `
        <div id="custom-modal" class="modal-overlay">
            <div class="modal-content confirm-modal">
                <div class="modal-header">
                    <h2>${escapeHtml(title)}</h2>
                    <button class="modal-close" data-action="close-modal">×</button>
                </div>
                <div class="modal-body">
                    <p class="confirm-message">${escapeHtml(message)}</p>
                    <div class="confirm-actions">
                        <button class="btn btn-cancel" data-action="confirm-cancel">Cancel</button>
                        <button class="btn btn-danger" data-action="confirm-delete">Confirm</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add event listeners for confirm/cancel buttons
    const confirmBtn = document.querySelector('[data-action="confirm-delete"]');
    const cancelBtn = document.querySelector('[data-action="confirm-cancel"]');
    
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            closeModal();
            if (onConfirm) onConfirm();
        });
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            closeModal();
            if (onCancel) onCancel();
        });
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
        if (button) {
            const action = button.getAttribute('data-action');
            const itemId = button.getAttribute('data-item-id');
            
            switch(action) {
                case 'add-astrodex-item':
                    e.preventDefault();
                    showAddAstrodexItemModal();
                    break;
            }
        }
        
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
