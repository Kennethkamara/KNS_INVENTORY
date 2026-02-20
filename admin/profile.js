/**
 * Admin Profile Management
 */

let currentAdmin = null;

document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth('admin');
    if (!user) return;
    
    currentAdmin = user;
    
    // Set UI names
    if (user.full_name) {
        document.getElementById('displayUserName').textContent = user.full_name;
        document.getElementById('profile-name').value = user.full_name;
        // Update avatar if needed
        const avatarImg = document.getElementById('profile-img-preview');
        avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=0079d8&color=fff&size=128`;
    }

    document.getElementById('profile-email').value = user.email || '';
    // document.getElementById('profile-phone').value = user.phone || ''; // If field exists

    // Form Listener
    document.getElementById('profile-form').onsubmit = handleProfileUpdate;
});

async function handleProfileUpdate(e) {
    e.preventDefault();
    
    const fullName = document.getElementById('profile-name').value.trim();
    const phone = document.getElementById('profile-phone').value.trim();
    
    const saveBtn = document.getElementById('save-profile-btn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving Changes...';
    saveBtn.disabled = true;

    try {
        const { error } = await supabaseApi.updateUserProfile(currentAdmin.id, {
            full_name: fullName,
            email: currentAdmin.email // Keep email for consistency
        });

        if (error) throw error;

        showToast('Profile updated successfully!', 'success');
        
        // Update sidebar name
        document.getElementById('displayUserName').textContent = fullName;
        
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
