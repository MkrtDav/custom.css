# stakeholders.cc

Monorepo for stakeholders.cc and related projects.

```
apps/
  web/   stakeholders.cc + italy.stakeholders.cc (one Worker, static files in public/, italy files in public/italy/)
  api/   Back end (Cloudflare Worker) -> api.stakeholders.cc
docs/    Deployment and architecture notes
custom.css   Original stylesheet (kept at root; may be linked by URL)
```

## Workflow
- `main` is live. Never commit directly; work on branches and merge via PR.
- Every branch gets a preview deployment once Cloudflare is connected.

## Domains (planned)
- `stakeholders.cc`, `www.stakeholders.cc` -> apps/web
- `api.stakeholders.cc` -> apps/api
- one subdomain per additional project

See `docs/DEPLOY.md`.
