# HANDOFF

## Current Task
Checkout redesign: the buying journey now runs
**browse → configure → add to cart → review cart → checkout → delivery details →
review order → choose payment → pay → await admin confirmation → track**.
Payment used to be the *first* question asked (on the product page, and again as
step 1 of the reservation wizard); it is now the last. Branch `Levi`, merged to
`main`.

## Status
Shipped. Backend and frontend typecheck, the production build passes, and the
migration applies cleanly to a real Postgres and is safely re-runnable.

**Verified:** 44/44 API checks (server-side pricing, tampered carts, option
normalisation, stock across lines, delivery fees, status history, admin filters
and search) and 29/35 browser checks of the journey.

**Not verified:** the browser pass was not re-run after the last fix — the user
asked to skip it and ship. Specifically unverified in a browser: the
duplicate-submit fix and the confirmation screen behind it. The 6 failures in
the last recorded browser run were all downstream of the double-submit bug,
which is fixed but not re-run. **Re-run `browser.js` (recipe at the bottom)
before trusting the confirmation screen.**

## Progress
- [x] Product page configures the curtain (colour, width, drop, panels, header,
      lining, fullness, quantity, notes) with a live total and validation
- [x] `/cart` — line items with specs, quantity steppers, edit, remove, summary
- [x] `/checkout` — delivery → review → **payment last** → confirmation
- [x] Backend prices every line server-side and stores the configuration
- [x] Order status history, price breakdown, scheduled delivery date persisted
- [x] Admin: payment method/reference, ordered specs, breakdown, history,
      payment-status filter, reference search, printable invoice
- [x] i18n keys in all five locales (en + fr translated; rw/sw/ln fall back —
      see "Known gaps")
- [ ] Browser re-run of the full journey after the duplicate-submit fix

## Architecture — read this before changing the checkout

**The flow is three pages, not one wizard.** `pages/Reservation.tsx` (881 lines:
fulfilment → cart → one giant form) is **deleted**. It became:
- `pages/Cart.tsx` — the basket, no questions asked
- `pages/Checkout.tsx` — delivery info → order review → payment → success
- `/reservation` is a `<Navigate to="/cart">` so SMS receipts and bookmarks live

**Fulfilment (delivery / pickup / reserve-and-visit) moved to checkout step 1,**
not the product page, because the delivery fee cannot be known until a province
is chosen, and that fee has to be inside the total the customer reviews *before*
paying. The three types and their semantics are otherwise unchanged.

**Configuration lives in one catalogue, duplicated on purpose:**
`frontend/src/lib/productOptions.ts` and `backend/src/utils/productOptions.ts`.
The frontend one drives the UI and shows an estimate; **the backend one is the
authority** and re-prices every line from the product row at checkout, so a
tampered cart cannot change what is owed (there is an API check for exactly
that). Keep them in sync — `DELIVERY_FEES` is duplicated the same way.

**Which options a product gets is *derived*, not configured:** a category
slug/name containing curtain/sheer/drape/blind → CURTAIN (dimensions +
make-up); `pricePerMeter` set → FABRIC (cut length); otherwise SIMPLE (quantity
only). There is no product-type column and adding one would mean re-tagging the
whole catalogue.

**Option prices are all zero, deliberately.** Header type, lining and panel
layout genuinely change what a curtain costs, but the shop has never recorded
those surcharges anywhere — not on `Product`, not in the seed. Inventing numbers
would overcharge real customers. The `priceDelta` mechanism is wired end to end
with every value at `0`; set real ones in the two catalogue files when the shop
decides, and nothing else has to change.

**Curtain metres** = `(width_m × fullness) × (drop_m + 0.3)`, rounded up to a
tenth, and **not** multiplied by the panel count — splitting the same gathered
width into two panels does not need twice the fabric. `FabricEstimator` used to
multiply by panels and over-estimated a pair by 2×; it now calls the same
`computeCurtainMeters`, and its "Panels/Window" input was dropped because it
never affected the answer.

**The cart holds configured lines, not products.** Each line has its own id, so
the same curtain at two sizes is two lines; re-adding an identical configuration
bumps the quantity instead. `denise-cart` is persisted at **version 2** with a
`migrate` that converts v1 carts (keyed by product id) — customers have live
carts in their browsers, and losing them on deploy day is exactly what this
refactor exists to prevent.

**Duplicate orders.** `Checkout.tsx` guards with two refs and the reason is in a
comment there: React Query's `isPending` is a snapshot from the last render, so
two clicks in the same tick both read the stale value. A double click on Place
order really did create two identical orders six milliseconds apart during
verification. `submittingRef` is set **synchronously** before the request;
`placedRef` is set on success and never cleared. The "cart is empty → go to
/cart" effect tests `placedRef`, not `step`, so no interleaving of those two
state updates can bounce a customer to an empty cart instead of their receipt.

**The cart is cleared only in `onSuccess`.** A failed order must leave it exactly
as it was, and the error copy promises that.

**Payment methods are gated on what the shop can actually honour**
(`lib/config.ts`, the same pattern as the pre-existing `AIRTEL_ENABLED`): MoMo
on, Airtel off until a real number is set, **card off because there is still no
gateway** — `POST /api/payments/initiate` carries a "TODO: integrate with actual
payment gateway", and a card button would take an order the shop cannot charge.
Bank transfer and pay-in-person are on. A reservation is always pay-in-person.

## Database

Migration `20260804090000_checkout_order_details`, all additive and guarded:
- `ReservationItem.options` (JSONB) — the normalised configuration. JSON rather
  than a column per option because the option set differs per product kind. It
  is normalised against the catalogue server-side, so an arbitrary blob can
  never reach the admin screen or an invoice (there is an API check for this).
- `Reservation.subtotal` / `discount` — the breakdown at the prices actually
  charged, so an invoice reprinted later still shows what the customer saw.
- `Reservation.scheduledDeliveryDate` — the API accepted this and silently threw
  it away; it is stored now.
- `ReservationStatusEvent` — append-only audit, one row per real transition.

Deploy: `npx prisma migrate deploy`. Nothing else.

## Known gaps

1. **rw / sw / ln translations.** The new checkout strings were added to all five
   locale files; English and French are translated, the other three carry the
   English text (i18next falls back to `en` regardless). They are ordinary
   `t()` keys, so an admin can translate them in place through the visual CMS.
2. **Browser re-run outstanding** — see Status.
3. Card payments stay hidden until a gateway exists.

## Out of scope — found while working, not fixed

1. `lookupReservations` (track by name + phone) matches the last nine digits
   with `contains` against the phone **as typed**, so a number stored as
   `+250 780 111 222` is never found by `780111222`. Confirmed during
   verification. Needs a normalised column or a digits-only comparison.
2. `PUT /api/auth/profile` wipes the stored email when the field is omitted.
3. `updateProduct` unfeatures a product when the boolean fields are absent.
4. `updateCategory` writes NaN when `sortOrder` is omitted.
5. `connectDB()` still `process.exit(1)`s on failure, defeating the
   "run without DB" catch in `index.ts`.
6. `index.html` sets `theme-color: #006B3C` (green) while the brand is crimson.

## How verification was run (repeat it before trusting the flow)

Scratchpad scripts — `flow.js` (API), `browser.js` (journey), `cdp.js` (driver)
— live in this session's scratchpad; recreate them if they are gone.

```
# throwaway Postgres — never point this at real data
initdb -D <tmp>/pgdata -U postgres --auth=trust
pg_ctl -D <tmp>/pgdata -o "-p 55432 -c listen_addresses=localhost -c autovacuum=off" start
createdb -h localhost -p 55432 -U postgres denise_checkout
DATABASE_URL=postgresql://postgres@localhost:55432/denise_checkout npx prisma migrate deploy
ADMIN_PASSWORD=... npx ts-node src/seed.ts     # seeded products are price-on-request:
                                               # set price / pricePerMeter by hand to test pricing
```

Windows gotchas that cost real time (all still true):
- Start Postgres from **PowerShell, not Git Bash** — children die with
  `0xC0000142` otherwise.
- `frontend/.env` beats a shell variable. Point the dev server at a local API
  with `frontend/.env.local` (gitignored) and **delete it afterwards**.
- The API needs `FRONTEND_URL` set to the dev origin or CORS blocks every
  browser request with nothing in the API log — that silence is the tell.
- The Claude Chrome extension was not connected; headless Chrome with
  `--remote-debugging-port=9222` driven over CDP needs nothing installed.
- Vite compiles each route chunk on first request. Warm the app up before
  asserting anything, or the first page looks empty and every check fails.
- React controlled inputs ignore a plain `el.value = x`. Use the native setter
  (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set`)
  then dispatch `input` + `change`.

## Recently Completed
- Checkout redesign (this task).
- Visual CMS, 8 phases (previous task). Its two invariants still hold and were
  re-checked here: `EditorLayer` is still its own lazy chunk and is not
  modulepreloaded in `dist/index.html`, and the new pages emit **0**
  `data-cms-*` attributes for a visitor.
- About polish + home hero + favicon set.
