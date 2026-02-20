/**
 * Supabase Authentication Logic
 * Replaces localStorage-based auth with Supabase Auth
 */

// Safety shim for global API access
if (typeof supabaseApi === 'undefined' && window.supabaseApi) {
    window.supabaseApi = window.supabaseApi;
} else if (typeof supabaseApi === 'undefined') {
    // If not loaded yet, create a proxy or placeholder to prevent crashes
    window.supabaseApi = window.supabaseApi || {};
}

document.addEventListener('DOMContentLoaded', () => {
    // Fast Sidebar Init from local storage to prevent flickering
    const cachedUser = getCurrentUserFromSession();
    if (cachedUser) {
        initializeSidebarUI(cachedUser);
    }

    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    // --- Login Logic ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const errorMsg = document.getElementById('errorMsg');

            // Show loading state
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Signing in...';
            submitBtn.disabled = true;

            try {
                // Use supabaseClient directly as requested
                const { data, error: authError } = await supabaseClient.auth.signInWithPassword({
                    email,
                    password,
                });

                if (authError) {
                    console.error('Login error details:', authError);
                    let msg = authError.message || 'Invalid email or password';
                    if (msg === 'Failed to fetch') {
                        msg = 'Cannot connect to server. Check your internet connection and try again.';
                    }
                    showError(errorMsg, msg);
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                } else {
                    // Fetch profile manually to use supabaseClient directly
                    const { data: profile, error: profileError } = await supabaseClient
                        .from('users')
                        .select('*')
                        .eq('id', data.user.id)
                        .single();

                    if (profileError) {
                        console.error('Profile fetch error:', profileError);
                        showError(errorMsg, 'Login successful but profile record not found.');
                        submitBtn.textContent = originalText;
                        submitBtn.disabled = false;
                        return;
                    }

                    // Store user session
                    sessionStorage.setItem('isLoggedIn', 'true');
                    sessionStorage.setItem('currentUser', JSON.stringify(profile));
                    redirectBasedOnRole(profile);
                }
            } catch (err) {
                console.error('Unexpected login error:', err);
                showError(errorMsg, 'An unexpected error occurred. Check the browser console for details.');
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // --- Signup Logic ---
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('fullName').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const errorMsg = document.getElementById('errorMsg');

            if (!validateEmail(email)) {
                showError(errorMsg, 'Please enter a valid email');
                return;
            }

            if (password.length < 6) {
                showError(errorMsg, 'Password must be at least 6 characters');
                return;
            }

            // Show loading state
            const submitBtn = signupForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Creating account...';
            submitBtn.disabled = true;

            // Determine role (emails containing 'admin' are admins)
            const role = email.toLowerCase().includes('admin') ? 'admin' : 'staff';

            try {
                // Use supabaseClient directly for signup
                const { data: authData, error: authError } = await supabaseClient.auth.signUp({
                    email,
                    password,
                });

                if (authError) throw authError;

                // Create user profile directly
                const { data: profileData, error: profileError } = await supabaseClient
                    .from('users')
                    .insert([
                        {
                            id: authData.user.id,
                            full_name: fullName,
                            email: email,
                            role: role
                        }
                    ])
                    .select()
                    .single();

                if (profileError) throw profileError;

                const newUser = { ...authData.user, profile: profileData };

                // Store user session
                sessionStorage.setItem('isLoggedIn', 'true');
                sessionStorage.setItem('currentUser', JSON.stringify(newUser.profile));
                
                // Show success message
                showError(errorMsg, 'Account created! Redirecting...', 'success');
                
                setTimeout(() => {
                    redirectBasedOnRole(newUser.profile);
                }, 1500);
            } catch (error) {
                console.error('Sign up error:', error);
                showError(errorMsg, error.message || 'Failed to create account');
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // Check for existing session on page load
    checkExistingSession();
});

/**
 * Check if user has existing session
 */
async function checkExistingSession() {
    try {
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        
        if (session && session.user) {
            // Get profile
            const { data: profile, error: profileError } = await supabaseClient
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (profile && !profileError) {
                sessionStorage.setItem('isLoggedIn', 'true');
                sessionStorage.setItem('currentUser', JSON.stringify(profile));
                return;
            }
        }
        
        sessionStorage.removeItem('isLoggedIn');
        sessionStorage.removeItem('currentUser');
    } catch (err) {
        console.error('Session check error:', err);
    }
}

/**
 * Validate email format
 */
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Show error or success message
 */
function showError(element, message, type = 'error') {
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
        element.style.color = type === 'success' ? '#10b981' : '#ef4444';
        setTimeout(() => element.style.display = 'none', 5000);
    }
}

/**
 * Redirect based on user role and status
 */
function redirectBasedOnRole(user) {
    const isSubdir = window.location.pathname.includes('/admin/') || window.location.pathname.includes('/user/');
    
    // Check for approval status first
    if (user.status !== 'approved' && user.role.toLowerCase() !== 'admin') {
        window.location.href = isSubdir ? '../pending-approval.html' : 'pending-approval.html';
        return;
    }

    if (user.role.toLowerCase() === 'admin') {
        window.location.href = isSubdir ? '../admin/index.html' : 'admin/index.html';
    } else {
        window.location.href = isSubdir ? '../user/index.html' : 'user/index.html';
    }
}

/**
 * Auth Guard - Protect pages requiring authentication
 * @param {string} requiredRole - 'admin' or 'user'
 */
async function checkAuth(requiredRole) {
    const isSubdir = window.location.pathname.includes('/admin/') || window.location.pathname.includes('/user/');
    const loginPage = isSubdir ? '../signin.html' : 'signin.html';
    const pendingPage = isSubdir ? '../pending-approval.html' : 'pending-approval.html';

    // Check Supabase session directly
    const { data: { session }, error: authError } = await supabaseClient.auth.getSession();

    if (authError || !session || !session.user) {
        sessionStorage.removeItem('isLoggedIn');
        sessionStorage.removeItem('currentUser');
        window.location.href = loginPage;
        return null;
    }

    // Get user profile directly
    const { data: profile, error: profileError } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (profileError || !profile) {
        sessionStorage.removeItem('isLoggedIn');
        sessionStorage.removeItem('currentUser');
        window.location.href = loginPage;
        return null;
    }

    // Check approval status (Admins are usually auto-approved or bypass)
    if (profile.status !== 'approved' && profile.role.toLowerCase() !== 'admin') {
        // If they are on a page that isn't the pending page, redirect them
        if (!window.location.pathname.includes('pending-approval.html')) {
            window.location.href = pendingPage;
            return null;
        }
    }

    // Update session storage
    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.setItem('currentUser', JSON.stringify(profile));

    // Check role permission
    if (requiredRole && profile.role.toLowerCase() !== requiredRole.toLowerCase()) {
        await showAlert('Access Denied: Insufficient permissions', 'Security Alert');
        window.location.href = loginPage;
        return null;
    }

    // Initialize Sidebar UI
    initializeSidebarUI(profile);

    return profile;
}

/**
 * Initialize Sidebar with user info
 */
function initializeSidebarUI(user) {
    if (!user) return;
    
    // Update Name
    const nameEl = document.getElementById('displayUserName');
    if (nameEl && user.full_name) {
        nameEl.textContent = user.full_name;
    }

    // Update Role
    const roleEl = document.getElementById('displayUserRole');
    if (roleEl && user.role) {
        roleEl.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    }

    // Update Avatar
    const avatarContainer = document.querySelector('.user-profile .user-avatar');
    if (avatarContainer) {
        if (user.avatar_url) {
            avatarContainer.innerHTML = `<img src="${user.avatar_url}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        } else if (user.full_name) {
            const initialsUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=0079d8&color=fff&size=64`;
            avatarContainer.innerHTML = `<img src="${initialsUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        }
    }
}

/**
 * Logout user
 */
async function logout() {
    await supabaseClient.auth.signOut();
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('currentUser');
    
    const isSubdir = window.location.pathname.includes('/admin/') || window.location.pathname.includes('/user/');
    window.location.href = isSubdir ? '../signin.html' : 'signin.html';
}

/**
 * Get current user from session
 */
function getCurrentUserFromSession() {
    const userStr = sessionStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
}
