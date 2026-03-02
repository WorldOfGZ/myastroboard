// System Metrics Functions

let metricsUpdateInterval = null;

// ======================
// System Metrics
// ======================

async function loadSystemMetrics() {
    try {
        const data = await fetchJSON('/api/metrics');
        
        if (!data) return;
        
        // Update CPU metrics
        updateProgressBar('cpu-usage-bar', data.cpu.percent);
        document.getElementById('cpu-logical').textContent = data.cpu.count_logical || 'N/A';
        document.getElementById('cpu-physical').textContent = data.cpu.count_physical || 'N/A';
        
        if (data.cpu.frequency && data.cpu.frequency.current) {
            document.getElementById('cpu-frequency').textContent = 
                `${(data.cpu.frequency.current / 1000).toFixed(2)} GHz`;
        } else {
            document.getElementById('cpu-frequency').textContent = 'N/A';
        }
        
        // Update Memory metrics
        updateProgressBar('memory-usage-bar', data.memory.percent);
        document.getElementById('memory-used').textContent = formatBytes(data.memory.used);
        document.getElementById('memory-total').textContent = formatBytes(data.memory.total);
        
        // Update Swap metrics
        updateProgressBar('swap-usage-bar', data.swap.percent);
        document.getElementById('swap-used').textContent = formatBytes(data.swap.used);
        document.getElementById('swap-total').textContent = formatBytes(data.swap.total);
        
        // Update Disk metrics
        updateProgressBar('disk-usage-bar', data.disk.percent);
        document.getElementById('disk-used').textContent = formatBytes(data.disk.used);
        document.getElementById('disk-total').textContent = formatBytes(data.disk.total);
        document.getElementById('disk-free').textContent = formatBytes(data.disk.free);
        
        // Update System info
        document.getElementById('platform-system').textContent = 
            `${data.platform.system} ${data.platform.release}`;
        document.getElementById('platform-release').textContent = data.platform.version;
        document.getElementById('platform-machine').textContent = data.platform.machine;
        document.getElementById('platform-python').textContent = data.platform.python_version;
        
        // Update status
        document.getElementById('system-uptime').textContent = formatUptime(data.uptime.seconds);
        document.getElementById('process-count').textContent = data.process.count;
        document.getElementById('network-sent').textContent = formatBytes(data.network.bytes_sent);
        document.getElementById('network-recv').textContent = formatBytes(data.network.bytes_recv);
        
    } catch (error) {
        console.error('Error loading system metrics:', error);
    }
}

function updateProgressBar(elementId, percent) {
    const bar = document.getElementById(elementId);
    if (!bar) return;
    
    const roundedPercent = Math.round(percent * 10) / 10;
    bar.style.width = `${roundedPercent}%`;
    bar.setAttribute('aria-valuenow', roundedPercent);
    bar.textContent = `${roundedPercent}%`;
    
    // Color coding
    bar.className = 'progress-bar';
    if (percent >= 90) {
        bar.classList.add('bg-danger');
    } else if (percent >= 75) {
        bar.classList.add('bg-warning');
    } else {
        bar.classList.add('bg-success');
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    
    return parts.length > 0 ? parts.join(' ') : '< 1m';
}

function startMetricsAutoRefresh() {
    // Clear any existing interval
    if (metricsUpdateInterval) {
        clearInterval(metricsUpdateInterval);
    }
    
    // Load immediately
    loadSystemMetrics();
    
    // Set up auto-refresh every 5 seconds
    metricsUpdateInterval = setInterval(loadSystemMetrics, 5000);
}

function stopMetricsAutoRefresh() {
    if (metricsUpdateInterval) {
        clearInterval(metricsUpdateInterval);
        metricsUpdateInterval = null;
    }
}
