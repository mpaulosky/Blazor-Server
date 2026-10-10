// The run summary for one round, logged once every issue's build has settled.

// What the summary needs from each build's result; see buildIssue.
type BuildResult = { prUrl: string | undefined; publishFailed: boolean };

// The summary's lines: each pull request the round opened, then each branch
// that passed both checkpoints but couldn't be pushed or get a PR. That work is
// done but stranded, which a person needs to hear apart from a round that
// built nothing. `stop` is the line to stop the run on when no pull request
// opened, and undefined when one did. `settled` holds each `work` item's
// build, in the same order.
export function roundSummary(
  work: readonly { issue: { number: number }; branch: string }[],
  settled: readonly PromiseSettledResult<BuildResult>[],
): { lines: string[]; stop: string | undefined } {
  const built = work.flatMap(({ issue, branch }, i) => {
    const outcome = settled[i];
    return outcome?.status === "fulfilled" ? [{ issue, branch, ...outcome.value }] : [];
  });
  const published = built.filter((build) => build.prUrl);
  const stranded = built.filter((build) => build.publishFailed);

  const lines = [
    `\nExecution complete. ${published.length} pull request(s):`,
    ...published.map(({ issue, branch, prUrl }) => `  #${issue.number} (${branch}) → ${prUrl}`),
  ];
  if (stranded.length > 0) {
    lines.push(
      `\n${stranded.length} gated branch(es) couldn't be published, so their work is stranded:`,
      ...stranded.map(({ issue, branch }) => `  #${issue.number} (${branch}): see the comment on the issue`),
    );
  }

  if (published.length > 0) return { lines, stop: undefined };
  const stop =
    stranded.length > 0
      ? "Publishing failed for every gated branch this round. Stopping."
      : "No pull requests opened this round. Stopping.";
  return { lines, stop };
}
