import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_KEYS, DATA_KEYS, PREFERENCE_KEYS, formatBytes } from "../lib/erase";

/**
 * `eraseLocal` and `localUsage` need a real `localStorage`, which Node 22 has as
 * a stub that throws without `--experimental-webstorage`. So what is tested here
 * is the contract the page depends on: the key list, and the size formatting.
 */

test("every key this app writes is accounted for", () => {
  // If a new key is added somewhere and not added here, "delete everything"
  // stops being true — so the list is asserted as a set, not a count.
  for (const key of [
    "load-bearing:workspaces",
    "load-bearing:current-workspace",
    "load-bearing:analyses",
    "load-bearing:plans",
    "load-bearing:llm",
  ]) {
    assert.ok((DATA_KEYS as readonly string[]).includes(key), `${key} must be erasable`);
  }
});

test("preferences are listed separately from data", () => {
  // Panel state and thinking level are not content; erasing content has no
  // business resetting them, so they must not be mixed into DATA_KEYS.
  for (const key of PREFERENCE_KEYS) {
    assert.ok(!(DATA_KEYS as readonly string[]).includes(key));
  }
  assert.equal(ALL_KEYS.length, DATA_KEYS.length + PREFERENCE_KEYS.length);
});

test("no key is listed twice", () => {
  assert.equal(new Set(ALL_KEYS).size, ALL_KEYS.length);
});

test("every key is namespaced, so erasing cannot touch another app's storage", () => {
  for (const key of ALL_KEYS) assert.match(key, /^load-bearing:/);
});

test("sizes read the way a person would say them", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(2048), "2 KB");
  assert.equal(formatBytes(1024 * 1024), "1 MB");
  assert.match(formatBytes(5 * 1024 * 1024), /5 MB/);
});
