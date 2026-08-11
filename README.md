# 🧸 Kids Area Staff QR Scanner

Mobile-first Next.js 14 (App Router) app for nursery staff to scan QR codes,
enforce entry rules, take payment, and log check-in/check-out. Free-tier
deployable on Vercel + Supabase.

## 1. Supabase setup

1. Create a free project at https://supabase.com.
2. Open **SQL Editor** → paste the contents of `supabase/schema.sql` → Run.
3. Go to **Project Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ never expose this in client code — it's only read inside Server Actions in this project)
4. Add real children in the `children_profiles` table (via Table Editor, or your own admin form later). The `id` (UUID) of each row is what you encode into the parent's QR code — e.g. with any free QR generator, encode the raw UUID string.

## 2. Local setup

```bash
npm install
cp .env.local.example .env.local
# edit .env.local with your real values
npm run dev
```

Visit http://localhost:3000 — you'll be redirected to `/login`.

### Environment variables

| Variable | Where used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | server | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Bypasses RLS; never prefix with `NEXT_PUBLIC_` |
| `STAFF_PIN` | server only | Shared PIN staff use to log in |

## 3. Deploy to Vercel (free)

1. Push this project to a GitHub repo.
2. Go to https://vercel.com/new and import the repo.
3. In **Environment Variables**, add the same 3 variables from `.env.local`.
4. Deploy. Vercel auto-detects Next.js — no build config needed.
5. Open the deployed URL on a staff phone, "Add to Home Screen" for an app-like icon.

## 4. Camera / HTTPS note

`html5-qrcode` requires the page to be served over **HTTPS** (or `localhost`)
for camera access — Vercel deployments are HTTPS by default, so this works
out of the box in production. On `localhost` during dev it also works fine.

## 5. How QR codes should be generated

Each child/parent's QR code should simply encode the child's `id` (UUID) from
`children_profiles`. You can generate these in bulk with any QR library
(e.g. `qrcode` npm package) from a CSV export, or manually via a free
QR generator website when onboarding a new family.

## 6. Project structure

```
app/
  login/                  PIN login page + server action
  dashboard/
    actions.ts            fetchAndValidateChild, confirmCheckIn, getActiveSessions, confirmCheckOut
    components/
      Scanner.tsx          camera QR scanner (html5-qrcode)
      CheckInDashboard.tsx  scan → validate → pay → check-in flow
  active-sessions/
    components/ActiveSessionsList.tsx  check-out UI
  components/NavBar.tsx    bottom tab nav
lib/
  supabase.ts             server-only Supabase client (service role)
  auth.ts                 staff session cookie helpers
  types.ts                shared TS types + pricing table
middleware.ts             guards /dashboard and /active-sessions behind login
supabase/schema.sql       DB schema
```

## 8. Cafeteria orders + Google Sheets daily log (new features)

**1. Run the cafeteria migration**
In Supabase SQL Editor, run `supabase/migration_cafeteria.sql` (after `schema.sql`).

**2. Active Sessions is now card-based**
Each checked-in child is a card with 7 tap buttons (Crackers, Candy, Juice,
Soft Drink, Chocolate, Water, Socks). Tapping one logs a pending cafeteria
order. Cards with any pending order get a red border + 🔴 alert and can't
check out until staff taps **Settle Cafeteria Payment**, which marks all
pending items for that child as paid.

Prices live in `lib/types.ts` → `CAFETERIA_PRICES` — edit that object to
match your real menu prices.

**3. Google Sheets setup (optional but recommended)**

This logs every check-in, check-out, cafeteria order, and cafeteria payment
to a Google Sheet, with a new tab created automatically per calendar day.

1. Go to https://console.cloud.google.com → create/select a project.
2. Enable the **Google Sheets API** (APIs & Services → Library).
3. Create a **Service Account** (APIs & Services → Credentials → Create
   Credentials → Service Account). No roles needed.
4. Open the service account → **Keys** tab → **Add Key → Create new key →
   JSON**. Download it.
5. From that JSON file, copy:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY` (keep the `\n` characters exactly
     as they appear in the JSON — paste the whole string in quotes)
6. Create a new Google Sheet (sheets.new). Copy its ID from the URL:
   `https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit`
   → `GOOGLE_SHEETS_SPREADSHEET_ID`
7. **Share the Sheet** with the service account's email (the `client_email`
   value) as an **Editor** — this step is required, the service account
   can't see the sheet otherwise.
8. Add all three env vars to `.env.local` (local) and Vercel (production),
   then redeploy.

If these env vars are missing, the app still works normally — it just
skips the Sheets logging step silently (check your terminal/Vercel logs for
a warning if you expect logging but don't see rows appearing).

