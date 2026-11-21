# 10 — Pre-Build Plugins (Install Before Any Build Session)

> **Before any build / "vibe coding" session starts, verify these two
> agent plugins are installed.** They are agent-side constraint/process layers —
> not project dependencies, so they do not violate the tool allowlist in
> [00-core-allowlist.md](00-core-allowlist.md).

## Definition of Ready (session gate)

A build session may start only when **both** plugins are verified:

- [ ] **Ponytail** installed & active
- [ ] **Agent Skills** (addyosmani) installed

If either is missing: tell the user, give the exact install commands below,
and **wait** — do not start building silently without them.

---

## Plugin 1 — Ponytail

> Source: https://github.com/DietrichGebert/ponytail · MIT · current ~v5.3.3
> "Makes your AI agent think like the laziest senior dev in the room.
> The best code is the code you never wrote."

### What it enforces (decision order)

1. Search existing code first — reuse before writing.
2. Prefer native platform features over new code.
3. Avoid new dependencies unless truly needed.
4. Write the smallest safe change.

Measured impact vs. baseline: **−54% LOC, −22% tokens, −20% cost, −27% time**.
This reinforces our own constraints — [05-forbidden-patterns.md](05-forbidden-patterns.md)
(no hand-rolled replacements, no new libraries) and constraint 10 (real images).

### Install

**Claude Code** (send each command as its own separate message, in order —
pasting them together breaks the install):
```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
/reload-plugins
/ponytail
```

**Codex:**
```bash
codex plugin marketplace add DietrichGebert/ponytail
codex plugin add ponytail@ponytail
```

**Rule-file agents (Cursor, Windsurf, Cline, Aider, Zed…):** copy the Ponytail
rule files from the repo (`.cursor/rules/`, `.clinerules/`, …) into the project.

**Intensity levels:** `lite`, `full`, `ultra`, `off` — set a default with:
```bash
mkdir -p ~/.config/ponytail && echo '{"defaultMode": "lite"}' > ~/.config/ponytail/config.json
```
Requires Node on PATH for the always-on hooks (skills still work without them).

### Use during the session

- `/ponytail` — activate / set intensity.
- `/ponytail-debt` — find `shortcut: <limit>, <when to upgrade>` deferral
  markers left in code and pay them down.

---

## Plugin 2 — Agent Skills (Addy Osmani)

> Source: https://github.com/addyosmani/agent-skills ·
> "Production-grade engineering skills for AI coding agents."
> 25 skills, portable across Claude Code, Codex, Gemini, OpenCode, Cursor…

### Install

**Claude Code:**
```
/plugin marketplace add addyosmani/agent-skills
/plugin install agent-skills@addy-agent-skills
```
If the marketplace add fails with `git@github.com: Permission denied (publickey)`,
use the full HTTPS URL for the marketplace, or run once:
```bash
git config --global url."https://github.com/".insteadOf git@github.com:
```

**Other agents (skills CLI):**
```bash
npx skills add addyosmani/agent-skills --list      # browse the 25 skills first
npx skills add addyosmani/agent-skills             # install all
npx skills add addyosmani/agent-skills --skill code-review-and-quality   # single skill
```
> Per-skill installs copy only the skill folder, not the shared `references/`
> directory — install the whole repo when the checklists are needed.

### Use during the session (map skills to phases)

| Phase | Skill/command |
|-------|---------------|
| Before building | `spec` → `plan` (delta spec: SPEC-\<change\>.md, pick the unimplemented one) |
| Building | `build` (`/build auto` uses the open delta spec) |
| After building | `review` (`/review` — severity labels: Critical / Required / Optional / Nit) |
| Testing | `test` (`/test`) · `test-driven-development` skill |
| Shipping | `ship` (`/ship`) |

---

## Precedence

Plugin suggestions never override this repo's rules:

- This repo's `AGENTS.md` + `rules/` **always win** over plugin defaults.
- If Ponytail suggests a shortcut that would hand-roll a component or add a
  library → the allowlist wins (stop and ask, per [AGENTS.md](../AGENTS.md) §5).
- If an Agent Skill's output conflicts with rules 08/09 (site essentials, real
  images) → the rules win.

## Forbidden

- ❌ Starting a build with the plugins uninstalled and not telling the user.
- ❌ Inventing plugin commands not in their docs (run `--help` / check the repo).
- ❌ Letting a plugin's default behaviour override the allowlist or any rule file.
- ❌ Installing other plugins mid-session without user approval (add via
  [07-how-to-add-a-rule.md](07-how-to-add-a-rule.md)).

## Report at session start

> Plugins: Ponytail v5.3.3 active (`lite`) · agent-skills 0.6.16 installed (`/review`, `/test` available) — starting build.
