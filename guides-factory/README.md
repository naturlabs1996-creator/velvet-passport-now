# Velvet Passport — Guides Factory

An independent content pipeline for Velvet Passport travel guides. This directory
is deliberately decoupled from the Paris NOW web app (`app/`, `public/`) — nothing
here is imported by, or affects, the live site. It exists to produce standalone
Markdown guides that can later be adapted for **Amazon Kindle**, **Etsy** (in the
spirit of the existing "Paris Uncovered" listing), and optionally sourced back
into NOW's route content.

## Pipeline

Each guide moves through three stages, left to right:

```
research/          verified/               guides/
raw notes     →     fact sheets       →     final Markdown guide
(candidates,        (cross-checked          (publish-ready, front
 sources,            places, sources         matter + prose, in the
 open questions)     cited, unverified       Velvet Passport voice)
                     items flagged)
```

- **`research/<slug>-research.md`** — candidate places found via web search, with
  source links and open questions. Nothing here is claimed as fact yet.
- **`verified/<slug>-factsheet.md`** — the cleaned, place-by-place fact sheet.
  Every entry either carries a citation from at least two independent sources,
  or is explicitly marked `UNVERIFIED` and excluded from the final guide.
  **No address, hour, or price is ever invented.** If it can't be confirmed, it
  doesn't ship.
- **`guides/<slug>.md`** — the polished, publish-ready guide, in Markdown with a
  YAML front matter block (`title`, `slug`, `theme`, `arrondissements`,
  `word_count`, `status`, `target_formats`).

## Status

`status: draft` in a guide's front matter means it has NOT been fact-checked by
a human against a current, on-the-ground source, and must not be sent to
Kindle/Etsy/production as-is. Treat every `draft` guide as a strong first pass
that still needs a human pass (opening hours and small addresses in Paris
change often) before publication.

## Current guides

| Slug | Theme | Source image (brand alignment) |
|---|---|---|
| `paris-covered` | Covered passages & galleries — rainy-day, shelter-first walks | `paris-covered-passage.webp` |
| `hidden-courtyards` | Secret courtyards & discreet passages | `paris-hidden-courtyard.webp` |
| `haussmann-after-dark` | Haussmannian streets at dusk / blue hour | `paris-haussmann-evening.webp` |
| `quiet-cafes` | Quiet cafés for a real pause | `paris-quiet-cafe.webp` |

These four themes were chosen because they already anchor the Paris NOW site's
visual identity (see `scenarioVisuals` in `app/page.tsx`) — the guides extend
the same "Velvet" sensibility (discreet, atmospheric, verified) into standalone
reading material, without depending on the app.
