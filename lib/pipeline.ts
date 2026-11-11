import { randomUUID } from "node:crypto";
import {
  ExtractionOutputSchema,
  PreMortemOutputSchema,
  TestDesignOutputSchema,
  type Analysis,
  type Claim,
  type PipelineEvent,
  type RawClaim,
} from "./schema";
import {
  EXTRACTION_PROMPT,
  HIDDEN_PROMPT,
  NOT_A_PLAN_RESPONSE,
  PREMORTEM_PROMPT,
  SCORING_PROMPT,
  TEST_DESIGN_PROMPT,
} from "./prompts";
import { dedupeClaims, deriveTitle, enforceStatus, priorityOf, rankAndCleanClaims, reconcile } from "./score";
import { claimsWorthSearching, gatherEvidence, byRef } from "./evidence";
import { judgeSource } from "./quotes";
import { heuristicClaims } from "./heuristic";
import { structuredPass } from "./ai";

/**
 * The five-pass pipeline. Each pass has one job, and results are emitted as
 * soon as they are valid so the UI can render claims while later passes run.
 */

type Emit = (event: PipelineEvent) => void;

const MAX_TEST_CLAIMS = 6;

function refIndex(ref: string): number {
  const n = Number(ref.replace(/[^0-9]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Give every claim a stable, unique ref, in model order. */
function normaliseRefs<T extends { ref: string }>(items: T[]): (T & { ref: string })[] {
  const used = new Set<string>();
  let next = 1;
  return items.map((item) => {
    let ref = item.ref.trim().toUpperCase();
    if (!/^C\d+$/.test(ref) || used.has(ref)) {
      while (used.has(`C${next}`)) next += 1;
      ref = `C${next}`;
    }
    used.add(ref);
    next = Math.max(next, refIndex(ref)) + 1;
    return { ...item, ref };
  });
}

function toClaim(
  raw: {
    ref: string;
    claim: string;
    source: string;
    category: Claim["category"];
    status: Claim["status"];
    impact: number;
    confidence: Claim["confidence"];
    dependsOn: string[];
    verifiable: boolean;
    reasoning: string;
  },
  hidden: boolean
): Claim {
  return {
    ...raw,
    id: `${raw.ref.toLowerCase()}-${hash(raw.claim)}`,
    rank: 0,
    priority: priorityOf(raw.impact, raw.confidence),
    evidence: [],
    test: null,
    // A hidden assumption has no quote by definition.
    source: hidden ? "implied" : raw.source,
  };
}

function hash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 6);
}

export async function runPipeline(
  planText: string,
  emit: Emit,
  opts: { persist?: (analysis: Analysis) => Promise<boolean> } = {}
): Promise<Analysis> {
  const notes: string[] = [];

  // ---------- Pass 1: extraction ----------
  //
  // The only pass whose failure used to kill the run. It is now the only pass
  // that can degrade instead: a report without the model is thinner and says
  // so, which is more useful than an error page over a working rubric.
  emit({ type: "stage", stage: "extract", detail: "Reading the plan and quoting the claims it states." });

  let extraction: { data: { summary: string; claims: RawClaim[] } };
  try {
    extraction = await structuredPass({
      system: EXTRACTION_PROMPT,
      user: `THE PLAN\n\n${planText}\n\nExtract the claims.`,
      schema: ExtractionOutputSchema,
      maxTokens: 4096,
    });
  } catch (error) {
    // A model that cannot answer is a reason to say less, not to stop.
    const fallback = heuristicClaims(planText);
    if (fallback.length === 0) {
      // If even the text gives nothing to hold, the honest answer is that this
      // does not read like a plan — not a fabricated empty report.
      throw new Error(
        `Extraction failed (${short(error)}) and the text did not yield claims on its own. ${NOT_A_PLAN_RESPONSE}`
      );
    }
    notes.push(
      `No model answered the extraction pass (${short(error)}). These claims were read straight from the text with no model: the quotes are exact, the scores are conservative, and the hidden assumptions are missing. Run it again to get the full report.`
    );
    extraction = {
      data: {
        summary: `Read without a model: the ${fallback.length} sentences in this plan that assert something about money, timing, people or a third party.`,
        claims: fallback.map((claim) => ({
          ref: claim.ref,
          claim: claim.claim,
          source: claim.source,
          category: claim.category,
          status: claim.status,
          impact: claim.impact,
          confidence: claim.confidence,
          dependsOn: [],
          verifiable: false,
          reasoning: claim.reasoning,
        })),
      },
    };
  }

  let stated = normaliseRefs(dedupeClaims(extraction.data.claims)).map((c) => toClaim(c, false));

  // A quote is checked against the plan before anything else happens to it.
  // The prompt asks for verbatim; this is what makes the label mean something.
  let paraphrased = 0;
  stated = stated.map((claim) => {
    const verdict = judgeSource(claim.source, planText);
    if (verdict.status === "paraphrase") paraphrased += 1;
    return { ...claim, source: verdict.source, sourceStatus: verdict.status };
  });
  if (paraphrased > 0) {
    notes.push(
      `${paraphrased} of ${stated.length} quoted source${stated.length === 1 ? "" : "s"} could not be found word for word in the plan, so ${paraphrased === 1 ? "it is" : "they are"} marked as paraphrase${paraphrased === 1 ? "" : "s"}.`
    );
  }

  // ---------- Pass 2: hidden assumptions ----------
  emit({
    type: "stage",
    stage: "premortem",
    detail: "Looking for what must be true that nobody wrote down.",
  });

  let hiddenClaims: Claim[] = [];
  try {
    const hidden = await structuredPass({
      system: HIDDEN_PROMPT,
      user: [
        "THE PLAN",
        planText,
        "",
        "CLAIMS ALREADY FOUND",
        stated.map((c) => `${c.ref} [${c.category}, impact ${c.impact}] ${c.claim}`).join("\n"),
        "",
        `Continue refs after C${Math.max(...stated.map((c) => refIndex(c.ref)), stated.length)}. Return the hidden assumptions.`,
      ].join("\n"),
      schema: ExtractionOutputSchema.omit({ summary: true }),
      maxTokens: 3072,
    });

    const usedRefs = new Set(stated.map((c) => c.ref));
    hiddenClaims = hidden.data.claims
      .map((c) => ({ ...c, ref: "" }))
      .map((c, i) => ({ ...c, ref: `H${i + 1}` }))
      .map((c) => toClaim(c, true))
      .filter((c) => !usedRefs.has(c.ref));

    // Fold hidden refs into the same C-series so dependsOn stays coherent.
    let next = Math.max(...stated.map((c) => refIndex(c.ref)), stated.length) + 1;
    hiddenClaims = hiddenClaims.map((c) => {
      const ref = `C${next++}`;
      return { ...c, ref, id: `${ref.toLowerCase()}-${hash(c.claim)}` };
    });
    const statedText = new Set(stated.map((c) => c.claim.toLowerCase().replace(/[^a-z ]/g, "")));
    hiddenClaims = hiddenClaims.filter((c) => !statedText.has(c.claim.toLowerCase().replace(/[^a-z ]/g, "")));
  } catch (error) {
    notes.push(
      `The hidden-assumption pass failed (${short(error)}), so this report only shows claims the plan states.`
    );
  }

  let claims = [...stated, ...hiddenClaims];
  claims = rankAndCleanClaims(claims);
  emit({
    type: "claims",
    claims,
    summary: extraction.data.summary,
    title: deriveTitle(planText),
    notes: [...notes],
  });

  // ---------- Pass 3: pre-mortem ----------
  let failureModes: Analysis["failureModes"] = [];
  try {
    const premortem = await structuredPass({
      system: PREMORTEM_PROMPT,
      user: [
        "THE PLAN",
        planText,
        "",
        "CLAIM REFS",
        claims.map((c) => `${c.ref} (impact ${c.impact}): ${c.claim}`).join("\n"),
        "",
        "Write the pre-mortem.",
      ].join("\n"),
      schema: PreMortemOutputSchema,
      maxTokens: 2048,
    });

    const refs = new Set(claims.map((c) => c.ref));
    failureModes = premortem.data.failureModes.filter((f) => refs.has(f.claimRef));
    emit({ type: "failureModes", failureModes });
  } catch (error) {
    notes.push(`Pre-mortem pass failed (${short(error)}). Rankings and tests are unaffected.`);
  }

  // ---------- Pass 4: scoring audit ----------
  emit({ type: "stage", stage: "score", detail: "Re-scoring every claim against the rubric to catch drift." });
  try {
    const audit = await structuredPass({
      system: SCORING_PROMPT,
      user: [
        "THE PLAN",
        planText,
        "",
        "CLAIMS TO RE-SCORE",
        claims
          .map(
            (c) =>
              `${c.ref} | impact ${c.impact} | confidence ${c.confidence} | status ${c.status} | ${c.claim}`
          )
          .join("\n"),
        "",
        "Return the same claims with your independent impact, confidence and status.",
      ].join("\n"),
      schema: ExtractionOutputSchema.omit({ summary: true }),
      maxTokens: 3000,
    });

    const audits = new Map(audit.data.claims.map((c) => [c.ref.toUpperCase(), c]));
    claims = claims.map((c) => {
      const auditClaim = audits.get(c.ref);
      if (!auditClaim) return c;
      const result = reconcile(c, auditClaim);
      if (result.note) notes.push(`${c.ref}: ${result.note}.`);
      // A disagreement is information the user should be able to see, so it
      // travels with the claim instead of only in a note that gets scrolled past.
      const disagreed =
        result.impact !== c.impact || result.confidence !== c.confidence
          ? {
              impact: result.impact,
              confidence: result.confidence,
              firstImpact: c.impact,
              firstConfidence: c.confidence,
            }
          : undefined;
      return {
        ...c,
        impact: result.impact,
        confidence: result.confidence,
        status: auditClaim.status,
        priority: priorityOf(result.impact, result.confidence),
        ...(disagreed ? { audit: disagreed } : {}),
      };
    });
    claims = rankAndCleanClaims(claims);
  } catch (error) {
    notes.push(`Scoring audit failed (${short(error)}); showing the first pass's scores unverified.`);
  }

  // ---------- Web evidence ----------
  const searchable = claimsWorthSearching(claims);
  if (searchable.length) {
    emit({
      type: "stage",
      stage: "evidence",
      detail: `Checking ${searchable.length} checkable claim${searchable.length > 1 ? "s" : ""} against public sources.`,
    });
    const run = await gatherEvidence(searchable.map((c) => ({ ref: c.ref, claim: c.claim })));
    notes.push(...run.notes);
    const grouped = byRef(run.evidence);
    claims = claims.map((c) => {
      const evidence = grouped.get(c.ref) ?? [];
      const { status, downgraded } = enforceStatus(c.status, evidence.length);
      if (downgraded) {
        notes.push(`${c.ref}: labelled "${c.status}" with no URL, so it is shown as unverified.`);
      }
      return { ...c, evidence, status };
    });
    claims = rankAndCleanClaims(claims);
    emit({ type: "evidence", evidence: run.evidence, notes: run.notes });
  }

  // ---------- Pass 5: test design on the top claims ----------
  emit({
    type: "stage",
    stage: "tests",
    detail: `Designing the cheapest disproof for the top ${Math.min(MAX_TEST_CLAIMS, claims.length)} claims.`,
  });
  try {
    const top = claims.slice(0, MAX_TEST_CLAIMS);
    const tests = await structuredPass({
      system: TEST_DESIGN_PROMPT,
      user: [
        "THE PLAN",
        planText.slice(0, 4000),
        "",
        "CLAIMS TO TEST",
        top
          .map(
            (c) =>
              `${c.ref} | impact ${c.impact} | confidence ${c.confidence} | ${c.category} | ${c.claim}\n   evidence: ${
                c.evidence.map((e) => `${e.supports} ${e.url}`).join(", ") || "none"
              }`
          )
          .join("\n"),
        "",
        "One test per claim ref.",
      ].join("\n"),
      schema: TestDesignOutputSchema,
      maxTokens: 3000,
    });

    const byClaim = new Map(tests.data.tests.map((t) => [t.ref.toUpperCase(), t]));
    claims = claims.map((c) => {
      const test = byClaim.get(c.ref);
      if (!test) return c;
      return {
        ...c,
        test: {
          method: test.method,
          cost: test.cost,
          time: test.time,
          confirms: test.confirms,
          breaks: test.breaks,
        },
      };
    });
    if (claims.slice(0, MAX_TEST_CLAIMS).some((c) => !c.test)) {
      notes.push("Some top claims came back without a test; they are marked as untested.");
    }
    emit({ type: "tests", claims });
  } catch (error) {
    notes.push(`Test-design pass failed (${short(error)}), so claims have no tests yet.`);
  }

  const analysis: Analysis = {
    id: randomUUID(),
    title: deriveTitle(planText),
    summary: extraction.data.summary,
    createdAt: new Date().toISOString(),
    input: planText,
    claims: rankAndCleanClaims(claims),
    failureModes,
    notes: Array.from(new Set(notes)),
  };

  let persisted = false;
  if (opts.persist) {
    try {
      persisted = await opts.persist(analysis);
    } catch {
      persisted = false;
    }
  }

  emit({ type: "done", analysis, persisted });
  return analysis;
}

function short(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0].slice(0, 90);
}
