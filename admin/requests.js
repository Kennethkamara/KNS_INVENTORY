/**
 * Admin Requests Management with Supabase
 */

let allRequests = [];

document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth('admin');
    if (!user) return;
    
    document.querySelector('.user-name').textContent = user.full_name;
    
    await loadRequests();
    setupRealtimeUpdates();
});

async function loadRequests() {
    const { data, error } = await supabaseApi.getRequests();
    
    if (error) {
        console.error('Error loading requests:', error);
        showToast('Failed to load requests', 'error');
        return;
    }
    
    allRequests = data || [];
    displayRequests(allRequests);
}

function displayRequests(requests) {
    const tableBody = document.getElementById('requests-list') || document.querySelector('tbody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (requests.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No requests found</td></tr>';
        return;
    }
    
    requests.forEach(request => {
        const row = document.createElement('tr');
        const statusClass = request.status === 'pending' ? 'status-pending' : 
                           request.status === 'approved' ? 'status-approved' : 
                           request.status === 'fulfilled' ? 'status-fulfilled' : 'status-rejected';
        
        row.innerHTML = `
            <td>${request.users?.full_name || 'Unknown'}</td>
            <td>${request.department || 'N/A'}</td>
            <td>${request.inventory_items?.item_name || 'Unknown Item'}</td>
            <td>${request.quantity}</td>
            <td><span class="status-badge ${statusClass}">${request.status}</span></td>
            <td>${new Date(request.created_at).toLocaleDateString()}</td>
            <td>
                ${request.status === 'pending' ? `
                    <button class="btn-approve" onclick="approveRequest('${request.id}')">Approve</button>
                    <button class="btn-reject" onclick="rejectRequest('${request.id}')">Reject</button>
                ` : request.status === 'approved' ? `
                    <button class="btn-fulfill" onclick="fulfillRequest('${request.id}')">Fulfill</button>
                ` : '-'}
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

async function approveRequest(requestId) {
    const notes = prompt('Add admin notes (optional):');
    
    const { error } = await supabaseApi.updateRequestStatus(requestId, 'approved', notes || '');
    
    if (error) {
        console.error('Error approving request:', error);
        showToast('Failed to approve request', 'error');
        return;
    }
    
    showToast('Request approved successfully!', 'success');
    await loadRequests();
}

async function rejectRequest(requestId) {
    const notes = prompt('Reason for rejection:');
    if (!notes) return;
    
    const { error } = await supabaseApi.updateRequestStatus(requestId, 'rejected', notes);
    
    if (error) {
        console.error('Error rejecting request:', error);
        showToast('Failed to reject request', 'error');
        return;
    }
    
    showToast('Request rejected', 'success');
    await loadRequests();
}

async function fulfillRequest(requestId) {
    const confirmed = await showConfirm('This will update inventory. Continue?');
    if (!confirmed) return;
    
    const { error } = await supabaseApi.fulfillRequest(requestId);
    
    if (error) {
        console.error('Error fulfilling request:', error);
        showToast('Failed to fulfill request: ' + error.message, 'error');
        return;
    }
    
    showToast('Request fulfilled and inventory updated!', 'success');
    await loadRequests();
}

function filterRequests(status) {
    if (status === 'all') {
        displayRequests(allRequests);
    } else {
        const filtered = allRequests.filter(r => r.status === status);
        displayRequests(filtered);
    }
}

function setupRealtimeUpdates() {
    supabaseApi.subscribeToRequests(() => {
        loadRequests();
    });
}
