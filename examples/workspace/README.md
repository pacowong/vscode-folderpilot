# FolderPilot Example Workspace

This folder is a runnable set of workflows for FolderPilot. Open it in the Extension Host and run skills from the FolderPilot view.

## Quick start

1. Open this folder in the Extension Host.
2. In Explorer, open the FolderPilot view.
3. Pick a folder and run a skill. Outputs appear in each folder's `tmp/` directory.

## Workspace layout

```
workspace/
├── .agent/
│   └── interactive_skills/
│       ├── build_daily_command_center/
│       │   └── SKILL.md
│       ├── draft_standup_brief/
│       │   └── SKILL.md
│       ├── plan_focus_blocks/
│       │   └── SKILL.md
│       ├── draft_stakeholder_update/
│       │   └── SKILL.md
│       ├── build_incident_radar/
│       │   └── SKILL.md
│       ├── show_latest_image/
│       │   └── SKILL.md
│       ├── python_directory_content_time/
│       │   └── SKILL.md
│       └── draft_shift_handoff/
│           └── SKILL.md
├── engineering_daily/
│   ├── .agent/
│   │   └── interactive_skills.yaml
│   ├── tickets.md
│   ├── prs.md
│   ├── blockers.md
│   ├── quality_signals.md
│   └── notes.md
├── oncall_triage/
│   ├── .agent/
│   │   └── interactive_skills.yaml
│   ├── alerts.md
│   ├── services.md
│   ├── logs_excerpt.log
│   └── runbook.md
├── stakeholder_update/
│   ├── .agent/
│   │   └── interactive_skills.yaml
│   ├── highlights.md
│   ├── metrics.md
│   ├── risks.md
│   ├── roadmap.md
│   └── notes.md
├── image_review/
│   ├── .agent/
│   │   └── interactive_skills.yaml
│   ├── hero.png
│   ├── flow.png
│   ├── badge.jpg
│   └── image_manifest.md
├── time_check/
│   ├── .agent/
│   │   └── interactive_skills.yaml
│   ├── meeting_notes_2026-03-05_platform_sync.md
│   ├── meeting_notes_2026-03-06_product_review.md
│   ├── meeting_notes_2026-03-06_incident_postmortem.md
│   ├── meeting_notes_2026-03-07_partner_onboarding.md
│   ├── meeting_notes_2026-03-07_status_checkin.md
│   ├── summary.txt
│   └── notes.md
└── README.md
```

## Daily High-Leverage Case: Engineering Daily Ops

Folder: `workspace/engineering_daily/`

Enabled skills:
```yaml
- build_daily_command_center
- draft_standup_brief
- plan_focus_blocks
```

Why this is high impact:
- Replaces manual standup prep, PR scanning, and blocker triage
- Produces actionable outputs in minutes instead of context-switching across docs/tools
- Creates a repeatable daily operating rhythm for teams

## Secondary Case: On-Call Triage

Folder: `workspace/oncall_triage/`

Enabled skills:
```yaml
- build_incident_radar
- draft_shift_handoff
```

Why this is useful:
- Converts noisy alerts and logs into a clear incident board
- Standardizes handoff quality between shifts

## Non-Technical Case: Stakeholder Update

Folder: `workspace/stakeholder_update/`

Enabled skills:
```yaml
- draft_stakeholder_update
```

Why this is useful:
- Produces a polished weekly update without juggling multiple docs
- Keeps leadership updates consistent and easy to scan

## Non-Technical Case: Image Review

Folder: `workspace/image_review/`

Enabled skills:
```yaml
- show_latest_image
```

Why this is useful:
- Quickly highlights the latest visual for review
- Works for design, marketing, or content teams

## Utility Case: Directory Content Time

Folder: `workspace/time_check/`

Enabled skills:
```yaml
- python_directory_content_time
```

Why this is useful:
- Produces a clean, sortable list of files and modified times
- Useful for quick content audits and handoff prep
- Runs directly on folder contents—no manifest needed

## Core Concept

- **Workspace Skills**: Defined once in `.agent/interactive_skills/<skill>/SKILL.md`
- **Folder Declarations**: Each folder enables only the skills relevant to its workflow via `.agent/interactive_skills.yaml`

This architecture gives teams:
- Reusable skill templates
- Workflow-specific context per folder
- Faster daily execution with less cognitive overhead
