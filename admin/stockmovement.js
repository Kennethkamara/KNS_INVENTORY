/**
 * Stock Movement Management with Supabase
 * Simplified: Issue, Return, Transfer, Lost/Stolen, Damaged
 * No quantity field — each movement = 1 item
 */

let allMovements = [];
let filteredMovements = [];
let allInventoryItems = [];
let smCurrentPage = 1;
let smRowsPerPage = 10;

document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth('admin');
    if (!user) return;
    
    const userNameEl = document.querySelector('.user-name');
    if (userNameEl && user.full_name) {
        userNameEl.textContent = user.full_name;
    }
    
    await loadDynamicOptions();
    await loadInventoryItemsForSelect();
    await loadUsersForSelect();
    await loadStockMovements();

    // --- Dynamic Options ---
let distinctDepartments = [];

async function loadDynamicOptions() {
    const { data } = await supabaseApi.getDistinctDepartments();
    if (data) distinctDepartments = data;
    
    populateDepartmentDropdowns();
}

function populateDepartmentDropdowns() {
    const defaultDepartments = ['Warehouse / Store', 'BroadConnect', 'KNS College', 'KNS Office', 'KNS Test Center', 'Administration'];
    const finalDepartments = [...new Set([...defaultDepartments, ...distinctDepartments])].sort();

    const depts = [
        document.getElementById('mv-from'),
        document.getElementById('mv-to')
    ];

    depts.forEach(select => {
        if (!select) return;
        const isTo = select.id === 'mv-to';
        select.innerHTML = `<option value="">${isTo ? 'Select destination' : 'Select location'}</option>`;
        finalDepartments.forEach(dept => {
            select.innerHTML += `<option value="${dept}">${dept}</option>`;
        });
    });
}
    // Setup search
    const searchInput = document.getElementById('movement-search');
    if (searchInput) {
        searchInput.addEventListener('input', filterMovements);
    }

    // Reset hidden ID on person input
    const personInput = document.getElementById('mv-person');
    if (personInput) {
        personInput.addEventListener('input', () => {
            document.getElementById('mv-person-id').value = '';
        });
    }
});

// ============================================
// LOAD INVENTORY ITEMS FOR SELECT
// ============================================
// ============================================
// LOAD INVENTORY ITEMS & SETUP SEARCH
// ============================================
async function loadInventoryItemsForSelect() {
    const { data } = await supabaseApi.getInventoryItems();
    
    // Only show active items (not lost/stolen/damaged)
    allInventoryItems = (data || []).filter(item => {
        const condition = (item.condition || '').toLowerCase();
        return condition !== 'lost' && condition !== 'stolen' && condition !== 'damaged';
    });
    
    // Setup Searchable Dropdown
    setupSearchableDropdown();
}

function setupSearchableDropdown() {
    const input = document.getElementById('mv-item-display');
    const hiddenInput = document.getElementById('mv-item');
    const dropdown = document.getElementById('mv-item-dropdown');
    
    if (!input || !dropdown) return;

    // Filter function
    function filterItems(query) {
        const lowerQuery = query.toLowerCase();
        const type = document.getElementById('mv-type').value;
        
        return allInventoryItems.filter(item => {
            const matchesQuery = item.item_name.toLowerCase().includes(lowerQuery) || 
                               item.id.toLowerCase().includes(lowerQuery);
            
            // Logic: Issue is only for Available items
            if (type === 'Issue' && (item.status || '').toLowerCase() === 'issued') {
                return false;
            }

            // Return is only for Issued items
            if (type === 'Return' && (item.status || '').toLowerCase() !== 'issued') {
                return false;
            }

            return matchesQuery;
        }).slice(0, 50);
    }

    // Render dropdown
    function renderDropdown(items) {
        dropdown.innerHTML = '';
        if (items.length === 0) {
            dropdown.innerHTML = '<div class="dropdown-option" style="color: #999; cursor: default;">No items found</div>';
            return;
        }

        items.forEach(item => {
            const div = document.createElement('div');
            const isIssued = (item.status || '').toLowerCase() === 'issued';
            div.className = `dropdown-option ${isIssued ? 'is-issued' : ''}`;
            const statusLabel = isIssued ? '<span class="status-badge status-issued">ISSUED</span>' : '';
            
            div.innerHTML = `
                <div style="font-weight: 500; display: flex; justify-content: space-between;">
                    ${item.item_name}
                    ${statusLabel}
                </div>
                <span class="item-meta">SKU: ${item.id} | Qty: ${item.quantity} | ${item.department || item.location || 'N/A'}</span>
            `;
            div.onclick = () => selectItem(item);
            dropdown.appendChild(div);
        });
    }

    // Input events
    input.addEventListener('input', (e) => {
        const query = e.target.value;
        const filtered = filterItems(query);
        renderDropdown(filtered);
        dropdown.classList.add('show');
        
        // Clear hidden input if display text changes (user must select valid item)
        if (hiddenInput.value) {
            hiddenInput.value = '';
        }
    });

    input.addEventListener('focus', () => {
        const query = input.value;
        const filtered = filterItems(query);
        renderDropdown(filtered);
        dropdown.classList.add('show');
    });

    // Hide dropdown on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.searchable-select')) {
            dropdown.classList.remove('show');
            
            // Also close person dropdown
            const personDropdown = document.getElementById('mv-person-dropdown');
            if (personDropdown) personDropdown.classList.remove('show');
            
            // If user typed a name but didn't select, clear the hidden ID if they select something later
            // but let's keep it simple for now.
        }
    });
}

function selectItem(item) {
    const input = document.getElementById('mv-item-display');
    const hiddenInput = document.getElementById('mv-item');
    const dropdown = document.getElementById('mv-item-dropdown');

    const statusLabel = (item.status || 'available').toUpperCase();
    input.value = `${item.item_name} [${statusLabel}] (${item.id})`;
    hiddenInput.value = item.id;
    dropdown.classList.remove('show');
}

// ============================================
// USER SELECTION (PERSON)
// ============================================
let allUsersForSelect = [];

async function loadUsersForSelect() {
    const { data } = await supabaseApi.getAllUsers();
    allUsersForSelect = data || [];
    setupPersonSearchableDropdown();
}

function setupPersonSearchableDropdown() {
    const input = document.getElementById('mv-person');
    const dropdown = document.getElementById('mv-person-dropdown');
    
    if (!input || !dropdown) return;

    function filterUsers(query) {
        const lowerQuery = query.toLowerCase();
        return allUsersForSelect.filter(user => 
            (user.full_name || '').toLowerCase().includes(lowerQuery) || 
            (user.email || '').toLowerCase().includes(lowerQuery)
        ).slice(0, 50);
    }

    function renderDropdown(users) {
        dropdown.innerHTML = '';
        if (users.length === 0) {
            dropdown.innerHTML = '<div class="dropdown-option" style="color: #999; cursor: default;">No users found</div>';
            return;
        }

        users.forEach(user => {
            const div = document.createElement('div');
            div.className = 'dropdown-option';
            div.innerHTML = `
                <div style="font-weight: 500;">${user.full_name}</div>
                <span class="item-meta">${user.department || 'No Dept'} | ${user.role}</span>
            `;
            div.onclick = () => {
                input.value = user.full_name;
                document.getElementById('mv-person-id').value = user.id;
                dropdown.classList.remove('show');
            };
            dropdown.appendChild(div);
        });
    }

    input.addEventListener('input', (e) => {
        const query = e.target.value;
        const filtered = filterUsers(query);
        renderDropdown(filtered);
        dropdown.classList.add('show');
    });

    input.addEventListener('focus', () => {
        const query = input.value;
        const filtered = query ? filterUsers(query) : allUsersForSelect.slice(0, 50);
        renderDropdown(filtered);
        dropdown.classList.add('show');
    });
}

// ============================================
// LOAD STOCK MOVEMENTS
// ============================================
async function loadStockMovements() {
    const tableBody = document.getElementById('movements-list');
    try {
        const { data, error } = await supabaseApi.getStockMovements();
        
        if (error) {
            console.error('Stock movement fetch error:', error);
            if (tableBody) {
                tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 40px; color: red;">⚠️ <b>Error loading movements:</b> ${error.message}</td></tr>`;
            }
            allMovements = [];
            return;
        }

        allMovements = (data || []).map(m => ({
            ...m,
            display_type: parseDisplayType(m),
            ref_id: generateRefId(m)
        }));
    } catch (err) {
        console.error('Fatal error loading stock movements:', err);
        allMovements = [];
    }
    
    filterMovements(); 
}

// ============================================
// PARSE/HELPERS
// ============================================
function parseDisplayType(movement) {
    const reason = (movement.reason || '').toLowerCase();
    
    if (reason.includes('[lost/stolen]') || reason.includes('lost') || reason.includes('stolen')) return 'Lost/Stolen';
    if (reason.includes('[damaged]') || reason.includes('damaged')) return 'Damaged';
    if (reason.includes('[transfer]') || reason.includes('transfer')) return 'Transfer';
    if (reason.includes('[return]') || reason.includes('return')) return 'Return';
    if (reason.includes('[issue]') || reason.includes('issue') || reason.includes('assign')) return 'Issue';

    // Fallback based on DB movement_type
    if (movement.movement_type === 'out') return 'Issue';
    if (movement.movement_type === 'in') return 'Return';
    return 'Issue';
}

function generateRefId(movement) {
    const shortId = movement.id ? movement.id.substring(0, 8).toUpperCase() : '00000000';
    return `MOV-${shortId}`;
}

function getMovementBadgeClass(type) {
    switch(type) {
        case 'Issue': return 'mv-badge issue';
        case 'Return': return 'mv-badge return-badge';
        case 'Transfer': return 'mv-badge transfer';
        case 'Lost/Stolen': return 'mv-badge lost-stolen';
        case 'Damaged': return 'mv-badge damaged';
        default: return 'mv-badge';
    }
}

// ============================================
// FILTER MOVEMENTS
// ============================================
function filterMovements() {
    const searchTerm = (document.getElementById('movement-search')?.value || '').toLowerCase();
    const typeFilter = document.getElementById('filter-movement-type')?.value || '';

    filteredMovements = allMovements.filter(m => {
        const itemName = m.inventory_items?.item_name || '';
        const matchesSearch = !searchTerm || 
            itemName.toLowerCase().includes(searchTerm) || 
            m.ref_id.toLowerCase().includes(searchTerm);
        const matchesType = !typeFilter || m.display_type === typeFilter;
        
        return matchesSearch && matchesType;
    });

    smCurrentPage = 1;
    displayMovements();
}

// ============================================
// DISPLAY MOVEMENTS
// ============================================
function displayMovements() {
    const tableBody = document.getElementById('movements-list');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';

    if (filteredMovements.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 40px; color: #999;">No stock movements found</td></tr>';
        updateSmPagination(0, 0, 0);
        return;
    }

    const start = (smCurrentPage - 1) * smRowsPerPage;
    const end = Math.min(start + smRowsPerPage, filteredMovements.length);
    const pageItems = filteredMovements.slice(start, end);

    pageItems.forEach(movement => {
        const row = document.createElement('tr');
        const badgeClass = getMovementBadgeClass(movement.display_type);
        const date = new Date(movement.created_at).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric'
        });

        // Show Source and Destination clearly
        const source = movement.from_location || '-';
        const destination = movement.to_location || '-';

        // Clean up remarks (remove type tags)
        let remarks = movement.reason || '-';
        remarks = remarks.replace(/\[(Issue|Return|Transfer|Lost\/Stolen|Damaged)\]\s*/gi, '');

        row.innerHTML = `
            <td>${date}</td>
            <td class="td-sku">${movement.ref_id}</td>
            <td>${movement.inventory_items?.item_name || 'Unknown Item'}</td>
            <td><span class="${badgeClass}">${movement.display_type}</span></td>
            <td>${source}</td>
            <td>${destination}</td>
            <td>${movement.users?.full_name || 'System'}</td>
            <td class="td-remarks">${remarks || '-'}</td>
            <td>
                <button class="btn-info" onclick="openMovementInfo('${movement.id}')" title="View Details" style="border: none; background: #e8f0fe; color: #1967d2; cursor: pointer; padding: 6px; border-radius: 4px; display: flex; align-items: center; justify-content: center;">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v8z"/></svg>
                </button>
            </td>
        `;

        tableBody.appendChild(row);
    });

    updateSmPagination(start + 1, end, filteredMovements.length);
}

// ============================================
// PAGINATION
// ============================================
function updateSmPagination(start, end, total) {
    const pageInfo = document.getElementById('sm-page-info');
    if (pageInfo) {
        pageInfo.textContent = total > 0 ? `${start}-${end} of ${total}` : '0 of 0';
    }
    const prevBtn = document.getElementById('sm-prev-page');
    const nextBtn = document.getElementById('sm-next-page');
    if (prevBtn) prevBtn.disabled = smCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = end >= total;
}

function changeSmPage(delta) {
    const totalPages = Math.ceil(filteredMovements.length / smRowsPerPage);
    smCurrentPage = Math.max(1, Math.min(smCurrentPage + delta, totalPages));
    displayMovements();
}

function changeSmRowsPerPage() {
    smRowsPerPage = parseInt(document.getElementById('sm-rows-per-page').value);
    smCurrentPage = 1;
    displayMovements();
}

// ============================================
// MOVEMENT MODAL
// ============================================
function openMovementModal() {
    const modal = document.getElementById('movement-modal');
    document.getElementById('movement-form').reset();
    document.getElementById('mv-item').value = '';
    document.getElementById('mv-item-display').value = '';
    document.getElementById('mv-person-id').value = '';
    document.getElementById('mv-writeoff-fields').style.display = 'none';
    const submitBtn = document.getElementById('mv-submit-btn');
    submitBtn.style.background = '';
    submitBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Record Movement`;
    modal.classList.add('show');
}

function closeMovementModal() {
    document.getElementById('movement-modal').classList.remove('show');
    document.getElementById('movement-form').reset();
    document.getElementById('mv-item').value = '';
    document.getElementById('mv-item-display').value = '';
    document.getElementById('mv-writeoff-fields').style.display = 'none';
}

// Info Modal Helpers
function openMovementInfo(movementId) {
    const movement = allMovements.find(m => m.id === movementId);
    if (!movement) return;

    const modal = document.getElementById('movement-info-modal');
    
    document.getElementById('info-ref-id').textContent = movement.ref_id;
    document.getElementById('info-date').textContent = new Date(movement.created_at).toLocaleString();
    document.getElementById('info-item-name').textContent = movement.inventory_items?.item_name || 'Unknown Item';
    document.getElementById('info-item-id').textContent = movement.item_id || '-';
    
    const typeBadge = document.getElementById('info-type');
    typeBadge.textContent = movement.display_type;
    typeBadge.className = getMovementBadgeClass(movement.display_type);

    document.getElementById('info-from').textContent = movement.from_location || '-';
    document.getElementById('info-to').textContent = movement.to_location || '-';
    document.getElementById('info-user').textContent = movement.users?.full_name || 'System';
    document.getElementById('info-qty').textContent = movement.quantity || 1;
    
    let remarks = movement.reason || 'No remarks provided.';
    remarks = remarks.replace(/\[(Issue|Return|Transfer|Lost\/Stolen|Damaged)\]\s*/gi, '');
    document.getElementById('info-remarks').textContent = remarks;

    modal.classList.add('show');
}

function closeInfoModal() {
    document.getElementById('movement-info-modal').classList.remove('show');
}

function onMovementTypeChange() {
    const type = document.getElementById('mv-type').value;
    const writeoffFields = document.getElementById('mv-writeoff-fields');
    const submitBtn = document.getElementById('mv-submit-btn');

    if (type === 'Lost/Stolen' || type === 'Damaged') {
        writeoffFields.style.display = 'block';
        submitBtn.style.background = '#c5221f';
        submitBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg> Mark & Remove`;
    } else {
        writeoffFields.style.display = 'none';
        submitBtn.style.background = '';
        submitBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Record Movement`;
    }
}

// Close modal on outside click
window.addEventListener('click', function(event) {
    const modal = document.getElementById('movement-modal');
    if (event.target == modal) {
        closeMovementModal();
    }
});

// ============================================
// RECORD MOVEMENT
// ============================================
async function recordMovement(event) {
    event.preventDefault();
    
    const itemId = document.getElementById('mv-item').value;
    const movementType = document.getElementById('mv-type').value;
    const person = document.getElementById('mv-person').value.trim();
    const personId = document.getElementById('mv-person-id').value;
    const fromLocation = document.getElementById('mv-from').value;
    const toLocation = document.getElementById('mv-to').value;
    const remarks = document.getElementById('mv-remarks').value;

    if (!itemId || !movementType) {
        showToast('Please select an item and movement type.', 'warning');
        return;
    }

    if (!person) {
        showToast('Please enter the person involved.', 'warning');
        return;
    }

    if (movementType === 'Transfer' && (!fromLocation || !toLocation)) {
        showToast('Please select both Source and Destination for a transfer.', 'warning');
        return;
    }

    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    let dbMovementType = 'adjustment';

    switch(movementType) {
        case 'Issue':
            dbMovementType = 'out';
            break;
        case 'Return':
            dbMovementType = 'in';
            break;
        case 'Transfer':
            dbMovementType = 'adjustment';
            break;
        case 'Lost/Stolen':
        case 'Damaged':
            dbMovementType = 'out';
            break;
    }

    // Build reason with type tag and person
    const reason = remarks 
        ? `[${movementType}] Person: ${person}. ${remarks}` 
        : `[${movementType}] Person: ${person}`;

    const movementData = {
        item_id: itemId,
        user_id: user.id,
        movement_type: dbMovementType,
        quantity: 1,
        reason: reason,
        from_location: fromLocation || null,
        to_location: toLocation || null,
        assigned_to: (movementType === 'Issue' && personId) ? personId : null
    };

    const submitBtn = document.getElementById('mv-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Recording...';

    // Record the movement
    const { error: recordError } = await supabaseApi.createStockMovement(movementData);

    if (recordError) {
        console.error('Error recording movement:', recordError);
        showToast('Failed to record movement: ' + recordError.message, 'error');
        resetSubmitBtn(movementType);
        return;
    }

    // For Lost/Stolen/Damaged: label the item and set quantity to 0
    if (movementType === 'Lost/Stolen' || movementType === 'Damaged') {
        const conditionLabel = movementType === 'Lost/Stolen' ? 'Lost/Stolen' : 'Damaged';
        const { error: updateError } = await supabaseApi.updateInventoryItem(itemId, {
            condition: conditionLabel,
            quantity: 0
        });

        if (updateError) {
            console.error('Error updating item condition:', updateError);
            showToast('Movement recorded but failed to label item: ' + updateError.message, 'warning');
        } else {
            showToast(`Item marked as "${conditionLabel}" and removed from active inventory.`, 'success');
        }
    } else if (movementType === 'Issue') {
        // Mark item as Issued
        await supabaseApi.updateInventoryItem(itemId, { status: 'issued' });
        showToast(`Item issued to ${person} successfully!`, 'success');
    } else if (movementType === 'Return') {
        // Mark item as Available again
        await supabaseApi.updateInventoryItem(itemId, { status: 'available' });
        showToast('Item returned and marked as Available!', 'success');
    } else if (movementType === 'Transfer') {
        // Update item location and mark as Transferred
        await supabaseApi.updateInventoryItem(itemId, { 
            location: toLocation,
            department: toLocation, // Assume department matches center/campus for transfers
            status: 'transferred'
        });
        showToast(`Item transferred to ${toLocation} successfully!`, 'success');
    } else {
        showToast('Movement recorded successfully!', 'success');
    }

    closeMovementModal();
    resetSubmitBtn(movementType);
    await loadStockMovements();
    await loadInventoryItemsForSelect();
}

function resetSubmitBtn(movementType) {
    const submitBtn = document.getElementById('mv-submit-btn');
    submitBtn.disabled = false;
    submitBtn.style.background = '';
    submitBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Record Movement`;
}
