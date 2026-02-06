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
 * Check the global cache status from the backend API.
 * If the cache is fully initialized, hide the banner.
 */
async function checkCacheStatus() {
    const banner = document.getElementById('global-cache-banner');
    
    try {
        const response = await fetch(`${API_BASE}/api/cache`);
        const data = await response.json();

        if (data.cache_status === true) {
            // If the cache is ready, hide the banner
            if (banner) {
                banner.style.display = 'none';
            }
            //console.log("Cache fully initialized. Banner hidden.");
        } else {
            // If the cache is not ready keep the banner visible
            // and schedule a re-check in 10 seconds
            if (banner) {
                banner.style.display = 'block';
            }
            //console.log("Cache not ready, retrying in 10s...");
            setTimeout(checkCacheStatus, 10000);
        }
    } catch (error) {
        console.error('Error checking cache status:', error);
        // In case of API error, retry after 10 seconds anyway
        setTimeout(checkCacheStatus, 10000);
    }
}