/* =====================
   Utils
   ===================== */


function showMessage(type, message) {
    //type available: 'success', 'error', 'warning', 'info'
    const colorMap = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    const color = colorMap[type] || '#ef4444';
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${color};
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: 600;
        animation: slideIn 0.3s ease-out;
    `;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

/**
 * Check and display cache status information.
 * Cache is managed entirely server-side with TTL-based expiration.
 * No browser-side cache refresh required - F5 works normally.
 */
async function checkCacheStatus() {
    const banner = document.getElementById('global-cache-banner');
    if (!banner) return;
    
    try {
        const data = await fetchJSONWithRetry('/api/cache', {}, {
            maxAttempts: 2,
            baseDelayMs: 500,
            maxDelayMs: 2000,
            timeoutMs: 5000
        });

        if (data.cache_status === true) {
            // Cache is ready, hide the banner
            banner.style.display = 'none';
        } else {
            // Cache is initializing, show informational banner
            banner.style.display = 'block';
            
            // Check less frequently (every 30 seconds)
            // since cache updates happen server-side on schedule
            setTimeout(checkCacheStatus, 30000);
        }
    } catch (error) {
        // If API fails, hide banner and don't block UI
        banner.style.display = 'none';
        console.debug('Cache status check unavailable (server-side cached data will still be used)');
    }
}