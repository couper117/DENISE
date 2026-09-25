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
- [ ] Phase 2
- [ ] Phase 3
- [ ] Phase 4
- [ ] Phase 5
- [ ] Phase 6
