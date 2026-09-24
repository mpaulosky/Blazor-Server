---
post_title: "chore: add Sandcastle agent setup"
author1: mpaulosky
post_slug: "v0.0.9-pr-3"
microsoft_alias: n/a
featured_image: ""
categories:
  - engineering
tags:
  - release:v0.0.9
  - automation
ai_note: "Backfilled for issue #21 from the PR title/body in the release automation format"
summary: "Release notes seed for v0.0.9 from PR #3."
post_date: "2026-09-23"
---
## chore: add Sandcastle agent setup

- **Release tag:** `v0.0.9`
- **Source PR:** [#3](https://github.com/mpaulosky/Blazor-Server/pull/3)

### PR description

## Summary

Adds the [Sandcastle](https://www.npmjs.com/package/@ai-hero/sandcastle) setup for running Claude Code agents in a container.

- `.sandcastle/Dockerfile`: container image with the Claude Code CLI
- `.sandcastle/main.mts`: orchestration for the plan → implement → review → merge agents, all on `claude-opus-5-5`
- `.sandcastle/*-prompt.md` and `CODING_STANDARDS.md`: agent prompts and the standards they follow
- `package.json` / `package-lock.json`: add the `@ai-hero/sandcastle` dev dependency

## Secrets

Tokens (`CLAUDE_CODE_OAUTH_TOKEN`, `GH_TOKEN`) go in `.sandcastle/.env`, which `.sandcastle/.gitignore` ignores. `.env.example` is a blank template. To set up locally:

```bash
cp .sandcastle/.env.example .sandcastle/.env
# fill in the token from `claude setup-token` and a GitHub fine-grained PAT (Issues: read/write)
```

## Test plan

- [ ] `npm install` succeeds
- [ ] The Sandcastle agent starts and authenticates with the tokens from `.env`

🤖 Generated with [Claude Code](https://claude.com/claude-code)

