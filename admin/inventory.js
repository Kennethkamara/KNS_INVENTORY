/**
 * Admin Inventory Management with Supabase
 * Two display modes:
 *   1. Default (All Categories): Individual items, NO quantity column
 *   2. Category filtered: Summary banner with total count + "View Items" to expand
 */

// State
let inventoryItems = [];
let filteredItems = [];
let distinctCategories = [];
let distinctDepartments = [];
let currentPage = 1;
let rowsPerPage = 10;
let selectedItems = new Set();
let itemsListExpanded = false; // for category summary mode
let currentViewMode = 'summary'; // 'summary' or 'detail'
let detailGroupBaseName = null; // The base name of the group being viewed in detail

// Initialize Page
document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth('admin');
    if (!user) return;
    
    const userNameEl = document.querySelector('.user-name');
    if (userNameEl && user.full_name) {
        userNameEl.textContent = user.full_name;
    }

    await loadDynamicOptions();
    await loadInventoryItems();
    
    // Setup search
    const searchInput = document.getElementById('inventory-search');
    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }

    setupRealtimeUpdates();
});

// ============================================
// LOAD DYNAMIC OPTIONS
// ============================================
async function loadDynamicOptions() {
    const [catResult, deptResult] = await Promise.all([
        supabaseApi.getDistinctCategories(),
        supabaseApi.getDistinctDepartments()
    ]);

    if (catResult.data) distinctCategories = catResult.data;
    if (deptResult.data) distinctDepartments = deptResult.data;

    populateFilterDropdowns();
}

function populateFilterDropdowns() {
    const defaultCategories = ['Electronics', 'Furniture', 'Office Supplies', 'Computers', 'Equipment', 'Networking', 'Vehicles'];
    const defaultDepartments = ['BroadConnect', 'KNS College', 'KNS Office', 'KNS Test Center', 'Warehouse / Store', 'Administration'];

    const finalCategories = [...new Set([...defaultCategories, ...distinctCategories])].sort();
    const finalDepartments = [...new Set([...defaultDepartments, ...distinctDepartments])].sort();

    // Populate filter dropdowns
    const deptFilter = document.getElementById('filter-department');
    const catFilter = document.getElementById('filter-category');

    if (deptFilter) {
        deptFilter.innerHTML = '<option value="">All Departments</option>';
        finalDepartments.forEach(dept => {
            deptFilter.innerHTML += `<option value="${dept}">${dept}</option>`;
        });
    }

    if (catFilter) {
        catFilter.innerHTML = '<option value="">All Categories</option>';
        finalCategories.forEach(cat => {
            catFilter.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
    }

    // Populate form dropdowns
    const catSelect = document.getElementById('item-category');
    const deptSelect = document.getElementById('item-department');

    if (catSelect) {
        catSelect.innerHTML = '<option value="">Select Category</option>';
        finalCategories.forEach(cat => {
            catSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
        catSelect.innerHTML += '<option value="-add-new-">-add new-</option>';
    }

    if (deptSelect) {
        deptSelect.innerHTML = '<option value="">Select Department</option>';
        finalDepartments.forEach(dept => {
            deptSelect.innerHTML += `<option value="${dept}">${dept}</option>`;
        });
        deptSelect.innerHTML += '<option value="-add-new-">-add new-</option>';
    }

    // Bulk Add Form dropdowns are HARDCODED in HTML to ensure stability
    // Do not populate dynamically to avoid race conditions or failures
    // const bulkCatSelect = document.getElementById('bulk-category');
    // const bulkDeptSelect = document.getElementById('bulk-department');
    // Logic removed to rely on HTML options
}

// ============================================
// LOAD INVENTORY ITEMS
// ============================================
async function loadInventoryItems() {
    const noResultsEl = document.getElementById('no-results');
    console.log('--- Loading Inventory Items ---');
    try {
        const { data, error } = await supabaseApi.getInventoryItems();
        
        console.log('Raw Supabase Response:', { data, error });

        if (error) {
            console.error('Inventory fetch error details:', error);
            inventoryItems = [];
            if (noResultsEl) {
                noResultsEl.style.display = 'block';
                noResultsEl.style.color = 'red';
                noResultsEl.innerHTML = `⚠️ <b>Database Error:</b> ${error.message || 'Check connection'}<br><small>Code: ${error.code || 'unknown'}</small>`;
            }
        } else {
            console.log(`Successfully fetched ${data?.length || 0} items from database.`);
            inventoryItems = data || [];
            
            if (inventoryItems.length === 0 && data.length > 0) {
                 console.log('All items were filtered out by condition rules.');
            }
        }
    } catch (err) {
        console.error('Fatal crash during inventory fetch:', err);
        inventoryItems = [];
        if (noResultsEl) {
            noResultsEl.style.display = 'block';
            noResultsEl.style.color = 'red';
            noResultsEl.textContent = '⚠️ Fatal Error: ' + err.message;
        }
    }
    
    applyFilters(); 
    updateSummaryCards();
    refreshDropdowns();
}

// ============================================
// SUMMARY CARDS
// ============================================
function updateSummaryCards() {
    // Total Items: Count of distinct records/rows
    const totalItems = inventoryItems.length;
    
    // Total Quantity: Sum of all units across all items
    const totalQty = inventoryItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
    
    // Issued/Assigned: Sum of quantities for items with assigned/issued status
    const assignedQty = inventoryItems.filter(item => {
        const s = (item.status || '').toLowerCase();
        return s === 'issued' || s === 'assigned';
    }).reduce((sum, item) => sum + (item.quantity || 0), 0);
    
    // Broken/Lost: Count of items flagged with bad condition
    const damagedQty = inventoryItems.filter(item => {
        const c = (item.condition || '').toLowerCase();
        return c === 'lost' || c === 'stolen' || c === 'damaged' || c === 'lost/stolen';
    }).reduce((sum, item) => sum + (item.quantity || 0), 0);

    // In Stock: Available items (not assigned/issued and not damaged/lost)
    const availableQty = inventoryItems.filter(item => {
        const s = (item.status || '').toLowerCase();
        const c = (item.condition || '').toLowerCase();
        const isBad = c === 'lost' || c === 'stolen' || c === 'damaged' || c === 'lost/stolen';
        const isOut = s === 'issued' || s === 'assigned';
        return !isBad && !isOut;
    }).reduce((sum, item) => sum + (item.quantity || 0), 0);

    const totalEl = document.getElementById('stat-total-items'); // Changed back to total-items
    const availableEl = document.getElementById('stat-available'); // In Stock (Units)
    const issuedEl = document.getElementById('stat-issued'); // Assigned/Issued
    const damagedEl = document.getElementById('stat-damaged'); // Broken/Lost

    if (totalEl) totalEl.textContent = totalItems;
    if (availableEl) availableEl.textContent = availableQty;
    if (issuedEl) issuedEl.textContent = assignedQty;
    if (damagedEl) damagedEl.textContent = damagedQty;
}

// ============================================
// STATUS HELPER
// ============================================
function getItemStatus(item) {
    const status = (item.status || 'available').toLowerCase();
    if (status === 'assigned') return { label: 'Assigned', class: 'status-assigned' };
    if (status === 'issued') return { label: 'Issued', class: 'status-issued' };
    if (status === 'transferred') return { label: 'Transferred', class: 'status-transferred' };
    return { label: 'Available', class: 'in-stock' };
}

// ============================================
// CHECK IF CATEGORY FILTER IS ACTIVE
// ============================================
function isCategoryFiltered() {
    return !!(document.getElementById('filter-category')?.value);
}

function getActiveCategoryName() {
    return document.getElementById('filter-category')?.value || '';
}

// ============================================
// FILTER FUNCTIONS
// ============================================
// ============================================
// FILTER FUNCTIONS
// ============================================
function applyFilters() {
    const searchTerm = (document.getElementById('inventory-search')?.value || '').toLowerCase();
    const deptFilter = document.getElementById('filter-department')?.value || '';
    const catFilter = document.getElementById('filter-category')?.value || '';
    const statusFilter = document.getElementById('filter-status')?.value || '';

    filteredItems = inventoryItems.filter(item => {
        // Exclude broken/lost items from the main inventory list view
        const cond = (item.condition || '').toLowerCase();
        const isBad = cond === 'lost' || cond === 'stolen' || cond === 'damaged' || cond === 'lost/stolen';
        if (isBad) return false;

        const matchesSearch = item.item_name.toLowerCase().includes(searchTerm) ||
                              (item.id && item.id.toLowerCase().includes(searchTerm));
        const matchesDept = !deptFilter || (item.department || item.location) === deptFilter;
        const matchesCat = !catFilter || item.category === catFilter;
        
        let matchesStatus = true;
        if (statusFilter) {
            const status = getItemStatus(item);
            matchesStatus = status.class === statusFilter;
        }

        return matchesSearch && matchesDept && matchesCat && matchesStatus;
    });

    currentPage = 1;
    selectedItems.clear();
    updateBulkDeleteBtn();
    
    // Reset to summary view on filter change
    currentViewMode = 'summary';
    detailGroupBaseName = null;
    
    renderInventoryView();
}

// ============================================
// VIEW LOGIC
// ============================================
function getBaseName(name) {
    if (!name) return 'Unknown Item';
    return name.replace(/ - \d{3}$/, '').trim();
}

function renderInventoryView() {
    const tableWrap = document.getElementById('items-table-wrap');
    document.getElementById('category-summary-banner').style.display = 'none'; // Ensure legacy banner is hidden
    tableWrap.style.display = 'block';

    if (currentViewMode === 'summary') {
        renderSummaryTable();
    } else {
        renderDetailTable();
    }
}

function renderSummaryTable() {
    // Group filtered items by Category
    const groups = new Map();
    filteredItems.forEach(item => {
        let groupKey = item.category || 'Uncategorized';
        // Removed department from key to group strictly by Category
        
        if (!groups.has(groupKey)) {
            const baseName = item.category || 'Uncategorized';
            
            groups.set(groupKey, {
                baseName,
                groupKey,
                category: item.category,
                department: item.department || item.location,
                quantity: 0,
                minStock: item.min_stock_level || 5, 
                unitPrice: parseFloat(item.unit_price) || 0,
                firstAdded: item.created_at,
                lastUpdated: item.updated_at,
                assignedNames: new Set(),
                ids: []
            });
        }
        const group = groups.get(groupKey);
        group.quantity += (item.quantity || 1); 
        group.ids.push(item.id);

        if (item.assigned_user?.full_name) {
            group.assignedNames.add(item.assigned_user.full_name);
        }
        
        if (item.created_at && (!group.firstAdded || new Date(item.created_at) < new Date(group.firstAdded))) {
            group.firstAdded = item.created_at;
        }
        if (item.updated_at && (!group.lastUpdated || item.updated_at > group.lastUpdated)) {
            group.lastUpdated = item.updated_at;
        }
    });

    const groupList = Array.from(groups.values());

    const thead = document.getElementById('inventory-thead');
    if (thead) {
        thead.innerHTML = `<tr>
            <th class="th-checkbox" style="width: 40px;"></th>
        <th>Item / Type</th>
        <th>Total Qty</th>
        <th>Date Added</th>
        <th>Last Updated</th>
        <th>Status</th>
        <th>Actions</th>
        </tr>`;
    }

    // ... (rest of rendering) ...
    const tableBody = document.getElementById('inventory-list');
    tableBody.innerHTML = '';

    if (groupList.length === 0) {
        document.getElementById('no-results').style.display = 'block';
        document.getElementById('inventory-table').style.display = 'none';
        updatePaginationInfo(0, 0, 0);
        return;
    }

    document.getElementById('no-results').style.display = 'none';
    document.getElementById('inventory-table').style.display = 'table';

    // Pagination
    const start = (currentPage - 1) * rowsPerPage;
    const end = Math.min(start + rowsPerPage, groupList.length);
    const pageGroups = groupList.slice(start, end);

    pageGroups.forEach(group => {
        const row = document.createElement('tr');
        
        let statusClass = 'in-stock';
        let statusLabel = 'In Stock';
        if (group.quantity === 0) {
            statusClass = 'out-of-stock';
            statusLabel = 'Out of Stock';
        } else if (group.quantity <= group.minStock) {
            statusClass = 'low-stock';
            statusLabel = 'Low Stock';
        }
        
        const dateAdded = group.firstAdded ? new Date(group.firstAdded).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
        const lastUpdated = group.lastUpdated ? new Date(group.lastUpdated).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

        const assignedNames = Array.from(group.assignedNames);
        let assignedDisplay = 'Unassigned';
        if (assignedNames.length > 2) {
            assignedDisplay = `${assignedNames[0]} + ${assignedNames.length - 1} others`;
        } else if (assignedNames.length > 0) {
            assignedDisplay = assignedNames.join(', ');
        }

        row.innerHTML = `
            <td></td>
            <td class="td-name" style="font-weight: 700; padding: 15px 15px; font-size: 1.05rem; color: var(--primary-blue);">
                <div style="margin-bottom: 4px;">${group.baseName}</div>
            </td>
            <td class="td-qty" style="font-weight: bold;">${group.quantity}</td>
            <td>${dateAdded}</td>
            <td>${lastUpdated}</td>
            <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
            <td>
                <button class="btn-primary" style="padding: 6px 12px; font-size: 13px;" onclick="viewCondition('${group.groupKey.replace(/'/g, "\\'")}')">
                    View Items
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    updatePaginationInfo(start + 1, end, groupList.length);
}

// ============================================
// DETAIL VIEW HELPERS
// ============================================
function getGroupKey(item) {
    return item.category || 'Uncategorized';
}

function viewCondition(groupKey) {
    currentViewMode = 'detail';
    detailGroupBaseName = groupKey; // Actually full group key now
    currentPage = 1;
    renderInventoryView();
}

function backToSummary() {
    currentViewMode = 'summary';
    detailGroupBaseName = null;
    currentPage = 1;
    renderInventoryView();
}
//...
function renderDetailTable() {
    // Filter items by key
    const groupItems = filteredItems.filter(item => getGroupKey(item) === detailGroupBaseName);
    
    // ... Headers ...
    const thead = document.getElementById('inventory-thead');
    thead.innerHTML = `<tr>
        <th class="th-checkbox"><input type="checkbox" id="select-all" onchange="toggleSelectAll(this)"></th>
        <th>SKU</th>
        <th>Item Name</th>
        <th>Brand/Type</th>
        <th>Department</th>
        <th>Supplier</th>
        <th>Condition</th>
        <th>Assigned To</th>
        <th>Status</th>
        <th>Actions</th>
    </tr>`;
    
    // ... Rows ...
    // Extract Brand/Type for display
    // Add Last Repair column
    // ...

    // Add "Back" button to table header or above it?
    // Changing header to include back button row slightly risky for layout, let's just render rows.
    // We need a back button somewhere. I'll add a row at the top of the body or manipulate the filtering UI.
    // Better: Add a persistent "Back to Summary" button above the table when in detail mode.
    
    const tableBody = document.getElementById('inventory-list');
    tableBody.innerHTML = '';

    // Add Back Button Row
    const backRow = document.createElement('tr');
    
    // Parse group key for display
    const displayText = detailGroupBaseName;

    backRow.innerHTML = `
        <td colspan="10" style="padding: 10px; background: #f8f9fa;">
            <button onclick="backToSummary()" style="display: flex; align-items: center; gap: 8px; border: none; background: transparent; color: #1967d2; cursor: pointer; font-weight: 500;">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                Back to ${displayText} Summary
            </button>
        </td>
    `;
    tableBody.appendChild(backRow);

    if (groupItems.length === 0) {
        // Should not happen if group exists
        return;
    }

    // Pagination
    const start = (currentPage - 1) * rowsPerPage;
    const end = Math.min(start + rowsPerPage, groupItems.length);
    const pageItems = groupItems.slice(start, end);

    pageItems.forEach(item => {
        const row = document.createElement('tr');
        row.dataset.itemId = item.id;
        
        const status = getItemStatus(item);
        const unitPrice = parseFloat(item.unit_price) || 0;
        const isChecked = selectedItems.has(item.id) ? 'checked' : '';
        const condition = item.condition || 'Good';

        const brandType = (item.brand && item.type) ? `${item.brand} ${item.type}` : '-';

        const assignedTo = item.assigned_user?.full_name || 'Unassigned';
        const supplier = item.supplier || '-';

        let html = `
            <td class="td-checkbox"><input type="checkbox" class="row-checkbox" value="${item.id}" ${isChecked} onchange="toggleRowSelect(this)"></td>
            <td class="td-sku">${item.id}</td>
            <td class="td-name">${item.item_name}</td>
            <td>${brandType}</td>
            <td><span style="font-size: 0.9rem; color: #666;">${item.department || item.location || 'N/A'}</span></td>
            <td><span style="font-size: 0.9rem; color: #666;">${supplier}</span></td>
            <td><span class="status-badge" style="background: #e8f0fe; color: #1967d2;">${condition}</span></td>
            <td>${assignedTo}</td>
            <td><span class="status-badge ${status.class}">${status.label}</span></td>
            <td>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button onclick="openViewModal('${item.id}')" title="View Info" style="border: none; background: transparent; cursor: pointer; padding: 4px; display: flex;">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="#666"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v8z"/></svg>
                    </button>
                    <button onclick="openEditModal('${item.id}')" title="Edit Item" style="border: none; background: transparent; cursor: pointer; padding: 4px; display: flex;">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="#2979ff"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    </button>
                    <button onclick="deleteItem('${item.id}')" title="Delete Item" style="border: none; background: transparent; cursor: pointer; padding: 4px; display: flex;">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="#ff1744"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                </div>
            </td>`;

        row.innerHTML = html;
        tableBody.appendChild(row);
    });

    updatePaginationInfo(start + 1, end, groupItems.length);
    
    // Update select-all checkbox
    const selectAll = document.getElementById('select-all');
    if (selectAll) {
        selectAll.checked = pageItems.length > 0 && pageItems.every(item => selectedItems.has(item.id));
    }
}

// ============================================
// CATEGORY SUMMARY BANNER
// ============================================
function showCategorySummary() {
    const categoryName = getActiveCategoryName();
    const totalCount = filteredItems.length;
    
    document.getElementById('category-summary-title').textContent = categoryName;
    document.getElementById('category-summary-count').textContent = `${totalCount} item${totalCount !== 1 ? 's' : ''} total`;
    
    // Update button text
    const btn = document.getElementById('view-items-btn');
    if (itemsListExpanded) {
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg> Hide Items`;
    } else {
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg> View Items`;
    }
}

function toggleItemsList() {
    itemsListExpanded = !itemsListExpanded;
    displayInventoryItems();
}

// ============================================
// PAGINATION
// ============================================
function getTotalCount() {
    if (currentViewMode === 'summary') {
        const uniqueKeys = new Set(filteredItems.map(item => getGroupKey(item)));
        return uniqueKeys.size;
    } else {
        return filteredItems.filter(item => getGroupKey(item) === detailGroupBaseName).length;
    }
}

function updatePaginationInfo(start, end, total) {
    document.getElementById('page-info').textContent = total > 0 ? `${start}-${end} of ${total}` : '0 of 0';
    document.getElementById('prev-page').disabled = currentPage <= 1;
    document.getElementById('next-page').disabled = end >= total;
}

function changePage(delta) {
    const total = getTotalCount();
    const totalPages = Math.ceil(total / rowsPerPage);
    currentPage = Math.max(1, Math.min(currentPage + delta, totalPages));
    renderInventoryView();
}

function changeRowsPerPage() {
    rowsPerPage = parseInt(document.getElementById('rows-per-page').value);
    currentPage = 1;
    renderInventoryView();
}

// ============================================
// BULK SELECT
// ============================================
function toggleSelectAll(checkbox) {
    let pageItems = [];
    
    if (currentViewMode === 'summary') {
        // In summary mode, selecting all selects NOTHING currently (or maybe all individual items?)
        // Let's implement select all for Summary -> Selects NOTHING or ALL items in those groups?
        // User didn't specify behavior. Simpler to disable select-all in Summary Mode.
        // But for now, let's make it select nothing to be safe.
        // Wait, I removed the checkbox from Summary header in previous step!
        return; 
    } else {
        // Detail mode using getGroupKey
        const groupItems = filteredItems.filter(item => getGroupKey(item) === detailGroupBaseName);
        const start = (currentPage - 1) * rowsPerPage;
        const end = Math.min(start + rowsPerPage, groupItems.length);
        pageItems = groupItems.slice(start, end);
    }

    pageItems.forEach(item => {
        if (checkbox.checked) {
            selectedItems.add(item.id);
        } else {
            selectedItems.delete(item.id);
        }
    });

    renderInventoryView();
    updateBulkDeleteBtn();
}

function toggleRowSelect(checkbox) {
    if (checkbox.checked) {
        selectedItems.add(checkbox.value);
    } else {
        selectedItems.delete(checkbox.value);
    }
    updateBulkDeleteBtn();
    
    // Update select-all state
    // Only relevant in Detail mode
    if (currentViewMode === 'detail') {
        const groupItems = filteredItems.filter(item => getGroupKey(item) === detailGroupBaseName);
        const start = (currentPage - 1) * rowsPerPage;
        const end = Math.min(start + rowsPerPage, groupItems.length);
        const pageItems = groupItems.slice(start, end);
        
        const selectAll = document.getElementById('select-all');
        if (selectAll) {
            selectAll.checked = pageItems.length > 0 && pageItems.every(item => selectedItems.has(item.id));
        }
    }
}

function updateBulkDeleteBtn() {
    const btn = document.getElementById('bulk-delete-btn');
    if (btn) {
        btn.style.display = selectedItems.size > 0 ? 'inline-flex' : 'none';
        btn.textContent = `Delete Selected (${selectedItems.size})`;
    }
}

async function bulkDeleteItems() {
    const confirmed = await showConfirm(`Are you sure you want to delete ${selectedItems.size} item(s)?`);
    if (!confirmed) return;

    let errors = 0;
    for (const itemId of selectedItems) {
        const { error } = await supabaseApi.deleteInventoryItem(itemId);
        if (error) errors++;
    }

    if (errors > 0) {
        showToast(`Failed to delete ${errors} item(s)`, 'error');
    } else {
        showToast(`${selectedItems.size} item(s) deleted successfully!`, 'success');
    }

    selectedItems.clear();
    updateBulkDeleteBtn();
    await loadInventoryItems();
}

// ============================================
// ACTION DROPDOWN (3-dot menu)
// ============================================
function toggleActionMenu(btn, event) {
    event.stopPropagation();
    // Close other open menus
    document.querySelectorAll('.action-dropdown-menu.show').forEach(menu => {
        if (menu !== btn.nextElementSibling) menu.classList.remove('show');
    });
    btn.nextElementSibling.classList.toggle('show');
}

// Close action menus when clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('.action-dropdown-menu.show').forEach(menu => {
        menu.classList.remove('show');
    });
});

// ============================================
// MODAL CONTROLS
// ============================================
function openItemModal() {
    const modal = document.getElementById('item-modal');
    const modalTitle = document.getElementById('modal-title');
    const submitBtn = document.getElementById('submit-btn');
    const form = document.getElementById('item-form');
    
    modalTitle.textContent = 'Add New Item';
    submitBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Add Item`;
    form.reset();
    document.getElementById('edit-row-index').value = '';
    document.getElementById('item-sku').value = '';
    document.getElementById('item-sku').placeholder = 'Auto-generated on save';
    document.getElementById('item-price').value = '0';
    document.getElementById('item-reorder').value = '5';
    
    removeImage();
    modal.classList.add('show');
}

async function openEditModal(itemId) {
    const modal = document.getElementById('item-modal');
    const modalTitle = document.getElementById('modal-title');
    const submitBtn = document.getElementById('submit-btn');
    
    modalTitle.textContent = 'Edit Item';
    submitBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Save Changes`;
    
    const item = inventoryItems.find(i => i.id === itemId);
    if (!item) return;
    
    document.getElementById('item-name').value = item.item_name;
    document.getElementById('item-category').value = item.category;
    document.getElementById('item-department').value = item.department || item.location || '';
    document.getElementById('item-price').value = item.unit_price || 0;
    document.getElementById('item-reorder').value = item.min_stock_level || 5;
    if (document.getElementById('item-brand')) document.getElementById('item-brand').value = item.brand || '';
    if (document.getElementById('item-type')) document.getElementById('item-type').value = item.type || '';

    document.getElementById('item-description').value = item.description || '';
    document.getElementById('edit-row-index').value = itemId;
    document.getElementById('item-sku').value = item.id;

    if (item.image_url) {
        const previewImg = document.getElementById('preview-img');
        const imagePreview = document.getElementById('image-preview');
        const placeholder = document.getElementById('upload-placeholder');
        
        previewImg.src = item.image_url;
        imagePreview.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        removeImage();
    }
    
    // Close any open action menu
    document.querySelectorAll('.action-dropdown-menu.show').forEach(m => m.classList.remove('show'));
    
    modal.classList.add('show');
}

function closeItemModal() {
    document.getElementById('item-modal').classList.remove('show');
    document.getElementById('item-form').reset();
}

// ============================================
// VIEW MODAL
// ============================================
async function openViewModal(itemId) {
    const modal = document.getElementById('view-modal');
    const item = inventoryItems.find(i => i.id === itemId);
    if (!item) return;

    document.getElementById('view-item-name').textContent = item.item_name;
    document.getElementById('view-item-id').textContent = `SKU: ${item.id}`;
    document.getElementById('view-category').textContent = item.category;
    document.getElementById('view-dept').textContent = item.department || item.location || 'N/A';
    document.getElementById('view-qty').textContent = `${item.quantity} units`;
    document.getElementById('view-price').textContent = `₦${(parseFloat(item.unit_price) || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    document.getElementById('view-reorder').textContent = item.min_stock_level || 5;

    const status = getItemStatus(item);
    const statusEl = document.getElementById('view-status');
    statusEl.className = `status-badge ${status.class}`;
    statusEl.textContent = status.label;

    document.getElementById('view-updated').textContent = item.updated_at ? new Date(item.updated_at).toLocaleString() : 'N/A';
    document.getElementById('view-created').textContent = item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A';

    // Show Assignment Info based on status
    const assignedRow = document.getElementById('view-assigned-row');
    const assignedVal = document.getElementById('view-assigned');
    const assignedLabel = assignedRow ? assignedRow.querySelector('.label') : null;

    if (item.status === 'assigned') {
        const userName = item.assigned_user?.full_name || 'Staff Member';
        if (assignedLabel) assignedLabel.textContent = 'ASSIGNED TO:';
        assignedVal.textContent = userName;
        assignedRow.style.display = 'flex';
        assignedRow.style.justifyContent = 'space-between';
        assignedRow.style.background = '#e8f0fe'; // Light blue for assigned
        assignedRow.style.color = '#1967d2';
    } else if (item.status === 'issued') {
        const userName = item.assigned_user?.full_name || 'Particular User/Dept';
        if (assignedLabel) assignedLabel.textContent = 'ISSUED TO:';
        assignedVal.textContent = userName;
        assignedRow.style.display = 'flex';
        assignedRow.style.justifyContent = 'space-between';
        assignedRow.style.background = '#fef7e0'; // Light gold for issued
        assignedRow.style.color = '#b06000';
    } else if (item.status === 'transferred') {
        if (assignedLabel) assignedLabel.textContent = 'CURRENT LOCATION:';
        assignedVal.textContent = item.location || item.department || 'Transit';
        assignedRow.style.display = 'flex';
        assignedRow.style.justifyContent = 'space-between';
        assignedRow.style.background = '#f3e5f5'; // Light purple for transferred
        assignedRow.style.color = '#7b1fa2';
    } else {
        assignedRow.style.display = 'none';
    }

    const descText = document.getElementById('view-description');
    descText.textContent = item.description || 'No description provided.';

    const imgContainer = document.getElementById('view-image-container');
    const imgPreview = document.getElementById('view-img-preview');
    if (item.image_url) {
        imgPreview.src = item.image_url;
        imgContainer.style.display = 'block';
    } else {
        imgContainer.style.display = 'none';
    }

    // Close any open action menu
    document.querySelectorAll('.action-dropdown-menu.show').forEach(m => m.classList.remove('show'));

    modal.classList.add('show');
}

function closeViewModal() {
    document.getElementById('view-modal').classList.remove('show');
}

// Close modals on outside click
window.addEventListener('click', function(event) {
    const modal = document.getElementById('item-modal');
    const viewModal = document.getElementById('view-modal');
    
    if (event.target == modal) {
        closeItemModal();
        stopCamera();
    }
    if (event.target == viewModal) {
        closeViewModal();
    }
});

// ============================================
// CAMERA & IMAGE HANDLING
// ============================================
let stream = null;

async function startCamera() {
    const video = document.getElementById('video');
    const placeholder = document.getElementById('upload-placeholder');
    const cameraContainer = document.getElementById('camera-preview-container');
    const imagePreview = document.getElementById('image-preview');

    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" },
            audio: false 
        });
        video.srcObject = stream;
        
        placeholder.style.display = 'none';
        imagePreview.style.display = 'none';
        cameraContainer.style.display = 'block';
    } catch (err) {
        console.error("Error accessing camera:", err);
        showToast("Could not access camera. Please ensure permissions are granted.", "error");
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    const placeholder = document.getElementById('upload-placeholder');
    const cameraContainer = document.getElementById('camera-preview-container');
    
    cameraContainer.style.display = 'none';
    placeholder.style.display = 'flex';
}

function takeSnapshot() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const previewImg = document.getElementById('preview-img');
    const imagePreview = document.getElementById('image-preview');
    const cameraContainer = document.getElementById('camera-preview-container');

    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/png');
    previewImg.src = dataUrl;
    
    imagePreview.style.display = 'block';
    cameraContainer.style.display = 'none';
    stopCamera();
}

function removeImage() {
    const previewImg = document.getElementById('preview-img');
    const imagePreview = document.getElementById('image-preview');
    const placeholder = document.getElementById('upload-placeholder');
    
    if (previewImg) previewImg.src = '';
    if (imagePreview) imagePreview.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
}

// Drag & Drop / File Input
document.addEventListener('DOMContentLoaded', () => {
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');

    if (dropArea) {
        dropArea.addEventListener('click', (e) => {
            if (e.target.closest('.camera-btn') || e.target.closest('.camera-controls') || e.target.closest('#video')) return;
            fileInput.click();
        });

        dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropArea.classList.add('dragover');
        });

        dropArea.addEventListener('dragleave', () => {
            dropArea.classList.remove('dragover');
        });

        dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dropArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) handleFiles(files[0]);
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleFiles(e.target.files[0]);
        });
    }
});

function handleFiles(file) {
    if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file.', 'warning');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const previewImg = document.getElementById('preview-img');
        const imagePreview = document.getElementById('image-preview');
        const placeholder = document.getElementById('upload-placeholder');
        
        previewImg.src = e.target.result;
        imagePreview.style.display = 'block';
        placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
}

// ============================================
// CREATE/UPDATE ITEM (no quantity field)
// ============================================
async function handleItemSubmit(event) {
    event.preventDefault();
    
    const name = document.getElementById('item-name').value;
    const category = document.getElementById('item-category').value;
    const department = document.getElementById('item-department').value;
    const unitPrice = parseFloat(document.getElementById('item-price').value) || 0;
    const reorderLevel = parseInt(document.getElementById('item-reorder').value) || 5;
    const supplier = document.getElementById('item-supplier')?.value.trim();
    const brand = document.getElementById('item-brand')?.value.trim();
    const type = document.getElementById('item-type')?.value;
    const unit = document.getElementById('item-unit')?.value || 'pcs';
    const description = document.getElementById('item-description').value;
    const itemId = document.getElementById('edit-row-index').value;
    
    if (!name || !category || !department) {
        showToast('Please fill in all required fields.', 'warning');
        return;
    }
    
    // Base data with core columns
    const itemData = {
        item_name: name,
        category: category,
        department: department,
        location: department, // Map department to location for backward compatibility
        unit: unit,
        description: description,
        unit_price: unitPrice,
        min_stock_level: reorderLevel,
        image_url: document.getElementById('preview-img')?.src || null
    };

    // Add new fields
    // NOTE: These columns must exist in DB!
    if (brand) itemData.brand = brand;
    if (type) itemData.type = type;

    // For new items, set initial quantity to 1 (default to one record = one item)
    if (!itemId) {
        itemData.quantity = 1;
    }
    
    // Add supplier
    const fullData = { ...itemData };
    if (supplier) fullData.supplier = supplier;
    if (!itemId) {
        fullData.status = 'available';
        fullData.condition = 'good';
    }

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    
    if (itemId) {
        // Update existing item
        // Update existing item
        try {
            await supabaseApi.updateInventoryItem(itemId, itemData);
            showToast(`Item "${name}" updated successfully!`, 'success');
        } catch (error) {
            console.error('Error updating item:', error);
            showToast('Failed to update item: ' + error.message, 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Save Changes`;
            return;
        }
    } else {
        // Create new item - try with full data first
        let result = await supabaseApi.createInventoryItem(fullData);
        
        // Retry without optional columns if 400 error (column missing)
        if (result.error && result.error.code === '42703') {
             console.warn('Optional columns missing, retrying with base data');
             result = await supabaseApi.createInventoryItem(itemData);
        }

        if (result.error) {
            console.error('Error creating item:', result.error);
            showToast('Failed to create item: ' + result.error.message, 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Add Item`;
            return;
        }
        
        showToast(`Item "${name}" added successfully! Add stock via Stock Movement.`, 'success');
    }
    
    closeItemModal();
    await loadInventoryItems();
    await refreshDropdowns();
}

// ============================================
// DELETE ITEM
// ============================================
async function deleteItem(itemId) {
    const item = inventoryItems.find(i => i.id === itemId);
    if (!item) return;
    
    // Close any open action menu
    document.querySelectorAll('.action-dropdown-menu.show').forEach(m => m.classList.remove('show'));
    
    const confirmed = await showConfirm(`Are you sure you want to delete "${item.item_name}"?`);
    if (!confirmed) return;
    
    const { error } = await supabaseApi.deleteInventoryItem(itemId);
    
    if (error) {
        console.error('Error deleting item:', error);
        showToast('Failed to delete item', 'error');
        return;
    }
    
    showToast('Item deleted successfully!', 'success');
    await loadInventoryItems();
}

// ============================================
// DYNAMIC OPTION MANAGEMENT
// ============================================
async function refreshDropdowns() {
    try {
        const { data: categories } = await supabaseApi.getDistinctCategories();
        const { data: departments } = await supabaseApi.getDistinctDepartments();

        const categorySelects = ['item-category', 'bulk-category', 'filter-category', 'export-category'];
        const departmentSelects = ['item-department', 'bulk-department', 'filter-department', 'export-department'];

        populateSelectOptions(categorySelects, categories, 'Category');
        populateSelectOptions(departmentSelects, departments, 'Department');
    } catch (err) {
        console.error('Failed to refresh dropdowns:', err);
    }
}

function populateSelectOptions(selectIds, values, type) {
    selectIds.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;

        // Keep the first placeholder option (e.g. "Select Category")
        const firstOption = select.options[0];
        const currentValue = select.value;
        
        select.innerHTML = '';
        if (firstOption) select.appendChild(firstOption);

        // Add distinct values from database
        values.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            select.appendChild(opt);
        });

        // Restore value if it still exists
        if (currentValue && values.includes(currentValue)) {
            select.value = currentValue;
        }

        // Add "-add new-" option for non-filter selects
        if (!id.startsWith('filter-') && !id.startsWith('export-')) {
            const addNew = document.createElement('option');
            addNew.value = '-add-new-';
            addNew.textContent = '-add new-';
            select.appendChild(addNew);
        }
    });
}

async function checkNewOption(select, type) {
    if (select.value === '-add-new-') {
        const newValue = await showPrompt(`Enter new ${type} name:`, '', `New ${type}`);
        if (newValue && newValue.trim() !== '') {
            const trimmedValue = newValue.trim();
            
            // Add to the current select immediately so user can continue
            const option = document.createElement('option');
            option.value = trimmedValue;
            option.textContent = trimmedValue;
            select.insertBefore(option, select.lastElementChild);
            select.value = trimmedValue;

            // Sync with all other similar selects
            const typeSelects = type === 'category' 
                ? ['item-category', 'bulk-category', 'filter-category']
                : ['item-department', 'bulk-department', 'filter-department'];
            
            typeSelects.forEach(id => {
                const s = document.getElementById(id);
                if (s && s !== select) {
                    // Check if already exists before adding
                    if (!Array.from(s.options).some(opt => opt.value === trimmedValue)) {
                        const opt = document.createElement('option');
                        opt.value = trimmedValue;
                        opt.textContent = trimmedValue;
                        if (id.startsWith('filter-')) {
                            s.appendChild(opt);
                        } else {
                            s.insertBefore(opt, s.lastElementChild);
                        }
                    }
                }
            });
        } else {
            select.value = '';
        }
    }
}

// ============================================
// REAL-TIME UPDATES
// ============================================
function setupRealtimeUpdates() {
    supabaseApi.subscribeToInventory((payload) => {
        console.log('Inventory changed:', payload);
        loadInventoryItems();
    });
}

// ============================================
// BULK ADD
// ============================================
function openBulkAddModal() {
    const modal = document.getElementById('bulk-add-modal');
    document.getElementById('bulk-add-form').reset();
    document.getElementById('bulk-count').value = 1;
    document.getElementById('bulk-preview-box').style.display = 'none';
    document.getElementById('bulk-submit-label').textContent = 'Create Items';
    document.getElementById('bulk-submit-btn').disabled = false;

    document.getElementById('bulk-submit-label').textContent = 'Create Items';
    document.getElementById('bulk-submit-btn').disabled = false;

    // Categories and Departments are HARDCODED in HTML
    // Do not populate dynamically to avoid race conditions or failures
    // Logic removed to rely on HTML options
    
    modal.classList.add('show');

    modal.classList.add('show');
}

function closeBulkAddModal() {
    document.getElementById('bulk-add-modal').classList.remove('show');
}

function updateBulkPreview() {
    const name = document.getElementById('bulk-name').value.trim();
    const count = parseInt(document.getElementById('bulk-count').value) || 0;
    const previewBox = document.getElementById('bulk-preview-box');
    const previewList = document.getElementById('bulk-preview-list');
    const submitLabel = document.getElementById('bulk-submit-label');

    if (!name || count < 1) {
        previewBox.style.display = 'none';
        return;
    }

    previewBox.style.display = 'block';

    // Show up to 4 preview names + "..." if more
    const showCount = Math.min(count, 4);
    let previewItems = [];
    for (let i = 1; i <= showCount; i++) {
        const num = String(i).padStart(3, '0');
        previewItems.push(`<span class="bulk-preview-chip">${name} - ${num}</span>`);
    }
    if (count > 4) {
        previewItems.push(`<span class="bulk-preview-chip more">+${count - 4} more</span>`);
    }
    previewList.innerHTML = previewItems.join('');

    submitLabel.textContent = `Create ${count} Item${count !== 1 ? 's' : ''}`;
}

async function handleBulkAdd(event) {
    event.preventDefault();

    const name = document.getElementById('bulk-name').value.trim();
    const count = parseInt(document.getElementById('bulk-count').value);
    const category = document.getElementById('bulk-category').value;
    const department = document.getElementById('bulk-department').value;
    const unitPrice = parseFloat(document.getElementById('bulk-price').value) || 0;
    const reorderLevel = parseInt(document.getElementById('bulk-reorder').value) || 5;
    const supplier = document.getElementById('bulk-supplier').value.trim();
    const brand = document.getElementById('bulk-brand').value.trim();
    const type = document.getElementById('bulk-type').value;
    const unit = document.getElementById('bulk-unit').value.trim();
    const description = document.getElementById('bulk-description').value.trim();

    if (!name || count < 1 || !category || !department || !unit) {
        showToast('Please fill in all required fields (Name, Count, Category, Department, Unit).', 'warning');
        return;
    }

    const submitBtn = document.getElementById('bulk-submit-btn');
    const submitLabel = document.getElementById('bulk-submit-label');
    submitBtn.disabled = true;

    let successCount = 0;
    let failCount = 0;
    let lastError = null;

    // Create items one by one (sequential to avoid race conditions with ID generation)
    for (let i = 1; i <= count; i++) {
        const num = String(i).padStart(3, '0');
        submitLabel.textContent = `Creating ${i} of ${count}...`;

        // Core columns — always exist
        // Note: 'department' column doesn't exist in base schema, mapped to 'location'
        const baseData = {
            item_name: `${name} - ${num}`,
            category: category,
            department: department,
            location: department, // Map department to location for backward compatibility
            quantity: 1,
            unit: unit,
            unit_price: unitPrice,
            min_stock_level: reorderLevel, // Add reorder level
            description: description || null
        };
        
        if (brand) baseData.brand = brand;
        if (type) baseData.type = type;

        // Try with optional columns first
        const fullData = { ...baseData };
        if (supplier) fullData.supplier = supplier;
        fullData.status = 'available';
        fullData.condition = 'good'; // Lowercase condition

        let result = await supabaseApi.createInventoryItem(fullData);

        // If 400 error — optional columns probably don't exist yet, retry with base only
        if (result.error && result.error.code === '42703') {
            console.warn(`Optional columns missing, retrying item ${i} with base data only`);
            result = await supabaseApi.createInventoryItem(baseData);
        }

        if (result.error) {
            console.error(`Error creating item ${i}:`, result.error);
            failCount++;
            lastError = result.error.message || JSON.stringify(result.error);
        } else {
            successCount++;
        }
    }

    if (failCount === 0) {
        showToast(`✅ ${successCount} item${successCount !== 1 ? 's' : ''} created successfully!`, 'success');
    } else {
        const errorMsg = lastError ? `: ${lastError}` : '.';
        showToast(`Created ${successCount}, Failed ${failCount}${errorMsg}`, 'error');
    }

    closeBulkAddModal();
    submitBtn.disabled = false;
    submitLabel.textContent = 'Create Items';
    await loadInventoryItems();
    await refreshDropdowns();
}

// Close bulk modal on outside click
window.addEventListener('click', function(event) {
    const modal = document.getElementById('bulk-add-modal');
    if (event.target === modal) closeBulkAddModal();
});

