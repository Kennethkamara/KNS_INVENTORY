# KNS Inventory System

A modern inventory management system with role-based access control, powered by Supabase.

## 🚀 Quick Start

### 1. Configure Supabase

1. Open `supabase-config.js`
2. Add your Supabase anon key:
   ```javascript
   const SUPABASE_ANON_KEY = "your-anon-key-here";
   ```

### 2. Set Up Database

1. Go to your Supabase SQL Editor
2. Run the `schema.sql` file

### 3. Open the Application

Open `index.html` in your browser and get started!

## 📚 Documentation

- **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)** - Complete setup guide
- **[implementation_plan.md](.gemini/antigravity/brain/.../implementation_plan.md)** - Technical architecture

## 🔑 Features

- ✅ User authentication with Supabase Auth
- ✅ Role-based access control (Admin/User)
- ✅ Inventory management
- ✅ Stock movement tracking
- ✅ Request/approval workflow
- ✅ Real-time updates
- ✅ Reports and analytics

## 👥 User Roles

### Admin

- Manage inventory items
- Approve/reject user requests
- View all stock movements
- Manage users
- Generate reports

### User

- View inventory
- Submit item requests
- Track request status
- View personal inventory

## 🔐 Creating Admin Account

Use an email containing "admin" when signing up:

- `admin@kns.com`
- `john.admin@company.com`

## 📁 Project Structure

```
INVENTORY/
├── index.html              # Landing page
├── signin.html             # Login page
├── signup.html             # Registration page
├── auth.js                 # Authentication logic
├── supabase-config.js      # Supabase configuration
├── schema.sql              # Database schema
├── api/
├── api-service.js          # API service layer
├── admin/                  # Admin dashboard
│   ├── index.html
│   ├── inventory.html
│   ├── users.html
│   └── ...
└── user/                   # User dashboard
    ├── index.html
    ├── submit-request.html
    └── ...
```

## 🛠️ Technology Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime

## 📞 Support

For issues or questions, refer to `SUPABASE_SETUP.md` troubleshooting section.
