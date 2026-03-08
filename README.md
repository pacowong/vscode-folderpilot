# FolderPilot

![FolderPilot Icon](https://raw.githubusercontent.com/pacowong/vscode-folderpilot/master/images/folderpilot_icon.png)

FolderPilot is a VS Code extension that runs Copilot-powered skills against a folder. Skills live in workspace-level `.agent/interactive_skills/<skill>/SKILL.md` files and are enabled per folder with `.agent/interactive_skills.yaml`. Outputs are written into the folder's `tmp/` directory and opened in VS Code.

## Features

- Explorer view to discover skill-enabled folders.
- One-click skill execution with input prompts.
- HTML, Markdown, PNG, and JPG preview support.
- Per-skill cache to avoid rerunning unchanged inputs.

## Requirements

- VS Code 1.107+
- GitHub Copilot extension installed and signed in (active subscription)
- For development: Node.js 22 and npm

## Quick start (example workspace)

1. `npm install`
2. `npm run watch`
3. Press `F5` to launch the Extension Host
4. In the Extension Host, open `agent_plan/examples/workspace`
5. Open the "FolderPilot" view in Explorer and run a skill

### Example: Stakeholder Update

![FolderPilot Stakeholder Update Demo](https://raw.githubusercontent.com/pacowong/vscode-folderpilot/master/demo.gif)

Open the `stakeholder_update/` folder, run the **Draft Stakeholder Update** skill, and get a polished report in seconds.

## Folder and skill layout

```
workspace/
  .agent/
    interactive_skills/
      <skill>/
        SKILL.md
  <content-folder>/
    .agent/
      interactive_skills.yaml
      cache/
    tmp/
```

## Skill file format

Skill files are Markdown with YAML frontmatter. Required fields: `name`, `description`, `prompt`. Optional: `inputs`, `output_format`.

```
---
name: build_daily_command_center
description: Build daily command center
output_format: html
inputs:
  timezone:
    description: Timezone label
    default: "PT"
prompt: |
  Summarize the folder content into a dashboard.
  Use ${input:timezone} when listing dates.
---
```

The extension asks Copilot to return a JSON object with outputs, for example:

```
{"outputs":[{"path":"tmp/build_daily_command_center.html","type":"html","content":"..."}]}
```

Keep outputs under `tmp/` and return content directly; the extension does not execute scripts.

## Commands

- FolderPilot: Run Skill
- FolderPilot: Clear Skill Cache
- FolderPilot: Refresh

## Caching

Cached outputs are stored under `<folder>/.agent/cache/` and keyed by skill file content, input values, and input file mtimes.

## Development

- `npm run compile` to build once
- `npm run watch` to build on change
- `npm run lint` to lint
- `npm test` to run tests
