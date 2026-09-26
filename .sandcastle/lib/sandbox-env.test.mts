import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { githubTokensIn } from "./sandbox-env.mts";

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
