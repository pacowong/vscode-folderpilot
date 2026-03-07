---
name: render_mermaid
description: Generate Mermaid style variants (HTML)
output_format: html
prompt: |
  Read system.md in the current folder. It contains a Mermaid code block.

  Task:
  - Extract the Mermaid diagram from the code block and keep the flow unchanged.
  - Produce three style variants using Mermaid init directives.
  - Output a single HTML file with three Mermaid diagrams rendered on the page.
  - Add a top-level heading "System Flow Styles".
  - Add a short subheading for each style.
  - Use Mermaid in the browser (include a script tag) and render on load.

  Page design requirements:
  - Build a visually strong gallery layout with three style cards.
  - Use CSS variables for palette and spacing.
  - Use a layered background and subtle card shadows.
  - Use a non-generic font stack (do not use Inter, Roboto, Arial, or system default stack).
  - Add small entrance animations for cards on page load.
  - Ensure mobile layout stacks cards cleanly.

  Styles (use Mermaid init directives like %%{init: {...}}%% at the top of each block):
  1) Newspaper
     - theme: base
     - themeVariables:
       primaryColor: "#F5E6CC"
       primaryTextColor: "#2B1F12"
       primaryBorderColor: "#6B4F36"
       lineColor: "#6B4F36"
       secondaryColor: "#FAF3E6"
       tertiaryColor: "#EBD8BD"
       fontFamily: "Georgia, Times New Roman, serif"
  2) Ocean Blueprint
     - theme: base
     - themeVariables:
       primaryColor: "#D9F0FF"
       primaryTextColor: "#0E2A3A"
       primaryBorderColor: "#2C6E91"
       lineColor: "#2C6E91"
       secondaryColor: "#EEF8FF"
       tertiaryColor: "#C6E7FA"
       fontFamily: "Trebuchet MS, Verdana, sans-serif"
  3) Terracotta
     - theme: base
     - themeVariables:
       primaryColor: "#F4C7A1"
       primaryTextColor: "#4A2512"
       primaryBorderColor: "#B85C38"
       lineColor: "#B85C38"
       secondaryColor: "#FDEEE3"
       tertiaryColor: "#F7D6BE"
       fontFamily: "Palatino Linotype, Book Antiqua, serif"

  Save output to tmp/mermaid_styles.html.
---

Generates multiple Mermaid style variants from system.md as HTML.
