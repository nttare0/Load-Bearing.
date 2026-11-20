# Three columns, and a thinking level you can see

*2026-11-20. Splitting one rail into three surfaces, moving the spine to the
left, and making "think harder" a thing on screen instead of a gesture to
discover.*

---

## What was asked

> Separate the connectors, workspace, file/activity with the side bar; move the
> side bar to the left and leave others on the right; add LLM thinking; and each
> chat should have its own workspace.

## The layout, before and after

**Before** — one right column holding four unrelated things in a stack
(workspaces, files/activity, connectors), plus a spine on the *right* that then
sat between the app and the files it was opening.

```
        ┌──────────┬──────────────────────────────┬──────────┬──────┐
        │          │                              │ workspaces│ ▤ ⚙ │
        │          │          thread               │ files     │      │
        │          │                              │ connectors│      │
        └──────────┴──────────────────────────────┴──────────┴──────┘
```

**After** — a spine on the left edge, chats on the left, the thread in the
middle, and the things *about* the thread on the right.

```
 ┌────┬────────────────┬──────────────────────┬──────────────────┐
 │ ⬒  │ Workspaces     │                      │ Thinking         │
 │ ▤  │  Kigali meals  │       thread          │  Quick Think Deep│
 │ ▤  │  Rider plan    │                      │ Connectors       │
 │ ─  │  ↳ Files       │                       │  GitHub · Vercel │
 │ ⚙  │    report…     │   [ composer ]        │  Gemini · Storage│
 │ 🧠 │                │                       │  Manage keys →   │
 └────┴────────────────┴──────────────────────┴──────────────────┘
   spine   chats + files        the work          what it's wired to
```

Three files, one job each:

| File | Holds |
|---|---|
| `components/rail/WorkspaceRail.tsx` | The chats. Each row says `2 messages · 1 report`, or `empty`. |
| `components/rail/FileRail.tsx` | Files and Activity, attached to the chat above them. |
| `components/rail/ConnectorRail.tsx` | Thinking level, and the four connectors + the way into settings. |

`components/rail/parts.tsx` holds the measurements all three share, so the split
did not turn one panel into three slightly different panels.

`components/SideRail.tsx` is deleted — it was the thing being split.

## The spine, moved left

| Control | Why it is there |
|---|---|
| **New chat** | An action, not a place. First. |
| **Workspaces** | With a count, because "how many do I have" is a real question. |
| **Files & activity** | Opens the file card *under* the chat list rather than replacing it. |
| **Settings** | Below a divider — it configures, it does not navigate. |
| **Thinking** | At the bottom, cycling in place, three dots showing the level. |
| **Hide panel** | Pinned to the floor. |

The thinking control went on the spine rather than only in settings because it is
a setting whose *value* matters on every message. A sheet is where you look once;
this is where you glance.

## Thinking, three ways in — one value out

The level already existed as a hold-to-charge gesture on the send button, which
meant it was invisible until someone pressed and held. It now exists as one piece
of state with three ways to see or change it:

1. **Spine dots** — filled to the current level, tap to cycle.
2. **Connector card** — three named buttons, each with its cost (`fastest`,
   `balanced`, `slower`), because "Deep" alone is a mood and "slower" is a price.
3. **Composer strip** — a chip next to `live`/`demo`, showing the level that will
   be spent, tappable.

All three write the same `thinking` state, and that state is what the request
carries: a **tap** sends at the chosen level (`startingLevel`), a **hold** still
climbs faster and wins, because the person moved it deliberately. Both land on
`low | medium | high` through `thinkingFor()`.

**The honest gap:** only Gemini receives this. Claude has no equivalent parameter
in this app, so the connector card says so in a sentence rather than pretending
the setting applies:

> Claude does not expose a thinking level here, so this changes the reading, not
> the reasoning.

## Each chat is its own workspace

This was already half-true — workspaces had separate messages and plans — but
"New chat" reused `createWorkspace()` and the shell treated files as a global
shelf. Now:

- `New message` / `New chat` creates a workspace and **switches to it**, clears
  the composer draft and any pending proposal, and opens the files panel for the
  new chat. No state carries over from the previous conversation.
- The left rail labels each chat with its own counts, so "its own workspace" is
  checkable at a glance rather than a claim in a doc.
- Files, folders, reports and plans are read from `current`, so there is no
  shared shelf for two chats to collide on.
- Deleting a chat says how many reports go with it.

## Gates

`npm run typecheck` clean · **69/69 tests** (+5 in `tests/thinking.test.ts`) ·
`next build` compiled · served on `:3000` and checked over HTTP:

```
aria-label="Chat, workspaces, files and settings"   ← the spine
aria-label="Chats and files"                        ← left column
aria-label="Connectors"                             ← right column
aria-label="How hard the model thinks"              ← the new control
```

## What is still weak

- **The right column is always open.** Connectors are worth seeing once; after
  that they are furniture taking 240px from the thread. They should collapse to
  nothing until the spine asks for them, the way the left column does.
- **Mobile has no rails at all** (`hidden md:flex`) — held over from before, and
  now that the spine holds the *only* way to a new chat it matters more.
- **Thinking is not remembered per chat.** It is one setting for the whole app;
  a person who wants deep thinking on one plan and quick on another has to
  re-pick it.
