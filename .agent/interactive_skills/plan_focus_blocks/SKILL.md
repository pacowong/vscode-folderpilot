---
name: plan_focus_blocks
description: Plan deep-work blocks for today
output_format: md
inputs:
  workday_start:
    description: Start time for planning window
    default: "09:00"
  workday_end:
    description: End time for planning window
    default: "18:00"
prompt: |
  Read the following files from the current folder:
  - tickets.md
  - blockers.md
  - quality_signals.md
  - notes.md

  Task:
  - Build a focused execution plan between ${input:workday_start} and ${input:workday_end}.
  - Create:
    - Three deep-work blocks (60-120 min each)
    - Two shallow-work/admin blocks
    - One contingency block for interruptions
  - For each block, include objective, expected output, and success criteria.
  - Add a "Do Not Start Today" list to avoid context-switching.
  - Save output as tmp/focus_blocks.md.
---

Generates a realistic daily focus plan with guardrails against context-switching.
