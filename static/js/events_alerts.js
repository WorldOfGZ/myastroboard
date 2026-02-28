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
 * Display events in the alerts container & timeline section
 */
function displayEvents(eventsData) {
    const container = document.getElementById('events-alerts-container');
    if (!container) {
        console.warn("Events alert container not found in DOM");
        return;
    }

    const timelineContainer = document.getElementById('calendar-display');
    if (!timelineContainer) {
        console.warn("Events timeline container not found in DOM");
        return;
    }

    // Clear existing alerts
    container.innerHTML = '';
    timelineContainer.innerHTML = '';

    // Check if we have any upcoming events
    const nextEvent = eventsData.next_event;
    const eventsIn30Days = eventsData.events_next_30_days || [];    
    const visibleEvents = eventsIn30Days.filter(event => event.visibility);
    //const visibleEvents = eventsIn30Days; // Debug to see some events regardless of visibility for now

    //console.log("Events data received:", eventsData);
    //console.log("Next event:", nextEvent);
    //console.log("All events in next 30 days:", eventsIn30Days);
    //console.log("Visible events in next 30 days:", visibleEvents);


    // TIMELINE EVENTS MANAGEMENTS
    // No events to display in timeline
    if (!nextEvent || eventsIn30Days.length === 0) {
        const noEventsMsg = document.createElement('div');
        noEventsMsg.className = 'alert alert-info';
        noEventsMsg.innerHTML = 'No significant astronomical events in the next 30 days.';
        timelineContainer.appendChild(noEventsMsg);

    // Events to display in timeline 
    } else {
        // Create event timeline
        const eventTimelineItems = createEventTimeline(eventsIn30Days);        
        timelineContainer.appendChild(eventTimelineItems);
    }

    // BANNER EVENTS MANAGEMENT
    // If no next event or no visible events, hide the events banner
    if (!nextEvent || visibleEvents.length === 0) {
        // No events to display
        container.style.display = 'none';
        return;
    }

    // Show the events banner
    container.style.display = 'block';

    // Display next event prominently if within 30 days and visible
    if (visibleEvents && visibleEvents.length > 0) {
        //Take first visible event as the most important one to display
        const alertCard = createEventAlertCard(visibleEvents[0]);
        container.appendChild(alertCard);
    }
}

/**
 * Create a prominent alert card for the most important event
 */
function createEventAlertCard(event) {
    const card = document.createElement('div');
    card.className = `alert alert-info mb-3`;
    card.setAttribute('role', 'alert');

    const header = document.createElement('div');

    const titleDiv = document.createElement('div');
    titleDiv.innerHTML = `
        <h4 class="alert-heading">
            ${event.emoji} <strong>${event.title}</strong>
        </h4>
        <h6>
            ${event.description}
        </h6>
    `;

    header.appendChild(titleDiv);
    card.appendChild(header);

    // Add timing information if available
    if (event.peak_time && event.days_until_event !== undefined) {
        const timingDiv = document.createElement('div');
        timingDiv.className = 'mt-2 small';

        timingDiv.innerHTML = `📅 ${formatTimeThenDate(new Date(event.peak_time))} - ${getDaysUntilText(event.days_until_event)}`;
        card.appendChild(timingDiv);
    }

    // Add action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'float-end';
    
    const learnMoreButton = document.createElement('a');
    learnMoreButton.className = 'btn btn-sm sub-tab-btn active';
    learnMoreButton.href = '#';
    learnMoreButton.innerHTML = '📖 Details';
    learnMoreButton.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToEventDetails(event.event_type);
    });
    actionsDiv.appendChild(learnMoreButton);

    //card.appendChild(actionsDiv);
    //Put actionDiv at first position to make it more visible
    card.insertBefore(actionsDiv, card.firstChild);

    return card;
}

/**
 * Create timeline items for a list of events
 */
function createEventTimeline(events) {
    const timelineListUl = document.createElement('ul');
    timelineListUl.className = 'timeline-with-icons ms-3';

    events.forEach(event => {
        const item = document.createElement('li');
        item.className = 'timeline-item mb-3 rounded p-2 ps-3';

        // Icon
        const iconSpan = document.createElement('span');
        iconSpan.className = 'timeline-icon';
        iconSpan.textContent = event.emoji ?? '';
        // Class following the event visibility true/false
        if (event.visibility) {
            iconSpan.classList.add('bg-success');
            var labelVisible = '<span class="badge bg-success ms-2 bg-opacity-75">Visible</span>';
        } else {
            iconSpan.classList.add('bg-danger');
            var labelVisible = '<span class="badge bg-danger ms-2 bg-opacity-75">Invisible</span>';
        }
        // Add opacity to bg
        iconSpan.classList.add('bg-opacity-75');
        item.appendChild(iconSpan);

        // Title
        const title = document.createElement('h5');
        title.className = 'fw-bold';
        title.innerHTML = `${event.title} ${labelVisible ?? ''}`;
        item.appendChild(title);

        // Add timing information if available
        if (event.peak_time && event.days_until_event !== undefined) {
            const date = document.createElement('p');
            date.className = 'text-muted fw-bold';
            date.textContent = `📅 ${formatTimeThenDate(new Date(event.peak_time))} - ${getDaysUntilText(event.days_until_event)}`;
            item.appendChild(date);
        }

        // Description
        const description = document.createElement('p');
        description.className = 'text-muted';
        description.textContent = event.description ?? '';
        item.appendChild(description);

        timelineListUl.appendChild(item);
    });

    return timelineListUl;
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

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', initializeEventsSystem);
