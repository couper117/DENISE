# HANDOFF

## Current Task
Visual CMS (VCMS): the website itself becomes the content editor. Admins toggle
"Edit Website" in the navbar and edit in place; visitors see and download
nothing. Branch `Levi`. **Backend done, frontend not started — uncommitted.**

## Status
All 8 phases complete and **uncommitted**. Verified against a real Postgres:
both migrations apply, 24/24 API checks, 9/9 end-to-end browser checks
(login → edit → autosave → publish → anonymous visitor sees it), 10/10 media
checks, 11/11 history-and-settings checks.

**Not yet done:** nothing has run against the production database, and no
Cloudinary credentials were configured, so the server-side crop path
(`buildTransform`) has only been exercised through its local-disk fallback.

## Progress
- [x] 1 — Data model: `ContentBlock`, `ContentRevision`, `MediaAsset`,
      `MediaFolder`, `SiteSetting` + `ContentType` enum. Migration written to
      `20260803120000_visual_cms_and_review_votes` — it **also carries the
      outstanding `ReviewHelpfulVote` table**, so that older gap is closed.
- [x] 2 — Content API (`/api/cms`): public published map with ETag, admin draft
      map, batch draft save, publish, discard, revisions, restore, search,
      find-and-replace, schedule + a 60s release timer in `index.ts`.
- [x] 3 — Media API (`/api/media`): multi-file upload, list/search/tag/folder
      CRUD, usage check before delete, Cloudinary crop transforms.
- [x] 4 — Frontend core in `frontend/src/cms/`: `CmsProvider`, zustand store,
      `Editable*` primitives, `EditWebsiteButton` in the navbar, editor chunk
      shell. About.tsx converted as the reference adoption.
- [x] 5 — Editors: inline contentEditable for text/rich text with a format
      toolbar, anchored glass panels for image / link / icon / number / colour,
      and a list editor with add / remove / reorder / duplicate. Exercised in a
      real browser over CDP.
- [x] 6 — Save system: debounced autosave with a hard ceiling, publish /
      discard / preview in the toolbar, status pill, unload guard, toasts.
      `cms/sync.ts` is the single implementation of every write path.
- [x] 7 — Media library modal (folders, search, tags, drag-drop upload, detail
      pane, usage-count warning before delete) and a crop / resize / recompress
      tool. 10/10 browser checks.
- [x] 8 — Version history (list, author, relative time, word-level diff,
      restore-into-draft), site settings (SEO, logo, favicon, theme colours,
      analytics id, maintenance mode) and global find-and-replace with a dry-run
      preview. 11/11 browser checks.

## Deploying this

1. `npx prisma migrate deploy` against the real database.
2. Set `CLOUDINARY_*` if you want non-destructive server-side crops and CDN
   delivery; without it uploads land on local disk, which is **ephemeral on
   Railway/Render** — images will vanish on redeploy.
3. Nothing else. The CMS renders correctly against an empty database.

## VCMS architecture — read this before continuing

**The load-bearing decision:** every piece of marketing copy on this site
already flows through `t('some.key')` (`hero.title`, `about.story_p1`,
`footer.tagline`) in five locales. That is already a universal, page-agnostic
content addressing scheme. The CMS does **not** invent one — it overlays it.

Consequences, all deliberate:
- A `ContentBlock` is an **override**, not the source of truth. When no row
  exists the bundled locale JSON renders. An empty database therefore serves a
  correct site, and adopting the CMS needs no bulk content migration.
- Content is **per-locale**. Edit mode edits whichever language is currently
  selected. Unique key is `(key, locale)`.
- "No page needs custom edit code" is satisfied because a new page written with
  `t()` and the `Editable*` wrappers is editable the moment it ships.

**Draft vs published.** `draftValue` is what edit mode and preview read;
`publishedValue` is what the public endpoint serves. There is deliberately **no
status column** — dirty state is derived (`hasUnpublishedChanges`) so it cannot
drift. Publishing copies draft→published and writes one `ContentRevision` per
block, which is what history restores from. Discard deletes never-published rows
entirely so the site falls back to the JSON default.

**Security.** All rich text is sanitised server-side in `utils/cms.ts` against
an allowlist matching what the toolbar can produce — an admin account is still
an untrusted input path for stored XSS aimed at visitors. `normalizeContentValue`
is the single choke point: every write goes through it, per content type. URLs
are scheme-checked (`javascript:`/`data:` rejected). Every `/api/cms/admin/*`
and all of `/api/media` sits behind `authenticate + requireAdmin`.

**Performance.** One request returns the whole content map for a locale, not one
per element. Public reads carry an ETag and `stale-while-revalidate`.
`CmsProvider` deliberately does **not** block rendering — children paint from the
bundled defaults and overrides swap in — so the CMS never sits in front of first
paint. Repeat visits hydrate synchronously from a localStorage cache to avoid a
default→override flash; only *published* content is cached, never drafts.

**Two invariants worth re-verifying after any change to `Editable.tsx`:**
1. `EditorLayer` must stay a `React.lazy()` import. Verify with
   `npm run build` — it must appear as its own chunk and **must not** be
   `modulepreload`ed in `dist/index.html`.
2. A visitor's DOM must contain **zero** `data-cms-*` attributes. Verify with
   `chrome --headless --dump-dom <url> | grep -c 'data-cms'` → 0. This already
   caught one leak: `data-cms-multiline` was gated on the `multiline` prop but
   not on `editMode`, so it shipped to visitors. Every attribute must be gated
   on edit mode, not only the id.

## Running the CMS locally (this is how phase 6 was verified)

No `DATABASE_URL` is configured and the installed Postgres 18 password is
unknown, so a **throwaway cluster** was used instead of touching real data:

```
initdb -D <tmp>/pgdata -U postgres --auth=trust
pg_ctl -D <tmp>/pgdata -o "-p 55432 -c listen_addresses=localhost -c autovacuum=off" start
createdb -h localhost -p 55432 -U postgres denise_cms
DATABASE_URL=postgresql://postgres@localhost:55432/denise_cms npx prisma migrate deploy
```

Windows gotchas that cost real time:
- Start Postgres from **PowerShell, not Git Bash**. Spawned from Git Bash its
  child processes die with `0xC0000142` (DLL init failure) and the server
  restart-loops. `-c autovacuum=off` avoids the autovacuum worker hitting it.
- `frontend/.env` sets `VITE_API_URL=/api` and **beats a shell variable**. To
  point the dev server at a local API use `frontend/.env.local` (gitignored),
  and delete it afterwards.
- The API needs `FRONTEND_URL` set to the dev origin or CORS silently blocks
  every browser request — the API log shows nothing at all, which is the tell.
- `pkill -f tsx` does not reliably kill the API on Windows. Use
  `Get-NetTCPConnection -LocalPort <port> | Stop-Process`, or the next start
  fails with `EADDRINUSE` and you keep testing the *old* process.

**Driving the editor without a backend.** In dev only, the store is exposed as
`window.__cms`, so edit mode can be entered with
`__cms.setState({ canEdit: true, editMode: true })`. That is how phase 5 was
verified: headless Chrome with `--remote-debugging-port`, driven over CDP from a
throwaway Node script (fetch `/json/list`, connect the WebSocket,
`Runtime.evaluate` + `Page.captureScreenshot`). The Claude Chrome extension was
not connected in that session; CDP needs nothing installed.

**Three traps this phase hit, all worth remembering:**
1. `import * as LucideIcons` in `Editable.tsx` to resolve icons by name defeated
   tree-shaking and took the main chunk from **312 kB to 979 kB**. Icons now come
   from an explicit registry in `cms/icons.ts` (126 named imports); adding one is
   a two-line change there and nothing else.
2. `EditorStyles.tsx` holds its CSS in a **JS template literal**, so a backtick
   anywhere inside — including in a CSS comment — terminates the string and
   crashes the whole editor subtree with a `TypeError` whose message is the CSS.
   There is a NOTE in the file; do not put backticks in that block.
3. Editor chrome must key off the site's `.dark` class, **not**
   `prefers-color-scheme`. The latter gave dark panels over a light page.
4. **`backdrop-filter` on `.cms-glass` makes it a containing block for
   `position: fixed` descendants.** The media library and crop modals render
   from inside an editor panel, so without a portal they were trapped inside the
   340px panel instead of covering the viewport. Both now
   `createPortal(..., document.body)`. Any future full-screen editor UI must do
   the same. Element-count assertions passed while this was broken — it was only
   visible in a screenshot.
5. **Version history must live in the toolbar, not the editor panel.** Text
   blocks edit inline and never render a panel, so a History button in the panel
   footer was unreachable for the most common content type. It now hangs off
   `selected` in the toolbar and covers every type uniformly.
6. The public content endpoint originally sent
   `max-age=30, stale-while-revalidate=300`. That made a publish invisible to
   any browser holding a cached copy — up to five minutes. It is now
   `max-age=0, must-revalidate`; the ETag keeps revalidation to a bodyless 304,
   so correctness costs almost nothing. **Do not reintroduce a freshness
   window** without a CDN purge on publish.

**Inline text editing.** The real element becomes `contentEditable` rather than
being swapped for an input — that is what preserves its typography and makes it
feel like a document. The store is deliberately **not** updated per keystroke:
that would re-render mid-edit and drop the caret. Commit happens on blur, on
Enter for single-line fields, and in the effect cleanup so that switching
elements or leaving edit mode cannot lose an edit. Escape reverts.

**Adoption pattern** (About.tsx is the worked example):
```tsx
<h1 className="…">{t('about.story')}</h1>
<EditableText id="about.story" as="h1" className="…" />
```
For non-text types the previously hardcoded value becomes `fallback`, so the
change cannot regress the page. Repeatable collections use `EditableList` with a
`fields` schema; its `fallback` is built from `t()` at render time so the list
stays translated until someone overrides it for that locale.

## Working Notes

### About page
Two earlier attempts this session were rejected and reverted — **do not
re-apply them**:
1. A restructured page (page header + "what we stock" panel + how-we-sell band).
2. A dark photo hero band at the top.

What the user wanted, and what is now shipped: main's original three-section
page, polished in place, plus one new section. Current order is
**Story → Mission & Vision → Values**. There is deliberately **no hero and no
page title block** — the user asked for the "Made in Rwanda" badge, the
`about.title` heading and `about.hero_subtitle` to be removed. The page opens
straight into the story, so `about.story` ("Our Story") is the page's `h1`.
Do not reintroduce a title band.

Other details:
- The old story image (`photo-1558171813-d3fcd69cf19b`) was **404 on Unsplash**
  and rendered as a grey box. Replaced with a verified pair: fabric swatches
  (`1601056639638`) in a 4:5 frame plus a linen inset (`1616627561950`).
- The image column is capped at `max-w-md`. At full column width the 4:5 frame
  stands ~825px tall against ~480px of text and the row fills with dead space.
- The gold block and the inset photo use negative offsets into the grid gutter,
  so both are `hidden lg:block` — below `lg` that gutter does not exist and they
  would push past the container and scroll sideways.

### Home hero
The photo is the user's choice, `photo-1783538690103-782ddd5404c1`. The original
is 3000px / 1.7 MB, so `heroSrc(w)` builds the URL and the `<img>` carries a
`srcSet` of 768–3000. Scrims are unchanged from main.

**Before launch:** replace both pages' hotlinked Unsplash photos with the shop's
own photography — same `<img>`, different `src`.

### Favicon
`public/favicon.svg` is the source of truth: crimson field, white serif "D"
drawn as a **path** (so it does not depend on Playfair Display being installed),
gold baseline, faint woven pattern. Everything else is generated from it.

Regenerating: Chrome's headless screenshot **silently produces blank frames at
some window sizes** (128/144/152 came out white). So render once at 1024px and
downscale in Node — a throwaway `png.js` (decode → box filter → encode → ICO) in
the session scratchpad did this. Do not trust a per-size Chrome screenshot
without opening the result.

Generated: `icons/icon-{72,96,128,144,152,192,384,512}.png` (full-bleed, so the
manifest's `purpose: "maskable any"` can crop safely), `apple-touch-icon.png`
(180, rounded), `favicon-{16,32,48}.png` and `favicon.ico`. `index.html` now
lists `.ico` → `.svg` → PNGs, and `apple-touch-icon` points at the real 180px
file instead of `icons/icon-192.png`.

### Verifying screenshots
Two Windows-specific traps, both capture artifacts rather than bugs:
- Headless Chrome does **not** advance framer-motion's `whileInView`, so
  below-fold sections always look half-faded.
- Chrome clamps the viewport to ~500px wide, so `--window-size=390` crops a
  500px page instead of rendering a 390px one. **Mobile cannot be verified this
  way.** The untouched Contact page clips identically — that is the tell.

## Out of scope — found while working, not fixed

1. `PUT /api/auth/profile` wipes the stored email when the field is omitted:
   `email: email || null` (auth.controller.ts). Data loss on a partial update.
2. `updateProduct` sets `isFeatured`/`isNewArrival`/`isAvailable`/`isOnPromotion`
   to `false` whenever the field is absent, so editing just a name silently
   unfeatures the product.
3. `updateCategory` runs `parseInt(sortOrder)` unconditionally → writes NaN when
   the field is omitted.
4. `POST /api/payments/initiate` takes `amount` from the request body with no
   authentication, so a caller can set any amount against any reservation id.
   The amount must be derived from the reservation.
5. `createReservation` destructures `scheduledDeliveryDate` and never uses it.
6. `connectDB()` calls `process.exit(1)` on failure, defeating the
   "run without DB" `.catch()` in index.ts.
7. `index.html` sets `theme-color: #006B3C` (green) while the logo and favicon
   are crimson. Someone should decide which is the brand colour.
8. `home.stat_products` / `stat_customers` / `stat_rating` are now unused in all
   five locales — the fabricated stats they backed were removed earlier.

## Recently Completed
- About polish + home hero + favicon set (this task); `origin/main` was merged
  in first, since it already contained this branch.
- Home page polish (previous task).
- Security findings L-1..L-5 on the backend API.
