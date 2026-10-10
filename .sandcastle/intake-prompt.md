# ISSUES

Here are the open issues no one has judged yet:

<issues-json>

{{ISSUES_JSON}}

</issues-json>

Each issue has a `number`, a `title`, a `body`, its `labels`, and `comments` from people with write access to the repository.
Some of these issues may be blocked by others. Judge them anyway: the blocker gate runs after you, and a person should see your questions while a blocker is still in flight.

# TASK

Judge each issue on its own against the **Definition of Ready**. An issue is ready when it has all three of these:

1. A **Summary** of what changes and why. It doesn't need a `## Summary` heading, but the issue must say what it changes and why.
2. At least one **objectively checkable acceptance criterion**: a statement someone could check as true or false against the finished work. Prose is fine; checkboxes aren't required.
   "Works well" or "is clean" isn't checkable; "the gate holds back an issue labelled `sandcastle:needs-info`" is.
3. **No open question that needs a human decision.** An open question is one the issue asks, or leaves open between options, whose answer changes what gets built.
   A detail the builder can settle from the repository's code, its docs or its coding standards isn't an open question.

Read the comments as part of the issue: a comment from the author can answer a question the body leaves open.

Never invent any of the three yourself. They are the author's intent, so a missing Summary, criterion or decision is a question for the author, not a gap for you to fill.
You don't edit the issue, and you don't judge whether it's worth doing, how big it is, or how it relates to other issues.

Also decide whether each issue is a **bug**: it fixes behaviour that's wrong today, rather than adding or changing behaviour on purpose. A bug's branch is `fix/`.

# OUTPUT

Give one verdict per issue, as a JSON object wrapped in `<intake>` tags:

<intake>
{"verdicts": [
  {"id": "42", "verdict": "ready", "bug": false,
   "reason": "The Summary says the Theme toggle moves to the menu, and two criteria name what the menu shows."},
  {"id": "43", "verdict": "needs-info", "bug": false,
   "questions": ["Should the Palette dropdown list the gray-family scales too?", "What should a visitor with no Palette cookie see?"],
   "reason": "The issue has no checkable acceptance criterion, and leaves open which scales the dropdown lists."}
]}
</intake>

- `id` is the issue's `number`, as a string.
- `verdict` is `ready` when the issue meets all three requirements, and `needs-info` otherwise.
- `questions` is required for `needs-info` and left out for `ready`. Ask one question per unmet requirement or open decision, each one the author can answer by editing the issue.
  Don't number them: the host does.
- `bug` is `true` when the issue fixes wrong behaviour, and `false` otherwise.
- `reason` is one or two sentences saying which requirements the issue meets or misses. The host posts it on the issue, so write it for the person who reads it there.

Always emit the `<intake>` tags.

# RULES

You only read and judge: you commit nothing. These rules apply to every role:

{{SHARED_RULES}}
