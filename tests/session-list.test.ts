import { test } from "node:test";
import assert from "node:assert/strict";
import { groupSessions, searchSessions, sessionGroup, type SessionListItem } from "../lib/session-list";
import { createWorkspace } from "../lib/workspace";

function item(updatedAt: string, patch: Partial<SessionListItem["workspace"]> = {}): SessionListItem {
  const workspace = { ...createWorkspace(), updatedAt, ...patch };
  return { workspace, title: workspace.name, reports: 0, messages: workspace.messages.length };
}

test("sessions group by local calendar day and the requested ranges", () => {
  const now = new Date(2026, 10, 10, 12);
  assert.equal(sessionGroup(new Date(2026, 10, 10, 9).toISOString(), now), "Today");
  assert.equal(sessionGroup(new Date(2026, 10, 9, 23).toISOString(), now), "Yesterday");
  assert.equal(sessionGroup(new Date(2026, 10, 4, 12).toISOString(), now), "Previous 7 Days");
  assert.equal(sessionGroup(new Date(2026, 10, 2, 12).toISOString(), now), "Previous 30 Days");
  assert.equal(sessionGroup(new Date(2026, 9, 1, 12).toISOString(), now), "Older");
  assert.equal(sessionGroup("not-a-date", now), "Older");
});

test("groupSessions keeps the five groups in chronological UI order", () => {
  const now = new Date(2026, 10, 10, 12);
  const entries = [
    item(new Date(2026, 9, 1, 12).toISOString()),
    item(new Date(2026, 10, 9, 12).toISOString()),
    item(new Date(2026, 10, 10, 12).toISOString()),
    item(new Date(2026, 10, 2, 12).toISOString()),
    item(new Date(2026, 10, 4, 12).toISOString()),
  ];
  assert.deepEqual(
    groupSessions(entries, now).map((group) => group.label),
    ["Today", "Yesterday", "Previous 7 Days", "Previous 30 Days", "Older"]
  );
});

test("search includes titles, original plans, thread messages, and resource text", () => {
  const plan = item("2026-11-10T10:00:00.000Z", {
    name: "Kigali launch",
    plans: [{ id: "p1", text: "Test demand for local transport", at: "2026-11-10", title: "Transport" }],
    messages: [{ id: "m1", role: "assistant", text: "The permit is uncertain", at: "2026-11-10" }],
    resources: [{ id: "r1", kind: "note", title: "Interview notes", body: "Talk to five riders", folderId: null, createdAt: "2026-11-10", origin: "you" }],
  });
  for (const term of ["kigali", "transport", "permit", "riders"]) {
    assert.equal(searchSessions([plan], term).length, 1, `expected ${term} to match`);
  }
  assert.equal(searchSessions([plan], "not present").length, 0);
});

test("archived sessions are hidden unless Include Archived is selected", () => {
  const active = item("2026-11-10T10:00:00.000Z", { name: "Current" });
  const archived = item("2026-11-09T10:00:00.000Z", {
    name: "Archived plan",
    archivedAt: "2026-11-10T11:00:00.000Z",
  });
  assert.deepEqual(searchSessions([active, archived], "archived"), []);
  assert.deepEqual(searchSessions([active, archived], "archived", true).map((entry) => entry.title), ["Archived plan"]);
  assert.equal(searchSessions([active, archived], "", true).length, 2);
});
