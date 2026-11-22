# Spec: Workspace Foundation — V1

**Status:** Approved by the user on 2026-11-10 for planning and implementation within the boundaries below.

**Approved decisions:** Browser-local persistence without at-rest encryption is acceptable for V1; do not add account sync or enable Supabase. For malformed or full storage, preserve recoverable data, warn the user, and offer export/retry.

**Capability map:** [`capability-map.md`](./capability-map.md) (approved 2026-11-10)

## Objective

Provide a reliable, privacy-conscious browser-local data foundation for Load-Bearing's per-chat workspaces. A workspace owns its messages, plans, folders, resources, and archive metadata. Reading or writing that workspace must not accidentally send its contents to a server, erase unrelated origin storage, or silently replace recoverable data with a blank workspace.

The audience is a person using Load-Bearing to analyze decisions and return to separate conversations and their saved work. Success means each chat's state remains distinct and survives reloads on the same browser, legacy workspace data remains readable, failures are handled honestly, and no stronger security promise is made than the implementation provides.

This module covers data shape and local persistence boundaries only. Session-management UI, composer/upload UX, streamed activity, the right-side tabs, and responsive layout have their own specs in the approved capability map.

## Tech Stack

- Next.js 16 App Router, React 19, TypeScript.
- Existing browser `localStorage` for workspace state and current-workspace selection.
- Existing `node:test` tests run through `tsx`.
- Existing optional report-save API/storage behavior is outside this module's write path and must remain unchanged. Do not enable or configure Supabase.
- No new dependencies, database, authentication, or remote workspace persistence.

### Current data boundaries

- Workspace records use the `load-bearing:workspaces` key; current selection uses `load-bearing:current-workspace`.
- Reports, plans, preferences, and provider settings have separate existing storage paths. Provider credentials must not be copied into workspace objects, resources, messages, or exports.
- The existing `/api/analysis` and `lib/store.ts` path can save a report only through the current explicit report-save behavior. This spec does not change that behavior, its environment configuration, or any database integration.
- Browser-local storage is readable by same-origin JavaScript and is not encrypted at rest. It is not an account store or a guarantee of confidentiality on a shared/compromised device.

## Commands

- Development: `npm run dev`
- Typecheck: `npm run typecheck`
- Tests: `npm test`
- Lint: `npm run lint`
- Production build: `npm run build`

## Project Structure

- `lib/workspace.ts` — workspace/message types, browser-local read/write helpers, and workspace naming utilities.
- `lib/resources.ts` — folder/resource shapes and bounded resource actions.
- `lib/schema.ts` — analysis/report schemas.
- `lib/erase.ts` — enumerated app-owned data and preference keys; do not replace this with `localStorage.clear()`.
- `lib/store.ts`, `app/api/analysis/route.ts` — existing optional report storage; unchanged by this module.
- `app/page.tsx` — browser hydration and workspace state owner; UI integrations are specified in later modules.
- `tests/` — unit tests using Node's test runner and strict assertions.

## Code Style

Keep types explicit at storage boundaries, parse persisted JSON as `unknown`, narrow before use, and preserve legacy defaults. Reads must be safe during server rendering; invalid/unavailable browser storage must be distinguished from a genuinely empty store so recovery does not overwrite the original value. Example shape for that boundary:

```ts
try {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return { kind: "invalid", raw };
  return {
    kind: "ok",
    workspaces: parsed.filter(isWorkspace).map((workspace) => ({
      ...workspace,
      folders: Array.isArray(workspace.folders) ? workspace.folders : [],
      resources: Array.isArray(workspace.resources) ? workspace.resources : [],
    })),
  };
} catch {
  return { kind: "invalid", raw };
}
```

Use the repository's existing naming, formatting, and error-handling conventions. Keep the change small; do not introduce a storage abstraction or dependency without a demonstrated need.

## Testing Strategy

- Add focused unit tests under `tests/` with `node:test` and `node:assert/strict` for workspace serialization round trips, legacy records missing newer optional fields, archive metadata, invalid persisted values, stale current-workspace IDs, and storage read/write failures.
- Verify workspace messages, plans, folders, and resources remain associated with their own workspace and that app-owned deletion does not clear unrelated origin storage.
- Verify credentials are not added to workspace records or report/resource exports by this module.
- Run `npm run typecheck`, `npm test`, and `npm run build` after implementation. Manually verify same-browser reload behavior and that a storage failure is not presented as a successful durable save.
- Do not claim the full redesign is verified based on tests for this foundation module alone.

## Boundaries

### Always do

- Keep workspace state browser-local and preserve the current one-workspace-per-chat boundary.
- Validate stored values before use; retain compatible legacy data and avoid destructive recovery behavior.
- Scope reads, writes, and deletion to this app's enumerated keys; never clear all origin storage.
- Keep provider credentials out of workspace data and exports.
- Make storage failure observable to the caller so the UI can distinguish current-session state from durable state; on malformed or full storage, preserve recoverable data, warn the user, and offer export/retry.
- Preserve existing explicit report-save behavior and APIs without changing their Supabase configuration or semantics.

### Ask first

- Client-side encryption, key management, recovery, or any claim of encrypted-at-rest storage.
- Remote workspace persistence, accounts, cross-device sync, a new database, Supabase activation/configuration, migrations, or changes to report-storage APIs.
- Destructive data migrations, changes to existing erase/delete semantics, or a new dependency.

### Never do

- Describe `localStorage` as encrypted or secure against same-origin script execution.
- Send workspace messages, plans, or resources to a server as a side effect of reading or saving local workspace state.
- Copy BYOK credentials into a workspace, resource, analysis, or export.
- Silently overwrite recoverable stored data with an empty workspace after parse or quota failure.
- Use fabricated workspaces, files, reports, or activity as persisted data.

## Success Criteria

- A workspace round-trips with its messages, plans, folders, resources, and optional `archivedAt` intact; workspaces remain isolated from one another.
- Older valid workspace records that lack newer optional fields remain readable with safe defaults.
- Invalid or corrupt persisted data is rejected without an exception and without silently overwriting the original stored value with a blank list; the user receives a warning and can export the recoverable data or retry.
- Reads remain safe during server rendering. Storage unavailability or quota failures do not crash the active session, are distinguishable from a successful durable write, and offer warning plus export/retry where recovery data is available.
- Current-workspace selection is reconciled against the loaded workspace list without discarding archived workspaces or creating duplicate blank workspaces.
- No new server endpoint, database schema, Supabase configuration, dependency, or remote workspace write is introduced.
- Existing explicit report-save behavior is unchanged; credentials remain outside workspace state.
- Focused tests, typecheck, the full test suite, and the production build pass before this module is marked complete.

## Out of Scope (Deferred)

- Session-list interactions and archive/restore/delete controls (`session-management`).
- Message sending, composer controls, uploads, extracted-file retention, and raw binary storage (`conversation-composer`, `analytical-workspace`).
- Real-time five-pass activity rendering (`reasoning-activity`).
- Overview, Assumptions, Evidence, Experiments, and Files UI (`analytical-workspace`).
- Responsive navigation and panel/drawer behavior (`responsive-shell`).
- Account-level storage, cross-device sync, encryption-at-rest, new authentication, or any new Supabase/database work; these need a separate approved design.

## Open Questions

None for this module. The user approved browser-local storage without at-rest encryption and selected non-destructive warning plus export/retry for malformed/full storage. Any future request for encryption, account sync, or remote workspace storage requires a separate approved spec; Supabase remains off unless explicitly authorized.
