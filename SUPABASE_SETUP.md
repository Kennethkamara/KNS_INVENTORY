# Supabase Setup Guide for KNS Inventory System

## Prerequisites

- A Supabase account (sign up at https://app.supabase.com)
- Your project ID: `znuytfzrlgaptxppzjtv`

## Step 1: Get Your Supabase Anon Key

1. Go to https://app.supabase.com
2. Select your project (ID: znuytfzrlgaptxppzjtv)
3. Click the **Settings** icon (⚙️) in the left sidebar
4. Navigate to **API** section
5. Copy the **anon public** key (starts with `eyJ...`)

## Step 2: Configure Your Application

1. Open `supabase-config.js` in your project
2. Replace `YOUR_ANON_KEY_HERE` with your actual anon key:

```javascript
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp..."; // Your actual key
```

## Step 3: Set Up Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `schema.sql` file
4. Paste it into the SQL editor
5. Click **Run** to execute the script

This will create:

- ✅ 4 tables (users, inventory_items, stock_movements, requests)
- ✅ Indexes for performance
- ✅ Row Level Security (RLS) policies
- ✅ Helper functions (get_low_stock_items, fulfill_request)

## Step 4: Enable Email Authentication

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Ensure **Email** provider is enabled
3. Configure email templates (optional):
   - Go to **Authentication** → **Email Templates**
   - Customize confirmation and password reset emails

## Step 5: Test Your Setup

1. Open `signup.html` in your browser
2. Create a test account
3. Check your Supabase dashboard:
   - Go to **Authentication** → **Users** to see the new user
   - Go to **Table Editor** → **users** to see the profile

## Step 6: Create Admin User

To create an admin user, use an email containing "admin":

- Example: `admin@kns.com` or `john.admin@company.com`

The system automatically assigns admin role to emails containing "admin".

## Troubleshooting

### Issue: "Supabase not configured" warning

**Solution**: Make sure you've added your anon key to `supabase-config.js`

### Issue: Database errors when signing up

**Solution**: Ensure you've run the `schema.sql` script in Supabase SQL Editor

### Issue: RLS policy errors

**Solution**: The schema.sql includes all necessary RLS policies. Re-run the script if needed.

### Issue: Can't see data in tables

**Solution**: Check that RLS is enabled and policies are correctly set up

## API Endpoints Available

All endpoints are available through the `supabaseApi` object:

### Authentication

- `supabaseApi.signUp(email, password, fullName, role)`
- `supabaseApi.signIn(email, password)`
- `supabaseApi.signOut()`
- `supabaseApi.getCurrentUser()`

### Inventory Management

- `supabaseApi.getInventoryItems(filters)`
- `supabaseApi.createInventoryItem(data)`
- `supabaseApi.updateInventoryItem(id, data)`
- `supabaseApi.deleteInventoryItem(id)`
- `supabaseApi.getLowStockItems()`

### Stock Movements

- `supabaseApi.getStockMovements(filters)`
- `supabaseApi.createStockMovement(data)`

### Requests

- `supabaseApi.getRequests(filters)`
- `supabaseApi.createRequest(data)`
- `supabaseApi.updateRequestStatus(id, status, adminNotes)`
- `supabaseApi.fulfillRequest(id)`

### User Management (Admin Only)

- `supabaseApi.getAllUsers()`
- `supabaseApi.updateUserRole(userId, role)`
- `supabaseApi.deleteUser(userId)`

### Reports

- `supabaseApi.getInventoryReport(startDate, endDate)`
- `supabaseApi.getStockMovementReport(startDate, endDate)`
- `supabaseApi.getRequestReport(startDate, endDate)`

## Real-time Features

Subscribe to real-time updates:

```javascript
// Subscribe to inventory changes
const inventorySub = supabaseApi.subscribeToInventory((payload) => {
  console.log("Inventory changed:", payload);
  // Refresh your inventory list
});

// Subscribe to request changes
const requestSub = supabaseApi.subscribeToRequests((payload) => {
  console.log("Request changed:", payload);
  // Refresh your requests list
});
```

## Security Notes

- ✅ Row Level Security (RLS) is enabled on all tables
- ✅ Users can only see their own data (except admins)
- ✅ Only admins can modify inventory and approve requests
- ✅ The anon key is safe to use in client-side code
- ⚠️ Never expose your service_role key in client-side code

## Next Steps

After setup is complete:

1. Create admin and user test accounts
2. Add some inventory items (admin only)
3. Submit requests as a user
4. Approve/fulfill requests as admin
5. View reports and stock movements

## Support

If you encounter issues:

1. Check browser console for errors
2. Verify Supabase configuration
3. Check RLS policies in Supabase dashboard
4. Review the implementation_plan.md for architecture details
