## Problem Statement

The current blog surface is visually busy and inconsistent across pages. The user wants all existing pages to read like a quiet, text-first personal blog.

## Solution

Apply a shared plain-text editorial shell to the homepage, listings, details, archive, books, albums, moments, projects, friends, about, and search surfaces. Use warm white or white backgrounds, black text, narrow readable measures, hairline rules, restrained navigation, and no decorative imagery by default. Preserve article body images and album content media.

## User Stories

1. As a reader, I want every page to share the same quiet navigation so I can move through the site without relearning the interface.
2. As a reader, I want article titles, dates, categories, and excerpts to be easy to scan.
3. As a reader, I want article detail pages to prioritize readable text and preserve inline media.
4. As a reader, I want albums to retain their photos while the surrounding chrome stays minimal.
5. As a site owner, I want the homepage to introduce the site and expose recent writing and content categories without a visual hero.
6. As a mobile reader, I want the same hierarchy to remain readable on a narrow screen.
7. As a keyboard user, I want navigation and content links to retain visible focus states.

## Implementation Decisions

- Share the editorial tokens and shell through the existing Astro layout and global styles.
- Keep route components and content fetching intact unless their presentation depends on the removed visual shell.
- Disable decorative banner/wallpaper presentation at the shell level.
- Use existing fonts where available and fall back to a system serif/sans pairing.
- Keep media inside article and album content available.

## Testing Decisions

- Run the Astro production build.
- Verify all existing HTML routes prerender successfully.
- Check the homepage, listing, detail, album, and about routes for the new shell markers.
- Check that no Three.js/GalaxyScene dependency is introduced.

## Out of Scope

- Rewriting Markdown content or API contracts.
- Removing article images, album images, audio, comments, or other content behavior.
- Adding a new animation system or visual editor.

## Further Notes

The shell is deliberately plain so later visual adjustments can happen through tokens and a small number of layout selectors.
