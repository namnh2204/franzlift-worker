This is an EmDash site — a CMS built on Astro with a full admin UI.

It is the production origin for **`franzlift.vn`** (Thang Máy Nhập Khẩu Franz), a Vietnamese
imported-elevator marketing site. It is a migration of the legacy EJS Worker, preserving the
original page structure, Vietnamese routes, Swiper carousels, AOS effects, galleries, SEO
metadata, and structured data.

> **Read `OPERATIONS.md` before deploying, changing domains, or touching auth.** It documents
> the Cloudflare resources, the `franzlift.vn` binding, and two unresolved open items
> (passkey origin mismatch, obsolete legacy Worker).

## Commands

```bash
pnpm dev          # Astro dev server
pnpm build        # astro build
pnpm deploy       # astro build && wrangler deploy
pnpm typecheck    # astro check
npx emdash types  # Regenerate collection types from a running site
```

Local admin: `http://localhost:4321/_emdash/admin`.
Production admin: see `OPERATIONS.md` — **not** yet usable on the apex domain.

## Deployment & CI/CD Credentials

- **Production Domain:** `https://franzlift.vn`
- **Cloudflare Account ID:** `7c47ea5e0254b9df48dc8df9c4eee6ed`
- **Worker:** `franzlift-emdash` (Wrangler deploy) or legacy `franzlift` in `../franzlift-worker`
- **GitHub Secrets:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` in `namnh2204/franzlift-worker` & `namnh2204/thuanphat-worker`

## Key Files

| File | Purpose |
| --- | --- |
| `astro.config.mjs` | Astro config with `emdash()`, D1 + R2 bindings, `site: "https://franzlift.vn"` |
| `wrangler.jsonc` | Worker name, bindings, custom-domain routes, cron triggers |
| `src/worker.ts` | Worker entry; hardcodes the `www` → apex 308 redirect |
| `src/live.config.ts` | EmDash loader registration (boilerplate — don't modify) |
| `seed/seed.json` | Schema + seeded content for all 10 collections |
| `src/lib/site.ts` | Content-fetching layer: `getSiteModel`, `getProductPage`, `getPostPage`, types |
| `src/lib/legacy.ts` | `legacyProductSlug()` for old numeric-ID URL redirects |
| `src/layouts/Base.astro` | Base layout: header, footer, SEO, structured data, widget area |
| `public/app.css` | Hand-written stylesheet — the real source of visual truth |
| `emdash-env.d.ts` | Generated collection types |

## Styling

Styling is **plain hand-written CSS in `public/app.css`**, loaded via a `<link>` in
`Base.astro`. There is no Tailwind, no `src/styles/` tokens file, and no design-token layer.

Class names are prefixed `fl-` (e.g. `.fl-detail-hero`, `.fl-detail-body`, `.fl-rich-text`,
`.fl-post-byline`). To change visuals, edit `public/app.css` directly.

Some markup still carries Tailwind-looking utility classes from earlier edits, but **no
Tailwind build processes them** — they are inert. Style via `fl-` classes in `app.css`
instead of adding more utility classes.

Webfont: **Inter** (400–800) via `fonts:` in `astro.config.mjs`.

## Content model

Ten collections, all defined in `seed/seed.json`:

| Collection | Label |
| --- | --- |
| `site_data` | Cấu hình website (singleton, id `config`) |
| `products` | Sản phẩm |
| `posts` | Tin tức |
| `projects` | Dự án tiêu biểu |
| `services` | Dịch vụ |
| `tech_items` | Công nghệ |
| `vr_cabins` | Mẫu Cabin 360° VR |
| `hero_slides` | Slide Hero Trang chủ |
| `reasons` | Lý do lựa chọn |
| `stats` | Thống kê năng lực |

### `site_data` is a singleton

Global config lives in the single `site_data` entry with slug **`config`**. The site queries
it directly via `entryQuery("site_data", "config")`. Always edit that existing entry — a
second `site_data` record is ignored by the frontend and should be deleted.

It exposes discrete typed columns (`site_name`, `logo`, `logo_light`, `hotline`,
`sales_phone`, `tech_phone`, `email`, `address`, `zalo_url`, `facebook_url`, `about_*`,
`vr_url`, …) plus a legacy `content` JSON field kept for backward compatibility. Prefer the
typed columns; `src/lib/site.ts` maps them onto the content model with fallbacks.

## Routes

Vietnamese paths are canonical. English paths are 301 redirects kept for SEO continuity.

| Canonical | Redirects from |
| --- | --- |
| `/gioi-thieu` | `/about` |
| `/san-pham`, `/san-pham/[slug]` | `/products` |
| `/tin-tuc`, `/tin-tuc/[slug]` | `/blog` |
| `/dich-vu` | `/services` |
| `/du-an` | `/projects` |
| `/cong-nghe` | `/technology` |
| `/lien-he` | `/contact` |
| `/360VR` | — |

Legacy numeric product URLs (`/yijia/[id]`, `/youjiasG1/[id]`, `/youjiatG2/[id]`, `/sx/[id]`,
`/Rli/[id]`) resolve through `legacyProductSlug()` and 301 to `/san-pham/[slug]`, else rewrite
to `/404`.

Also served: `/sitemap.xml`, `/robots.txt`, `/404`.

## Bylines

Products carry an EmDash byline rendered as an inline editorial signature
(`footer.fl-post-byline`) at the end of the article body — inside `section.fl-detail-body`,
not as a detached card. `src/lib/site.ts` exposes it as `product.byline` (`Byline` type),
reading hydrated `entry.data.bylines` first and falling back to `getByline()` on
`primary_byline_id`.

Manage authors in the admin under **Bylines**; assign per product in the editor sidebar.

## Widgets

| Area | Rendered in |
| --- | --- |
| `floating_buttons` | `src/layouts/Base.astro`, above `.mobile-cta-bar` |
| `sidebar_inquiry` | Not currently rendered (exists in D1 only) — see `OPERATIONS.md` |

## Not a git repository

This directory is **not** under version control — no history, no remote. Back up before
destructive edits; overwritten work is unrecoverable.

## Documentation

EmDash docs are available as an MCP server at `https://docs.emdashcms.com/mcp`. When
verifying an API, hook, config option, or field type, call `search_docs` against the live
docs rather than relying on recall. `.mcp.json`, `.cursor/mcp.json`, and `.vscode/mcp.json`
ship here so Claude Code, Cursor, and VS Code auto-discover it.

## Rules

- All content pages must be server-rendered (`output: "server"`). No `getStaticPaths()` for CMS content.
- Image fields are objects, not strings. Newly uploaded local images intentionally store the
  R2 key in `meta.storageKey` and may omit `src`/`previewUrl`; `resolveImage()` converts that
  key to `/_emdash/api/media/file/{storageKey}` at render time. Bundled images retain `src`
  and `previewUrl` because they do not have an R2 storage key.
- `entry.id` is the slug (for URLs). `entry.data.id` is the database ULID (for API calls).
- Always call `Astro.cache.set(cacheHint)` on pages that query content — `setCache()` in
  `src/lib/site.ts` does this.
- The admin edit form reads the **draft revision** when `draft_revision_id` is set, otherwise
  the live revision. Editing `ec_*` columns directly without syncing the matching row in
  `revisions` leaves the admin showing stale data.
- The hostname appears in three places — `astro.config.mjs` (`site:`), `wrangler.jsonc`
  (`routes`), and `src/worker.ts` (`APEX_HOST`/`WWW_HOST`). Change all three together.
- Keep this project's bindings isolated from HAS Lift's D1/R2. Never cross-wire them.

## What not to do

- Don't add manual `A`/`AAAA` records for `franzlift.vn` or `www.franzlift.vn` — they break
  the Worker custom-domain attach. Cloudflare manages `AAAA 100::` itself.
- Don't switch `emdash:site_url` to the apex domain casually — it invalidates the only
  registered passkey. Follow the procedure in `OPERATIONS.md`.
- Don't add a sidebar or inquiry form to the product detail page. The original site never had
  one; the full-width layout is intentional.
- Don't introduce Tailwind classes expecting them to work — there is no Tailwind pipeline.
- Don't reintroduce raw JSON textareas in the admin. `site_data` was deliberately converted
  to discrete typed fields for editors.
