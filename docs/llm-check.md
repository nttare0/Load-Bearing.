# The model check

*2026-11-19. What `/api/check` found, and what it changed.*

---

## The question

Three things had never been confirmed in production, because no client available
here could confirm them:

1. Does the Gemini key Vercel holds actually authenticate?
2. Does a schema-constrained pass return valid claims?
3. Does the five-pass pipeline work end to end?

The sandbox has no key, cannot reach `googleapis.com`, and cannot make an HTTPS
request to the deployment at all (`SSL_ERROR_SYSCALL`, HTTP 000, every curl flag
tried). `fetch_page` can read any page the deployment serves — but it times out
on model-calling endpoints, and treats any non-2xx as "failed" with no body.

So the check had to live inside the deployment, and answer in a page.

## The tool

`GET /api/check/<token>` — off unless `CHECK_TOKEN` is set on the project.

| Path | What it does |
|---|---|
| `/api/check/<token>` | provider, model, key present, env, region, commit |
| `/api/check/<token>/models` | every candidate model, raw: status, error text, `modelVersion`, with and without `thinkingConfig` |
| `/api/check/<token>/list` | `models.list` for the key — what the key can actually see |
| `/api/check/<token>/extract` | one real extraction pass: claims, tokens, retries, ms |
| `/api/check/<token>/pipeline` | all five passes: per-stage ms, counts, notes, title, summary |

Everything always returns **200** with the verdict in the body. A diagnostic that
speaks in status codes is unreadable to the one client that can reach it.

It calls `structuredPass` and `runPipeline` directly, in the same function. The
first version spawned `curl` at `http://127.0.0.1:$PORT`; production has no
`PORT` on Fluid compute, so it reported "cannot reach this deployment itself" —
a diagnostic that failed rather than a fact about the model.

Nothing is persisted: the store gets no `persist`, so a check cannot leave a
sample analysis in anyone's workspace.

---

## What it found

**The key authenticates and the pipeline works.** Five passes on a fixed
meal-prep plan, 16.3 s, no stage errors:

| Stage | ms | Result |
|---|---|---|
| extract | 3 479 | 12 claims |
| premortem | 5 008 | failure modes tied to real refs |
| score | 4 587 | audited |
| evidence | 1 | skipped (provider has no search tool — stated, not faked) |
| tests | ~3 200 | 6 claims got a cheapest disproof |

12 claims, 6 with tests, 0 errors. **This is a working product on a real key.**

### But it is not running on the model it says it is

`/api/check/<token>/models` posts the raw request to each model:

| Model | Status | What Google said |
|---|---|---|
| `gemini-3.8-flash` | **429** | free tier, 20 requests/day, **retry in 10h33m** |
| `gemini-3.6-flash` | **429** | same |
| `gemini-3.5-flash-lite` | 200 | answered `OK` in 802 ms, `modelVersion: gemini-3.5-flash-lite` |

`/api/check/<token>/list` confirms all three exist on the key — 3.8-flash is not
missing, it is **rate limited**. The fallback chain then answered every pass from
`gemini-3.5-flash-lite`, correctly, and said nothing.

Meanwhile `/api/health` advertised `"model": "gemini-3.8-flash"` and the report
named 3.8 in its Connectors card.

That is precisely the failure this app exists to catch in other people's plans:
**a result that looks fine because the thing that produced it is hidden.**

---

## What changed

| Fix | Where |
|---|---|
| The swap is recorded: asked, answered, and Google's own reason (including "retry in 10h28m") | `lib/gemini.ts` |
| It becomes the **first line of the report's notes**: "Answers came from gemini-3.5-flash-lite, not gemini-3.8-flash (out of quota, retry in 10h28m). The report is real, but it is a lighter model's reading of the plan." | `lib/pipeline.ts` |
| `health?check=1` and `?check=schema` report `answeredBy` and `substituted` | `app/api/health/route.ts` |
| 3 tests pin the sentence | `tests/substitution.test.ts` |

The test caught a real bug on its first run: an empty reason rendered as
"not gemini-3.8-flash ()." — the kind of half-finished sentence that makes a
reader distrust the entire note. The parenthetical is now dropped when there is
nothing to put in it.

**Live in production now:**

```json
"notes": [
  "Answers came from gemini-3.5-flash-lite, not gemini-3.8-flash (out of quota, retry in 10h28m7). The report is real, but it is a lighter model's reading of the plan.",
  "Web check skipped: the Gemini provider has no search tool wired up here, so nothing was verified online. Every claim stays unverified until you check it."
]
```

---

## What this means, plainly

**The app works, and it is running on the smallest model in the list.** The
free tier gives 20 requests a day for `gemini-3.8-flash`; the five-pass pipeline
spends 4–5 per run, so that budget is roughly **four plans a day**. Past that,
every claim comes from the lite model — still coherent, still schema-valid, but
noticeably shallower: in the extract test the lite model labelled **all five**
claims `guess`, where the fuller model had been distinguishing `guess` from
`unverified` and `contradicted`.

Two things worth fixing, neither done here because both are decisions rather
than bugs:

1. **Billing.** Enabling billing on the Google Cloud project removes the daily
   cap. Free-tier is fine for a demo; it is not fine for a tool whose output is
   a ranked decision list.
2. **The UI still says 3.8.** `/api/health` reports the *configured* model, and
   the Connectors card prints it. The report body now tells the truth in prose,
   but the card does not. Either the card should show the model that answered
   (cheap: pass `answeredBy` from a check into health), or `/api/health` should
   probe once and cache, so the card can never claim a model that is not
   answering. This is the honest-interface version of the same bug, and it is
   the next thing to fix.

**The `CHECK_TOKEN` env var is still set** on the project (`production` +
`preview`). It is a 38-character random secret, the route is off without it, and
it cannot act as an open proxy. Delete it when the diagnosis is finished —
until then it is a useful door.
