import { test } from "node:test";
import assert from "node:assert/strict";
import { callerKey, limitHeaders, take } from "../lib/ratelimit";

/**
 * The limit exists to protect one shared model key from being spent in a minute.
 * These pin the behaviour that matters: it stops at the budget, it resets, and it
 * separates callers.
 */

const fresh = () => `key-${Math.random().toString(36).slice(2)}`;

test("allows up to the limit, then refuses", () => {
  const key = fresh();
  for (let i = 0; i < 3; i += 1) {
    assert.equal(take(key, { limit: 3 }).ok, true, `hit ${i + 1} should pass`);
  }
  const blocked = take(key, { limit: 3 });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfter > 0, "a refusal must say when to come back");
});

test("the window resets rather than refusing forever", () => {
  const key = fresh();
  // A 1ms window is expired by the time the next call runs.
  take(key, { limit: 1, windowMs: 1 });
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      assert.equal(take(key, { limit: 1, windowMs: 1 }).ok, true);
      resolve();
    }, 5);
  });
});

test("one caller cannot spend another caller's budget", () => {
  const a = fresh();
  const b = fresh();
  take(a, { limit: 1 });
  assert.equal(take(a, { limit: 1 }).ok, false);
  assert.equal(take(b, { limit: 1 }).ok, true, "a different caller starts fresh");
});

test("callerKey separates callers without exposing the address", () => {
  const one = new Request("https://example.test", {
    headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1", "user-agent": "firefox" },
  });
  const two = new Request("https://example.test", {
    headers: { "x-forwarded-for": "203.0.113.10", "user-agent": "firefox" },
  });
  const key = callerKey(one);
  assert.notEqual(key, callerKey(two));
  assert.doesNotMatch(key, /203\.0\.113/, "the map must not hold a raw IP");
});

test("a caller with no forwarded headers still gets a key", () => {
  const key = callerKey(new Request("https://example.test"));
  assert.ok(key.length > 0);
});

test("limit headers tell a client what happened", () => {
  const headers = limitHeaders({ ok: false, retryAfter: 90, remaining: 0, limit: 12 });
  assert.equal(headers["Retry-After"], "90");
  assert.equal(headers["X-RateLimit-Limit"], "12");
  assert.equal(headers["X-RateLimit-Remaining"], "0");
});
