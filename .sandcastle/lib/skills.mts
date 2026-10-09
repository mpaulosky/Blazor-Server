// The .NET skills live in the host user's ~/.claude/skills, not in the repo,
// and the sandbox only sees the worktree. So each one is bind-mounted, read
// only, into the sandbox user's ~/.claude/skills. A skill there is usually a
// symlink into a dotfiles checkout, which a mount of the folder wouldn't
// follow, so each skill's real path is mounted on its own.
//
// Every sandbox also gets .git/config and .git/hooks read-only, over
// Sandcastle's read-write mount of the shared .git directory, so no agent can
// plant a command there for the host's git to run (see lib/host-safety.mts).

import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { protectedGitMounts, repoGitDir, type ReadOnlyMount } from "./host-safety.mts";

// The skills the tester and backend role prompts (roles/tester.md and
// roles/backend.md) tell the agent to use.
export const SANDBOX_SKILLS = [
  "dotnet-tdd",
  "dotnet-add-testing",
  "dotnet-xunit",
  "dotnet-testing-strategy",
  "dotnet-project-analysis",
  "dotnet-inspect",
] as const;

export type SkillMount = ReadOnlyMount;

// Mounts for the named skills found in skillsDir, and the names it lacks.
export function skillMounts(
  skillsDir: string,
  names: readonly string[],
): { mounts: SkillMount[]; missing: string[] } {
  const mounts: SkillMount[] = [];
  const missing: string[] = [];
  for (const name of names) {
    const hostPath = join(skillsDir, name);
    if (!existsSync(join(hostPath, "SKILL.md"))) {
      missing.push(name);
      continue;
    }
    mounts.push({
      hostPath: realpathSync(hostPath),
      sandboxPath: `/home/agent/.claude/skills/${name}`,
      readonly: true,
    });
  }
  return { mounts, missing };
}

// What makeAgentSandbox needs from outside; tests pass stubs.
export type SandboxHost<TProvider> = {
  skillsDir: string;
  // The read-only mounts over the shared .git directory's config and hooks.
  gitMounts(): ReadOnlyMount[];
  docker(options: { mounts: ReadOnlyMount[] }): TProvider;
  log(message: string): void;
};

// A factory for the Docker sandbox every role runs in, with the host's skills
// mounted and .git/config and .git/hooks read-only. The skills are looked up on
// the first call and reused after it, so a missing skill is reported once and
// skipped: the agent works without it.
export function makeAgentSandbox<TProvider>(
  host: SandboxHost<TProvider>,
  names: readonly string[] = SANDBOX_SKILLS,
): () => TProvider {
  let hostSkills: SkillMount[] | undefined;
  return () => {
    if (!hostSkills) {
      const { mounts, missing } = skillMounts(host.skillsDir, names);
      if (missing.length > 0) {
        host.log(`  ⚠ Skills not in ~/.claude/skills, so not in the sandbox: ${missing.join(", ")}`);
      }
      hostSkills = mounts;
    }
    return host.docker({ mounts: [...hostSkills, ...host.gitMounts()] });
  };
}

export const agentSandbox = makeAgentSandbox({
  skillsDir: join(homedir(), ".claude", "skills"),
  gitMounts: () => protectedGitMounts(repoGitDir()),
  docker,
  log: console.log,
});
