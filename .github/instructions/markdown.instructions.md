---
description: 'Documentation and content creation standards'
applyTo: '**/*.md'
---

# Markdown Instructions

`markdownlint-cli2` enforces these rules in CI and in the pre-commit and pre-push hooks, using `.markdownlint-cli2.jsonc`.
Its `ignores` list skips vendored skills and agents and the release blog posts in `docs/blogs/`, which the release workflow generates from PR bodies.
`.sandcastle/.markdownlint-cli2.jsonc` also allows several top-level headings in the Sandcastle prompts.

## Structure

- Start each document with one `#` H1 title. Use `##` and `###` below it, in order, without skipping levels. If you need H4, consider restructuring. H5 is a strong sign to restructure.
- Use blank lines to separate headings, lists, code blocks, and paragraphs. Avoid runs of blank lines.

## Content

- **Lists:** Use `-` for bullets and `1.` for numbered lists. Indent nested lists by two spaces.
- **Code blocks:** Use fenced code blocks with a language (`csharp`, `bash`, `text`, and so on).
- **Links:** Use `[descriptive text](url)`. Use relative links for files in this repository, and make sure they resolve.
- **Images:** Use `![alt text](url)` with meaningful alt text.
- **Tables:** Use tables for tabular data, with a header row.
- **Line length:** Keep lines at or under 200 characters. Prefer one sentence or clause per line in long paragraphs.

Blog posts under `docs/blogs/` have extra front-matter rules in `blog.instructions.md`. Other Markdown files have no front matter, apart from the `applyTo` header that instruction files need.
