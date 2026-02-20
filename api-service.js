/**
 * Supabase API Service Layer
 * Flat functions for KNS Inventory System
 */

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

/**
 * Sign up a new user
 */
async function signUp(email, password, fullName, role = 'user') {
    try {
        const { data: authData, error: authError } = await window.supabaseClient.auth.signUp({
            email,
            password,
        });

        if (authError) throw authError;

        const { data: profileData, error: profileError } = await window.supabaseClient
            .from('users')
            .insert([
                {
                    id: authData.user.id,
                    full_name: fullName,
                    email: email,
                    role: role
                }
            ])
            .select()
            .single();

        if (profileError) throw profileError;

        return { user: { ...authData.user, profile: profileData }, error: null };
    } catch (error) {
        console.error('Sign up error:', error);
        return { user: null, error };
    }
}

/**
 * Sign in existing user
 */
async function signIn(email, password) {
    try {
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;

        const { data: profile, error: profileError } = await window.supabaseClient
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (profileError) throw profileError;

        return { user: { ...data.user, profile }, error: null };
    } catch (error) {
        console.error('Sign in error:', error);
        return { user: null, error };
    }
}

/**
 * Sign out current user
 */
async function signOut() {
    try {
        const { error } = await window.supabaseClient.auth.signOut();
        return { error };
    } catch (error) {
        console.error('Sign out error:', error);
        return { error };
    }
}

/**
 * Get current user session
 */
async function getCurrentUser() {
    try {
        const { data: { user }, error } = await window.supabaseClient.auth.getUser();
        
        if (error) throw error;
        if (!user) return { user: null, error: null };

        const { data: profile, error: profileError } = await window.supabaseClient
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError) throw profileError;

        return { user: { ...user, profile }, error: null };
    } catch (error) {
        console.error('Get current user error:', error);
        return { user: null, error };
    }
}

/**
 * Update user profile
 */
async function updateUserProfile(userId, data) {
    try {
        const { data: updated, error } = await window.supabaseClient
            .from('users')
            .update(data)
            .eq('id', userId)
            .select()
            .single();

        if (!error) return { data: updated, error: null };

        console.warn('Standard user update failed, attempting Upsert fallback...', error);
        const upsertPayload = { ...data, id: userId };
        const { data: upsertData, error: upsertError } = await window.supabaseClient
            .from('users')
            .upsert(upsertPayload)
            .select()
            .single();

        if (!upsertError) return { data: upsertData, error: null };
        throw upsertError;

    } catch (error) {
        console.error('All user update attempts failed:', error);
        return { data: null, error };
    }
}

// ============================================
// INVENTORY FUNCTIONS
// ============================================

/**
 * Get all inventory items
 */
async function getInventoryItems(filters = {}) {
    const applyFilters = (query) => {
         if (filters.category) query = query.eq('category', filters.category);
         if (filters.minQuantity !== undefined) query = query.gte('quantity', filters.minQuantity);
         if (filters.maxQuantity !== undefined) query = query.lte('quantity', filters.maxQuantity);
         if (filters.condition) query = query.eq('condition', filters.condition);
         if (filters.search) query = query.ilike('item_name', `%${filters.search}%`);
         return query;
    };

    try {
        let query = window.supabaseClient
            .from('inventory_items')
            .select('*, assigned_user:users!assigned_to(full_name)')
            .order('item_name', { ascending: true });

        query = applyFilters(query);
        const { data, error } = await query;
        
        if (!error) return { data, error: null };

        console.warn('Full inventory query failed, trying simple fetch...', error);
        let simpleQuery = window.supabaseClient
             .from('inventory_items')
             .select('*')
             .order('item_name', { ascending: true });

        simpleQuery = applyFilters(simpleQuery);
        const { data: simpleData, error: simpleError } = await simpleQuery;
        
        return { data: simpleData, error: simpleError };

    } catch (error) {
        console.error('Get inventory items exception:', error);
        return { data: null, error };
    }
}

async function getInventoryItem(id) {
    try {
        const { data, error } = await window.supabaseClient
            .from('inventory_items')
            .select('*, assigned_user:users!assigned_to(full_name)')
            .eq('id', id)
            .single();
        return { data, error };
    } catch (error) {
        console.error('Get inventory item error:', error);
        return { data: null, error };
    }
}

async function getAssignedItems(userId) {
    try {
        const { data, error } = await window.supabaseClient
            .from('inventory_items')
            .select('*')
            .eq('assigned_to', userId);
        return { data, error };
    } catch (error) {
        console.error('Get assigned items error:', error);
        return { data: [], error };
    }
}

async function createInventoryItem(itemData) {
    const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    let finalId = generateUUID();
    try {
        const { data, error: idError } = await window.supabaseClient.rpc('generate_inventory_id', { item_category: itemData.category });
        if (!idError && data) finalId = data;
    } catch (e) { console.warn('ID Gen failed', e); }

    try {
        const { data, error } = await window.supabaseClient
            .from('inventory_items')
            .insert([{ ...itemData, id: finalId }])
            .select()
            .single();

        if (!error) return { data, error: null };
        throw error;
    } catch (error) {
        console.error('Create inventory item failed:', error);
        return { data: null, error };
    }
}

async function updateInventoryItem(id, itemData) {
    try {
        const { data, error } = await window.supabaseClient
            .from('inventory_items')
            .update(itemData)
            .eq('id', id)
            .select()
            .single();

        if (!error) return data;

        const upsertPayload = { ...itemData, id: id };
        const { data: upsertData, error: upsertError } = await window.supabaseClient
            .from('inventory_items')
            .upsert(upsertPayload)
            .select()
            .single();

        if (!upsertError) return upsertData;
        throw upsertError;
    } catch (error) {
        console.error('Update inventory item failed:', error);
        throw error;
    }
}

async function getDistinctCategories() {
    try {
        const { data, error } = await window.supabaseClient.from('inventory_items').select('category');
        if (error) throw error;
        const categories = [...new Set(data.map(item => item.category))].filter(Boolean).sort();
        return { data: categories, error: null };
    } catch (error) {
        console.error('Get categories error:', error);
        return { data: [], error };
    }
}

async function getDistinctDepartments() {
    try {
        const invQuery = await window.supabaseClient.from('inventory_items').select('department');
        const userQuery = await window.supabaseClient.from('users').select('department');
        const invDepts = (invQuery.data || []).map(d => d.department);
        const userDepts = (userQuery.data || []).map(d => d.department);
        const departments = [...new Set([...invDepts, ...userDepts])].filter(Boolean).sort();
        return { data: departments, error: null };
    } catch (error) {
        console.error('Get departments error:', error);
        return { data: [], error };
    }
}

async function deleteInventoryItem(id) {
    try {
        const { error } = await window.supabaseClient.from('inventory_items').delete().eq('id', id);
        return { error };
    } catch (error) {
        console.error('Delete inventory item error:', error);
        return { error };
    }
}

async function getLowStockItems() {
    try {
        const { data, error } = await window.supabaseClient.rpc('get_low_stock_items');
        return { data, error };
    } catch (error) {
        console.error('Get low stock items error:', error);
        return { data: null, error };
    }
}

// ============================================
// STOCK MOVEMENT FUNCTIONS
// ============================================

async function getStockMovements(filters = {}) {
    try {
        let query = window.supabaseClient
            .from('stock_movements')
            .select(`*, inventory_items!item_id(item_name, category), users!user_id(full_name, email)`)
            .order('created_at', { ascending: false });

        if (filters.itemId) query = query.eq('item_id', filters.itemId);
        if (filters.userId) query = query.eq('user_id', filters.userId);
        if (filters.movementType) query = query.eq('movement_type', filters.movementType);
        if (filters.startDate) query = query.gte('created_at', filters.startDate);
        if (filters.endDate) query = query.lte('created_at', filters.endDate);

        const { data, error } = await query;
        if (!error) return { data, error: null };

        console.warn('Stock Movement query failed, retrying simple...', error);
        let simpleQuery = window.supabaseClient.from('stock_movements').select('*').order('created_at', { ascending: false });
        const { data: simpleData, error: simpleError } = await simpleQuery;
        return { data: simpleData, error: simpleError };
    } catch (error) {
        console.error('Get stock movements error:', error);
        return { data: null, error };
    }
}

async function createStockMovement(movementData) {
    try {
        const { data, error } = await window.supabaseClient.from('stock_movements').insert([movementData]).select().single();
        if (!error && (movementData.movement_type === 'in' || movementData.movement_type === 'out')) {
            const quantityChange = movementData.movement_type === 'in' ? movementData.quantity : -movementData.quantity;
            await window.supabaseClient.rpc('update_inventory_quantity', {
                item_id: movementData.item_id,
                quantity_change: quantityChange,
                p_assigned_to: movementData.assigned_to || null
            });
        }
        return { data, error };
    } catch (error) {
        console.error('Create stock movement error:', error);
        return { data: null, error };
    }
}

async function clearStockMovements() {
    try {
        const { error } = await window.supabaseClient.from('stock_movements').delete().neq('item_id', '00000000-0000-0000-0000-000000000000');
        return { error };
    } catch (error) {
        console.error('Clear stock movements error:', error);
        return { error };
    }
}

// ============================================
// REQUEST FUNCTIONS
// ============================================

async function getRequests(filters = {}) {
    try {
        let query = window.supabaseClient.from('requests').select(`*, inventory_items (item_name, category, unit), users (full_name, email)`).order('created_at', { ascending: false });
        if (filters.userId) query = query.eq('user_id', filters.userId);
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.itemId) query = query.eq('item_id', filters.itemId);
        const { data, error } = await query;
        return { data, error };
    } catch (error) {
        console.error('Get requests error:', error);
        return { data: null, error };
    }
}

async function createRequest(requestData) {
    try {
        const { data, error } = await window.supabaseClient.from('requests').insert([requestData]).select().single();
        return { data, error };
    } catch (error) {
        console.error('Create request error:', error);
        return { data: null, error };
    }
}

async function updateRequestStatus(id, status, adminNotes = '') {
    try {
        const { error: rpcError } = await window.supabaseClient.rpc('update_request_status', {
            p_request_id: id,
            p_status: status,
            p_admin_notes: adminNotes
        });
        if (!rpcError) return { data: { id, status, admin_notes: adminNotes }, error: null };
        const { data: updated, error } = await window.supabaseClient.from('requests').update({ status, admin_notes: adminNotes }).eq('id', id).select().single();
        return { data: updated, error };
    } catch (error) {
        console.error('Update request status error:', error);
        return { data: null, error };
    }
}

async function fulfillRequest(requestId) {
    try {
        const { data, error } = await window.supabaseClient.rpc('fulfill_request', { p_request_id: requestId });
        return { data, error };
    } catch (error) {
        console.error('Fulfill request error:', error);
        return { data: null, error };
    }
}

// ============================================
// USER MANAGEMENT FUNCTIONS
// ============================================

async function getAllUsers() {
    try {
        const { data, error } = await window.supabaseClient.from('users').select('*').order('created_at', { ascending: false });
        return { data, error };
    } catch (error) {
        console.error('Get all users error:', error);
        return { data: null, error };
    }
}

async function updateUserRole(userId, role) {
    try {
        const { data: updated, error } = await window.supabaseClient.from('users').update({ role }).eq('id', userId);
        if (!error) return { data: updated, error: null };
        const { data: upsertData, error: upsertError } = await window.supabaseClient.from('users').upsert({ id: userId, role }).select().single();
        return { data: upsertData, error: upsertError };
    } catch (error) {
        console.error('Update user role error:', error);
        return { data: null, error };
    }
}

async function deleteUser(userId) {
    try {
        const { error } = await window.supabaseClient.from('users').delete().eq('id', userId);
        return { error };
    } catch (error) {
        console.error('Delete user error:', error);
        return { error };
    }
}

async function updateUserStatus(userId, status) {
    try {
        const rpcFunction = status === 'approved' ? 'approve_user' : 'reject_user';
        const { error: rpcError } = await window.supabaseClient.rpc(rpcFunction, { target_user_id: userId });
        if (!rpcError) return { error: null };
        const { error } = await window.supabaseClient.from('users').update({ status }).eq('id', userId);
        return { error };
    } catch (error) {
        console.error('Update user status error:', error);
        return { error };
    }
}

// ============================================
// STORAGE FUNCTIONS
// ============================================

async function uploadImage(file, path) {
    try {
        const { data, error } = await window.supabaseClient.storage.from('avatars').upload(path, file, { cacheControl: '3600', upsert: true });
        return { data, error };
    } catch (error) {
        console.error('Upload image error:', error);
        return { data: null, error };
    }
}

function getPublicUrl(path) {
    const { data } = window.supabaseClient.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
}

// ============================================
// REAL-TIME SUBSCRIPTIONS
// ============================================

function subscribeToInventory(callback) {
    return window.supabaseClient.channel('inventory-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, callback).subscribe();
}

function subscribeToRequests(callback) {
    return window.supabaseClient.channel('request-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, callback).subscribe();
}

// EXPORT TO GLOBAL SCOPE
window.signUp = signUp;
window.signIn = signIn;
window.signOut = signOut;
window.getCurrentUser = getCurrentUser;
window.updateUserProfile = updateUserProfile;
window.getInventoryItems = getInventoryItems;
window.getInventoryItem = getInventoryItem;
window.getAssignedItems = getAssignedItems;
window.createInventoryItem = createInventoryItem;
window.updateInventoryItem = updateInventoryItem;
window.getDistinctCategories = getDistinctCategories;
window.getDistinctDepartments = getDistinctDepartments;
window.deleteInventoryItem = deleteInventoryItem;
window.getLowStockItems = getLowStockItems;
window.getStockMovements = getStockMovements;
window.createStockMovement = createStockMovement;
window.clearStockMovements = clearStockMovements;
window.getRequests = getRequests;
window.createRequest = createRequest;
window.updateRequestStatus = updateRequestStatus;
window.fulfillRequest = fulfillRequest;
window.getAllUsers = getAllUsers;
window.updateUserRole = updateUserRole;
window.deleteUser = deleteUser;
window.updateUserStatus = updateUserStatus;
window.uploadImage = uploadImage;
window.getPublicUrl = getPublicUrl;
window.subscribeToInventory = subscribeToInventory;
window.subscribeToRequests = subscribeToRequests;

// Compatibility Layer (To be removed after updating other files)
window.supabaseApi = {
    signUp, signIn, signOut, getCurrentUser, updateUserProfile,
    getInventoryItems, getInventoryItem, getAssignedItems, createInventoryItem, updateInventoryItem,
    getDistinctCategories, getDistinctDepartments, deleteInventoryItem, getLowStockItems,
    getStockMovements, createStockMovement, clearStockMovements,
    getRequests, createRequest, updateRequestStatus, fulfillRequest,
    getAllUsers, updateUserRole, deleteUser, updateUserStatus,
    uploadImage, getPublicUrl, subscribeToInventory, subscribeToRequests
};
