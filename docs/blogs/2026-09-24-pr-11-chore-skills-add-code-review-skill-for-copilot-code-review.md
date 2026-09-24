---
post_title: "chore(skills): Add code-review skill for Copilot code review"
author1: mpaulosky
post_slug: "v0.0.23-pr-11"
microsoft_alias: n/a
featured_image: ""
categories:
  - engineering
tags:
  - release:v0.0.23
  - automation
ai_note: "Backfilled for issue #21 from the PR title/body in the release automation format"
summary: "Release notes seed for v0.0.23 from PR #11."
post_date: "2026-09-24"
---
## chore(skills): Add code-review skill for Copilot code review

- **Release tag:** `v0.0.23`
- **Source PR:** [#11](https://github.com/mpaulosky/Blazor-Server/pull/11)

### PR description

## Summary

Copilot's reviews end with *"Add a `code-review` agent skill or configure MCP servers for context-aware, tailored reviews."* Per [GitHub's docs](https://docs.github.com/copilot/how-tos/use-copilot-agents/request-a-code-review/use-code-review?tool=webui#mcp-servers-and-agent-skills), Copilot code review looks for agent skills under `.github/skills/`, and is more likely to use one named `code-review`. This adds `.github/skills/code-review/SKILL.md`.

The skill points Copilot at the repo's existing sources of truth rather than restating them:

- `.sandcastle/CODING_STANDARDS.md`
- `CONTEXT.md`
- `docs/adr/`
- the commit conventions

It also adds the checks those files don't spell out, most of which came up while reviewing #10:

- **Domain language:** flag synonyms or terms used for their neighbour (Theme vs Palette).
- **Shared Kernel boundary:** `src/Domain` stays free of feature logic, persistence and new references.
- **Tests:** every behaviour change is tested, and `Result` handlers are tested for success and each error code.
- **Markdown line length (200):** this has to be checked by eye, because `.markdownlint.json` sets `"default": false` and CI's markdownlint passes over-long lines.
- **Workflows:** publishing steps run only for `main`. This is the bug behind #10's failing code-metrics check.
- **Branch naming:** `feature/`, `hotfix/` and `chore/`.
- **Sandcastle prompts:** `` !` `` in a prompt file runs a shell command. This is the bug fixed in #9.

It leaves analyzer and Central Package Management findings to the build, which already fails on them.

The MCP half of the tip needs no change: the GitHub and Playwright MCP servers are on for code review by default.

## Testing

- markdownlint passes with MD013 at 200 actually enabled. The repo's own config disables every rule, so I ran it with a strict config.
- The first review that can use the skill will be on this PR or the next one. The tip at the bottom of the review should go away.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

