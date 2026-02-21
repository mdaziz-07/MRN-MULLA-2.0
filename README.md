# 🛒 MRN MULLA KIRANA - Hyperlocal Grocery Delivery

A complete grocery delivery ecosystem for small neighborhood kirana stores in India. Built with React, Tailwind CSS v4, and Supabase.

## ✨ Features

### Customer App (`/`)
- 🏪 Premium storefront with dynamic sticky header
- 🔍 Real-time search across all products
- 📂 Horizontal scrollable category filters
- 🛍️ 3-column product grid (responsive to 6 on desktop)
- 📱 Product detail modal with image slider
- 🛒 Shopping cart with quantity controls
- 📍 GPS location detection with distance calculation
- 💳 Checkout with COD and Online payment options
- 📦 Live order tracking with animated status timeline
- 💬 WhatsApp integration for enquiries

### Admin Panel (`/admin`)
- 🔐 PIN-based authentication
- 📊 Dashboard with 4 tabs (Orders, Products, AI, Reports)
- 🔔 Real-time order alerts with sound & vibration
- 📦 Order management (accept, dispatch, deliver)
- 🏷️ Product CRUD with image upload (ImgBB)
- 📂 Category management with sidebar navigation
- 🎙️ Voice assistant for hands-free inventory management
- 📈 Analytics & reports with revenue tracking

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` with your keys:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_IMGBB_API_KEY=your-imgbb-key
VITE_RAZORPAY_KEY_ID=your-razorpay-key
```

### 3. Setup Supabase Database
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Open the SQL Editor
3. Copy and paste the contents of `supabase-schema.sql`
4. Run the SQL to create all tables
5. Enable Realtime in Dashboard → Database → Replication

### 4. Run Development Server
```bash
npm run dev
```

Visit:
- Customer App: http://localhost:5173/
- Admin Panel: http://localhost:5173/admin (PIN: 1234)

### 5. Build for Production
```bash
npm run build
```

## 📁 Project Structure

```
src/
├── App.jsx                 # Main app with routing
├── main.jsx                # React entry point
├── index.css               # Design system & Tailwind
├── components/
│   └── ProductModal.jsx    # Product detail modal
├── context/
│   └── CartContext.jsx     # Cart state management
├── data/
│   └── products.js         # 106 products across 10 categories
├── lib/
│   └── supabase.js         # Supabase client & constants
└── pages/
    ├── Home.jsx            # Customer storefront
    ├── Checkout.jsx        # Cart & checkout flow
    ├── TrackOrder.jsx      # Order tracking
    └── admin/
        ├── AdminApp.jsx    # Auth guard
        ├── AdminLogin.jsx  # PIN login screen
        ├── AdminDashboard.jsx # Dashboard container
        └── tabs/
            ├── OrdersTab.jsx   # Order management
            ├── ProductsTab.jsx # Product CRUD
            ├── AITab.jsx       # Voice assistant
            └── ReportsTab.jsx  # Analytics
```

## 🎨 Design System

| Token | Value | Usage |
|-------|-------|-------|
| Primary Dark | `#023430` | Headers, CTAs, main brand |
| Primary Medium | `#046759` | Hover states |
| Primary Light | `#E8F5F3` | Backgrounds, badges |
| Accent Green | `#00C853` | Success, active states |
| Status Blue | `#2196F3` | Out for delivery |
| Status Amber | `#FFC107` | Pending, received |
| Status Red | `#F44336` | Cancelled, errors |

## 🔧 Tech Stack

- **Frontend**: React 18 + Vite 6
- **Styling**: Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL + Realtime)
- **Maps**: Leaflet (ready for integration)
- **Icons**: Lucide React
- **Payments**: Razorpay (configurable)
- **Notifications**: Sonner toast
- **Hosting**: Vercel / Netlify

## 📱 PWA Support

The app includes a `manifest.json` for installable PWA support. Add your app icons (`icon-192.png` and `icon-512.png`) to the `public/` folder.

## 🔑 Admin Access

- Default PIN: `1234`
- Change it in `src/pages/admin/AdminLogin.jsx`

## 📞 Store Configuration

Edit `src/lib/supabase.js` to update:
- Store name
- Store phone number
- Store location (lat/lng)
- Delivery radius

## 🚀 Deployment

### Vercel
```bash
npm run build
# Deploy the dist/ folder to Vercel
```

### Netlify
```bash
npm run build
# Deploy the dist/ folder to Netlify
```

---

Built with ❤️ for MRN Mulla Kirana, Chittapur, Karnataka
