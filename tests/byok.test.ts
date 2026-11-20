import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_SETTINGS, checkKey, inferProvider, llmHeaders, maskKey } from "../lib/byok";

/**
 * The settings sheet decides two things that matter: whether a pasted key is
 * the provider it claims to be, and what gets sent on a request. Getting the
 * second wrong either spends the operator's budget or leaks a key, so both are
 * pinned here.
 */

const GEMINI = "AIzaSyD-verylongfakebutwellformedkeyvalue12345";
const ANTHROPIC = "sk-ant-api03-verylongfakebutwellformedkeyvalue-12345";

test("provider is inferred from the key itself", () => {
  assert.equal(inferProvider(GEMINI), "gemini");
  assert.equal(inferProvider(ANTHROPIC), "anthropic");
  assert.equal(inferProvider("hello"), null);
  assert.equal(inferProvider(""), null);
});

test("a well-formed key is accepted and reports its provider", () => {
  const checked = checkKey({ ...EMPTY_SETTINGS, key: GEMINI });
  assert.equal(checked.ok, true);
  if (checked.ok) assert.equal(checked.provider, "gemini");
});

test("whitespace inside a key is a refusal, with a reason that mentions it", () => {
  const checked = checkKey({ ...EMPTY_SETTINGS, key: "AIzaSyD-verylongfake butwellformed1234" });
  assert.equal(checked.ok, false);
  if (!checked.ok) assert.match(checked.reason, /space|line break/i);
});

test("a URL is not a key", () => {
  const checked = checkKey({ ...EMPTY_SETTINGS, key: "https://aistudio.google.com/apikey" });
  assert.equal(checked.ok, false);
  if (!checked.ok) assert.match(checked.reason, /URL/i);
});

test("picking the wrong provider names both of them", () => {
  const checked = checkKey({ ...EMPTY_SETTINGS, key: ANTHROPIC, provider: "gemini" });
  assert.equal(checked.ok, false);
  if (!checked.ok) {
    assert.match(checked.reason, /Gemini/i);
    assert.match(checked.reason, /Anthropic/i);
  }
});

test("naming the right provider is fine", () => {
  const checked = checkKey({ ...EMPTY_SETTINGS, key: ANTHROPIC, provider: "anthropic" });
  assert.equal(checked.ok, true);
});

test("no key means no headers — the deployment's key applies", () => {
  assert.deepEqual(llmHeaders(EMPTY_SETTINGS), {});
});

test("a malformed key sends nothing, rather than something wrong", () => {
  assert.deepEqual(llmHeaders({ ...EMPTY_SETTINGS, key: "not-a-key-at-all-really-truly" }), {});
});

test("a good key sends its provider alongside it", () => {
  const headers = llmHeaders({ ...EMPTY_SETTINGS, key: GEMINI });
  assert.equal(headers["x-llm-key"], GEMINI);
  assert.equal(headers["x-llm-provider"], "gemini");
});

test("a mask keeps the ends and drops the middle", () => {
  const masked = maskKey(ANTHROPIC);
  assert.ok(masked.startsWith(ANTHROPIC.slice(0, 8)));
  assert.ok(masked.endsWith(ANTHROPIC.slice(-4)));
  assert.ok(!masked.includes("wellformed"));
  assert.ok(maskKey("short").length <= 1);
});
