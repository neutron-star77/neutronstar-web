# ADR-0003: Hybrid Astro, BFF, and Vue Islands Architecture

## Status

Accepted

## Context

The project needs static-page speed and SEO, while also requiring Nebula-like runtime features: comments, likes, albums, books/EPUB, reading progress, playlists, media delivery, and future expansion. A full Vue SPA would simplify stateful features but would make every page depend on a client runtime and API response. A pure Astro approach keeps fast HTML but makes complex interactive features fragmented.

## Decision

Use Astro for static content and route-level HTML, a typed BFF as the only browser-facing dynamic API, and Vue islands for page-scoped stateful features. Supabase remains the online dynamic-data primary. NAS stores media and asynchronous backups; R2 may cache public media. The public frontend remains deployed to Cloudflare Pages.

## Consequences

- Static article and content pages keep fast HTML, SEO, and CDN caching.
- Complex features can use Vue state without turning the entire blog into a SPA.
- Every dynamic feature needs an explicit BFF contract and loading/error states.
- Cross-layer contracts become an important handoff artifact.
- Nebula visual and product behavior can be adopted incrementally without copying its backend wholesale.
