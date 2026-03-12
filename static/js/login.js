const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');
const loginBtn = document.getElementById('login-btn');
const btnText = loginBtn.querySelector('.btn-text');

function setIconLabel(element, iconClass, text) {
    if (!element) {
        return;
    }
    element.replaceChildren();
    const icon = document.createElement('i');
    icon.className = `${iconClass} icon-inline`;
    icon.setAttribute('aria-hidden', 'true');
    element.appendChild(icon);
    element.appendChild(document.createTextNode(text));
}

function applyLoginTranslations() {
    if (typeof i18n === 'undefined') {
        return;
    }

    const elements = document.querySelectorAll('[data-i18n], [data-i18n-placeholder], [data-i18n-title]');
    elements.forEach((element) => {
        const textKey = element.getAttribute('data-i18n');
        const placeholderKey = element.getAttribute('data-i18n-placeholder');
        const titleKey = element.getAttribute('data-i18n-title');

        if (textKey) {
            element.textContent = i18n.t(textKey);
        }

        if (placeholderKey && 'placeholder' in element) {
            element.placeholder = i18n.t(placeholderKey);
        }

        if (titleKey) {
            element.setAttribute('title', i18n.t(titleKey));
        }
    });

    document.title = i18n.t('auth.login_page_title');

    if (!loginBtn.classList.contains('loading')) {
        setIconLabel(btnText, 'bi bi-rocket-takeoff', i18n.t('auth.sign_in'));
    }
}

async function initializeLoginI18n() {
    if (typeof i18n === 'undefined') {
        return;
    }

    // Ensure selected language resources are available before applying translations.
    await i18n.loadLanguage(i18n.getCurrentLanguage(), { activate: false, persistSelection: false });
    applyLoginTranslations();

    // Translate labels username and password after translations are loaded
    const usernameLabel = document.getElementById('username-label');
    const passwordLabel = document.getElementById('password-label');
    setIconLabel(usernameLabel, 'bi bi-person-circle', i18n.t('users.username'));
    setIconLabel(passwordLabel, 'bi bi-shield-lock', i18n.t('users.password'));
}

function showMessage(element, message, duration = 0) {
    element.replaceChildren();

    if (element === errorMessage) {
        const icon = document.createElement('i');
        icon.className = 'bi bi-exclamation-triangle-fill text-warning icon-inline';
        icon.setAttribute('aria-hidden', 'true');
        element.appendChild(icon);
    } else if (element === successMessage) {
        const icon = document.createElement('i');
        icon.className = 'bi bi-check-circle-fill text-success icon-inline';
        icon.setAttribute('aria-hidden', 'true');
        element.appendChild(icon);
    }

    element.appendChild(document.createTextNode(message));
    element.classList.add('show');
    
    if (duration > 0) {
        setTimeout(() => {
            element.classList.remove('show');
        }, duration);
    }
}

function hideMessages() {
    errorMessage.classList.remove('show');
    successMessage.classList.remove('show');
}

function setLoading(isLoading) {
    loginBtn.disabled = isLoading;
    if (isLoading) {
        loginBtn.classList.add('loading');
        btnText.textContent = i18n.t('auth.signing_in');
    } else {
        loginBtn.classList.remove('loading');
        setIconLabel(btnText, 'bi bi-rocket-takeoff', i18n.t('auth.sign_in'));
    }
}

function translateLoginErrorMessage(apiError, statusCode, errorKey = null) {
    if (errorKey) {
        return i18n.t(errorKey);
    }

    const normalizedError = (apiError || '').toString().trim().toLowerCase();
    const messageMap = {
        'invalid credentials': 'auth.invalid_credentials',
        'username and password required': 'auth.enter_username_password',
        'internal server error': 'auth.internal_server_error'
    };

    const mappedKey = messageMap[normalizedError];
    if (mappedKey) {
        return i18n.t(mappedKey);
    }

    if (statusCode === 401) {
        return i18n.t('auth.invalid_credentials');
    }

    if (statusCode === 400) {
        return i18n.t('auth.enter_username_password');
    }

    if (statusCode >= 500) {
        return i18n.t('auth.internal_server_error');
    }

    return apiError || i18n.t('auth.login_failed_generic');
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const rememberMeCheckbox = document.getElementById('remember-me');
    const rememberMe = rememberMeCheckbox ? rememberMeCheckbox.checked : false;
    
    if (!username || !password) {
        showMessage(errorMessage, i18n.t('auth.enter_username_password'));
        return;
    }
    
    hideMessages();
    setLoading(true);
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ username, password, remember_me: rememberMe })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage(successMessage, i18n.t('auth.login_success_redirecting'), 2000);
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        } else {
            setLoading(false);
            showMessage(errorMessage, translateLoginErrorMessage(data?.error, response.status, data?.error_key));
            
            // Focus password field for retry
            document.getElementById('password').select();
        }
    } catch (error) {
        setLoading(false);
        showMessage(errorMessage, i18n.t('auth.network_error_retry'));
        console.error('Login error:', error);
    }
});

// Auto-hide error messages after 5 seconds
document.addEventListener('DOMContentLoaded', () => {
    initializeLoginI18n();

    window.addEventListener('i18nLanguageChanged', () => {
        applyLoginTranslations();
    });

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                if (target === errorMessage && target.classList.contains('show')) {
                    setTimeout(() => {
                        target.classList.remove('show');
                    }, 5000);
                }
            }
        });
    });
    
    observer.observe(errorMessage, { attributes: true });
});