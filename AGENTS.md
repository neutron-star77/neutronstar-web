# Agent Instructions

This repository contains the Neutronstar blog frontend and its supporting API integration.

## Agent skills

### Issue tracker

Issues and specifications for this repository live in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default triage label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context project. Read `CONTEXT.md` and relevant ADRs under `docs/adr/`. See `docs/agents/domain.md`.

## Working rules

- Preserve existing Astro pages and current deployment behavior unless the task explicitly replaces them.
- Keep static content separate from dynamic API data and media storage.
- Run the relevant type-check, build, and diff checks after changes.
