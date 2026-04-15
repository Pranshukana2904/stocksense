# StockSense — Product Requirements Document

## Original Problem Statement
Build StockSense, a complete full-stack Inventory Management System web application with:
- AI-powered low stock alerts and sales prediction (linear regression / exponential smoothing)
- Real-time inventory tracking and data visualization (Recharts)
- Roles: ADMIN, MANAGER, STAFF
- Dashboards with KPIs, inventory tables with filters, prediction engine based on historical data
- AI insights using GPT-4o (via Emergent Universal Key)
- Automated scheduled jobs (cron) for stock checks and prediction cache updates
- Email alerting for low stock via Gmail SMTP
- Cloudinary image upload for product images
- Originally requested Node.js/PostgreSQL — overridden by platform mandates to FastAPI/MongoDB

## Tech Stack
- **Backend**: FastAPI (Python) + MongoDB (Motor async driver)
- **Frontend**: React + Tailwind CSS + Zustand + Recharts
- **Auth**: JWT (access + refresh tokens) + Google OAuth 2.0
- **AI**: OpenAI GPT-4o via Emergent Universal Key
- **Scheduling**: APScheduler (Python) — pending
- **Email**: Gmail SMTP / smtplib — pending
- **Images**: Cloudinary — pending

## Architecture
```
/app/
├── backend/
│   ├── server.py              # Main FastAPI app — routes, models, prediction engine, auth
│   ├── seed.py                # DB seeding script
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── api/               # axios.js, api.js
│   │   ├── components/        # Layout.js, Sidebar.js, ProtectedRoute.js
│   │   ├── pages/             # Dashboard, Inventory, Alerts, Predictions, Sales, Suppliers, Categories, Settings, Login, Register
│   │   ├── store/             # authStore.js, alertStore.js
│   │   └── utils/             # formatters.js
│   ├── package.json
│   ├── tailwind.config.js
│   └── .env
└── memory/
    ├── PRD.md
    └── test_credentials.md
```

## Key DB Schema
- `users`: {_id (UUID), name, email, password, role, picture, auth_provider}
- `categories`: {name, description}
- `suppliers`: {name, email, phone, address}
- `products`: {name, sku, current_stock, reorder_level, category_id, supplier_id, cost_price, selling_price}
- `salerecords`: {product_id, quantity_sold, sale_date, total_amount}
- `stockmovements`: {product_id, type, quantity}
- `alerts`: {product_id, type, message, is_read, is_resolved}
- `predictioncache`: {product_id, predicted_demand, forecast_array, ...}

## Key API Endpoints
- `POST /api/auth/login` — email/password login
- `POST /api/auth/register` — user registration
- `POST /api/auth/google` — Google OAuth login
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET/POST /api/products`
- `GET/PUT /api/products/:id`
- `POST /api/products/:id/stock`
- `GET/POST /api/sales`
- `GET /api/sales/summary`
- `GET /api/alerts`
- `GET /api/predictions`
- `GET /api/predictions/insights` — GPT-4o AI insights
- `GET/POST /api/categories`
- `GET/POST /api/suppliers`

---

## What's Been Implemented

### Session 1 (Initial MVP)
- Full FastAPI backend with all routes (auth, products, sales, alerts, predictions, categories, suppliers)
- MongoDB seeded with: 5 categories, 3 suppliers, 20 products, 1650 sales records, 4 alerts
- React frontend with all pages (Dashboard, Inventory, Alerts, Predictions, Sales, Suppliers, Categories, Settings)
- JWT auth (access + refresh tokens with httpOnly cookies)
- Recharts dashboards (KPIs, revenue trend, sales forecast, stock levels)
- Prediction engine (linear regression + exponential smoothing in Python)
- GPT-4o AI insights via Emergent Universal Key
- Fixed Predicted Revenue KPI field name mismatch bug

### Session 2 (Google OAuth)
- Integrated Google OAuth 2.0 with user's own Client ID/Secret
- Backend: `POST /api/auth/google` endpoint using `google-auth` library for ID token verification
- Frontend: `@react-oauth/google` library, `GoogleOAuthProvider` wrapper in App.js
- "Sign in with Google" button on Login page
- Find-or-create user logic: existing users linked by email, new users get STAFF role

---

## Prioritized Backlog

### P0 — Critical
- [ ] APScheduler background jobs:
  - `stockAlertJob` — daily 8 AM, scans inventory, creates low-stock alerts
  - `predictionRefreshJob` — daily midnight, refreshes prediction cache
- [ ] Email alerting for low stock (Gmail SMTP / smtplib)

### P1 — Important
- [ ] Cloudinary image upload for product images (needs user's API credentials)
- [ ] Comprehensive backend input validation and error handling

### P2 — Future
- [ ] Admin user management in Settings (deactivation, role changes)
- [ ] README.md with local setup instructions
