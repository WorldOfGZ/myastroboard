// System Metrics Functions

let metricsUpdateInterval = null;

// ======================
// System Metrics
// ======================

async function loadSystemMetrics() {
    try {
        const data = await fetchJSON('/api/metrics');
        
        if (!data) {
            console.warn('No metrics data received');
            return;
        }
        
        console.debug('Metrics data received:', data);
        
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
        
        // Update Disk metrics (from root filesystem)
        if (data.disk && data.disk.root) {
            updateProgressBar('disk-usage-bar', data.disk.root.percent);
            document.getElementById('disk-used').textContent = formatBytes(data.disk.root.used);
            document.getElementById('disk-total').textContent = formatBytes(data.disk.root.total);
            document.getElementById('disk-free').textContent = formatBytes(data.disk.root.free);
        }
        
        // Update folder disk usage (from disk.details, not disk.root.details)
        if (data.disk && data.disk.details && data.disk.details.folders) {
            updateFolderMetrics(data.disk.details.folders);
        }
        
        // Update System info
        document.getElementById('platform-system').textContent = 
            `${data.platform.system} ${data.platform.release}`;
        document.getElementById('platform-release').textContent = data.platform.version;
        document.getElementById('platform-machine').textContent = data.platform.machine;
        document.getElementById('platform-python').textContent = data.platform.python_version;
        
        // Update status
        document.getElementById('system-uptime').textContent = formatUptime(data.uptime.seconds);
        document.getElementById('process-count').textContent = (data.process.system_count !== undefined && data.process.system_count !== null) ? data.process.system_count : '-';
        document.getElementById('network-sent').textContent = formatBytes(data.network.bytes_sent);
        document.getElementById('network-recv').textContent = formatBytes(data.network.bytes_recv);
        
        console.debug('Process data:', data.process);
        
        // Update Container/VM detection
        if (data.environment) {
            updateEnvironmentMetrics(data.environment);
        }
        
        // Update Process details
        if (data.process && data.process.current_process) {
            console.debug('Current process data:', data.process.current_process);
            updateProcessMetrics(data.process.current_process);
        } else {
            console.warn('No current_process data available');
        }
        
    } catch (error) {
        console.error('Error loading system metrics:', error);
    }
}

function updateFolderMetrics(folders) {
    const folderMap = {
        'data': 'data',
        'data/cache': 'cache',
        'data/astrodex': 'astrodex',
        'data/equipments': 'equipments',
        'uptonight_configs': 'configs',
        'uptonight_outputs': 'outputs'
    };
    
    for (const [folderPath, folderKey] of Object.entries(folderMap)) {
        const folderData = folders[folderPath];
        if (folderData) {
            const barId = `folder-${folderKey}-bar`;
            const sizeId = `folder-${folderKey}-size`;
            
            const bar = document.getElementById(barId);
            const sizeElement = document.getElementById(sizeId);
            
            if (bar && sizeElement) {
                const percent = folderData.percent_of_root || 0;
                updateProgressBar(barId, percent);
                sizeElement.textContent = formatBytes(folderData.bytes || 0);
            }
        }
    }
}

function updateEnvironmentMetrics(environment) {
    const statusElement = document.getElementById('container-status');
    const badgeElement = document.getElementById('container-badge');
    const typeElement = document.getElementById('container-type');
    
    if (environment.is_container) {
        statusElement.textContent = 'Yes';
        badgeElement.style.display = 'inline-block';
        badgeElement.className = 'badge bg-info';
        badgeElement.textContent = environment.container_type || 'Unknown';
        typeElement.textContent = environment.container_type || 'Unknown container detected';
    } else {
        statusElement.textContent = 'No';
        badgeElement.style.display = 'none';
        typeElement.textContent = 'Not running in container (bare metal or VM)';
    }
}

function updateProcessMetrics(processData) {
    if (!processData) {
        console.warn('No process data provided to updateProcessMetrics');
        return;
    }
    
    console.debug('Updating process metrics with data:', processData);
    
    // Process Info
    document.getElementById('process-pid').textContent = processData.pid || '-';
    document.getElementById('process-name').textContent = processData.name || '-';
    document.getElementById('process-status').textContent = processData.status || '-';
    
    // Memory - Show usage bar and details
    const memoryRss = processData.memory?.rss;
    const memoryVms = processData.memory?.vms;
    const memoryPercent = processData.memory?.percent;
    
    if (memoryPercent !== undefined && memoryPercent !== null) {
        updateProgressBar('process-memory-bar', memoryPercent);
        document.getElementById('process-memory-info').textContent = 
            `${memoryPercent.toFixed(2)}% (${formatBytes(memoryRss)} / ${formatBytes(memoryVms)})`;
    } else {
        document.getElementById('process-memory-bar').style.width = '0%';
        document.getElementById('process-memory-info').textContent = '-';
    }
    
    // Memory details
    document.getElementById('process-memory-vms').textContent = 
        memoryVms ? formatBytes(memoryVms) : '-';
    document.getElementById('process-memory-rss').textContent = 
        memoryRss ? formatBytes(memoryRss) : '-';
    
    // CPU Time - Show with visualization
    const cpuUser = processData.cpu?.user_time;
    const cpuSystem = processData.cpu?.system_time;
    
    console.debug('CPU times - user:', cpuUser, 'system:', cpuSystem);
    
    // Handle undefined/null values for CPU times
    const cpuUserValue = (cpuUser !== undefined && cpuUser !== null) ? cpuUser : 0;
    const cpuSystemValue = (cpuSystem !== undefined && cpuSystem !== null) ? cpuSystem : 0;
    const totalCpuTime = cpuUserValue + cpuSystemValue;
    
    // For visualization, show the relative proportion (cap at 100 seconds for reasonable visualization)
    const cpuDisplayMax = 100;
    const userPercent = Math.min(cpuUserValue / cpuDisplayMax * 100, 100);
    const systemPercent = Math.min(cpuSystemValue / cpuDisplayMax * 100, 100);
    
    // Display actual values or "-" if truly undefined from backend
    document.getElementById('process-cpu-user').textContent = 
        (cpuUser !== undefined && cpuUser !== null) ? `${cpuUser.toFixed(2)}s` : '-';
    document.getElementById('process-cpu-system').textContent = 
        (cpuSystem !== undefined && cpuSystem !== null) ? `${cpuSystem.toFixed(2)}s` : '-';
    
    // Update CPU time bars
    updateProgressBar('process-cpu-user-bar', userPercent);
    updateProgressBar('process-cpu-system-bar', systemPercent);
    
    // Threads and File Descriptors
    document.getElementById('process-threads').textContent = processData.threads || '-';
    document.getElementById('process-fds').textContent = processData.file_descriptors || '-';
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
    if (bytes === null || bytes === undefined) return '-';
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
