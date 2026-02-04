// ======================
// DOM Utilities - Centralized DOM manipulation helpers
// ======================

/**
 * Set loading state on a container
 * @param {HTMLElement|string} containerOrId - Container element or ID
 * @param {string} message - Loading message
 */
function setLoading(containerOrId, message = 'Loading...') {
    const container = getElement(containerOrId);
    if (container) {
        container.innerHTML = `<div class="loading">${message}</div>`;
    }
}

/**
 * Set error state on a container
 * @param {HTMLElement|string} containerOrId - Container element or ID
 * @param {string} message - Error message
 */
function setError(containerOrId, message) {
    const container = getElement(containerOrId);
    if (container) {
        container.innerHTML = `<div class="error-box">${message}</div>`;
    }
}

/**
 * Set info/notice state on a container
 * @param {HTMLElement|string} containerOrId - Container element or ID
 * @param {string} message - Info message
 */
function setInfo(containerOrId, message) {
    const container = getElement(containerOrId);
    if (container) {
        container.innerHTML = `<div class="info-notice">${message}</div>`;
    }
}

/**
 * Clear container contents
 * @param {HTMLElement|string} containerOrId - Container element or ID
 */
function clearContainer(containerOrId) {
    const container = getElement(containerOrId);
    if (container) {
        container.innerHTML = '';
    }
}

/**
 * Get element by ID or return the element itself
 * @param {HTMLElement|string} elementOrId - Element or ID
 * @returns {HTMLElement|null}
 */
function getElement(elementOrId) {
    if (typeof elementOrId === 'string') {
        return document.getElementById(elementOrId);
    }
    return elementOrId;
}

/**
 * Show/hide element
 * @param {HTMLElement|string} elementOrId - Element or ID
 * @param {boolean} show - True to show, false to hide
 */
function toggleVisibility(elementOrId, show) {
    const element = getElement(elementOrId);
    if (element) {
        element.style.display = show ? '' : 'none';
    }
}

/**
 * Add CSS class to element
 * @param {HTMLElement|string} elementOrId - Element or ID
 * @param {string} className - CSS class name
 */
function addClass(elementOrId, className) {
    const element = getElement(elementOrId);
    if (element && !element.classList.contains(className)) {
        element.classList.add(className);
    }
}

/**
 * Remove CSS class from element
 * @param {HTMLElement|string} elementOrId - Element or ID
 * @param {string} className - CSS class name
 */
function removeClass(elementOrId, className) {
    const element = getElement(elementOrId);
    if (element && element.classList.contains(className)) {
        element.classList.remove(className);
    }
}

/**
 * Create element with attributes and content
 * @param {string} tag - HTML tag name
 * @param {Object} attributes - Attributes to set (className, id, etc.)
 * @param {string|HTMLElement} content - Inner HTML or child element
 * @returns {HTMLElement}
 */
function createElement(tag, attributes = {}, content = '') {
    const element = document.createElement(tag);
    
    // Set attributes
    for (const [key, value] of Object.entries(attributes)) {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'textContent') {
            element.textContent = value;
        } else {
            element.setAttribute(key, value);
        }
    }
    
    // Set content
    if (typeof content === 'string') {
        element.innerHTML = content;
    } else if (content instanceof HTMLElement) {
        element.appendChild(content);
    }
    
    return element;
}
