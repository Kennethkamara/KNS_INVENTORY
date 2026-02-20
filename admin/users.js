/**
 * Users Management with Supabase
 */

let allUsers = [];
let currentStep = 1;
let isEditMode = false;
let editingUserId = null;
let currentAdminId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth('admin');
    if (!user) return;
    
    currentAdminId = user.id;
    document.querySelector('.user-name').textContent = user.full_name;
    
    await loadDynamicOptions();
    await loadUsers();
});

// --- Dynamic Options ---
let distinctDepartments = [];

async function loadDynamicOptions() {
    const { data } = await supabaseApi.getDistinctDepartments();
    if (data) distinctDepartments = data;
    
    populateDepartmentDropdowns();
}

function populateDepartmentDropdowns() {
    const defaultDepartments = ['BroadConnect', 'KNS College', 'KNS Office', 'KNS Test Center', 'Warehouse / Store', 'Administration'];
    const finalDepartments = [...new Set([...defaultDepartments, ...distinctDepartments])].sort();

    const depts = [
        document.getElementById('user-dept'),
        document.getElementById('edit-user-dept')
    ];

    depts.forEach(select => {
        if (!select) return;
        const isEdit = select.id === 'edit-user-dept';
        select.innerHTML = `<option value="">${isEdit ? 'Select Department' : '-select-'}</option>`;
        finalDepartments.forEach(dept => {
            select.innerHTML += `<option value="${dept}">${dept}</option>`;
        });
        if (!isEdit) select.innerHTML += '<option value="-add-new-">-add new-</option>';
    });
}

async function checkNewUserOption(select, type) {
    if (select.value === '-add-new-') {
        const newValue = await showPrompt(`Enter new ${type} name:`, '', `New ${type}`);
        if (newValue && newValue.trim() !== '') {
            const trimmedValue = newValue.trim();
            const option = document.createElement('option');
            option.value = trimmedValue;
            option.textContent = trimmedValue;
            select.insertBefore(option, select.lastElementChild);
            select.value = trimmedValue;

            // Update the other dropdown as well
            const otherSelectId = select.id === 'user-dept' ? 'edit-user-dept' : 'user-dept';
            const otherSelect = document.getElementById(otherSelectId);
            if (otherSelect) {
                const otherOption = document.createElement('option');
                otherOption.value = trimmedValue;
                otherOption.textContent = trimmedValue;
                if (otherSelectId === 'edit-user-dept') {
                    otherSelect.appendChild(otherOption);
                } else {
                    otherSelect.insertBefore(otherOption, otherSelect.lastElementChild);
                }
            }
        } else {
            select.value = '';
        }
    }
}

async function loadUsers() {
    const { data, error } = await supabaseApi.getAllUsers();
    
    if (error) {
        console.error('Error loading users:', error);
        showToast('Failed to load users', 'error');
        return;
    }
    
    allUsers = data || [];
    displayUsers(allUsers);
}

// ============================================
// MODAL FUNCTIONS
// ============================================

// --- ADD USER (Keep existing wizard) ---
// --- ADD USER (Multi-step Wizard) ---
function openUserModal() {
    const modal = document.getElementById('user-modal');
    const form = document.getElementById('user-form');
    
    // Reset form and step
    form.reset();
    currentStep = 1;
    showStep(1);
    
    // Clear summaries
    document.querySelectorAll('.confirmation-value').forEach(el => el.textContent = '');
    
    document.getElementById('modal-title').textContent = 'Add New User';
    modal.classList.add('show');
}

function closeUserModal() {
    document.getElementById('user-modal').classList.remove('show');
    currentStep = 1;
}

function showStep(step) {
    currentStep = step;
    
    // Toggle step content
    document.querySelectorAll('.user-step').forEach(el => {
        el.classList.remove('active');
        if (parseInt(el.dataset.step) === step) el.classList.add('active');
    });

    // Toggle indicator
    document.querySelectorAll('.step-indicator-step').forEach(el => {
        const stepNum = parseInt(el.dataset.step);
        el.classList.remove('active', 'completed');
        if (stepNum === step) el.classList.add('active');
        if (stepNum < step) el.classList.add('completed');
    });

    // Footer controls
    const backBtn = document.getElementById('user-back-btn');
    const nextBtn = document.getElementById('user-next-btn');
    const submitBtn = document.getElementById('user-submit-btn');
    const cancelBtn = document.getElementById('user-cancel-btn');
    const footer = document.getElementById('wizard-footer');

    if (step === 4) {
        // Success screen - hide all standard footer buttons
        footer.style.display = 'none';
        document.querySelector('.close-modal').style.display = 'none'; // Hide X during success
    } else {
        footer.style.display = 'flex';
        document.querySelector('.close-modal').style.display = 'block';
        
        backBtn.style.display = step > 1 ? 'block' : 'none';
        nextBtn.style.display = step < 3 ? 'block' : 'none';
        submitBtn.style.display = step === 3 ? 'block' : 'none';
        cancelBtn.style.display = step === 1 ? 'block' : 'none';
    }

    if (step === 3) updateSummary();
}

function nextUserStep() {
    // Basic validation for Step 1
    if (currentStep === 1) {
        const first = document.getElementById('user-first-name').value.trim();
        const last = document.getElementById('user-last-name').value.trim();
        const email = document.getElementById('user-email').value.trim();
        const password = document.getElementById('user-password').value;
        
        if (!first || !last || !email) {
            showToast('Please fill in Name and Email', 'warning');
            return;
        }
        
        if (!password || password.length < 6) {
            showToast('Password must be at least 6 characters', 'warning');
            return;
        }
    }

    // Validation for Step 2
    if (currentStep === 2) {
        const role = document.getElementById('user-role').value;
        const dept = document.getElementById('user-dept').value;
        if (!role || !dept) {
            showToast('Please assign a Role and Department', 'warning');
            return;
        }
    }

    showStep(currentStep + 1);
}

function prevUserStep() {
    if (currentStep > 1) showStep(currentStep - 1);
}

function updateSummary() {
    const first = document.getElementById('user-first-name').value;
    const last = document.getElementById('user-last-name').value;
    const email = document.getElementById('user-email').value;
    const phone = document.getElementById('user-phone').value || 'Not provided';
    const role = document.getElementById('user-role').value;
    const dept = document.getElementById('user-dept').value;
    
    const modules = [];
    document.querySelectorAll('input[name="user-modules"]:checked').forEach(cb => {
        modules.push(cb.parentNode.querySelector('span').textContent);
    });

    document.getElementById('summary-name').textContent = `${first} ${last}`;
    document.getElementById('summary-email').textContent = email;
    document.getElementById('summary-phone').textContent = phone;
    document.getElementById('summary-role').textContent = `${role} (${dept})`;
    document.getElementById('summary-password').textContent = document.getElementById('user-password').value;
    document.getElementById('summary-modules').textContent = modules.length > 0 ? modules.join(', ') : 'None';
    
    // Set text for success screen too
    document.getElementById('created-user-name').textContent = `${first} ${last}`;
    document.getElementById('created-user-dept').textContent = dept;
}

async function handleUserSubmit(event) {
    event.preventDefault();
    
    const first = document.getElementById('user-first-name').value.trim();
    const last = document.getElementById('user-last-name').value.trim();
    const email = document.getElementById('user-email').value.trim();
    const phone = document.getElementById('user-phone').value.trim();
    const role = document.getElementById('user-role').value;
    const dept = document.getElementById('user-dept').value;
    
    const modules = [];
    document.querySelectorAll('input[name="user-modules"]:checked').forEach(cb => {
        modules.push(cb.value);
    });

    const submitBtn = document.getElementById('user-submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating...';
    submitBtn.disabled = true;

    try {
        const password = document.getElementById('user-password').value;
        
        const { data, error } = await supabaseApi.createUserAsAdmin({
            email,
            password,
            full_name: `${first} ${last}`,
            role: role.toLowerCase(),
            department: dept
        });

        if (error) throw error;

        // Show success screen
        showStep(4);
        
        // Refresh the list immediately so the admin sees the new user without refresh
        await loadUsers();
        
        showToast('User created successfully', 'success');
    } catch (error) {
        console.error('Error creating user:', error);
        showToast('Failed to create user: ' + error.message, 'error');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// --- EDIT USER (New Landscape Modal) ---
function openEditUserModal(entry) {
    // If entry is event/element, ignore (should be passed user object or we find it)
    let user = entry;
    
    // If passed from HTML onclick="openEditUserModal(this)" - we need to find the user row
    // But better to pass the ID or the object. 
    // Let's assume we pass the full user object or ID.
    // Ideally, we should pass the ID and find it in allUsers.
}

// Wrapper for HTML onclick
function openEditModalForUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    const modal = document.getElementById('edit-user-modal');
    const form = document.getElementById('edit-user-form');
    
    form.reset();
    
    // Populate fields
    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('edit-user-name').value = user.full_name || '';
    document.getElementById('edit-user-email').value = user.email || '';
    // document.getElementById('edit-user-phone').value = user.phone || ''; // If phone exists in DB

    // Set Selects (Handle case insensitivity if needed)
    setSelectValue('edit-user-role', (user.role || '').toLowerCase());
    setSelectValue('edit-user-dept', user.department);
    // setSelectValue('edit-user-status', user.status); // If status exists
    
    modal.classList.add('show');
}

function closeEditUserModal() {
    document.getElementById('edit-user-modal').classList.remove('show');
}

async function handleEditUserSubmit(event) {
    event.preventDefault();
    
    const userId = document.getElementById('edit-user-id').value;
    const fullName = document.getElementById('edit-user-name').value;
    const role = document.getElementById('edit-user-role').value;
    const dept = document.getElementById('edit-user-dept').value;
    const status = document.getElementById('edit-user-status').value;
    
    const submitBtn = document.getElementById('edit-submit-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = 'Saving...';
    submitBtn.disabled = true;

    try {
        const email = document.getElementById('edit-user-email').value;
        // Update user profile/metadata in Supabase
        // Note: Updating email is complex in Supabase (requires re-verification), so we typically disable it.
        const updates = {
            full_name: fullName,
            email: email, // Include email to satisfy NOT NULL constraints in upsert fallback
            role: role,
            department: dept,
            // status: status // If we have a status field
        };

        const { error } = await supabaseApi.updateUserProfile(userId, updates);

        if (error) throw error;

        showToast('User updated successfully', 'success');
        closeEditUserModal();
        await loadUsers();

    } catch (error) {
        console.error('Error updating user:', error);
        showToast('Failed to update user: ' + error.message, 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function setSelectValue(id, value) {
    const select = document.getElementById(id);
    if (!select) return;
    
    // Try to match value
    for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value.toLowerCase() === (value || '').toLowerCase()) {
            select.selectedIndex = i;
            return;
        }
    }
}

// --- DELETE USER (Custom Modal) ---
let userToDeleteId = null;

function deleteUser(userId) {
    if (userId === currentAdminId) {
        showToast('Security Alert: You cannot delete your own account.', 'error');
        return;
    }
    userToDeleteId = userId;
    const user = allUsers.find(u => u.id === userId);
    
    document.getElementById('delete-user-name').textContent = user ? user.full_name : 'this user';
    document.getElementById('delete-user-modal').classList.add('show');
}

function closeDeleteModal() {
    document.getElementById('delete-user-modal').classList.remove('show');
    userToDeleteId = null;
}

async function confirmDeleteUser() {
    if (!userToDeleteId) return;
    
    const deleteBtn = document.querySelector('#delete-user-modal button[onclick="confirmDeleteUser()"]');
    const originalText = deleteBtn.textContent;
    deleteBtn.textContent = 'Deleting...';
    deleteBtn.disabled = true;

    try {
        const { error } = await supabaseApi.deleteUser(userToDeleteId);
        
        if (error) throw error;
        
        showToast('User deleted successfully', 'success');
        closeDeleteModal();
        await loadUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Failed to delete user', 'error');
        closeDeleteModal();
    } finally {
        deleteBtn.textContent = originalText;
        deleteBtn.disabled = false;
    }
}

// Helper to update onclicks in table
function displayUsers(users) {
    const tableBody = document.getElementById('user-list') || document.querySelector('tbody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No users found</td></tr>';
        return;
    }
    
    users.forEach(user => {
        const row = document.createElement('tr');
        const roleBadgeClass = user.role === 'admin' ? 'badge-admin' : 'badge-staff';
        
        let statusBadgeClass = 'badge-active';
        let statusText = user.status || 'Active';
        
        if (statusText === 'pending') statusBadgeClass = 'status-pending';
        if (statusText === 'rejected') statusBadgeClass = 'status-rejected';
        if (statusText === 'suspended') statusBadgeClass = 'status-rejected';

        const isPending = statusText.toLowerCase() === 'pending';
        
        row.innerHTML = `
            <td>
                <div class="user-cell">
                    <svg class="user-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
                    <span class="user-name-text">${user.full_name}</span>
                </div>
            </td>
            <td class="user-email-cell">${user.email}</td>
            <td class="user-role-cell"><span class="badge ${roleBadgeClass}">${user.role === 'admin' ? 'Admin' : 'Staff'}</span></td>
            <td class="user-dept-cell">${user.department || 'N/A'}</td>
            <td class="user-status-cell"><span class="badge ${statusBadgeClass}">${statusText.charAt(0).toUpperCase() + statusText.slice(1)}</span></td>
            <td>
                <div class="action-icons">
                    ${isPending ? `
                        <button class="btn-approve-mini" onclick="approveUser('${user.id}')" title="Approve User">Approve</button>
                        <button class="btn-reject-mini" onclick="rejectUser('${user.id}')" title="Reject User">Reject</button>
                    ` : `
                        <svg class="action-icon edit" onclick="openEditModalForUser('${user.id}')" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                        ${user.id !== currentAdminId ? `<svg class="action-icon delete" onclick="deleteUser('${user.id}')" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>` : ''}
                    `}
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

async function approveUser(userId) {
    const confirmed = await showConfirm('Approve this user for system access?');
    if (!confirmed) return;

    try {
        const { error } = await supabaseApi.updateUserStatus(userId, 'approved');
        if (error) throw error;

        showToast('User approved successfully', 'success');
        await loadUsers();
    } catch (error) {
        console.error('Error approving user:', error);
        showToast('Failed to approve user: ' + (error.message || 'Unknown error'), 'error');
    }
}

async function rejectUser(userId) {
    const confirmed = await showConfirm('Reject this user application?');
    if (!confirmed) return;

    try {
        const { error } = await supabaseApi.updateUserStatus(userId, 'rejected');
        if (error) throw error;

        showToast('User application rejected', 'warning');
        await loadUsers();
    } catch (error) {
        console.error('Error rejecting user:', error);
        showToast('Failed to reject user: ' + (error.message || 'Unknown error'), 'error');
    }
}
