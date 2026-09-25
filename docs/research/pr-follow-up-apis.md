# Research: GitHub APIs for automated PR review follow-up

Research ticket: [#55](https://github.com/mpaulosky/Blazor-Server/issues/55)
(map [#52](https://github.com/mpaulosky/Blazor-Server/issues/52)).
Researched 2026-09-25 against GitHub Docs, the live GraphQL schema
(introspection), and this repo's PR #50.

## Question

What GitHub API surface does an agent need to act on review feedback and get a
PR merge-ready without a human? The ticket asks five things:

1. List review threads and comments by author, reply to a thread, resolve it.
   What permissions each call needs, and can a fine-grained PAT resolve threads?
2. Does Copilot re-review after each push, and how is "Copilot has reviewed the
   current head" detected?
3. Detecting `BEHIND` and `DIRTY`, and `update-branch` versus a local
   merge or rebase.
4. Reading failed check-run logs for a PR.
5. What `GITHUB_TOKEN` can do compared with a PAT.

## Short answers

- **Threads:** read them with GraphQL `pullRequest.reviewThreads` (the only API
  that exposes `id`, `isResolved`, and `isOutdated`), reply with REST
  `POST …/comments/{id}/replies` or GraphQL `addPullRequestReviewThreadReply`,
  and resolve with GraphQL `resolveReviewThread`. REST has no resolve endpoint.
  A fine-grained PAT can resolve threads, but GitHub staff confirm it needs
  **Contents: write** as well as **Pull requests: write**. That requirement is
  not in the docs.
- **Copilot re-review:** it happens only when the ruleset's **Review new
  pushes** option is on. This repo's `main-rules` ruleset has
  `review_on_push: true`, and PR #50 shows a Copilot review request and review
  after every push, merge-from-main commits included. "Reviewed the head"
  means some Copilot review's `commit.oid` equals `headRefOid`. A review is
  still pending while Copilot is listed in `reviewRequests`.
- **Behind or conflicted:** GraphQL `mergeStateStatus` (`BEHIND`, `DIRTY`,
  `BLOCKED`, `UNSTABLE`, `CLEAN`, `UNKNOWN`) and `mergeable` (`MERGEABLE`,
  `CONFLICTING`, `UNKNOWN`). `PUT …/update-branch` (or GraphQL
  `updatePullRequestBranch`, which also accepts `REBASE`) fixes `BEHIND`
  server-side, but it can't resolve conflicts. `DIRTY` needs a local merge or
  rebase and a push.
- **Red CI:** a fine-grained PAT can't call the Checks API. Use the Actions API
  instead: list runs by `head_sha`, list jobs, download job logs, or run
  `gh run view --log-failed`. Each needs **Actions: read**. On a public repo,
  reads work without the permission.
- **`GITHUB_TOKEN`:** it can make all of these calls with the right
  `permissions:` block. Pushes it makes don't start workflows, and
  `pull_request` events it causes create runs that wait for approval. Pushing
  a fix that must trigger CI therefore needs a PAT or a GitHub App token.

## 1. Review threads and comments

### Reading threads with author and resolution state

REST exposes review *comments* but has no thread object and no resolved flag.
[`GET /repos/{owner}/{repo}/pulls/{pull_number}/comments`][rest-comments]
returns each comment with `id`, `in_reply_to_id`, `user.login`, `user.type`,
`commit_id`, `path`, and `line`. Threads have to be rebuilt from
`in_reply_to_id`.

GraphQL has
[`PullRequest.reviewThreads`][gql-objects] with `id` (the node ID
`resolveReviewThread` needs), `isResolved`, `isOutdated`, `path`, `line`,
`resolvedBy`, and the thread's `comments`, including each author's
`__typename`:

```bash
gh api graphql -F owner=mpaulosky -F repo=Blazor-Server -F number=50 -f query='
query($owner:String!,$repo:String!,$number:Int!){
  repository(owner:$owner,name:$repo){
    pullRequest(number:$number){
      headRefOid
      reviewThreads(first:100){
        totalCount
        nodes{
          id isResolved isOutdated path line
          comments(first:50){
            nodes{ databaseId author{ login __typename } body commit{ oid } }
          }
        }
      }
    }
  }
}'
```

The first comment's author tells a Copilot thread from a human one. PR #50
shows how the same bot is reported by each API:

| API | Copilot comment author |
|-----|------------------------|
| REST `pulls/{n}/comments` | `user.login: "Copilot"`, `user.type: "Bot"` |
| GraphQL `author` | `login: "copilot-pull-request-reviewer"`, `__typename: "Bot"` |
| GraphQL `reviews(author:)` filter argument | `"copilot-pull-request-reviewer[bot]"` (with suffix) |

Every Copilot review on PR #50 has `state: COMMENTED`.
[Copilot only approves when approvals are enabled][copilot-review].

### Replying to a thread

- REST:
  [`POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies`][rest-reply]
  with `{"body": "…"}`. `comment_id` must be the thread's **top-level**
  comment. The docs say "Replies to replies are not supported."
- GraphQL: [`addPullRequestReviewThreadReply`][gql-mutations] with
  `pullRequestReviewThreadId` and `body`. `pullRequestReviewId` is optional
  and attaches the reply to a pending review.

```bash
gh api -X POST repos/mpaulosky/Blazor-Server/pulls/50/comments/4108131169/replies \
  -f body='Fixed in abc1234.'

gh api graphql -f query='
mutation($id:ID!,$body:String!){
  addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$id, body:$body}){
    comment{ id }
  }
}' -f id=PRRT_kwDOUn9xdc6mIxGC -f body='Fixed in abc1234.'
```

On PR #50, each human reply made this way also shows up as a separate
`COMMENTED` review in `reviews`, which is why `pr-automerge.yml` filters
`reviews` by author.

### Resolving a thread

GraphQL only: [`resolveReviewThread`][gql-mutations]
(`unresolveReviewThread` reverses it). The live schema's input is `threadId`
(required) and an optional `resolutionReason` of type
`PullRequestReviewThreadResolutionReason` (`ADDRESSED`, `WONT_FIX`, or
`INVALID`, described as "The reason a Copilot code review thread was
resolved"). No REST equivalent exists.

```bash
gh api graphql -f query='
mutation($id:ID!){
  resolveReviewThread(input:{threadId:$id, resolutionReason:ADDRESSED}){
    thread{ id isResolved }
  }
}' -f id=PRRT_kwDOUn9xdc6mIxGC
```

**Can a fine-grained PAT resolve threads?** Yes, but GitHub Docs don't list
permissions for GraphQL mutations. The
[fine-grained permissions table][fg-perms] covers REST endpoints only, and the
[GraphQL guide][gql-forming] says that when a permission is missing, "the API
will return an error message that states the scopes or permissions your token
needs". A GitHub Community report,
[discussion #204269][disc-204269] (August 2026), found that:

- `resolveReviewThread` fails with "Resource not accessible by personal access
  token" when the token has Metadata: read, Contents: read, and Pull requests:
  read/write.
- It succeeds after Contents is raised to read/write.
- A GitHub staff member called this "reproducible and known-shaped", because
  pull requests count as code-bearing surfaces in the permission model.
- The staff member confirmed that no REST alternative exists.

Treat **Contents: write + Pull requests: write** as the requirement until the
docs say otherwise.

## 2. Copilot re-review and "reviewed the current head"

[Using Copilot code review][copilot-review] says that after a push to a PR
Copilot has already reviewed, "it won't automatically re-review your changes
unless you've configured it to review new pushes after enabling automatic
reviews". The option is **Review new pushes** in a ruleset
([Configuring code review by Copilot][copilot-config]). The same page notes
that on a re-review Copilot "may repeat the same comments again, even if they
have been dismissed with the 'Resolve conversation' button".

This repo's `main-rules` ruleset (`gh api repos/mpaulosky/Blazor-Server/rulesets/23905366`)
contains:

```json
{"type":"copilot_code_review","parameters":{"review_draft_pull_requests":true,"review_on_push":true}}
```

PR #50's timeline confirms the behaviour. Each push is followed by a
`ReviewRequestedEvent` for the `copilot-pull-request-reviewer` bot (with the
pusher as actor) and then a Copilot review whose `commit.oid` is the pushed
head:

| Pushed head | Copilot review commit |
|-------------|-----------------------|
| `941e56f` | `941e56f` |
| `0d7e8c8` (merge from `main`) | `0d7e8c8` |
| `5db31d9` + `f56f327` (one push) | `f56f327` |
| `6f9391b` | `6f9391b` |
| `a08bc9a` | `a08bc9a` |

When several commits arrive in one push, only the final head gets a review.

**Detection.** Copilot has reviewed the head when some review by Copilot has
`commit.oid == headRefOid`. `pr-automerge.yml` already uses this check. Filter
by author so human thread replies, each of which counts as a review, don't
push Copilot's reviews off the page. A review is still pending while Copilot
appears in `reviewRequests`:

```graphql
pullRequest(number: 50) {
  headRefOid
  reviewRequests(first: 10) { nodes { requestedReviewer { __typename ... on Bot { login } } } }
  copilotReviews: reviews(last: 20, author: "copilot-pull-request-reviewer[bot]") {
    nodes { commit { oid } submittedAt state }
  }
}
```

To re-request a review by API, the live schema's `requestReviewsByLogin`
mutation takes `botLogins`, described as "including the [bot] suffix (e.g.,
'copilot-pull-request-reviewer[bot]')". REST
`POST …/pulls/{n}/requested_reviewers` needs **Pull requests: write**
([fine-grained table][fg-perms]).

## 3. BEHIND and DIRTY; update-branch versus a local merge

GraphQL [enums][gql-enums], with descriptions confirmed by live introspection:

| `mergeStateStatus` | Meaning |
|--------------------|---------|
| `BEHIND` | The head ref is out of date. |
| `DIRTY` | The merge commit cannot be cleanly created. |
| `BLOCKED` | The merge is blocked. |
| `UNSTABLE` | Mergeable with non-passing commit status. |
| `HAS_HOOKS` | Mergeable with passing commit status and pre-receive hooks. |
| `CLEAN` | Mergeable and passing commit status. |
| `UNKNOWN` | The state cannot currently be determined. |

`mergeable` is `MERGEABLE`, `CONFLICTING`, or `UNKNOWN`. REST
[`GET /pulls/{n}`][rest-pulls] returns `mergeable` (`true`, `false`, or
`null`) and `mergeable_state`. A `null` means GitHub is still computing the
value, so the request should be retried. PR #50, queried after its merge,
returned `UNKNOWN` and `null`.

`BEHIND` matters here because `main-rules` sets
`strict_required_status_checks_policy: true`, which requires the branch to be
up to date with `main`.

**Server-side update.**
[`PUT /repos/{owner}/{repo}/pulls/{pull_number}/update-branch`][rest-update-branch]
"updates the pull request branch with the latest upstream changes by merging
HEAD from the base branch into the pull request branch". It takes
`expected_head_sha` and returns 422 if the head has moved. Responses are
202, 403, or 422. It needs **Pull requests: write** ([fine-grained table][fg-perms]).
A GitHub App also needs write access to the head repo's contents. The GraphQL
equivalent is [`updatePullRequestBranch`][gql-mutations] (`pullRequestId`,
`expectedHeadOid`, and `updateMethod`, which is `MERGE` by default or
`REBASE`). This repo's ruleset requires linear history, but that applies to
`main`, not to PR branches, and PRs are squash-merged.

```bash
gh api -X PUT repos/mpaulosky/Blazor-Server/pulls/57/update-branch \
  -f expected_head_sha="$(gh pr view 57 --json headRefOid -q .headRefOid)"
```

**Local merge or rebase.** Conflicts (`DIRTY` or `CONFLICTING`) can't be fixed
server-side. The agent has to `git fetch origin main`, merge or rebase, resolve
the conflicts, and `git push`. A push over HTTPS with a fine-grained PAT needs
**Contents: write**, plus **Workflows: write** if the push touches
`.github/workflows/` ([fine-grained table][fg-perms], "Workflows" section).

Either way the head moves, so CI re-runs and Copilot re-reviews (see §2).

## 4. Reading failed CI logs

- The [Checks API][rest-checks] (`GET /commits/{ref}/check-runs`, check-run
  annotations) is readable by "OAuth apps and authenticated users", but the
  fine-grained PAT docs list "Using fine-grained personal access token to call
  the Checks API" as a [known limitation][pat-limits]. The
  [fine-grained permissions table][fg-perms] has no "Checks" permission.
- All of this repo's required checks come from Actions workflows, so the
  [Actions API][rest-runs] covers them, and fine-grained PATs support it with
  **Actions: read**:

```bash
SHA=$(gh pr view 57 --json headRefOid -q .headRefOid)
# Runs for the head commit, keeping the failed ones
gh api "repos/mpaulosky/Blazor-Server/actions/runs?head_sha=$SHA" \
  -q '.workflow_runs[] | select(.conclusion=="failure") | {id, name}'
# Failed jobs in a run
gh api repos/mpaulosky/Blazor-Server/actions/runs/RUN_ID/jobs \
  -q '.jobs[] | select(.conclusion=="failure") | {id, name}'
# Plain-text log for one job (a 302 redirect that expires after 1 minute)
gh api repos/mpaulosky/Blazor-Server/actions/jobs/JOB_ID/logs
# Or, through the CLI, only the failed steps
gh run view RUN_ID --log-failed
```

[`GET /actions/jobs/{job_id}/logs`][rest-job-logs] returns "a redirect URL to
download a plain text file of logs … This link expires after 1 minute", and
"anyone with read access to the repository can use this endpoint".
`gh run view --log-failed` shows "the log for any failed steps in a run or
specific job" (`gh run view --help`). `POST …/actions/runs/{id}/rerun-failed-jobs`
re-runs flaky jobs and needs **Actions: write**.

## 5. `GITHUB_TOKEN` versus a PAT

[`GITHUB_TOKEN`][gh-token] is a GitHub App installation token scoped to the
repository. Its permissions are set with the workflow's
[`permissions:`][wf-permissions] key (`actions`, `checks`, `contents`,
`pull-requests`, `statuses`, and others). Because it's an App token, it can
read the Checks API, which a fine-grained PAT can't.

The limit that matters here is triggering. The docs say "events triggered by
the `GITHUB_TOKEN` will not create a new workflow run", with these exceptions:

- `workflow_dispatch` and `repository_dispatch` always create runs.
- `pull_request` `opened`, `synchronize`, or `reopened` events create runs "in
  an **approval-required** state" that a user with write access has to approve.

A push of fixes or a branch update made with `GITHUB_TOKEN` therefore leaves
the required checks either not running or waiting for approval. The docs
recommend "a GitHub App installation access token or a personal access token"
when runs must start without approval. `pr-automerge.yml` already works around
the same limit for merges, using `RELEASE_PR_PAT` so that `release.yml` runs.

## Permissions per call

Fine-grained PAT permissions come from the
[fine-grained permissions table][fg-perms] unless noted. The last column gives
the `permissions:` key a `GITHUB_TOKEN` needs, per
[workflow syntax][wf-permissions].

| Call | Purpose | Fine-grained PAT | `GITHUB_TOKEN` |
|------|---------|------------------|----------------|
| `GET /pulls/{n}` | `mergeable`, `mergeable_state`, head SHA | Pull requests: read | `pull-requests: read` |
| `GET /pulls/{n}/comments` | Review comments (REST) | Pull requests: read | `pull-requests: read` |
| `GET /pulls/{n}/reviews` | Reviews and their commit | Pull requests: read | `pull-requests: read` |
| GraphQL `reviewThreads`, `reviews`, `mergeStateStatus` | Thread state, Copilot head review | Pull requests: read (per resource read) | `pull-requests: read` |
| `POST /pulls/{n}/comments/{id}/replies` | Reply to a thread | Pull requests: write | `pull-requests: write` |
| GraphQL `addPullRequestReviewThreadReply` | Reply to a thread | Pull requests: write (not documented per mutation) | `pull-requests: write` |
| GraphQL `resolveReviewThread` | Resolve a thread | Pull requests: write **and Contents: write** ([#204269][disc-204269]) | `pull-requests: write` + `contents: write` |
| `POST /pulls/{n}/requested_reviewers` / `requestReviewsByLogin` | Re-request Copilot | Pull requests: write | `pull-requests: write` |
| `PUT /pulls/{n}/update-branch` / `updatePullRequestBranch` | Fix `BEHIND` | Pull requests: write | `pull-requests: write` (App tokens also need contents write) |
| `git push` over HTTPS | Push fixes or a conflict resolution | Contents: write (+ Workflows: write for `.github/workflows/`) | `contents: write`; `permissions:` has no `workflows` key; starts no workflows |
| `GET /actions/runs?head_sha=` | Find CI runs for the head | Actions: read | `actions: read` |
| `GET /actions/runs/{id}/jobs` | Find failed jobs | Actions: read | `actions: read` |
| `GET /actions/jobs/{id}/logs` | Download a job log | Actions: read | `actions: read` |
| `POST /actions/runs/{id}/rerun-failed-jobs` | Re-run flaky jobs | Actions: write | `actions: write` |
| `GET /commits/{ref}/check-runs` | Check runs and annotations | Not supported ([limitation][pat-limits]) | `checks: read` |
| `PUT /pulls/{n}/merge` | Merge (already done by `pr-automerge.yml`) | Contents: write | `contents: write` |

All fine-grained PATs include read access to public repositories
([GraphQL guide][gql-forming]). Blazor-Server is public, so the read rows work
with Sandcastle's current token. For the writes, Sandcastle's `GH_TOKEN`
(Issues read/write and Metadata only) would need **Pull requests: read/write**
and **Contents: read/write**, **Actions: read/write** to re-run jobs, and
**Workflows: read/write** only if it edits workflow files. REST responses
include an `X-Accepted-GitHub-Permissions` header that names the permissions
an endpoint needs ([fine-grained table][fg-perms]).

## Sources

- [Permissions required for fine-grained personal access tokens][fg-perms]
- [Managing your personal access tokens: fine-grained limitations][pat-limits]
- [REST: Pull request review comments][rest-comments]
- [REST: Create a reply for a review comment][rest-reply]
- [REST: Pulls (get, merge)][rest-pulls]
- [REST: Update a pull request branch][rest-update-branch]
- [REST: Check runs][rest-checks]
- [REST: Workflow runs][rest-runs]
- [REST: Download job logs][rest-job-logs]
- [GraphQL mutations][gql-mutations], [GraphQL enums][gql-enums],
  [GraphQL objects][gql-objects], [Forming calls with GraphQL][gql-forming]
- [Using Copilot code review][copilot-review]
- [Configuring automatic code review by Copilot][copilot-config]
- [`GITHUB_TOKEN`][gh-token]
- [Workflow syntax: `permissions`][wf-permissions]
- [GitHub Community discussion #204269: `resolveReviewThread` requires Contents: write][disc-204269]
- Evidence: `gh api graphql` against PR #50 (`reviews`, `reviewThreads`,
  `timelineItems`), `gh api repos/mpaulosky/Blazor-Server/pulls/50/comments`,
  `gh api repos/mpaulosky/Blazor-Server/rulesets/23905366`, and GraphQL
  schema introspection (`__type`) on 2026-09-25.

[fg-perms]: https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens
[pat-limits]: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#fine-grained-personal-access-tokens-limitations
[rest-comments]: https://docs.github.com/en/rest/pulls/comments#list-review-comments-on-a-pull-request
[rest-reply]: https://docs.github.com/en/rest/pulls/comments#create-a-reply-for-a-review-comment
[rest-pulls]: https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request
[rest-update-branch]: https://docs.github.com/en/rest/pulls/pulls#update-a-pull-request-branch
[rest-checks]: https://docs.github.com/en/rest/checks/runs
[rest-runs]: https://docs.github.com/en/rest/actions/workflow-runs
[rest-job-logs]: https://docs.github.com/en/rest/actions/workflow-jobs#download-job-logs-for-a-workflow-run
[gql-mutations]: https://docs.github.com/en/graphql/reference/mutations
[gql-enums]: https://docs.github.com/en/graphql/reference/enums#mergestatestatus
[gql-objects]: https://docs.github.com/en/graphql/reference/objects#pullrequestreviewthread
[gql-forming]: https://docs.github.com/en/graphql/guides/forming-calls-with-graphql
[copilot-review]: https://docs.github.com/en/copilot/using-github-copilot/code-review/using-copilot-code-review#requesting-a-re-review-from-copilot
[copilot-config]: https://docs.github.com/en/copilot/how-tos/copilot-on-github/set-up-copilot/configure-code-review
[gh-token]: https://docs.github.com/en/actions/concepts/security/github_token
[wf-permissions]: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions
[disc-204269]: https://github.com/orgs/community/discussions/204269
