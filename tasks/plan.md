# Implementation Plan: Workspace Foundation — V1

**Source spec:** [`spec/SPEC-workspace-foundation.md`](../spec/SPEC-workspace-foundation.md) (approval date recorded in the conversation: 2026-11-21)

**Status:** Approved by the user on 2026-11-21; implementation is in progress.

## Overview

Make browser-local workspace persistence explicit and non-destructive. Distinguish a genuinely empty store from invalid or unavailable storage, preserve compatible legacy workspace records, report when writes are not durable, and provide user-approved warning/export/retry recovery without changing report APIs or enabling Supabase.

This plan covers only the `workspace-foundation` module. It does not implement the session list, composer, uploads, streamed activity, right-side analytical workspace, or responsive shell.

## Current State and Constraints

- `lib/workspace.ts` stores workspaces and the current ID in `localStorage`. `readWorkspaces()` currently returns `[]` both for an empty store and for malformed/unavailable storage; it shallow-checks records and defaults missing folders/resources. `writeWorkspaces()` swallows write errors and returns no status. `readCurrentId()` does not catch storage access errors.
- `app/page.tsx` creates and writes a blank workspace whenever `readWorkspaces()` returns an empty array. This can overwrite the recovery path after a malformed read. Workspace writes also occur inside a React state updater, so persistence feedback must not depend on an updater running exactly once.
- `lib/erase.ts` already enumerates app-owned keys; keep that boundary and do not clear all origin storage.
- `lib/store.ts` and `/api/analysis` are the separate, existing explicit report-save path. Do not modify it, its schema, or its environment configuration.
- `archivedAt` and session-list-related changes are already present as unverified working-tree edits. Preserve compatible archive metadata; do not treat those edits as verified.
- The working tree also contains unverified UI scaffolding under `components/agent/`, which `.gitignore` excludes. `app/page.tsx` imports some of it, but the components are not mounted. This module will not integrate or ship those files. The later UI module plans must reconcile the ignored directory before any clean-clone build or commit.

## Architecture Decisions

1. **Use explicit persistence outcomes.** The workspace boundary must distinguish an empty store, valid data, malformed data, and unavailable storage. Writes must distinguish a durable save from a failed save. Avoid returning an empty list or success-shaped value for all failure cases.
2. **Validate at the storage boundary.** Parse JSON as `unknown`; validate required workspace and nested fields; apply defaults only for supported legacy omissions such as folders/resources. Preserve the original raw value when data is invalid so recovery remains possible.
3. **Prevent destructive initialization.** `app/page.tsx` may create/persist the first blank workspace only when storage is truly empty. A malformed or unavailable read must not trigger a blank write. Reconcile the stored current ID against loaded records without deleting archived workspaces.
4. **Make persistence failure honest.** Keep current-tab state usable after quota/write failure, but identify it as not durably saved. Offer a warning, export of the appropriate recoverable data (raw stored JSON for malformed data; current in-memory workspace state for write failure), and retry through the same persistence boundary.
5. **Use existing UI and browser capabilities.** Reuse existing notification and download patterns; verify their installed APIs before implementation. Do not add a dependency, hand-roll a replacement component system, or turn Settings into a drawer. Settings remains its own page.
6. **Keep network and credential boundaries unchanged.** Workspace reads/writes remain local. Provider credentials stay in the existing BYOK settings flow and outside workspace data. Existing explicit report-save behavior is untouched; no Supabase activation or configuration change.

## Dependency Graph and Build Order

```text
lib/workspace.ts read/write outcomes and validation
                    │
                    ├── focused persistence tests
                    │
                    └── app/page.tsx safe hydration and durable-write feedback
                                      │
                                      └── recovery warning + export/retry
                                                │
                                                └── end-to-end verification
```

Build order: storage contract → safe hydration → write-status handling → recovery actions → verification.

## High-Level Task List

### Phase 1: Storage contract

- Define and test explicit read/write outcomes for empty, valid, malformed, unavailable, and quota-failure cases. Preserve valid legacy workspace shapes and archive metadata.
- Keep invalid stored bytes available for recovery; do not make a failed read look like an empty workspace list.

### Phase 2: Safe application integration

- Update browser hydration so only a confirmed empty store creates the initial workspace. Invalid/unavailable storage must not be overwritten.
- Reconcile current-workspace selection against loaded workspace records while retaining archived records.
- Ensure workspace updates report whether they were persisted, without relying on duplicate-prone side effects inside state updater callbacks.

### Phase 3: Recovery experience

- Surface a clear, non-destructive warning when local data cannot be read or a write fails.
- Offer export and retry using the actual raw stored value or the current in-memory state, depending on the failure. Do not label an in-memory-only update as durably saved.
- Use existing project UI/download affordances after verifying their APIs; keep Settings as its own route.

### Checkpoint: Foundation behavior

- Focused persistence tests pass.
- `npm run typecheck` and `npm test` pass.
- Manual browser checks confirm reload persistence, malformed-data preservation, quota-failure feedback, export, and retry.

### Checkpoint: Module complete

- `npm run build` passes on a source tree whose imports are all tracked and included.
- No workspace message, plan, or resource is sent over the network by this module.
- Existing report-save behavior and BYOK handling are unchanged.
- Full security and launch checklists remain required before shipping the complete redesign.

## Verification Plan

- Focused tests in `tests/` use the existing `node:test`/`node:assert/strict` runner and controlled storage stubs; no testing dependency is added.
- Test that valid workspaces and compatible legacy records round-trip without data loss; malformed records are not rewritten; storage exceptions are represented; failed writes remain distinguishable from successful writes; and app-owned erase operations do not clear unrelated storage.
- Run `npm run typecheck`, `npm test`, and `npm run build` after the implementation slice. Record exact results and any baseline failures; do not infer success from the earlier pre-UI test run.
- Manually verify in a browser: create separate workspace data, reload, simulate malformed stored JSON and a failed write, export the correct payload, retry, and confirm the original data was not silently replaced.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Malformed workspace JSON is treated as empty and replaced by a new blank workspace. | High: user data may become unrecoverable. | Distinguish empty from invalid; preserve raw bytes; block automatic initialization and expose export/retry. |
| Browser quota or privacy-mode failures are swallowed. | High: the UI may imply data was saved when it was not. | Return a write outcome; retain current-tab state; warn and offer export/retry. |
| Strict validation breaks older workspace records. | Medium: existing user data may disappear from the UI. | Document supported legacy shapes and test migration/default behavior before changing the validator. |
| React state updater execution is not a durable-write contract. | Medium: duplicate/hidden persistence effects or misleading status. | Centralize persistence outcome handling and keep state updates deterministic. |
| `localStorage` is not encrypted at rest. | High for users expecting confidentiality from device access or same-origin script execution. | State the limitation plainly; do not claim encryption; keep encryption and account sync out of V1 unless separately approved. |
| Ignored partial UI components are imported from `app/page.tsx`. | High: a clean clone/commit can lack those source files even if the local workspace can see them. | Keep them out of this module; reconcile them in their approved UI-module plan before shipping or relying on a clean build. |
| Optional Supabase report storage exists separately. | Medium: accidental scope expansion could alter remote data behavior. | Do not call the Supabase connector or change existing report API/configuration; test that this module makes no new network writes. |

## Open Questions

None for this plan's approved scope. Any change to local-only persistence, encryption, Supabase, report-save behavior, or account sync requires a new approval.

## Next Gate

After this plan is approved, create the detailed, independently verifiable tasks in `tasks/todo.md` (Phase 3) and request approval before implementation. Do not begin code until that task breakdown is approved.
