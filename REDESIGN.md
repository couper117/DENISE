# Storefront redesign — phase plan

Goal: a modern shop UI where a first-time visitor understands in five seconds
**who DENISE is** (a Kigali textile shop), **what it sells** (curtains made to
measure, fabrics by the metre, Rwandan traditional attire, rods & accessories)
and **how to buy** (order online and pay by MoMo, get delivery anywhere in
Rwanda, or reserve and visit the shop).

Work happens on the `redesign` branch. Each phase ends with `npm run build`
passing, desktop + mobile screenshots in light and dark, and a Vercel preview
before anything is merged to `main` (which is what deniseshop.com serves).

## Rules that carry through every phase

- **Checkout logic is not touched.** Visual changes only in Cart/Checkout; the
  duplicate-submit refs, cart versioning and payment gating in HANDOFF.md stay.
- **Everything stays CMS-editable.** Text goes through `EditableText`, images
  through `EditableImage`, lists through `EditableList`. Existing content keys
  are kept so text the admin already edited keeps showing.
- **No invented claims.** No fake review counts, customer numbers or ratings.
- **Dark mode rules in HANDOFF.md still apply** (neutral surfaces, `dark:` pair
  on every tinted badge).
- **New strings go in all five locale files** (en/fr translated; rw/sw/ln get
  English until translated through the CMS, same as before).

## Phases

### Phase 1 — Design foundation, header, footer
Warm, light "boutique" palette; modern type pairing (Fraunces + Inter); shared
button/section classes; header rebuilt around what the shop sells (category
bar on every page, a real search box, clearer cart/account); footer rebuilt
with what-we-do, shop links, help links, payment methods, visit-us.

### Phase 2 — Homepage
Split hero that shows products and states the offer plainly; value strip
(delivery, MoMo, made-to-measure, visit the shop); photo category tiles;
featured rail; "made to measure" curtain service band; how-to-buy steps that
match the real checkout (online pay + delivery, or reserve); testimonials;
visit-the-shop block. Stale copy fixed (it still says "no online payment").

### Phase 3 — Browsing & product page
Product card (clean image-first card, hover actions, clear price); product
listing (category chips, filter drawer on mobile, sort, result count, empty
states); product page (gallery, sticky buy box, delivery/payment reassurance,
related products).

### Phase 4 — Cart, checkout, tracking (visual only)
Restyle to the new system, order summary card, progress indicator, trust notes.
No behaviour changes; re-run the browser pass that HANDOFF.md says is still
outstanding.

### Phase 5 — Brand pages & accounts
About (story, what we make, the shop), Contact, Blog, Login/Register, account
pages, restyled to match.

### Phase 6 — Polish & launch
Accessibility pass, performance (image sizes, fonts), SEO meta, `theme-color`,
translations for new strings, final light/dark/mobile review, merge to `main`
and verify on deniseshop.com.

## Status

- [x] Phase 1 — tokens, Fraunces + Inter, `.btn`/`.eyebrow`/`.section-title`
  classes in `globals.css`, new Header (top bar, search, category bar, mobile
  chips + portalled drawer) and Footer (help band, payment methods from config
  flags). Products page now follows `?category=` / `?search=` changes.
  Carried into Phase 3: the Products sidebar filter still changes state without
  the URL, so the URL should become the single source of truth there; and the
  result count reads "Showing 1–0 of 0" when empty.
- [x] Phase 2 — homepage rebuilt: plain-language hero, value strip, category
  tiles that use a real product photo per category, made-to-measure band,
  how-to-buy steps matching the real checkout (MoMo, delivery or pickup).
- [x] Phase 3 — product card (image-first, hover second image, quick add),
  listing (URL is the only filter state, sidebar with sub-categories, filter
  sheet on phones, sort, pagination with gaps), product page (gallery, buy box,
  trust list, collapsible details, reviews) and the **curtain builder**
  (`components/products/CurtainBuilder.tsx`): window width + height → metres for
  the night curtain, optional matching day curtain, rod length (double when both
  curtains), finishing options, total, add the set to the cart / Buy now.
  Also pulled in: admin login by phone or email (staff land on /admin),
  sub-categories selectable in the admin product form, window-set chips in admin
  orders and invoices, "Made by Malhottech Company Ltd" in the footer, full
  translation pass (fr/rw/sw/ln) and fixes to old Kinyarwanda/Lingala errors.
- [x] Buying-flow pass (between phases): curtain wizard with arrangement and
  fullness pictures, multiple windows/doors in metres, rods sized from them;
  fabric = metres + colour; traditional attire = 4 m standard or custom;
  emoji and unverified claims removed; admin product management rebuilt.
- [x] Mobile pass: bottom tab bar, photo hero, swipe rails, sticky product
  and cart bars, collapsible checkout summary.
- [x] Live on www.deniseshop.com; API moved to Vercel (`denise-api`); SEO
  (per-page HTML for crawlers, live sitemap, www canonical, sharing image).
- [ ] Phase 4
- [ ] Phase 5
- [ ] Phase 6
