/**
 * User Dashboard with Supabase
 */

document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth('staff');
    if (!user) return;
    
    const nameEl = document.getElementById('displayUserName') || document.querySelector('.user-name');
    if (nameEl) nameEl.textContent = user.full_name;
    
    const greetingEl = document.getElementById('userGreeting');
    if (greetingEl) {
        const firstName = user.full_name.split(' ')[0];
        greetingEl.textContent = `Welcome Back, ${firstName}! Here’s what’s happening with your inventory and requests.`;
    }
    
    await loadUserStats();
    await loadUserRequests();
    await loadAssignedItems();
});

async function loadUserStats() {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    
    // Fetch both requests and assigned items
    const { data: requests } = await supabaseApi.getRequests({ userId: user.id });
    const { data: assignedItems } = await supabaseApi.getAssignedItems(user.id);
    
    const assignedCount = assignedItems ? assignedItems.length : 0;
    const pendingRequests = requests ? requests.filter(r => r.status === 'pending').length : 0;
    const approvedRequests = requests ? requests.filter(r => r.status === 'approved' || r.status === 'fulfilled').length : 0;
    
    // Update UI
    const totalEl = document.querySelector('[data-stat="total"]');
    const pendingEl = document.querySelector('[data-stat="pending"]');
    const approvedEl = document.querySelector('[data-stat="approved"]');
    
    if (totalEl) totalEl.textContent = assignedCount;
    if (pendingEl) pendingEl.textContent = pendingRequests;
    if (approvedEl) approvedEl.textContent = approvedRequests;
}

async function loadUserRequests() {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    const { data: requests } = await supabaseApi.getRequests({ userId: user.id });
    
    const recentList = document.getElementById('recent-requests');
    if (!recentList || !requests) return;
    
    recentList.innerHTML = '';
    
    if (requests.length === 0) {
        recentList.innerHTML = '<tr><td colspan="3" style="text-align:center;">No requests yet.</td></tr>';
        return;
    }

    requests.slice(0, 5).forEach(request => {
        const statusClass = request.status === 'pending' ? 'status-pending' : 
                           (request.status === 'approved' || request.status === 'fulfilled') ? 'status-approved' : 'status-rejected';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${request.inventory_items?.item_name || 'Request Item'}</strong></td>
            <td>${new Date(request.created_at).toLocaleDateString()}</td>
            <td><span class="status-badge ${statusClass}">${request.status}</span></td>
        `;
        recentList.appendChild(row);
    });
}

async function loadAssignedItems() {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    const { data: items, error } = await supabaseApi.getAssignedItems(user.id);
    
    if (error) {
        console.error('Error loading assigned items:', error);
        return;
    }
    
    const listEl = document.getElementById('assigned-items-list');
    if (!listEl) return;
    
    listEl.innerHTML = '';
    
    if (!items || items.length === 0) {
        listEl.innerHTML = '<tr><td colspan="3" style="text-align:center;">No items assigned to you yet.</td></tr>';
        return;
    }
    
    items.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${item.item_name}</strong></td>
            <td>${new Date(item.updated_at).toLocaleDateString()}</td>
            <td><span class="status-badge status-approved">Assigned</span></td>
        `;
        listEl.appendChild(row);
    });
}
