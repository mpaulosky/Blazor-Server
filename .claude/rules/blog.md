---
paths:
  - "docs/blogs/**/*.md"
  - ".github/scripts/release_post.py"
  - ".github/scripts/backfill_blog_posts.py"
---

# Blog Post Rules

The release workflow generates every post with `.github/scripts/release_post.py`, so change the generator rather than
editing posts by hand. Posts follow `markdown.md`. In addition, every post starts with YAML front matter containing:

- `post_title`: the post's title.
- `author1`: the primary author.
- `post_slug`: the URL slug.
- `featured_image`: the URL of the featured image.
- `categories`: the post's categories.
- `tags`: the post's tags.
- `ai_note`: whether AI was used to write the post.
- `summary`: a short summary of the post.
- `post_date`: the publication date.
