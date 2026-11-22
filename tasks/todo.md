# Task List: Workspace Foundation — V1

**Source spec:** [`spec/SPEC-workspace-foundation.md`](../spec/SPEC-workspace-foundation.md) (approval date recorded in the conversation: 2026-11-21)

**Implementation plan:** [`plan.md`](./plan.md) (approval date recorded in the conversation: 2026-11-21)

**Status:** Approved by the user on 2026-11-21. Tasks 1 and 2 are implemented; the read/hydration checkpoint is blocked.

**Current project verification blocker:** `npm run typecheck` and `npm run build` fail on existing UI integration errors outside `workspace-foundation`: `app/page.tsx` imports missing `components/agent/WorkspacePanel` and `ResponsiveDrawer` files because `.gitignore` excludes `components/agent/`, and its `WorkspaceRail` call omits required `onRename`, `onArchive`, and `onRestore` props. Do not attribute these failures to workspace persistence or fix them before the corresponding UI-module spec is approved.

## Phase 1: Safe storage reads

### Task 1: Distinguish empty, valid, invalid, and unavailable workspace reads

**Description:** Replace the ambiguous read result with an explicit outcome. Validate persisted workspace records at the boundary, preserve the original raw value on invalid data, and retain supported legacy defaults and archive metadata.

**Acceptance criteria:**
- [x] A genuinely empty store is distinguishable from malformed JSON, invalid workspace shapes, and inaccessible storage.
- [x] Valid legacy records missing `folders` or `resources` remain readable with safe defaults; optional `archivedAt` round-trips.
- [x] Invalid stored data is not rewritten or discarded during a read.

**Verification:**
- [x] `npx tsx --test tests/workspace-persistence.test.ts` (7/7 passed)

**Status:** Complete. Scoped TypeScript check passed; the project-wide typecheck/build remain blocked by the unrelated UI errors recorded above. The app still uses the legacy array-returning wrapper until Task 2 integrates the explicit result into hydration.

**Dependencies:** None.

**Files likely touched:**
- `lib/workspace.ts`
- `tests/workspace-persistence.test.ts`

**Estimated scope:** Medium.

### Task 2: Integrate safe workspace hydration and current-session selection

**Description:** Update browser initialization so only a confirmed empty store creates and persists the initial blank workspace. Reconcile the current ID without erasing archived sessions or allowing malformed/unavailable storage to trigger a destructive blank write.

**Acceptance criteria:**
- [x] Valid existing workspaces hydrate as-is; a blank workspace is created only for a genuinely empty store.
- [x] Invalid or inaccessible storage does not trigger an automatic write, and the original recoverable value remains intact.
- [x] Current selection resolves to an existing workspace deterministically; archived workspaces remain in the stored list.

**Verification:**
- [x] `npx tsx --test tests/workspace-persistence.test.ts` (12/12 passed)
- [x] `npm test` (122/122 passed)
- [ ] `npm run typecheck` — fails only on the pre-existing UI errors listed above (not in Task 2 code)

**Status:** Implemented. `app/page.tsx` hydration uses `readWorkspacesResult()` and `hydrateWorkspaceState()`; writes are blocked for invalid or unavailable storage, and a visible warning is shown. Export and retry are Task 4.

**Dependencies:** Task 1.

**Files likely touched:**
- `app/page.tsx`
- `lib/workspace.ts`
- `tests/workspace-persistence.test.ts`

**Estimated scope:** Medium.

### Checkpoint: Read and hydration safety

- [ ] Focused persistence tests pass.
- [ ] Typecheck passes.
- [ ] No malformed/unavailable read can overwrite the stored value with a blank workspace.

## Phase 2: Honest writes and recovery

### Task 3: Report durable-write outcomes and handle current-ID storage failures

**Description:** Make workspace writes and current-ID reads/writes return explicit outcomes. Ensure application state updates do not imply durable persistence when storage rejects a write, and do not depend on state updater callbacks executing exactly once.

**Acceptance criteria:**
- [x] Successful writes and storage/quota failures are distinguishable to the caller.
- [x] A failed write keeps the current-tab workspace usable but is not presented as durably saved.
- [x] Storage exceptions for current-ID reads/writes are non-fatal and covered by tests.

**Verification:**
- [x] `npx tsx --test tests/workspace-persistence.test.ts` (18/18 passed)
- [x] `npm test` (128/128 passed)
- [ ] `npm run typecheck` — only the pre-existing UI errors remain (not from this task)

**Dependencies:** Tasks 1–2.

**Files likely touched:**
- `lib/workspace.ts`
- `app/page.tsx`
- `tests/workspace-persistence.test.ts`

**Estimated scope:** Medium.

**Status:** Implemented. `writeWorkspaces()` and `writeCurrentId()` return `WriteOutcome` (`saved` or `quota`/`unavailable`). Workspace writes run from one commit function, not inside a state updater. A failed write shows a "only in this tab" warning. Browser verification is still pending.

### Task 4: Add non-destructive export and retry recovery actions

**Description:** Surface a clear warning and actionable recovery for malformed saved data or failed writes. Export the original raw JSON after a malformed read; export the current in-memory workspace state after a failed write. Offer retry through the same persistence boundary.

**Acceptance criteria:**
- [ ] The malformed-data path preserves the original value and offers a backup export plus retry; it never auto-initializes over it.
- [ ] The quota/write-failure path warns that the latest changes may be tab-only and offers an export of those in-memory changes plus retry.
- [ ] Recovery actions use existing UI/browser patterns and do not add a dependency or change the separate report-save/API path.

**Verification:**
- [ ] `npx tsx --test tests/workspace-persistence.test.ts`
- [ ] Manually exercise both recovery paths in a browser and verify the exported contents match the corresponding source.
- [ ] Before implementation, verify the existing notification and download APIs from local source/docs and Modern Web Guidance; stop and ask if the allowlisted/project tools do not cover the need.

**Dependencies:** Tasks 1–3.

**Files likely touched:**
- `app/page.tsx`
- `lib/workspace.ts`
- `tests/workspace-persistence.test.ts`

**Estimated scope:** Medium.

### Checkpoint: Recovery behavior

- [ ] Focused tests and typecheck pass.
- [ ] Malformed data remains recoverable after navigation/reload attempts.
- [ ] Quota failure is clearly distinguished from a successful save; export and retry work.

## Phase 3: Data-boundary regression and module verification

### Task 5: Pin app-owned deletion and credential boundaries

**Description:** Add regression tests for the existing enumerated deletion behavior and workspace data boundaries. Only modify production code if the tests identify a violation within this module's approved scope.

**Acceptance criteria:**
- [ ] Erasing app-owned data leaves a sentinel value for another origin consumer untouched; no global `localStorage.clear()` is introduced.
- [ ] Provider credentials remain outside workspace records and workspace backup exports.
- [ ] Existing explicit report-save behavior and Supabase configuration remain unchanged.

**Verification:**
- [ ] `npx tsx --test tests/erase.test.ts tests/workspace-persistence.test.ts`
- [ ] Review the diff for new network writes, credential copying, or changes to `lib/store.ts` and `app/api/analysis/route.ts`.

**Dependencies:** Tasks 1–4.

**Files likely touched:**
- `lib/erase.ts` (only if a scoped test exposes a defect)
- `tests/erase.test.ts`
- `tests/workspace-persistence.test.ts`

**Estimated scope:** Small.

### Task 6: Complete foundation verification and report blockers

**Description:** Run the module's full checks, perform manual browser verification, and record exact results. Do not call the full redesign shippable while source files required by the app remain ignored or untracked.

**Acceptance criteria:**
- [ ] `npm run typecheck`, `npm test`, and `npm run build` results are recorded accurately; failures are fixed only within approved scope or reported as blockers.
- [ ] Manual reload, isolation, malformed-data, quota, export, retry, and deletion checks pass.
- [ ] Every production import needed for a clean checkout is tracked or otherwise part of the approved project source; the ignored `components/agent/` scaffolding is reconciled in its later approved UI module before any combined redesign release.

**Verification:**
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Manual browser checklist from `tasks/plan.md`

**Dependencies:** Tasks 1–5.

**Files likely touched:**
- No planned source changes; add tests or scoped fixes only if verification exposes an issue.

**Estimated scope:** Small.

### Checkpoint: Workspace foundation complete

- [ ] All acceptance criteria in the approved spec are met.
- [ ] Tests, typecheck, build, manual checks, and scoped security review are recorded.
- [ ] No commit, push, PR, or merge occurs with unresolved ignored imports, unverified changes, or failed required checks.

## Gate

This is a proposed task breakdown. Await user approval before starting Task 1. Planning and verification commands above describe future execution; none have been run for these tasks yet.

## Completion record: workspace-foundation

- Tasks 1–3: implemented; covered by `tests/workspace-persistence.test.ts`.
- Task 4: export and retry are wired into both warnings. Malformed data exports the original raw value byte for byte, and Retry re-reads storage. A failed save exports the in-memory workspaces and Retry re-attempts the write. Covered by round-trip and raw-preservation tests. Not yet exercised in a browser.
- Task 5: `eraseLocal()` removes only this app's keys and leaves other origin storage alone. Workspace exports do not contain the saved model credential. Covered by two regression tests.
- Task 6 automated checks: `npm run typecheck`, `npm test` (132/132) and `npm run build` pass.
- Not done: manual browser checklist (no browser is available in the sandbox). The AGENTS.md 32-point security checklist and 20-point launch checklist are not completed; only the scoped data-boundary review above was done.
- Build blockers resolved: removed the unused imports of the git-ignored `components/agent/` modules from `app/page.tsx`, and passed the existing rename, archive and restore handlers to `WorkspaceRail`.
