// ==========================================================================
// MUKAPUTA — AUTHENTICATION & LOGIN/SIGNUP INTERACTIONS
// ==========================================================================

async function apiCall(method, url, body) {
    const opts = { method, credentials: 'same-origin', headers: {} };
    if (body !== undefined) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }
    try {
        const res = await fetch(url, opts);
        let data = null;
        try { data = await res.json(); } catch (e) { /* no json body */ }
        return { ok: res.ok, status: res.status, data };
    } catch (err) {
        console.error('Network Error:', err);
        return { ok: false, status: 0, data: { error: 'Network error. Please check your connection.' } };
    }
}

window.handleGoogleLogin = function(e, checkboxId, errorId) {
    const cb = document.getElementById(checkboxId);
    if (cb && !cb.checked) {
        e.preventDefault();
        showFormError(errorId, 'You must confirm that you are 18 or older to continue with Google.');
        return false;
    }
    return true;
};

function showFormError(elId, message) {
    const el = document.getElementById(elId);
    if (!el) return;
    const msgSpan = el.querySelector('.error-msg') || el;
    msgSpan.textContent = message;
    el.classList.remove('hidden');
}

function hideFormError(elId) {
    const el = document.getElementById(elId);
    if (el) el.classList.add('hidden');
}

function setButtonLoading(btn, loading) {
    if (!btn) return;
    const textEl = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loader');
    if (textEl) textEl.classList.toggle('hidden', loading);
    if (loader) loader.classList.toggle('hidden', !loading);
    btn.disabled = loading;
    btn.style.pointerEvents = loading ? 'none' : 'auto';
}

// Toast notification helper
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-msg toast-${type}`;
    toast.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            ${type === 'success' 
                ? '<polyline points="20 6 9 17 4 12"></polyline>' 
                : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'}
        </svg>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==========================================================================
// TAB NAVIGATION & AUTH SWITCHING
// ==========================================================================
window.setAuthTab = function(tabName) {
    const tabSignIn = document.getElementById('tabSignIn');
    const tabSignUp = document.getElementById('tabSignUp');
    const tabIndicator = document.getElementById('tabIndicator');
    const signInView = document.getElementById('signInView');
    const signUpView = document.getElementById('signUpView');

    hideFormError('loginError');
    hideFormError('registerError');

    if (tabName === 'signup') {
        if (tabSignIn) {
            tabSignIn.classList.remove('active');
            tabSignIn.setAttribute('aria-selected', 'false');
        }
        if (tabSignUp) {
            tabSignUp.classList.add('active');
            tabSignUp.setAttribute('aria-selected', 'true');
        }
        if (tabIndicator) {
            tabIndicator.style.transform = 'translateX(100%)';
        }
        if (signInView) signInView.classList.add('hidden');
        if (signUpView) signUpView.classList.remove('hidden');
    } else {
        if (tabSignUp) {
            tabSignUp.classList.remove('active');
            tabSignUp.setAttribute('aria-selected', 'false');
        }
        if (tabSignIn) {
            tabSignIn.classList.add('active');
            tabSignIn.setAttribute('aria-selected', 'true');
        }
        if (tabIndicator) {
            tabIndicator.style.transform = 'translateX(0%)';
        }
        if (signUpView) signUpView.classList.add('hidden');
        if (signInView) signInView.classList.remove('hidden');
    }
};

// Toggle form (backwards compatibility for buttons)
window.toggleForm = function() {
    const signInView = document.getElementById('signInView');
    const isSignInVisible = signInView && !signInView.classList.contains('hidden');
    window.setAuthTab(isSignInVisible ? 'signup' : 'signin');
};

// ==========================================================================
// PASSWORD VISIBILITY TOGGLE (EYE ICON)
// ==========================================================================
window.togglePasswordVisibility = function(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input || !btn) return;

    const eyeOpen = btn.querySelector('.eye-open');
    const eyeClosed = btn.querySelector('.eye-closed');

    if (input.type === 'password') {
        input.type = 'text';
        if (eyeOpen) eyeOpen.classList.add('hidden');
        if (eyeClosed) eyeClosed.classList.remove('hidden');
        btn.setAttribute('title', 'Hide password');
    } else {
        input.type = 'password';
        if (eyeOpen) eyeOpen.classList.remove('hidden');
        if (eyeClosed) eyeClosed.classList.add('hidden');
        btn.setAttribute('title', 'Show password');
    }
};

// ==========================================================================
// FORGOT PASSWORD MODAL HANDLERS
// ==========================================================================
window.openForgotPasswordModal = function() {
    const modal = document.getElementById('forgotModal');
    if (modal) modal.classList.remove('hidden');
    const emailInput = document.getElementById('forgotEmail');
    if (emailInput) {
        // Pre-fill from login username if it looks like an email
        const loginUsername = document.getElementById('username');
        if (loginUsername && loginUsername.value.includes('@')) {
            emailInput.value = loginUsername.value;
        }
        setTimeout(() => emailInput.focus(), 100);
    }
};

window.closeForgotPasswordModal = function() {
    const modal = document.getElementById('forgotModal');
    if (modal) modal.classList.add('hidden');
};

window.handleForgotPassword = function(event) {
    event.preventDefault();
    const btn = document.getElementById('forgotSubmitBtn');
    const email = document.getElementById('forgotEmail')?.value.trim();

    if (!email) return;

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Sending...';
    }

    // Simulate recovery email dispatch
    setTimeout(() => {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Send Instructions';
        }
        window.closeForgotPasswordModal();
        showToast(`Password recovery link sent to ${email}`, 'success');
    }, 900);
};

// ==========================================================================
// INITIALIZATION ON DOM READY
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Session check: if user is already authenticated, go to dashboard
    apiCall('GET', '/api/auth/me').then(({ ok }) => {
        if (ok) window.location.href = 'index.html';
    });

    // 2. Generate Ambient Floating Background Lights & Particles
    const container = document.getElementById('canvasContainer');
    if (container) {
        const blob1 = document.createElement('div');
        blob1.className = 'floating-shape shape-1';
        const blob2 = document.createElement('div');
        blob2.className = 'floating-shape shape-2';
        const blob3 = document.createElement('div');
        blob3.className = 'floating-shape shape-3';

        container.appendChild(blob1);
        container.appendChild(blob2);
        container.appendChild(blob3);

        // Small floating cyber particles
        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            const size = Math.random() * 5 + 3;
            particle.style.position = 'absolute';
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.background = Math.random() > 0.5 ? 'rgba(255, 107, 43, 0.45)' : 'rgba(59, 130, 246, 0.35)';
            particle.style.borderRadius = '50%';
            particle.style.left = `${Math.random() * 100}vw`;
            particle.style.top = `${Math.random() * 100}vh`;
            particle.style.filter = 'blur(1px)';
            particle.style.pointerEvents = 'none';

            const duration = Math.random() * 20 + 12;
            const delay = Math.random() * -20;
            particle.style.animation = `floatOrb ${duration}s ${delay}s infinite ease-in-out alternate`;

            container.appendChild(particle);
        }
    }

    // 3. Subtle Parallax on Desktop
    const authCard = document.getElementById('loginCard');
    if (authCard && window.innerWidth >= 1024) {
        document.addEventListener('mousemove', (e) => {
            const x = (e.clientX / window.innerWidth - 0.5) * 8;
            const y = (e.clientY / window.innerHeight - 0.5) * 8;
            authCard.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        });
    }

    // 4. Handle Login Form Submit
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideFormError('loginError');

            const btn = document.getElementById('loginSubmitBtn');
            const identifier = document.getElementById('username')?.value.trim();
            const password = document.getElementById('password')?.value;

            if (!identifier || !password) {
                showFormError('loginError', 'Please enter your username/email and password.');
                return;
            }
            
            const consentCheckbox = document.getElementById('ageConsentSignIn');
            if (consentCheckbox && !consentCheckbox.checked) {
                showFormError('loginError', 'You must confirm that you are 18 or older to sign in.');
                return;
            }

            setButtonLoading(btn, true);
            const { ok, data } = await apiCall('POST', '/api/auth/login', { identifier, password });
            setButtonLoading(btn, false);

            if (ok) {
                showToast('Signed in successfully! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 350);
            } else {
                showFormError('loginError', (data && data.error) || 'Invalid username/email or password.');
            }
        });
    }

    // 5. Handle Register Form Submit
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideFormError('registerError');

            const btn = document.getElementById('registerSubmitBtn');
            const name = document.getElementById('reg-name')?.value.trim();
            const username = document.getElementById('reg-username')?.value.trim();
            const email = document.getElementById('reg-email')?.value.trim();
            const password = document.getElementById('reg-password')?.value;

            if (!name || !email || !password) {
                showFormError('registerError', 'Please fill in your name, email, and password.');
                return;
            }

            if (password.length < 6) {
                showFormError('registerError', 'Password must be at least 6 characters long.');
                return;
            }
            
            const consentCheckbox = document.getElementById('ageConsentSignUp');
            if (consentCheckbox && !consentCheckbox.checked) {
                showFormError('registerError', 'You must confirm that you are 18 or older to create an account.');
                return;
            }

            setButtonLoading(btn, true);
            const { ok, data } = await apiCall('POST', '/api/auth/register', { name, username, email, password });
            setButtonLoading(btn, false);

            if (ok) {
                showToast('Account created successfully! Welcome to Mukaputa.', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 400);
            } else {
                showFormError('registerError', (data && data.error) || 'Could not create account. Please try again.');
            }
        });
    }
});
