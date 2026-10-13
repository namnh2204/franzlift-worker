# Franzlift EmDash — Operations & Open Items

Operational state of this project as of 2026-09-07. Read this before deploying, changing
domains, or touching authentication.

## Cloudflare resources

All resources live in account `7c47ea5e0254b9df48dc8df9c4eee6ed`
(`Thuanphatweb11@gmail.com's Account`).

| Resource | Name / ID |
| --- | --- |
| Worker | `franzlift-emdash` |
| D1 database | `franzlift-emdash` (`3096b02d-4413-4982-9926-969b959f1ef0`) |
| R2 bucket | `franzlift-emdash-media` |
| KV (sessions) | `01fc2789cbb14300a212ddc1b906dd80` |
| Zone | `franzlift.vn` (`69a2eac65c6fb48e865352e7de264ffb`) |

This project is fully isolated from HAS Lift. HAS Lift uses a **separate** Worker, D1, and
R2 (`haslift-emdash`, `haslift-emdash-media-full`). Never point one project's bindings at
the other's storage.

Deploy credentials come from `/home/namnh/workspace/thuanphat/franzlift-worker/deployment/.env`.

## URLs

| Purpose | URL |
| --- | --- |
| Production | `https://franzlift.vn` |
| `www` | `https://www.franzlift.vn` → 308 → apex |
| workers.dev fallback | `https://franzlift-emdash.thuanphat.workers.dev` |
| Admin | `https://franzlift-emdash.thuanphat.workers.dev/_emdash/admin` |

Auth is **native EmDash passkey** (no Cloudflare Access). HAS Lift uses Access OTP instead —
the two sites deliberately differ here.

## Domain binding (done 2026-09-07)

`franzlift.vn` and `www.franzlift.vn` are attached to the `franzlift-emdash` Worker as
custom domains, declared in `wrangler.jsonc`:

```jsonc
"routes": [
  { "pattern": "franzlift.vn", "custom_domain": true },
  { "pattern": "www.franzlift.vn", "custom_domain": true },
],
```

Cloudflare manages the resulting proxied `AAAA 100::` records automatically. Do not add
manual `A`/`AAAA` records for these hostnames — they conflict with the custom-domain attach.

Before the binding, the zone held 8 stale proxied `A`/`AAAA` records pointing at Cloudflare
anycast IPs (`172.67.187.172`, `104.21.76.44`). They served HTTP 403
`"DNS points to prohibited IP"`, so the domain was already broken — this was a recovery, not
a swap from a working site. Those records were deleted and backed up to:

```
/home/namnh/workspace/thuanphat/dns-backup/franzlift.vn-dns-before.json
```

The `www` → apex 308 is implemented in `src/worker.ts`, which hardcodes the hostnames:

```ts
const APEX_HOST = "franzlift.vn";
const WWW_HOST  = "www.franzlift.vn";
```

If the domain ever changes, update `src/worker.ts`, `wrangler.jsonc`, and `site:` in
`astro.config.mjs` together — all three carry the hostname.

## OPEN ITEM 1 — passkey is bound to the workers.dev origin

**Status: unresolved. This is the main gotcha.**

`emdash:site_url` in D1 still reads:

```
https://franzlift-emdash.thuanphat.workers.dev
```

There is exactly **1** registered passkey credential, and passkeys are bound to the origin
they were registered against. Consequences:

- Admin login works at `https://franzlift-emdash.thuanphat.workers.dev/_emdash/admin`.
- Admin login at `https://franzlift.vn/_emdash/admin` will **fail** — the route resolves and
  redirects to `/login`, but the passkey will not validate against the new origin.

To move the admin onto the apex domain:

1. Keep the workers.dev admin URL open in a separate tab as a fallback before starting.
2. Update the stored site URL:
   ```bash
   cd /home/namnh/workspace/thuanphat/franzlift-emdash
   set -a; source /home/namnh/workspace/thuanphat/franzlift-worker/deployment/.env; set +a
   ./node_modules/.bin/wrangler d1 execute franzlift-emdash --remote \
     --command "UPDATE options SET value='\"https://franzlift.vn\"' WHERE name='emdash:site_url';"
   ```
   The value is JSON-encoded, so the surrounding quotes are required.
3. Re-register the passkey at `https://franzlift.vn/_emdash/admin`. The old credential
   becomes unusable.

Do not do this mid-session or without the fallback tab open — a mistimed switch locks you
out of the CMS.

## OPEN ITEM 2 — obsolete `franzlift` Worker still deployed

The legacy `franzlift` Worker (last modified 2026-08-20) is still in the account. It has no
route or custom domain pointing at it, so it is inert and serves no traffic.

Decide whether to delete it or keep it as a rollback target. Earlier obsolete Workers
(`thuanphat-worker`, `haslift-emdash-poc`) were deleted; this one was intentionally left
pending a decision.

## Known content issue

Four images embedded in imported rich content still point at the old WordPress host
(`thangmaythuanphat.vn/wp-content/...`) and return HTTP 404. They are inside PortableText
bodies, not image fields, so they need fixing per entry in the admin editor.

## Verification after deploy

```bash
for p in / /gioi-thieu /san-pham /san-pham/thang-may-nhap-khau-franz \
         /tin-tuc /dich-vu /du-an /lien-he /360VR /sitemap.xml /robots.txt; do
  printf '%-44s %s\n' "$p" "$(curl -sS -o /dev/null -w '%{http_code}' "https://franzlift.vn$p")"
done
curl -sS -o /dev/null -w 'www: %{http_code} -> %{redirect_url}\n' https://www.franzlift.vn/
```

All paths returned 200 and `www` returned 308 → apex at last check.

## Byline rendering

Product bylines render as an inline editorial signature (`footer.fl-post-byline`) at the end
of the article body inside `section.fl-detail-body`, not as a detached card. Styles live in
`public/app.css` under the `INTEGRATED POST/PRODUCT BYLINE` heading.

The active byline is `Chuyên gia kỹ thuật FRANZ`, assigned as `primary_byline_id` on all 5
products with matching rows in `_emdash_content_bylines`.

There is an unresolved design question: whether the closing signature should be
right-aligned (Vietnamese editorial convention for a sign-off) or stay left-aligned. It is
currently left-aligned.

## Widget areas

Two EmDash widget areas exist and are rendered by the templates:

| Area | Rendered in | Notes |
| --- | --- | --- |
| `floating_buttons` | `src/layouts/Base.astro` | Above the hardcoded `.mobile-cta-bar` |
| `sidebar_inquiry` | *not currently rendered* | Area + widget exist in D1 only |

`sidebar_inquiry` was originally rendered in the product sidebar, but the product page was
reverted to the original full-width layout because the old site never had a sidebar inquiry
form. The area and its widget row remain in D1 — harmless, and available if a placement is
chosen later.

## Not a git repository

This directory is **not** under version control. There is no commit history and no remote.
Changes are unrecoverable if overwritten, so back up before destructive edits — as was done
for the DNS records above.
