import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { skillMounts } from "./skills.mts";

function skill(dir: string): string {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), "---\nname: x\n---\n");
  return dir;
}

describe("skillMounts", () => {
  it("mounts a symlinked skill from its real path, read only", () => {
    const root = mkdtempSync(join(tmpdir(), "skills-"));
    const real = skill(join(root, "dotfiles", "dotnet-tdd"));
    const skillsDir = join(root, "skills");
    mkdirSync(skillsDir);
    symlinkSync(real, join(skillsDir, "dotnet-tdd"));

    const { mounts } = skillMounts(skillsDir, ["dotnet-tdd"]);

    assert.deepEqual(mounts, [
      { hostPath: realpathSync(real), sandboxPath: "/home/agent/.claude/skills/dotnet-tdd", readonly: true },
    ]);
  });

  it("reports skills that are absent or have no SKILL.md", () => {
    const skillsDir = mkdtempSync(join(tmpdir(), "skills-"));
    skill(join(skillsDir, "dotnet-xunit"));
    mkdirSync(join(skillsDir, "dotnet-inspect"));

    const { mounts, missing } = skillMounts(skillsDir, ["dotnet-xunit", "dotnet-inspect", "dotnet-tdd"]);

    assert.deepEqual(mounts.map((mount) => mount.sandboxPath), ["/home/agent/.claude/skills/dotnet-xunit"]);
    assert.deepEqual(missing, ["dotnet-inspect", "dotnet-tdd"]);
  });
});
