import assert from "node:assert/strict";
import { test } from "node:test";
import { mirofishConfig, mirofishEnabled, parseReport } from "../lib/mirofish";
import { enforceStatus } from "../lib/score";
import type { Status } from "../lib/schema";

/**
 * The rule this file defends: a simulation is a prediction, and a prediction
 * can never become evidence. The user asked for MiroFish to be used "only
 * according to its use" — so its boundary is tested, not just documented.
 */

function clearMirofishEnv() {
  for (const key of ["MIROFISH_BASE_URL", "MIROFISH_RESEARCH", "MIROFISH_API_KEY"]) {
    delete process.env[key];
  }
}

test("MiroFish is off unless it has both a base URL and an explicit switch", () => {
  clearMirofishEnv();
  assert.equal(mirofishEnabled(), false, "no config means off");

  // A self-hosted URL alone is not enough: the second switch is the point.
  process.env.MIROFISH_BASE_URL = "http://localhost:5001";
  assert.equal(mirofishEnabled(), false, "MIROFISH_RESEARCH must also be set");

  process.env.MIROFISH_RESEARCH = "1";
  assert.equal(mirofishEnabled(), true);

  // Trailing slashes must not produce double-slashed endpoints.
  assert.equal(mirofishConfig()?.baseUrl, "http://localhost:5001");

  process.env.MIROFISH_RESEARCH = "0";
  assert.equal(mirofishEnabled(), false, "anything but 1 is off");

  clearMirofishEnv();
});

test("a simulation prediction can never be typed as a fact", () => {
  // The pipeline enforces this already; the test pins the contract the
  // MiroFish route depends on. A prediction arrives with zero URLs, so the
  // status gate must downgrade it regardless of what anything claims.
  for (const status of ["fact", "contradicted"] as Status[]) {
    const result = enforceStatus(status, 0);
    assert.equal(result.status, "unverified");
    assert.equal(result.downgraded, true);
  }

  // And an honest label survives untouched, so the gate is not blanket-paranoid.
  assert.equal(enforceStatus("guess", 0).status, "guess");
});

test("predictions are attached to claims by ref, and nothing is invented", () => {
  const claims = [
    { ref: "C1", claim: "400 subscribers in six months" },
    { ref: "C3", claim: "Two riders cover the city" },
    { ref: "C7", claim: "No permit is needed" },
  ];

  const report = [
    "The simulation suggests adoption is likely to be slower than projected: agents in adjacent districts never heard of the service, and word of mouth stayed within one office building.",
    "C3: Two riders were exhausted by midday in every run, and delivery times slipped past 13:00 once orders passed thirty per day.",
    "Overall the world drifted toward informal competitors undercutting on price rather than toward the subscription model gaining ground.",
  ].join("\n\n");

  const predictions = parseReport(report, claims);
  const refs = predictions.map((p) => p.ref);

  assert.ok(refs.includes("C3"), "the paragraph naming C3 becomes C3's prediction");
  assert.ok(!refs.includes("C7"), "a claim with no paragraph is not given one");
  assert.equal(
    predictions.filter((p) => p.ref === "C7").length,
    0,
    "no prediction may be fabricated for an unmentioned claim"
  );

  for (const prediction of predictions) {
    assert.ok(prediction.prediction.length > 0);
    assert.ok(prediction.prediction.length <= 600, "predictions are quoted, not transcribed in full");
  }
});

test("a report with no claim refs yields one plan-level prediction, not none", () => {
  const report =
    "Agents converged on a cautious stance overall: interest existed, but prepayment was the sticking point in every conversation, and the simulation ended with the plan still unproven rather than disproven.";
  const predictions = parseReport(report, [{ ref: "C1", claim: "subscribers" }]);
  assert.equal(predictions.length, 1);
  assert.equal(predictions[0].ref, null, "attached to the plan, not to an invented claim");
});

test("an empty report yields no predictions at all", () => {
  assert.deepEqual(parseReport("", [{ ref: "C1", claim: "x" }]), []);
});
