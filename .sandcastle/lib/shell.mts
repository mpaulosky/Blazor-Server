import { execFileSync } from "node:child_process";
import { hostGitEnv, repoGitDir } from "./host-safety.mts";

// Run a command on the host in `cwd` and return trimmed stdout. Throws on failure.
export const sh = (cwd: string, cmd: string, ...args: string[]) =>
  execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();

// The environment and arguments for a host git command in the main checkout at
// `checkout`, whose .git directory is `gitDir`: hooks off, both in the
// environment and with -c, and GIT_DIR, GIT_COMMON_DIR and GIT_WORK_TREE pinned,
// so no file an agent wrote decides which config git reads (see
// lib/host-safety.mts).
export function hostGitInvocation(
  checkout: string,
  gitDir: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): { env: NodeJS.ProcessEnv; args: string[] } {
  return {
    env: { ...hostGitEnv(env, gitDir), GIT_DIR: gitDir, GIT_WORK_TREE: checkout },
    args: ["-c", "core.hooksPath=/dev/null", ...args],
  };
}

// Run git on the host, always in the main checkout and never in a worktree,
// and return trimmed stdout. Throws on failure.
export function git(...args: string[]): string {
  const checkout = process.cwd();
  const gitDir = repoGitDir();
  const invocation = hostGitInvocation(checkout, gitDir, args);
  return execFileSync("git", invocation.args, {
    cwd: checkout,
    env: invocation.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    // The secret scan reads every patch the push would publish.
    maxBuffer: 512 * 1024 * 1024,
  }).trim();
}

// Remove a sandcastle.gatedHead marker an earlier version of Sandcastle left in
// .git/config. The pre-push hook skips the gate for the commit it names, and
// nothing writes or clears it any more: the host now pushes with hooks off.
// git exits non-zero when the key isn't set, which is the usual case.
export function forgetGatedHead(run: (...args: string[]) => string = git): void {
  try {
    run("config", "--local", "--unset-all", "sandcastle.gatedHead");
  } catch {
    // Not set.
  }
}
