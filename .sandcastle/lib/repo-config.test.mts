import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { CHECK_PATHS, GATE_COVERED_CHECKS, ROLE_AGENTS } from "./repo-config.mts";

// This repo's own values in lib/repo-config.mts, pinned to the files they describe. The Owned tests take their values from the
// config, so none of them notices a CI job that was renamed or a test project that was added.

const root = fileURLToPath(new URL("../../", import.meta.url));
const workflows = join(root, ".github/workflows");
const workflowText = readdirSync(workflows)
  .filter((file) => /\.ya?ml$/.test(file))
  .map((file) => readFileSync(join(workflows, file), "utf8"))
  .join("\n");
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// The projects ci.yml runs a "Tests: <folder>" job for: .github/scripts/discover_tests.py takes every tests/**/*.csproj whose IsTestProject
// is true, which Directory.Build.props sets for a project name containing ".Tests", and names the job after the project's folder.
const testProjects = (readdirSync(join(root, "tests"), { recursive: true }) as string[])
  .map((entry) => entry.split("\\").join("/"))
  .filter((entry) => entry.endsWith(".csproj") && basename(entry).includes(".Tests"))
  .map((entry) => basename(dirname(entry)));

describe("GATE_COVERED_CHECKS", () => {
  // ci.yml names each matrix job "Tests: <folder>", and the follow-up pass matches a check by its exact name.
  it("names a Tests job for every test project under tests/, and none for a project that isn't there", () => {
    const listed = GATE_COVERED_CHECKS.filter((name) => name.startsWith("Tests: ")).map((name) => name.slice("Tests: ".length));

    assert.deepEqual([...listed].sort(), [...testProjects].sort());
  });

  it("matches the name ci.yml gives its test matrix jobs", () => {
    assert.match(workflowText, /name: "Tests: \$\{\{ matrix\.test_name \}\}"/);
  });

  // A job is found by its `name:`, or by its id when it has none.
  for (const name of GATE_COVERED_CHECKS.filter((check) => !check.startsWith("Tests: "))) {
    it(`names a job in a workflow: ${name}`, () => {
      const byName = new RegExp(`^\\s*name:\\s*["']?${escaped(name)}["']?\\s*$`, "m");
      const byId = new RegExp(`^  ${escaped(name)}:\\s*$`, "m");

      assert.ok(byName.test(workflowText) || byId.test(workflowText), `no workflow job is called ${name}`);
    });
  }
});

describe("CHECK_PATHS", () => {
  it("lists only paths that exist", () => {
    for (const path of CHECK_PATHS) assert.ok(existsSync(join(root, path)), `${path} does not exist`);
  });

  // The gate picks its test projects with .github/scripts/discover_tests.py, and builds and lints with these files' rules, so an
  // agent that edits one can make the gate and CI pass with fewer checks. A PR whose branch changes one lists it for the reviewer.
  it("lists the places the gate reads its checks from", () => {
    for (const path of [
      "scripts/",
      ".github/ci/",
      ".github/workflows/",
      ".github/scripts/",
      "Directory.Build.props",
      "Directory.Packages.props",
      ".editorconfig",
      "global.json",
      ".markdownlint-cli2.jsonc",
      ".yamllint.yml",
    ]) {
      assert.ok(CHECK_PATHS.includes(path), `CHECK_PATHS lacks ${path}`);
    }
  });

  it("ends a folder with a slash", () => {
    for (const path of CHECK_PATHS) assert.equal(statSync(join(root, path)).isDirectory(), path.endsWith("/"), path);
  });
});

describe("ROLE_AGENTS", () => {
  // intake, planner and critique answer with structured output (Output.object), which one iteration produces: a second iteration of a
  // role that already answered costs a whole round (the comment above ROLE_AGENTS in lib/repo-config.mts). reviewer, gate-fixer and
  // follow-up are single-shot by design (docs/plans/sandcastle-workflow.md). The other roles' values are free to move.
  for (const role of ["intake", "planner", "critique", "reviewer", "gate-fixer", "follow-up"] as const) {
    it(`runs ${role} for one iteration`, () => {
      assert.equal(ROLE_AGENTS[role].maxIterations, 1);
    });
  }
});
