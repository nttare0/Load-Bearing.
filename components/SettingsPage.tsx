"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Brain, Check, ChevronRight, ExternalLink, Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import { ConnectorList, useConnectors } from "@/components/Connectors";
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
 * It used to be a sheet laid over the right rail — `absolute inset-0` inside a
 * 240px column — which is a strange thing for the one screen that holds every
 * preference in the app: it could only ever be as wide as the panel it covered,
 * and it made "settings" feel like a drawer in a drawer.
 *
 * It is a route now (`/settings`), with the same three cards, and a page-width
 * measure so a key field can be read without scrolling sideways.
 *
 * Three cards, in the order the questions arrive:
 *
 * 1. **Your model** — whose key this runs on. The deployment's key is on a free
 *    tier of twenty requests a day, which the five passes spend in about four
 *    plans, so a person who wants to use this properly brings their own. The
 *    field checks the shape of what you paste, then offers to test it for real,
 *    because a shape check proves the paste and only a call proves the key.
 *
 * 2. **Connectors** — the same four facts the rail shows, spelled out: what
 *    hosts this, where the code lives, which model answers, and where your work
 *    is kept. Not decoration: each one links to the thing it names.
 *
 * and, first, **Thinking**, which lives here and nowhere else.
 *
 * A key never appears in full after it is saved, is never in a URL, and is never
 * sent anywhere but the deployment itself.
 */

const CARD = "rounded-[0.5rem] border border-[var(--to-border)]";
const HEAD_ROW = "flex h-[1.875rem] items-center gap-[0.25rem] px-[0.625rem]";

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
  /** How hard the model is asked to think on the next run. */
  thinking: Effort;
  onThinking: (effort: Effort) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [reveal, setReveal] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [saved, setSaved] = useState(false);

  const checked = checkKey(draft);
  const dirty = draft.key !== settings.key || draft.provider !== settings.provider || draft.remember !== settings.remember;

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
          line: `The key works${data.model ? ` — ${data.model} answered` : ""}${data.ms ? ` in ${(data.ms / 1000).toFixed(1)}s` : ""}.`,
          detail: data.note ?? undefined,
        });
      } else {
        setResult({ ok: false, line: data.reason ?? "That key did not work.", detail: data.note ?? undefined });
      }
    } catch {
      setResult({ ok: false, line: "The check itself failed to send. Try again." });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[34rem] flex-col px-[1rem] pb-[2rem] pt-[1rem]">
      <Link
        href="/"
        className="mb-[0.5rem] flex w-fit items-center gap-[0.25rem] text-[0.75rem] text-ink-3 hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-3.5" />
        Back to the workspace
      </Link>

      <header className="mb-[0.75rem] flex flex-col gap-[0.125rem]">
        <h1 className="text-[1.0625rem] font-medium text-foreground">Settings</h1>
        <p className="text-[0.75rem] text-ink-3">Kept in this browser, except the keys you paste.</p>
      </header>

      <div className="flex flex-col gap-[0.5rem]">
        {/* ---- how hard it thinks ---------------------------------------- */}
        <section className={CARD}>
          <div className={HEAD_ROW}>
            <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-2">Thinking</span>
            <span className="flex shrink-0 items-center gap-[0.1875rem] text-[0.625rem] text-ink-3">
              <Brain aria-hidden className="size-3" />
              {THINKING[thinking].hint}
            </span>
          </div>

          <div
            role="radiogroup"
            aria-label="How hard the model thinks"
            className="flex gap-[0.25rem] border-t border-[var(--to-border)] p-[0.25rem]"
          >
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
                  title={spec.detail}
                  className={`flex flex-1 flex-col items-center gap-[0.0625rem] rounded-[0.375rem] border px-[0.25rem] py-[0.25rem] transition-colors ${
                    active
                      ? "border-[var(--to-border-strong)] bg-[var(--to-surface-2)] text-foreground"
                      : "border-transparent text-ink-3 hover:bg-[var(--to-surface-2)] hover:text-foreground"
                  }`}
                >
                  <span className="text-[0.75rem]">{spec.label}</span>
                  <span className="text-[0.5625rem] uppercase tracking-[0.04em] text-ink-3">
                    {spec.cost}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="border-t border-[var(--to-border)] px-[0.625rem] py-[0.375rem] text-[0.6875rem] leading-[1.5] text-ink-3">
            {mode === "live" && model && !/gemini/i.test(model)
              ? "Claude does not expose a thinking level here, so this changes the reading, not the reasoning."
              : `${THINKING[thinking].detail} Holding the send button climbs from here for one run.`}
          </p>
        </section>

        {/* ---- your model ------------------------------------------------ */}
        <section className={CARD}>
          <div className={HEAD_ROW}>
            <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-2">Your model</span>
            <span className="shrink-0 text-[0.6875rem] text-ink-3">
              {settings.key ? "your key" : mode === "live" ? "the deployment's" : "none"}
            </span>
          </div>

          <div className="flex flex-col gap-[0.4375rem] border-t border-[var(--to-border)] px-[0.625rem] py-[0.5rem]">
            <p className="text-[0.75rem] leading-[1.5] text-ink-3">
              This deployment runs on a free key, which buys about four plans a day. Paste your
              own and the reports run on it instead.
            </p>

            <label className="flex flex-col gap-[0.25rem]">
              <span className="text-[0.6875rem] uppercase tracking-[0.04em] text-ink-3">API key</span>
              <span className="flex items-center gap-[0.25rem]">
                <input
                  type={reveal ? "text" : "password"}
                  value={draft.key}
                  onChange={(event) => {
                    setDraft((d) => ({ ...d, key: event.target.value }));
                    setResult(null);
                  }}
                  placeholder="sk-ant-… or AIza…"
                  aria-label="API key"
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="off"
                  className="min-w-0 flex-1 rounded-[0.25rem] border border-[var(--to-border)] bg-transparent px-[0.375rem] py-[0.1875rem] font-mono text-[0.75rem] outline-none focus:border-[var(--to-border-strong)]"
                />
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  aria-label={reveal ? "Hide the key" : "Show the key"}
                  aria-pressed={reveal}
                  className="shrink-0 rounded-[0.25rem] p-[0.1875rem] text-ink-3 hover:bg-[var(--to-surface-2)] hover:text-foreground"
                >
                  {reveal ? <EyeOff aria-hidden className="size-3.5" /> : <Eye aria-hidden className="size-3.5" />}
                </button>
              </span>
            </label>

            {/* Provider: inferred from the key unless you say otherwise. */}
            <div className="flex flex-col gap-[0.25rem]">
              <span className="text-[0.6875rem] uppercase tracking-[0.04em] text-ink-3">Provider</span>
              <div role="radiogroup" aria-label="Provider" className="flex gap-[0.25rem]">
                {(["auto", "anthropic", "gemini"] as const).map((choice) => (
                  <Choice
                    key={choice}
                    label={choice === "auto" ? "Auto" : choice === "anthropic" ? "Anthropic" : "Gemini"}
                    active={draft.provider === choice}
                    onSelect={() => {
                      setDraft((d) => ({ ...d, provider: choice as ProviderId | "auto" }));
                      setResult(null);
                    }}
                  />
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
                the key, and a shared or borrowed machine never keeps it.
              </span>
            </label>

            {draft.key.trim() && !checked.ok && (
              <p className="text-[0.75rem] leading-[1.5] text-[var(--to-warning)]">{checked.reason}</p>
            )}

            {result && (
              <p
                className={`text-[0.75rem] leading-[1.5] ${
                  result.ok ? "text-[var(--to-success)]" : "text-[var(--to-danger)]"
                }`}
                role="status"
              >
                {result.line}
                {result.detail && <span className="mt-[0.125rem] block text-[0.6875rem] text-ink-3">{result.detail}</span>}
              </p>
            )}

            <div className="flex items-center gap-[0.375rem]">
              <button
                type="button"
                onClick={test}
                disabled={testing || !checked.ok}
                className="flex items-center gap-[0.25rem] rounded-[0.25rem] border border-[var(--to-border)] px-[0.375rem] py-[0.125rem] text-[0.75rem] text-ink-2 hover:bg-[var(--to-surface-2)] hover:text-foreground disabled:opacity-50"
              >
                {testing ? <Loader2 aria-hidden className="size-3 animate-spin" /> : <Check aria-hidden className="size-3" />}
                {testing ? "Testing…" : "Test this key"}
              </button>

              <button
                type="button"
                onClick={save}
                disabled={!dirty || (Boolean(draft.key.trim()) && !checked.ok)}
                className="flex items-center gap-[0.25rem] rounded-[0.25rem] border border-[var(--to-border)] bg-[var(--to-surface-2)] px-[0.375rem] py-[0.125rem] text-[0.75rem] text-foreground hover:border-[var(--to-border-strong)] disabled:opacity-50"
              >
                {saved ? <Check aria-hidden className="size-3" /> : null}
                {saved ? "Saved" : "Use this key"}
              </button>

              {(settings.key || draft.key) && (
                <button
                  type="button"
                  onClick={clear}
                  className="ml-auto flex items-center gap-[0.25rem] text-[0.6875rem] text-ink-3 hover:text-[var(--to-danger)]"
                >
                  <Trash2 aria-hidden className="size-3" />
                  Forget
                </button>
              )}
            </div>

            {/* What is stored, said plainly, with the count of places it isn't. */}
            <p className="text-[0.6875rem] leading-[1.5] text-ink-3">
              {settings.key
                ? credentialNote((checkKey(settings) as { provider?: ProviderId })?.provider ?? "gemini")
                : `Saved keys live in this browser's storage, under "${BYOK_STORAGE}". Nothing about a key is written into a report, a share link, or the server.`}
            </p>

            {settings.key && (
              <p className="flex items-center gap-[0.25rem] text-[0.6875rem] text-ink-3">
                <Check aria-hidden className="size-3 shrink-0 text-[var(--to-success)]" />
                In use: <span className="font-mono">{maskKey(settings.key)}</span>
              </p>
            )}

            <KeyLinks />
          </div>
        </section>

        {/* ---- connectors ------------------------------------------------- */}
        <section className={CARD}>
          <div className={HEAD_ROW}>
            <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-2">Connectors</span>
            <span className="shrink-0 text-[0.6875rem] text-ink-3">
              {connectors.filter((c) => c.on).length} on
            </span>
          </div>
          <ConnectorList connectors={connectors} />
          <div className="flex flex-col gap-[0.1875rem] border-t border-[var(--to-border)] px-[0.625rem] py-[0.375rem]">
            {connectors.map((connector) => (
              <p key={connector.id} className="text-[0.6875rem] leading-[1.5] text-ink-3">
                <span className="text-ink-2">{connector.label}</span> —{" "}
                {connector.role === "source"
                  ? "the code this runs from."
                  : connector.role === "hosting"
                    ? connector.on
                      ? "serving this page."
                      : "not the host — this is running somewhere else."
                    : connector.role === "model"
                      ? connector.on
                        ? "answering the five passes."
                        : "no key, so analysis runs on the built-in example."
                      : connector.on
                        ? "storing your reports."
                        : "reports are kept in this browser, not on a server."}
              </p>
            ))}
            <p className="pt-[0.125rem] text-[0.6875rem] leading-[1.5] text-ink-3">
              Supabase is off in this deployment, so nothing you paste leaves this device.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Choice({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={`flex-1 rounded-[0.25rem] border px-[0.25rem] py-[0.125rem] text-[0.75rem] transition-colors ${
        active
          ? "border-[var(--to-border-strong)] bg-[var(--to-surface-2)] text-foreground"
          : "border-[var(--to-border)] text-ink-3 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

/** Where a key comes from, and what it costs — one click each, no scavenger hunt. */
function KeyLinks() {
  const links = [
    { label: "Google AI Studio (free tier)", href: "https://aistudio.google.com/apikey" },
    { label: "Anthropic console", href: "https://console.anthropic.com/settings/keys" },
  ];
  return (
    <ul className="flex flex-col gap-[0.125rem] border-t border-[var(--to-border)] pt-[0.375rem]">
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-[0.25rem] text-[0.6875rem] text-ink-3 hover:text-foreground"
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
