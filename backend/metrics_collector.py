"""
System metrics collection module.
Provides container/VM-aware metrics with detailed disk space tracking and process monitoring.
"""
import os
import psutil
import platform
from datetime import datetime
from logging_config import get_logger
from constants import DATA_DIR, OUTPUT_DIR, CONFIG_DIR

logger = get_logger(__name__)


def is_running_in_container():
    """
    Detect if running in Docker/LXC container or virtual machine.
    Returns tuple: (is_container, container_type)
    """
    # Check for Docker
    if os.path.exists('/.dockerenv'):
        return True, 'Docker'
    
    if os.path.exists('/run/.containerenv'):
        return True, 'Podman'
    
    # Check cgroup for container detection
    try:
        with open('/proc/1/cgroup', 'r') as f:
            cgroup = f.read()
            if 'docker' in cgroup:
                return True, 'Docker'
            if 'lxc' in cgroup:
                return True, 'LXC'
            if 'kubepods' in cgroup:
                return True, 'Kubernetes'
            if 'systemd-nspawn' in cgroup:
                return True, 'systemd-nspawn'
    except (FileNotFoundError, IOError):
        pass
    
    # Check for hypervisor (VM detection)
    try:
        with open('/proc/cpuinfo', 'r') as f:
            cpuinfo = f.read()
            if 'hypervisor' in cpuinfo:
                return True, 'Virtual Machine'
    except (FileNotFoundError, IOError):
        pass
    
    return False, None


def get_folder_disk_usage(folder_path):
    """
    Calculate total disk usage for a folder and its subfolders.
    Returns size in bytes or None if folder doesn't exist.
    """
    if not os.path.exists(folder_path):
        return None
    
    try:
        total_size = 0
        for dirpath, dirnames, filenames in os.walk(folder_path):
            for filename in filenames:
                filepath = os.path.join(dirpath, filename)
                if os.path.exists(filepath):
                    total_size += os.path.getsize(filepath)
        return total_size
    except (OSError, IOError) as e:
        logger.warning(f"Error calculating disk usage for {folder_path}: {e}")
        return None


def get_disk_space_details():
    """
    Get detailed disk space information for important folders.
    Returns dict with folder paths, sizes, and percentages of root filesystem.
    """
    try:
        # Get root filesystem info
        root_disk = psutil.disk_usage('/')
        
        folders = {
            'data': DATA_DIR,
            'data/cache': os.path.join(DATA_DIR, 'cache'),
            'data/astrodex': os.path.join(DATA_DIR, 'astrodex'),
            'data/equipments': os.path.join(DATA_DIR, 'equipments'),
            'uptonight_configs': CONFIG_DIR,
            'uptonight_outputs': OUTPUT_DIR,
        }
        
        folder_usage = {}
        total_tracked = 0
        
        for folder_name, folder_path in folders.items():
            size = get_folder_disk_usage(folder_path)
            if size is not None:
                folder_usage[folder_name] = {
                    'bytes': size,
                    'percent_of_root': round((size / root_disk.total * 100), 2) if root_disk.total > 0 else 0
                }
                total_tracked += size
            else:
                folder_usage[folder_name] = {
                    'bytes': 0,
                    'percent_of_root': 0
                }
        
        return {
            'root': {
                'total': root_disk.total,
                'used': root_disk.used,
                'free': root_disk.free,
                'percent': root_disk.percent
            },
            'folders': folder_usage,
            'total_tracked': total_tracked
        }
    except Exception as e:
        logger.error(f"Error getting disk space details: {e}")
        return {
            'root': {
                'total': 0,
                'used': 0,
                'free': 0,
                'percent': 0
            },
            'folders': {},
            'total_tracked': 0
        }


def get_process_details():
    """
    Get detailed information about the current process.
    Returns memory, file descriptor, and thread information.
    """
    try:
        current_process = psutil.Process(os.getpid())
        
        # Memory info
        mem_info = current_process.memory_info()
        mem_percent = current_process.memory_percent()
        
        # File descriptors (Linux only)
        num_fds = None
        try:
            num_fds_method = getattr(current_process, 'num_fds', None)
            if num_fds_method and callable(num_fds_method):
                num_fds = num_fds_method()
        except (AttributeError, psutil.NoSuchProcess):
            pass
        
        # Threads
        num_threads = current_process.num_threads()
        
        # CPU times
        cpu_times = current_process.cpu_times()
        
        # Process status
        status = current_process.status()
        
        return {
            'pid': os.getpid(),
            'name': current_process.name(),
            'status': status,
            'memory': {
                'rss': mem_info.rss,  # Resident Set Size
                'vms': mem_info.vms,  # Virtual Memory Size
                'percent': mem_percent
            },
            'cpu': {
                'user_time': cpu_times.user,
                'system_time': cpu_times.system
            },
            'threads': num_threads,
            'file_descriptors': num_fds,
            'created_at': datetime.fromtimestamp(current_process.create_time()).isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting process details: {e}")
        # Return structure with default values to avoid frontend errors
        return {
            'pid': os.getpid(),
            'name': 'unknown',
            'status': 'unknown',
            'memory': {
                'rss': 0,
                'vms': 0,
                'percent': 0
            },
            'cpu': {
                'user_time': 0,
                'system_time': 0
            },
            'threads': 0,
            'file_descriptors': 0,
            'created_at': datetime.now().isoformat(),
            'error': str(e)
        }


def collect_metrics():
    """
    Collect all system metrics with container/VM detection.
    Returns comprehensive metrics dictionary.
    """
    try:
        # Detect environment
        is_container, container_type = is_running_in_container()
        
        # CPU Information
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count_logical = psutil.cpu_count(logical=True)
        cpu_count_physical = psutil.cpu_count(logical=False)
        cpu_freq = psutil.cpu_freq()
        
        # Memory Information
        memory = psutil.virtual_memory()
        swap = psutil.swap_memory()
        
        # Disk Information
        disk = psutil.disk_usage('/')
        
        # Process Information
        process_count = len(psutil.pids())
        current_process = get_process_details()
        
        # Main process info
        boot_time = psutil.boot_time()
        uptime_seconds = datetime.now().timestamp() - boot_time
        
        # Network stats
        net_io = psutil.net_io_counters()
        
        # Platform info
        platform_info = {
            'system': platform.system(),
            'release': platform.release(),
            'version': platform.version(),
            'machine': platform.machine(),
            'processor': platform.processor(),
            'python_version': platform.python_version()
        }
        
        # Disk space details
        disk_details = get_disk_space_details()
        
        return {
            'environment': {
                'is_container': is_container,
                'container_type': container_type
            },
            'cpu': {
                'percent': cpu_percent,
                'count_logical': cpu_count_logical,
                'count_physical': cpu_count_physical,
                'frequency': {
                    'current': cpu_freq.current if cpu_freq else None,
                    'min': cpu_freq.min if cpu_freq else None,
                    'max': cpu_freq.max if cpu_freq else None
                } if cpu_freq else None
            },
            'memory': {
                'total': memory.total,
                'available': memory.available,
                'used': memory.used,
                'percent': memory.percent,
                'free': memory.free
            },
            'swap': {
                'total': swap.total,
                'used': swap.used,
                'free': swap.free,
                'percent': swap.percent
            },
            'disk': {
                'root': {
                    'total': disk.total,
                    'used': disk.used,
                    'free': disk.free,
                    'percent': disk.percent
                },
                'details': disk_details
            },
            'process': {
                'system_count': process_count,
                'current_process': current_process
            },
            'uptime': {
                'seconds': uptime_seconds,
                'boot_time': boot_time
            },
            'network': {
                'bytes_sent': net_io.bytes_sent,
                'bytes_recv': net_io.bytes_recv,
                'packets_sent': net_io.packets_sent,
                'packets_recv': net_io.packets_recv
            },
            'platform': platform_info
        }
    except Exception as e:
        logger.error(f"Error collecting metrics: {e}", exc_info=True)
        return {
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }
