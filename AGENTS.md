## Cloudflare Deployment & CI/CD

- **Production Domain:** `https://franzlift.vn` (and `www.franzlift.vn`)
- **Worker Script:** `franzlift` (Cloudflare Worker runtime with assets in `public/`)
- **Cloudflare Account ID:** `7c47ea5e0254b9df48dc8df9c4eee6ed`
- **GitHub Repository:** `namnh2204/franzlift-worker` (branch: `main`)
- **Automated CI/CD:** `.github/workflows/deploy.yml`
  - Runs automatically on `git push` to `main` or manually via `workflow_dispatch`.
  - Uses `npm ci`, `npm run build`, and `npx wrangler deploy`.
  - GitHub Secrets configured: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
  - To deploy manually from terminal:
    ```bash
    CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." npx wrangler deploy
    ```

## Architecture

- Franzlift is a Node.js 22 application using Express and server-rendered EJS.
- Main runtime: `server.js`.
- Public template: `views/site.ejs`.
- Admin CMS: `/admin`, implemented by `views/admin.ejs` and `public/admin.js`.
- Browser behavior: `public/site.js`, Swiper, and AOS.
- Tailwind source: `src/input.css`; generated output: `public/app.css`.
- Content is stored in `data/content.json`; there is no database.
- Admin uploads are converted to responsive WebP files under `data/uploads/` and recorded in `data/uploads-map.json`.
- Build-time image metadata is stored in `data/image-map.json`.

## Live Deployment

- Domain: `https://franzlift.vn`.
- Server: `namnh@192.168.1.141`.
- Server project directory: `/home/namnh/workspace/franzlift`.
- Local workspace: `/home/namnh/franzlift-work`.
- Docker Compose service and container: `elevator-web`.
- Application port: `3000`, published as `3000:3000`.
- Compose uses the external Docker network `frontend_net`. It must already exist, and the reverse proxy must be connected to it.

## Data Persistence

- Compose bind-mounts server `./data` to container `/app/data`.
- The server's `data/` directory is authoritative and survives image rebuilds.
- Admin edits can change `data/content.json`, `data/uploads-map.json`, and files under `data/uploads/` at any time.
- Always pull live `data/` before making local changes or deploying. Pushing stale local data can destroy live admin edits and uploads.
- Preserve the freshly pulled `data/` when syncing the workspace back to the server.

## Build Commands

- Install exact dependencies: `npm ci`.
- Run locally: `npm start` or `npm run dev`.
- Rebuild CSS after changing `src/input.css`, Tailwind classes in EJS, or Tailwind classes in public JavaScript: `npm run build:css`.
- Complete production build validation: `npm run build`.
- The complete build optimizes images, writes `data/image-map.json`, builds `public/app.css`, and copies Swiper, AOS, and TinyMCE into `public/vendor/`.

## Safe Deployment

1. Pull current live data before editing:

   `rsync -az namnh@192.168.1.141:/home/namnh/workspace/franzlift/data/ /home/namnh/franzlift-work/data/`

2. Make and test changes in `/home/namnh/franzlift-work`.

3. If styles or Tailwind-scanned templates/scripts changed, run:

   `npm run build:css`

4. When appropriate, validate the complete build:

   `npm run build`

5. Sync the workspace to the server without local dependencies or Git metadata:

   `rsync -az --exclude 'node_modules/' --exclude '.git/' /home/namnh/franzlift-work/ namnh@192.168.1.141:/home/namnh/workspace/franzlift/`

6. Rebuild and restart the service:

   `ssh namnh@192.168.1.141 "cd /home/namnh/workspace/franzlift && docker compose up -d --build"`

7. Verify the container and application:

   `ssh namnh@192.168.1.141 "docker ps --filter name=elevator-web && curl -I -H 'X-Forwarded-Proto: https' http://127.0.0.1:3000/"`

- Direct HTTP requests may return a 301 redirect to `https://franzlift.vn`. The `X-Forwarded-Proto: https` header performs an application-level check through port 3000.
- If Compose reports a missing network, inspect it with `docker network inspect frontend_net`. Create it only if genuinely absent: `docker network create frontend_net`.

## Operational Cautions

- This local workspace is not currently a Git repository.
- There is currently no `.dockerignore`; do not sync `node_modules/` to the server.
- The application itself does not authenticate `/admin`, `POST /api/content`, or `POST /api/upload`. Confirm that the reverse proxy protects these paths before treating the CMS as secure.
- Compose has no healthcheck, so `docker ps` alone is not sufficient verification; always perform the HTTP check.
- The homepage consultation form currently navigates to `/lien-he` with a GET request and does not store or deliver submitted leads.
