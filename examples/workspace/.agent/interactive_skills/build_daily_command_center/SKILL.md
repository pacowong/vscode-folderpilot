---
name: build_daily_command_center
description: Build daily engineering command center
output_format: html
inputs:
  focus_theme:
    description: Team focus theme for today
    default: "Ship quality with fewer interrupts"
prompt: |
  Read the following files from the current folder:
  - tickets.md
  - prs.md
  - blockers.md
  - quality_signals.md
  - notes.md

  Task:
  - Create one self-contained HTML page named "Daily Engineering Command Center".
  - Extract and summarize the top priorities for today.
  - Build sections:
    - Hero header with date and focus theme: ${input:focus_theme}
    - KPI cards: in-progress tasks, blocked tasks, PRs awaiting review, quality risk score
    - "Now / Next / Later" priority board
    - "Risk Radar" 2x2 matrix (impact x urgency) using inline SVG
    - "Decision Log" list from notes.md

  Visual direction:
  - Design this like a premium operations dashboard, not a plain admin page.
  - Use CSS variables in :root for colors, spacing, radius, and shadow tokens.
  - Use a layered background (gradient + subtle pattern) and elevated cards.
  - Use a non-generic font stack (do not use Inter, Roboto, Arial, or system default stack).
  - Add purposeful motion: staggered card reveal and chart entrance animation.
  - Ensure mobile layout is clean and readable (single-column under 960px).

  Technical constraints:
  - Use inline CSS and vanilla JavaScript only (no external CDN or network access).
  - Use inline SVG for visualizations.
  - Keep everything in a single HTML file.
  - Save output as tmp/daily_command_center.html.
---

Generates a high-signal daily engineering dashboard from task and quality notes.
