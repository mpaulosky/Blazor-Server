# TASK

The gate (`scripts/gate.sh`) failed at checkpoint {{CHECKPOINT}} on branch {{BRANCH}}. Make it pass.

The host ran the gate itself, and its exit code is what counts. Here is its output:

<gate-output>

{{GATE_OUTPUT}}

</gate-output>

# THE ISSUE

The branch implements issue {{TASK_ID}}: {{ISSUE_TITLE}}

<issue>

{{ISSUE_BODY}}

</issue>

Comments on the issue from the repository owner:

<issue-comments>

{{ISSUE_COMMENTS}}

</issue-comments>

You can't reach GitHub from here, and don't need to: everything the issue says is above.

# WHAT YOU MAY CHANGE

Checkpoint 1 runs after the last developer run. There you may finish the implementation: add or change production code the issue asks for until its tests pass.

Checkpoint 2 runs after the review, just before the branch is published. There you may only repair: fix the build, lint errors and broken tests, and add no behaviour the branch
doesn't already have.

This is checkpoint {{CHECKPOINT}}.

At either checkpoint, never weaken, skip or delete a test to make the gate pass. Don't loosen an assertion, add `Skip`, comment a test out, raise a lint limit, or disable a rule.
When a test is wrong rather than the code, say so in your commit body instead of changing what it checks.

# EXECUTION

1. Read the gate output above and find the first failing step. The gate stops there, so later steps haven't run yet.
2. Fix the cause, running that step's command directly to check the fix.
3. Commit the fix.
4. Run `scripts/gate.sh`, and repeat until it passes or you can't make progress.

If you can't make the gate pass, commit what you fixed and say in the last commit's body what still fails and why.

Once complete, output <promise>COMPLETE</promise>.

# RULES

{{SHARED_RULES}}
