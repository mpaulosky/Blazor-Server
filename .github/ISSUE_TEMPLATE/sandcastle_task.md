---
name: Sandcastle task
about: Work for Sandcastle's agents to build, written to pass the Definition of Ready
title: "<type>(<scope>): <Summary>"
assignees: mpaulosky
---

<!--
Sandcastle builds an issue only once the repository owner adds the `Sandcastle` label, so this template doesn't add it.
The Definition of Ready is in docs/plans/sandcastle-workflow.md: a Summary, at least one objectively checkable
acceptance criterion, and no open question that needs a human decision. Settle every decision here, not in the build.
The title follows the commit format, and a bug also needs the `bug` label, which puts its branch under fix/.
Replace #N on the "Blocked by" line with each issue that has to land first, or delete the line. Sandcastle's blocker check
reads this line as well as the issue's native "blocked by" links, so either one holds the issue back.
-->

## Summary

What changes and why. Link the spec section, issue or incident that prompted it.

Blocked by #N

## Scope

- What to change, naming the files, modules or roles, and anything that is out of scope.

## Acceptance criteria

- [ ] An outcome someone can check without judgement, ending in "(tested)" when a test should cover it.
- [ ] The repository's checks for the changed code pass (for example `pnpm run check:sandcastle` or `dotnet test`).
