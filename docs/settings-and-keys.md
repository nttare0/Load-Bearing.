# The right spine, and bringing your own key

*2026-11-19. A new message control, settings, and the model key that was never
anyone's to give.*

---

## What was asked

> Add a side bar on the right for new msg and settings, and add in settings to
> add custom LLM API and connectors.

## What was built

**A spine on the far right** (`components/NavRail.tsx`), 36px wide, present in
both states of the panel:

```
┌─────┐
│  ✎  │  New message
├─────┤
│  ▤  │  Chat          · count of messages in this workspace
│  ⚙  │  Settings
│     │
│     │
│  ⯈  │  Files panel: show / hide
└─────┘
```

The spine sits *outside* the files panel, not above it. That is the point: the
two controls that get you unstuck cannot live inside the thing you are stuck
in. Previously the only way to a new workspace was a `+` inside a card that
itself folds away.

**Settings** (`app/settings/page.tsx`) is its own page — not a sheet over a
column — in the order the questions actually arrive. It opens with what the app is
using right now (model, whose key, thinking level, where work is kept) before
offering anything to change:

### 1. Your model

The key field, a show/hide toggle, provider auto-detection, "remember on this
device", **Test this key**, **Use this key**, and **Forget**. Below it, links to
where each provider issues keys — a scavenger hunt is not a feature.

> This deployment runs on a free key, which buys about four plans a day. Paste
> your own and the reports run on it instead.

That sentence is the honest reason this card exists.

### 2. Connectors

The same four facts the rail shows, spelled out in words and states: GitHub (the
code), Vercel (the host, or *not* the host), the model (*or "no key, so analysis
runs on the built-in example"*), and storage (*"reports are kept in this
browser, not on a server"*). Plus the line that matters more than the badges:

> Supabase is off in this deployment, so nothing you paste leaves this device.

---

## How a visitor's key is handled

This is the part that had to be right, so it is worth stating plainly.

| Stage | What happens |
|---|---|
| Validation | Shape-checked in the browser *before* any request: whitespace, URLs, too-short strings, and a provider that disagrees with the key's prefix are all refused with a sentence. |
| Storage | `localStorage` under `load-bearing:llm`, plus a `SameSite=Strict`, session-only cookie. "Remember" off means the key lives in a tab and dies with it. |
| Transport | `x-llm-key` + `x-llm-provider` on the request. |
| Use | `lib/visitor.ts` parks it in an `AsyncLocalStorage` for the life of that request. `lib/ai` and `lib/gemini` ask that store before the environment, so all five passes use it without knowing it exists. |
| Persistence | **None.** No route stores, logs, or returns a key. |
| Reports | A key can never reach a report, a share link, or an export — it is never part of the analysis object. |
| Forgetting | Clears storage and expires the cookie. |

Two decisions worth naming:

**A bad key is a 400, not a silent fallback.** If a visitor sends a malformed
key, the request fails with a reason. Quietly using the deployment's key instead
would spend the operator's twenty-a-day budget on a request the visitor meant to
pay for — the exact failure mode this app was built to point at.

**A test is a real call, not a shape check.** `POST /api/settings` uses the key
once and reports the provider's own words. On a free-tier Gemini key it says:

> The key works, but it is out of quota — retry in 10h33m.

Which is the difference between "your paste looks fine" and "your key works".
It also reports **which model answered**, because a free-tier key will fall back
from `gemini-3.8-flash` to `gemini-3.5-flash-lite` and the person should know.

---

## Verified

Served locally and checked over HTTP, not by eye:

| Check | Result |
|---|---|
| `GET /api/settings` with no key | `{ai:"demo", source:"none"}` |
| `GET /api/settings` with a malformed key | `note: "That key looks malformed…"` |
| `POST /api/settings` with a Gemini key labelled `anthropic` | `"The key you sent is a gemini key, but it was labelled anthropic."` |
| `GET /api/settings` with a well-formed key | `{provider:"gemini", source:"your key", note:"Requests run on your own…"}` |
| `/api/analyze` with a fake key | All five passes refuse; the report says *"No model answered the extraction pass"* and still returns exact quotes from the text at a conservative score — **it did not fall back to the deployment's key** |
| Server-rendered markup | `New message`, `Chat and settings`, `Settings`, `Connectors` all present |

Gates: typecheck clean, **64/64 tests**, build compiled. The ten new tests in
`tests/byok.test.ts` pin inference, refusal messages, and — the important one —
that a malformed key sends *no* headers rather than wrong ones.

---

## What this does not do

- **It does not add a provider.** Anthropic and Gemini only. A custom base URL
  (OpenAI-compatible endpoints, a local model) is a different piece of work:
  the pipeline assumes a schema-constrained JSON reply, and not every endpoint
  offers one.
- **It does not sync across devices.** A key pasted on a laptop stays on the
  laptop. Syncing would mean storing it somewhere, which is the one thing this
  design refuses.
- **It does not make the Connectors card live-update per provider.** The card
  reports the configured model; the settings sheet reports what answered.
