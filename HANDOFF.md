# HANDOFF

## Current Task
Dark mode looked red-brown rather than dark. Frontend only, branch `Levi`,
merged to `main`.

## Status
Shipped. `npm run build` (tsc + vite) passes and both themes were screenshotted
in headless Chrome — home, cart, contact, plus a board rendering every status
badge with its shipped class string.

## Theme — read this before touching colours

**Dark surfaces are neutral, not a dark version of the brand.** Every neutral in
`.dark` (`frontend/src/styles/globals.css`) used to carry the crimson hue
(`10 8-10%`), so background, every card and every border came out red-brown and
the brand bled into the chrome. They are now hue `220` at ≤10% saturation —
neutral grey with a faint cool cast. **Do not put the brand hue back into
background / card / popover / muted / accent / border / input.** Crimson is
deliberate in exactly three tokens: `--primary`, `--ring`, `--destructive`.

**Measured dark contrast** (recompute if you retune):

| pair | ratio |
|---|---|
| foreground on background | 16.9 |
| muted-foreground on card | 7.5 |
| white on primary (buttons) | 5.0 |
| primary as text on background | 3.7 |

`--primary` was lifted 45% → 50% L so white-on-primary buttons clear 4.5:1.
That leaves `text-primary` at 3.7:1 — fine for the large titles, icons and
hover states it is actually used for (AA needs 3:1 there), **not** fine if
someone starts using it for small body copy. No single red satisfies both
white-on-primary ≥4.5 and primary-on-background ≥4.5; the buttons won.

**Full-bleed brand fills need a dark pair.** The announcement bar
(`Header.tsx`) is solid `bg-primary` on light; on dark that is the brightest
thing on the page, so it drops to `dark:bg-primary/15`. Buttons and badges keep
their solid fill — only the full-width band was the problem.

**Every `bg-*-100` badge needs a `dark:` pair.** The Tailwind `-100` fills are
near-white and glow on a dark page. The convention now used everywhere is
`dark:bg-{c}-500/15 dark:text-{c}-300` (plus `dark:border-{c}-500/25` where the
badge has a border). `getStatusColor` in `lib/utils.ts` is the shared order-status
helper and already follows it — **add the dark pair there, not at call sites.**

`color-scheme` is declared on both `:root` and `.dark`; without it Chrome paints
the checkout date picker, select dropdowns and autofill in light chrome.

## Progress
- [x] `.dark` tokens de-tinted to neutral slate
- [x] `color-scheme` declared for both themes
- [x] Announcement bar drops to a tinted strip on dark
- [x] Scrollbar thumb goes neutral on dark (crimson only on light)
- [x] Dark pairs on every status badge, stat tile and destructive hover
- [x] Both themes screenshotted; light mode confirmed unchanged

## Working Notes
Nothing outstanding on the theme. The unrelated checkout item below is still
open.

- [ ] **Carried over from the checkout task:** the browser pass was never
      re-run after the duplicate-submit fix. Specifically unverified: the
      duplicate-submit guard and the confirmation screen behind it. Re-run
      `browser.js` (recipe at the bottom) before trusting the confirmation
      screen. This theme change did not touch that code.

The screenshot driver used here is disposable — headless Chrome over raw CDP,
no dependencies (Node 24 has a global `WebSocket`). It seeds
`localStorage['denise-theme']` with `{state:{isDark:true},version:0}` before the
app boots, then navigates. Recreate it in the scratchpad if needed; the Chrome
extension timed out again, as it did last session.

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
- Dark mode de-tinted (this task).
- Checkout redesign — browse → configure → cart → checkout → **payment last** →
  confirm → track. 44/44 API checks passed; browser re-run still outstanding
  (see Working Notes).
- Visual CMS, 8 phases (previous task). Its two invariants still hold and were
  re-checked here: `EditorLayer` is still its own lazy chunk and is not
  modulepreloaded in `dist/index.html`, and the new pages emit **0**
  `data-cms-*` attributes for a visitor.
- About polish + home hero + favicon set.
