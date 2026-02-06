// ======================
// Weather Alerts & Notifications System
// ======================

/**
 * Weather alerts notification system for astrophotography
 */
class WeatherAlertsSystem {
    constructor() {
        this.alerts = [];
        this.notificationContainer = null;
        this.updateInterval = null;
        this.isInitialized = false;
        
        this.init();
    }
    
    init() {
        this.createNotificationContainer();
        this.startPeriodicCheck();
        this.isInitialized = true;
        //console.log('Weather alerts system initialized');
    }
    
    createNotificationContainer() {
        // Create notification container if it doesn't exist
        this.notificationContainer = document.getElementById('weather-notifications');
        if (!this.notificationContainer) {
            this.notificationContainer = document.createElement('li');
            this.notificationContainer.id = 'weather-notifications';
            this.notificationContainer.className = 'nav-item';
            // Add this element to first of ul id="end-navbar"
            const endNavbar = document.getElementById('end-navbar');
            if (endNavbar) {
                endNavbar.insertBefore(this.notificationContainer, endNavbar.firstChild);
            } 

        }
    }
    
    async checkForAlerts() {
        try {
            const response = await fetch(`${API_BASE}/api/weather/alerts`);
            const data = await response.json();
            
            if (data.error) {
                console.warn('Failed to fetch weather alerts:', data.error);
                return;
            }
            
            const newAlerts = data.alerts || [];
            //console.log('Fetched weather alerts:', newAlerts);
            this.processNewAlerts(newAlerts);
            
        } catch (error) {
            console.error('Error checking for weather alerts:', error);
        }
    }
    
    processNewAlerts(newAlerts) {
        // Filter for high priority alerts we haven't shown yet
        const highPriorityAlerts = newAlerts.filter(alert => 
            alert.severity === 'HIGH' && 
            !this.alerts.some(existing => existing.type === alert.type && existing.time === alert.time)
        );
        
        // Update alerts array
        this.alerts = newAlerts;
        
        // Update header alert indicator
        this.updateHeaderAlertIndicator();
    }
    
    isAlertActive(alert) {
        // An alert is active if:
        // - It starts within the next 6 hours (future alert)
        // - OR it started within the last 3 hours (recent alert still relevant)
        const alertTime = new Date(alert.time);
        const now = new Date();
        const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);
        const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
        
        return alertTime <= sixHoursFromNow && alertTime >= threeHoursAgo;
    }
    
    updateHeaderAlertIndicator() {
        //Empty id weather-notifications
        let container = document.getElementById('weather-notifications');
        clearContainer(container)
        container.className = 'nav-item';

        const activeAlerts = this.alerts.filter(alert => this.isAlertActive(alert));

        if (activeAlerts.length > 0) {
            //console.log('Active weather alerts:', activeAlerts);

            let indicator = document.createElement('a');
            indicator.id = 'weather-alert-indicator';
            indicator.className = 'nav-link';
            indicator.onclick = () => this.showAlertsModal();
            container.appendChild(indicator);

            const highPriorityCount = activeAlerts.filter(a => a.severity === 'HIGH').length;
            const totalCount = activeAlerts.length;
            
            indicator.innerHTML = `⚠️ ${totalCount}`;
            
            container.className = `nav-item weather-alert-indicator-${highPriorityCount > 0 ? 'high-priority' : 'normal'}`;
            indicator.title = `${totalCount} weather alert(s) - Click to view details`;

        } 
    }
    
    showAlertsModal() {

        const activeAlerts = this.alerts.filter(alert => this.isAlertActive(alert));

        const alertsHtml = activeAlerts.length > 0 ? 
            activeAlerts.map(alert => {
                const alertTime = new Date(alert.time);
                const icon = this.getAlertTypeIcon(alert.type);
                
                return `
                    <div class="alert alert-${alert.severity === 'HIGH' ? 'danger' : 'warning'}" role="alert">
                        <div class="fw-bold">
                            <span>${icon}</span>
                            <span>${alert.type.replace('_', ' ')}</span>
                            <span>${alertTime.toLocaleString()}</span>
                        </div>
                        <div>${alert.message}</div>
                    </div>
                `;
            }).join('') : 
            '<div class="modal-no-alerts">No active weather alerts</div>';

        // Set modal content
        document.getElementById('modal_lg_close_title').textContent = 'Weather Alerts for Astrophotography';
        document.getElementById('modal_lg_close_body').innerHTML = `
            <div class="weather-alerts-modal-body">
                ${alertsHtml}
            </div>
        `;

        const bs_modal = new bootstrap.Modal('#modal_lg_close', {
            backdrop: 'static',
            focus: true,
            keyboard: true
        });

        bs_modal.show();
    }
    
    startPeriodicCheck() {
        // Check for alerts every 5 minutes
        this.updateInterval = setInterval(() => {
            this.checkForAlerts();
        }, 300000);
        
        // Initial check
        this.checkForAlerts();
    }
    
    stopPeriodicCheck() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    getAlertTypeIcon(type) {
        const icons = {
            'DEW_WARNING': '💧',
            'WIND_WARNING': '💨',
            'SEEING_WARNING': '👁️',
            'TRANSPARENCY_WARNING': '🌫️',
            'CLOUD_WARNING': '☁️'
        };
        return icons[type] || '⚠️';
    }
    
    destroy() {
        this.stopPeriodicCheck();
        if (this.notificationContainer) {
            this.notificationContainer.remove();
        }
        const indicator = document.getElementById('weather-alert-indicator');
        if (indicator) {
            indicator.remove();
        }
        this.isInitialized = false;
    }
}

// Global instance
let weatherAlertsSystem = null;

// Initialize when DOM is loaded
function initWeatherAlerts() {
    if (!weatherAlertsSystem) {
        weatherAlertsSystem = new WeatherAlertsSystem();
    }
}

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWeatherAlerts);
} else {
    initWeatherAlerts();
}

// Export for global use
window.weatherAlertsSystem = weatherAlertsSystem;
window.initWeatherAlerts = initWeatherAlerts;