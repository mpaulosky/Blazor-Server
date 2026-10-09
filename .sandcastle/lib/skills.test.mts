import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { makeAgentSandbox, skillMounts, type SkillMount } from "./skills.mts";

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

describe("makeAgentSandbox", () => {
  function host(skillsDir: string) {
    const dockerCalls: { mounts: SkillMount[] }[] = [];
    const logs: string[] = [];
    const provider = { name: "stub-docker" };
    return {
      dockerCalls,
      logs,
      provider,
      host: {
        skillsDir,
        gitMounts: () => [{ hostPath: "/repo/.git/config", sandboxPath: "/repo/.git/config", readonly: true as const }],
        docker: (options: { mounts: SkillMount[] }) => {
          dockerCalls.push(options);
          return provider;
        },
        log: (message: string) => logs.push(message),
      },
    };
  }

  it("passes the found skills' mounts to every Docker sandbox it creates", () => {
    const skillsDir = mkdtempSync(join(tmpdir(), "skills-"));
    skill(join(skillsDir, "dotnet-tdd"));
    const stub = host(skillsDir);
    const agentSandbox = makeAgentSandbox(stub.host, ["dotnet-tdd"]);

    const first = agentSandbox();
    const second = agentSandbox();

    assert.equal(first, stub.provider);
    assert.equal(second, stub.provider);
    assert.deepEqual(stub.dockerCalls.map((call) => call.mounts.map((mount) => mount.sandboxPath)), [
      ["/home/agent/.claude/skills/dotnet-tdd", "/repo/.git/config"],
      ["/home/agent/.claude/skills/dotnet-tdd", "/repo/.git/config"],
    ]);
  });

  it("mounts the .git directory's config read-only in every sandbox, even with no skills found", () => {
    const skillsDir = mkdtempSync(join(tmpdir(), "skills-"));
    const stub = host(skillsDir);

    makeAgentSandbox(stub.host, ["dotnet-tdd"])();

    assert.deepEqual(stub.dockerCalls[0]?.mounts, [
      { hostPath: "/repo/.git/config", sandboxPath: "/repo/.git/config", readonly: true },
    ]);
  });

  it("reports missing skills once, however many sandboxes it creates", () => {
    const skillsDir = mkdtempSync(join(tmpdir(), "skills-"));
    const stub = host(skillsDir);
    const agentSandbox = makeAgentSandbox(stub.host, ["dotnet-tdd", "dotnet-xunit"]);

    agentSandbox();
    agentSandbox();

    assert.equal(stub.logs.length, 1);
    assert.match(stub.logs[0] ?? "", /dotnet-tdd, dotnet-xunit/);
  });

  it("logs nothing when every skill is found", () => {
    const skillsDir = mkdtempSync(join(tmpdir(), "skills-"));
    skill(join(skillsDir, "dotnet-tdd"));
    const stub = host(skillsDir);

    makeAgentSandbox(stub.host, ["dotnet-tdd"])();

    assert.deepEqual(stub.logs, []);
  });
});
