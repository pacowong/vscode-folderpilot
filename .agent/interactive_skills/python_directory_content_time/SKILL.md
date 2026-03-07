---
name: python_directory_content_time
description: List directory files and modified times
output_format: md
prompt: |
  List all files in the current folder (excluding .agent/, tmp/, and system files like .DS_Store).
  For each file, get its modification time (stat mtime).
  
  Task:
  - Produce a markdown table with columns: File, Modified Time (ISO 8601).
  - List each file and its modification timestamp.
  - Sort the table by modified time (newest first).
  - Use ISO 8601 format for timestamps (e.g., 2026-03-07T14:30:00+00:00).
  - Add a one-line summary naming the most recently modified file.
  - Save output as tmp/python_directory_content_time.md.
---

Generates a concise directory timestamp report from a manifest file.
