# Deployment

Hosting: Cloudflare (domain stakeholders.cc is registered there).

- Web: Cloudflare Pages, root directory `apps/web`, no build command, output `/`.
- API: `cd apps/api && npx wrangler deploy` (route `api.stakeholders.cc/*`).
- Secrets: never commit. Use `wrangler secret put` or the Cloudflare dashboard.
- Database/storage when needed: D1, KV, R2 (bindings go in `apps/api/wrangler.toml`).

Status: scaffold only; not deployed yet.
