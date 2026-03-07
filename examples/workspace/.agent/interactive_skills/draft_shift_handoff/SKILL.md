---
name: draft_shift_handoff
description: Draft on-call shift handoff note
output_format: md
inputs:
  next_shift:
    description: Team or person receiving handoff
    default: "APAC On-call"
prompt: |
  Read the following files from the current folder:
  - alerts.md
  - logs_excerpt.log
  - services.md
  - runbook.md

  Task:
  - Draft a handoff note for ${input:next_shift} with sections:
    - Current Status
    - Timeline So Far
    - Suspected Root Cause(s)
    - What Was Tried
    - What To Do Next (first 3 actions)
    - Escalation Triggers
  - Keep it concise, operationally clear, and time-ordered.
  - Save output as tmp/shift_handoff.md.
---

Generates a structured, action-oriented on-call handoff note.
