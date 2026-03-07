---
name: build_incident_radar
description: Build incident radar board
output_format: html
prompt: |
  Read the following files from the current folder:
  - alerts.md
  - logs_excerpt.log
  - services.md
  - runbook.md

  Task:
  - Create one self-contained HTML page titled "Incident Radar".
  - Summarize current incident context and suspected blast radius.
  - Build sections:
    - Active alerts timeline
    - Impacted services map (card-based dependency view)
    - Top error signatures from logs_excerpt.log
    - Recommended first 5 actions from runbook.md
    - Handoff readiness status (green/yellow/red)

  Visual direction:
  - Build a clean mission-control style interface without relying on dark-only styling.
  - Use CSS variables and a cohesive palette with strong severity color semantics.
  - Use inline SVG for timeline and severity bars.
  - Add subtle reveal/transition animations for panels.
  - Ensure responsive behavior for mobile and laptop widths.

  Technical constraints:
  - Use inline CSS and vanilla JavaScript only (no external CDN or network access).
  - Keep everything in one HTML file.
  - Save output as tmp/incident_radar.html.
---

Generates an incident command board from alerts, logs, and runbook context.
