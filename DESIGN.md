# Vanya BuildTrack — Design References

## Purpose

This document captures the supplied UI screenshots as the starting point for Vanya BuildTrack's application design. Treat them as layout and visual references, not as a final specification of copy or production content.

New layouts and color combinations may be added later. Use these documented observations when comparing or refining proposals, and update this document when a design direction is agreed.

## Current layout references

The layout guidance below is based on the screenshots supplied during project setup. The screenshots are not stored in the repository; this document captures the relevant design observations. The most recently supplied dashboard reference is the source of truth for the selected color direction and supersedes the earlier purple-accent reference.

### Public landing page

- Simple top navigation with the product identity and a sign-in action.
- Centered hero, prominent headline, short supporting message, and one primary call to action.
- Feature highlights begin below the first-screen hero.

### Sign-in page

- Focused, centered authentication form with product identity above it.
- Role selection, email, password, and a clear primary sign-in action.
- Keep authentication usable on narrow screens and avoid exposing real credentials in the UI.

### Owner dashboard

- Persistent left navigation with the current user's identity and role.
- Main workspace starts with a page title and short description.
- Summary cards provide a quick overview; a larger chart or report can follow.
- Include clear active-navigation, currency, and report-label treatments.

### Site engineer dashboard

- Reuse the authenticated dashboard shell, tailored to the engineer's assigned sites.
- Prioritize site-level summary information and field tasks.
- Show only sections relevant to the engineer's role and assignments.

### Client projects

- Reuse the authenticated shell with a client-specific, simpler navigation.
- Present projects in a readable table with site, payment, status, and detail actions.
- Make payment state and project details easy to scan.

## Layout principles to carry forward

- Use a consistent application shell across authenticated portals: product navigation, user identity, role-aware menu, and sign-out.
- Keep the owner, site engineer, and client navigation appropriate to each role while preserving shared components and interaction patterns.
- Give each page a clear title and concise context before its main content.
- Use cards for at-a-glance summaries and tables or lists for records users need to compare.
- Make status, progress, payment, and approval states legible without relying on color alone.
- Prefer practical, information-dense layouts for project operations; keep public and authentication pages focused.
- Adapt navigation, tables, forms, and actions for mobile use as well as desktop.
- Provide visible loading, empty, error, and success states for data-driven views.

## Color and visual direction

Every user can select a personal palette from the shared top bar or their **Settings** page (owners find it under **Settings & Backup**). Each selection is saved in that user's browser and does not change the palette for other users. New users default to Construction orange.

| Option | Color direction | Primary | Supporting colors |
| --- | --- | --- | --- |
| Current · Terracotta | Existing warm construction palette | `#B65B38` | `#2F241F`, `#F7F2EE` |
| Default · Construction orange | Default vivid orange palette | `#E94F0B` | `#211E1C`, `#FAF9F7` |
| Reference · Evergreen | Forest green, cream, and lime inspired by the supplied reference image | `#164A3A` | `#FAF9F2`, `#D9ED70` |

Construction orange is the default for new users. Keep semantic status colors distinct from the brand palette: use accessible success, warning, and error colors, and never use color as the only indicator of meaning. Check text and control contrast, especially for text on accent and soft-accent surfaces.

Each palette overrides equivalent accent, text, surface, and border tokens.

| Token | Color | Intended use |
| --- | --- | --- |
| Primary orange | `#E94F0B` | Primary actions, active navigation, brand mark, progress and revenue highlights |
| Deep orange | `#C9430B` | Hover/pressed states and active indicators on light surfaces |
| Soft orange | `#FFF0DC` | Subtle icon backgrounds, selected states, and supporting highlights |
| Charcoal | `#211E1C` | Strong emphasis surfaces and secondary chart series |
| Graphite | `#494541` | Primary text and secondary chart series |
| Warm gray | `#77736F` | Muted text and supporting labels |
| Page background | `#FAF9F7` | Main application canvas |
| White | `#FFFFFF` | Cards, navigation, forms, and elevated content surfaces |
| Border | `#E9E6E2` | Card outlines, separators, and table rules |

Use orange and charcoal for the main financial chart series, following the reference. Keep semantic states distinct from the brand palette: use accessible success, warning, and error colors, and never use color as the only indicator of meaning. Check text and control contrast, especially for text on orange and soft-orange surfaces.

## Future design updates

When new layouts or palette options are supplied:

1. Review the supplied reference images and capture relevant layout observations here; images do not need to be committed to the repository.
2. Record the screen or portal represented by each new reference.
3. Note the agreed layout and color direction here, distinguishing confirmed decisions from proposals. Preserve the selected orange, charcoal, and off-white palette unless the product owner explicitly chooses a replacement.
4. Reflect approved tokens and components in the frontend implementation only after the design direction is confirmed.
