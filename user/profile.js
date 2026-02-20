/**
 * User Profile Management (Staff)
 */

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Fast Init for local profile page to prevent flickering
    const cachedUser = getCurrentUserFromSession();
    if (cachedUser) {
        updateProfileUI(cachedUser);
    }

    const user = await checkAuth('staff'); // Ensure staff access
    if (!user) return;
    
    currentUser = user;
    updateProfileUI(user);
    
    // Form Listener
    document.getElementById('profile-form').onsubmit = handleProfileUpdate;
});

/**
 * Update Profile Page UI
 */
function updateProfileUI(user) {
    if (!user) return;

    if (user.full_name) {
        const nameEl = document.getElementById('displayUserName');
        if (nameEl) nameEl.textContent = user.full_name;
        
        const profileNameInput = document.getElementById('profile-name');
        if (profileNameInput) profileNameInput.value = user.full_name;
        
        // Update avatar preview
        const avatarImg = document.getElementById('profile-img-preview');
        if (avatarImg) {
            if (user.avatar_url) {
                avatarImg.src = user.avatar_url;
            } else {
                avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=0079d8&color=fff&size=128`;
            }
        }
    }

    const emailInput = document.getElementById('profile-email');
    if (emailInput) emailInput.value = user.email || '';

    const phoneInput = document.getElementById('profile-phone');
    if (phoneInput) phoneInput.value = user.phone || '';
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    
    const fullName = document.getElementById('profile-name').value.trim();
    const phone = document.getElementById('profile-phone').value.trim();
    const avatarFile = document.getElementById('avatar-input').files[0];
    
    const saveBtn = document.getElementById('save-profile-btn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving Changes...';
    saveBtn.disabled = true;

    try {
        let avatarUrl = currentUser.avatar_url;

        // 1. Handle Avatar Upload
        if (avatarFile) {
            const fileExt = avatarFile.name.split('.').pop();
            const filePath = `${currentUser.id}/avatar.${fileExt}`;
            
            const { error: uploadError } = await supabaseApi.uploadImage(avatarFile, filePath);
            if (uploadError) throw uploadError;
            
            avatarUrl = supabaseApi.getPublicUrl(filePath);
        }

        // 2. Update Profile Data
        const { data: updatedProfile, error } = await supabaseApi.updateUserProfile(currentUser.id, {
            ...currentUser,
            full_name: fullName,
            phone: phone,
            avatar_url: avatarUrl
        });

        if (error) throw error;

        // 3. Update State and UI
        currentUser = { ...currentUser, ...updatedProfile };
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        showToast('Profile updated successfully!', 'success');
        
        // Update sidebar and preview
        if (window.initializeSidebarUI) {
            initializeSidebarUI(currentUser);
        }
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showToast('Failed to update profile: ' + error.message, 'error');
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}

async function handlePasswordReset() {
    const newPassword = document.getElementById('profile-password').value;
    
    if (!newPassword || newPassword.length < 6) {
        showToast('Please enter a password with at least 6 characters.', 'warning');
        return;
    }

    const confirmed = await showConfirm('Are you sure you want to change your password?');
    if (!confirmed) return;

    try {
        const { error } = await supabaseClient.auth.updateUser({
            password: newPassword
        });

        if (error) throw error;

        showToast('Password reset successfully!', 'success');
        document.getElementById('profile-password').value = '';
        
    } catch (error) {
        console.error('Error resetting password:', error);
        showToast('Failed to reset password: ' + error.message, 'error');
    }
}

function previewAvatar(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('profile-img-preview').src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}
