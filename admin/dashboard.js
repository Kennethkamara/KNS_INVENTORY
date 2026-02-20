/**
 * Admin Dashboard Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
    const userResult = await checkAuth('admin');
    if (!userResult) return;

    // Display current user name
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    if (currentUser && currentUser.full_name) {
        const displayEl = document.getElementById('displayUserName');
        if (displayEl) displayEl.textContent = currentUser.full_name;
    }

    // Initial load
    await loadDashboardStats();
    await loadRecentMovements();
    await loadIssuedItems();
});

async function loadDashboardStats() {
    // Set loading state
    const statIds = ['total-items', 'low-stock', 'pending-requests', 'active-users'];
    statIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '...';
    });

    try {
        // 1. Total Items
        const { data: inventory, error: invError } = await supabaseClient
            .from('inventory_items')
            .select('*, assigned_user:users!assigned_to(full_name)')
            .order('item_name', { ascending: true });
        if (invError) throw invError;
        
        if (inventory) {
            document.getElementById('total-items').textContent = inventory.length;
            
            // 2. Low Stock
            const lowStockCount = inventory.filter(item => item.quantity <= (item.min_stock_level || 5)).length;
            document.getElementById('low-stock').textContent = lowStockCount;
        }

        // 3. Pending Requests
        const { data: requests, error: reqError } = await supabaseApi.getRequests({ status: 'pending' });
        if (reqError) throw reqError;
        if (requests) {
            document.getElementById('pending-requests').textContent = requests.length;
        }

        // 4. Active Users
        const { data: users, error: userError } = await supabaseApi.getAllUsers();
        if (userError) throw userError;
        if (users) {
            document.getElementById('active-users').textContent = users.length;
        }
        
        console.log('Dashboard stats loaded successfully');
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        // Reset to 0 on error
        statIds.forEach(id => {
            const el = document.getElementById(id);
            if (el && el.textContent === '...') el.textContent = '0';
        });
    }
}

async function loadRecentMovements() {
    const movementsContainer = document.getElementById('recent-movements');
    if (!movementsContainer) return;

    try {
        const { data: movements, error } = await supabaseApi.getStockMovements();
        
        if (error) throw error;

        movementsContainer.innerHTML = '';

        if (!movements || movements.length === 0) {
            movementsContainer.innerHTML = '<div class="no-data">No recent movements</div>';
            return;
        }

        // Get 5 most recent
        const recent = movements.slice(0, 5);

        recent.forEach(m => {
            const movementEl = document.createElement('div');
            movementEl.className = 'movement-item';
            
            const isOut = m.movement_type === 'out';
            const iconClass = isOut ? 'down' : (m.movement_type === 'in' ? 'up' : 'swap');
            const iconSvg = isOut 
                ? '<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>' 
                : (m.movement_type === 'in' 
                    ? '<svg viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z"/></svg>'
                    : '<svg viewBox="0 0 24 24"><path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z"/></svg>');
            
            movementEl.innerHTML = `
                <div class="movement-icon ${iconClass}">
                    ${iconSvg}
                </div>
                <div class="movement-details">
                    <span class="item-name">${m.inventory_items?.item_name || 'Unknown Item'}</span>
                    <span class="item-meta">${m.reason || (isOut ? 'Issued' : (m.movement_type === 'in' ? 'Restocked' : 'Adjusted'))}</span>
                </div>
                <div class="movement-time">
                    ${new Date(m.created_at).toLocaleDateString()}
                </div>
            `;
            movementsContainer.appendChild(movementEl);
        });
    } catch (error) {
        console.warn('Recent movements fetch suppressed error:', error);
        // On error, just show "No recent movements" instead of technical error
        movementsContainer.innerHTML = '<div class="no-data">No recent movements</div>';
    }
}

async function loadIssuedItems() {
    const tableBody = document.getElementById('issued-items-list');
    if (!tableBody) return;

    try {
        // Fetch items where status is 'issued'
        const { data: inventory, error } = await supabaseApi.getInventoryItems();
        if (error) throw error;

        const issuedItems = (inventory || []).filter(item => item.status === 'issued');
        
        tableBody.innerHTML = '';

        if (issuedItems.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No items currently issued</td></tr>';
            return;
        }

        // Show most recent 10 issued items
        const recentIssued = issuedItems
            .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
            .slice(0, 10);

        recentIssued.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${item.item_name}</strong></td>
                <td>${item.assigned_user?.full_name || 'Unknown'}</td>
                <td>${item.department || 'General'}</td>
                <td>${new Date(item.updated_at).toLocaleDateString()}</td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading issued items:', error);
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Failed to load issued items</td></tr>';
    }
}
