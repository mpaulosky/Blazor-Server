---
post_title: "Bump github/codeql-action from 4.38.0 to 4.38.1 in the all-actions group"
author1: mpaulosky
post_slug: "v0.0.7-pr-2"
microsoft_alias: n/a
featured_image: ""
categories:
  - engineering
tags:
  - release:v0.0.7
  - automation
ai_note: "Backfilled for issue #21 from the PR title/body in the release automation format"
summary: "Release notes seed for v0.0.7 from PR #2."
post_date: "2026-09-23"
---
## Bump github/codeql-action from 4.38.0 to 4.38.1 in the all-actions group

- **Release tag:** `v0.0.7`
- **Source PR:** [#2](https://github.com/mpaulosky/Blazor-Server/pull/2)

### PR description

Bumps the all-actions group with 1 update: [github/codeql-action](https://github.com/github/codeql-action).

Updates `github/codeql-action` from 4.38.0 to 4.38.1
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a href="https://github.com/github/codeql-action/releases">github/codeql-action's releases</a>.</em></p>
<blockquote>
<h2>v4.38.1</h2>
<ul>
<li>The CodeQL Action now has experimental support for CodeQL releases for which per-language bundles are available. Per-language bundles support analysis for a single language and are therefore smaller than the combined bundles that allow analysis for all supported languages. As a result, per-language bundles take up less space on disk and are faster to download. We expect to roll this change out to everyone in the coming weeks. <a href="https://redirect.github.com/github/codeql-action/pull/4146">#4146</a></li>
</ul>
</blockquote>
</details>
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a href="https://github.com/github/codeql-action/blob/main/CHANGELOG.md">github/codeql-action's changelog</a>.</em></p>
<blockquote>
<h2>4.38.1 - 18 Sept 2026</h2>
<ul>
<li>The CodeQL Action now has experimental support for CodeQL releases for which per-language bundles are available. Per-language bundles support analysis for a single language and are therefore smaller than the combined bundles that allow analysis for all supported languages. As a result, per-language bundles take up less space on disk and are faster to download. We expect to roll this change out to everyone in the coming weeks. <a href="https://redirect.github.com/github/codeql-action/pull/4146">#4146</a></li>
</ul>
</blockquote>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a href="https://github.com/github/codeql-action/commit/1c5b675653bb5c22dbe9b12b556ec555138e09fd"><code>1c5b675</code></a> Merge pull request <a href="https://redirect.github.com/github/codeql-action/issues/4152">#4152</a> from github/update-v4.38.1-a65b83a73</li>
<li><a href="https://github.com/github/codeql-action/commit/a97cdcae05f95787760713131181ee6624037e17"><code>a97cdca</code></a> Add changelog entry for <a href="https://redirect.github.com/github/codeql-action/issues/4146">#4146</a></li>
<li><a href="https://github.com/github/codeql-action/commit/cc6c6911c3eb4bc527e1382609bf400bb4c44611"><code>cc6c691</code></a> Update changelog for v4.38.1</li>
<li><a href="https://github.com/github/codeql-action/commit/a65b83a73db5849f2c05f0112023a8a4e89a7258"><code>a65b83a</code></a> Merge pull request <a href="https://redirect.github.com/github/codeql-action/issues/4146">#4146</a> from github/henrymercer/per-language-bundles-pr</li>
<li><a href="https://github.com/github/codeql-action/commit/07fa87d33359d182be54e4da4bf41664595e3042"><code>07fa87d</code></a> Clarify the latest-nightly eligibility exception</li>
<li><a href="https://github.com/github/codeql-action/commit/f18f3536f13ef44ab98c9ef15f8aa05c7f6ac4ae"><code>f18f353</code></a> Describe the bundle URL resolver</li>
<li><a href="https://github.com/github/codeql-action/commit/ecec9b5a3756247bd2bfec7da1b6f7bb3eb92d46"><code>ecec9b5</code></a> Share per-language telemetry fields without renaming</li>
<li><a href="https://github.com/github/codeql-action/commit/79fe3a1270f5a101a20367147a05eb6d8ed533af"><code>79fe3a1</code></a> Move download telemetry into the status-report directory</li>
<li><a href="https://github.com/github/codeql-action/commit/ead1f7d93f7fea11d3cf483d696b783b3f686607"><code>ead1f7d</code></a> Rename the platform module</li>
<li><a href="https://github.com/github/codeql-action/commit/549d498da392f61aadfc0416f08ed43ae7397a2f"><code>549d498</code></a> Simplify per-language platform eligibility checks</li>
<li>Additional commits viewable in <a href="https://github.com/github/codeql-action/compare/v4.38.0...v4.38.1">compare view</a></li>
</ul>
</details>
<br />


[![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=github/codeql-action&package-manager=github_actions&previous-version=4.38.0&new-version=4.38.1)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)

Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting `@dependabot rebase`.

[//]: # (dependabot-automerge-start)
[//]: # (dependabot-automerge-end)

---

<details>
<summary>Dependabot commands and options</summary>
<br />

You can trigger Dependabot actions by commenting on this PR:
- `@dependabot rebase` will rebase this PR
- `@dependabot recreate` will recreate this PR, overwriting any edits that have been made to it
- `@dependabot show <dependency name> ignore conditions` will show all of the ignore conditions of the specified dependency
- `@dependabot ignore <dependency name> major version` will close this group update PR and stop Dependabot creating any more for the specific dependency's major version (unless you unignore this specific dependency's major version or upgrade to it yourself)
- `@dependabot ignore <dependency name> minor version` will close this group update PR and stop Dependabot creating any more for the specific dependency's minor version (unless you unignore this specific dependency's minor version or upgrade to it yourself)
- `@dependabot ignore <dependency name>` will close this group update PR and stop Dependabot creating any more for the specific dependency (unless you unignore this specific dependency or upgrade to it yourself)
- `@dependabot unignore <dependency name>` will remove all of the ignore conditions of the specified dependency
- `@dependabot unignore <dependency name> <ignore condition>` will remove the ignore condition of the specified dependency and ignore conditions


</details>

