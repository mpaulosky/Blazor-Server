# Research: Where an automatic Sandcastle trigger could run

Research for [#54](https://github.com/mpaulosky/Blazor-Server/issues/54), part of map
[#52](https://github.com/mpaulosky/Blazor-Server/issues/52). Gathered 2026-09-25 from primary sources.

## Question

What are the concrete options, with their constraints, for starting Sandcastle automatically when an issue
gains the `Sandcastle` label (or on a schedule)?

## Starting point: how Sandcastle runs today

- The dev runs `npx tsx .sandcastle/main.mts` on a Linux host. `main.mts` runs a blocker gate, an Opus planner
  (1 iteration), then per issue an implementer (`maxIterations: 100`) and a reviewer (1 iteration), each in a
  `docker()` sandbox, and loops up to `MAX_ITERATIONS = 10` rounds. Issue pipelines in a round run concurrently
  via `Promise.allSettled()` (`.sandcastle/main.mts`).
- The sandbox image comes from `.sandcastle/Dockerfile` (`node:22-bookworm` plus `gh`, Claude Code and the
  .NET 10 SDK). `sandcastle docker build-image` passes `AGENT_UID=$(id -u)` / `AGENT_GID=$(id -g)` so the
  image's `agent` user matches the host user that owns the bind-mounted worktree
  ([Sandcastle README](https://github.com/mattpocock/sandcastle#readme), `sandcastle docker build-image`).
- Credentials are resolved "automatically from `.sandcastle/.env` and `process.env`"
  ([Sandcastle README](https://github.com/mattpocock/sandcastle#readme), environment variables section), so a
  CI job can supply them as environment variables instead of a `.env` file.
- The agent's idle timeout defaults to 600 s and resets on each output event (`idleTimeoutSeconds`); there is
  no overall wall-clock cap in Sandcastle itself.
- Logs go to `.sandcastle/logs/`, which is git-ignored (`.sandcastle/.gitignore`).
- `.sandcastle/.env.example` documents `CLAUDE_CODE_OAUTH_TOKEN` (or `ANTHROPIC_API_KEY`) and a fine-grained
  `GH_TOKEN` with Issues RW + Metadata R. `publish()` in `main.mts` also runs `git push` and `gh pr create`,
  so an unattended run needs Contents and Pull requests write as well.

## Triggering facts that apply to every option

- The `issues` event has a `labeled` activity type; the workflow cannot filter by label name in `on:`, so the
  job checks `github.event.label.name` in an `if:`. For `issues` events `GITHUB_SHA`/`GITHUB_REF` are the
  last commit on / the default branch
  ([Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#issues)).
- "Anyone with triage access to a repository can apply and dismiss labels"
  ([Managing labels](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels)).
  On this personal public repo that means the owner and collaborators; drive-by users cannot fire a
  label trigger.
- Events caused by `GITHUB_TOKEN` do not start new workflow runs (except `workflow_dispatch` and
  `repository_dispatch`); PRs opened or updated with `GITHUB_TOKEN` get `pull_request` runs that require
  approval
  ([Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)).
  If Sandcastle pushes and opens PRs with `GITHUB_TOKEN`, `ci.yml` and `pr-automerge.yml` would not run
  normally; it must keep using a PAT or GitHub App token (`GH_TOKEN`).
- `schedule`: shortest interval is every 5 minutes, runs only from the default branch, may be delayed under
  load, and "in a public repository, scheduled workflows are automatically disabled when no repository
  activity has occurred in 60 days"
  ([Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)).

## Option 1: GitHub Actions on a GitHub-hosted runner

**Docker.** The `ubuntu-24.04` runner image ships Docker Client/Server 28.0.4, Docker Compose 2.38.2 and
Buildx 0.37.1, plus Node.js 22 and several .NET 10 SDKs
([Ubuntu 24.04 image README](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)).
So `docker build` of `.sandcastle/Dockerfile` and `docker run` work directly on the runner. Standard
`ubuntu-latest` in a public repo has 4 CPUs, 16 GB RAM and 14 GB SSD
([GitHub-hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)).
The image is rebuilt on every run unless cached (for example with Buildx GitHub Actions cache).
Not verified here: Sandcastle's UID alignment and bind mounts on the runner (the runner user is not
UID 1000; `build-image` passes the actual UID, which should cover it).

**Time limits.** "Each job in a workflow can run for up to 6 hours of execution time" on GitHub-hosted runners;
a workflow run can last up to 35 days
([Actions limits](https://docs.github.com/en/actions/reference/limits)). `timeout-minutes` defaults to 360
([Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)).
A full `main.mts` run (10 rounds, a 100-iteration implementer per issue) has no wall-clock bound of its own, so
it can hit the 6 h kill. When the job is killed, uncommitted work in the runner's worktree is lost (branches
already pushed survive). Options: run one issue per job, lower `maxIterations` / `MAX_ITERATIONS`, or push
work in progress more often.

**Cost.** "GitHub Actions usage is free for public repositories that use standard GitHub-hosted runners"
([Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)). Model usage
is billed separately: API tokens for `ANTHROPIC_API_KEY`, or the Claude subscription for an OAuth token
([Claude Code GitHub Actions: Manage costs](https://code.claude.com/docs/en/github-actions#manage-costs)).

**Secrets.** Store `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`, and `GH_TOKEN`, as repository secrets and
pass them as job `env`. "With the exception of `GITHUB_TOKEN`, secrets are not passed to the runner when a
workflow is triggered from a forked repository"
([Using secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)).
An `issues: labeled` workflow always runs the default-branch workflow file, and only triage+ users can label.

**Using a subscription OAuth token from CI.** Anthropic documents it as supported:

- `claude setup-token` generates a one-year OAuth token "for CI pipelines, scripts, or other environments where
  interactive browser login isn't available"; it requires a Pro, Max, Team or Enterprise plan and "can only make
  model requests" ([Authentication: Generate a long-lived token](https://code.claude.com/docs/en/authentication#generate-a-long-lived-token)).
  `CLAUDE_CODE_OAUTH_TOKEN` is listed in the precedence order as "Use this for CI pipelines and scripts".
- The Claude Code GitHub Actions page offers `CLAUDE_CODE_OAUTH_TOKEN` as a repository secret for subscription
  auth ([Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions#manual-setup)).
- Limits: OAuth "is intended exclusively for purchasers of Claude Free, Pro, Max, Team, and Enterprise
  subscription plans and is designed to support ordinary use of Claude Code"; "Advertised usage limits for Pro
  and Max plans assume ordinary, individual usage of Claude Code and the Agent SDK"; developers "may not ...
  route requests through Free, Pro, or Max plan credentials on behalf of their users"
  ([Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)). Free/Pro/Max use falls
  under the [Consumer Terms](https://www.anthropic.com/legal/consumer-terms).
- The org-setup guidance recommends an API key over an OAuth token for shared secrets, "since an OAuth token
  is tied to the subscription of the person who ran `claude setup-token`"
  ([Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions#set-up-for-an-organization)).

Reading of the sources: the owner running Claude Code on their own repo with their own token fits "ordinary,
individual usage"; heavy unattended multi-agent runs may exhaust the plan's usage limits sooner. An API key
or workload identity federation avoids the question at the price of per-token billing.

## Option 2: Self-hosted runner on the dev machine

**Setup.** Settings > Actions > Runners > New self-hosted runner; download the runner, run `config.sh` with the
repo URL and a registration token that expires after one hour, then `run.sh`
([Add runners](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners)).
To keep it running, `sudo ./svc.sh install [USER]` and `sudo ./svc.sh start`, which uses systemd on Linux
([Configure the runner application as a service](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/configure-the-application)).
Docker, Node, `gh` and the built `sandcastle:*` image already exist on the host, so the image cache persists.

**Limits.** A job on a self-hosted runner can run for up to 5 days; a queued job is cancelled after 24 hours
([Actions limits](https://docs.github.com/en/actions/reference/limits)). Actions usage is free for
self-hosted runners ([Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)).
The job only runs while the machine is on; a label applied when it is off waits up to 24 h in the queue.

**Security for a public repo.** GitHub: "Self-hosted runners should almost never be used for public
repositories on GitHub, because any user can open pull requests against the repository and compromise the
environment" ([Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)), and
"We recommend that you only use self-hosted runners with private repositories"
([Add runners](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners)).
The risk is any workflow that runs fork PR code on the runner. Fork PR runs from contributors "may require
manual approval from a maintainer with write access"
([Approve runs from forks](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/approve-runs-from-forks)),
which limits but does not remove the exposure. Mitigations (restrict `runs-on: self-hosted` to the one
`issues`-triggered workflow, require approval for all outside contributors, run the runner as a dedicated
user) reduce risk; the runner user needs Docker access, which is root-equivalent on the host.

## Option 3: Host-side poller or webhook forwarding

**systemd timer / cron.** A user-level systemd timer (or cron entry) runs `npx tsx .sandcastle/main.mts` on a
schedule. `main.mts` already selects work itself (`gh issue list --label Sandcastle` plus the blocker gate),
so a poller needs no event payload. No inbound network, no new GitHub-side secrets; credentials stay in
`.sandcastle/.env`. It shares the dev-machine-must-be-on constraint and adds polling latency. On
`systemd.timer`: "in case the unit to activate is already active at the time the timer elapses it is not
restarted, but simply left running. There is no concept of spawning new service instances"; `Persistent=true`
catches up missed runs after downtime (`man systemd.timer`,
[freedesktop.org](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html)). A user
service outside a login session needs `loginctl enable-linger`.

**`gh webhook forward`.** The `cli/gh-webhook` extension forwards repo webhooks to a local URL, but "Webhook
forwarding is only designed for use during testing and development. It is not supported for use in production
environments", and "Only one person can use webhook forwarding at a time for each repository and organization"
([Using the GitHub CLI to forward webhooks](https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/using-the-github-cli-to-forward-webhooks-for-testing)).
It would also need a local HTTP listener to receive the event. Not a fit for an unattended trigger.

## Option 4: `anthropics/claude-code-action` as the runtime

What it does ([Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions),
[action repo](https://github.com/anthropics/claude-code-action)):

- Runs Claude Code directly on the Actions runner (no container), in interactive mode (`@claude` mentions,
  `assignee_trigger`, `label_trigger`) or automation mode (a `prompt` input, any event including `schedule`).
  `label_trigger` is "The label name that triggers the action when applied to an issue"
  ([usage.md](https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md)).
- Auth: `anthropic_api_key`, `claude_code_oauth_token`, workload identity federation, Bedrock, Vertex, Foundry.
- Only actors with write access (or listed `allowed_bots` / `allowed_non_write_users`) can trigger it.
- Skills and plugins work via the `prompt` input; `claude_args` passes `--max-turns`, `--model`,
  `--allowedTools`.

What it does not cover, compared with Sandcastle
([capabilities-and-limitations.md](https://github.com/anthropics/claude-code-action/blob/main/docs/capabilities-and-limitations.md),
[security.md](https://github.com/anthropics/claude-code-action/blob/main/docs/security.md)):

- One Claude session per trigger. No blocker gate, planner, per-issue parallel sandboxes, or separate
  reviewer pass; those would have to be rebuilt as workflow jobs or prompts.
- No Docker sandbox: Claude runs on the runner with the tools `--allowedTools` grants. Bash is off unless
  allowed.
- On an issue it creates a branch with prefix `claude/` (configurable via `branch_prefix`) and "links back to a
  prefilled PR creation page" rather than opening the PR. It "cannot merge branches, rebase", cannot approve
  PRs, and "Cannot modify `.github/workflows` files".
- The default Claude GitHub App token triggers CI on its pushes; `GITHUB_TOKEN` would not.

It fits single-issue, interactive work and PR follow-up comments. It does not replace the Sandcastle
orchestration; a workflow could still run `main.mts` itself (Option 1) and use the action only for review
follow-up.

## Stopping two runs overlapping

| Mechanism | Behaviour | Source |
| --- | --- | --- |
| Actions `concurrency: { group: sandcastle }` | One run at a time per group; a new run waits `pending`, and by default replaces any existing pending run. `cancel-in-progress: true` kills the running one instead. `queue: max` keeps up to 100 pending runs (not combinable with `cancel-in-progress: true`). | [Control workflow concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency) |
| systemd timer | Does not start a second instance while the service is active. | `man systemd.timer` |
| `flock -n /path/lock cmd` | Fails immediately if another holder has the lock; usable from cron or a wrapper script. | [flock(1)](https://man7.org/linux/man-pages/man1/flock.1.html) |

With the default `queue: single`, a label burst collapses to one running and one pending run. That is enough
for Sandcastle because each run re-reads every open `Sandcastle` issue. `cancel-in-progress` should stay
`false`, since cancelling mid-implementer loses uncommitted work. Local and Actions runs do not see each
other's locks; overlap between a manual host run and an Actions run needs a shared signal (for example a
`sandcastle:running` label or the existing "skip issues with an open PR" check).

## Comparison

| | Hosted runner (Actions) | Self-hosted runner (dev box) | Host poller (systemd/cron) | `claude-code-action` |
| --- | --- | --- | --- | --- |
| Trigger | `issues: labeled` + `if`, `schedule`, `workflow_dispatch` | Same as hosted | Timer only (poll latency) | `label_trigger`, mentions, `prompt` on any event |
| Runs `.sandcastle/Dockerfile` | Yes, Docker 28 preinstalled; rebuilt per run unless cached | Yes, image cached | Yes, as today | No container; runs on the runner |
| Max run time | 6 h per job | 5 days per job; 24 h queue | None | 6 h per job (hosted) |
| Actions cost | Free (public repo, standard runner) | Free | n/a | Free (public repo, standard runner) |
| Needs dev machine on | No | Yes | Yes | No |
| Secrets location | Repo secrets | Repo secrets or host `.env` | Host `.env` | Repo secrets + Claude GitHub App |
| Public-repo risk | Low (ephemeral VM; fork runs get no secrets) | GitHub advises against it | Low (no inbound path) | Low; write-access check on actors |
| Overlap control | `concurrency` group | `concurrency` group | systemd single instance / `flock` | `concurrency` group |
| Keeps Sandcastle orchestration | Yes | Yes | Yes | No (single session, `claude/` branches, no auto PR) |
| Logs | Lost unless uploaded as an artifact | On host | On host | Workflow log |

## Open points for the decision ticket

- Whether a 6 h hosted-runner cap is acceptable, or the trigger should run one issue per job.
- Subscription OAuth token vs API key for unattended runs (usage limits vs per-token cost).
- The `GH_TOKEN` scope needed for push and PR creation (Contents and Pull requests write), which
  `.env.example` does not list yet.
