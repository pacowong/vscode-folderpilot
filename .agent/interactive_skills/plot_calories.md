---
name: plot_calories
description: Build calories dashboard
output_format: html
prompt: |
  Read the following files from the current folder:
  - breakfast.md
  - lunch.md
  - dinner.md

  Task:
  - Estimate total calories per meal.
  - Build a single self-contained HTML dashboard with:
    - One bar chart: calories by meal.
    - One donut chart: calorie share by meal.
    - A compact table listing meal totals and grand total.
    - A short "Key Insights" section with 3 bullet points.

  Visual design requirements:
  - Create a polished editorial look, not a plain default dashboard.
  - Use CSS variables under :root for color palette, spacing, shadows, radii.
  - Use a layered background (gradient plus subtle texture), not a flat solid color.
  - Use a non-generic type stack (do not use Inter, Roboto, Arial, or system default stack).
  - Use clear visual hierarchy: hero title, stat cards, chart cards, table card.
  - Add tasteful motion: staggered fade-in for cards and bar growth animation on load.

  Data-viz requirements:
  - Use inline SVG for both charts (no external chart library).
  - Add value labels to bars and percentage labels to donut segments.
  - Keep chart colors color-blind-friendly and high contrast.

  Technical constraints:
  - Use inline CSS and vanilla JavaScript only (no external CDN or network access).
  - Ensure responsive layout for desktop and mobile (single-column under 900px).
  - Keep output self-contained in one HTML file.

  - Title: "Calories Dashboard"
  - Save output as tmp/calories_dashboard.html.
---

Generates one HTML dashboard containing bar and pie charts from meal notes.
