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
            this.notificationContainer = document.createElement('div');
            this.notificationContainer.id = 'weather-notifications';
            this.notificationContainer.className = 'weather-notifications-container';
            document.body.appendChild(this.notificationContainer);
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
        
        // Show new high priority alerts as notifications
        highPriorityAlerts.forEach(alert => {
            this.showNotification(alert);
        });
        
        // Update alerts array
        this.alerts = newAlerts;
        
        // Update header alert indicator
        this.updateHeaderAlertIndicator();
    }
    
    showNotification(alert) {
        const notification = document.createElement('div');
        notification.className = `weather-notification ${this.getSeverityClass(alert.severity)}`;
        
        const alertTime = new Date(alert.time);
        const icon = this.getAlertTypeIcon(alert.type);
        
        notification.innerHTML = `
            <div class="weather-notification-content">
                <div class="weather-notification-header">
                    <span class="weather-notification-icon">${icon}</span>
                    <span class="weather-notification-title">${alert.type.replace('_', ' ')}</span>
                    <span class="weather-notification-time">${alertTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
                    <button class="weather-notification-close" onclick="weatherAlertsSystem.closeNotification(this)">×</button>
                </div>
                <div class="weather-notification-message">${alert.message}</div>
            </div>
        `;
        
        // Add to container
        this.notificationContainer.appendChild(notification);
        
        // Auto-hide after 10 seconds for non-critical alerts
        setTimeout(() => {
            if (notification && notification.parentNode) {
                this.closeNotification(notification.querySelector('.weather-notification-close'));
            }
        }, 10000);
        
        // Trigger animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
    }
    
    closeNotification(closeButton) {
        const notification = closeButton.closest('.weather-notification');
        if (notification) {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
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
        // Update or create alert indicator in header
        const header = document.querySelector('header');
        if (!header) return;
        
        let indicator = document.getElementById('weather-alert-indicator');
        
        const activeAlerts = this.alerts.filter(alert => this.isAlertActive(alert));
        
        if (activeAlerts.length > 0) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'weather-alert-indicator';
                indicator.className = 'weather-alert-indicator';
                indicator.onclick = () => this.showAlertsModal();
                header.appendChild(indicator);
            }
            
            const highPriorityCount = activeAlerts.filter(a => a.severity === 'HIGH').length;
            const totalCount = activeAlerts.length;
            
            indicator.innerHTML = `
                <div class="alert-indicator-content">
                    <span class="alert-indicator-icon">⚠️</span>
                    <span class="alert-indicator-count">${totalCount}</span>
                </div>
            `;
            
            indicator.className = `weather-alert-indicator ${highPriorityCount > 0 ? 'high-priority' : 'normal'}`;
            indicator.title = `${totalCount} weather alert(s) - Click to view details`;
            
        } else if (indicator) {
            indicator.remove();
        }
    }
    
    showAlertsModal() {
        // Create and show a modal with all current alerts
        const modal = document.createElement('div');
        modal.className = 'weather-alerts-modal';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'weather-alerts-modal-content';
        
        const activeAlerts = this.alerts.filter(alert => this.isAlertActive(alert));
        
        const alertsHtml = activeAlerts.length > 0 ? 
            activeAlerts.map(alert => {
                const alertTime = new Date(alert.time);
                const icon = this.getAlertTypeIcon(alert.type);
                
                return `
                    <div class="modal-alert-item ${this.getSeverityClass(alert.severity)}">
                        <div class="modal-alert-header">
                            <span class="modal-alert-icon">${icon}</span>
                            <span class="modal-alert-title">${alert.type.replace('_', ' ')}</span>
                            <span class="modal-alert-time">${alertTime.toLocaleString()}</span>
                        </div>
                        <div class="modal-alert-message">${alert.message}</div>
                    </div>
                `;
            }).join('') : 
            '<div class="modal-no-alerts">No active weather alerts</div>';
        
        modalContent.innerHTML = `
            <div class="weather-alerts-modal-header">
                <h3>⚠️ Weather Alerts for Astrophotography</h3>
                <button class="weather-alerts-modal-close" onclick="weatherAlertsSystem.closeAlertsModal()">×</button>
            </div>
            <div class="weather-alerts-modal-body">
                ${alertsHtml}
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Close on backdrop click
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.closeAlertsModal();
            }
        };
        
        setTimeout(() => modal.classList.add('show'), 100);
    }
    
    closeAlertsModal() {
        const modal = document.querySelector('.weather-alerts-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        }
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
    
    getSeverityClass(severity) {
        return `severity-${severity.toLowerCase()}`;
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