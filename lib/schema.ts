import { z } from "zod";

/**
 * The claim schema. This is the single source of truth for the whole app:
 * the model is constrained to it, the UI is generated from it, and the
 * export functions read it. If the model returns something else, Zod
 * rejects the pass and we retry.
 */

export const CATEGORIES = [
  "market",
  "technical",
  "behavioral",
  "financial",
  "external dependency",
  "timing",
] as const;

export const STATUSES = ["fact", "guess", "unverified", "contradicted"] as const;

export const CONFIDENCES = ["low", "medium", "high"] as const;

/** A claim exactly as the model returns it (before server-side enforcement). */
export const RawClaimSchema = z.object({
  /** Short citation label, e.g. "C3". Assigned by the model, normalised server-side. */
  ref: z.string().min(1).max(8),
  claim: z
    .string()
    .min(8)
    .describe("The assumption, as a single sentence someone could argue about."),
  /** A quote from the plan, or the literal word "implied". */
  source: z
    .string()
    .min(1)
    .describe('Verbatim quote from the plan, or "implied" if the author never said it.'),
  category: z.enum(CATEGORIES),
  status: z.enum(STATUSES),
  /** 1 = barely matters, 5 = the whole plan collapses. */
  impact: z.number().int().min(1).max(5),
  confidence: z.enum(CONFIDENCES),
  /** Which claim refs this one depends on. Empty = bottom of the chain. */
  dependsOn: z.array(z.string()),
  /** Can this be checked against a public source (pricing, law, market data)? */
  verifiable: z.boolean(),
  /** One or two sentences of reasoning for the score. No hedging. */
  reasoning: z.string().min(10),
});

export const TestSchema = z.object({
  ref: z.string().min(1),
  method: z.string().min(10).describe("The cheapest test that could kill this claim."),
  cost: z.string().min(2).describe('Money and effort, e.g. "$0, 2 hours".'),
  time: z.string().min(2).describe('Wall-clock time, e.g. "1 week".'),
  confirms: z.string().min(10).describe("What result would let the plan proceed."),
  breaks: z.string().min(10).describe("What result means stop and rethink."),
});

export const EvidenceItemSchema = z.object({
  ref: z.string().min(1),
  title: z.string().min(2),
  url: z.string().url(),
  snippet: z.string().min(5),
  supports: z
    .enum(["supports", "contradicts", "inconclusive"])
    .describe("Does the source back the claim, contradict it, or neither?"),
});

/** Output shapes for each AI pass. */
export const ExtractionOutputSchema = z.object({
  summary: z.string().min(20).describe("What the plan is trying to do, in two sentences."),
  claims: z.array(RawClaimSchema).min(3).max(16),
});

export const PreMortemOutputSchema = z.object({
  failureModes: z
    .array(
      z.object({
        scenario: z.string().min(15).describe("It is a year from now and this failed because..."),
        claimRef: z.string().min(1).describe("The claim ref this failure maps back to."),
        likelihood: z.enum(["low", "medium", "high"]),
        earlyWarning: z.string().min(10).describe("The first observable sign this is happening."),
      })
    )
    .min(3)
    .max(8),
});

export const TestDesignOutputSchema = z.object({
  tests: z.array(TestSchema).min(1).max(8),
});

/** A claim after server-side enforcement + enrichment. */
export const ClaimSchema = RawClaimSchema.extend({
  id: z.string().min(1),
  rank: z.number().int().min(1),
  /** impact * uncertainty weight, 1-10 scale, the sort key. */
  priority: z.number().min(1).max(10),
  evidence: z.array(EvidenceItemSchema),
  test: TestSchema.omit({ ref: true }).nullable(),
});

export const AnalysisSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string(),
  createdAt: z.string(),
  input: z.string(),
  claims: z.array(ClaimSchema),
  failureModes: PreMortemOutputSchema.shape.failureModes,
  notes: z.array(z.string()),
});

export type Category = (typeof CATEGORIES)[number];
export type Status = (typeof STATUSES)[number];
export type Confidence = (typeof CONFIDENCES)[number];
export type RawClaim = z.infer<typeof RawClaimSchema>;
export type Test = z.infer<typeof TestSchema>;
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type Analysis = z.infer<typeof AnalysisSchema>;
export type FailureMode = z.infer<typeof PreMortemOutputSchema>["failureModes"][number];
export type ExtractionOutput = z.infer<typeof ExtractionOutputSchema>;
export type TestDesignOutput = z.infer<typeof TestDesignOutputSchema>;

/** Shape of the SSE events the pipeline streams to the browser. */
export type PipelineEvent =
  | { type: "stage"; stage: PipelineStage; detail?: string }
  | { type: "claims"; claims: Claim[]; summary: string; title: string; notes: string[] }
  | { type: "failureModes"; failureModes: FailureMode[] }
  | { type: "evidence"; evidence: EvidenceItem[]; notes: string[] }
  | { type: "tests"; claims: Claim[] }
  | { type: "done"; analysis: Analysis; persisted: boolean }
  | { type: "error"; message: string };

export type PipelineStage =
  | "extract"
  | "premortem"
  | "score"
  | "evidence"
  | "tests";
