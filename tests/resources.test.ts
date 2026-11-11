import assert from "node:assert/strict";
import { test } from "node:test";
import { apply, applyOne, parseActions, plan, tree } from "../lib/resources";
import { createWorkspace } from "../lib/workspace";
import type { Workspace } from "../lib/workspace";

/**
 * The rule this file defends: the model may propose, and a person disposes.
 *
 * Creating, renaming, moving and writing are applied without a click because
 * they lose nothing. Deleting is never applied without one — not for a folder,
 * not for a single note, and not when the model is confident.
 */

function workspaceWith(): Workspace {
  const base = createWorkspace("Test");
  return {
    ...base,
    folders: [
      { id: "f:pricing", name: "Pricing", parentId: null, createdAt: "", origin: "you" },
      { id: "f:old", name: "Old notes", parentId: null, createdAt: "", origin: "you" },
    ],
    resources: [
      { id: "r:one", kind: "analysis", title: "Meal-prep, Kigali", folderId: "f:pricing", createdAt: "", origin: "you" },
      { id: "r:two", kind: "note", title: "Rider quotes", body: "Two riders said 1,200 RWF each.", folderId: null, createdAt: "", origin: "model" },
      { id: "r:three", kind: "note", title: "Old copy", body: "duplicate", folderId: "f:old", createdAt: "", origin: "you" },
    ],
  };
}

test("a delete is never applied automatically, whatever it targets", () => {
  const ws = workspaceWith();
  const verdicts = plan(
    [
      { action: "delete", resourceId: "r:three" },
      { action: "delete", targetFolderId: "f:old" },
    ],
    ws
  );

  for (const verdict of verdicts) {
    assert.equal(verdict.applies, false, "a delete must never apply itself");
    assert.equal(verdict.needsApproval, true, "a delete must always ask");
  }

  // And applying only the automatic tier changes nothing.
  const after = apply(verdicts, ws);
  assert.deepEqual(after.resources, ws.resources);
  assert.deepEqual(after.folders, ws.folders);
});

test("the approval line names what will be lost, including what is inside a folder", () => {
  const ws = workspaceWith();
  const [verdict] = plan([{ action: "delete", targetFolderId: "f:old" }], ws);
  assert.match(verdict.summary, /Old notes/);
  assert.match(verdict.summary, /1 thing inside it/);
});

test("safe actions are applied without asking", () => {
  const ws = workspaceWith();
  const verdicts = plan(
    [
      { action: "create_folder", name: "Hiring" },
      { action: "move", resourceId: "r:two", folderId: "f:pricing" },
      { action: "create_note", name: "Rider call", body: "Ask about the lunch window.", folderId: "f:pricing" },
    ],
    ws
  );

  assert.ok(verdicts.every((v) => v.applies && !v.needsApproval));

  const after = apply(verdicts, ws);
  assert.ok(after.folders.some((f) => f.name === "Hiring"));
  assert.equal(after.resources.find((r) => r.id === "r:two")?.folderId, "f:pricing");
  assert.ok(after.resources.some((r) => r.title === "Rider call"));
});

test("a model cannot invent an id to operate on", () => {
  const ws = workspaceWith();
  const verdicts = plan(
    [
      { action: "move", resourceId: "r:does-not-exist", folderId: null },
      { action: "delete", targetFolderId: "f:ghost" },
      { action: "move", resourceId: "r:one", folderId: "f:ghost" },
    ],
    ws
  );

  for (const verdict of verdicts) {
    assert.equal(verdict.applies, false);
    assert.equal(verdict.needsApproval, false, "an impossible action is refused, not queued");
    assert.ok(verdict.rejectedBecause);
  }
});

test("a folder id created earlier in the same batch is accepted", () => {
  const ws = workspaceWith();
  // The model creates a folder and files something into it in one reply; the id
  // does not exist yet when it writes the second action.
  const verdicts = plan([{ action: "create_folder", name: "Kigali" }], ws);
  assert.equal(verdicts[0].applies, true);
});

test("operations outside the closed set are dropped", () => {
  const actions = parseActions({
    actions: [
      { action: "create_folder", name: "ok" },
      { action: "rm -rf", name: "no" },
      { action: "move" },
      "not an object",
      null,
    ],
  });
  assert.equal(actions.length, 2, "only the recognised actions survive");
  assert.deepEqual(
    actions.map((a) => a.action),
    ["create_folder", "move"]
  );
});

test("the batch is capped, so one reply cannot flood the shelf", () => {
  const many = Array.from({ length: 40 }, () => ({ action: "create_folder", name: "x" }));
  assert.equal(parseActions({ actions: many }).length, 8);
});

test("deleting a folder lifts its loose contents rather than destroying them", () => {
  // A folder deletion removes the folder; resources inside it are re-parented to
  // the top level rather than silently vanishing. Losing a folder is annoying;
  // losing the work in it is not recoverable.
  const ws = workspaceWith();
  const after = applyOne({ action: "delete", targetFolderId: "f:old" }, ws);

  assert.ok(!after.folders.some((f) => f.id === "f:old"));
  const orphan = after.resources.find((r) => r.id === "r:three");
  assert.ok(orphan, "the resource still exists");
  assert.equal(orphan?.folderId, null, "and is at the top level, not gone");
});

test("the tree shows folders first and loose things after", () => {
  const view = tree(workspaceWith());
  assert.equal(view.folders.length, 2);
  assert.deepEqual(
    view.root.map((r) => r.id),
    ["r:two"]
  );
  assert.deepEqual(
    view.folders.find((f) => f.folder.id === "f:pricing")?.items.map((r) => r.id),
    ["r:one"]
  );
});
