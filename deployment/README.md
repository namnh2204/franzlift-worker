# Cloudflare deployment

This folder deploys Franzlift as a Cloudflare Worker using the existing root
`wrangler.jsonc` configuration:

- Worker and static assets: `franzlift`
- D1 database: `franzlift`
- R2 bucket: `franzlift-uploads`
- Cloudflare Images binding: `IMAGES`

## Credentials

`deployment/.env` contains the supplied Cloudflare API token and R2 S3 keys. It
is excluded by `deployment/.gitignore` and should remain local with mode `600`.
Do not put these values in `wrangler.jsonc`, source files, shell history, or a
commit. Rotate them in Cloudflare if they have been exposed outside a trusted
secret channel.

The Worker itself accesses R2 through the `UPLOADS` binding and does **not** need
S3 keys at runtime. The access-key pair is only for external S3-compatible tools.

## Deploy code

From the project root:

```bash
./deployment/deploy.sh
```

The script installs exact dependencies, runs the production build, applies D1
migrations, and deploys the Worker. It does not overwrite existing D1 content or
R2 objects.

## One-time data migration

Only run this after pulling the authoritative live `data/` directory as required
by `AGENTS.md`:

```bash
./deployment/migrate-live-data.sh
```

This imports local content into D1 and uploads local `data/uploads/` objects to
R2. Running it with stale data may overwrite current CMS content.

## Use the R2 S3 endpoint

For AWS CLI or another S3-compatible client:

```bash
source deployment/r2-env.sh
aws s3 ls "s3://$CLOUDFLARE_R2_BUCKET" --endpoint-url "$CLOUDFLARE_R2_ENDPOINT"
```

## Domain

After the first successful deployment, attach `franzlift.vn` to the Worker in
Cloudflare Workers & Pages, or add an appropriate `routes`/`custom_domains`
configuration after confirming the zone is present in this account. Protect
`/admin` and write endpoints (`POST /api/content`, `POST /api/upload`) with
Cloudflare Access before exposing the CMS publicly.
