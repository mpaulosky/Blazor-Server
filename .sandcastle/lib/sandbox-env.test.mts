import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { containsSecret, githubTokensIn, sandboxEnv } from "./sandbox-env.mts";

describe("githubTokensIn", () => {
  it("finds GitHub tokens the env file would pass into the sandbox", () => {
    const env = "CLAUDE_CODE_OAUTH_TOKEN=abc\nGH_TOKEN=\n export GITHUB_TOKEN = x\n";

    assert.deepEqual(githubTokensIn(env), ["GH_TOKEN", "GITHUB_TOKEN"]);
  });

  it("ignores comments", () => {
    const env = "# GH_TOKEN is no longer used\n#GITHUB_TOKEN=\nANTHROPIC_API_KEY=k";

    assert.deepEqual(githubTokensIn(env), []);
  });
});

describe("sandboxEnv", () => {
  it("takes each key's value from the file, or from the host when the file leaves it blank", () => {
    const env = sandboxEnv("# comment\nCLAUDE_CODE_OAUTH_TOKEN=\nANTHROPIC_API_KEY=\"from-file-1\"\nUNSET=\n", {
      CLAUDE_CODE_OAUTH_TOKEN: "from-host-1",
    });

    assert.deepEqual([...env], [
      ["CLAUDE_CODE_OAUTH_TOKEN", "from-host-1"],
      ["ANTHROPIC_API_KEY", "from-file-1"],
    ]);
  });
});

describe("containsSecret", () => {
  // Built at run time, so no scanner mistakes this file for a leak.
  const claudeShaped = ["sk", "ant", "x".repeat(24)].join("-");
  const githubShaped = `${"gh"}p_${"A".repeat(36)}`;

  it("finds a secret value the sandbox was given", () => {
    assert.ok(containsSecret("token: abcdefgh12345", ["abcdefgh12345"]));
  });

  it("ignores values too short to tell from ordinary words", () => {
    assert.ok(!containsSecret("a key", ["key"]));
  });

  it("finds Claude- and GitHub-shaped tokens that didn't come from the env file", () => {
    assert.ok(containsSecret(`x = "${claudeShaped}"`, []));
    assert.ok(containsSecret(`x = "${githubShaped}"`, []));
  });

  it("finds nothing in ordinary code", () => {
    assert.ok(!containsSecret("const answer = 42;\n", ["abcdefgh12345"]));
  });
});
