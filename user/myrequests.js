/**
 * User My Requests Page with Supabase
 */

let userRequests = [];

document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth('user');
    if (!user) return;
    
    // Display logged-in user's name
    const nameEl = document.getElementById('displayUserName') || document.querySelector('.user-name');
    if (nameEl && user.full_name) {
        nameEl.textContent = user.full_name;
    }
    

    
    await loadMyRequests();
    setupRealtimeUpdates();
});

async function loadMyRequests() {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    const { data, error } = await supabaseApi.getRequests({ userId: user.id });
    
    if (error) {
        console.error('Error loading requests:', error);
        alert('Failed to load your requests');
        return;
    }
    
    userRequests = data || [];
    updateSummaryStats(userRequests);
    displayRequests(userRequests);
}

function updateSummaryStats(requests) {
    const stats = {
        total: requests.length,
        pending: requests.filter(r => r.status === 'pending').length,
        approved: requests.filter(r => r.status === 'approved' || r.status === 'fulfilled').length,
        rejected: requests.filter(r => r.status === 'rejected').length
    };

    Object.keys(stats).forEach(key => {
        const el = document.querySelector(`[data-stat="${key}"]`);
        if (el) el.textContent = stats[key];
    });
}

function displayRequests(requests) {
    const tableBody = document.getElementById('requests-list') || document.querySelector('tbody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (requests.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No requests found</td></tr>';
        return;
    }
    
    requests.forEach(request => {
        const row = document.createElement('tr');
        const statusClass = request.status === 'pending' ? 'status-pending' : 
                           request.status === 'approved' ? 'status-approved' : 
                           request.status === 'fulfilled' ? 'status-fulfilled' : 'status-rejected';
        
        row.innerHTML = `
            <td>${new Date(request.created_at).toLocaleDateString()}</td>
            <td>${request.inventory_items?.item_name || 'Unknown Item'}</td>
            <td>${request.quantity}</td>
            <td><span class="status-badge ${statusClass}">${request.status}</span></td>
            <td>${request.admin_notes || '-'}</td>
        `;
        
        tableBody.appendChild(row);
    });
}

function filterRequests(status) {
    if (status === 'all') {
        displayRequests(userRequests);
    } else {
        const filtered = userRequests.filter(r => r.status === status);
        displayRequests(filtered);
    }
}

function setupRealtimeUpdates() {
    supabaseApi.subscribeToRequests(() => {
        loadMyRequests();
    });
}
