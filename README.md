# DENISE Textile — Reservation Platform

**New Textile Social Company Limited (DENISE)**  
Multilingual textile reservation and product showcase platform for Kigali, Rwanda.

> Customers browse online → reserve → visit the Kigali shop to inspect and pay. No online payments.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS v3 |
| UI Components | ShadCN UI (Radix UI) + Framer Motion |
| State | Zustand (persisted) + React Query v5 |
| i18n | i18next (EN, RW, FR, SW, LN) |
| Backend | Node.js + Express.js + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT access (15 min) + Refresh tokens (7 days) + RBAC |
| Storage | Cloudinary (images) |
| Notifications | Nodemailer (email) + Twilio (SMS + WhatsApp) |
| QR Codes | `qrcode` library |
| Analytics | Recharts (admin dashboard) |

---

## Project Structure

```
denise-textile/
├── frontend/          # React + Vite app
├── backend/           # Express + Prisma API
├── database/          # Raw SQL schema (schema.sql)
├── render.yaml        # Render deployment config
└── .gitignore
```

---

## Local Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- A Cloudinary account (free tier works)
- Optional: Twilio account (for SMS/WhatsApp)

### 1. Clone and install

```bash
git clone <your-repo>
cd denise-textile

# Install backend deps
cd backend && npm install

# Install frontend deps
cd ../frontend && npm install
```

### 2. Configure backend environment

```bash
cd backend
cp .env.example .env
```

Edit `.env`:

```env
NODE_ENV=development
PORT=5000
DATABASE_URL="postgresql://user:password@localhost:5432/denise_textile"
FRONTEND_URL=http://localhost:5173

# Generate strong secrets: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your-64-char-secret
JWT_REFRESH_SECRET=your-other-64-char-secret

CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="DENISE Textile <noreply@denise-textile.rw>"

# Optional — SMS/WhatsApp
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

ADMIN_EMAIL=admin@denise-textile.rw
ADMIN_PASSWORD=Admin@123456
```

### 3. Set up the database

```bash
cd backend

# Run Prisma migrations
npx prisma migrate dev --name init

# Seed with sample data + admin user
npm run db:seed
```

The seed creates:
- **Admin user**: phone `+250780000001`, password from `ADMIN_PASSWORD` env
- 6 product categories
- 3 sample products (curtains + traditional fabric)
- 3 testimonials
- 4 FAQs

### 4. Configure frontend environment

```bash
cd frontend
cp .env.example .env
```

Edit `.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=DENISE Textile
VITE_GOOGLE_MAPS_API_KEY=optional
VITE_GA_TRACKING_ID=optional
```

### 5. Run dev servers

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

App runs at `http://localhost:5173`  
API runs at `http://localhost:5000`

---

## Admin Panel

Access the admin panel at `/admin` after logging in with an admin account.

**Dashboard** → Stats, charts, low-stock alerts  
**Reservations** → Manage statuses, send notifications  
**Products** → Add/edit/delete products + images  
**Inventory** → Stock levels and low-stock thresholds  
**Customers** → Enable/disable accounts  
**Content** → Edit site text without code changes  

---

## Deployment

### Frontend — Vercel (Recommended)

1. Push `frontend/` to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Set **Root Directory** to `frontend`
4. Set **Build Command**: `npm run build`
5. Set **Output Directory**: `dist`
6. Add environment variables:
   ```
   VITE_API_URL=https://your-backend.railway.app/api
   VITE_APP_NAME=DENISE Textile
   VITE_GA_TRACKING_ID=G-XXXXXXXXXX  (optional)
   ```
7. Deploy — the `vercel.json` handles SPA routing and cache headers automatically.

### Backend — Railway (Recommended)

1. Push `backend/` to GitHub (or use monorepo)
2. Create new project in [Railway](https://railway.app)
3. Add a **PostgreSQL** plugin — Railway auto-sets `DATABASE_URL`
4. Set **Root Directory** to `backend`
5. Add environment variables (all from `.env.example`, except `DATABASE_URL`)
6. Railway uses `railway.json` config — start command runs migrations then starts the server.
7. Note the Railway URL and set as `VITE_API_URL` in your Vercel project.

### Backend — Render (Alternative)

Use the `render.yaml` at the repo root for one-click Render deployment:

1. Connect your GitHub repo to [Render](https://render.com)
2. Create **New Blueprint** and point to `render.yaml`
3. Fill in the `sync: false` env vars (Cloudinary, SMTP, Twilio, admin credentials)
4. Render will provision a PostgreSQL database and web service automatically

### Post-Deployment Checklist

- [ ] Verify `/api/health` returns `{ status: "ok" }`
- [ ] Test registration and login flow
- [ ] Create a test reservation and verify email notification
- [ ] Upload a product image and verify Cloudinary URL
- [ ] Test reservation tracking by reference number
- [ ] Set `FRONTEND_URL` in backend to exact Vercel domain (for CORS)
- [ ] Update `frontend/public/robots.txt` with your actual domain
- [ ] Update `frontend/index.html` Schema.org `url` with actual domain
- [ ] Add production domain to Cloudinary allowed origins

---

## API Reference

Base URL: `https://your-api.railway.app/api`

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Register new customer |
| POST | `/auth/login` | — | Login (returns access + refresh tokens) |
| POST | `/auth/refresh` | — | Get new access token |
| POST | `/auth/logout` | Bearer | Invalidate refresh token |
| GET | `/auth/me` | Bearer | Get current user |
| PUT | `/auth/profile` | Bearer | Update profile |
| PUT | `/auth/change-password` | Bearer | Change password |

### Products
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/products` | — | List with filter/sort/pagination |
| GET | `/products/featured` | — | Featured products |
| GET | `/products/new-arrivals` | — | New arrivals |
| GET | `/products/:slug` | — | Product detail |
| POST | `/products` | Admin | Create product |
| PUT | `/products/:id` | Admin | Update product |
| DELETE | `/products/:id` | Admin | Delete product |

### Reservations
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/reservations` | Optional | Create reservation |
| GET | `/reservations/track/:number` | — | Track by reference number |
| GET | `/reservations/my` | Bearer | My reservations |
| GET | `/reservations/stats` | Admin | Reservation statistics |
| GET | `/reservations` | Admin | All reservations |
| PUT | `/reservations/:id/status` | Admin | Update status |
| PUT | `/reservations/:id/cancel` | Optional | Cancel reservation |

### Admin
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/admin/dashboard` | Admin | Dashboard stats |
| GET | `/admin/customers` | Admin | Customer list |
| POST | `/admin/customers/:id/toggle` | Admin | Enable/disable customer |
| GET | `/admin/content` | Admin | Site content |
| PUT | `/admin/content` | Admin | Update site content |
| GET | `/admin/inventory` | Admin | Inventory list |
| PUT | `/admin/inventory/:id` | Admin | Update inventory |
| GET | `/admin/banners` | Admin | Banner list |
| POST | `/admin/banners` | Admin | Create banner |

---

## Reservation Statuses

| Status | Meaning |
|---|---|
| `PENDING` | Just submitted, awaiting confirmation |
| `CONFIRMED` | Confirmed by staff |
| `PREPARING` | Products being prepared for customer visit |
| `READY_FOR_PICKUP` | Ready — customer can come |
| `COMPLETED` | Customer visited, transaction done |
| `CANCELLED` | Cancelled by customer or staff |

---

## Measurement Options

| Option | Description |
|---|---|
| `KNOW_MEASUREMENTS` | Customer provides width/height/meters |
| `HELP_AT_SHOP` | Staff helps measure during visit |
| `WALK_IN_CONSULTATION` | No products selected, full consultation |

---

## Supported Languages

| Code | Language | Flag |
|---|---|---|
| `en` | English | 🇬🇧 |
| `rw` | Kinyarwanda | 🇷🇼 |
| `fr` | French | 🇫🇷 |
| `sw` | Kiswahili | 🇰🇪 |
| `ln` | Lingala | 🇨🇩 |

---

## Brand Colors

| Name | Hex | Usage |
|---|---|---|
| Crimson | `#8B1A1A` | Primary / CTA buttons |
| Gold | `#C8972A` | Accents, highlights |
| Green | `#006B3C` | Success, availability |
| Blue | `#0057A8` | Links, info |
| Cream | `#FFF8F0` | Light backgrounds |

---

## Production Best Practices

### Security
- Rotate `JWT_SECRET` and `JWT_REFRESH_SECRET` — use at least 64 random bytes each
- Enable rate limiting (already configured: 100 req/15min general, 10 auth, 20 reservations/hr)
- Set `FRONTEND_URL` exactly — used for CORS whitelist
- All uploaded files go to Cloudinary — no local file storage in production
- Passwords hashed with bcrypt (12 rounds)
- Helmet sets secure HTTP headers by default

### Performance
- React Query caches data for 5 minutes (staleTime)
- Images served from Cloudinary CDN with automatic optimization
- Vite produces code-split chunks: vendor / ui / charts / i18n
- Vercel serves `dist/` from global CDN with immutable cache on hashed assets

### Monitoring
- Winston logger writes to `logs/error.log` and `logs/combined.log`
- `/api/health` endpoint for uptime monitoring (Railway/Render health checks use this)
- Activity logs table records all admin actions

### Database
- Run `npx prisma migrate deploy` (not `migrate dev`) in production
- Enable PostgreSQL connection pooling on Railway/Render for production load
- The GIN trigram index on `products.name` enables fast fuzzy search

### Backup
- Enable automated daily backups in Railway/Render (available on paid plans)
- Cloudinary images are stored in the cloud — back up `public_id` references from the database

---

## Useful Commands

```bash
# Backend
npm run dev          # Dev server with hot reload (ts-node-dev)
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled dist/index.js
npm run db:seed      # Seed database with sample data

# Database
npx prisma migrate dev --name <name>   # Create and run migration
npx prisma migrate deploy              # Apply migrations (production)
npx prisma studio                      # Visual database browser
npx prisma db push                     # Push schema without migration (dev only)

# Frontend
npm run dev          # Vite dev server
npm run build        # Production build
npm run preview      # Preview production build locally
```

---

## Support

**New Textile Social Company Limited (DENISE)**  
Kigali, Rwanda  
WhatsApp: +250 780 000 000
