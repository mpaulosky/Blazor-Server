import io
import json
import subprocess
import urllib.error

import pytest

import release_post as rp

REPO = "octo/demo"


class FakeGitHub:
    """Stands in for the gh CLI wrapper with canned API data."""

    def __init__(self, releases=None):
        self.pulls = {
            42: {
                "number": 42,
                "title": 'feat(ui): Add the "dark" theme',
                "body": "Adds a theme.",
                "html_url": f"https://github.com/{REPO}/pull/42",
                "merged_at": "2026-09-24T21:30:00Z",
            },
            7: {"number": 7, "title": "fix: Older change", "body": "", "html_url": "", "merged_at": ""},
        }
        self.releases_data = releases if releases is not None else [
            {
                "tag_name": "v0.0.2",
                "name": "Release v0.0.2",
                "published_at": "2026-09-20T10:00:00Z",
                "body": "Source PR: #7\n",
            },
            {"tag_name": "v0.0.1", "name": "Release v0.0.1", "published_at": "2026-09-19T10:00:00Z", "body": ""},
        ]

    def pull(self, number):
        return self.pulls[number]

    def pull_title(self, number):
        if number not in self.pulls:
            raise subprocess.CalledProcessError(1, "gh")
        return self.pulls[number]["title"]

    def commits(self, number):
        return [
            {"sha": "abcdef1234567", "commit": {"message": "feat(ui): Add theme tokens\n\nLong body."}},
            {"sha": "1234567abcdef", "commit": {"message": "test(ui): Cover the theme switch"}},
        ]

    def files(self, number):
        return [
            {"filename": "src/Web/Theme.cs", "additions": 10, "deletions": 2, "patch": "@@ -1 +1 @@\n-a\n+b"},
            {"filename": "tests/Web.Tests/ThemeTests.cs", "additions": 5, "deletions": 0, "patch": "@@ +1 @@\n+t"},
            {"filename": ".github/workflows/ci.yml", "additions": 1, "deletions": 1, "patch": "@@\n-x\n+y"},
            {"filename": ".sandcastle/main.mts", "additions": 3, "deletions": 3, "patch": "@@\n-m\n+n"},
            {"filename": "docs/adr/0001.md", "additions": 4, "deletions": 0, "patch": "@@\n+adr"},
            {"filename": "package-lock.json", "additions": 900, "deletions": 800, "patch": "@@\n+lock"},
            {"filename": "Directory.Packages.props", "additions": 1, "deletions": 0, "patch": "@@\n+pkg"},
        ]

    def releases(self):
        return self.releases_data


def make_repo(tmp_path):
    (tmp_path / "docs" / "blogs").mkdir(parents=True)
    readme = "# Demo\n\n## About\n\nText.\n\n## Releases\n\n<!-- RELEASES_START -->\nold\n<!-- RELEASES_END -->\n\n## License\n"
    (tmp_path / "README.md").write_text(readme, encoding="utf-8")
    (tmp_path / "docs" / "index.html").write_text(
        "<html>\n  <body>\n"
        "    <!-- RELEASES_HTML_START -->\n    old\n    <!-- RELEASES_HTML_END -->\n"
        "    <!-- BLOGS_HTML_START -->\n    <!-- BLOGS_HTML_END -->\n"
        "  </body>\n</html>\n",
        encoding="utf-8",
    )
    return tmp_path


def run(tmp_path, gh=None, **kwargs):
    return rp.run(REPO, 42, "v0.0.3", gh or FakeGitHub(), root=tmp_path, **kwargs)


def read_all(root):
    return {
        str(p.relative_to(root)): p.read_text(encoding="utf-8")
        for p in sorted(root.rglob("*"))
        if p.is_file()
    }


# Deterministic sections


def test_slugify_matches_the_workflow_slug():
    assert rp.slugify("feat(sandcastle): Hold back issues whose blockers haven't landed") == (
        "feat-sandcastle-hold-back-issues-whose-blockers-haven-t-landed"
    )
    assert rp.slugify("!!!") == "pr-update"


def test_commits_section_lists_subjects_only():
    section = rp.render_commits(FakeGitHub().commits(42))
    assert section == (
        "### Commits\n\n"
        "- feat(ui): Add theme tokens (`abcdef1`)\n"
        "- test(ui): Cover the theme switch (`1234567`)\n"
    )


def test_commits_section_without_commits():
    assert "No commits were found." in rp.render_commits([])


def test_files_section_groups_by_area_in_fixed_order():
    section = rp.render_files(FakeGitHub().files(42))
    assert section == (
        "### Files changed\n\n"
        "#### src/\n\n"
        "- `src/Web/Theme.cs` (+10 / -2)\n\n"
        "#### tests/\n\n"
        "- `tests/Web.Tests/ThemeTests.cs` (+5 / -0)\n\n"
        "#### .github/\n\n"
        "- `.github/workflows/ci.yml` (+1 / -1)\n\n"
        "#### .sandcastle/\n\n"
        "- `.sandcastle/main.mts` (+3 / -3)\n\n"
        "#### docs/\n\n"
        "- `docs/adr/0001.md` (+4 / -0)\n\n"
        "#### other\n\n"
        "- `Directory.Packages.props` (+1 / -0)\n"
        "- `package-lock.json` (+900 / -800)\n"
    )


@pytest.mark.parametrize(
    "path, excluded",
    [
        ("package-lock.json", True),
        ("web/package-lock.json", True),
        ("poetry.lock", True),
        ("docs/blogs/2026-09-24-pr-1-x.md", True),
        ("README.md", True),
        ("docs/README.md", True),
        ("src/README.md", False),
        ("docs/adr/0001.md", False),
        ("src/Web/Theme.cs", False),
    ],
)
def test_diff_exclusions(path, excluded):
    assert rp.is_excluded_from_diff(path) is excluded


def test_build_diff_skips_excluded_files():
    diff = rp.build_diff(FakeGitHub().files(42))
    assert "diff --git a/src/Web/Theme.cs b/src/Web/Theme.cs" in diff
    assert "package-lock.json" not in diff


def test_build_diff_truncates_with_a_note():
    files = [{"filename": "src/big.cs", "additions": 1, "deletions": 0, "patch": "+" + "x" * 200}]
    diff = rp.build_diff(files, limit=100)
    assert diff.startswith("diff --git a/src/big.cs b/src/big.cs")
    assert "[Diff truncated" in diff
    assert len(diff) < 200


# Marker rewriting


def test_replace_between_keeps_markers_and_indent():
    text = "a\n  <!-- X_START -->\n  old\n  <!-- X_END -->\nb\n"
    out = rp.replace_between(text, "X", ["<p>1</p>", "<p>2</p>"])
    assert out == "a\n  <!-- X_START -->\n  <p>1</p>\n  <p>2</p>\n  <!-- X_END -->\nb\n"
    assert rp.replace_between(out, "X", ["<p>1</p>", "<p>2</p>"]) == out


def test_replace_between_without_markers_returns_none():
    assert rp.replace_between("no markers", "X", ["y"]) is None


def test_run_writes_readme_and_index_tables(tmp_path):
    make_repo(tmp_path)
    run(tmp_path)

    readme = (tmp_path / "README.md").read_text(encoding="utf-8")
    post = "2026-09-24-pr-42-feat-ui-add-the-dark-theme.md"
    assert f'| [v0.0.3](https://github.com/{REPO}/releases/tag/v0.0.3) | 2026-09-24 | feat(ui): Add the "dark" theme | [Post](https://github.com/{REPO}/blob/main/docs/blogs/{post}) |' in readme
    assert f"| [v0.0.2](https://github.com/{REPO}/releases/tag/v0.0.2) | 2026-09-20 | fix: Older change | — |" in readme
    assert "| [v0.0.1](https://github.com/octo/demo/releases/tag/v0.0.1) | 2026-09-19 | Release v0.0.1 | — |" in readme
    assert readme.endswith("## License\n")
    assert (tmp_path / "docs" / "README.md").read_text(encoding="utf-8") == readme

    index = (tmp_path / "docs" / "index.html").read_text(encoding="utf-8")
    assert "old" not in index
    assert f'<td><a href="https://github.com/{REPO}/releases/tag/v0.0.3">v0.0.3</a></td>' in index
    assert "<td>feat(ui): Add the &quot;dark&quot; theme</td>" in index
    assert f'<td><a href="https://github.com/{REPO}/blob/main/docs/blogs/{post}">Post</a></td>' in index
    assert "<td>—</td>" in index
    # Blog posts table: Date | Title | Release | Source PR
    assert f'<td><a href="https://github.com/{REPO}/blob/main/docs/blogs/{post}">feat(ui): Add the &quot;dark&quot; theme</a></td>' in index
    assert "<td>v0.0.3</td>" in index
    assert f'<td><a href="https://github.com/{REPO}/pull/42">#42</a></td>' in index


def test_blog_posts_table_is_newest_first_and_capped_at_ten(tmp_path):
    blog_dir = make_repo(tmp_path) / "docs" / "blogs"
    for n in range(1, 13):
        (blog_dir / f"2026-09-{n:02d}-pr-{n}-post-{n}.md").write_text(
            "---\n"
            f'post_title: "Post <{n}>"\n'
            "tags:\n"
            f"  - release:v0.0.{n}\n"
            "  - automation\n"
            f'post_date: "2026-09-{n:02d}"\n'
            "---\nbody\n",
            encoding="utf-8",
        )
    posts = rp.read_blog_posts(blog_dir)
    lines = rp.render_blogs_html(posts, REPO)
    rows = [line for line in lines if line.strip().startswith("<tr>")]
    # Header row plus ten posts.
    assert len(rows) == 11
    html_text = "\n".join(lines)
    assert "Post &lt;12&gt;" in html_text
    assert "Post &lt;2&gt;" not in html_text
    assert html_text.index("2026-09-12") < html_text.index("2026-09-11")


def test_same_day_posts_are_ordered_by_release_version():
    posts = [
        {"date": "2026-09-24", "tag": "v0.0.9", "pr": "4", "title": "a", "file": "a.md"},
        {"date": "2026-09-24", "tag": "v0.0.32", "pr": "28", "title": "b", "file": "b.md"},
    ]
    assert [p["tag"] for p in rp.newest_first(posts)] == ["v0.0.32", "v0.0.9"]


def test_readme_without_markers_gets_releases_section_after_about(tmp_path):
    make_repo(tmp_path)
    (tmp_path / "README.md").write_text("# Demo\n\n## About\n\nText.\n\n## License\n", encoding="utf-8")
    run(tmp_path)
    readme = (tmp_path / "README.md").read_text(encoding="utf-8")
    assert readme.index("## About") < readme.index("## Releases") < readme.index("## License")
    assert f"[All releases →](https://github.com/{REPO}/releases)" in readme


def test_readme_legacy_dev_blog_block_is_removed(tmp_path):
    make_repo(tmp_path)
    (tmp_path / "README.md").write_text(
        "# Demo\n\n## Dev Blog\n\n<!-- BLOG_START -->\nx\n<!-- BLOG_END -->\n\n## About\n\nText.\n",
        encoding="utf-8",
    )
    run(tmp_path)
    readme = (tmp_path / "README.md").read_text(encoding="utf-8")
    assert "Dev Blog" not in readme
    assert "BLOG_START" not in readme


def test_index_html_without_markers_is_left_alone(tmp_path):
    make_repo(tmp_path)
    (tmp_path / "docs" / "index.html").write_text("<html></html>\n", encoding="utf-8")
    run(tmp_path)
    assert (tmp_path / "docs" / "index.html").read_text(encoding="utf-8") == "<html></html>\n"


def test_running_twice_leaves_every_file_unchanged(tmp_path):
    make_repo(tmp_path)
    run(tmp_path)
    first = read_all(tmp_path)
    run(tmp_path)
    assert read_all(tmp_path) == first


def test_blog_index_lists_the_post_once(tmp_path):
    make_repo(tmp_path)
    run(tmp_path)
    run(tmp_path)
    index = (tmp_path / "docs" / "blogs" / "README.md").read_text(encoding="utf-8")
    assert index.count("pr-42-") == 1
    assert "| 2026-09-24 | [feat(ui): Add the \"dark\" theme](2026-09-24-pr-42-feat-ui-add-the-dark-theme.md) | release,automation |" in index


def test_blog_index_keeps_posts_whose_title_mentions_date(tmp_path):
    blog_dir = make_repo(tmp_path) / "docs" / "blogs"
    older = "| 2026-09-20 | [fix(ui): Date parsing fix](2026-09-20-pr-7-fix-ui-date-parsing-fix.md) | release,automation |"
    for name in ["2026-09-20-pr-7-fix-ui-date-parsing-fix.md", "2026-09-24-pr-8-feat-ui-next.md"]:
        (blog_dir / name).write_text("post\n", encoding="utf-8")
    rp.update_blog_index(blog_dir, "2026-09-20", "fix(ui): Date parsing fix", "2026-09-20-pr-7-fix-ui-date-parsing-fix.md")
    rp.update_blog_index(blog_dir, "2026-09-24", "feat(ui): Next", "2026-09-24-pr-8-feat-ui-next.md")
    index = (blog_dir / "README.md").read_text(encoding="utf-8")
    assert older in index
    assert index.count("| Date | Title | Tags |") == 1


# Post content and the AI summary


def post_text(tmp_path):
    return (tmp_path / "docs" / "blogs" / "2026-09-24-pr-42-feat-ui-add-the-dark-theme.md").read_text(encoding="utf-8")


def test_no_key_writes_post_without_summary(tmp_path, capsys):
    make_repo(tmp_path)
    run(tmp_path, api_key=None)
    post = post_text(tmp_path)

    assert "### Summary" not in post
    assert 'ai_note: "Generated by release automation from the PR title, description, commits and changed files. No AI summary."' in post
    assert "::notice::" in capsys.readouterr().out
    # Front matter fields the workflow always wrote.
    for line in [
        'post_title: "feat(ui): Add the \\"dark\\" theme"',
        "author1: mpaulosky",
        'post_slug: "v0.0.3-pr-42"',
        "microsoft_alias: n/a",
        'featured_image: ""',
        "  - release:v0.0.3",
        'summary: "Release notes seed for v0.0.3 from PR #42."',
        'post_date: "2026-09-24"',
    ]:
        assert line in post
    assert post.index("### PR description") < post.index("### Commits") < post.index("### Files changed")
    assert "Adds a theme." in post


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def test_summary_is_included_when_the_api_answers(tmp_path):
    make_repo(tmp_path)
    captured = {}

    def urlopen(request, timeout):
        captured["request"] = request
        captured["timeout"] = timeout
        payload = {"content": [{"type": "text", "text": "This release adds a dark theme."}]}
        return FakeResponse(json.dumps(payload).encode("utf-8"))

    run(tmp_path, api_key="sk-test", model="claude-test", urlopen=urlopen)
    post = post_text(tmp_path)

    assert post.index("### Summary\n\nThis release adds a dark theme.\n") < post.index("### PR description")
    assert "Includes an AI summary written by claude-test." in post
    assert 'summary: "Release notes seed for v0.0.3 from PR #42."' in post

    request = captured["request"]
    assert captured["timeout"] == 60
    assert request.full_url == "https://api.anthropic.com/v1/messages"
    assert request.get_header("X-api-key") == "sk-test"
    sent = json.loads(request.data)
    assert sent["model"] == "claude-test"
    prompt = sent["messages"][0]["content"]
    assert "feat(ui): Add theme tokens" in prompt
    assert "diff --git a/src/Web/Theme.cs" in prompt
    assert "+lock" not in prompt


@pytest.mark.parametrize(
    "error",
    [
        urllib.error.HTTPError("https://api.anthropic.com/v1/messages", 529, "Overloaded", {}, None),
        urllib.error.URLError("no route"),
        TimeoutError("timed out"),
        ValueError("bad json"),
    ],
)
def test_api_failure_writes_post_without_summary(tmp_path, capsys, error):
    make_repo(tmp_path)

    def urlopen(request, timeout):
        raise error

    run(tmp_path, api_key="sk-test", urlopen=urlopen)
    post = post_text(tmp_path)

    assert "### Summary" not in post
    assert "No AI summary." in post
    assert "::warning::" in capsys.readouterr().out


def test_empty_api_answer_is_treated_as_no_summary(tmp_path, capsys):
    make_repo(tmp_path)

    def urlopen(request, timeout):
        return FakeResponse(b'{"content": []}')

    run(tmp_path, api_key="sk-test", urlopen=urlopen)
    assert "### Summary" not in post_text(tmp_path)
    assert "::warning::" in capsys.readouterr().out


def test_dependabot_pr_gets_no_summary_even_with_a_key(tmp_path, capsys):
    make_repo(tmp_path)
    gh = FakeGitHub()
    gh.pulls[42]["user"] = {"login": "dependabot[bot]"}

    calls = []

    def urlopen(request, timeout):
        calls.append(request)
        return FakeResponse(b'{"content": [{"type": "text", "text": "Summary."}]}')

    run(tmp_path, gh=gh, api_key="sk-test", urlopen=urlopen)
    post = post_text(tmp_path)
    assert calls == []
    assert "### Summary" not in post
    assert "No AI summary." in post
    assert "::notice::" in capsys.readouterr().out


def test_rewriting_a_post_under_a_new_name_drops_the_old_one(tmp_path):
    blog_dir = make_repo(tmp_path) / "docs" / "blogs"
    stale = "2026-09-23-pr-42-old-title.md"
    (blog_dir / stale).write_text("old\n", encoding="utf-8")
    rp.update_blog_index(blog_dir, "2026-09-23", "Old title", stale)
    (blog_dir / "2026-09-23-pr-420-other.md").write_text("other\n", encoding="utf-8")
    rp.update_blog_index(blog_dir, "2026-09-23", "Other", "2026-09-23-pr-420-other.md")

    run(tmp_path)

    assert not (blog_dir / stale).exists()
    assert (blog_dir / "2026-09-23-pr-420-other.md").exists()
    index = (blog_dir / "README.md").read_text(encoding="utf-8")
    assert stale not in index
    assert "2026-09-23-pr-420-other.md" in index
    assert index.count("pr-42-") == 1


def test_update_tables_without_a_new_release_lists_existing_releases(tmp_path):
    make_repo(tmp_path)
    rp.update_tables(REPO, FakeGitHub(), root=tmp_path)
    readme = (tmp_path / "README.md").read_text(encoding="utf-8")
    assert "v0.0.3" not in readme
    assert f"| [v0.0.2](https://github.com/{REPO}/releases/tag/v0.0.2) | 2026-09-20 | fix: Older change | — |" in readme
    assert "v0.0.2" in (tmp_path / "docs" / "index.html").read_text(encoding="utf-8")
