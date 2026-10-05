// The .NET skills live in the host user's ~/.claude/skills, not in the repo,
// and the sandbox only sees the worktree. So each one is bind-mounted, read
// only, into the sandbox user's ~/.claude/skills. A skill there is usually a
// symlink into a dotfiles checkout, which a mount of the folder wouldn't
// follow, so each skill's real path is mounted on its own.

import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

// The skills implement-prompt.md tells the agent to use.
export const SANDBOX_SKILLS = [
  "dotnet-tdd",
  "dotnet-add-testing",
  "dotnet-xunit",
  "dotnet-testing-strategy",
  "dotnet-project-analysis",
  "dotnet-inspect",
] as const;

export type SkillMount = { hostPath: string; sandboxPath: string; readonly: true };

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

let hostSkills: SkillMount[] | undefined;

// The Docker sandbox every role runs in, with the host's skills mounted. A
// missing skill is reported once and skipped: the agent works without it.
export function agentSandbox() {
  if (!hostSkills) {
    const { mounts, missing } = skillMounts(join(homedir(), ".claude", "skills"), SANDBOX_SKILLS);
    if (missing.length > 0) {
      console.log(`  ⚠ Skills not in ~/.claude/skills, so not in the sandbox: ${missing.join(", ")}`);
    }
    hostSkills = mounts;
  }
  return docker({ mounts: hostSkills });
}
