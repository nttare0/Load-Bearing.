import assert from "node:assert/strict";
import { test } from "node:test";
import { markForProvider } from "../components/icons/marks";

/**
 * The connectors card draws a brand mark next to a name. Getting that wrong is a
 * small lie in a product built to avoid them: a Gemini key wearing someone else's
 * logo is worse than no logo. These pin the mapping, and pin the fallback.
 */

test("a known provider gets its own mark", () => {
  assert.equal(markForProvider("gemini"), "gemini");
  assert.equal(markForProvider("supabase"), "supabase");
  assert.equal(markForProvider("github"), "github");
  assert.equal(markForProvider("vercel"), "vercel");
});

test("the provider name is read without regard to case or surroundings", () => {
  assert.equal(markForProvider("Google-Gemini"), "gemini");
  assert.equal(markForProvider("SUPABASE"), "supabase");
});

test("an unknown or missing provider gets the generic plug, never a guess", () => {
  assert.equal(markForProvider("anthropic"), "generic");
  assert.equal(markForProvider("mistral"), "generic");
  assert.equal(markForProvider(""), "generic");
  assert.equal(markForProvider(null), "generic");
});
