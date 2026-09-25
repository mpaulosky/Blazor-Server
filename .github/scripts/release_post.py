#!/usr/bin/env python3
"""Write the release blog post for a merged PR and refresh the release tables.

Called by .github/workflows/release.yml once per release, and usable for any
past Release/PR pair:

    python3 .github/scripts/release_post.py --pr 28 --tag v0.0.32

It writes docs/blogs/{merged-date}-pr-{n}-{slug}.md, updates the
docs/blogs/README.md index, the RELEASES_START/END table in README.md (copied
to docs/README.md), and the RELEASES_HTML/BLOGS_HTML tables in docs/index.html.

GitHub data comes from the gh CLI (GH_TOKEN). When ANTHROPIC_API_KEY is set,
the post opens with a short summary written by Claude (model from
ANTHROPIC_MODEL). Any API failure only drops the summary; it never fails the
release. Standard library only, so no pip install is needed to run it.
"""

import argparse
import datetime
import html
import json
import os
import re
import subprocess
import urllib.request
from pathlib import Path

DEFAULT_MODEL = "claude-sonnet-5"
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
API_TIMEOUT_SECONDS = 60
DIFF_LIMIT = 60_000
TABLE_SIZE = 10

# Dependency bumps get the deterministic sections only: a summary of a
# version bump adds nothing the title doesn't say.
NO_SUMMARY_AUTHORS = {"dependabot[bot]"}

AREAS = ["src/", "tests/", ".github/", ".sandcastle/", "docs/"]
OTHER_AREA = "other"

# Lock files are noise, and the rest are written by this script.
DIFF_EXCLUDED_NAMES = {"package-lock.json"}
DIFF_EXCLUDED_PATHS = {"README.md", "docs/README.md"}
DIFF_EXCLUDED_PREFIXES = ("docs/blogs/",)


class GitHub:
    """The GitHub API calls the script needs, made through the gh CLI."""

    def __init__(self, repository):
        self.repository = repository

    def _api(self, path, jq=None):
        command = ["gh", "api", f"repos/{self.repository}/{path}", "--paginate"]
        if jq:
            command += ["--jq", jq]
        return subprocess.run(command, check=True, capture_output=True, text=True).stdout

    def _list(self, path, jq=".[] | @json"):
        return [json.loads(line) for line in self._api(path, jq).splitlines() if line.strip()]

    def pull(self, number):
        return json.loads(self._api(f"pulls/{number}"))

    def pull_title(self, number):
        return self._api(f"pulls/{number}", ".title").strip()

    def commits(self, number):
        return self._list(f"pulls/{number}/commits?per_page=100")

    def files(self, number):
        return self._list(f"pulls/{number}/files?per_page=100")

    def releases(self):
        return self._list("releases?per_page=100", ".[] | select(.draft | not) | @json")


def log(message):
    print(message, flush=True)


def slugify(title):
    slug = re.sub(r"[^a-z0-9]", "-", title.lower())
    return re.sub(r"-+", "-", slug).strip("-") or "pr-update"


def version_key(tag):
    version = re.match(r"v?(\d+)\.(\d+)\.(\d+)", tag or "")
    return tuple(int(p) for p in version.groups()) if version else (0, 0, 0)


# Post sections


def commit_subject(commit):
    message = (commit.get("commit") or {}).get("message") or ""
    return message.splitlines()[0].strip() if message.strip() else "(no message)"


def render_commits(commits):
    lines = ["### Commits", ""]
    if not commits:
        lines.append("No commits were found.")
    for commit in commits:
        lines.append(f"- {commit_subject(commit)} (`{commit.get('sha', '')[:7]}`)")
    return "\n".join(lines) + "\n"


def area_of(path):
    return next((area for area in AREAS if path.startswith(area)), OTHER_AREA)


def render_files(files):
    groups = {}
    for file in files:
        groups.setdefault(area_of(file["filename"]), []).append(file)

    lines = ["### Files changed", ""]
    if not files:
        lines.append("No files were changed.")
    for area in AREAS + [OTHER_AREA]:
        if area not in groups:
            continue
        lines += [f"#### {area}", ""]
        for file in sorted(groups[area], key=lambda f: f["filename"]):
            lines.append(f"- `{file['filename']}` (+{file.get('additions', 0)} / -{file.get('deletions', 0)})")
        lines.append("")
    return "\n".join(lines).rstrip("\n") + "\n"


def is_excluded_from_diff(path):
    name = path.rsplit("/", 1)[-1]
    return (
        name in DIFF_EXCLUDED_NAMES
        or name.endswith(".lock")
        or path in DIFF_EXCLUDED_PATHS
        or path.startswith(DIFF_EXCLUDED_PREFIXES)
    )


def build_diff(files, limit=DIFF_LIMIT):
    """Rebuild a unified diff from the per-file patches the API returns."""
    parts = []
    for file in files:
        path = file["filename"]
        if is_excluded_from_diff(path):
            continue
        patch = file.get("patch") or "(no textual diff: binary or too large)"
        parts.append(f"diff --git a/{path} b/{path}\n--- a/{path}\n+++ b/{path}\n{patch}\n")
    diff = "".join(parts)
    if len(diff) > limit:
        diff = diff[:limit] + f"\n[Diff truncated: showing the first {limit} of {len(diff)} characters.]\n"
    return diff


# AI summary


def build_prompt(pr, commits, diff):
    subjects = "\n".join(f"- {commit_subject(c)}" for c in commits) or "(none)"
    return (
        "Write a 3-5 sentence narrative summary of this merged pull request for a release blog post. "
        "Explain what changed and why, for a developer who uses the project. "
        "Answer with plain prose only: no heading, no lists, no preamble.\n\n"
        f"<title>{pr.get('title') or ''}</title>\n\n"
        f"<description>\n{pr.get('body') or '(none)'}\n</description>\n\n"
        f"<commits>\n{subjects}\n</commits>\n\n"
        f"<diff>\n{diff or '(empty)'}\n</diff>\n"
    )


def request_summary(api_key, model, prompt, urlopen=urllib.request.urlopen):
    """Return Claude's summary, or None after logging a warning. Never raises."""
    request = urllib.request.Request(
        ANTHROPIC_URL,
        data=json.dumps(
            {"model": model, "max_tokens": 1024, "messages": [{"role": "user", "content": prompt}]}
        ).encode("utf-8"),
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=API_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
        text = "".join(
            block.get("text", "") for block in payload.get("content", []) if block.get("type") == "text"
        ).strip()
    except Exception as error:  # noqa: BLE001 - any failure only drops the summary
        log(f"::warning::AI summary request failed ({type(error).__name__}: {error}); writing the post without it.")
        return None
    if not text:
        log("::warning::AI summary response had no text; writing the post without it.")
        return None
    return text


# Post file and blog index


def render_post(pr, title_line, tag, merged_date, commits, files, summary, model):
    number = pr["number"]
    safe_title = title_line.replace('"', '\\"')
    ai_note = (
        "Generated by release automation from the PR title, description, commits and changed files. "
        + (f"Includes an AI summary written by {model}." if summary else "No AI summary.")
    )
    front_matter = "\n".join(
        [
            "---",
            f'post_title: "{safe_title}"',
            "author1: mpaulosky",
            f'post_slug: "{tag.lower()}-pr-{number}"',
            "microsoft_alias: n/a",
            'featured_image: ""',
            "categories:",
            "  - engineering",
            "tags:",
            f"  - release:{tag.lower()}",
            "  - automation",
            f'ai_note: "{ai_note}"',
            f'summary: "Release notes seed for {tag} from PR #{number}."',
            f'post_date: "{merged_date}"',
            "---",
            "",
        ]
    )
    sections = [
        f"## {title_line}\n\n"
        f"- **Release tag:** `{tag}`\n"
        f"- **Source PR:** [#{number}]({pr.get('html_url') or ''})\n"
    ]
    if summary:
        sections.append(f"### Summary\n\n{summary}\n")
    body = (pr.get("body") or "").strip() or "No PR description was provided."
    sections.append(f"### PR description\n\n{body}\n")
    sections.append(render_commits(commits))
    sections.append(render_files(files))
    return front_matter + "\n".join(sections)


def update_blog_index(blog_dir, merged_date, title_line, post_name):
    blog_index = blog_dir / "README.md"
    existing = blog_index.read_text(encoding="utf-8") if blog_index.exists() else ""

    # Keep the post rows, skipping the header and its separator. Matching the
    # header's first cell exactly keeps posts whose title mentions "Date".
    rows = []
    for line in existing.splitlines():
        line = line.strip()
        if not (line.startswith("|") and line.endswith("|")):
            continue
        first_cell = line.strip("|").split("|")[0].strip()
        if first_cell == "Date" or set(first_cell) <= set("-: "):
            continue
        rows.append(line)

    # Drop this post's old row, and rows whose post was deleted (write_post
    # removes a PR's post when its title or merge date gives it a new name).
    def linked_post_exists(row):
        linked = re.search(r"\]\(([^)]+\.md)\)", row)
        return not linked or (blog_dir / linked.group(1)).exists()

    row_title = title_line.replace("|", "\\|")
    rows = [r for r in rows if f"({post_name})" not in r and linked_post_exists(r)]
    rows.insert(0, f"| {merged_date} | [{row_title}]({post_name}) | release,automation |")

    def row_date(row):
        parts = [p.strip() for p in row.strip("|").split("|")]
        return parts[0] if parts else "0000-00-00"

    # Stable sort by date only, so same-day rows keep their merge order.
    rows = sorted(rows, key=row_date, reverse=True)

    blog_index.write_text(
        "\n".join(
            [
                "## Release review posts",
                "",
                "This directory contains concise release-review posts for merged PR releases.",
                "",
                "| Date | Title | Tags |",
                "|------|-------|------|",
                *rows,
                "",
            ]
        ),
        encoding="utf-8",
    )


def read_blog_posts(blog_dir):
    posts = []
    for path in blog_dir.glob("*.md"):
        pr = re.search(r"-pr-(\d+)-", path.name)
        if not pr:
            continue
        text = path.read_text(encoding="utf-8")
        front = re.match(r"---\n(.*?)\n---", text, flags=re.DOTALL)
        front = front.group(1) if front else ""
        title = re.search(r'^post_title: "(.*)"$', front, flags=re.MULTILINE)
        date = re.search(r'^post_date: "(.*)"$', front, flags=re.MULTILINE)
        tag = re.search(r"^\s*- release:(\S+)$", front, flags=re.MULTILINE)
        posts.append(
            {
                "file": path.name,
                "pr": pr.group(1),
                "title": title.group(1).replace('\\"', '"') if title else path.stem,
                "date": date.group(1) if date else path.name[:10],
                "tag": tag.group(1) if tag else "",
            }
        )
    return posts


def newest_first(items):
    # Same-day items are ordered by release version, which follows merge order.
    return sorted(items, key=lambda item: (item["date"], version_key(item["tag"])), reverse=True)


# Release tables


def source_pr_of(release):
    """The PR number in the release body's "Source PR: #n" line, or None."""
    match = re.search(r"Source PR: #(\d+)", release.get("body") or "")
    return int(match.group(1)) if match else None


def post_url(repository, name):
    return f"https://github.com/{repository}/blob/main/docs/blogs/{name}"


def release_entries(gh, repository, blog_dir, current=None):
    """The newest releases, newest first.

    current is {"tag", "date", "pr", "title"} for a release that is being
    created now and so isn't in the Releases API response yet.
    """
    entries = [dict(current)] if current else []
    for release in gh.releases():
        # On a re-run the release being created is already in the response.
        if current and release["tag_name"] == current["tag"]:
            continue
        source_pr = source_pr_of(release)
        entries.append(
            {
                "tag": release["tag_name"],
                "date": (release.get("published_at") or "")[:10],
                "pr": str(source_pr) if source_pr else "",
                "title": "",
                "name": release.get("name") or release["tag_name"],
            }
        )
    # Sort before slicing: a re-run for an older PR must not pin its row
    # above newer releases.
    entries = newest_first(entries)[:TABLE_SIZE]

    for entry in entries:
        if not entry["title"] and entry["pr"]:
            try:
                entry["title"] = gh.pull_title(int(entry["pr"]))
            except subprocess.CalledProcessError:
                entry["title"] = ""
        entry["title"] = entry["title"] or entry.get("name") or entry["tag"]
        entry["url"] = f"https://github.com/{repository}/releases/tag/{entry['tag']}"
        entry["post_url"] = ""
        if entry["pr"]:
            posts = sorted(blog_dir.glob(f"*-pr-{entry['pr']}-*.md"))
            if posts:
                entry["post_url"] = post_url(repository, posts[-1].name)
    return entries


def render_releases_markdown(entries):
    rows = []
    for entry in entries:
        blog_cell = f"[Post]({entry['post_url']})" if entry["post_url"] else "—"
        title = entry["title"].replace("|", "\\|")
        rows.append(f"| [{entry['tag']}]({entry['url']}) | {entry['date']} | {title} | {blog_cell} |")
    return "\n".join(
        [
            "<!-- RELEASES_START -->",
            "",
            "| Version | Date | Title | Blog post |",
            "|---------|------|-------|-----------|",
            *rows,
            "",
            "<!-- RELEASES_END -->",
        ]
    )


def link(href, text):
    return f'<a href="{html.escape(href)}">{html.escape(text)}</a>'


def render_table(headers, rows, empty):
    lines = ['<div class="table-wrap">', "  <table>", "    <thead>", "      <tr>"]
    lines += [f"        <th>{html.escape(h)}</th>" for h in headers]
    lines += ["      </tr>", "    </thead>", "    <tbody>"]
    if not rows:
        lines.append(f'      <tr><td colspan="{len(headers)}">{html.escape(empty)}</td></tr>')
    for cells in rows:
        lines.append("      <tr>")
        lines += [f"        <td>{cell}</td>" for cell in cells]
        lines.append("      </tr>")
    lines += ["    </tbody>", "  </table>", "</div>"]
    return lines


def render_releases_html(entries):
    rows = [
        [
            link(e["url"], e["tag"]),
            html.escape(e["date"]),
            html.escape(e["title"]),
            link(e["post_url"], "Post") if e["post_url"] else "—",
        ]
        for e in entries
    ]
    return render_table(["Version", "Date", "Title", "Blog post"], rows, "No releases yet.")


def render_blogs_html(posts, repository):
    rows = [
        [
            html.escape(p["date"]),
            link(post_url(repository, p["file"]), p["title"]),
            html.escape(p["tag"]) if p["tag"] else "—",
            link(f"https://github.com/{repository}/pull/{p['pr']}", f"#{p['pr']}"),
        ]
        for p in newest_first(posts)[:TABLE_SIZE]
    ]
    return render_table(["Date", "Title", "Release", "Source PR"], rows, "No blog posts yet.")


def replace_between(text, name, lines):
    """Replace what's between <!-- {name}_START/END --> with lines, or None without markers."""
    pattern = re.compile(
        rf"^(?P<indent>[ \t]*)<!-- {name}_START -->.*?<!-- {name}_END -->", flags=re.DOTALL | re.MULTILINE
    )
    match = pattern.search(text)
    if not match:
        return None
    indent = match.group("indent")
    block = "\n".join(
        [f"{indent}<!-- {name}_START -->", *[f"{indent}{line}" for line in lines], f"{indent}<!-- {name}_END -->"]
    )
    return text[: match.start()] + block + text[match.end() :]


def update_readme(readme, releases_block, repository):
    # Migrate READMEs written by the previous workflow: drop the legacy
    # Dev Blog section and its BLOG_START/BLOG_END block.
    readme = re.sub(
        r"(?:^## Dev Blog[^\n]*\n\s*)?<!-- BLOG_START -->.*?<!-- BLOG_END -->\n?",
        "",
        readme,
        flags=re.DOTALL | re.MULTILINE,
    )
    readme = re.sub(r"\n{3,}", "\n\n", readme).strip("\n") + "\n" if readme.strip() else ""

    if "<!-- RELEASES_START -->" in readme and "<!-- RELEASES_END -->" in readme:
        return re.sub(
            r"<!-- RELEASES_START -->.*?<!-- RELEASES_END -->",
            lambda _match: releases_block,
            readme,
            flags=re.DOTALL,
        )

    releases_section = (
        "## Releases\n\n" + releases_block + f"\n\n[All releases →](https://github.com/{repository}/releases)\n"
    )
    about = re.search(r"^## About[^\n]*\n", readme, flags=re.MULTILINE)
    next_heading = re.search(r"^## ", readme[about.end() :], flags=re.MULTILINE) if about else None
    if next_heading:
        insert_at = about.end() + next_heading.start()
        return readme[:insert_at] + releases_section + "\n" + readme[insert_at:]
    suffix = "" if readme.endswith("\n") or not readme else "\n"
    separator = "\n" if readme else ""
    return readme + suffix + separator + releases_section


def update_index_html(path, entries, posts, repository):
    if not path.exists():
        log(f"::notice::{path} not found; skipping the Pages tables.")
        return
    text = path.read_text(encoding="utf-8")
    for name, lines in [
        ("RELEASES_HTML", render_releases_html(entries)),
        ("BLOGS_HTML", render_blogs_html(posts, repository)),
    ]:
        updated = replace_between(text, name, lines)
        if updated is None:
            log(f"::notice::{path} has no {name}_START/END markers; leaving that table alone.")
        else:
            text = updated
    path.write_text(text, encoding="utf-8")


def write_post(gh, pr_number, tag, root=Path("."), api_key=None, model=DEFAULT_MODEL, urlopen=urllib.request.urlopen):
    """Write the post for a merged PR and its blog index row; return (merged_date, title_line)."""
    root = Path(root)
    pr = gh.pull(pr_number)
    commits = gh.commits(pr_number)
    files = gh.files(pr_number)

    title_line = (pr.get("title") or "").strip() or f"PR #{pr_number}"
    merged_date = (pr.get("merged_at") or "")[:10] or datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")

    summary = None
    author = (pr.get("user") or {}).get("login") or ""
    if author in NO_SUMMARY_AUTHORS:
        log(f"::notice::PR #{pr_number} is by {author}; writing the post without an AI summary.")
    elif api_key:
        summary = request_summary(api_key, model, build_prompt(pr, commits, build_diff(files)), urlopen)
    else:
        log("::notice::ANTHROPIC_API_KEY is not set; writing the post without an AI summary.")

    blog_dir = root / "docs" / "blogs"
    blog_dir.mkdir(parents=True, exist_ok=True)
    post_name = f"{merged_date}-pr-{pr_number}-{slugify(title_line)}.md"
    # A renamed PR, or an older post dated differently, would otherwise leave
    # two posts for one PR.
    for old_post in blog_dir.glob(f"*-pr-{pr_number}-*.md"):
        if old_post.name != post_name:
            old_post.unlink()
            log(f"Removed docs/blogs/{old_post.name}")
    (blog_dir / post_name).write_text(
        render_post(pr, title_line, tag, merged_date, commits, files, summary, model), encoding="utf-8"
    )
    log(f"Wrote docs/blogs/{post_name}")
    update_blog_index(blog_dir, merged_date, title_line, post_name)
    return merged_date, title_line


def update_tables(repository, gh, root=Path("."), current=None):
    """Rewrite the README, docs/README.md and docs/index.html release and blog tables."""
    root = Path(root)
    blog_dir = root / "docs" / "blogs"
    # The Releases tables come from the GitHub Releases API, not the blog
    # index, so releases without a blog post are listed too.
    entries = release_entries(gh, repository, blog_dir, current)

    readme_path = root / "README.md"
    readme = readme_path.read_text(encoding="utf-8") if readme_path.exists() else ""
    readme = update_readme(readme, render_releases_markdown(entries), repository)
    readme_path.write_text(readme, encoding="utf-8")
    (root / "docs" / "README.md").write_text(readme, encoding="utf-8")

    update_index_html(root / "docs" / "index.html", entries, read_blog_posts(blog_dir), repository)


def run(repository, pr_number, tag, gh, root=Path("."), api_key=None, model=DEFAULT_MODEL, urlopen=urllib.request.urlopen):
    merged_date, title_line = write_post(gh, pr_number, tag, root, api_key, model, urlopen)
    # This runs before "Create tag and release", so the new release is passed in.
    current = {"tag": tag, "date": merged_date, "pr": str(pr_number), "title": title_line}
    update_tables(repository, gh, root, current)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--pr", type=int, required=True, help="merged PR number")
    parser.add_argument("--tag", required=True, help="release tag for the PR, e.g. v0.0.32")
    parser.add_argument(
        "--repo",
        default=os.environ.get("REPOSITORY") or os.environ.get("GITHUB_REPOSITORY"),
        help="owner/name (default: $REPOSITORY or $GITHUB_REPOSITORY)",
    )
    args = parser.parse_args(argv)
    if not args.repo:
        parser.error("--repo is required when REPOSITORY and GITHUB_REPOSITORY are unset")

    run(
        args.repo,
        args.pr,
        args.tag.strip(),
        GitHub(args.repo),
        api_key=(os.environ.get("ANTHROPIC_API_KEY") or "").strip() or None,
        model=(os.environ.get("ANTHROPIC_MODEL") or "").strip() or DEFAULT_MODEL,
    )


if __name__ == "__main__":
    main()
