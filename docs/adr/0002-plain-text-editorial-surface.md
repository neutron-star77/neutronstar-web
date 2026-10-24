# ADR-0002: Plain-Text Editorial Surface

## Status

Accepted

## Context

The existing pages combine a visual theme, banner imagery, cards, and page-specific controls. The desired direction is a quiet blog surface similar to biji.io: readable text first, narrow measure, warm white paper, black text, and restrained rules. The site still needs to expose every existing content route and must keep article body media and album media available.

## Decision

Use one shared editorial shell for all HTML pages. The shell provides a compact text navigation, a narrow content column, warm-white/black tokens, hairline dividers, and responsive typography. Decorative banners, wallpaper textures, animated hero scenes, and ornamental cards are disabled by default. Content media rendered inside article bodies and album pages remains available.

## Consequences

- Visual changes are concentrated in the shared layout and global style layer.
- Routes and content contracts remain unchanged.
- Existing interactive actions remain available but are presented as text links or minimal controls.
- A future visual theme can be added as a separate shell without changing content routes.
