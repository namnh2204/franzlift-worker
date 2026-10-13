# Thang Máy Nhập Khẩu Franz — EmDash application

Full Astro/EmDash migration of the Franz public website. It preserves the original page
structure, Vietnamese routes, responsive layouts, Swiper carousels, AOS effects,
product/project galleries, SEO metadata, structured data, and mobile navigation/CTA behavior.

- **`AGENTS.md`** — architecture, content model, routes, styling, and rules.
- **`OPERATIONS.md`** — Cloudflare resources, domain binding, and open items. **Read before
  deploying or touching auth.**

## Production and free-tier design

This application is the production origin for `franzlift.vn` and `www.franzlift.vn`; the
`www` hostname redirects permanently (308) to the apex domain. It has no `worker_loaders`
binding, so it stays on the free tier. It uses dedicated resources:

- Worker: `franzlift-emdash`
- D1: `franzlift-emdash` (`3096b02d-4413-4982-9926-969b959f1ef0`)
- R2: `franzlift-emdash-media`
- KV sessions: `01fc2789cbb14300a212ddc1b906dd80`

These are **strictly separate** from HAS Lift, which runs on its own `haslift-emdash` Worker,
D1, and R2. Never cross-wire the bindings between the two projects.

The legacy `franzlift` Worker is still deployed but owns no routes or domains and serves no
traffic. See `OPERATIONS.md` for the pending delete/keep decision.

## Content model

`seed/seed.json` defines and seeds ten collections:

- `site_data` — global/page/homepage configuration as discrete typed fields (singleton, slug `config`)
- `products` — Sản phẩm, with PortableText bodies, ordered galleries, and bylines
- `posts` — Tin tức
- `projects`, `services`, `tech_items`, `vr_cabins`, `hero_slides`, `reasons`, `stats`

## Administration

Admin panel: `https://franzlift-emdash.thuanphat.workers.dev/_emdash/admin`

EmDash native **passkey** authentication (WebAuthn). The registered passkey is scoped to the
`workers.dev` origin, so admin login on `franzlift.vn` does not yet work — see the passkey
open item in `OPERATIONS.md` for the migration procedure. Because no outbound email provider
is configured, invitations return a shareable link to send manually.

## Commands

```bash
pnpm dev          # Astro dev server (admin at http://localhost:4321/_emdash/admin)
pnpm build        # astro build
pnpm deploy       # astro build && wrangler deploy
pnpm typecheck    # astro check
```

Deploy credentials come from
`/home/namnh/workspace/thuanphat/franzlift-worker/deployment/.env`.

## Deployment

`wrangler deploy` updates the production `franzlift-emdash` Worker and its `franzlift.vn` and
`www.franzlift.vn` custom domains. Public pages are served on the apex; `www` redirects to it.
Keep the dedicated D1, R2, and KV bindings unchanged during deployment.

Custom domains are declared as `routes` in `wrangler.jsonc` with `custom_domain: true`.
Cloudflare manages the proxied `AAAA 100::` DNS records — do not add manual `A`/`AAAA`
records for these hostnames.

Post-deploy smoke test is in `OPERATIONS.md`.

## Version control

This directory is **not** a git repository. There is no history and no remote, so back up
before destructive edits.
