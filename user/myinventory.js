/**
 * User My Inventory Page with Supabase
 */

document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth('staff');
    if (!user) return;
    
    // Display logged-in user's name
    const nameEl = document.getElementById('displayUserName') || document.querySelector('.user-name');
    if (nameEl && user.full_name) {
        nameEl.textContent = user.full_name;
    }
    
    // Setup search listener
    const searchInput = document.getElementById('filterInput');
    if (searchInput) {
        searchInput.addEventListener('input', searchInventory);
    }
    
    await loadMyInventory();
});

async function loadMyInventory() {
    // Get all inventory items (users can view all available items)
    const { data, error } = await supabaseApi.getInventoryItems();
    
    if (error) {
        console.error('Error loading inventory:', error);
        await showAlert('Failed to load inventory', 'Error');
        return;
    }
    
    const items = data || [];
    updateInventoryStats(items);
    displayInventory(items);
}

function updateInventoryStats(items) {
    const stats = {
        total: items.length,
        available: items.filter(i => i.quantity > 0).length,
        oos: items.filter(i => i.quantity <= 0).length
    };

    Object.keys(stats).forEach(key => {
        const el = document.querySelector(`[data-stat="${key}"]`);
        if (el) el.textContent = stats[key];
    });
}

function displayInventory(items) {
    const tableBody = document.getElementById('inventory-list') || document.querySelector('tbody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (items.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No inventory items available</td></tr>';
        return;
    }
    
    items.forEach(item => {
        const row = document.createElement('tr');
        const availabilityClass = item.quantity > item.min_stock_level ? 'available' : 'low-stock';
        
        row.innerHTML = `
            <td><strong>${item.item_name}</strong></td>
            <td>${item.category}</td>
            <td>${item.quantity} ${item.unit || 'pcs'}</td>
            <td><span class="status-badge ${availabilityClass}">${item.quantity > 0 ? 'Available' : 'Out of Stock'}</span></td>
            <td>
                ${item.quantity > 0 ? `
                    <button class="btn-request" onclick="requestItem('${item.id}', '${item.item_name}')">
                        <i class="fas fa-paper-plane"></i> Request
                    </button>
                ` : '<span class="text-muted">-</span>'}
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}



async function requestItem(itemId, itemName) {
    const quantity = await showPrompt(`How many ${itemName} do you need?`, '1');
    if (quantity === null) return; // Cancelled
    
    if (!quantity || parseInt(quantity) <= 0) {
        showToast('Please enter a valid quantity', 'warning');
        return;
    }
    
    const reason = await showPrompt('Reason for request (if any):', `Request for ${itemName}`);
    if (reason === null) return; // Cancelled
    
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    
    const requestData = {
        user_id: user.id,
        item_id: itemId,
        quantity: parseInt(quantity),
        reason: reason || `Request for ${itemName}`,
        status: 'pending',
        department: user.department || 'General'
    };
    
    const { error } = await supabaseApi.createRequest(requestData);
    
    if (error) {
        console.error('Error creating request:', error);
        showToast('Failed to create request', 'error');
        return;
    }
    
    showToast('Request submitted successfully!', 'success');
}

function searchInventory() {
    const searchTerm = document.getElementById('filterInput')?.value.toLowerCase() || '';
    const rows = document.querySelectorAll('#inventory-list tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}
