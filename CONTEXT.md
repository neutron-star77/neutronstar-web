# 玄穹时序司

## Purpose

玄穹时序司是一个以浩瀚星海与时间流为视觉隐喻的个人内容系统。它承载文章、图书、相册说明和项目页，并通过动态 API 提供评论、点赞、播放列表和阅读进度。

## Architecture direction

- Static frontend: Astro with Markdown/MDX content built from Git.
- Interactive islands: small, page-scoped Svelte components; Three.js is loaded only by pages that need it.
- BFF/API: a separate typed API boundary for dynamic data.
- Persistence: SQLite initially, with a migration path to PostgreSQL.
- Media: NAS media directories or S3-compatible object storage.
- Delivery: Cloudflare Pages serves the static frontend at `neutronstar.fun`; NAS remains the origin for media and the BFF/API when needed.
- Dynamic database: Supabase is the online primary. NAS stores an asynchronously replicated backup/read replica through an outbox or scheduled export; both sides are not independent write primaries.

## Domain vocabulary

- **Content item**: a versioned Markdown/MDX entry such as an article, book, album note, or project page.
- **Dynamic record**: mutable user or interaction data stored through the API, such as a like, comment, playlist, or reading progress entry.
- **Media asset**: an image, audio file, 3D model, or texture stored outside the content repository.
- **Interactive island**: a client-side component hydrated only where interaction is needed.
- **Editorial shell**: the shared text-first page frame containing site navigation, content measure, metadata, and footer links.
- **Content media**: images or other media that belong to an article or album and remain visible inside the content itself.
- **Decorative media**: banners, wallpaper, hero scenes, and ornamental imagery that are hidden by the plain-text surface.
