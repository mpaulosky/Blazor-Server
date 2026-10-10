import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

// The value of `NAME=value` at the start of a line, as gate.sh sets a variable
// and the Dockerfile sets an ARG, with any quotes removed.
function setting(text: string, name: string): string | undefined {
  return new RegExp(`^(?:ARG )?${name}="?([^"\\s]+)"?`, "m").exec(text)?.[1];
}

describe("the sandbox image's linters", () => {
  // gate.sh runs a linter from PATH before its pinned Docker or uvx fallback, so
  // the image's copy must be the version the gate and CI pin.
  for (const name of ["ACTIONLINT_VERSION", "SHELLCHECK_VERSION", "ZIZMOR_VERSION"]) {
    it(`installs the ${name} scripts/gate.sh pins`, () => {
      const pinned = setting(read("scripts/gate.sh"), name);

      assert.ok(pinned, `scripts/gate.sh doesn't set ${name}`);
      assert.equal(setting(read(".sandcastle/Dockerfile"), name), pinned);
    });
  }
});
