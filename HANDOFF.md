# HANDOFF

## Current Task
Security findings L-1 through L-5 on the backend API.

## Status
Solved — all five applied and verified. Backend and frontend both typecheck clean.

## Progress
- [x] L-1 Input validation across all routes (express-validator)
- [x] L-2 Reservation cancel IDOR
- [x] L-3 Disabled users could refresh for 7 days
- [x] L-4 JWT secret validation at startup
- [x] L-5 Seed admin password + helpful-vote dedupe
- [ ] **Run `npx prisma migrate dev --name review_helpful_votes`** — L-5 added a
      model and the migration has not been created (no database available here)

## Working Notes

**A migration is outstanding.** `ReviewHelpfulVote` was added to schema.prisma;
`prisma generate` has been run so the code compiles, but no migration exists.
`POST /api/reviews/:id/helpful` will fail until it is applied.

**Validation layer.** `src/validators/*.validator.ts` (one per route module) plus
`src/middleware/validate.middleware.ts`. Each module exports arrays already
terminated with the `validate` handler, mounted as
`router.post(path, someRules, controller)`. Enum allowlists come from the
generated Prisma client so they cannot drift from the schema.

Two rules worth keeping if this is revisited:
- On multipart routes validators must sit **after** multer, or `req.body` is empty.
- Login validates presence only, never the password policy — accounts created
  before the policy must still be able to sign in.

**Verification.** Two throwaway suites in the session scratchpad, both passing:
`validation-smoke.js` (46 checks, real routers, no DB — validation runs before
every controller so 400 = rejected and 500 = accepted-then-hit-Prisma) and
`security-smoke.js` (18 checks, Prisma stubbed via require.cache; the stub needs
`__esModule: true` or TS interop double-wraps it). They are not part of the repo —
the project has no test setup.

## Out of scope — found while working, not fixed

1. `PUT /api/auth/profile` wipes the stored email when the field is omitted:
   `email: email || null` (auth.controller.ts:141). Data loss on a partial update.
2. `updateProduct` (product.controller.ts) sets `isFeatured`/`isNewArrival`/
   `isAvailable`/`isOnPromotion` to `false` whenever the field is absent, so
   editing just a name silently unfeatures the product.
3. `updateCategory` runs `parseInt(sortOrder)` unconditionally → writes NaN when
   the field is omitted (category.controller.ts:46).
4. `POST /api/payments/initiate` takes `amount` from the request body with no
   authentication, so a caller can set any amount against any reservation id.
   Validation cannot fix this — the amount must be derived from the reservation.
5. `createReservation` destructures `scheduledDeliveryDate` and never uses it —
   the scheduled date is silently discarded.
6. `database/schema.sql` is stale: it predates ProductReview, Payment,
   DeliveryZone and DeliveryAddress. Prisma is the real source of truth.
7. README's post-deploy checklist says `/api/health`; the route is `/health`.
8. `connectDB()` calls `process.exit(1)` on failure, which defeats the
   "run without DB" `.catch()` in index.ts.

## Known frontend issue (not fixed)

The home hero's background image 404s. `Home.tsx:53` hotlinks
`https://images.unsplash.com/photo-1558171813-d3fcd69cf19b` — that photo has
been removed from Unsplash, so the hero renders as a bare crimson gradient with
no fabric imagery behind it. Needs a replacement image (ideally the shop's own
photo) dropped into that URL.

## Recently Completed
- A home-page redesign was attempted this session and **fully reverted** at the
  user's request — `Home.tsx`, `globals.css`, `tailwind.config.js`, `config.ts`,
  `Contact.tsx` and all five i18n locale files are back to their committed state.
  The user did not like the direction; do not re-apply it. Any future attempt
  should start from a discussion of visual direction, not from this code.
- Frontend brought up locally at http://localhost:5173 (backend not started —
  local Postgres password unavailable, so no DATABASE_URL).
