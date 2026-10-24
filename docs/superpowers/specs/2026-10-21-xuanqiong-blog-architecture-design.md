# 玄穹时序司博客架构设计

## Goal

Redesign the blog around a fast static frontend while keeping a clean extension path for articles, books, album notes, project pages, comments, likes, playlists, reading progress, media, and Three.js experiences.

## Proposed system

```text
Git Markdown/MDX -> Astro build -> dist/client -> Cloudflare Pages (neutronstar.fun)
                                             |
                                             +-- page-scoped Svelte/Three.js islands

Browser /api/* -> BFF -> Supabase primary database
                         |
                         +-> idempotent outbox/export -> NAS backup/replica
NAS or Cloudflare R2 -> images, audio, models, textures
```

## Content model

Versioned content collections:

- `posts`: articles and long-form notes.
- `books`: book records and reading notes.
- `albums`: album descriptions and image metadata.
- `projects`: project pages.

Each entry has a stable slug, title, summary, date, tags, cover media reference, and Markdown/MDX body. Content is built from Git and is never mutated by browser code.

## Dynamic model

The BFF owns API contracts for comments, likes, playlists, and reading progress. Supabase is the online persistence layer. NAS receives an asynchronous backup/read replica through an idempotent outbox or scheduled export. The browser receives typed JSON and never reads Supabase, NAS directories, or replication credentials directly.

## Media model

Images, audio, Three.js models, and textures are external media assets referenced by stable URLs. The home page loads no Three.js bundle unless the galaxy scene is enabled; other routes load gallery, reader, or music islands only when needed.

## Homepage direction

The homepage is a full-screen universe explorer rather than the existing blog grid. It presents “玄穹时序司” and the subtitle “玄穹浩渺，时序奔流。” over a Three.js scene with two authored procedural destinations: the Milky Way and Andromeda. The scene supports drag rotation, wheel zoom, hover ripples, focus targets, and a compact HUD for articles, books, albums, and projects. A visible mode switch changes to a pure reading mode derived from the Regular UI reference: ink-green/paper backgrounds, solid cards, hairline borders, green brand color, and amber emphasis.

Switching between the Milky Way and Andromeda uses a time-travel transition: the camera pulls away from the current galaxy, star streaks and a central warp ring appear, the target palette and particle field crossfade, and the camera settles into the new galaxy. Reduced-motion mode replaces the warp with a short opacity/color transition. The scene is decorative and interactive but must yield to readable HTML content and remain optional on low-power/mobile devices.

## First implementation slice

1. Establish the static content collections and route boundaries.
2. Add the BFF contract types and a health endpoint without coupling pages to Supabase.
3. Build a lazy Three.js Milky Way explorer island with pointer interaction, object-directory anchors, and a static reading-mode fallback.
4. Add static routes for posts, books, albums, projects, and music.
5. Add API-backed UI for one dynamic behavior, preferably likes or reading progress.
6. Add an idempotent Supabase-to-NAS backup job and replication health visibility.

## Non-goals for the first slice

- Replacing all existing content in one migration.
- Building a full CMS before the static content model is proven.
- Loading Three.js globally on every page.
- Exposing SQLite or NAS paths to the browser.
