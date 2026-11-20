# Two columns, and what "new chat" means

This replaces `three-columns.md`. The third column is gone.

## What changed and why

The right-hand column held three cards — a files/activity browser, a connectors
list, and a licence credit. None of them was why anyone opened the app, and
between them they took 15rem from the one thing that is: the report.

They had also drifted into the wrong place. Connectors are configuration, and
configuration belongs on the Settings page, where a value can be explained in a
sentence instead of a tooltip. Files and activity described a workspace, but the
workspace is already the chat you are looking at — the thread *is* the record of
what happened in it.

So: the cards are deleted, not hidden. `FileRail.tsx` and `ConnectorRail.tsx` are
gone from the tree, along with the tilting machinery in `app/page.tsx` that only
existed to feed them. Connectors still appear, in Settings. Folders still exist on
the workspace and still export with it; nothing browses them now, and the code
that only drove the browser went with it rather than sitting unused.

## The layout

```
┌────────┬──────────────────────────────────────────────┐
│ nav    │                                              │
│ 56px   │   one centred column, max 46rem              │
│        │                                              │
│ New    │   the thread, or the new-chat canvas         │
│ chat   │                                              │
│ ────   │                                              │
│ Chats  │                                              │
│ Sett-  │   composer, pinned to the bottom of it       │
│ ings   │                                              │
│ Hide   │                                              │
└────────┴──────────────────────────────────────────────┘
         └── chat list panel, 15rem, toggled ──┘
```

- **nav**: 56px, every item a destination and named. `New chat` sits above a rule
  and has a filled surface because it is an *action*, not a place — it has no
  pressed state to be in.
- **chat list**: the only toggleable panel. Its row in nav is pressed while it is
  open; `Hide chats` / `Show chats` at the bottom does the same thing, because a
  layout control belongs at the bottom and pressing it twice should give you back
  what you had.
- **column**: the report, and nothing beside it. On a wide screen the margins are
  empty on purpose; a 46rem measure is what makes a report readable.
- **credit**: Rare UI's licence asks for a visible credit and it lived in the
  deleted column, so it is now fixed at the bottom-right, out of the way.

## A new chat is a verb; a workspace is a place

The distinction, borrowed from arena.ai/agent: **you can press New chat, but you
cannot be in it.** Everything follows from that.

| | Where | Says what |
| --- | --- | --- |
| **New chat** | bottom of the chat list, and the top item in nav | an action: start a blank thread |
| **a chat** | a row in the list | a place: its own messages, plans, reports, folders |

Rules, all pinned in `tests/workspace-naming.test.ts`:

1. A workspace with no messages and no plans **is** a new chat, whatever it is
   called. `isNewChat` is the only test for it.
2. Its row reads `New chat` and `nothing sent yet`. Not `empty` — nothing is
   wrong with it, and `Untitled workspace` was a filing-cabinet label on an
   invitation to type.
3. The first plan sent names it, from the plan's own words. A first line of fewer
   than three words is skipped (`Meals.` is a label above a plan, not the plan),
   and the title comes from the first sentence with enough words in it.
4. A chat somebody has renamed keeps that name. Only a chat still called
   `New chat` is renamed by a later plan.
5. **Pressing New chat twice does not make two blanks.** If a blank chat exists,
   New chat takes you back to it. A list of `New chat, New chat, New chat` is the
   exact thing this is getting away from.

The canvas says the same thing before you send anything: `New chat · its own
workspace` above the question, and a line saying that sending starts the chat and
names it after the plan, and that until then nothing is saved.

## What is still shared, and is not a bug

Each chat has its own workspace — its own messages, plans, reports, folders — but
the *analyses* and *plans* themselves live in browser storage keyed by id, and a
report can be linked to. Deleting a chat removes the chat; it does not reach into
storage and delete every analysis it referenced, because a share link to one of
them may still be open somewhere.
