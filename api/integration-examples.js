/**
 * Example: How to Use Supabase API in Your Pages
 * 
 * This file demonstrates how to integrate the Supabase API
 * into your admin and user dashboard pages.
 */

// ============================================
// 1. INCLUDE REQUIRED SCRIPTS IN YOUR HTML
// ============================================

/*
Add these script tags before your page-specific JavaScript:

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="../supabase-config.js"></script>
<script src="../api/supabase-api.js"></script>
<script src="../auth.js"></script>
*/

// ============================================
// 2. PROTECT YOUR PAGE (Auth Guard)
// ============================================

// At the top of your page script, check authentication
document.addEventListener('DOMContentLoaded', async () => {
    // For admin pages
    const currentUser = await checkAuth('admin');
    
    // For user pages
    // const currentUser = await checkAuth('user');
    
    if (!currentUser) return; // User will be redirected
    
    // Continue with page initialization
    initializePage(currentUser);
});

// ============================================
// 3. FETCH AND DISPLAY INVENTORY ITEMS
// ============================================

async function loadInventoryItems() {
    const { data, error } = await supabaseApi.getInventoryItems();
    
    if (error) {
        console.error('Error loading inventory:', error);
        alert('Failed to load inventory items');
        return;
    }
    
    // Display items
    const tableBody = document.getElementById('inventoryTableBody');
    tableBody.innerHTML = '';
    
    data.forEach(item => {
        const row = `
            <tr>
                <td>${item.item_name}</td>
                <td>${item.category}</td>
                <td>${item.quantity}</td>
                <td>${item.unit}</td>
                <td>${item.condition}</td>
                <td>
                    <button onclick="editItem('${item.id}')">Edit</button>
                    <button onclick="deleteItem('${item.id}')">Delete</button>
                </td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });
}

// ============================================
// 4. CREATE NEW INVENTORY ITEM
// ============================================

async function createInventoryItem(formData) {
    const itemData = {
        item_name: formData.itemName,
        category: formData.category,
        quantity: parseInt(formData.quantity),
        unit: formData.unit,
        condition: formData.condition,
        location: formData.location,
        min_stock_level: parseInt(formData.minStockLevel) || 0
    };
    
    const { data, error } = await supabaseApi.createInventoryItem(itemData);
    
    if (error) {
        console.error('Error creating item:', error);
        alert('Failed to create item');
        return;
    }
    
    alert('Item created successfully!');
    loadInventoryItems(); // Refresh the list
}

// ============================================
// 5. UPDATE INVENTORY ITEM
// ============================================

async function updateInventoryItem(itemId, formData) {
    const updates = {
        item_name: formData.itemName,
        quantity: parseInt(formData.quantity),
        condition: formData.condition,
        // ... other fields
    };
    
    const { data, error } = await supabaseApi.updateInventoryItem(itemId, updates);
    
    if (error) {
        console.error('Error updating item:', error);
        alert('Failed to update item');
        return;
    }
    
    alert('Item updated successfully!');
    loadInventoryItems();
}

// ============================================
// 6. DELETE INVENTORY ITEM
// ============================================

async function deleteItem(itemId) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    const { error } = await supabaseApi.deleteInventoryItem(itemId);
    
    if (error) {
        console.error('Error deleting item:', error);
        alert('Failed to delete item');
        return;
    }
    
    alert('Item deleted successfully!');
    loadInventoryItems();
}

// ============================================
// 7. SUBMIT USER REQUEST
// ============================================

async function submitRequest(itemId, quantity, reason) {
    const currentUser = getCurrentUserFromSession();
    
    const requestData = {
        user_id: currentUser.id,
        item_id: itemId,
        quantity: parseInt(quantity),
        reason: reason,
        status: 'pending'
    };
    
    const { data, error } = await supabaseApi.createRequest(requestData);
    
    if (error) {
        console.error('Error submitting request:', error);
        alert('Failed to submit request');
        return;
    }
    
    alert('Request submitted successfully!');
}

// ============================================
// 8. APPROVE/REJECT REQUEST (Admin)
// ============================================

async function updateRequestStatus(requestId, status, adminNotes = '') {
    const { data, error } = await supabaseApi.updateRequestStatus(
        requestId, 
        status, 
        adminNotes
    );
    
    if (error) {
        console.error('Error updating request:', error);
        alert('Failed to update request');
        return;
    }
    
    alert(`Request ${status} successfully!`);
    loadRequests(); // Refresh the list
}

// ============================================
// 9. FULFILL REQUEST (Admin)
// ============================================

async function fulfillRequest(requestId) {
    if (!confirm('This will update inventory. Continue?')) return;
    
    const { data, error } = await supabaseApi.fulfillRequest(requestId);
    
    if (error) {
        console.error('Error fulfilling request:', error);
        alert('Failed to fulfill request: ' + error.message);
        return;
    }
    
    alert('Request fulfilled and inventory updated!');
    loadRequests();
    loadInventoryItems();
}

// ============================================
// 10. GET LOW STOCK ITEMS
// ============================================

async function loadLowStockItems() {
    const { data, error } = await supabaseApi.getLowStockItems();
    
    if (error) {
        console.error('Error loading low stock items:', error);
        return;
    }
    
    // Display low stock alerts
    const alertDiv = document.getElementById('lowStockAlerts');
    if (data.length > 0) {
        alertDiv.innerHTML = `
            <div class="alert alert-warning">
                <strong>Low Stock Alert!</strong>
                ${data.length} item(s) are running low.
            </div>
        `;
    }
}

// ============================================
// 11. REAL-TIME UPDATES
// ============================================

function setupRealtimeUpdates() {
    // Subscribe to inventory changes
    const inventorySub = supabaseApi.subscribeToInventory((payload) => {
        console.log('Inventory changed:', payload);
        loadInventoryItems(); // Auto-refresh
    });
    
    // Subscribe to request changes
    const requestSub = supabaseApi.subscribeToRequests((payload) => {
        console.log('Request changed:', payload);
        loadRequests(); // Auto-refresh
    });
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        inventorySub.unsubscribe();
        requestSub.unsubscribe();
    });
}

// ============================================
// 12. SEARCH AND FILTER
// ============================================

async function searchInventory(searchTerm, category) {
    const filters = {};
    
    if (searchTerm) filters.search = searchTerm;
    if (category && category !== 'all') filters.category = category;
    
    const { data, error } = await supabaseApi.getInventoryItems(filters);
    
    if (error) {
        console.error('Error searching:', error);
        return;
    }
    
    // Display filtered results
    displayInventoryItems(data);
}

// ============================================
// 13. GENERATE REPORTS
// ============================================

async function generateInventoryReport() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    const { data, error } = await supabaseApi.getInventoryReport(startDate, endDate);
    
    if (error) {
        console.error('Error generating report:', error);
        return;
    }
    
    // Display report
    console.log('Report:', data);
    displayReport(data);
}

// ============================================
// 14. MANAGE USERS (Admin)
// ============================================

async function loadAllUsers() {
    const { data, error } = await supabaseApi.getAllUsers();
    
    if (error) {
        console.error('Error loading users:', error);
        return;
    }
    
    // Display users
    displayUsers(data);
}

async function changeUserRole(userId, newRole) {
    const { data, error } = await supabaseApi.updateUserRole(userId, newRole);
    
    if (error) {
        console.error('Error updating role:', error);
        alert('Failed to update user role');
        return;
    }
    
    alert('User role updated successfully!');
    loadAllUsers();
}

// ============================================
// EXAMPLE: Complete Page Initialization
// ============================================

async function initializePage(currentUser) {
    // Display user info
    document.getElementById('userName').textContent = currentUser.full_name;
    
    // Load data
    await loadInventoryItems();
    await loadLowStockItems();
    
    // Setup real-time updates
    setupRealtimeUpdates();
    
    // Setup event listeners
    document.getElementById('searchBtn').addEventListener('click', () => {
        const term = document.getElementById('searchInput').value;
        searchInventory(term);
    });
}
