---
name: draft_stakeholder_update
description: Draft stakeholder update brief
output_format: html
inputs:
  period:
    description: Reporting period label
    default: "Week of Mar 4-8"
  audience:
    description: Audience group
    default: "Leadership + Partners"
prompt: |
  Read the following files from the current folder:
  - highlights.md
  - metrics.md
  - risks.md
  - roadmap.md
  - notes.md

  Task:
  - Produce a one-page stakeholder update for ${input:period} tailored to ${input:audience}.
  - Build sections:
    - Executive Summary (3 bullet lines)
    - Progress Highlights
    - Metrics Snapshot
    - Risks + Mitigations
    - Next 2 Weeks
    - Asks / Decisions Needed
  - Include a small "Momentum" timeline with three milestones using inline SVG.
  - Use concise, non-technical language.

  Visual direction:
  - Polished briefing memo with strong hierarchy.
  - Use CSS variables under :root for palette and spacing.
  - Use a layered background and elevated cards.
  - Use a non-generic font stack (avoid Inter, Roboto, Arial, or system default stack).
  - Add subtle motion (card fade-in + timeline draw).
  - Ensure responsive layout (single-column under 900px).

  Technical constraints:
  - Use inline CSS and vanilla JavaScript only (no external CDN or network access).
  - Keep everything in one HTML file.
  - Save output as tmp/stakeholder_update.html.
---

Generates a polished stakeholder update memo from business-facing inputs.
