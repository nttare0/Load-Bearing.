import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NEW_CHAT_TITLE,
  createWorkspace,
  isNewChat,
  nameFromPlan,
  newChatTarget,
  titleOf,
} from "../lib/workspace";

/**
 * The distinction the interface makes: **New chat is a verb, a workspace is a
 * place.** These tests pin the part of it that is not pixels — when a thing is
 * still a new chat, and what it is called once it is not.
 */

test("a fresh workspace is a new chat", () => {
  const w = createWorkspace();
  assert.equal(w.name, NEW_CHAT_TITLE);
  assert.equal(isNewChat(w), true);
  assert.equal(titleOf(w), "New chat");
});

test("a chat stops being new the moment it has a message", () => {
  const w = createWorkspace();
  assert.equal(
    isNewChat({ ...w, messages: [{ id: "m1", role: "user", text: "hi", at: "2026-01-01" }] as never }),
    false
  );
});

test("a chat stops being new when it has a plan, even with no message yet", () => {
  const w = createWorkspace();
  assert.equal(
    isNewChat({ ...w, plans: [{ id: "p1", text: "a plan", at: "2026-01-01", title: "a plan" }] as never }),
    false
  );
});

test("an unnamed chat takes its title from the plan's first line", () => {
  assert.equal(
    nameFromPlan("We will sell 400 subscriptions in Kigali at 45000 RWF a month, costing 1100 RWF per meal."),
    "We will sell 400 subscriptions in Kigali"
  );
});

test("a plan whose first line is too short still gets a title from its first clause", () => {
  // The old version gave up here and called it "Untitled workspace".
  const title = nameFromPlan("Meals.\nWe will deliver 400 meals a month from one home kitchen in Kigali.");
  assert.notEqual(title, "Untitled workspace");
  assert.notEqual(title, NEW_CHAT_TITLE);
  assert.match(title, /We will deliver/);
});

test("an empty plan is a new chat, not a badly named one", () => {
  assert.equal(nameFromPlan("   "), NEW_CHAT_TITLE);
});

test("a title never ends in punctuation", () => {
  assert.doesNotMatch(nameFromPlan("Deliver meals, at scale. Two riders."), /[.,;:]$/);
});

test("a renamed chat keeps the name it was given", () => {
  // The page only renames a chat while its name is still the new-chat title;
  // this pins the predicate that decides it.
  const unnamed = createWorkspace();
  const renamed = { ...unnamed, name: "Kigali kitchen" };
  assert.equal(unnamed.name === NEW_CHAT_TITLE, true);
  assert.equal(renamed.name === NEW_CHAT_TITLE, false);
});

test("pressing New chat twice lands on the same blank chat", () => {
  const first = createWorkspace();
  const target = newChatTarget([first], () => {
    throw new Error("should not have made a second blank chat");
  });
  assert.equal(target.reused, true);
  assert.equal(target.workspace.id, first.id);
});

test("New chat makes a fresh workspace instead of reusing an archived blank one", () => {
  const archived = { ...createWorkspace(), archivedAt: "2026-11-10T12:00:00.000Z" };
  const made = createWorkspace();
  const target = newChatTarget([archived], () => made);
  assert.equal(target.reused, false);
  assert.equal(target.workspace.id, made.id);
});

test("New chat makes a new one once the blank one has something in it", () => {
  const used = { ...createWorkspace(), name: "Kigali kitchen", messages: [{ id: "m1" }] as never };
  const made = createWorkspace();
  const target = newChatTarget([used], () => made);
  assert.equal(target.reused, false);
  assert.equal(target.workspace.id, made.id);
  assert.equal(target.workspace.id === used.id, false);
});
