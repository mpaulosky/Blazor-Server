import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readinessReason } from "./gate.mts";
import type { ContentEdit, IssueEvent, SandcastleIssue } from "./github.mts";
import { needsIntake } from "./intake.mts";
import {
  approval,
  ISSUE_LABEL_RULES,
  labelOriginFixes,
  loadQueue,
  type IsOwner,
  type QueueGitHub,
} from "./queue.mts";

// true for the owner, false for a stranger, undefined for a login whose
// permission couldn't be looked up, and false for a null (deleted) actor.
const isOwnerOf =
  (map: Record<string, boolean | undefined>): IsOwner =>
  (login) =>
    login === null ? false : map[login];

const OWNER_AND_STRANGER = isOwnerOf({ owner: true, stranger: false, host: true });

describe("approval", () => {
  it("isn't approved when there's no labeled event adding the queue label", () => {
    assert.equal(approval("Sandcastle", [], [], OWNER_AND_STRANGER).approved, false);
  });

  it("approves when the most recent add of the queue label is the owner's, with no edit since", () => {
    const events: IssueEvent[] = [{ event: "labeled", actor: "owner", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" }];

    assert.deepEqual(approval("Sandcastle", events, [], OWNER_AND_STRANGER), { approved: true });
  });

  it("isn't approved when the most recent add was a stranger's", () => {
    const events: IssueEvent[] = [{ event: "labeled", actor: "stranger", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" }];

    assert.equal(approval("Sandcastle", events, [], OWNER_AND_STRANGER).approved, false);
  });

  it("matches the queue label case-insensitively", () => {
    const events: IssueEvent[] = [{ event: "labeled", actor: "owner", label: "sandcastle", createdAt: "2026-10-01T00:00:00Z" }];

    assert.deepEqual(approval("Sandcastle", events, [], OWNER_AND_STRANGER), { approved: true });
  });

  it("uses the most recent add, not an earlier one", () => {
    const events: IssueEvent[] = [
      { event: "labeled", actor: "owner", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" },
      { event: "labeled", actor: "stranger", label: "Sandcastle", createdAt: "2026-10-02T00:00:00Z" },
    ];

    assert.equal(approval("Sandcastle", events, [], OWNER_AND_STRANGER).approved, false);
  });

  it("ties an equal timestamp to the later event in API order", () => {
    const events: IssueEvent[] = [
      { event: "labeled", actor: "stranger", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" },
      { event: "labeled", actor: "owner", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" },
    ];

    assert.deepEqual(approval("Sandcastle", events, [], OWNER_AND_STRANGER), { approved: true });
  });

  it("isn't approved when a stranger renamed the issue after the owner's add", () => {
    const events: IssueEvent[] = [
      { event: "labeled", actor: "owner", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" },
      { event: "renamed", actor: "stranger", label: null, createdAt: "2026-10-02T00:00:00Z" },
    ];

    assert.equal(approval("Sandcastle", events, [], OWNER_AND_STRANGER).approved, false);
  });

  it("isn't approved when a body edit at or after the owner's add has a stranger editor", () => {
    const events: IssueEvent[] = [{ event: "labeled", actor: "owner", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" }];
    const edits: ContentEdit[] = [{ editor: "stranger", editedAt: "2026-10-01T00:00:00Z" }];

    assert.equal(approval("Sandcastle", events, edits, OWNER_AND_STRANGER).approved, false);
  });

  it("is approved when the stranger's edit was before the owner's add", () => {
    const events: IssueEvent[] = [{ event: "labeled", actor: "owner", label: "Sandcastle", createdAt: "2026-10-02T00:00:00Z" }];
    const edits: ContentEdit[] = [{ editor: "stranger", editedAt: "2026-10-01T00:00:00Z" }];

    assert.deepEqual(approval("Sandcastle", events, edits, OWNER_AND_STRANGER), { approved: true });
  });

  it("is approved again once the owner re-adds the label after a stranger's edit", () => {
    const events: IssueEvent[] = [
      { event: "labeled", actor: "owner", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" },
      { event: "labeled", actor: "owner", label: "Sandcastle", createdAt: "2026-10-03T00:00:00Z" },
    ];
    const edits: ContentEdit[] = [{ editor: "stranger", editedAt: "2026-10-02T00:00:00Z" }];

    assert.deepEqual(approval("Sandcastle", events, edits, OWNER_AND_STRANGER), { approved: true });
  });

  it("treats a null editor as a non-owner", () => {
    const events: IssueEvent[] = [{ event: "labeled", actor: "owner", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" }];
    const edits: ContentEdit[] = [{ editor: null, editedAt: "2026-10-02T00:00:00Z" }];

    assert.equal(approval("Sandcastle", events, edits, OWNER_AND_STRANGER).approved, false);
  });

  it("isn't approved when the add's actor permission is unknown", () => {
    const events: IssueEvent[] = [{ event: "labeled", actor: "ghost", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" }];

    assert.equal(approval("Sandcastle", events, [], OWNER_AND_STRANGER).approved, false);
  });
});

describe("labelOriginFixes", () => {
  const rules = { trustAdds: ["sandcastle:ready"], trustRemovals: ["sandcastle:needs-info", "sandcastle:needs-human"] };

  it("removes a trusted-add label whose most recent add wasn't the owner's", () => {
    const events: IssueEvent[] = [{ event: "labeled", actor: "stranger", label: "sandcastle:ready", createdAt: "2026-10-01T00:00:00Z" }];

    const { fixes, unknown } = labelOriginFixes(["sandcastle:ready"], events, OWNER_AND_STRANGER, rules);

    assert.deepEqual(fixes.map((fix) => ({ action: fix.action, label: fix.label })), [{ action: "remove", label: "sandcastle:ready" }]);
    assert.deepEqual(unknown, []);
  });

  it("removes a trusted-add label with no labeled event at all", () => {
    const { fixes } = labelOriginFixes(["sandcastle:ready"], [], OWNER_AND_STRANGER, rules);

    assert.deepEqual(fixes.map((fix) => fix.action), ["remove"]);
  });

  it("leaves a trusted-add label alone when the owner's own add is its most recent", () => {
    const events: IssueEvent[] = [{ event: "labeled", actor: "owner", label: "sandcastle:ready", createdAt: "2026-10-01T00:00:00Z" }];

    const { fixes } = labelOriginFixes(["sandcastle:ready"], events, OWNER_AND_STRANGER, rules);

    assert.deepEqual(fixes, []);
  });

  it("restores a trusted-removal label the issue doesn't carry, whose most recent removal wasn't the owner's", () => {
    const events: IssueEvent[] = [{ event: "unlabeled", actor: "stranger", label: "sandcastle:needs-human", createdAt: "2026-10-01T00:00:00Z" }];

    const { fixes } = labelOriginFixes([], events, OWNER_AND_STRANGER, rules);

    assert.deepEqual(fixes.map((fix) => ({ action: fix.action, label: fix.label })), [{ action: "restore", label: "sandcastle:needs-human" }]);
  });

  it("leaves a trusted-removal label alone when the owner's own removal is its most recent", () => {
    const events: IssueEvent[] = [{ event: "unlabeled", actor: "owner", label: "sandcastle:needs-human", createdAt: "2026-10-01T00:00:00Z" }];

    const { fixes } = labelOriginFixes([], events, OWNER_AND_STRANGER, rules);

    assert.deepEqual(fixes, []);
  });

  it("matches labels case-insensitively", () => {
    const events: IssueEvent[] = [{ event: "labeled", actor: "stranger", label: "Sandcastle:Ready", createdAt: "2026-10-01T00:00:00Z" }];

    const { fixes } = labelOriginFixes(["sandcastle:ready"], events, OWNER_AND_STRANGER, rules);

    assert.deepEqual(fixes.map((fix) => fix.action), ["remove"]);
  });

  it("leaves an unknown actor's label out of fixes, naming it in unknown instead", () => {
    const events: IssueEvent[] = [{ event: "labeled", actor: "ghost", label: "sandcastle:ready", createdAt: "2026-10-01T00:00:00Z" }];

    const { fixes, unknown } = labelOriginFixes(["sandcastle:ready"], events, OWNER_AND_STRANGER, rules);

    assert.deepEqual(fixes, []);
    assert.deepEqual(unknown, ["sandcastle:ready"]);
  });
});

// An issue carrying `labels` (Sandcastle by default), for loadQueue's stub
// QueueGitHub to serve.
const issue = (number: number, labels: string[] = ["Sandcastle"]): SandcastleIssue => ({
  number,
  title: `Issue ${number}`,
  body: `Body of ${number}`,
  labels,
  comments: [],
});

// A QueueGitHub stub serving `issues`, each issue's events and body edits by
// number, and recording every label it's asked to add or remove. A number
// in `fail` makes both writes throw, as a failed gh call would.
function stubQueueGithub({
  issues,
  events = {},
  edits = {},
  isOwner = OWNER_AND_STRANGER,
  fail = new Set<number>(),
}: {
  issues: SandcastleIssue[];
  events?: Record<number, IssueEvent[]>;
  edits?: Record<number, ContentEdit[]>;
  isOwner?: IsOwner;
  fail?: Set<number>;
}) {
  const removed: { number: number; label: string }[] = [];
  const added: { number: number; label: string }[] = [];
  const github: QueueGitHub = {
    issuesInScope: () => issues,
    events: (number) => events[number] ?? [],
    bodyEdits: (number) => edits[number] ?? [],
    isOwner,
    removeLabel: (number, label) => {
      if (fail.has(number)) throw new Error("gh api failed: HTTP 502");
      removed.push({ number, label });
    },
    addLabel: (number, label) => {
      if (fail.has(number)) throw new Error("gh api failed: HTTP 502");
      added.push({ number, label });
    },
  };
  return { github, removed, added };
}

// Issue #146's acceptance criteria: only work the repository owner queued
// and approved reaches an agent.
describe("loadQueue", () => {
  const SCOPE = { kind: "label", label: "Sandcastle" } as const;

  it("skips an issue whose Sandcastle label a stranger added, logging the reason and writing nothing", () => {
    const events = { 10: [{ event: "labeled" as const, actor: "stranger", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" }] };
    const { github, removed, added } = stubQueueGithub({ issues: [issue(10)], events });
    const lines: string[] = [];

    const kept = loadQueue(SCOPE, github, (line) => lines.push(line), new Set());

    assert.deepEqual(kept.map((i) => i.number), []);
    assert.ok(lines.some((line) => line.includes("#10") && line.includes("stranger")), lines.join("\n"));
    assert.deepEqual(removed, []);
    assert.deepEqual(added, []);
  });

  it("keeps an issue the host itself labelled, as a split's children are", () => {
    const events = { 11: [{ event: "labeled" as const, actor: "host", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" }] };
    const { github } = stubQueueGithub({ issues: [issue(11)], events });

    const kept = loadQueue(SCOPE, github, () => {}, new Set());

    assert.deepEqual(kept.map((i) => i.number), [11]);
  });

  it("skips when the owner's add was followed by a later stranger add: the most recent wins", () => {
    const events = {
      12: [
        { event: "labeled" as const, actor: "owner", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" },
        { event: "labeled" as const, actor: "stranger", label: "Sandcastle", createdAt: "2026-10-02T00:00:00Z" },
      ],
    };
    const { github } = stubQueueGithub({ issues: [issue(12)], events });

    const kept = loadQueue(SCOPE, github, () => {}, new Set());

    assert.deepEqual(kept.map((i) => i.number), []);
  });

  it("skips, with no write, when the labelling actor's permission is unknown", () => {
    const events = { 13: [{ event: "labeled" as const, actor: "ghost", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" }] };
    const { github, removed, added } = stubQueueGithub({ issues: [issue(13)], events });

    const kept = loadQueue(SCOPE, github, () => {}, new Set());

    assert.deepEqual(kept.map((i) => i.number), []);
    assert.deepEqual(removed, []);
    assert.deepEqual(added, []);
  });

  it("approves on the scope's own label in a non-default label scope", () => {
    const scope = { kind: "label" as const, label: "Sandcastle:dev" };
    const events = { 14: [{ event: "labeled" as const, actor: "owner", label: "Sandcastle:dev", createdAt: "2026-10-01T00:00:00Z" }] };
    const { github } = stubQueueGithub({ issues: [issue(14, ["Sandcastle:dev"])], events });

    const kept = loadQueue(scope, github, () => {}, new Set());

    assert.deepEqual(kept.map((i) => i.number), [14]);
  });

  it("skips an owner-labelled issue a stranger edited afterwards, until the owner re-adds the label", () => {
    const events = { 20: [{ event: "labeled" as const, actor: "owner", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" }] };
    const edits = { 20: [{ editor: "stranger", editedAt: "2026-10-02T00:00:00Z" }] };
    const { github } = stubQueueGithub({ issues: [issue(20)], events, edits });

    const kept = loadQueue(SCOPE, github, () => {}, new Set());

    assert.deepEqual(kept.map((i) => i.number), []);
  });

  it("skips the same way when a stranger renamed the issue after the owner labelled it", () => {
    const events = {
      21: [
        { event: "labeled" as const, actor: "owner", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" },
        { event: "renamed" as const, actor: "stranger", label: null, createdAt: "2026-10-02T00:00:00Z" },
      ],
    };
    const { github } = stubQueueGithub({ issues: [issue(21)], events });

    const kept = loadQueue(SCOPE, github, () => {}, new Set());

    assert.deepEqual(kept.map((i) => i.number), []);
  });

  it("skips when a stranger's edit lands exactly when the owner labelled the issue", () => {
    const events = { 22: [{ event: "labeled" as const, actor: "owner", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" }] };
    const edits = { 22: [{ editor: "stranger", editedAt: "2026-10-01T00:00:00Z" }] };
    const { github } = stubQueueGithub({ issues: [issue(22)], events, edits });

    const kept = loadQueue(SCOPE, github, () => {}, new Set());

    assert.deepEqual(kept.map((i) => i.number), []);
  });

  it("keeps the issue when the stranger's edit was before the owner labelled it", () => {
    const events = { 23: [{ event: "labeled" as const, actor: "owner", label: "Sandcastle", createdAt: "2026-10-02T00:00:00Z" }] };
    const edits = { 23: [{ editor: "stranger", editedAt: "2026-10-01T00:00:00Z" }] };
    const { github } = stubQueueGithub({ issues: [issue(23)], events, edits });

    const kept = loadQueue(SCOPE, github, () => {}, new Set());

    assert.deepEqual(kept.map((i) => i.number), [23]);
  });

  it("keeps the issue once the owner re-adds the label after a stranger's edit", () => {
    const events = {
      24: [
        { event: "labeled" as const, actor: "owner", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" },
        { event: "labeled" as const, actor: "owner", label: "Sandcastle", createdAt: "2026-10-03T00:00:00Z" },
      ],
    };
    const edits = { 24: [{ editor: "stranger", editedAt: "2026-10-02T00:00:00Z" }] };
    const { github } = stubQueueGithub({ issues: [issue(24)], events, edits });

    const kept = loadQueue(SCOPE, github, () => {}, new Set());

    assert.deepEqual(kept.map((i) => i.number), [24]);
  });

  it("holds a skipped issue out of needsIntake too: it never reaches intake", () => {
    const events = { 25: [{ event: "labeled" as const, actor: "owner", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" }] };
    const edits = { 25: [{ editor: "stranger", editedAt: "2026-10-02T00:00:00Z" }] };
    const { github } = stubQueueGithub({ issues: [issue(25)], events, edits });

    const kept = loadQueue(SCOPE, github, () => {}, new Set());

    assert.deepEqual(needsIntake(kept).map((i) => i.number), []);
  });

  it("removes a stranger-added sandcastle:ready label and lets the issue go through intake", () => {
    const events = {
      30: [
        { event: "labeled" as const, actor: "owner", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" },
        { event: "labeled" as const, actor: "stranger", label: "sandcastle:ready", createdAt: "2026-10-02T00:00:00Z" },
      ],
    };
    const { github, removed } = stubQueueGithub({ issues: [issue(30, ["Sandcastle", "sandcastle:ready"])], events });

    const kept = loadQueue(SCOPE, github, () => {}, new Set());

    assert.deepEqual(removed, [{ number: 30, label: "sandcastle:ready" }]);
    assert.deepEqual(kept[0]?.labels, ["Sandcastle"]);
    assert.deepEqual(needsIntake(kept).map((i) => i.number), [30]);
  });

  it("leaves sandcastle:ready alone when the owner added it", () => {
    const events = {
      31: [
        { event: "labeled" as const, actor: "owner", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" },
        { event: "labeled" as const, actor: "owner", label: "sandcastle:ready", createdAt: "2026-10-02T00:00:00Z" },
      ],
    };
    const { github, removed } = stubQueueGithub({ issues: [issue(31, ["Sandcastle", "sandcastle:ready"])], events });

    const kept = loadQueue(SCOPE, github, () => {}, new Set());

    assert.deepEqual(removed, []);
    assert.deepEqual(kept[0]?.labels, ["Sandcastle", "sandcastle:ready"]);
  });

  for (const handBackLabel of ["sandcastle:needs-info", "sandcastle:needs-human"]) {
    it(`restores ${handBackLabel} a stranger removed, so the issue stays handed back`, () => {
      const events = {
        32: [
          { event: "labeled" as const, actor: "owner", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" },
          { event: "unlabeled" as const, actor: "stranger", label: handBackLabel, createdAt: "2026-10-02T00:00:00Z" },
        ],
      };
      const { github, added } = stubQueueGithub({ issues: [issue(32, ["Sandcastle"])], events });

      const kept = loadQueue(SCOPE, github, () => {}, new Set());

      assert.deepEqual(added, [{ number: 32, label: handBackLabel }]);
      assert.ok(kept[0]?.labels.includes(handBackLabel), JSON.stringify(kept));
      assert.notEqual(readinessReason(kept[0]!), undefined, "a restored hand-back label should still hold the issue back from the gate");
    });
  }

  it("leaves a hand-back label removed by the owner off: no write", () => {
    const events = {
      33: [
        { event: "labeled" as const, actor: "owner", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" },
        { event: "unlabeled" as const, actor: "owner", label: "sandcastle:needs-human", createdAt: "2026-10-02T00:00:00Z" },
      ],
    };
    const { github, added } = stubQueueGithub({ issues: [issue(33, ["Sandcastle"])], events });

    const kept = loadQueue(SCOPE, github, () => {}, new Set());

    assert.deepEqual(added, []);
    assert.deepEqual(kept[0]?.labels, ["Sandcastle"]);
  });

  it("skips the issue, rather than guessing, when a label fix's write fails", () => {
    const events = {
      34: [
        { event: "labeled" as const, actor: "owner", label: "Sandcastle", createdAt: "2026-10-01T00:00:00Z" },
        { event: "labeled" as const, actor: "stranger", label: "sandcastle:ready", createdAt: "2026-10-02T00:00:00Z" },
      ],
    };
    const { github } = stubQueueGithub({ issues: [issue(34, ["Sandcastle", "sandcastle:ready"])], events, fail: new Set([34]) });

    const kept = loadQueue(SCOPE, github, () => {}, new Set());

    assert.deepEqual(kept.map((i) => i.number), []);
  });
});

describe("ISSUE_LABEL_RULES", () => {
  it("trusts sandcastle:ready only as an add, and the hand-back labels only as a removal", () => {
    assert.deepEqual(ISSUE_LABEL_RULES.trustAdds, ["sandcastle:ready"]);
    assert.deepEqual([...ISSUE_LABEL_RULES.trustRemovals], ["sandcastle:needs-info", "sandcastle:needs-human"]);
  });
});
