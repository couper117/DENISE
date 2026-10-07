# DENISE Textile — deniseshop.com

Online shop for New Textile Social Company Ltd (DENISE), a textile shop in
Kigali, Rwanda: curtains made to measure (night curtain "rideau de nuit" and
day curtain "rideau du jour"), curtain rods, fabrics by the metre and Rwandan
traditional attire. Customers order online, pay with MTN MoMo (Paypack),
bank transfer or in store, and get delivery across Rwanda or collect.

**Read `HANDOFF.md` before changing anything** — it has the live hosting
setup, the curtain-set rules, checkout invariants, the theme rules and what
is still open. `REDESIGN.md` has the redesign plan and phase status.

## Stack
- `frontend/` — React 18 + TypeScript + Vite + Tailwind, i18next (en, fr, rw,
  sw, ln), Zustand cart, React Query, visual CMS (`src/cms`).
- `backend/` — Express + Prisma + PostgreSQL. `src/app.ts` is the app,
  `src/index.ts` the local server, `api/index.js` the Vercel entry.

## Live
- Storefront: Vercel project `denise` → https://www.deniseshop.com
- API: Vercel project `denise-api` → https://denise-api.vercel.app (Mumbai)
- Database: Aiven Postgres free plan (Bengaluru, 20 connections max)
- Every push to `main` deploys both. The API build runs Prisma migrations.

## Local development
- Backend: `cd backend && npm run dev` (port 5000; needs `backend/.env` with
  DATABASE_URL and JWT secrets — see `backend/.env.example`).
- Frontend: `cd frontend && npm run dev` (Vite proxies `/api` to :5000).
- Checks: `cd frontend && npx tsc --noEmit -p . && npm run build`;
  `cd backend && npx tsc --noEmit -p .`.

## How the owner wants work done
- A change is finished only when it is verified and **live on
  deniseshop.com** (pushed to `main`, deployment checked).
- **Every visible string in all five languages** (en, fr, rw, sw, ln) — use
  `t('key', { defaultValue })` / `EditableText` and add the key to every
  `frontend/src/i18n/locales/*.json`.
- **Professional and mobile-first**: check phone layouts (~390 px) as well as
  desktop, light and dark mode.
- Footer credit stays "Made by Malhottech Company Ltd", linking to
  https://malhot.vercel.app.

## Rules that are easy to break
- `frontend/src/lib/productOptions.ts` and `backend/src/utils/productOptions.ts`
  describe the same catalogue (kinds, curtain roles, arrangements, rods,
  attire metres); the backend re-prices every order line. Change both.
- Keep content CMS-editable (`EditableText`, `EditableList`, `EditableImage`)
  and never invent claims (reviews, counts, VAT, guarantees).
- Checkout duplicate-order guards and cart versioning are explained in
  HANDOFF.md — do not simplify them away.
