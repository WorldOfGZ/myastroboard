/**
 * Events Alert System for MyAstroBoard
 * 
 * Displays upcoming astronomical events as alerts/banners on the dashboard
 * with options to share as images on social media
 */

const API_ENDPOINT_EVENTS = `${API_BASE}/api/events/upcoming`;

// Cache for events data
let cachedEvents = null;
let lastEventsUpdate = null;
const EVENTS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Initialize events alert system
 */
function initializeEventsSystem() {
    loadAndDisplayEvents();
    
    // Refresh events periodically
    setInterval(loadAndDisplayEvents, 10 * 60 * 1000); // Every 10 minutes
}

/**
 * Load upcoming events from API
 */
async function loadAndDisplayEvents() {
    try {
        // Check cache first
        const now = new Date().getTime();
        if (cachedEvents && lastEventsUpdate && (now - lastEventsUpdate) < EVENTS_CACHE_DURATION) {
            displayEvents(cachedEvents);
            return;
        }

        const response = await fetch(API_ENDPOINT_EVENTS);
        
        if (!response.ok) {
            console.warn(`Failed to fetch events: ${response.status}`);
            return;
        }

        const eventsData = await response.json();
        cachedEvents = eventsData;
        lastEventsUpdate = new Date().getTime();
        
        displayEvents(eventsData);
    } catch (error) {
        console.error("Error loading events:", error);
    }
}

/**
 * Display events in the alerts container
 */
function displayEvents(eventsData) {
    const container = document.getElementById('events-alerts-container');
    if (!container) {
        console.warn("Events alert container not found in DOM");
        return;
    }

    // Clear existing alerts
    container.innerHTML = '';

    // Check if we have any upcoming events
    const nextEvent = eventsData.next_event;
    const eventsIn7Days = eventsData.events_next_7_days || [];

    if (!nextEvent && eventsIn7Days.length === 0) {
        // No events to display
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    // Display next event prominently if within 30 days and visible
    if (nextEvent && nextEvent.days_until_event <= 30 && nextEvent.visibility) {
        const alertCard = createEventAlertCard(nextEvent, true);
        container.appendChild(alertCard);
    }

    // Display upcoming events in next 7 days (only visible events)
    const visibleEvents = eventsIn7Days.filter(event => event.visibility);
    if (visibleEvents.length > 0) {
        const sectionTitle = document.createElement('div');
        sectionTitle.className = 'event-section-title mt-3 mb-2';
        sectionTitle.innerHTML = '<small class="text-muted">📅 Upcoming Events (Next 7 Days)</small>';
        container.appendChild(sectionTitle);

        const eventsGrid = document.createElement('div');
        eventsGrid.className = 'events-grid row';

        visibleEvents.slice(0, 3).forEach(event => {
            const col = document.createElement('div');
            col.className = 'col-md-4 mb-2';
            col.appendChild(createEventSummaryCard(event));
            eventsGrid.appendChild(col);
        });

        container.appendChild(eventsGrid);
    }
}

/**
 * Create a prominent alert card for the most important event
 */
function createEventAlertCard(event, isProminent = false) {
    const card = document.createElement('div');
    card.className = `alert alert-${getImportanceColorClass(event.importance)} mb-3`;
    card.setAttribute('role', 'alert');

    const daysText = getDaysUntilText(event.days_until_event);

    const header = document.createElement('div');
    header.className = 'd-flex justify-content-between align-items-start';

    const titleDiv = document.createElement('div');
    titleDiv.innerHTML = `
        <div style="font-size: 1.5em; margin-bottom: 0.5rem;">
            ${event.emoji} <strong>${event.title}</strong>
        </div>
        <div style="font-size: 0.95em; color: inherit; opacity: 0.9;">
            ${event.description}
        </div>
    `;

    const infoDiv = document.createElement('div');
    infoDiv.className = 'text-end ms-3';
    infoDiv.innerHTML = `
        <div style="font-weight: bold; font-size: 1.1em;">${daysText}</div>
    `;

    header.appendChild(titleDiv);
    header.appendChild(infoDiv);
    card.appendChild(header);

    // Add timing information if available
    if (event.peak_time) {
        const timingDiv = document.createElement('div');
        timingDiv.className = 'mt-2 small';
        timingDiv.style.opacity = '0.9';
        
        const peakDate = new Date(event.peak_time);
        const timeStr = peakDate.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
        const dateStr = peakDate.toLocaleDateString('en-US', { 
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        });

        timingDiv.innerHTML = `📅 ${dateStr} at ${timeStr}`;
        card.appendChild(timingDiv);
    }

    // Add action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'mt-3 d-flex gap-2';
    
    const learnMoreButton = document.createElement('a');
    learnMoreButton.className = 'btn btn-sm sub-tab-btn active';
    learnMoreButton.href = '#';
    learnMoreButton.innerHTML = '📖 Details';
    learnMoreButton.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToEventDetails(event.event_type);
    });
    actionsDiv.appendChild(learnMoreButton);

    card.appendChild(actionsDiv);

    return card;
}

/**
 * Create a summary card for an event in the grid
 */
function createEventSummaryCard(event) {
    const card = document.createElement('div');
    card.className = 'card h-100 event-summary-card';
    card.style.borderLeft = `4px solid var(--bs-${getImportanceColorClass(event.importance)})`;

    const body = document.createElement('div');
    body.className = 'card-body p-3';

    const title = document.createElement('h6');
    title.className = 'card-title mb-1';
    title.innerHTML = `${event.emoji} ${event.title}`;
    body.appendChild(title);

    const daysText = getDaysUntilText(event.days_until_event);
    const days = document.createElement('small');
    days.className = 'text-muted d-block mb-2';
    days.textContent = daysText;
    body.appendChild(days);

    const desc = document.createElement('small');
    desc.className = 'd-block mb-2';
    desc.textContent = event.description.substring(0, 80) + '...';
    body.appendChild(desc);

    card.appendChild(body);

    return card;
}

/**
 * Get CSS color class based on event importance
 */
function getImportanceColorClass(importance) {
    const colorMap = {
        'critical': 'primary',
        'high': 'info',
        'medium': 'secondary',
        'low': 'light'
    };
    return colorMap[importance] || 'info';
}

/**
 * Get human-readable text for days until event
 */
function getDaysUntilText(daysUntil) {
    if (daysUntil < 0) return 'Happening now!';
    if (daysUntil === 0) return 'Today!';
    if (daysUntil === 1) return 'Tomorrow!';
    if (daysUntil <= 7) return `In ${daysUntil} days`;
    return `In ${daysUntil} days`;
}

/**
 * Generate and download shareable image for an event
 */
/**
 * Scroll to event details section
 */
function scrollToEventDetails(eventType) {
    let subTabName = '';
    
    if (eventType.includes('Eclipse')) {
        subTabName = eventType.includes('Solar') ? 'sun' : 'moon';
    } else if (eventType === 'Aurora') {
        subTabName = 'aurora';
    } else if (eventType === 'Moon Phase') {
        subTabName = 'moon';
    }

    if (subTabName) {
        // First, make sure the main "Astrophotography" tab is active
        const mainTab = document.querySelector('[data-tab="forecast-astro"]');
        if (mainTab) {
            mainTab.click();
        }
        
        // Then trigger the sub-tab switch
        setTimeout(() => {
            const subTab = document.querySelector(`[data-subtab="${subTabName}"]`);
            if (subTab) {
                subTab.click();
                // Scroll to top after tab switch
                setTimeout(() => window.scrollTo(0, 0), 100);
            }
        }, 100);
    }
}

/**
 * Show loading indicator
 */
function showLoadingIndicator(message = 'Loading...') {
    const container = document.getElementById('events-alerts-container');
    if (!container) return;

    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'events-loading-indicator';
    loadingDiv.className = 'alert alert-info';
    loadingDiv.innerHTML = `
        <div class="spinner-border spinner-border-sm" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>
        <span class="ps-3">${message}</span>
    `;
    container.appendChild(loadingDiv);
}

/**
 * Hide loading indicator
 */
function hideLoadingIndicator() {
    const loadingDiv = document.getElementById('events-loading-indicator');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

/**
 * Show alert message
 */
function showAlert(message, type = 'info') {
    const container = document.getElementById('events-alerts-container');
    if (!container) return;

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.setAttribute('role', 'alert');
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    container.appendChild(alertDiv);

    // Auto-close in 5 seconds
    setTimeout(() => {
        const closeBtn = alertDiv.querySelector('.btn-close');
        if (closeBtn) closeBtn.click();
    }, 5000);
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', initializeEventsSystem);
