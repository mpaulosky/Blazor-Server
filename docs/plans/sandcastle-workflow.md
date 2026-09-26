# Sandcastle Workflow

This is the design for the enhanced Sandcastle pipeline: the agent pipeline in `.sandcastle/` that turns `Sandcastle`-labelled issues into merged pull requests without a human in
the loop. It extends the outline in [plan-workflow-list.md](plan-workflow-list.md) (intake, critiqued plan, role-based team, full gate, PR, review follow-up, merge).

It was charted on the map [Map: Enhance the Sandcastle issue workflow](https://github.com/mpaulosky/Blazor-Server/issues/52). Each section links the decision ticket that holds the
reasoning; this document says *what* to build, and the tickets say *why*. The implementation is split into `Sandcastle` issues listed in [Implementation issues](#implementation-issues),
so Sandcastle builds its own upgrade.

## Principles

- **Fully unattended.** No human approves plans or merges. A human steps in only when Sandcastle hands something back (see [Giving up](#giving-up-and-telling-the-human)), or when
  they choose to join a PR's review: `pr-automerge.yml` merges only once every thread is resolved, so a thread a human opens waits for that human to resolve it.
- **The host decides; agents propose.** Agents never call GitHub write APIs. They return structured verdicts or write files, and the host (`main.mts`) validates them and applies
  labels, comments, links, pushes and thread resolutions with `gh`.
- **Trust boundary.** Anyone with write access is trusted like the owner: they can already push to any branch, dispatch workflows and change what Sandcastle would build. Today the owner is
  the only collaborator. The defences in this spec target everyone else: issue authors, commenters, people with only triage access, and fork PRs. Content from them never reaches an agent
  unless the owner approved it. Anything that can only be done with write access (reusing a branch, `workflow_dispatch`) isn't guarded further. Granting someone write access means trusting
  them with Sandcastle too.
- **Agents can't reach GitHub.** The sandbox gets no GitHub token, and no prompt tells a role to run `gh`. The host puts everything a role needs into its prompt: the issue's title
  and body, the owner's comments, the design note, and the review threads it may act on. What a role sees is exactly what the host chose to give it.
- **Anything that must be stable is host code.** Branch names, retry counts and gate results come from code, never from a model.
- **State lives on GitHub.** Labels, marker comments and native "blocked by" links carry state between runs, so any run can resume after a crash, a timeout or a restart.

## Labels

| Label | Applied by | Meaning | Cleared by |
|---|---|---|---|
| `Sandcastle` | Human, or the host on the child issues intake creates when it splits an issue | The issue is in the queue. | Human, or intake when it splits the issue into children |
| `sandcastle:ready` | Host (intake) | The issue passed the Definition of Ready and isn't re-checked. | Human (forces a re-check), or the host when it applies an issue-level `sandcastle:needs-human` |
| `sandcastle:needs-info` | Host (intake) | The issue's text is the problem: answer the questions and edit the issue. | Human, which re-queues the issue |
| `sandcastle:needs-human` | Host | Sandcastle tried and couldn't. On an issue: two failed builds, a PR closed without merging, or a push touching `.github/workflows/**`. On a PR: follow-up gave up. | Human, which re-queues the issue or PR |
| `bug` | Human or host (intake) | The issue is a fix, so its branch is `hotfix/`. | Human |

The host creates any missing `sandcastle:*` label at startup. The wayfinder map and its tickets must never carry `Sandcastle`.

**Only the repository owner queues work, and only what they approved reaches an agent.** Anyone with triage access can add a label or edit an issue, anyone can comment on a public
repository, and an agent holding a write token acts on what it reads. So when the host loads the queue, before intake and the early exit, it keeps an issue only when:

- the most recent `labeled` event adding `Sandcastle` in its issue events was made by the repository owner, and
- nobody but the owner has changed its title (`renamed` events) or body (the GraphQL `userContentEdits` editors) since that event.

The PAT is the owner's, so the labels the host adds to split children pass. Any other issue is skipped and logged, without a comment. The owner re-approves an edited issue by removing and
re-adding `Sandcastle`. Only the owner's comments reach a role: the host drops everyone else's when it builds a prompt, and the sandbox has no token to fetch them itself (see
**Principles**). On PRs, follow-up acts only on bot threads and the owner's threads (see **Thread rules**). The workflow applies the label rule to the events that start it (see **Trigger and
run environment**), and the host checks cover scheduled, manual and local runs.

The same goes for every label that moves an issue or PR along. The host trusts `sandcastle:ready` only when its most recent add was the owner's (which includes the host itself);
otherwise it removes the label and intake judges the issue. A `sandcastle:needs-info` or `sandcastle:needs-human` removal counts as a re-queue only when the owner made it; otherwise
the host puts the label back and the issue or PR stays handed back.

Saved search for everything waiting on a human: `is:open label:sandcastle:needs-human,sandcastle:needs-info`.

## The round

`main.mts` loops over rounds until a round opens no new pull request, the time budget runs out, or the usage limit is hit. Each round runs these phases in order:

1. **Follow-up sweep**: get open Sandcastle PRs to mergeable.
2. **Intake**: judge every unjudged `Sandcastle` issue against the Definition of Ready.
3. **Blocker gate**: hold back issues whose blockers haven't landed (unchanged from today).
4. **Plan**: the planner picks issues to build in parallel and the optional roles each needs.
5. **Critique**: defer picks that aren't safe to build alongside the others.
6. **Build**: one sandbox per picked issue runs the role team, the gate and publishes a PR.

The queue is the `Sandcastle` label in Actions. A local run must name its scope, either an issue number or a dev label such as `Sandcastle:dev` through an environment variable, so it
never competes with Actions for work ([trigger decision](https://github.com/mpaulosky/Blazor-Server/issues/61)). Every phase works only on issues and PRs in that scope, and only on
issues the owner approved (see **Labels**).

### Early exit

Before building the Docker image or calling Claude, the host checks whether there is any work: an open, un-judged issue for intake (not handed back), a ready unblocked issue for the build, or a
settled PR for follow-up. With none, the run exits 0 at once. Scheduled and event triggers are therefore cheap when there's nothing to do.

## Phase 1: Follow-up sweep

Decided in [How Sandcastle follows up on an open PR until it can merge](https://github.com/mpaulosky/Blazor-Server/issues/60). API facts are in
[GitHub APIs for automated PR review follow-up](https://github.com/mpaulosky/Blazor-Server/issues/55).

**Scope.** Open, non-draft, same-repo PRs into `main` whose head is `feature/{n}-…` or `hotfix/{n}-…`, where `#n` is an open issue in scope. PRs labelled `sandcastle:needs-human` are
skipped. A PR is Sandcastle's only when the repository owner opened it (the host publishes with the owner's PAT) and its body carries the `<!-- sandcastle:pr -->` marker the host
writes when it publishes, so a collaborator's PR on a matching branch is never swept. The Copilot-review and CI-completion triggers only start a run; this check decides which PRs it
touches.

**Settled.** A PR gets a pass only when every check run on its head has completed and Copilot has reviewed the head (a Copilot review with `commit.oid == headRefOid`, and Copilot not in
`reviewRequests`). If CI has been settled for about an hour with no Copilot review and no pending request, the host re-requests one with `requestReviewsByLogin` (once per head).
A settled PR that is `CLEAN` with every thread resolved, or with only human threads open, is left alone. A PR with open human threads doesn't merge until
that human resolves them. That is deliberate: a human who comments has joined the review, and resolving the thread is their sign-off.

**Catching up with `main`.** Always a merge, never a rebase or force-push. `BEHIND` with nothing else to do is fixed on the server with `PUT /pulls/{n}/update-branch` and
`expected_head_sha`. `DIRTY` is merged locally in the sandbox during a pass.

**A pass** runs in one `createSandbox()` on the PR branch. The host runs `git fetch` for the branch first, because otherwise Sandcastle silently branches from `main`
([Sandcastle research](https://github.com/mpaulosky/Blazor-Server/issues/53)).

1. The host merges `origin/main` if the branch is behind or conflicting.
2. The **follow-up** role resolves conflicts, handles review threads and any CodeQL failure logs, commits its fixes, and writes the gitignored `.sandcastle/follow-up.json`:
   `[{ threadId, verdict: "fixed" | "declined" | "outdated", reason, commit? }]`.
3. The host runs [the gate](#the-gate), with the gate-fixer if it fails.
4. The host pushes (plain push, skipped when nothing was committed).
5. The host checks the JSON against the PR's real open thread ids, ignoring unknown ones. It posts each reply, resolves **bot threads only** (`ADDRESSED`, `WONT_FIX` or `INVALID`), and
   posts one pass-summary PR comment carrying `<!-- sandcastle:follow-up -->`.

**Thread rules.** Follow-up acts on bot threads (Copilot, CodeQL) and the repository owner's threads, but resolves only bot threads. Threads anyone else opens never reach the role; they
stay open for the owner, and the job summary lists them. The owner resolves their own threads, because that's their sign-off. It may decline a
bot thread without a change only because the suggestion contradicts the issue's acceptance criteria or `CODING_STANDARDS.md`, is factually wrong (the reply cites the code), or is out of
the issue's scope. Outdated threads whose concern the current code handles are resolved `ADDRESSED`. When it disagrees with an owner thread, it replies with its reasoning and leaves the
thread open.

**Red CI.** The gate decides. If `scripts/gate.sh` is red on the head, the gate-fixer takes it. If the gate is green but a gate-covered CI check (build, test, lint) is red, the host
re-runs the failed jobs once as flaky. If a check the gate doesn't cover (CodeQL) is red, its `gh run view --log-failed` output goes to the follow-up role. Pending checks mean the PR
waits for a later sweep.

**Parallelism.** The host fetches every PR branch it will pass on serially, in one step before any pass starts, because concurrent fetches contend on the shared git ref lock (the reason
`main.mts` already fetches `origin/main` once per round). Then passes for different PRs run with `Promise.allSettled`. The build phase starts after the sweep. The reviewer role doesn't run
on passes, because Copilot re-reviews the push.

**Giving up on a PR.** Three passes per PR, counted as follow-up marker comments since `sandcastle:needs-human` was last removed from it. It gives up at once when the gate-fixer runs out of
attempts, a conflict can't be resolved to a green gate, a re-run check stays red, or an agent run fails. Giving up adds `sandcastle:needs-human` to the **PR** with one comment quoting or
linking the last gate or CI output. `pr-automerge.yml` skips PRs labelled `sandcastle:needs-human`, so a handed-back PR never merges until the human removes the label. It also skips a PR
whose most recent `needs-human` removal wasn't the owner's, so someone with triage access can't clear a hand-back to get a merge before the host puts the label back. Open human threads never
count as giving up: the human who opened them is already involved, and the job summary lists PRs waiting on them.

**Closed PRs.** If a PR closes without merging while its issue is open, the host adds `sandcastle:needs-human` to the issue with the comment "PR #x was closed without merging; remove the
label to rebuild". The next build of that issue starts fresh from `main`: the host deletes the old remote branch before `createSandbox()`.

## Phase 2: Intake

Decided in [What makes a Sandcastle issue ready to build, and what happens when it isn't](https://github.com/mpaulosky/Blazor-Server/issues/56).

**Definition of Ready.** An issue is ready when it has:

1. a **Summary** of what changes and why;
2. at least one **objectively checkable acceptance criterion** (prose is fine; checkboxes aren't required);
3. **no open question that needs a human decision**.

Intake never invents any of these, because they are the author's intent, and it never edits the issue body.

**Shape.** One intake `run()` with structured output (`Output.object`, `maxIterations: 1`) runs before the blocker gate, over every open in-scope issue that has none of
`sandcastle:ready`, `sandcastle:needs-info` and `sandcastle:needs-human`, including blocked ones, so questions reach the human while a blocker is still in flight. It returns one verdict per issue:

- `ready`: the host adds `sandcastle:ready`.
- `needs-info` with numbered questions tied to the unmet requirements: the host posts one comment and adds `sandcastle:needs-info`. The issue keeps `Sandcastle`; the gate skips and logs
  it. Only removing the label re-queues it; a reply alone doesn't.
- `split` with drafted children, only for an issue that already meets 1–3 but is too big for one PR: the host creates each child with `Sandcastle`, adds it as a sub-issue of the
  original, and wires native "blocked by" links in build order. Each child's acceptance criteria are a subset of the original's, redistributed and never new. The original loses
  `Sandcastle` and becomes an umbrella, which the host closes once every child closes as completed. Children go through intake on the next round.

Every verdict carries a `bug` flag; when it's set the host adds `bug`. The host posts one comment per verdict saying what it did and why. Intake judges each issue on its own; cross-issue
concerns belong to the critique.

## Phase 3: Blocker gate

Unchanged: an issue is blocked while any issue it depends on (native "blocked by" links and `Blocked by #N` / `Depends on #N` lines) hasn't closed as completed or merged. It now also
drops, in code, issues labelled `sandcastle:needs-info` or `sandcastle:needs-human`, issues without `sandcastle:ready`, and issues with an open PR (labelled or not), logging each reason.
Issues the owner didn't approve never get this far: the host drops them when it loads the queue.
The "skip issues with an open PR" rule leaves `plan-prompt.md`.

## Phase 4: Plan

The planner (unchanged in purpose) picks the ready issues to build in parallel this round. Two changes:

- **It stops emitting branch names.** The host names the branch `hotfix/{n}-{slug}` when the issue has `bug` and `feature/{n}-{slug}` otherwise, with the slug computed from the title.
  An existing `feature/{n}-*` or `hotfix/{n}-*` branch on the remote is reused and fetched before `createSandbox()`
  ([critique decision](https://github.com/mpaulosky/Blazor-Server/issues/57)).
- **It picks the optional roles.** Each picked issue gets a `roles` field listing any of `architect`, `ui`, `scribe`. The host validates it and runs every role when it's missing or
  invalid ([team decision](https://github.com/mpaulosky/Blazor-Server/issues/58)).

## Phase 5: Critique

Decided in [What the plan critique (rubber duck) checks and may change](https://github.com/mpaulosky/Blazor-Server/issues/57).

The critique checks one thing: whether the round's parallel set is safe, meaning no file or module overlap between picks, and no pick depending on an API or decision another open issue
will establish. Its only power is to **defer** a pick.

**Input:** the picked issues with bodies; in-flight issues (open PRs) with each PR's changed files; the ready issues the planner didn't pick; and the repo, read from the sandbox.

**Shape:** a separate `run()` after the planner with `.sandcastle/critique-prompt.md`, `maxIterations: 1` and `Output.object({ tag: "critique", schema })` returning
`{ verdicts: [{ id, verdict: "keep" | "defer", blockedBy?, reason }] }`. It is skipped when there's nothing to compare (one pick, no in-flight PRs, no unpicked ready issues).

**The host applies it.** For each `defer`, it adds a native `#X blocked by #Y` link and posts one comment on `#X` naming the blocker, the reason, and how to override (delete the link).
A verdict is ignored and logged when its id wasn't picked, its `blockedBy` is missing or closed, or the link would create a cycle. If the critique empties the round, the loop continues to
the next round rather than stopping. If the critique run itself fails, the round builds only the planner's first pick, with a warning.

## Phase 6: Build

Decided in [How the role-based team is composed and run per issue](https://github.com/mpaulosky/Blazor-Server/issues/58) and
[How the full pre-push gate runs inside the sandbox](https://github.com/mpaulosky/Blazor-Server/issues/59).

Each picked issue gets one `createSandbox()`. The host calls `sandbox.run()` once per role, in this order:

```text
[architect] → tester → backend → [ui] → gate checkpoint 1 → [scribe] → reviewer → gate checkpoint 2 → publish
```

Roles in brackets run only when the planner picked them. The tester, backend developer and reviewer always run.

**When a role fails**, the table's last column decides what happens. An architect, tester, backend or UI failure stops the issue's pipeline and counts as a failed build. A scribe or
reviewer failure doesn't stop it: the pipeline carries on to the next step, and the PR is published with the note in the table. A gate-fixer failure counts as one of the checkpoint's
gate attempts, and a checkpoint that runs out of attempts stops the pipeline without publishing (see **Checkpoints**).

| Role | Prompt | Does | On failure |
|---|---|---|---|
| architect | `.sandcastle/roles/architect.md` | Writes the gitignored design note `.sandcastle/work/{n}/design.md` (types, signatures, where each change goes, risks). Writes no production code. Commits an ADR only for a decision that is hard to reverse, surprising, and a real trade-off. The host posts the note as an issue comment after the run. | Issue stops |
| tester | `.sandcastle/roles/tester.md` | Turns each acceptance criterion into failing tests, adds the smallest compiling stubs (`throw new NotImplementedException()`), and commits red. | Issue stops |
| backend | `.sandcastle/roles/backend.md` | Makes the tests green, with its own inner red→green loop. | Issue stops |
| ui | `.sandcastle/roles/ui.md` | Same, for Blazor components and pages. | Issue stops |
| scribe | `.sandcastle/roles/scribe.md` | Documents what was built: `CONTEXT.md` glossary terms, `README.md` prose, hand-written guides such as `docs/CONTRIBUTING.md`. Never touches release-generated files (`docs/blogs/`, the README releases table, `docs/README.md`, `docs/index.html`), never creates ADRs, and commits nothing when there's nothing to document. | PR published with a note that docs failed |
| reviewer | `.sandcastle/review-prompt.md` | Refactor-only final pass. Also checks that the acceptance tests cover every criterion and weren't weakened, and that the design note was followed or the difference explained. | PR published unreviewed, with a warning |
| gate-fixer | `.sandcastle/roles/gate-fixer.md` | Receives the gate output and fixes it. Never weakens or skips tests. At checkpoint 1 it may finish the implementation; at checkpoint 2 it may only repair. | Counts as a gate attempt |

`implement-prompt.md` is retired; the backend and UI prompts are split out of it. `.sandcastle/work/{n}/` is the gitignored folder for notes passed between roles. On a re-run, every
picked role runs again on the existing branch and builds on earlier work; the architect reads its earlier design comment.

**Shared role rules** live in one file (`.sandcastle/roles/shared-rules.md`) that the host passes to every role prompt, instead of being copied into each prompt:

- Every commit must pass `dotnet build Blazor-Server.slnx` (warnings as errors). Tests must pass by the end of the last developer run, not on every commit.
- Each committing role (backend, UI, scribe, gate-fixer) runs `scripts/gate.sh` once as its last step before `<promise>COMPLETE</promise>`. The tester is exempt, because its tests are
  red on purpose; it still builds and lints its own files. The architect is exempt too: it commits at most one ADR (Markdown only), lints that file, and checkpoint 1 gates it with
  the rest of the tree.
- Commit format follows the repository's conventional-commit style. Agents never push, never run `gh`, and never write to GitHub.

## The gate

`scripts/gate.sh` is the single definition of "ready to push", shared by the pre-push hook, the sandbox and people. It diffs against `git merge-base origin/main HEAD` (which fixes the old
hook linting only the last commit on a branch with no upstream) and stops at the first failure:

1. `yamllint -c .yamllint.yml` on changed `*.yml` / `*.yaml` files (failing with an "install yamllint" message when it's missing; no Docker fallback);
2. `npx --no-install markdownlint-cli2` on changed `*.md` files;
3. the Sandcastle TypeScript check (`npm run check:sandcastle`: type-check plus the host's unit tests) when `.sandcastle/**` or `package*.json` changed;
4. `dotnet build Blazor-Server.slnx -c Release` (warnings as errors);
5. `dotnet test --project` for each project under `tests/`, in Release.

CodeQL, metrics and coverage stay in CI. `yamllint` is added to `.sandcastle/Dockerfile`, and `lint-yaml.yml` reads `config_file: .yamllint.yml` so there is one YAML config. The
pre-push hook keeps its branch-name and protected-branch checks, then calls the script.

Step 3 is an addition made while writing this spec: the host code is TypeScript that nothing type-checks today, and much of this upgrade is host logic (slugs, cycle checks, verdict
validation, marker counting) that unit tests can pin down.

**Checkpoints.** The host runs the gate through `sandbox.exec()` after the last developer run (checkpoint 1) and just before `publish()` (checkpoint 2). The host's exit code is the
authority, not what an agent reports. At each checkpoint the gate-fixer gets **2 attempts**, with the gate re-run after each. Past that, nothing is published, the branch keeps its
commits, and the build counts as failed.

**Pushing.** When checkpoint 2 exits 0, the host writes a gate-pass marker for the `HEAD` SHA it gated, inside the git common dir (never committed). The gate ran on that commit's
whole tree, so the marker vouches for the tip, not for each ancestor. The pre-push hook always checks the branch name, and it skips lint, build and tests only when the tip SHA
of every branch being pushed (the hook's `local_sha`) has a marker. Follow-up pushes that passed the gate get markers too. CI stays the independent check
([model and budget decision](https://github.com/mpaulosky/Blazor-Server/issues/64)).

## Roles, models and budgets

Decided in [Which model and budget each Sandcastle role gets](https://github.com/mpaulosky/Blazor-Server/issues/64); timeouts come from the
[trigger decision](https://github.com/mpaulosky/Blazor-Server/issues/61), with the values below set by this spec.

Every role's settings live in one `ROLE_AGENTS` map in the host code, so tuning is a one-line change. Opus goes where a wrong answer costs a whole round; Sonnet goes where the gate,
the reviewer or CI checks the output anyway.

| Role | Model | Effort | maxIterations | Timeout (min) |
|---|---|---|---|---|
| intake | Sonnet | medium | 1 (structured) | 15 |
| planner | Opus | high | 1 (structured) | 15 |
| critique | Sonnet | high | 1 (structured) | 15 |
| architect | Opus | high | 1 | 15 |
| tester | Sonnet | high | 3 | 30 |
| backend | Opus | high | 10 | 45 |
| ui | Sonnet | high | 10 | 45 |
| scribe | Sonnet | medium | 1 | 15 |
| reviewer | Opus | high | 1 | 15 |
| gate-fixer | Sonnet | high | 1 per attempt | 20 |
| follow-up | Sonnet | high | 1 per pass | 30 |

A timeout is enforced with an `AbortSignal` on the run. Running out of iterations with the work unfinished, or timing out, is a **role failure**. The host logs each role's token usage
(input, cache creation, cache read, output) into the run report. There's no dollar cap: Sandcastle spends against the Claude subscription's usage limit.

## Giving up and telling the human

Decided in [How Sandcastle gives up on an issue and tells the human](https://github.com/mpaulosky/Blazor-Server/issues/63).

**Build retry cap: 2 failed attempts.** A failed attempt is anything that stops the issue's pipeline (see **When a role fails**): the gate still red after the gate-fixer's attempts at either
checkpoint, or an architect, tester, backend or UI run failing or timing out. A scribe or reviewer failure, and a gate-fixer run that fails but leaves attempts for a later one,
don't count. Each failure posts an issue comment carrying `<!-- sandcastle:build-failed -->` with the attempt
number and the tail of the gate output or error. The first is retried next round; the second
adds `sandcastle:needs-human` with a fuller comment. The count is the marker comments posted since `needs-human` was last removed, so it survives restarts and a re-queue resets it.
A usage-limit stop and the time-budget stop never count.

**Issue-level `needs-human` removes `sandcastle:ready`**, so a re-queue re-runs intake on the current text before the build starts from `main`. PR-level `needs-human` leaves `ready`
alone.

**Workflow files.** The PAT has no Workflows permission, so a push touching `.github/workflows/**` is rejected. The host recognises that rejection and adds `sandcastle:needs-human` to
the issue instead of retrying it every round. That rejection is a safety net, not the plan: work that needs a `.github/workflows/**` change is filed as a manual issue without
the `Sandcastle` label, and a `Sandcastle` issue that depends on it lists it as a blocker. This includes Sandcastle's own upgrades to `pr-automerge.yml` and `sandcastle.yml`.

**Notification: the run ends red.** The PAT is the human's own, so GitHub never notifies them about Sandcastle's labels or comments. The host records every hand-back (`needs-info` or
`needs-human`) it applies in the run, and after all work is done a final workflow step fails the job when that list is non-empty. GitHub Actions then emails the person who triggered
the run, and scheduled runs notify the workflow's creator. A crash fails an earlier step, and the job summary tells a hand-back from a crash. Who gets the email for runs started by
Copilot's `pull_request_review` or by `workflow_run` can only be confirmed from live runs, so the trigger issue
([#82](https://github.com/mpaulosky/Blazor-Server/issues/82)) finds out and records the answer here. If this proves noisy, the upgrade path is a separate bot identity (a GitHub App
or machine user).

## Trigger and run environment

Decided in [How and where Sandcastle is triggered automatically](https://github.com/mpaulosky/Blazor-Server/issues/61), from
[Where an automatic Sandcastle trigger could run](https://github.com/mpaulosky/Blazor-Server/issues/54). The reasoning for the runner and token is in
[ADR 0002](../adr/0002-unattended-sandcastle-on-a-hosted-runner.md).

**Workflow:** `.github/workflows/sandcastle.yml` on `ubuntu-24.04`. It always checks out `main` (never the event's ref) with `persist-credentials: false`, sets up Node 22, runs `npm ci` to
install the locked dependencies (including the `tsx` devDependency), and then runs `npx --no-install tsx .sandcastle/main.mts` with `GH_TOKEN` set to `SANDCASTLE_GH_TOKEN`. The `gh` CLI
reads `GH_TOKEN`, and the host's own git fetches and pushes authenticate through `gh auth setup-git`, a credential helper in the runner's global git config that reads `GH_TOKEN` from the
host's environment. Nothing in the repository's `.git` holds the token, so the worktree and git metadata the sandbox mounts carry no credential. The step also passes `ANTHROPIC_API_KEY` when
that secret is set and `CLAUDE_CODE_OAUTH_TOKEN` otherwise, and an earlier step fails the job with a clear message when `SANDCASTLE_GH_TOKEN` or both Claude secrets are missing. Triggers:

- `issues: labeled` where the label is exactly `Sandcastle`;
- `issues` / `pull_request: unlabeled` where the label is exactly `sandcastle:needs-info` or `sandcastle:needs-human`;
- `pull_request_review` submitted by Copilot, and `workflow_run` completed for `Build and Test Suite` (the `name:` of `ci.yml`,
  since `workflow_run` matches workflow names, not file names), only for same-repo `feature/*` / `hotfix/*` heads, so a fork never runs with secrets;
- `workflow_dispatch`, and `schedule` every 2 hours as a backstop for blockers cleared by merges and PRs that fall behind `main` (`push: main` deliberately isn't a trigger).

Event triggers can't filter by label name, so every `labeled` / `unlabeled` event starts the workflow. The job's `if:` checks `github.event.label.name` against the
exact names above (and the fork and branch conditions), so labels the host applies (`sandcastle:ready`, `bug`) end as a skipped job and never start Sandcastle. For label
events it also requires `github.event.sender.login == github.repository_owner`, so only the owner adding `Sandcastle` or removing a hand-back label starts a run.
The one exception is intentional: the host's PAT adding
`Sandcastle` to split children fires `issues: labeled`, which queues a pending run that picks the children up.

**Main only.** A `workflow_dispatch` run starts only when `github.ref == 'refs/heads/main'`, so a manual run can never execute unreviewed host code from another branch
with the write token, and every other event runs the host code checked out from `main`.

**Overlap:** `concurrency: { group: sandcastle, cancel-in-progress: false }` on the **job**, not the workflow, so a filtered-out event is skipped before it takes the
pending slot and can't displace a real pending run. One run going and at most one pending. Every run re-reads the whole queue, so collapsed triggers lose nothing.

**Time:** the job has `timeout-minutes: 350`, and no new round starts after 4 hours. A usage or rate-limit error ends the run cleanly like the time budget: it doesn't fail roles or
bounce issues. The next trigger resumes the work.

**Secrets:**

- `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token` (valid one year) by default. When an `ANTHROPIC_API_KEY` secret is set, it's used instead.
- `SANDCASTLE_GH_TOKEN`: a fine-grained PAT limited to this repository with Contents RW, Issues RW, Pull requests RW, Actions RW and Metadata R, and **no Workflows permission**.
  It is separate from `RELEASE_PR_PAT`. All pushes and PRs use it, because `GITHUB_TOKEN` pushes don't start CI.

**Permissions:** the workflow declares `permissions: contents: read`, so `GITHUB_TOKEN` is read-only whatever the repository default is. Every write goes through the PAT.

**Renewal:** record each secret's expiry date in the setup issue and a calendar reminder. To renew the OAuth token, run `claude setup-token` and update the secret. To renew the PAT,
regenerate it under *Settings → Developer settings → Fine-grained tokens* with the same scopes and update the secret. An expired secret shows up as a red run with an auth error.

**Observability:** `.sandcastle/logs/` is uploaded with `actions/upload-artifact` (`if: always()`, 14-day retention). The job summary lists each issue or PR touched and its outcome
(published, deferred, handed back, role failed, gate failed, timed out), each hand-back with a link, and each role's token usage. There is no run-summary comment on issues or
PRs; the only comments are the ones the phases above post (intake verdicts, critique deferrals, architect design notes, follow-up pass summaries, build-failure markers and
hand-backs).

## Proposed module layout

`main.mts` stays the entry point and the round loop. Everything else moves to modules beside it so that parallel issues touch different files:

```text
.sandcastle/
  main.mts            round loop, early exit, time budget
  lib/config.mts      ROLE_AGENTS, labels, limits, queue scope
  lib/github.mts      gh helpers, labels, marker comments, dependency links
  lib/branches.mts    branch naming and fetching
  lib/gate.mts        blocker gate
  lib/intake.mts      intake run and verdict application
  lib/plan.mts        planner and critique
  lib/build.mts       role team, gate checkpoints, publish
  lib/follow-up.mts   PR sweep and passes
  lib/report.mts      job summary, token usage, hand-back list
  roles/*.md          role prompts and shared-rules.md
```

The file names are a proposal; the first implementation issue settles them.

## Out of scope

- A reusable cross-repo Sandcastle template.
- Human approval gates for plans or merges.

## Implementation issues

Filed with native "blocked by" links, so the blocker gate builds them in order and the trigger lands last. Three are manual and aren't labelled `Sandcastle`: the secrets, and the
two `.github/workflows/**` changes the PAT can't push (see **Workflow files**). A human builds the trigger once its blockers have landed.

| Issue | Blocked by |
|---|---|
| [Split main.mts into modules and configure every role from one ROLE_AGENTS map](https://github.com/mpaulosky/Blazor-Server/issues/66) | [#65](https://github.com/mpaulosky/Blazor-Server/pull/65) (this spec) |
| [One gate script shared by the pre-push hook, the sandbox and people](https://github.com/mpaulosky/Blazor-Server/issues/67) | #66 |
| [The host names branches and skips issues that already have a PR](https://github.com/mpaulosky/Blazor-Server/issues/68) | #66 |
| [Run the gate at two checkpoints with a gate-fixer role](https://github.com/mpaulosky/Blazor-Server/issues/69) | #66, #67 |
| [Skip the pre-push hook's gate for commits the sandbox already gated](https://github.com/mpaulosky/Blazor-Server/issues/70) | #69 |
| [Replace the implementer with a tester and a backend developer](https://github.com/mpaulosky/Blazor-Server/issues/71) | #69 |
| [Add architect, UI developer and scribe roles picked by the planner](https://github.com/mpaulosky/Blazor-Server/issues/72) | #68, #71 |
| [Hand an issue back to a human after two failed builds](https://github.com/mpaulosky/Blazor-Server/issues/73) | #69 |
| [Intake judges each issue against the Definition of Ready](https://github.com/mpaulosky/Blazor-Server/issues/74) | #68, #73 |
| [Intake splits oversized issues into blocked child issues](https://github.com/mpaulosky/Blazor-Server/issues/75) | #74 |
| [Critique each round's plan and defer picks that aren't safe in parallel](https://github.com/mpaulosky/Blazor-Server/issues/76) | #68 |
| [Sweep open Sandcastle PRs each round and keep them current](https://github.com/mpaulosky/Blazor-Server/issues/77) | #68, #73 |
| [Keep pr-automerge.yml from merging PRs handed back to a human (manual, not `Sandcastle`)](https://github.com/mpaulosky/Blazor-Server/issues/84) | none |
| [Follow-up passes resolve review threads and merge conflicts](https://github.com/mpaulosky/Blazor-Server/issues/78) | #69, #77, #84 |
| [Follow-up passes fix red CI on Sandcastle PRs](https://github.com/mpaulosky/Blazor-Server/issues/79) | #78 |
| [Make Sandcastle runs safe to start unattended](https://github.com/mpaulosky/Blazor-Server/issues/80) | #74, #77 |
| [Write a run report with outcomes, hand-backs and token usage](https://github.com/mpaulosky/Blazor-Server/issues/81) | #73 |
| [Create the secrets Sandcastle needs to run from GitHub Actions (manual, not `Sandcastle`)](https://github.com/mpaulosky/Blazor-Server/issues/83) | none |
| [Trigger Sandcastle automatically from GitHub Actions (manual, not `Sandcastle`)](https://github.com/mpaulosky/Blazor-Server/issues/82) | #70, #72, #75, #76, #79, #80, #81, #83 |
