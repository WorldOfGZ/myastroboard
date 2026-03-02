// Log Management Functions

// ======================
// Application Logs
// ======================

async function loadLogs() {
    try {
        const logLevelElement = document.getElementById('log-level');
        const logLimitElement = document.getElementById('log-limit');
        
        if (!logLevelElement || !logLimitElement) {
            console.error('Log filter elements not found');
            return;
        }
        
        const level = logLevelElement.value;
        const limit = logLimitElement.value;
        const data = await fetchJSON(`/api/logs?level=${level}&limit=${limit}`);
        
        const logsContainer = document.getElementById('logs-display');
        if (!logsContainer) {
            console.error('Logs display container not found');
            return;
        }
        
        DOMUtils.clear(logsContainer);
        
        if (data.logs && data.logs.length > 0) {
            // Add log info header
            const logInfo = document.createElement('div');
            logInfo.className = 'log-info-header';
            const strong = document.createElement('strong');
            strong.textContent = `Showing ${data.showing} of ${data.total} log entries`;
            logInfo.appendChild(strong);
            logsContainer.appendChild(logInfo);
            
            // Display logs in chronological order (newest last)
            data.logs.forEach(log => {
                const logEntry = document.createElement('div');
                logEntry.className = 'log-entry';
                
                if (log.includes('ERROR') || log.includes('CRITICAL')) {
                    logEntry.classList.add('log-error');
                } else if (log.includes('WARNING')) {
                    logEntry.classList.add('log-warning');
                } else if (log.includes('INFO')) {
                    logEntry.classList.add('log-info');
                } else if (log.includes('DEBUG')) {
                    logEntry.classList.add('log-debug');
                }
                
                logEntry.textContent = log;
                logsContainer.appendChild(logEntry);
            });
            
            // Auto-scroll to bottom to show latest logs
            logsContainer.scrollTop = logsContainer.scrollHeight;
        } else {
            DOMUtils.clear(logsContainer);
            const empty = document.createElement('div');
            empty.className = 'log-empty';
            empty.textContent = 'No logs available yet';
            logsContainer.appendChild(empty);
        }
    } catch (error) {
        console.error('Error loading logs:', error);
        const logsDisplay = document.getElementById('logs-display');
        if (logsDisplay) {
            DOMUtils.clear(logsDisplay);
            const error = document.createElement('div');
            error.className = 'log-error';
            error.textContent = 'Error loading logs';
            logsDisplay.appendChild(error);
        }
    }
}

async function clearLogsDisplay() {
    await fetchJSON('/api/logs/clear', {
        method: 'POST'
    });

    showMessage("success", "Logs cleared");

    const logsDisplay = document.getElementById('logs-display');
    if (logsDisplay) {
        DOMUtils.clear(logsDisplay);
        const empty = document.createElement('div');
        empty.className = 'log-empty';
        empty.textContent = 'Logs cleared (refresh to reload)';
        logsDisplay.appendChild(empty);
    }
}
