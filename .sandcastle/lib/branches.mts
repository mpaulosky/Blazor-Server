import { sh } from "./shell.mts";

// Count the commits on the worktree's branch that origin/main doesn't have.
// origin/main is refreshed once per round, before the pipelines start, because
// concurrent fetches from each pipeline would contend on the same ref lock.
export function commitsAhead(worktreePath: string): number {
  return Number(sh(worktreePath, "git", "rev-list", "--count", "origin/main..HEAD"));
}

export function fetchMain(): void {
  sh(process.cwd(), "git", "fetch", "--quiet", "origin", "main");
}
