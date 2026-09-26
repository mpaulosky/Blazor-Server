# Sandcastle runs unattended on a GitHub-hosted runner with a PAT that can't change workflows

Sandcastle, the agent pipeline in `.sandcastle/`, runs from a `sandcastle.yml` workflow on a GitHub-hosted `ubuntu-24.04` runner, triggered by label changes, Copilot reviews, CI
completions and a 2-hourly schedule. It isn't run by a developer at a terminal. Nobody approves its plans or merges; a human steps in only when it hands an issue or PR back with a
`sandcastle:needs-*` label.

It pushes, comments and labels with `SANDCASTLE_GH_TOKEN`, a fine-grained personal access token scoped to this repository with Contents, Issues, Pull requests and Actions read/write
and **no Workflows permission**. So Sandcastle can never change CI, the automerge workflow or its own trigger. An issue whose fix needs a `.github/workflows/**` change gets pushed,
rejected, and handed back with `sandcastle:needs-human`. A person makes that change.

Only the repository owner queues work, and only what they approved reaches an agent. The workflow starts on label events only when the owner made them. The host skips any
issue whose `Sandcastle` label someone else added, or whose title or body someone else edited afterwards, and passes roles only the owner's comments and review threads. So neither a
collaborator nor a passing commenter can feed text to an agent holding a write token.

Because the token belongs to the repository owner, GitHub doesn't notify them about Sandcastle's own labels and comments. A run that hands anything back therefore ends red so that
Actions emails them.

## Considered Options

- **A self-hosted runner on the development machine**: persistent image cache, no 6-hour job cap. Rejected because GitHub advises against self-hosted runners on public repositories
  (fork pull requests can run code on them), and it needs the machine to be on.
- **A systemd timer on the development machine**: the smallest change, with no new secrets. Rejected because it needs the machine on, and a host timer and Actions runs can't share a
  lock.
- **`anthropics/claude-code-action`**: one Claude session per trigger, without the blocker gate, planner, parallel sandboxes or reviewer. Rejected as a replacement; it could still suit
  narrow jobs later.
- **A PAT with Workflows permission**: would let Sandcastle fix workflow files itself. Rejected because an unattended agent that can edit its own trigger and the merge gate could
  remove the checks that keep it safe.
- **A GitHub App or machine user** instead of the owner's PAT: fixes the notification gap and separates the agent's identity. Deferred as the upgrade path if ending runs red proves
  noisy.

## Consequences

- The 6-hour job cap bounds a run. Sandcastle starts no new round after 4 hours, each role has a wall-clock timeout, and state kept on GitHub (labels, marker comments, links) lets the
  next run resume.
- Claude usage is billed to the owner's subscription through `CLAUDE_CODE_OAUTH_TOKEN`, within its usage limit. Setting an `ANTHROPIC_API_KEY` secret switches to per-token billing.
- Both secrets expire and must be renewed; [sandcastle-workflow.md](../plans/sandcastle-workflow.md) records how.
- Local runs must name an issue or a dev label, so they never compete with Actions for the `Sandcastle` queue.
