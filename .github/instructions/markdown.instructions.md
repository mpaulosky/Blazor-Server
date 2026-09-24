---
description: 'Documentation and content creation standards'
applyTo: '**/*.md'
---

# Markdown Instructions

`markdownlint-cli2` enforces these rules in CI, using `.markdownlint-cli2.jsonc`.

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

## Blog posts

Only for posts under `docs/blogs/`: start the file with YAML front matter containing:

- `post_title`: the post's title.
- `author1`: the primary author.
- `post_slug`: the URL slug.
- `featured_image`: the URL of the featured image.
- `categories`: the post's categories.
- `tags`: the post's tags.
- `ai_note`: whether AI was used to write the post.
- `summary`: a short summary of the post.
- `post_date`: the publication date.

Other Markdown files (README, CONTRIBUTING, instructions, standards) have no front matter, apart from the `applyTo` header that instruction files need.
