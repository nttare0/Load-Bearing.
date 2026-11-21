"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { ConnectorList, useConnectors } from "@/components/Connectors";
import { Card, CardTitle, Panel } from "@/components/rail/panels";
import { EFFORTS, THINKING, type Effort } from "@/lib/effort";
import {
  BYOK_STORAGE,
  EMPTY_SETTINGS,
  checkKey,
  credentialNote,
  maskKey,
  type LlmSettings,
  type ProviderId,
} from "@/lib/byok";

/**
 * Settings, as a page.
 *
 * Redesigned around one idea: this screen's job is to answer **"what is this app
 * using right now?"** before it offers anything to change. The old version opened
 * with three equal cards — Thinking, Your model, Connectors — none of which said
 * what was currently in play, so the first question a person arrives with had no
 * answer on screen.
 *
 * The shape now:
 *
 *   1. a **status strip** at the top: which model, whose key, how hard it thinks,
 *      and where the work is stored — four facts, one line each, no controls
 *   2. **Your model** — the only section that changes a fact, and the only one
 *      with a warning-coloured border when its key is wrong
 *   3. **Thinking** — three levels with what each costs, not three buttons
 *   4. **Connectors** — the same four facts, expanded, with where they come from
 *
 * Settings is where a value is *explained*. Every control states its consequence
 * in a sentence underneath rather than relying on a tooltip.
 */

type TestResult = { ok: boolean; line: string; detail?: string };

export function SettingsPage({
  settings,
  onChange,
  mode,
  model,
  storage,
  thinking,
  onThinking,
}: {
  settings: LlmSettings;
  onChange: (settings: LlmSettings) => void;
  mode: "demo" | "live" | null;
  model: string | null;
  storage: string | null;
  thinking: Effort;
  onThinking: (effort: Effort) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [reveal, setReveal] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [saved, setSaved] = useState(false);

  const checked = checkKey(draft);
  const dirty =
    draft.key !== settings.key ||
    draft.provider !== settings.provider ||
    draft.remember !== settings.remember;

  const connectors = useConnectors({ mode, model, storage });

  const save = () => {
    onChange({ ...draft, key: draft.key.trim() });
    setSaved(true);
    setResult(null);
    window.setTimeout(() => setSaved(false), 1600);
  };

  const clear = () => {
    setDraft({ ...EMPTY_SETTINGS });
    onChange({ ...EMPTY_SETTINGS });
    setResult(null);
    setReveal(false);
  };

  const test = async () => {
    if (!checked.ok) {
      setResult({ ok: false, line: checked.reason });
      return;
    }
    setTesting(true);
    setResult(null);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-llm-provider": checked.provider,
          "x-llm-key": checked.credential.key,
        },
        body: JSON.stringify({}),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        model?: string;
        ms?: number;
        reason?: string;
        note?: string | null;
      };
      if (data.ok) {
        setResult({
          ok: true,
          line: `The key works${data.model ? ` — ${data.model} answered` : ""}${
            data.ms ? ` in ${(data.ms / 1000).toFixed(1)}s` : ""
          }.`,
          detail: data.note ?? undefined,
        });
      } else {
        setResult({
          ok: false,
          line: data.reason ?? "That key did not work.",
          detail: data.note ?? undefined,
        });
      }
    } catch {
      setResult({ ok: false, line: "The check itself failed to send. Try again." });
    } finally {
      setTesting(false);
    }
  };

  const usingOwnKey = Boolean(settings.key.trim());
  // A key that is present but shaped wrong is the one state the page must not
  // bury: it means requests are silently running on the deployment's key.
  const keyBroken = Boolean(draft.key.trim()) && !checked.ok;

  return (
    <div className="mx-auto flex w-full max-w-[38rem] flex-col px-[1rem] pb-[3rem] pt-[1rem]">
      <Link
        href="/"
        className="mb-[0.75rem] flex w-fit items-center gap-[0.25rem] text-[0.75rem] text-ink-3 hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-3.5" />
        Back to the workspace
      </Link>

      <header className="mb-[1rem] flex flex-col gap-[0.1875rem]">
        <h1 className="lb-serif text-[1.625rem] leading-[1.1] text-foreground">Settings</h1>
        <p className="text-[0.8125rem] leading-[1.5] text-ink-3">
          What this app is using right now, and the two things you can change about it.
        </p>
      </header>

      {/* ---- the status strip: the question answered before it is asked ------ */}
      <section
        aria-label="Currently in use"
        className="mb-[1rem] grid grid-cols-2 gap-px overflow-hidden rounded-[var(--to-radius)] border border-[var(--to-border)] bg-[var(--to-border)] sm:grid-cols-4"
      >
        <Fact label="Model" value={model ? prettyModel(model) : "none"} tone={mode === "live" ? "ok" : "off"} />
        <Fact label="Key" value={usingOwnKey ? maskKey(settings.key) : mode === "live" ? "this deployment's" : "none"} tone={usingOwnKey || mode === "live" ? "ok" : "off"} mono={usingOwnKey} />
        <Fact label="Thinking" value={THINKING[thinking].label} tone="ok" />
        <Fact label="Work is kept" value={storage === "supabase" ? "in the cloud" : "in this browser"} tone="ok" />
      </section>

      <div className="flex flex-col gap-[0.75rem]">
        {/* ---- your model -------------------------------------------------- */}
        <Card>
          <CardTitle title="Your model">
            <span
              className={`shrink-0 rounded-[var(--to-radius-pill)] px-[0.375rem] py-[0.0625rem] text-[0.625rem] ${
                usingOwnKey
                  ? "bg-[var(--to-surface-2)] text-ink-2"
                  : "text-ink-3"
              }`}
            >
              {usingOwnKey ? "yours" : "the deployment's"}
            </span>
          </CardTitle>

          <div className="flex flex-col gap-[0.625rem] border-t border-[var(--to-border)] px-[0.75rem] py-[0.625rem]">
            <p className="text-[0.8125rem] leading-[1.55] text-ink-2">
              This deployment runs on a free key, which buys about four plans a day. Paste your
              own and every report runs on it instead — the deployment&apos;s quota stops being
              yours to spend.
            </p>

            {/* The field, at input size, with its actions beside it. */}
            <div className="flex flex-col gap-[0.375rem]">
              <label htmlFor="api-key" className="text-[0.6875rem] font-medium text-ink-2">
                API key
              </label>
              <div
                className={`flex items-center gap-[0.25rem] rounded-[0.375rem] border bg-[var(--to-bg)] px-[0.375rem] py-[0.25rem] transition-colors focus-within:border-[var(--to-border-strong)] ${
                  keyBroken ? "border-[var(--to-danger)]" : "border-[var(--to-border)]"
                }`}
              >
                <input
                  id="api-key"
                  aria-invalid={keyBroken || undefined}
                  aria-describedby={keyBroken ? "api-key-error" : undefined}
                  type={reveal ? "text" : "password"}
                  value={draft.key}
                  onChange={(event) => {
                    setDraft((d) => ({ ...d, key: event.target.value }));
                    setResult(null);
                  }}
                  placeholder="sk-ant-… or AIza…"
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="off"
                  className="min-w-0 flex-1 bg-transparent px-[0.125rem] py-[0.125rem] font-mono text-[0.8125rem] text-foreground outline-none placeholder:text-ink-3"
                />
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  aria-label={reveal ? "Hide the key" : "Show the key"}
                  aria-pressed={reveal}
                  className="shrink-0 rounded-[0.25rem] p-[0.25rem] text-ink-3 hover:bg-[var(--to-surface-2)] hover:text-foreground"
                >
                  {reveal ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
                </button>
              </div>

              {/* A wrong key is a warning, not a red field border alone. */}
              {keyBroken && (
                <p
                  id="api-key-error"
                  role="alert"
                  className="flex items-start gap-[0.3125rem] text-[0.75rem] leading-[1.5] text-[var(--to-danger)]"
                >
                  <TriangleAlert aria-hidden className="mt-[0.125rem] size-3.5 shrink-0" />
                  {checked.ok ? null : checked.reason}
                </p>
              )}

              {draft.key.trim() && checked.ok && (
                <p className="flex items-center gap-[0.3125rem] text-[0.75rem] text-ink-3">
                  <Check aria-hidden className="size-3.5 shrink-0 text-[var(--to-success)]" />
                  Looks like a{" "}
                  {checked.provider === "gemini" ? "Google AI Studio" : "Anthropic"} key.
                </p>
              )}
            </div>

            {/* Provider: inferred, but overridable, because inference can be wrong. */}
            <div className="flex flex-wrap items-center gap-[0.375rem]">
              <span className="text-[0.6875rem] text-ink-3">Provider</span>
              <div role="radiogroup" aria-label="Provider" className="flex gap-[0.25rem]">
                {(["auto", "anthropic", "gemini"] as const).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    role="radio"
                    aria-checked={draft.provider === choice}
                    onClick={() => {
                      setDraft((d) => ({ ...d, provider: choice as ProviderId | "auto" }));
                      setResult(null);
                    }}
                    className={`rounded-[var(--to-radius-pill)] border px-[0.5rem] py-[0.0625rem] text-[0.6875rem] transition-colors ${
                      draft.provider === choice
                        ? "border-[var(--to-border-strong)] bg-[var(--to-surface-2)] text-foreground"
                        : "border-[var(--to-border)] text-ink-3 hover:text-foreground"
                    }`}
                  >
                    {choice === "auto" ? "Detect" : choice === "anthropic" ? "Anthropic" : "Gemini"}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-[0.375rem] text-[0.75rem] leading-[1.5] text-ink-3">
              <input
                type="checkbox"
                checked={draft.remember}
                onChange={(event) => setDraft((d) => ({ ...d, remember: event.target.checked }))}
                className="mt-[0.1875rem] size-3 shrink-0 accent-[var(--to-accent)]"
              />
              <span>
                Remember on this device. Off, the key lives only in this tab — closing it forgets
                the key, which is what a borrowed machine wants.
              </span>
            </label>

            {/* Result of a real call, in a box that can be read at a glance. */}
            {result && (
              <p
                role="status"
                className={`flex items-start gap-[0.375rem] rounded-[0.375rem] border px-[0.5rem] py-[0.375rem] text-[0.75rem] leading-[1.5] ${
                  result.ok
                    ? "border-[var(--to-border)] text-ink-2"
                    : "border-[var(--to-danger)] text-[var(--to-danger)]"
                }`}
              >
                {result.ok ? (
                  <Check aria-hidden className="mt-[0.125rem] size-3.5 shrink-0 text-[var(--to-success)]" />
                ) : (
                  <TriangleAlert aria-hidden className="mt-[0.125rem] size-3.5 shrink-0" />
                )}
                <span>
                  {result.line}
                  {result.detail && (
                    <span className="mt-[0.125rem] block text-[0.6875rem] text-ink-3">
                      {result.detail}
                    </span>
                  )}
                </span>
              </p>
            )}

            {/* Actions, in the order they are reached for. */}
            <div className="flex flex-wrap items-center gap-[0.375rem]">
              <button
                type="button"
                onClick={test}
                disabled={testing || !checked.ok}
                className="flex items-center gap-[0.25rem] rounded-[0.375rem] border border-[var(--to-border)] px-[0.625rem] py-[0.25rem] text-[0.75rem] text-ink-2 hover:border-[var(--to-border-strong)] hover:text-foreground disabled:opacity-50"
              >
                {testing ? (
                  <Loader2 aria-hidden className="size-3.5 animate-spin" />
                ) : (
                  <Check aria-hidden className="size-3.5" />
                )}
                {testing ? "Testing…" : "Test this key"}
              </button>

              <button
                type="button"
                onClick={save}
                disabled={!dirty || (Boolean(draft.key.trim()) && !checked.ok)}
                className="flex items-center gap-[0.25rem] rounded-[0.375rem] border border-[var(--to-border-strong)] bg-[var(--to-surface-2)] px-[0.625rem] py-[0.25rem] text-[0.75rem] text-foreground hover:border-[var(--to-border-strong)] disabled:opacity-50"
              >
                {saved && <Check aria-hidden className="size-3.5" />}
                {saved ? "Saved" : "Use this key"}
              </button>

              {(settings.key || draft.key) && (
                <button
                  type="button"
                  onClick={clear}
                  className="ml-auto flex items-center gap-[0.25rem] text-[0.6875rem] text-ink-3 hover:text-[var(--to-danger)]"
                >
                  <Trash2 aria-hidden className="size-3" />
                  Forget it
                </button>
              )}
            </div>

            <p className="border-t border-[var(--to-border)] pt-[0.5rem] text-[0.6875rem] leading-[1.55] text-ink-3">
              {settings.key
                ? credentialNote(
                    (settings.provider === "anthropic" || settings.provider === "gemini"
                      ? settings.provider
                      : null) ?? "gemini"
                  )
                : `Saved keys live in this browser's storage under "${BYOK_STORAGE}". Nothing about a key is written into a report, a share link, or the server.`}
            </p>

            <KeyLinks />
          </div>
        </Card>

        {/* ---- thinking ---------------------------------------------------- */}
        <Card>
          <CardTitle title="Thinking" />

          <div className="flex flex-col gap-[0.5rem] border-t border-[var(--to-border)] px-[0.75rem] py-[0.625rem]">
            <p className="text-[0.8125rem] leading-[1.55] text-ink-2">
              How hard the model works before it answers. It reaches the model as a thinking
              budget, so this is a real cost, not a preference.
            </p>

            <div role="radiogroup" aria-label="How hard the model thinks" className="flex flex-col gap-[0.25rem]">
              {EFFORTS.map((effort) => {
                const spec = THINKING[effort];
                const active = effort === thinking;
                return (
                  <button
                    key={effort}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onThinking(effort)}
                    className={`flex items-start gap-[0.5rem] rounded-[0.375rem] border px-[0.5rem] py-[0.375rem] text-left transition-colors ${
                      active
                        ? "border-[var(--to-border-strong)] bg-[var(--to-surface-2)]"
                        : "border-[var(--to-border)] hover:bg-[var(--to-surface-2)]"
                    }`}
                  >
                    {/* A radio, drawn: filled and ringed when chosen. */}
                    <span
                      aria-hidden
                      className={`mt-[0.1875rem] flex size-3.5 shrink-0 items-center justify-center rounded-full border ${
                        active ? "border-[var(--to-accent)]" : "border-[var(--to-border-strong)]"
                      }`}
                    >
                      {active && <span className="size-[0.375rem] rounded-full bg-[var(--to-accent)]" />}
                    </span>

                    <span className="flex min-w-0 flex-1 flex-col gap-[0.0625rem]">
                      <span className="flex items-baseline gap-[0.375rem]">
                        <span className={`text-[0.8125rem] ${active ? "text-foreground" : "text-ink-2"}`}>
                          {spec.label}
                        </span>
                        <span className="lb-mono text-[0.625rem] uppercase tracking-[0.05em] text-ink-3">
                          {spec.hint} · {spec.cost}
                        </span>
                      </span>
                      <span className="text-[0.75rem] leading-[1.5] text-ink-3">{spec.detail}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-[0.6875rem] leading-[1.55] text-ink-3">
              {mode === "live" && model && !/gemini/i.test(model)
                ? "Claude does not expose a thinking level here, so this changes how the report is read, not how hard the model reasons."
                : "Holding the send button climbs from here for a single run; letting go sends at that level."}
            </p>
          </div>
        </Card>

        {/* ---- connectors -------------------------------------------------- */}
        <Card>
          <CardTitle title="Connectors">
            <span className="shrink-0 text-[0.6875rem] text-ink-3">
              {connectors.filter((c) => c.on).length} of {connectors.length} on
            </span>
          </CardTitle>

          <ConnectorList connectors={connectors} />

          {/* One sentence about storage, which no connector row can say: it is
              about the reports, not about the connection. */}
          <p className="border-t border-[var(--to-border)] px-[0.75rem] py-[0.5rem] text-[0.6875rem] leading-[1.55] text-ink-3">
            {storage === "supabase"
              ? "Supabase is on, so a report you choose to keep is stored on the server and reachable from another device."
              : "Supabase is off in this deployment, so nothing you paste leaves this browser — reports live here until you clear them."}
          </p>
        </Card>
      </div>

      <p className="mt-[1rem] px-[0.25rem] text-[0.625rem] leading-[1.5] text-ink-3">
        Components from{" "}
        <a
          href="https://www.rareui.com"
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Rare UI
        </a>
      </p>
    </div>
  );
}

/** One fact about the current state, with no control on it. */
function Fact({
  label,
  value,
  tone,
  mono,
}: {
  label: string;
  value: string;
  tone: "ok" | "off";
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-[0.0625rem] bg-[var(--to-surface)] px-[0.625rem] py-[0.4375rem]">
      <span className="lb-mono text-[0.5625rem] uppercase tracking-[0.06em] text-ink-3">
        {label}
      </span>
      <span
        className={`truncate text-[0.75rem] ${tone === "ok" ? "text-ink-2" : "text-ink-3"} ${
          mono ? "font-mono" : ""
        }`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

/** `gemini-3.8-flash` reads better as `Gemini 3.8 Flash`. */
function prettyModel(model: string): string {
  return model
    .split("-")
    .map((part) =>
      /^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join(" ");
}

/** Where a key comes from, and what it costs — one click each, no scavenger hunt. */
function KeyLinks() {
  const links = [
    { label: "Get a free Gemini key", href: "https://aistudio.google.com/apikey" },
    { label: "Anthropic API keys", href: "https://console.anthropic.com/settings/keys" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-[0.75rem] gap-y-[0.125rem]">
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-[0.1875rem] text-[0.6875rem] text-ink-3 hover:text-foreground"
          >
            <ChevronRight aria-hidden className="size-3 shrink-0" />
            {link.label}
            <ExternalLink aria-hidden className="size-2.5 shrink-0 opacity-60" />
          </a>
        </li>
      ))}
    </ul>
  );
}
