// ======================
// API Helper - Centralized fetch utilities
// ======================

const API_BASE = window.location.origin;

/**
 * Fetch JSON data from an API endpoint with error handling
 * @param {string} endpoint - API endpoint (e.g., '/api/weather/forecast')
 * @param {Object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise<Object>} - Parsed JSON response
 * @throws {Error} - If fetch fails or response is not ok
 */
async function fetchJSON(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
        throw error;
    }
}

/**
 * Fetch JSON data with automatic error display in a container
 * @param {string} endpoint - API endpoint
 * @param {HTMLElement} container - Container element to show loading/error states
 * @param {string} loadingMessage - Message to show while loading
 * @returns {Promise<Object|null>} - Parsed JSON response or null on error
 */
async function fetchJSONWithUI(endpoint, container, loadingMessage = 'Loading...') {
    if (container) {
        container.innerHTML = `<div class="loading">${loadingMessage}</div>`;
    }
    
    try {
        const data = await fetchJSON(endpoint);
        
        // Handle error in response
        if (data.error) {
            if (container) {
                container.innerHTML = `<div class="error-box">${data.error}</div>`;
            }
            return null;
        }
        
        // Handle pending status
        if (data.status && data.status === 'pending') {
            if (container) {
                container.innerHTML = `<div class="info-notice">${data.message || 'Processing...'}</div>`;
            }
            return null;
        }
        
        return data;
    } catch (error) {
        if (container) {
            container.innerHTML = `<div class="error-box">Failed to load data: ${error.message}</div>`;
        }
        return null;
    }
}

/**
 * POST JSON data to an API endpoint
 * @param {string} endpoint - API endpoint
 * @param {Object} data - Data to send
 * @returns {Promise<Object>} - Parsed JSON response
 */
async function postJSON(endpoint, data) {
    return fetchJSON(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
}
