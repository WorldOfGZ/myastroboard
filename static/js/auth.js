// Authentication and User Management

let currentUser = null;

// Check authentication status on page load
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/status', {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.authenticated) {
            currentUser = data;
            updateUserInterface();
            
            // Show warning if using default password
            if (data.using_default_password) {
                showDefaultPasswordWarning();
            }
        } else {
            // Not authenticated, redirect to login
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        window.location.href = '/login';
    }
}

// Update UI based on user role
function updateUserInterface() {
    if (!currentUser) return;
    
    // Update header with user info
    const usernameDisplay = document.getElementById('username-display');
    const userRoleDisplay = document.getElementById('user-role');
    
    if (usernameDisplay) {
        usernameDisplay.textContent = currentUser.username;
    }
    
    if (userRoleDisplay) {
        const roleText = currentUser.role === 'admin' ? '(Admin)' : '(Read-Only)';
        userRoleDisplay.textContent = roleText;
    }
    
    // Show/hide parameters tab for read-only users
    const parametersTab = document.querySelector('[data-tab="parameters"]');
    if (currentUser.role === 'read-only' && parametersTab) {
        parametersTab.style.display = 'none';
    }
    
    // Show users tab for admin only
    const usersTabBtn = document.getElementById('users-tab-btn');
    if (currentUser.role === 'admin' && usersTabBtn) {
        usersTabBtn.style.display = 'inline-block';
    }
}

// Show default password warning
function showDefaultPasswordWarning() {
    const warningBanner = document.getElementById('default-password-warning');
    if (warningBanner) {
        warningBanner.style.display = 'block';
    }
}

// Logout handler
async function handleLogout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        window.location.href = '/login';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/login';
    }
}

// Setup logout button
function setupLogoutButton() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

// ============================================================
// User Management (Admin only)
// ============================================================

async function loadUsers() {
    if (currentUser?.role !== 'admin') return;
    
    try {
        const response = await fetch('/api/users', {
            credentials: 'include'
        });
        
        if (response.status === 401 || response.status === 403) {
            window.location.href = '/login';
            return;
        }
        
        const users = await response.json();
        displayUsers(users);
    } catch (error) {
        console.error('Error loading users:', error);
        showNotification('Failed to load users', 'error');
    }
}

function displayUsers(users) {
    const usersList = document.getElementById('users-list');
    if (!usersList) return;
    
    if (users.length === 0) {
        usersList.innerHTML = '<p style="color: #666;">No users found.</p>';
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'users-table';
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    
    table.innerHTML = `
        <thead>
            <tr>
                <th style="text-align: left; padding: 0.75rem; border-bottom: 2px solid #e5e7eb;">Username</th>
                <th style="text-align: left; padding: 0.75rem; border-bottom: 2px solid #e5e7eb;">Role</th>
                <th style="text-align: left; padding: 0.75rem; border-bottom: 2px solid #e5e7eb;">Created</th>
                <th style="text-align: left; padding: 0.75rem; border-bottom: 2px solid #e5e7eb;">Last Login</th>
                <th style="text-align: center; padding: 0.75rem; border-bottom: 2px solid #e5e7eb;">Actions</th>
            </tr>
        </thead>
        <tbody id="users-table-body"></tbody>
    `;
    
    const tbody = table.querySelector('#users-table-body');
    
    users.forEach(user => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid #e5e7eb';
        
        const createdDate = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A';
        const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString() : 'Never';
        
        row.innerHTML = `
            <td style="padding: 0.75rem;">${escapeHtml(user.username)}</td>
            <td style="padding: 0.75rem;">${escapeHtml(user.role)}</td>
            <td style="padding: 0.75rem;">${createdDate}</td>
            <td style="padding: 0.75rem;">${lastLogin}</td>
            <td style="padding: 0.75rem; text-align: center;">
                <button class="btn btn-secondary btn-small user-change-password" data-username="${escapeHtml(user.username)}">Change Password</button>
                ${user.username !== 'admin' ? `<button class="btn btn-danger btn-small user-delete" data-username="${escapeHtml(user.username)}">Delete</button>` : ''}
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    usersList.innerHTML = '';
    usersList.appendChild(table);
    
    // Attach event listeners to buttons
    usersList.querySelectorAll('.user-change-password').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const username = e.target.getAttribute('data-username');
            changePassword(username);
        });
    });
    
    usersList.querySelectorAll('.user-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const username = e.target.getAttribute('data-username');
            deleteUser(username);
        });
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Create user form handler
function setupCreateUserForm() {
    const form = document.getElementById('create-user-form');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('new-username').value;
        const password = document.getElementById('new-password').value;
        const role = document.getElementById('new-role').value;
        
        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ username, password, role })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showNotification('User created successfully', 'success');
                form.reset();
                loadUsers();
            } else {
                showNotification(data.error || 'Failed to create user', 'error');
            }
        } catch (error) {
            console.error('Error creating user:', error);
            showNotification('Failed to create user', 'error');
        }
    });
}

// Change password using modal dialog
function changePassword(username) {
    const modal = document.getElementById('password-modal');
    const usernameDisplay = document.getElementById('password-modal-username');
    const usernameInput = document.getElementById('password-change-username');
    const errorDiv = document.getElementById('password-modal-error');
    const form = document.getElementById('password-change-form');
    const newPasswordInput = document.getElementById('new-password-input');
    const confirmPasswordInput = document.getElementById('confirm-password-input');
    
    // Set username
    if (usernameDisplay) {
        usernameDisplay.textContent = username;
    }
    if (usernameInput) {
        usernameInput.value = username;
    }
    
    // Clear form
    form.reset();
    // Re-set username after reset
    if (usernameInput) {
        usernameInput.value = username;
    }
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
    
    // Show modal
    modal.style.display = 'block';
    
    // Focus on password input
    setTimeout(() => newPasswordInput.focus(), 100);
    
    // Store username for form submission
    form.dataset.username = username;
}

// Setup password change modal
function setupPasswordChangeModal() {
    const modal = document.getElementById('password-modal');
    const closeBtn = document.querySelector('.close-password');
    const cancelBtn = document.getElementById('cancel-password-change');
    const form = document.getElementById('password-change-form');
    const errorDiv = document.getElementById('password-modal-error');
    
    // Close modal on X click
    if (closeBtn) {
        closeBtn.onclick = function() {
            modal.style.display = 'none';
        };
    }
    
    // Close modal on Cancel click
    if (cancelBtn) {
        cancelBtn.onclick = function() {
            modal.style.display = 'none';
        };
    }
    
    // Close modal on outside click
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
    
    // Handle form submission
    if (form) {
        form.onsubmit = async function(e) {
            e.preventDefault();
            
            const username = form.dataset.username;
            const newPassword = document.getElementById('new-password-input').value;
            const confirmPassword = document.getElementById('confirm-password-input').value;
            
            // Validate passwords match
            if (newPassword !== confirmPassword) {
                errorDiv.textContent = 'Passwords do not match';
                errorDiv.style.display = 'block';
                return;
            }
            
            // Validate password length
            if (newPassword.length < 4) {
                errorDiv.textContent = 'Password must be at least 4 characters';
                errorDiv.style.display = 'block';
                return;
            }
            
            try {
                const response = await fetch(`/api/users/${username}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ password: newPassword })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    showNotification('Password updated successfully', 'success');
                    modal.style.display = 'none';
                    loadUsers();
                } else {
                    errorDiv.textContent = data.error || 'Failed to update password';
                    errorDiv.style.display = 'block';
                }
            } catch (error) {
                console.error('Error updating password:', error);
                errorDiv.textContent = 'Failed to update password';
                errorDiv.style.display = 'block';
            }
        };
    }
}

// Delete user
async function deleteUser(username) {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${username}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('User deleted successfully', 'success');
            loadUsers();
        } else {
            showNotification(data.error || 'Failed to delete user', 'error');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showNotification('Failed to delete user', 'error');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'error' ? '#fee' : '#efe'};
        color: ${type === 'error' ? '#c33' : '#363'};
        border-radius: 5px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Error handler - only redirect on authentication failures (401), not authorization (403)
function setupGlobalErrorHandler() {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        
        // Extract URL from fetch arguments for logging
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || 'unknown';
        const method = args[1]?.method || 'GET';
        
        // Only redirect on 401 (Unauthorized - not logged in)
        if (response.status === 401) {
            console.warn(`[Auth] 401 Unauthorized: ${method} ${url} - Redirecting to login`);
            // Only redirect if not already on login page
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }
        
        // Log 403 (Forbidden - insufficient permissions) for debugging
        // Don't redirect - this prevents read-only users from being logged out when they
        // inadvertently trigger admin-only endpoints
        if (response.status === 403) {
            console.warn(
                `[Auth] 403 Forbidden: ${method} ${url}\n` +
                `Reason: Insufficient permissions for this endpoint.\n` +
                `This is expected for read-only users accessing admin-only endpoints.`
            );
        }
        
        return response;
    };
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        checkAuthStatus();
        setupLogoutButton();
        setupCreateUserForm();
        setupPasswordChangeModal();
        setupGlobalErrorHandler();
    });
} else {
    checkAuthStatus();
    setupLogoutButton();
    setupCreateUserForm();
    setupPasswordChangeModal();
    setupGlobalErrorHandler();
}
