---
name: draft_standup_brief
description: Draft standup update from project signals
output_format: md
inputs:
  audience:
    description: Audience name for the update header
    default: "Backend + Platform Team"
prompt: |
  Read the following files from the current folder:
  - tickets.md
  - prs.md
  - blockers.md
  - notes.md

  Task:
  - Draft a concise but specific standup update for ${input:audience}.
  - Use this structure:
    - Yesterday
    - Today
    - Risks / Blockers
    - Asks from team
  - Include concrete references to ticket IDs and PR IDs where possible.
  - Keep it scannable and useful for asynchronous standups.
  - Add a final 1-line "Executive Summary".
  - Save output as tmp/standup_brief.md.
---

Generates a practical standup update grounded in actual daily project artifacts.
