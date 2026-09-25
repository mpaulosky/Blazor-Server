# Sandcastle 0.12 capabilities for multi-role agents and follow-up runs

Research for [#53](https://github.com/mpaulosky/Blazor-Server/issues/53) (map
[#52](https://github.com/mpaulosky/Blazor-Server/issues/52)). Checked on 2026-09-25 against
`@ai-hero/sandcastle` **0.12.0** as installed by `npm ci` (`node_modules/@ai-hero/sandcastle/package.json`)
and the Claude Code docs at <https://code.claude.com/docs>.

Paths below are relative to `node_modules/@ai-hero/sandcastle/`. The package ships only the bundled
`dist/` plus `README.md`; the ADRs the README links to (`docs/adr/…`) aren't in the npm tarball.
Line numbers refer to the 0.12.0 bundle.

## 1. Do repo `.claude/agents/` subagents and `.claude/skills/` load in a sandboxed `claudeCode` run?

**Yes: the sandboxed agent is a plain, non-bare `claude --print` run started in the repo worktree, so
project-level subagents and skills are discovered the same way as in an interactive session.**

How Sandcastle starts Claude Code:

- `claudeCode()` builds exactly this command (`dist/index.js:3415-3432`):
  `claude --print --verbose --dangerously-skip-permissions --output-format stream-json --model <model> [--effort …] [--resume <id> [--fork-session]] -p -`
  with the prompt on stdin. No `--bare`, `--setting-sources`, `--agents`, `--append-system-prompt`
  or `--add-dir` flag is passed, and `ClaudeCodeOptions` exposes only `effort`, `env`,
  `captureSessions` and `permissionMode` (`README.md:964-969`, `dist/index.d.ts:220`).
- AFK runs always ask for `dangerouslySkipPermissions: true` (`dist/index.js:252-257`); setting
  `permissionMode` swaps that for `--permission-mode <mode>` (`dist/index.js:3426`).
- The worktree is bind-mounted at `/home/agent/workspace` and commands run there by default
  (`SANDBOX_REPO_DIR`, `dist/chunk-VOG34SRF.js:26406`; `dist/chunk-CP3TYXZA.js:134-136`;
  comment in `.sandcastle/Dockerfile`). The worktree is a checkout of the issue branch, so the
  agent sees whatever `.claude/` content is committed on that branch.
- The Docker provider mounts only the worktree plus any `mounts` you configure; nothing mounts the
  host's `~/.claude` (`dist/sandboxes/docker.js`, `dist/chunk-CP3TYXZA.js:120-145`). The container's
  home is the image's `/home/agent`, so **personal** (`~/.claude/agents`, `~/.claude/skills`) content
  on the host is not available unless it is baked into the image or mounted.

What Claude Code does with that:

- "Without it [`--bare`], `claude -p` loads the same context an interactive session would, including
  anything configured in the working directory or `~/.claude`." `--bare` is what skips "hooks, skills,
  custom commands, subagents, installed plugins, MCP servers, auto memory, and CLAUDE.md."
  — <https://code.claude.com/docs/en/headless#start-faster-with-bare-mode>. The same page notes
  `--bare` "will become the default for `-p` in a future release"; Sandcastle 0.12 doesn't pass it
  today, and would need to pass `--agents`/`--settings` etc. if that default changes.
- Project subagents come from `.claude/agents/`, "discovered by walking up from the current working
  directory"; priority is managed > `--agents` flag > `.claude/agents/` > `~/.claude/agents/` > plugins.
  A subagent's model resolves from the per-call `model` parameter, then its `model` frontmatter, then
  `CLAUDE_CODE_SUBAGENT_MODEL`, then the main model. "By default, a subagent can spawn subagents of its
  own, up to three layers below the main conversation." A `skills` frontmatter field preloads skill
  content into the subagent. — <https://code.claude.com/docs/en/sub-agents>
- Project skills load "from `.claude/skills/` in the directory where you start it and in every parent
  directory up to the repository root"; personal skills live in `~/.claude/skills/`.
  — <https://code.claude.com/docs/en/skills>
- In `-p` mode "User-invoked skills and custom commands work. Include `/skill-name` in the prompt string
  and Claude Code expands it before running." — <https://code.claude.com/docs/en/headless#create-a-commit>
- A `-p` run "stays open until" background subagents finish (default 10-minute idle ceiling,
  `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS`). Subagent `tool_use`/`tool_result` blocks appear in the
  `stream-json` output with a non-null `parent_tool_use_id`. — <https://code.claude.com/docs/en/headless>

Sandcastle-side support for subagents:

- Session capture copies "any `Agent`-tool or `Workflow`-tool subagent transcripts written under
  `<session-id>/subagents/agent-*.jsonl`" back to the host alongside the main session
  (`README.md:885-891`).
- Sandcastle's `idleTimeoutSeconds` (default 600) resets on each agent output event
  (`README.md:394`). Subagent tool events are streamed by default (see above), so an active subagent
  keeps resetting it.

What this repo has today (`git ls-files` on `main`):

- `.claude/skills/` holds six tracked skills: `dotnet-add-testing`, `dotnet-inspect`,
  `dotnet-project-analysis`, `dotnet-tdd`, `dotnet-testing-strategy`, `dotnet-xunit` (plus supporting
  files). These load in the sandbox.
- There is **no** `.claude/agents/`, no `CLAUDE.md`, no `.claude/settings.json` and no `.mcp.json`
  tracked. `.github/agents/beast.agent.md` is a GitHub Copilot agent file, which Claude Code doesn't read.
- Skills such as `research`, `tdd`, `code-review` that the maintainer uses locally are personal
  (`~/.claude/skills`) and would not be present in the sandbox.

**So both shapes are possible:** one `sandbox.run()` whose prompt delegates to committed
`.claude/agents/*.md` role subagents (each with its own model/tools/skills), or separate `sandbox.run()`
calls, each with its own prompt file and `claudeCode(model)`. Only the second gives the host a
per-role result object (commits, stdout, session id, usage) and a place to branch in TypeScript between
roles; subagent output is only visible inside the parent's stream and captured transcripts.

## 2. Several sequential runs in one `createSandbox()`; limits on structured output

**Yes, any number of sequential `sandbox.run()` calls, each with its own agent/model, prompt and
iteration budget. Structured output (`Output.object`/`Output.string`) is not available on
`sandbox.run()` at all in 0.12 — only on top-level `run()`, and there only with `maxIterations: 1`.**

- `createSandbox()` "creates the sandbox once, and you call `sandbox.run()` as many times as you need
  … Commits from all `run()` calls accumulate on the same branch. The sandbox container stays alive
  between runs." The README's own example runs an implementer on `claude-opus-*` then a reviewer on
  `claude-sonnet-*` (`README.md:261-312`).
- `SandboxRunOptions` = `agent`, `prompt` | `promptFile`, `promptArgs`, `maxIterations`,
  `resumeSession`, `completionSignal`, `idleTimeoutSeconds`, `completionTimeoutSeconds`, `name`,
  `logging`, `signal` (`dist/index.d.ts:745-780`). There is **no `output` field**; `output` exists only
  on `RunOptions` (`dist/index.d.ts:587`).
- Top-level `run()` rejects `output` unless `maxIterations === 1`: "output requires maxIterations to
  be 1. Structured output is only supported for single-iteration runs." (`dist/index.js:1009-1011`).
  The prompt must contain the opening tag literal; failures throw `StructuredOutputError`, and
  `Output.object({ …, maxRetries })` resumes the same session to retry (`README.md:685-748`).
- `sandbox.exec(cmd)` runs a shell command in the same warm container and returns (not throws) a
  non-zero `exitCode` (`README.md:314-341`, `README.md:380`). This is a way for the host to check
  state between roles, or to read a file an agent wrote as a substitute for structured output.
- `resumeSession` is incompatible with `maxIterations > 1` (`dist/index.js:1579-1584`). A
  `SandboxRunResult` has `resume(prompt)` and `fork(prompt)` that continue the captured session for
  one more iteration in the same warm sandbox (`README.md:410-411`, `dist/index.js:1728-1741`).
- Hooks and `copyToWorktree` are given to `createSandbox()` and run once at creation, not per
  `run()` (`README.md:368-369`).
- `sandbox.close()` removes container and worktree when the worktree is clean, and preserves the
  worktree (returning `preservedWorktreePath`) when it has uncommitted changes (`README.md:343-359`).

## 3. Creating a sandbox on an existing remote branch; resuming or reusing a worktree

**Partly. There is no "check out `origin/<branch>`" option, but git's own DWIM makes it work when the
host has already fetched the remote branch. There is a new, undocumented-in-README `baseBranch` option,
worktree reuse with fast-forward from origin, and agent-session resume.**

Branch/worktree creation (`create`, `dist/chunk-VOG34SRF.js:25265-25355`):

1. Worktrees live at `.sandcastle/worktrees/<branch with / → ->`.
2. If a Sandcastle-managed worktree for that branch already exists, it is **reused**. If it's dirty it is
   used as-is with a warning; if clean, `fastForwardFromOrigin` runs `git fetch origin <branch>` and
   `git merge --ff-only origin/<branch>`, logging and continuing unchanged if the fetch fails or the
   branch has diverged (`dist/chunk-VOG34SRF.js:25209-25264`, `25287-25300`). The README cites
   ADR 0003 "reuse worktree by default" (`README.md:554`).
3. If the branch is checked out in a worktree Sandcastle doesn't manage (for example the main checkout),
   it fails with `WorktreeError` (`dist/chunk-VOG34SRF.js:25302-25306`).
4. Otherwise it runs `git worktree add <path> <branch>`. Only if git says `invalid reference` does it
   fall back to `git worktree add -b <branch> <path> <baseBranch ?? HEAD>` (`dist/chunk-VOG34SRF.js:25308-25329`).

Consequences for a PR follow-up on an already-published branch:

- If only `origin/<branch>` exists locally as a remote-tracking ref, step 4's plain `git worktree add`
  uses git's DWIM: "If `<commit-ish>` is a branch name … and is not found, … but there does exist a
  tracking branch in exactly one remote … treat as equivalent to
  `git worktree add --track -b <branch> <path> <remote>/<branch>`."
  — <https://git-scm.com/docs/git-worktree>. So the host must `git fetch origin <branch>` before
  `createSandbox()`.
- If the remote-tracking ref is missing, git reports `invalid reference` and Sandcastle **silently
  creates a new branch from `baseBranch` or host `HEAD`** instead of the published one.
- If a stale **local** branch of that name exists and no managed worktree does, step 4 checks out the
  local branch as-is; the fast-forward in step 2 only runs when reusing an existing managed worktree.
- `.sandcastle/main.mts` calls `sandbox.close()` in `finally`, which removes a clean worktree, so the
  next run takes the step 4 path rather than the reuse path.
- `CreateSandboxOptions.baseBranch` — "Ref to fork from when `branch` does not yet exist. Ignored when
  the branch already exists. Defaults to `HEAD`." (`dist/index.d.ts:709-734`, wired at
  `dist/index.js:1993-2005`). `run()`'s `branchStrategy: { type: "branch", branch, baseBranch }` has the
  same field, with "Callers are responsible for ensuring the ref is current (e.g. `git fetch`)"
  (`dist/SandboxProvider-EkSMuBp8.d.ts:204-214`). Neither is in the README tables.

Other reuse mechanisms:

- `createWorktree({ branchStrategy, copyToWorktree })` gives a worktree whose lifetime is separate from
  any sandbox; `wt.createSandbox()` / `wt.run()` can be called repeatedly and `sandbox.close()` then tears
  down only the container (`README.md:419-472`, `dist/index.js:2161`).
- Agent **session** resume: every Claude Code iteration's session JSONL is captured to the host
  (`~/.claude/projects/<encoded-path>/<id>.jsonl`, `README.md:885-891`); `resumeSession: <id>` on
  `run()`/`sandbox.run()`/`wt.run()` passes `--resume <id>` in a new sandbox, requires the session file
  to exist on the host and `maxIterations` of 1 (`README.md:893-927`). `result.fork()` uses
  `--fork-session` and isolates only the session, not the branch or worktree (`README.md:929-954`).
  `IterationResult.sessionId`/`sessionFilePath` expose the id (`README.md:868-874`).

## 4. Triggering, CI, watch mode

**No trigger, watch mode or GitHub Action ships with Sandcastle; it is a library plus a setup CLI.
Triggering is left to whatever runs `npx tsx .sandcastle/main.mts`.**

- The `sandcastle` binary has only `init`, `docker build-image|remove-image` and
  `podman build-image|remove-image` subcommands (`dist/main.js:19268`, `19324`, `19326-19337`;
  `README.md:764-830`). There is no `run`, `watch` or `serve` command.
- No template contains a GitHub Actions workflow (`dist/templates/*`: `blank`, `simple-loop`,
  `sequential-reviewer`, `parallel-planner`, `parallel-planner-with-review`).
- CI-relevant facts:
  - The README positions `run()` "for use in scripts, CI pipelines, or custom tooling" (`README.md:106`)
    and calls `merge-to-head` the "safe default for automation … Use this for CI or unattended runs"
    (`README.md:1276`).
  - `sandcastle init` has a `--flag` for every prompt and "fails fast" without a TTY
    (`README.md:772-784`).
  - Sandbox providers: Docker, Podman, Vercel (Firecracker microVMs), Daytona, and `noSandbox()`
    (`package.json` exports; `README.md:66-77`). A CI runner without Docker could use an isolated
    cloud provider or `noSandbox()`.
  - Auth comes from `.sandcastle/.env` or `process.env` (`CLAUDE_CODE_OAUTH_TOKEN` or
    `ANTHROPIC_API_KEY`, `README.md:42`, `README.md:1000-1022`), so CI secrets can be passed as env vars.
  - Runs accept an `AbortSignal`, and `logging.onAgentStreamEvent` forwards every text/tool/raw event
    to a callback (`README.md:216-233`, `README.md:399`).
- Claude Code itself documents running under GitHub Actions (<https://code.claude.com/docs/en/github-actions>),
  separate from Sandcastle.
