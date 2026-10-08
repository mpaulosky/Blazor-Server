# Claude Review, Copilot's backup, shares the review cap

This amends [ADR 0003](0003-copilot-review-cap.md). The repo-ci-baseline Template (mpaulosky/dotfiles#110) adds Claude Review: when Copilot's review request is dropped
(GitHub does so once the account's Copilot code review budget is used up), the PR gets the `review:claude` label and Claude reviews its head. `pr-automerge.yml` accepts that review,
a `github-actions[bot]` review whose body starts with `<!-- claude-review -->`, as it accepts Copilot's.

The cap now counts review rounds from both reviewers together: once Copilot and Claude between them have reviewed three distinct non-merge commits, the merge stops waiting for a
review of the head, and neither reviewer's unresolved threads count. Counting them apart would let a PR reset the cap by switching reviewer. Claude findings outside the diff, which
open no thread, hold the merge like threads do, until the cap. Everything else ADR 0003 says still holds: threads anyone else opens (other bots included), required checks, conflicts
and the `sandcastle:needs-human` label hold the merge at the cap.

## Consequences

- The constant keeps the name `COPILOT_REVIEW_CAP`, because the skill's `github-settings.sh` reads the cap by that name.
- The design and its trust limit are recorded in the skill's ADR 0004 (`docs/adr/0004-claude-review-as-copilots-backup.md` in the repo-ci-baseline skill, mpaulosky/dotfiles).
