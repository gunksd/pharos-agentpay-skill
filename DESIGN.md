# Design

## Theme

"Lighthouse keeper's night watch": deep blue-black night sea, warm lantern glow, ink-white text. Dark theme only (agents work at night; judges see the lantern shine). The B&W cat mascot sits in a white circular badge like a full moon.

## Color (OKLCH, dark)

| Token | Value | Role |
|---|---|---|
| `--night` | `oklch(0.17 0.022 235)` | body background |
| `--deck` | `oklch(0.21 0.024 235)` | raised surface (panels, rows) |
| `--rail` | `oklch(0.28 0.025 235)` | borders, dividers |
| `--ink` | `oklch(0.96 0.005 235)` | primary text |
| `--fog` | `oklch(0.76 0.015 235)` | secondary text (4.6:1 on deck) |
| `--lantern` | `oklch(0.82 0.155 80)` | accent: primary actions, Open status, focus |
| `--lantern-deep` | `oklch(0.70 0.14 70)` | accent hover / borders on light |
| `--sea` | `oklch(0.75 0.08 200)` | info, links, Claimed status |
| `--moss` | `oklch(0.78 0.12 150)` | success, Completed status |
| `--coral` | `oklch(0.72 0.14 25)` | danger, reject/dispute |
| `--violet` | `oklch(0.76 0.10 300)` | Submitted status |

Strategy: Restrained. Amber ≤10% of surface; carried by buttons, status dots, the lantern glow behind the hero mascot.

## Typography

- **UI/body**: `"Schibsted Grotesk"`, system-ui fallback. 400/500/700.
- **Display (hero h1 + section h2 only)**: `"Bricolage Grotesque"` 700/800, letter-spacing ≥ -0.03em.
- **Data/mono**: `"IBM Plex Mono"` for addresses, hashes, bounty amounts, JSON.
- Fixed rem scale, ratio ~1.2: 0.8 / 0.95 / 1.14 / 1.37 / 1.64 / 2.36 / 3.4rem.
- `text-wrap: balance` on headings.

## Components

- **Task rows**, not card grids: full-width rows on `--deck` with status dot + mono id, spec as the leading text, bounty right-aligned in mono.
- **Status vocabulary**: dot + label. Open=lantern, Claimed=sea, Submitted=violet, Completed=moss, Cancelled=fog.
- **Buttons**: solid lantern for the single primary action per view; ghost (rail border) for secondary; coral solid only for destructive confirm. Radius 10px. All states: hover/focus/active/disabled/loading.
- **Forms**: deck inputs with rail borders, lantern focus ring, labels above, mono for numeric/address fields.
- **Skeletons** (shimmering deck bars) for loading; empty states teach ("No open tasks. Post the first bounty.").
- **Toasts** bottom-right for tx lifecycle: pending (lantern pulse) → confirmed (moss, link to explorer) → failed (coral, reason).

## Motion

- 150-250ms ease-out-quart for state; 400ms glow bloom on the hero lantern (once, CSS-only).
- Task rows: 250ms background ease on hover; new rows fade-slide 12px.
- `prefers-reduced-motion`: all transitions to opacity-only or none.

## Layout

- Single page, max-width 1100px center column, 24px gutters.
- Header (56px): logo badge + wordmark left; network pill + connect button right.
- Hero: two-col (copy left, mascot badge right) collapsing to stacked at 720px.
- Board: filter tabs (All / Open / Mine) + rows; post form and reputation lookup as side-by-side panels under the board, stacking at 880px.
- Footer: contract + GitHub + hackathon links, mono.

## Assets

- `web/public/logo-ink.png`: transparent-bg ink logo (full lockup).
- `web/public/favicon.png`: cat crop.
- Mascot in hero: white circle badge, radial lantern-amber glow behind.
