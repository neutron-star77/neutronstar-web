# ADR-0001: Static Astro Frontend With BFF API

## Status

Accepted for the 玄穹时序司 redesign.

## Decision

Use Astro static generation for versioned Markdown/MDX content and deploy the generated `dist/client` directory to Cloudflare Pages at `neutronstar.fun`. Use small client islands for interactive features, including a page-scoped Three.js galaxy scene and a switchable reading mode. Put mutable interactions behind a separate typed BFF/API. Supabase is the online primary database; NAS receives asynchronous backups/replication and is not a second independent write primary. Store media in NAS directories or Cloudflare R2/object storage and serve them independently from content pages.

## Consequences

- Content pages remain cacheable static files and do not require a runtime request to render.
- Dynamic features can evolve without adding a client runtime to every page.
- The API and media services need explicit deployment and authentication boundaries.
- Content changes require a build and publish step.
- Supabase-to-NAS replication must be idempotent and observable; a failed backup must not make the public API write appear successful if durability requirements are not met.
