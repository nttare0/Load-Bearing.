# Capability Map: Load-Bearing Analytical Workspace — V1

**Status:** Approved by the user on 2026-11-10.

## Objective

Redesign Load-Bearing into a responsive analytical workspace while preserving its existing five-pass reasoning engine, integrations, and per-chat data boundaries. The experience must display only real analysis events and saved data.

## Modules

| Module id | Responsibility | Depends on |
|---|---|---|
| `workspace-foundation` | Preserve a separate workspace per chat and define browser-local persistence, validation, and privacy boundaries. | — |
| `session-management` | Create, select, search, group, rename, archive, restore, and delete sessions. | `workspace-foundation` |
| `conversation-composer` | Continuous per-session messages, working composer controls, and the existing upload/extraction flow. | `workspace-foundation`, `session-management` |
| `reasoning-activity` | Surface real streamed stages, reasoning, results, and errors while retaining the existing five-pass engine and APIs. | `conversation-composer`, existing pipeline |
| `analytical-workspace` | Right-side Overview, Assumptions, Evidence, Experiments, and Files views over actual saved data and existing report/resource actions. | `workspace-foundation`, `reasoning-activity` |
| `responsive-shell` | Adapt navigation, session history, thread, and workspace for desktop and mobile. | `session-management`, `analytical-workspace` |

## Build order

`workspace-foundation` → `session-management` → `conversation-composer` → `reasoning-activity` → `analytical-workspace` → `responsive-shell`.

## Initiative-wide boundaries

- Keep one workspace per chat; Settings remains its own page.
- Preserve the existing five-pass reasoning engine and integrations.
- Show only actual streamed activity, evidence, reports, resources, and files; do not simulate or fabricate them.
- Keep the existing FileRail and ConnectorRail files; a layout change is not permission to delete them.
- Use the repository's existing shadcn component system and existing dependencies; add no UI library or other dependency.
- Use broad analytical-workspace interaction patterns only. Do not use Arena marks/assets or imply affiliation.
- Workspace persistence remains local-first. Do not enable Supabase, add a database, or add account/cross-device sync. Leave the existing explicit report-save/API behavior and runtime configuration unchanged.
- Treat browser `localStorage` accurately: it is not encrypted at rest. Do not claim encryption or account-level privacy.

## Spec sequence

Create and approve each module spec in dependency order. Planning, task breakdown, and implementation begin only after the corresponding module spec is approved.
