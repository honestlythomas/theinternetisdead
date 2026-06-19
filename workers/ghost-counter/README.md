# Ghost Counter Worker

This folder contains the repo-side source for the Cloudflare Worker named `theinternetisdead-presence`.

Cloudflare is not connected to GitHub for this project. The repo is the source of truth, and deployment is manual from a local terminal with Wrangler.

## Deploy

From the repo root in PowerShell:

```powershell
cd workers/ghost-counter
npm install
npx wrangler login
npx wrangler deploy
```

## Route

After deployment, add the route in the Cloudflare dashboard:

- Domain: `theinternetisdead.org`
- Open `Workers Routes` and choose `Add route`
- Route: `theinternetisdead.org/api/ghosts-online*`
- Worker: `theinternetisdead-presence`

The site connects to `/api/ghosts-online` with a WebSocket. Normal HTTP requests to that path return JSON explaining that a WebSocket upgrade is required.
