import { randomUUID } from "node:crypto";
import {
  ExtractionOutputSchema,
  PreMortemOutputSchema,
  TestDesignOutputSchema,
  type Analysis,
  type Claim,
  type PipelineEvent,
} from "./schema";
import { EXTRACTION_PROMPT, HIDDEN_PROMPT, PREMORTEM_PROMPT, SCORING_PROMPT, TEST_DESIGN_PROMPT } from "./prompts";
import { dedupeClaims, deriveTitle, enforceStatus, priorityOf, rankAndCleanClaims, reconcile } from "./score";
import { claimsWorthSearching, gatherEvidence, byRef } from "./evidence";
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
  emit({ type: "stage", stage: "extract", detail: "Reading the plan and quoting the claims it states." });
  const extraction = await structuredPass({
    system: EXTRACTION_PROMPT,
    user: `THE PLAN\n\n${planText}\n\nExtract the claims.`,
    schema: ExtractionOutputSchema,
    maxTokens: 4096,
  });

  const stated = normaliseRefs(dedupeClaims(extraction.data.claims)).map((c) => toClaim(c, false));

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
      return {
        ...c,
        impact: result.impact,
        confidence: result.confidence,
        status: auditClaim.status,
        priority: priorityOf(result.impact, result.confidence),
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
