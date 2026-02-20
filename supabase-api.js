/**
 * Supabase API Service Layer
 * Centralized API endpoints for KNS Inventory System
 */

const supabaseApi = {
    
    // ============================================
    // AUTHENTICATION ENDPOINTS
    // ============================================
    
    /**
     * Sign up a new user
     * @param {string} email 
     * @param {string} password 
     * @param {string} fullName 
     * @param {string} role - 'admin' or 'user'
     * @returns {Promise<{user, error}>}
     */
    async signUp(email, password, fullName, role = 'user') {
        try {
            // Create auth user
            const { data: authData, error: authError } = await supabaseClient.auth.signUp({
                email,
                password,
            });

            if (authError) throw authError;

            // Create user profile
            const { data: profileData, error: profileError } = await supabaseClient
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
    },

    /**
     * Sign in existing user
     * @param {string} email 
     * @param {string} password 
     * @returns {Promise<{user, error}>}
     */
    async signIn(email, password) {
        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            // Fetch user profile
            const { data: profile, error: profileError } = await supabaseClient
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
    },

    /**
     * Sign out current user
     * @returns {Promise<{error}>}
     */
    async signOut() {
        try {
            const { error } = await supabaseClient.auth.signOut();
            return { error };
        } catch (error) {
            console.error('Sign out error:', error);
            return { error };
        }
    },

    /**
     * Get current user session
     * @returns {Promise<{user, error}>}
     */
    async getCurrentUser() {
        try {
            const { data: { user }, error } = await supabaseClient.auth.getUser();
            
            if (error) throw error;
            if (!user) return { user: null, error: null };

            // Fetch user profile
            const { data: profile, error: profileError } = await supabaseClient
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
    },

    /**
     * Update user profile
     * @param {string} userId 
     * @param {object} data 
     * @returns {Promise<{data, error}>}
     */
    async updateUserProfile(userId, data) {
        console.log('Update User Profile:', { userId, data });
        
        try {
            // Attempt 1: Standard Update (PATCH)
            const { data: updated, error } = await supabaseClient
                .from('users')
                .update(data)
                .eq('id', userId)
                .select()
                .single();

            if (!error) return { data: updated, error: null };

            // If it's a network error/fetch error, it might be the PATCH method being blocked
            console.warn('Standard user update failed (PATCH), attempting Upsert (POST) fallback...', error);

            // Attempt 2: Upsert (POST)
            const upsertPayload = { ...data, id: userId };
            const { data: upsertData, error: upsertError } = await supabaseClient
                .from('users')
                .upsert(upsertPayload)
                .select()
                .single();

            if (!upsertError) {
                console.log('User upsert successful (POST fallback)');
                return { data: upsertData, error: null };
            }

            throw upsertError;

        } catch (error) {
            console.error('All user update attempts failed:', error);
            return { data: null, error };
        }
    },

    // ============================================
    // INVENTORY ENDPOINTS
    // ============================================

    /**
     * Get all inventory items with optional filters
     * @param {object} filters - { category, minQuantity, maxQuantity, condition }
     * @returns {Promise<{data, error}>}
     */
    async getInventoryItems(filters = {}) {
        const applyFilters = (query) => {
             if (filters.category) query = query.eq('category', filters.category);
             if (filters.minQuantity !== undefined) query = query.gte('quantity', filters.minQuantity);
             if (filters.maxQuantity !== undefined) query = query.lte('quantity', filters.maxQuantity);
             if (filters.condition) query = query.eq('condition', filters.condition);
             if (filters.search) query = query.ilike('item_name', `%${filters.search}%`);
             return query;
        };

        try {
            // Attempt 1: Full Query with User Details (JOINS)
            let query = supabaseClient
                .from('inventory_items')
                .select('*, assigned_user:users!assigned_to(full_name)')
                .order('item_name', { ascending: true });

            query = applyFilters(query);
            const { data, error } = await query;
            
            if (!error) return { data, error: null };

            console.warn('Failed to load full inventory (likely foreign key/schema issue), retrying simple fetch...', error);

            // Attempt 2: Simple Query (No Joins)
            let simpleQuery = supabaseClient
                 .from('inventory_items')
                 .select('*')
                 .order('item_name', { ascending: true });

            simpleQuery = applyFilters(simpleQuery);
            const { data: simpleData, error: simpleError } = await simpleQuery;
            
            return { data: simpleData, error: simpleError };

        } catch (error) {
            console.error('Get inventory items exception:', error);
            // Check for specific connection errors
            if (error.message === 'Failed to fetch') {
                console.error('Network error: Could not reach Supabase. Check your URL and Key.');
            }
            return { data: null, error };
        }
    },

    /**
     * Get single inventory item
     * @param {string} id 
     * @returns {Promise<{data, error}>}
     */
    async getInventoryItem(id) {
        try {
            const { data, error } = await supabaseClient
                .from('inventory_items')
                .select('*, assigned_user:users!assigned_to(full_name)')
                .eq('id', id)
                .single();

            return { data, error };
        } catch (error) {
            console.error('Get inventory item error:', error);
            return { data: null, error };
        }
    },

    /**
     * Get inventory items assigned to a specific user
     * @param {string} userId 
     * @returns {Promise<{data, error}>}
     */
    async getAssignedItems(userId) {
        try {
            const { data, error } = await supabaseClient
                .from('inventory_items')
                .select('*')
                .eq('assigned_to', userId);
            
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Get assigned items error:', error);
            return { data: [], error };
        }
    },

    /**
     * Create new inventory item
     * @param {object} itemData 
     * @returns {Promise<{data, error}>}
     */
    async createInventoryItem(itemData) {
        let finalId = null;

        // Helper: Generate UUID v4 client-side
        const generateUUID = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };

        try {
            // Attempt 1: Get custom ID from RPC (e.g. PC-001)
            const { data, error: idError } = await supabaseClient
                .rpc('generate_inventory_id', { item_category: itemData.category });
            
            if (!idError && data) {
                finalId = data;
            } else {
                console.warn('ID Generation RPC failed/empty, falling back to client-side UUID', idError);
                finalId = generateUUID();
            }
        } catch (e) {
            console.warn('ID Generation RPC exception, falling back to client-side UUID', e);
            finalId = generateUUID();
        }

        try {
            // Attempt 1: Insert with generated ID
            // We MUST provide an ID because the DB column likely has no DEFAULT value (hence the not-null error)
            const payload = { ...itemData, id: finalId };

            const { data, error } = await supabaseClient
                .from('inventory_items')
                .insert([payload])
                .select()
                .single();

            if (!error) return { data, error: null };

            console.warn('Create failed with ID ' + finalId, error);

            // Attempt 2: Retry with a DIFFERENT ID format (Simple Text)
            // If the DB is TEXT but didn't like UUID format? Unlikely.
            // If the DB is UUID but didn't like Custom Text format? Possible.
            
            // If error code is 22P02 (Invalid Text Representation for UUID)
            // We must try a valid UUID again (if finalId was Text).
            // But if finalId IS UUID (from fallback) and it failed?
            
            // Let's try inserting WITHOUT ID (hoping for default) - wait, we know default is missing.
            // UNLESS the error 23502 (not-null) only happens when we explicit send null.
            // But payload has ID. So not-null error implies ID was somehow removed or rejected?
            
            // If the error was "duplicate key", we should retry with new ID.
            if (error.code === '23505') { // Unique violation
                 const newId = generateUUID();
                 console.log('Retrying with new UUID due to collision...');
                 const { data: retryData, error: retryError } = await supabaseClient
                    .from('inventory_items')
                    .insert([{ ...itemData, id: newId }])
                    .select()
                    .single();
                 
                 if (!retryError) return { data: retryData, error: null };
            }

            // Attempt 3: Retry with Core Fields Only (and Generated ID)
            // This handles accidental missing columns
            const coreData = {
                id: finalId, // Persist ID
                item_name: itemData.item_name,
                category: itemData.category,
                quantity: itemData.quantity || 0,
                unit: itemData.unit || 'pcs',
                condition: itemData.condition || 'good',
                location: itemData.location,
                department: itemData.department || itemData.location,
                min_stock_level: itemData.min_stock_level || 5
            };

            const { data: coreResult, error: coreError } = await supabaseClient
                .from('inventory_items')
                .insert([coreData])
                .select()
                .single();

            if (coreError) throw coreError; // Return original error if this fails

            console.log('Core fields creation successful');
            return { data: coreResult, error: null };

        } catch (error) {
            console.error('All create attempts failed:', error);
            return { data: null, error };
        }
    },

    /**
     * Update inventory item
     * @param {string} id 
     * @param {object} itemData 
     * @returns {Promise<object>}
     */
    async updateInventoryItem(id, itemData) {
        console.log('Update Item Payload:', { id, itemData });
        
        // Attempt 1: Standard Update (PATCH)
        const { data, error } = await supabaseClient
            .from('inventory_items')
            .update(itemData)
            .eq('id', id)
            .select()
            .single();

        if (!error) return data;

        console.warn('Standard update failed (PATCH), attempting Upsert (POST) fallback...', error);

        try {
            // Attempt 2: Upsert (POST)
            // This bypasses network issues with PATCH method
            const upsertPayload = { ...itemData, id: id };
            
            const { data: upsertData, error: upsertError } = await supabaseClient
                .from('inventory_items')
                .upsert(upsertPayload)
                .select()
                .single();

            if (!upsertError) {
                console.log('Upsert successful (POST fallback)');
                return upsertData;
            }
            
            console.warn('Upsert failed, attempting Core Fields Upsert...', upsertError);

            // Attempt 3: Core Fields Only Upsert
            // Handles missing columns + network issues
            const coreData = {
                id: id,
                item_name: itemData.item_name,
                category: itemData.category,
                quantity: itemData.quantity || 0,
                unit: itemData.unit || 'pcs',
                condition: itemData.condition || 'good',
                location: itemData.location || 'General',
                department: itemData.department || itemData.location || 'General',
                min_stock_level: itemData.min_stock_level || 5
            };

            const { data: coreResult, error: coreError } = await supabaseClient
                .from('inventory_items')
                .upsert(coreData)
                .select()
                .single();
            
            if (coreError) throw coreError;
            
            console.log('Core fields upsert successful');
            return coreResult;

        } catch (finalError) {
            console.error('All update attempts failed:', finalError.message);
            throw finalError;
        }
    },

    /**
     * Get distinct categories from inventory
     * @returns {Promise<{data: string[], error}>}
     */
    async getDistinctCategories() {
        try {
            const { data, error } = await supabaseClient
                .from('inventory_items')
                .select('category');
            
            if (error) throw error;
            
            // Extract unique categories
            const categories = [...new Set(data.map(item => item.category))].filter(Boolean).sort();
            return { data: categories, error: null };
        } catch (error) {
            console.error('Get categories error:', error);
            return { data: [], error };
        }
    },

    /**
     * Get distinct departments from inventory
     * @returns {Promise<{data: string[], error}>}
     */
    async getDistinctDepartments() {
        try {
            // Use separate calls instead of Promise.all to isolate the 400 error
            const invQuery = await supabaseClient.from('inventory_items').select('department');
            if (invQuery.error) console.warn('Inventory departments fetch error:', invQuery.error);
            
            const userQuery = await supabaseClient.from('users').select('department');
            if (userQuery.error) console.warn('User departments fetch error:', userQuery.error);
            
            const invDepts = (invQuery.data || []).map(d => d.department);
            const userDepts = (userQuery.data || []).map(d => d.department);
            
            // Extract unique departments
            const departments = [...new Set([...invDepts, ...userDepts])].filter(Boolean).sort();
            return { data: departments, error: null };
        } catch (error) {
            console.error('Get departments error:', error);
            return { data: [], error };
        }
    },

    /**
     * Delete inventory item
     * @param {string} id 
     * @returns {Promise<{error}>}
     */
    async deleteInventoryItem(id) {
        try {
            const { error } = await supabaseClient
                .from('inventory_items')
                .delete()
                .eq('id', id);

            return { error };
        } catch (error) {
            console.error('Delete inventory item error:', error);
            return { error };
        }
    },

    /**
     * Get items with low stock
     * @returns {Promise<{data, error}>}
     */
    async getLowStockItems() {
        try {
            const { data, error } = await supabaseClient
                .rpc('get_low_stock_items');

            return { data, error };
        } catch (error) {
            console.error('Get low stock items error:', error);
            return { data: null, error };
        }
    },

    // ============================================
    // STOCK MOVEMENT ENDPOINTS
    // ============================================

    /**
     * Get stock movements with filters
     * @param {object} filters - { itemId, userId, movementType, startDate, endDate }
     * @returns {Promise<{data, error}>}
     */
    async getStockMovements(filters = {}) {
        const applyFilters = (query) => {
             if (filters.itemId) query = query.eq('item_id', filters.itemId);
             if (filters.userId) query = query.eq('user_id', filters.userId);
             if (filters.movementType) query = query.eq('movement_type', filters.movementType);
             if (filters.startDate) query = query.gte('created_at', filters.startDate);
             if (filters.endDate) query = query.lte('created_at', filters.endDate);
             return query;
        };

        try {
            // Attempt 1: Full Query with Joins
            let query = supabaseClient
                .from('stock_movements')
                .select(`
                    *,
                    inventory_items!item_id(item_name, category),
                    users!user_id(full_name, email)
                `)
                .order('created_at', { ascending: false });

            query = applyFilters(query);
            const { data, error } = await query;

            if (!error) return { data, error: null };

            console.warn('Stock Movement JOIN fetch failed, falling back to simple fetch...', error);

            // Attempt 2: Simple Query (No Joins)
            let simpleQuery = supabaseClient
                .from('stock_movements')
                .select('*')
                .order('created_at', { ascending: false });

            simpleQuery = applyFilters(simpleQuery);
            const { data: simpleData, error: simpleError } = await simpleQuery;

            return { data: simpleData, error: simpleError };

        } catch (error) {
            console.error('Get stock movements error:', error);
            return { data: null, error };
        }
    },

    /**
     * Create stock movement
     * @param {object} movementData 
     * @returns {Promise<{data, error}>}
     */
    async createStockMovement(movementData) {
        try {
            const { data, error } = await supabaseClient
                .from('stock_movements')
                .insert([movementData])
                .select()
                .single();

            // If movement is 'in' or 'out', update inventory quantity
            if (!error && (movementData.movement_type === 'in' || movementData.movement_type === 'out')) {
                const quantityChange = movementData.movement_type === 'in' 
                    ? movementData.quantity 
                    : -movementData.quantity;

                const { error: rpcError } = await supabaseClient.rpc('update_inventory_quantity', {
                    item_id: movementData.item_id,
                    quantity_change: quantityChange,
                    p_assigned_to: movementData.assigned_to || null
                });

                if (rpcError) throw rpcError;
            }

            return { data, error };
        } catch (error) {
            console.error('Create stock movement error:', error);
            return { data: null, error };
        }
    },

    /**
     * Clear all stock movements
     * @returns {Promise<{error}>}
     */
    async clearStockMovements() {
        try {
            // Delete all rows where item_id is NOT a null UUID (effectively all rows since item_id is a foreign key)
            const { error } = await supabaseClient
                .from('stock_movements')
                .delete()
                .neq('item_id', '00000000-0000-0000-0000-000000000000');
            
            return { error };
        } catch (error) {
            console.error('Clear stock movements error:', error);
            return { error };
        }
    },

    /**
     * Get stock movements by user
     * @param {string} userId 
     * @returns {Promise<{data, error}>}
     */
    async getStockMovementsByUser(userId) {
        return this.getStockMovements({ userId });
    },

    // ============================================
    // REQUEST ENDPOINTS
    // ============================================

    /**
     * Get requests with filters
     * @param {object} filters - { userId, status, itemId }
     * @returns {Promise<{data, error}>}
     */
    async getRequests(filters = {}) {
        try {
            let query = supabaseClient
                .from('requests')
                .select(`
                    *,
                    inventory_items (item_name, category, unit),
                    users (full_name, email)
                `)
                .order('created_at', { ascending: false });

            if (filters.userId) {
                query = query.eq('user_id', filters.userId);
            }
            if (filters.status) {
                query = query.eq('status', filters.status);
            }
            if (filters.itemId) {
                query = query.eq('item_id', filters.itemId);
            }

            const { data, error } = await query;
            return { data, error };
        } catch (error) {
            console.error('Get requests error:', error);
            return { data: null, error };
        }
    },

    /**
     * Create new request
     * @param {object} requestData 
     * @returns {Promise<{data, error}>}
     */
    async createRequest(requestData) {
        try {
            const { data, error } = await supabaseClient
                .from('requests')
                .insert([requestData])
                .select()
                .single();

            return { data, error };
        } catch (error) {
            console.error('Create request error:', error);
            return { data: null, error };
        }
    },

    /**
     * Update request status
     * @param {string} id 
     * @param {string} status - 'pending', 'approved', 'rejected', 'fulfilled'
     * @param {string} adminNotes 
     * @returns {Promise<{data, error}>}
     */
    async updateRequestStatus(id, status, adminNotes = '') {
        try {
            // Use RPC to bypass CORS PATCH restrictions (which use POST)
            const { error: rpcError } = await supabaseClient.rpc('update_request_status', {
                p_request_id: id,
                p_status: status,
                p_admin_notes: adminNotes
            });

            if (!rpcError) return { data: { id, status, admin_notes: adminNotes }, error: null };
            
            console.warn('RPC update_request_status failed, falling back to standard update...', rpcError);

            const data = { status, admin_notes: adminNotes };
            const { data: updated, error } = await supabaseClient
                .from('requests')
                .update(data)
                .eq('id', id)
                .select()
                .single();

            return { data: updated, error };

        } catch (error) {
            console.error('Update request status error:', error);
            return { data: null, error };
        }
    },

    /**
     * Fulfill request (updates inventory and request status)
     * @param {string} requestId 
     * @returns {Promise<{data, error}>}
     */
    async fulfillRequest(requestId) {
        try {
            const { data, error } = await supabaseClient
                .rpc('fulfill_request', { p_request_id: requestId });

            return { data, error };
        } catch (error) {
            console.error('Fulfill request error:', error);
            return { data: null, error };
        }
    },

    // ============================================
    // USER MANAGEMENT ENDPOINTS (ADMIN)
    // ============================================

    /**
     * Get all users
     * @returns {Promise<{data, error}>}
     */
    async getAllUsers() {
        try {
            const { data, error } = await supabaseClient
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });

            return { data, error };
        } catch (error) {
            console.error('Get all users error:', error);
            return { data: null, error };
        }
    },

    /**
     * Update user role
     * @param {string} userId 
     * @param {string} role - 'admin' or 'user'
     * @returns {Promise<{data, error}>}
     */
    async updateUserRole(userId, role) {
        try {
            const data = { role };
            
            // Attempt 1: Standard Update (PATCH)
            const { data: updated, error } = await supabaseClient
                .from('users')
                .update(data)
                .eq('id', userId)
            if (!error) return { data: updated, error: null };

            console.warn('Standard user profile update failed (PATCH), attempting Upsert (POST) fallback...', error);
            
            const upsertPayload = { ...data, id: userId };
            const { data: upsertData, error: upsertError } = await supabaseClient
                .from('users')
                .upsert(upsertPayload)
                .select()
                .single();
            
            return { data: upsertData, error: upsertError };
        } catch (error) {
            console.error('Update user profile error:', error);
            return { data: null, error };
        }
    },

    // ============================================
    // STORAGE ENDPOINTS (BUCKET: avatars)
    // ============================================

    /**
     * Upload an image to storage
     * @param {File} file 
     * @param {string} path - e.g. "userId/avatar.png"
     * @returns {Promise<{data, error}>}
     */
    async uploadImage(file, path) {
        try {
            const { data, error } = await supabaseClient.storage
                .from('avatars')
                .upload(path, file, {
                    cacheControl: '3600',
                    upsert: true
                });
            
            return { data, error };
        } catch (error) {
            console.error('Upload image error:', error);
            return { data: null, error };
        }
    },

    /**
     * Get public URL for a storage path
     * @param {string} path 
     * @returns {string}
     */
    getPublicUrl(path) {
        const { data } = supabaseClient.storage
            .from('avatars')
            .getPublicUrl(path);
        
        return data.publicUrl;
    },

    /**
     * Delete user
     * @param {string} userId 
     * @returns {Promise<{error}>}
     */
    async deleteUser(userId) {
        try {
            // Delete from public.users (triggers/RLS might handle auth.users deletion if configured)
            const { error } = await supabaseClient
                .from('users')
                .delete()
                .eq('id', userId);

            return { error };
        } catch (error) {
            console.error('Delete user error:', error);
            return { error };
        }
    },

    /**
     * Update user status (Approve/Reject)
     * @param {string} userId 
     * @param {string} status - 'approved', 'rejected', 'pending'
     * @returns {Promise<{error}>}
     */
    async updateUserStatus(userId, status) {
        try {
            const rpcFunction = status === 'approved' ? 'approve_user' : 'reject_user';
            
            // RPCs always use POST, which avoids CORS PATCH restrictions
            const { error: rpcError } = await supabaseClient.rpc(rpcFunction, {
                target_user_id: userId
            });

            if (!rpcError) return { error: null };
            
            console.warn(`RPC ${rpcFunction} failed, falling back to standard update...`, rpcError);

            // Fallback to standard update (may fail due to CORS, but worth a shot)
            const { error } = await supabaseClient
                .from('users')
                .update({ status: status })
                .eq('id', userId);

            return { error };
        } catch (error) {
            console.error('Update user status error:', error);
            return { error };
        }
    },

    /**
     * Create user as admin (bypasses email confirmation)
     * @param {object} userData - { email, password, full_name, role, department }
     * @returns {Promise<{data, error}>}
     */
    async createUserAsAdmin(userData) {
        try {
            const { email, password, full_name, role, department } = userData;
            
            // USE RAW FETCH to avoid session hijacking by the Supabase client
            // 'credentials: omit' is the key to preventing the browser from saving the new session
            const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({
                    email,
                    password,
                    data: {
                        full_name,
                        role
                    }
                }),
                credentials: 'omit' 
            });

            const authData = await response.json();
            if (!response.ok || authData.error) throw authData.error || new Error('Signup failed');

            // Create user profile
            const { data: profileData, error: profileError } = await supabaseClient
                .from('users')
                .insert([
                    {
                        id: authData.user.id,
                        full_name,
                        email,
                        role,
                        department: department || null,
                        status: 'approved'
                    }
                ])
                .select()
                .single();

            if (profileError) throw profileError;

            return { data: profileData, error: null };
        } catch (error) {
            console.error('Create user as admin error:', error);
            return { data: null, error };
        }
    },

    // ============================================
    // REPORTS ENDPOINTS
    // ============================================

    /**
     * Get inventory report
     * @param {string} startDate 
     * @param {string} endDate 
     * @returns {Promise<{data, error}>}
     */
    async getInventoryReport(startDate, endDate) {
        try {
            const { data: items, error: itemsError } = await this.getInventoryItems();
            const { data: movements, error: movementsError } = await this.getStockMovements({
                startDate,
                endDate
            });

            if (itemsError || movementsError) {
                throw itemsError || movementsError;
            }

            return {
                data: {
                    totalItems: items.length,
                    totalValue: items.reduce((sum, item) => sum + item.quantity, 0),
                    lowStockCount: items.filter(item => item.quantity <= item.min_stock_level).length,
                    movements: movements,
                    items: items
                },
                error: null
            };
        } catch (error) {
            console.error('Get inventory report error:', error);
            return { data: null, error };
        }
    },

    /**
     * Get stock movement report
     * @param {string} startDate 
     * @param {string} endDate 
     * @returns {Promise<{data, error}>}
     */
    async getStockMovementReport(startDate, endDate) {
        try {
            const { data, error } = await this.getStockMovements({ startDate, endDate });

            if (error) throw error;

            const summary = {
                totalMovements: data.length,
                inMovements: data.filter(m => m.movement_type === 'in').length,
                outMovements: data.filter(m => m.movement_type === 'out').length,
                adjustments: data.filter(m => m.movement_type === 'adjustment').length,
                movements: data
            };

            return { data: summary, error: null };
        } catch (error) {
            console.error('Get stock movement report error:', error);
            return { data: null, error };
        }
    },

    /**
     * Get request report
     * @param {string} startDate 
     * @param {string} endDate 
     * @returns {Promise<{data, error}>}
     */
    async getRequestReport(startDate, endDate) {
        try {
            let query = supabaseClient
                .from('requests')
                .select(`
                    *,
                    inventory_items (item_name, category),
                    users (full_name, email)
                `);

            if (startDate) query = query.gte('created_at', startDate);
            if (endDate) query = query.lte('created_at', endDate);

            const { data, error } = await query;

            if (error) throw error;

            const summary = {
                totalRequests: data.length,
                pending: data.filter(r => r.status === 'pending').length,
                approved: data.filter(r => r.status === 'approved').length,
                rejected: data.filter(r => r.status === 'rejected').length,
                fulfilled: data.filter(r => r.status === 'fulfilled').length,
                requests: data
            };

            return { data: summary, error: null };
        } catch (error) {
            console.error('Get request report error:', error);
            return { data: null, error };
        }
    },

    // ============================================
    // REAL-TIME SUBSCRIPTIONS
    // ============================================

    /**
     * Subscribe to inventory changes
     * @param {function} callback 
     * @returns {object} subscription
     */
    subscribeToInventory(callback) {
        return supabaseClient
            .channel('inventory-changes')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'inventory_items' },
                callback
            )
            .subscribe();
    },

    /**
     * Subscribe to request changes
     * @param {function} callback 
     * @returns {object} subscription
     */
    subscribeToRequests(callback) {
        return supabaseClient
            .channel('request-changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'requests' },
                callback
            )
            .subscribe();
    }
};

// Export API
window.supabaseApi = supabaseApi;
