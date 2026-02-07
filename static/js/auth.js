// Authentication and User Management

let currentUser = null;

// Check authentication status on page load
async function checkAuthStatus() {
    try {
        const data = await fetchJSONWithRetry('/api/auth/status', {
            credentials: 'include'
        }, {
            maxAttempts: 3,
            timeoutMs: 10000
        });
        
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
        const roleText = currentUser.role === 'admin' ? '(Admin)' : '(user)';
        userRoleDisplay.textContent = roleText;
    }
    
    // Remove parameters tab for read-only users
    const parametersTab = document.querySelector('[data-tab="parameters"]');
    if (currentUser.role === 'read-only' && parametersTab) {
        // Remove dom element
        parametersTab.remove();

        //Remove also parameters-tab
        const parametersTabContent = document.getElementById('parameters-tab');
        if (parametersTabContent) {
            parametersTabContent.remove();
        }
    }

    /*// Show/hide parameters tab for read-only users
    const parametersTab = document.querySelector('[data-tab="parameters"]');
    if (currentUser.role === 'read-only' && parametersTab) {
        parametersTab.style.display = 'none';
    }
    
    // Show users tab for admin only
    const usersTabBtn = document.getElementById('users-tab-btn');
    if (currentUser.role === 'admin' && usersTabBtn) {
        usersTabBtn.style.display = 'inline-block';
    }*/
}

// Show default password warning
function showDefaultPasswordWarning() {
    const warningBanner = document.getElementById('default-password-warning');
    if (warningBanner) {
        warningBanner.style.display = 'block';
    }
}

// Logout handler
async function handleLogout(event) {
    // Prevent default link behavior
    event.preventDefault();
    try {
        await fetchJSONWithRetry('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        }, {
            maxAttempts: 1,
            timeoutMs: 10000
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
        const response = await fetchWithRetry('/api/users', {
            credentials: 'include'
        }, {
            maxAttempts: 3,
            timeoutMs: 10000
        });
        
        if (response.status === 401 || response.status === 403) {
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to load users');
        }

        const users = await response.json();
        displayUsers(users);
    } catch (error) {
        console.error('Error loading users:', error);
        showMessage('error', 'Failed to load users');
    }
}

function displayUsers(users) {
    const usersList = document.getElementById('users-list');
    if (!usersList) return;
    
    if (users.length === 0) {
        usersList.innerHTML = '<div class="alert alert-warning">No users found.</div>';
        return;
    }

    const table = document.createElement('div');
    table.className = 'table-responsive';
    
    table.innerHTML = `
        <table class="table table-sm table-hover">
            <thead>
                <tr>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Created</th>
                    <th>Last Login</th>
                    <th class="text-center">Actions</th>
                </tr>
            </thead>
            <tbody id="users-table-body"></tbody>
        </table>
    `;
    
    const tbody = table.querySelector('#users-table-body');
    
    users.forEach(user => {
        const row = document.createElement('tr');
        
        const createdDate = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A';
        const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString() : 'Never';
        
        row.innerHTML = `
            <th>${escapeHtml(user.username)}</th>
            <td>${escapeHtml(user.role)}</td>
            <td>${createdDate}</td>
            <td>${lastLogin}</td>
            <td class="text-center">
                <button class="btn btn-secondary btn-small user-change-password" data-username="${escapeHtml(user.username)}">Change Password</button>
                ${user.username !== currentUser.username ? `<button class="btn btn-danger btn-small user-delete" data-username="${escapeHtml(user.username)}">Delete</button>` : ''}
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
            const response = await fetchWithRetry('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ username, password, role })
            }, {
                maxAttempts: 1,
                timeoutMs: 15000
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showMessage('success', 'User created successfully');
                form.reset();
                loadUsers();
            } else {
                showMessage('error', data.error || 'Failed to create user');
            }
        } catch (error) {
            console.error('Error creating user:', error);
            showMessage('error', 'Failed to create user');
        }
    });
}

// Change password using modal dialog
function changePassword(username) {
    //Prepare modal title
    const titleElement = document.getElementById('modal_lg_close_title');
    titleElement.innerHTML = `🔒 Change Password`;
    
    //Prepare modal content
    const contentElement = document.getElementById('modal_lg_close_body');
    contentElement.innerHTML = `
        <div class="alert alert-info">Change password for user: <strong id="password-modal-username"></strong></div>
                
        <div id="password-modal-error" class="alert alert-danger" style="display: none;"></div>
        
        <form id="password-change-form" class="row g-3">
            <input type="text" id="password-change-username" autocomplete="username" style="display: none;" readonly>
            <div class="col-md-12">
                <label for="new-password-input" class="form-label">New Password:</label>
                <input type="password" id="new-password-input" required minlength="4" 
                        placeholder="Minimum 4 characters" autocomplete="new-password" class="form-control">
            </div>
            <div class="col-md-12">
                <label for="confirm-password-input" class="form-label">Confirm Password:</label>
                <input type="password" id="confirm-password-input" required minlength="4" 
                        placeholder="Re-enter password" autocomplete="new-password" class="form-control">
            </div>
            <div class="col-md-12 d-flex justify-content-end" style="gap: 1rem;">
                <button type="submit" class="btn btn-primary">Change Password</button>
            </div>
        </form>
    `;

    const usernameDisplay = document.getElementById('password-modal-username');
    const usernameInput = document.getElementById('password-change-username');
    const errorDiv = document.getElementById('password-modal-error');
    const form = document.getElementById('password-change-form');
    
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
    
    
    // Display the modal modal_lg_close
    const bs_modal = new bootstrap.Modal('#modal_lg_close', {
        backdrop: 'static',
        focus: true,
        keyboard: true
    });
    bs_modal.show();

    
    setupPasswordChangeModal(bs_modal);
    
    // Store username for form submission
    form.dataset.username = username;
}

// Setup password change modal
function setupPasswordChangeModal(bs_modal) {
    const form = document.getElementById('password-change-form');
    const errorDiv = document.getElementById('password-modal-error');
    
    
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
                const response = await fetchWithRetry(`/api/users/${username}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ password: newPassword })
                }, {
                    maxAttempts: 1,
                    timeoutMs: 15000
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    showMessage('success', 'Password updated successfully');
                    loadUsers();

                    // Close bootstrap modal
                    bs_modal.hide();

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
        const response = await fetchWithRetry(`/api/users/${username}`, {
            method: 'DELETE',
            credentials: 'include'
        }, {
            maxAttempts: 1,
            timeoutMs: 15000
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('success', 'User deleted successfully');
            loadUsers();
        } else {
            showMessage('error', data.error || 'Failed to delete user');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showMessage('error', 'Failed to delete user');
    }
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
        setupGlobalErrorHandler();
    });
} else {
    checkAuthStatus();
    setupLogoutButton();
    setupCreateUserForm();
    setupGlobalErrorHandler();
}
