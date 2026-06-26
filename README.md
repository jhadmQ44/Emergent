# 💊 Pharmacy Medicine Search System

Professional pharmacy medicine search and inventory tracking system with:
- 🔍 **Fast Arabic + English search** with live suggestions (PostgreSQL trigram + GIN indexes)
- 📤 **Excel/CSV upload** — admin-only with automatic Arabic column detection
- 👥 **Role-based access** — Admin (upload + manage) and Staff (search only)
- 🔐 **Supabase Authentication** — email/password login
- 📜 **Full purchase history** — every upload kept, search uses the latest file
- 🎨 **Arabic RTL UI** built with Next.js 15 + Tailwind + shadcn/ui

---

## 🚀 Quick Start (Local Development)

```bash
yarn install
cp .env.example .env       # then edit .env with your Supabase keys
yarn dev                   # http://localhost:3000
```

## 📦 Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full step-by-step Hostinger VPS guide.

Quick version:
```bash
yarn install
yarn build
yarn start                 # or: pm2 start "yarn start" --name pharmacy
```

## ⚙️ First-time Setup (Once Only)

### 1. Create Supabase Project
- Go to https://supabase.com → New project
- Copy the URL and the two API keys to `.env`

### 2. Initialize Database Schema
- Open Supabase SQL Editor: `https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new`
- Paste the contents of [`supabase_schema.sql`](./supabase_schema.sql) and click **Run**

### 3. Disable Email Confirmation (recommended for internal app)
- Dashboard → Authentication → Providers → Email
- Turn OFF "Confirm email" → Save

### 4. Create Your First Admin User
Run this from your local machine (replace values):

```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/auth/v1/admin/users" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pharmacy.com","password":"strongPassword","email_confirm":true,"user_metadata":{"full_name":"Admin Name"}}'
```

Then insert their profile (use the `id` returned above):

```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/rest/v1/profiles" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id":"USER_ID_FROM_ABOVE","email":"admin@pharmacy.com","full_name":"Admin Name","role":"admin"}'
```

After that, you can create more staff/admin users from the **Users** tab in the app.

---

## 📊 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 18, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes (Node.js runtime) |
| Auth & DB | Supabase (PostgreSQL + Auth) |
| Search | PostgreSQL `pg_trgm` GIN indexes for partial/fuzzy match |
| Parsing | `xlsx` (SheetJS) for Excel/CSV import |

## 📁 Project Structure

```
app/
  api/[[...path]]/route.js   — All backend endpoints (auth-protected)
  page.js                    — Main UI (login, search, admin, users)
  layout.js                  — RTL Arabic layout
  providers.js               — Toaster provider
lib/
  supabase.js                — Server-side Supabase clients
  supabaseBrowser.js         — Browser Supabase client (session storage)
  parseSheet.js              — Excel/CSV header mapping + row parsing
supabase_schema.sql          — Run this once in Supabase SQL Editor
.env.example                 — Environment template
```

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase publishable (anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase secret key (server-side only) |
| `NEXT_PUBLIC_BASE_URL` | ✅ | Your public URL (e.g. https://pharmacy.example.com) |
| `CORS_ORIGINS` | ❌ | Default `*` |

## 🔒 Security Notes

- The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — keep it **server-side only**
- Never commit `.env` to git (already in `.gitignore`)
- Change the default admin password immediately after first login
- Recommended: rotate Supabase keys periodically

## 📦 Update Workflow After Deployment

```bash
cd /var/www/pharmacy
git pull
yarn install
yarn build
pm2 restart pharmacy
```

---

Built with ❤️ for pharmacy staff.
