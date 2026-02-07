// ======================
// API Helper - Centralized fetch utilities
// ======================

const API_BASE = window.location.origin;

function resolveEndpoint(endpoint) {
    if (/^https?:\/\//i.test(endpoint)) {
        return endpoint;
    }
    if (endpoint.startsWith('//')) {
        return `${window.location.protocol}${endpoint}`;
    }
    if (endpoint.startsWith('/')) {
        return `${API_BASE}${endpoint}`;
    }
    return `${API_BASE}/${endpoint}`;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getBackoffDelayMs(attempt, baseDelayMs, maxDelayMs) {
    const expDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
    const jitter = Math.floor(Math.random() * Math.min(250, Math.max(50, expDelay / 4)));
    return expDelay + jitter;
}

/**
 * Fetch JSON data from an API endpoint with error handling
 * @param {string} endpoint - API endpoint (e.g., '/api/weather/forecast')
 * @param {Object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise<Object>} - Parsed JSON response
 * @throws {Error} - If fetch fails or response is not ok
 */
async function fetchJSONOnce(endpoint, options = {}) {
    const { timeoutMs, ...fetchOptions } = options;
    const controller = !fetchOptions.signal && timeoutMs ? new AbortController() : null;
    const timeoutId = controller
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;

    if (controller) {
        fetchOptions.signal = controller.signal;
    }

    try {
        const response = await fetch(resolveEndpoint(endpoint), fetchOptions);

        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            error.status = response.status;
            throw error;
        }

        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError') {
            const timeoutError = new Error('Request timed out');
            timeoutError.code = 'ETIMEDOUT';
            throw timeoutError;
        }
        console.error(`Error fetching ${endpoint}:`, error);
        throw error;
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}

async function fetchJSON(endpoint, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const retryOptions = method === 'GET'
        ? { maxAttempts: 4, baseDelayMs: 1000, maxDelayMs: 8000, timeoutMs: 15000 }
        : { maxAttempts: 1, timeoutMs: 15000 };

    return fetchJSONWithRetry(endpoint, options, retryOptions);
}

async function fetchWithRetry(endpoint, options = {}, retryOptions = {}) {
    const {
        maxAttempts = 4,
        baseDelayMs = 1000,
        maxDelayMs = 8000,
        timeoutMs = 15000,
        retryOnStatuses = [408, 429, 500, 502, 503, 504],
        retryOnNetworkError = true,
        onRetry = null
    } = retryOptions;

    let attempt = 0;

    while (attempt < maxAttempts) {
        attempt += 1;

        const { timeoutMs: optTimeoutMs, ...fetchOptions } = options;
        const effectiveTimeout = optTimeoutMs || timeoutMs;
        const controller = !fetchOptions.signal && effectiveTimeout ? new AbortController() : null;
        const timeoutId = controller
            ? setTimeout(() => controller.abort(), effectiveTimeout)
            : null;

        if (controller) {
            fetchOptions.signal = controller.signal;
        }

        try {
            const response = await fetch(resolveEndpoint(endpoint), fetchOptions);
            const isRetryableStatus = retryOnStatuses.includes(response.status);

            if (isRetryableStatus && attempt < maxAttempts) {
                const waitMs = getBackoffDelayMs(attempt, baseDelayMs, maxDelayMs);
                if (onRetry) {
                    onRetry({
                        reason: 'status',
                        attempt,
                        maxAttempts,
                        waitMs,
                        response
                    });
                }
                await sleep(waitMs);
                continue;
            }

            return response;
        } catch (error) {
            let finalError = error;
            if (error.name === 'AbortError') {
                finalError = new Error('Request timed out');
                finalError.code = 'ETIMEDOUT';
            }

            const shouldRetry = attempt < maxAttempts && retryOnNetworkError;
            if (!shouldRetry) {
                throw finalError;
            }

            const waitMs = getBackoffDelayMs(attempt, baseDelayMs, maxDelayMs);
            if (onRetry) {
                onRetry({
                    reason: 'error',
                    attempt,
                    maxAttempts,
                    waitMs,
                    error: finalError
                });
            }
            await sleep(waitMs);
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }
    }

    throw new Error('Retry attempts exhausted');
}

async function fetchJSONWithRetry(endpoint, options = {}, retryOptions = {}) {
    const {
        maxAttempts = 6,
        baseDelayMs = 1000,
        maxDelayMs = 10000,
        timeoutMs = 15000,
        retryOnStatuses = [408, 429, 500, 502, 503, 504],
        retryOnNetworkError = true,
        shouldRetryData = null,
        onRetry = null
    } = retryOptions;

    let attempt = 0;

    while (attempt < maxAttempts) {
        attempt += 1;

        try {
            const data = await fetchJSONOnce(endpoint, { ...options, timeoutMs });

            if (shouldRetryData && shouldRetryData(data)) {
                if (attempt >= maxAttempts) {
                    return data;
                }

                const waitMs = getBackoffDelayMs(attempt, baseDelayMs, maxDelayMs);
                if (onRetry) {
                    onRetry({
                        reason: 'data',
                        attempt,
                        maxAttempts,
                        waitMs,
                        data
                    });
                }
                await sleep(waitMs);
                continue;
            }

            return data;
        } catch (error) {
            const status = error.status;
            const isRetryableStatus = status && retryOnStatuses.includes(status);
            const isRetryableNetwork = !status && retryOnNetworkError;
            const shouldRetry = attempt < maxAttempts && (isRetryableStatus || isRetryableNetwork);

            if (!shouldRetry) {
                throw error;
            }

            const waitMs = getBackoffDelayMs(attempt, baseDelayMs, maxDelayMs);
            if (onRetry) {
                onRetry({
                    reason: 'error',
                    attempt,
                    maxAttempts,
                    waitMs,
                    error
                });
            }
            await sleep(waitMs);
        }
    }

    throw new Error('Retry attempts exhausted');
}

/**
 * Fetch JSON data with automatic error display in a container
 * @param {string} endpoint - API endpoint
 * @param {HTMLElement} container - Container element to show loading/error states
 * @param {string} loadingMessage - Message to show while loading
 * @returns {Promise<Object|null>} - Parsed JSON response or null on error
 */
async function fetchJSONWithUI(endpoint, container, loadingMessage = 'Loading...', retryOptions = {}) {
    if (container) {
        container.innerHTML = `<div class="alert alert-info" role="alert">${loadingMessage}</div>`;
    }

    const {
        retryOnPending = true,
        pendingMessage = 'Cache not ready. Retrying...',
        retryMessage = 'Temporary error. Retrying...'
    } = retryOptions;

    try {
        const data = await fetchJSONWithRetry(endpoint, {}, {
            ...retryOptions,
            shouldRetryData: retryOnPending
                ? (payload) => payload && payload.status === 'pending'
                : null,
            onRetry: ({ reason, attempt, maxAttempts, waitMs, data: retryData, error }) => {
                if (!container) {
                    return;
                }

                const seconds = Math.max(1, Math.round(waitMs / 1000));
                const message = reason === 'data'
                    ? (retryData && retryData.message ? retryData.message : pendingMessage)
                    : (retryMessage || (error ? error.message : 'Temporary error'));

                container.innerHTML = `
                    <div class="alert alert-info" role="alert">
                        ${message} Retrying in ${seconds}s (${attempt}/${maxAttempts})
                    </div>
                `;
            }
        });

        // Handle error in response
        if (data && data.error) {
            if (container) {
                container.innerHTML = `<div class="alert alert-danger" role="alert">${data.error}</div>`;
            }
            return null;
        }

        // Handle pending status when retries are exhausted
        if (data && data.status === 'pending') {
            if (container) {
                container.innerHTML = `<div class="alert alert-info" role="alert">${data.message || 'Processing...'}</div>`;
            }
            return null;
        }

        return data;
    } catch (error) {
        if (container) {
            container.innerHTML = `<div class="alert alert-danger" role="alert">Failed to load data: ${error.message}</div>`;
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
