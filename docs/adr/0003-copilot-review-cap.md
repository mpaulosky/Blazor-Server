# Copilot stops holding the merge after three review rounds

Amended by [ADR 0004](0004-claude-review-shares-the-review-cap.md): the cap now counts Claude Review's rounds and threads with Copilot's.

`pr-automerge.yml` merges a same-repo PR into `main` once its required checks pass, Copilot has reviewed its head commit, and every review thread is resolved. Copilot re-reviews every
push and can raise something new each time, so fixing its comments triggers another round, and a PR can chase its reviews without ever merging.

So Copilot's hold on the merge is capped. Once Copilot has reviewed three distinct non-merge commits of a PR, the merge no longer waits for its review of the head, and its
unresolved threads no longer count. Merges from `main` aren't rounds: the ruleset keeps branches up to date, so counting them would use up the cap without a single fix. A thread
belongs to whoever wrote its first comment.

Everything else still holds the merge at the cap: threads anyone else opens (including bots other than Copilot, and threads whose author no longer exists), required checks, merge
conflicts, and the `sandcastle:needs-human` label. The run log says when the cap let a PR through and how many Copilot threads it merged past.

This amends [ADR 0002](0002-unattended-sandcastle-on-a-hosted-runner.md), which says `pr-automerge.yml` merges only once every thread is resolved. That still holds for every thread
except Copilot's after the cap.

## Considered Options

- **No cap**: every Copilot comment is dealt with before merging. Rejected because PRs stalled on a fresh low-severity thread after each fix.
- **Cap the wait for a head review, but keep Copilot's threads blocking**: every comment still gets a look. Rejected because a review that arrives after the last thread is resolved
  can open a new one and hold the merge again, so the loop isn't broken.
- **Count every reviewed commit, merges from `main` included**: simpler. Rejected because busy days on `main` reached the cap through branch updates alone.
- **A time limit instead of a round count**: merge if Copilot hasn't reviewed within some hours. Rejected because the problem is repeated reviews, not missing ones.

## Consequences

- Copilot comments from round three on can merge unaddressed. They stay on the merged PR, so the owner can act on them afterwards.
- The cap lives in one constant, `COPILOT_REVIEW_CAP` in `pr-automerge.yml`, and `.github/scripts/tests/pr-automerge.test.mjs` covers it.
- Sandcastle's follow-up role may still be answering Copilot threads when the cap merges the PR. The merge is pinned to the head it checked, so a push that lands in between makes the
  merge fail and a later run re-evaluates.
