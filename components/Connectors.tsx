"use client";

import { useEffect, useState } from "react";
import { markFor, markForProvider, type MarkName } from "@/components/icons/marks";

/**
 * A connection, as a fact rather than a claim.
 *
 * `on` is what lights the dot, and it must come from something the app can
 * actually observe — the repo link it ships, the host it is served from, a key
 * the server reported. A row that guesses is worse than a row that is grey.
 */
export type Connector = {
  id: string;
  /** What it is: GitHub, Supabase, Gemini… */
  label: string;
  /** What role it plays here — source, hosting, model, storage. Shown as the
   *  row's title so the detail column stays free for the concrete value. */
  role: string;
  /** The concrete detail — a repo, a host, a model name, "this device". */
  detail: string;
  on: boolean;
  /** Optional mark override; otherwise derived from `id`. */
  mark?: MarkName;
};

/**
 * The connectors card, in the reference's shape: one row per connection, a mark,
 * a name, a detail, and a dot that is lit only when the connection is real.
 *
 * It is a plain list so it can be used anywhere — the right rail today, an
 * about page or a settings sheet tomorrow. Nothing here reads the network; the
 * caller passes what it knows.
 */
export function ConnectorList({
  connectors,
  note = "Connected apps are read from the server, not assumed.",
  className = "",
}: {
  connectors: Connector[];
  note?: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <ul className="border-t border-[var(--to-border)] py-[0.1875rem]">
        {connectors.map((connector) => {
          const Mark = markFor(connector.mark ?? markForProvider(connector.id));
          return (
            <li
              key={connector.id}
              title={connector.role}
              className="flex items-center gap-[0.5rem] px-[0.625rem] py-[0.3125rem]"
            >
              <span className="flex size-4 shrink-0 items-center justify-center text-ink-2">
                <Mark size={14} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-2">
                {connector.label}
              </span>
              {/* The detail is the fact; the role is the caption. Two lines would
                  make four connectors taller than the card above them. */}
              <span className="shrink-0 text-right">
                <span className="block text-[0.6875rem] leading-[1.3] text-ink-2">
                  {connector.detail}
                </span>
                <span className="block text-[0.5625rem] leading-[1.3] text-ink-3">
                  {connector.role}
                </span>
              </span>
              <span
                aria-label={connector.on ? `${connector.label} connected` : `${connector.label} not connected`}
                title={connector.on ? `${connector.label} connected` : `${connector.label} not connected`}
                className={`size-[0.375rem] shrink-0 rounded-full ${
                  connector.on ? "bg-[var(--to-success)]" : "border border-[var(--to-border-strong)]"
                }`}
              />
            </li>
          );
        })}
      </ul>

      {note && (
        <p className="border-t border-[var(--to-border)] px-[0.625rem] py-[0.3125rem] text-[0.6875rem] leading-[1.4] text-ink-3">
          {note}
        </p>
      )}
    </div>
  );
}

/**
 * The list as this app can honestly fill it: the repo it ships, the host it is
 * served from, and whatever `/api/health` reported.
 */
export function useConnectors({
  mode,
  model,
  storage,
}: {
  mode: "demo" | "live" | null;
  model: string | null;
  storage: string | null;
}): Connector[] {
  // Read after mount, so the server's HTML and the client's first render agree.
  const [host, setHost] = useState<string | null>(null);
  useEffect(() => setHost(window.location.hostname), []);

  const onVercel = Boolean(host && /(^|\.)vercel\.app$/.test(host));
  const localStore = !storage || storage === "local";

  return [
    {
      id: "github",
      label: "GitHub",
      role: "source",
      detail: "Load-Bearing.",
      on: true,
    },
    {
      id: "vercel",
      label: "Vercel",
      role: "hosting",
      detail: onVercel ? "vercel.app" : (host ?? "—"),
      on: onVercel,
    },
    {
      id: "gemini",
      label: model ? titleCase(model) : "Model",
      role: "model",
      detail: mode === "live" ? "live" : mode === "demo" ? "no key" : "not checked",
      on: mode === "live",
      mark: markForProvider(model),
    },
    {
      id: "supabase",
      label: localStore ? "Storage" : titleCase(storage!),
      role: "storage",
      detail: localStore ? "this device" : (storage ?? "not checked"),
      on: !localStore,
      mark: markForProvider(storage),
    },
  ];
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
