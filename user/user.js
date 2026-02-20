/**
 * User Dashboard with Supabase
 */

document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth('user');
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
});

async function loadUserStats() {
    // Get user's requests
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    const { data: requests } = await supabaseApi.getRequests({ userId: user.id });
    
    const totalRequests = requests ? requests.length : 0;
    const pendingRequests = requests ? requests.filter(r => r.status === 'pending').length : 0;
    const approvedRequests = requests ? requests.filter(r => r.status === 'approved' || r.status === 'fulfilled').length : 0;
    
    // Update UI if elements exist
    const totalEl = document.querySelector('[data-stat="total"]');
    const pendingEl = document.querySelector('[data-stat="pending"]');
    const approvedEl = document.querySelector('[data-stat="approved"]');
    
    if (totalEl) totalEl.textContent = totalRequests;
    if (pendingEl) pendingEl.textContent = pendingRequests;
    if (approvedEl) approvedEl.textContent = approvedRequests;
}

async function loadUserRequests() {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    const { data: requests } = await supabaseApi.getRequests({ userId: user.id });
    
    const recentList = document.getElementById('recent-requests');
    if (!recentList || !requests) return;
    
    recentList.innerHTML = '';
    
    requests.slice(0, 5).forEach(request => {
        const statusClass = request.status === 'pending' ? 'status-pending' : 
                           request.status === 'approved' ? 'status-approved' : 
                           request.status === 'fulfilled' ? 'status-fulfilled' : 'status-rejected';
        
        recentList.innerHTML += `
            <div class="request-item">
                <div class="request-info">
                    <span class="item-name">${request.inventory_items?.item_name || 'Unknown'}</span>
                    <span class="request-meta">Qty: ${request.quantity} - ${new Date(request.created_at).toLocaleDateString()}</span>
                </div>
                <span class="status-badge ${statusClass}">${request.status}</span>
            </div>
        `;
    });
}
