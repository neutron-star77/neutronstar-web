# Cloudflare Pages Deployment

## Frontend

- Project root: `F:\AI\projects\Neutronstar\web`
- Build command: `pnpm build:pages`
- Output directory: `dist/client`
- Node version: `22.13` or newer
- Public site: `https://neutronstar.fun/`

The Pages project serves only the generated Astro frontend. Markdown/MDX content is built from Git. Three.js is bundled into the page-scoped galaxy island and is not loaded by routes that do not render that island.

## Dynamic API

The browser calls `/api/*` through a separate BFF. The BFF owns Supabase credentials and must not be implemented with a public Supabase service-role key in the frontend. The static Pages deployment should proxy `/api/*` to the BFF through a controlled origin or use a Pages Function as a thin gateway.

## Data durability

Supabase is the online primary for comments, likes, playlists, and reading progress. A NAS job pulls an idempotent outbox/export on a schedule and records the last successful cursor. NAS is a backup/read replica, not an independent write primary.

## Media

Images, audio, models, and textures use stable media URLs from NAS or Cloudflare R2. Media credentials remain server-side; public read URLs may be exposed only for assets intended to be public.

## Verification

After a Pages deployment, verify:

1. `/` returns the static homepage and the `/_astro/*` assets are reachable.
2. `/prototype/galaxy/` is reachable before the prototype is removed.
3. `/api/health` is served by the BFF and does not expose database credentials.
4. Both `galaxy` and `reading` modes work after a hard refresh.
