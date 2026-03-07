---
name: show_latest_image
description: Show most recently edited image
output_format: html
prompt: |
  Read image_manifest.md in the current folder. It lists image file names with timestamps and captions.
  The image files live in the same folder and should be referenced by their file names.

  Task:
  - Identify the most recently edited image from the manifest.
  - Build a single self-contained HTML page with:
    - A hero panel showing the latest image
    - File name, last edited timestamp, and a short caption
    - A small "Other Images" strip showing remaining items as thumbnails
  - If the image content is not accessible, render a clean placeholder card using the file name.

  Visual direction:
  - Make it feel like a modern creative review page, not a plain file list.
  - Use CSS variables for palette, spacing, and shadow tokens.
  - Use a layered background and elevated cards.
  - Use a non-generic font stack (avoid Inter, Roboto, Arial, or system default stack).
  - Add subtle motion (fade-in + image focus glow).
  - Ensure responsive layout (single-column under 900px).

  Technical constraints:
  - Use inline CSS and vanilla JavaScript only (no external CDN or network access).
  - Keep everything in one HTML file.
  - Save output as tmp/latest_image.html.
---

Generates a polished single-page view of the most recently edited image.
