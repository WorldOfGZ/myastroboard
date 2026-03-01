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

// Get current user role from api
async function getUserRole() {
    try {
        const data = await fetchJSONWithRetry('/api/auth/status', {
            credentials: 'include'
        }, {
            maxAttempts: 3,
            timeoutMs: 10000
        });
        
        if (data.authenticated) {
            return data.role;
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        return null;
    }
}

// Update UI based on user role
function updateUserInterface() {
    if (!currentUser) return;

    //console.log(`[Auth] Logged in as: ${currentUser.username} (Role: ${currentUser.role})`);
    //console.log(`[Auth] currentUser: ${JSON.stringify(currentUser)}`);
    
    // Update header with user info
    const usernameDisplay = document.getElementById('username-display');
    
    if (usernameDisplay) {
        usernameDisplay.textContent = currentUser.username;
    }
    
    // Remove parameters tab for read-only and regular users
    const parametersTab = document.querySelector('[data-tab="parameters"]');
    if ((currentUser.role === 'read-only' || currentUser.role === 'user') && parametersTab) {
        // Remove dom element
        parametersTab.remove();

        //Remove also parameters-tab
        const parametersTabContent = document.getElementById('parameters-tab');
        if (parametersTabContent) {
            parametersTabContent.remove();
        }
    }

    // Remove some tabs for read-only users
    if (currentUser.role === 'read-only') {
        // Remove equipment tab
        const equipmentLink = document.querySelector('[data-tab="equipment"]');
        const equipmentTabContent = document.getElementById('equipment-tab');
        if (equipmentLink) {
            equipmentLink.remove();
        }
        if (equipmentTabContent) {
            equipmentTabContent.remove();
        }
        // Remove astrodex button add button
        const addAstrodexBtn = document.getElementById('add-astrodex-item');
        if (addAstrodexBtn) {
            addAstrodexBtn.remove();
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
        DOMUtils.clear(usersList);
        const alert = document.createElement('div');
        alert.className = 'alert alert-warning';
        alert.textContent = 'No users found.';
        usersList.appendChild(alert);
        return;
    }

    const table = document.createElement('div');
    table.className = 'table-responsive';

    const tableElement = document.createElement('table');
    tableElement.className = 'table table-sm table-hover';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headers = [
        { text: 'Username' },
        { text: 'Role' },
        { text: 'Created', className: 'd-none d-md-table-cell' },
        { text: 'Last Login', className: 'd-none d-md-table-cell' },
        { text: 'Actions', className: 'text-center' }
    ];
    headers.forEach((header) => {
        const th = document.createElement('th');
        th.textContent = header.text;
        if (header.className) {
            th.className = header.className;
        }
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    const tbody = document.createElement('tbody');
    tbody.id = 'users-table-body';
    tableElement.appendChild(thead);
    tableElement.appendChild(tbody);
    table.appendChild(tableElement);
    
    users.forEach(user => {
        const row = document.createElement('tr');
        
        const createdDate = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A';
        const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString() : 'Never';
        
        const isCurrentUser = user.user_id === currentUser?.user_id;

        const usernameCell = document.createElement('th');
        usernameCell.textContent = user.username;

        const roleCell = document.createElement('td');
        roleCell.textContent = user.role;

        const createdCell = document.createElement('td');
        createdCell.className = 'd-none d-md-table-cell';
        createdCell.textContent = createdDate;

        const lastLoginCell = document.createElement('td');
        lastLoginCell.className = 'd-none d-md-table-cell';
        lastLoginCell.textContent = lastLogin;

        const actionsCell = document.createElement('td');
        actionsCell.className = 'text-center';

        const createActionButton = ({ className, userId, username, role, text }) => {
            const button = document.createElement('button');
            button.className = className;
            button.setAttribute('data-user-id', userId);
            button.setAttribute('data-username', username);
            if (role) {
                button.setAttribute('data-role', role);
            }
            button.textContent = text;
            return button;
        };

        actionsCell.appendChild(createActionButton({
            className: 'btn btn-primary btn-small user-edit-username mb-2',
            userId: user.user_id,
            username: user.username,
            text: '✏️ Username'
        }));

        if (!isCurrentUser) {
            actionsCell.appendChild(createActionButton({
                className: 'btn btn-info btn-small user-edit-role mb-2',
                userId: user.user_id,
                username: user.username,
                role: user.role,
                text: '🔑 Role'
            }));
        }

        actionsCell.appendChild(createActionButton({
            className: 'btn btn-secondary btn-small user-change-password mb-2',
            userId: user.user_id,
            username: user.username,
            text: '🔒 Password'
        }));

        if (!isCurrentUser) {
            actionsCell.appendChild(createActionButton({
                className: 'btn btn-danger btn-small user-delete mb-2',
                userId: user.user_id,
                username: user.username,
                text: '🗑️ Delete'
            }));
        }

        row.appendChild(usernameCell);
        row.appendChild(roleCell);
        row.appendChild(createdCell);
        row.appendChild(lastLoginCell);
        row.appendChild(actionsCell);
        
        tbody.appendChild(row);
    });
    
    DOMUtils.clear(usersList);
    usersList.appendChild(table);
    
    // Attach event listeners to buttons
    usersList.querySelectorAll('.user-edit-username').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const userId = e.target.getAttribute('data-user-id');
            const username = e.target.getAttribute('data-username');
            editUsername(userId, username);
        });
    });
    
    usersList.querySelectorAll('.user-edit-role').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const userId = e.target.getAttribute('data-user-id');
            const username = e.target.getAttribute('data-username');
            const role = e.target.getAttribute('data-role');
            editRole(userId, username, role);
        });
    });
    
    usersList.querySelectorAll('.user-change-password').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const userId = e.target.getAttribute('data-user-id');
            const username = e.target.getAttribute('data-username');
            changePassword(userId, username);
        });
    });
    
    usersList.querySelectorAll('.user-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const userId = e.target.getAttribute('data-user-id');
            const username = e.target.getAttribute('data-username');
            deleteUser(userId, username);
        });
    });
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

// Edit username using modal dialog
function editUsername(userId, currentUsername) {
    const titleElement = document.getElementById('modal_lg_close_title');
    titleElement.textContent = '✏️ Edit Username';
    
    const contentElement = document.getElementById('modal_lg_close_body');
    DOMUtils.clear(contentElement);

    const infoAlert = document.createElement('div');
    infoAlert.className = 'alert alert-info';
    infoAlert.append('Edit username for: ');
    const strong = document.createElement('strong');
    strong.textContent = currentUsername;
    infoAlert.appendChild(strong);

    const errorAlert = document.createElement('div');
    errorAlert.id = 'username-modal-error';
    errorAlert.className = 'alert alert-danger';
    errorAlert.style.display = 'none';

    const form = document.createElement('form');
    form.id = 'username-edit-form';
    form.className = 'row g-3';

    const hiddenUserId = document.createElement('input');
    hiddenUserId.type = 'hidden';
    hiddenUserId.id = 'edit-user-id';
    hiddenUserId.value = userId;

    const fieldCol = document.createElement('div');
    fieldCol.className = 'col-md-12';
    const label = document.createElement('label');
    label.className = 'form-label';
    label.setAttribute('for', 'new-username-input');
    label.textContent = 'New Username:';
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'new-username-input';
    input.required = true;
    input.minLength = 3;
    input.placeholder = 'Minimum 3 characters';
    input.autocomplete = 'username';
    input.className = 'form-control';
    input.value = currentUsername;
    fieldCol.appendChild(label);
    fieldCol.appendChild(input);

    const actionsCol = document.createElement('div');
    actionsCol.className = 'col-md-12 d-flex justify-content-end';
    actionsCol.style.gap = '1rem';
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = 'Save Username';
    actionsCol.appendChild(submitBtn);

    form.appendChild(hiddenUserId);
    form.appendChild(fieldCol);
    form.appendChild(actionsCol);

    contentElement.appendChild(infoAlert);
    contentElement.appendChild(errorAlert);
    contentElement.appendChild(form);
    
    const bs_modal = new bootstrap.Modal('#modal_lg_close', {
        backdrop: 'static',
        focus: true,
        keyboard: true
    });
    bs_modal.show();
    
    const formElement = document.getElementById('username-edit-form');
    const errorDiv = document.getElementById('username-modal-error');
    
    formElement.onsubmit = async function(e) {
        e.preventDefault();
        
        const newUsername = document.getElementById('new-username-input').value;
        const userId = document.getElementById('edit-user-id').value;
        
        if (newUsername === currentUsername) {
            errorDiv.textContent = 'Username unchanged';
            errorDiv.style.display = 'block';
            return;
        }
        
        if (newUsername.length < 3) {
            errorDiv.textContent = 'Username must be at least 3 characters';
            errorDiv.style.display = 'block';
            return;
        }
        
        try {
            const response = await fetchWithRetry(`/api/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ username: newUsername })
            }, {
                maxAttempts: 1,
                timeoutMs: 15000
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showMessage('success', 'Username updated successfully');
                loadUsers();
                bs_modal.hide();
            } else {
                errorDiv.textContent = data.error || 'Failed to update username';
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Error updating username:', error);
            errorDiv.textContent = 'Failed to update username';
            errorDiv.style.display = 'block';
        }
    };
}

// Edit user role using modal dialog
function editRole(userId, username, currentRole) {
    const titleElement = document.getElementById('modal_lg_close_title');
    titleElement.textContent = '🔑 Edit User Role';
    
    const contentElement = document.getElementById('modal_lg_close_body');
    DOMUtils.clear(contentElement);

    const infoAlert = document.createElement('div');
    infoAlert.className = 'alert alert-info';
    infoAlert.append('Edit role for: ');
    const strong = document.createElement('strong');
    strong.textContent = username;
    infoAlert.appendChild(strong);

    const errorAlert = document.createElement('div');
    errorAlert.id = 'role-modal-error';
    errorAlert.className = 'alert alert-danger';
    errorAlert.style.display = 'none';

    const form = document.createElement('form');
    form.id = 'role-edit-form';
    form.className = 'row g-3';

    const hiddenUserId = document.createElement('input');
    hiddenUserId.type = 'hidden';
    hiddenUserId.id = 'edit-user-id';
    hiddenUserId.value = userId;

    const selectCol = document.createElement('div');
    selectCol.className = 'col-md-12';
    const label = document.createElement('label');
    label.className = 'form-label';
    label.setAttribute('for', 'new-role-select');
    label.textContent = 'New Role:';
    const select = document.createElement('select');
    select.id = 'new-role-select';
    select.className = 'form-select';
    select.required = true;

    [
        { value: 'admin', text: 'Admin' },
        { value: 'user', text: 'User' },
        { value: 'read-only', text: 'Read-Only' }
    ].forEach((optionData) => {
        const option = document.createElement('option');
        option.value = optionData.value;
        option.textContent = optionData.text;
        option.selected = optionData.value === currentRole;
        select.appendChild(option);
    });

    selectCol.appendChild(label);
    selectCol.appendChild(select);

    const actionsCol = document.createElement('div');
    actionsCol.className = 'col-md-12 d-flex justify-content-end';
    actionsCol.style.gap = '1rem';
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = 'Save Role';
    actionsCol.appendChild(submitBtn);

    form.appendChild(hiddenUserId);
    form.appendChild(selectCol);
    form.appendChild(actionsCol);

    contentElement.appendChild(infoAlert);
    contentElement.appendChild(errorAlert);
    contentElement.appendChild(form);
    
    const bs_modal = new bootstrap.Modal('#modal_lg_close', {
        backdrop: 'static',
        focus: true,
        keyboard: true
    });
    bs_modal.show();
    
    const formElement = document.getElementById('role-edit-form');
    const errorDiv = document.getElementById('role-modal-error');
    
    formElement.onsubmit = async function(e) {
        e.preventDefault();
        
        const newRole = document.getElementById('new-role-select').value;
        const userId = document.getElementById('edit-user-id').value;
        
        if (newRole === currentRole) {
            errorDiv.textContent = 'Role unchanged';
            errorDiv.style.display = 'block';
            return;
        }
        
        try {
            const response = await fetchWithRetry(`/api/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ role: newRole })
            }, {
                maxAttempts: 1,
                timeoutMs: 15000
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showMessage('success', 'Role updated successfully');
                loadUsers();
                bs_modal.hide();
            } else {
                errorDiv.textContent = data.error || 'Failed to update role';
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Error updating role:', error);
            errorDiv.textContent = 'Failed to update role';
            errorDiv.style.display = 'block';
        }
    };
}

// Change password using modal dialog
function changePassword(userId, username) {
    //Prepare modal title
    const titleElement = document.getElementById('modal_lg_close_title');
    titleElement.textContent = '🔒 Change Password';
    
    //Prepare modal content
    const contentElement = document.getElementById('modal_lg_close_body');
    DOMUtils.clear(contentElement);

    const infoAlert = document.createElement('div');
    infoAlert.className = 'alert alert-info';
    infoAlert.append('Change password for user: ');
    const strong = document.createElement('strong');
    strong.id = 'password-modal-username';
    infoAlert.appendChild(strong);

    const errorAlert = document.createElement('div');
    errorAlert.id = 'password-modal-error';
    errorAlert.className = 'alert alert-danger';
    errorAlert.style.display = 'none';

    const form = document.createElement('form');
    form.id = 'password-change-form';
    form.className = 'row g-3';

    const hiddenUserId = document.createElement('input');
    hiddenUserId.type = 'hidden';
    hiddenUserId.id = 'password-change-user-id';
    hiddenUserId.value = userId;

    const hiddenUsername = document.createElement('input');
    hiddenUsername.type = 'text';
    hiddenUsername.id = 'password-change-username';
    hiddenUsername.autocomplete = 'username';
    hiddenUsername.style.display = 'none';
    hiddenUsername.readOnly = true;
    hiddenUsername.value = username;

    const newPasswordCol = document.createElement('div');
    newPasswordCol.className = 'col-md-12';
    const newPasswordLabel = document.createElement('label');
    newPasswordLabel.className = 'form-label';
    newPasswordLabel.setAttribute('for', 'new-password-input');
    newPasswordLabel.textContent = 'New Password:';
    const newPasswordInput = document.createElement('input');
    newPasswordInput.type = 'password';
    newPasswordInput.id = 'new-password-input';
    newPasswordInput.required = true;
    newPasswordInput.minLength = 4;
    newPasswordInput.placeholder = 'Minimum 4 characters';
    newPasswordInput.autocomplete = 'new-password';
    newPasswordInput.className = 'form-control';
    newPasswordCol.appendChild(newPasswordLabel);
    newPasswordCol.appendChild(newPasswordInput);

    const confirmPasswordCol = document.createElement('div');
    confirmPasswordCol.className = 'col-md-12';
    const confirmPasswordLabel = document.createElement('label');
    confirmPasswordLabel.className = 'form-label';
    confirmPasswordLabel.setAttribute('for', 'confirm-password-input');
    confirmPasswordLabel.textContent = 'Confirm Password:';
    const confirmPasswordInput = document.createElement('input');
    confirmPasswordInput.type = 'password';
    confirmPasswordInput.id = 'confirm-password-input';
    confirmPasswordInput.required = true;
    confirmPasswordInput.minLength = 4;
    confirmPasswordInput.placeholder = 'Re-enter password';
    confirmPasswordInput.autocomplete = 'new-password';
    confirmPasswordInput.className = 'form-control';
    confirmPasswordCol.appendChild(confirmPasswordLabel);
    confirmPasswordCol.appendChild(confirmPasswordInput);

    const actionsCol = document.createElement('div');
    actionsCol.className = 'col-md-12 d-flex justify-content-end';
    actionsCol.style.gap = '1rem';
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = 'Change Password';
    actionsCol.appendChild(submitBtn);

    form.appendChild(hiddenUserId);
    form.appendChild(hiddenUsername);
    form.appendChild(newPasswordCol);
    form.appendChild(confirmPasswordCol);
    form.appendChild(actionsCol);

    contentElement.appendChild(infoAlert);
    contentElement.appendChild(errorAlert);
    contentElement.appendChild(form);

    const usernameDisplay = document.getElementById('password-modal-username');
    const usernameInput = document.getElementById('password-change-username');
    const errorDiv = document.getElementById('password-modal-error');
    const formElement = document.getElementById('password-change-form');
    
    // Set username
    if (usernameDisplay) {
        usernameDisplay.textContent = username;
    }
    if (usernameInput) {
        usernameInput.value = username;
    }
    
    // Clear form
    formElement.reset();
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
    
    setupPasswordChangeModal(bs_modal, userId);
}

// Setup password change modal
function setupPasswordChangeModal(bs_modal, userId) {
    const form = document.getElementById('password-change-form');
    const errorDiv = document.getElementById('password-modal-error');
    
    
    // Handle form submission
    if (form) {
        form.onsubmit = async function(e) {
            e.preventDefault();
            
            const userId = document.getElementById('password-change-user-id').value;
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
                const response = await fetchWithRetry(`/api/users/${userId}`, {
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
async function deleteUser(userId, username) {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
        return;
    }
    
    try {
        const response = await fetchWithRetry(`/api/users/${userId}`, {
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
