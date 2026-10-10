// ---------------------------------------------------------------------------
// Umbrellas
//
// Intake splits an oversized issue into child issues and turns the original
// into an umbrella (see lib/intake.mts#applyVerdicts): it loses Sandcastle
// and carries one comment with UMBRELLA_MARKER listing its children, so
// listSandcastleIssues can no longer see it. Each round the host looks for
// open umbrellas and closes as completed any whose children have all closed
// as completed. One still open, or closed as not planned, keeps the umbrella
// open too: its own work isn't finished either way.
// ---------------------------------------------------------------------------

import { execFileSync } from "node:child_process";
import { UMBRELLA_MARKER } from "./config.mts";
import { closeIssueAsCompleted, openIssuesWithComment, repoName, subIssuesOf, type SubIssue } from "./github.mts";

// The GitHub reads and writes closing an umbrella needs; tests pass a stub.
export type UmbrellaGitHub = {
  // The open issues carrying UMBRELLA_MARKER.
  openUmbrellas(): number[];
  // The umbrella's children, with enough state to tell whether each closed
  // as completed.
  subIssues(parent: number): SubIssue[];
  closeCompleted(number: number): void;
};

export const liveUmbrellaGitHub: UmbrellaGitHub = {
  openUmbrellas: () => openIssuesWithComment(UMBRELLA_MARKER, execFileSync, repoName()),
  subIssues: subIssuesOf,
  closeCompleted: closeIssueAsCompleted,
};

// Closes as completed any open umbrella whose children have all closed as
// completed. Leaves one open while it has no children yet, any child is
// still open, or a child closed as not planned: that child's work never
// landed, so the umbrella's own job isn't done either. Returns the numbers
// of the umbrellas this round closed.
export function closeFinishedUmbrellas(
  github: UmbrellaGitHub = liveUmbrellaGitHub,
  log: (line: string) => void = console.log,
): number[] {
  throw new Error("Not implemented");
}
