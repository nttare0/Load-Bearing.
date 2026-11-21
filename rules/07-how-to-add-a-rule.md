# 07 — How to Add a Rule (Step by Step)

> Use this template whenever the user wants to add a new tool or rule.
> **Agents must never add a tool on their own** — only with explicit user approval.

## When to Add a Rule

- The user approves a new tool/library to the allowlist.
- A recurring mistake needs a dedicated rule file.
- A new workflow (testing, deployment, design tokens…) needs guardrails.

## Steps

### Step 1 — Confirm with the user
Ask: tool name, repo/docs URL, what it is for, and why the current allowlist
cannot cover it. Get explicit approval before writing anything.

### Step 2 — Copy the template below
Save as the next numbered file, e.g. `rules/08-<your-rule>.md`.

### Step 3 — Fill in the template
Every rule **must** include: source of truth, install command, discovery
command(s), allowed/forbidden lists, and a citation format. A rule without a
way to verify it will be ignored.

### Step 4 — Wire it up
1. Add a row to [`rules/README.md`](README.md) index table.
2. Add a line to [`AGENTS.md`](../AGENTS.md) §6 index table.
3. If it changes the allowlist, add a row to [`00-core-allowlist.md`](00-core-allowlist.md).
4. If it affects tool choice, update [`04-decision-tree.md`](04-decision-tree.md).
5. If it bans a pattern, add a row to [`05-forbidden-patterns.md`](05-forbidden-patterns.md).
6. Mirror in [`.cursor/rules/`](../.cursor/rules/) if you use Cursor.

### Step 5 — Bump the version
Update the version + date footer in [`AGENTS.md`](../AGENTS.md).

### Step 6 — Verify
Re-read the new file as if you were the agent: can you follow it without
guessing? If not, tighten it.

---

## Template (copy from here)

```markdown
# NN — <Tool / Rule Name>

> Source: <repo URL> · Docs: <docs URL>
> One-line purpose. What it owns (and what it does NOT own).

## What It Is
- Bullet facts: what it is, stack, key packages, status.

## Mandatory Workflow
### 1. Install (once)
\`\`\`bash
<install command>
\`\`\`

### 2. Discover before you write (every task)
\`\`\`bash
<discovery command>
\`\`\`

### 3. Build with what the docs/CLI return
- Rules for using it correctly.

## When This Tool Wins
- Conditions where this tool is preferred (link to 04-decision-tree.md).

## Forbidden
- ❌ Things the agent must never do with this tool.

## Cite Your Work
- Format for citing discovery output in responses.
```

## Example: Adding a New Tool (filled in)

```markdown
# 08 — Example Tool

> Source: https://github.com/example/tool · Docs: https://example.com/docs
> ExampleTool owns <concern>. It does NOT own UI components (Astryx/shadcn do).

## What It Is
- ...

## Mandatory Workflow
### 1. Install (once)
\`\`\`bash
npm i example-tool
\`\`\`

### 2. Discover before you write (every task)
\`\`\`bash
npx example-tool search <q>
\`\`\`

## Forbidden
- ❌ Guessing its API from memory.

## Cite Your Work
- State the CLI command + result in every response.
```

## Anti-Patterns When Adding Rules

- ❌ Adding a tool without user approval.
- ❌ A rule file with no discovery command.
- ❌ Duplicating content across files — link instead.
- ❌ Forgetting to update `AGENTS.md` §6 (orphan rule = invisible rule).
- ❌ Vague rules ("use best practices") — always name the exact command/doc.
