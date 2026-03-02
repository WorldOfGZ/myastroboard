const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');
const loginBtn = document.getElementById('login-btn');
const btnText = loginBtn.querySelector('.btn-text');

function showMessage(element, message, duration = 0) {
    element.textContent = message;
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
        btnText.textContent = '🔄 Signing In...';
    } else {
        loginBtn.classList.remove('loading');
        btnText.textContent = '🚀 Sign In';
    }
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const rememberMeCheckbox = document.getElementById('remember-me');
    const rememberMe = rememberMeCheckbox ? rememberMeCheckbox.checked : false;
    
    if (!username || !password) {
        showMessage(errorMessage, 'Please enter both username and password');
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
            showMessage(successMessage, 'Login successful! Redirecting...', 2000);
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        } else {
            setLoading(false);
            showMessage(errorMessage, data.error || 'Login failed');
            
            // Focus password field for retry
            document.getElementById('password').select();
        }
    } catch (error) {
        setLoading(false);
        showMessage(errorMessage, 'Network error. Please check your connection and try again.');
        console.error('Login error:', error);
    }
});

// Auto-hide error messages after 5 seconds
document.addEventListener('DOMContentLoaded', () => {
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