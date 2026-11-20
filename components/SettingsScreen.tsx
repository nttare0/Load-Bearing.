"use client";

import { useEffect, useState } from "react";
import { SettingsPage } from "@/components/SettingsPage";
import { readSettings, llmHeaders, writeSettings, type LlmSettings, type LlmSettings as Settings } from "@/lib/byok";
import { DEFAULT_EFFORT, isEffort, type Effort } from "@/lib/effort";

/**
 * The client half of `/settings`.
 *
 * Everything on the settings page is per-browser — the model key, the thinking
 * level, and the health figures that depend on the key — so the page needs no
 * server render to be correct. It does need the same storage keys the workspace
 * uses, which is the whole reason this wrapper exists rather than copying the
 * load/save logic into the route.
 *
 * Values are read after mount, on purpose: the server's HTML and the client's
 * first render must agree, and localStorage is not available to one of them.
 */
const LS_THINKING = "load-bearing:thinking";

export function SettingsScreen() {
  const [llm, setLlm] = useState<LlmSettings>({ provider: "auto", key: "", remember: true });
  const [thinking, setThinking] = useState<Effort>(DEFAULT_EFFORT);
  const [mode, setMode] = useState<"demo" | "live" | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [storage, setStorage] = useState<string | null>(null);

  useEffect(() => {
    const saved = readSettings();
    setLlm(saved);

    const level = window.localStorage.getItem(LS_THINKING);
    if (isEffort(level)) setThinking(level);

    // Ask with whatever credential this browser holds, so the answer is about
    // the key that will actually be used — not the deployment's.
    fetch("/api/settings", { headers: llmHeaders(saved) })
      .then((r) => r.json())
      .then((data: { ai?: "configured" | "demo"; provider?: string | null; model?: string | null; storage?: string | null }) => {
        setMode(data.ai === "configured" ? "live" : "demo");
        setModel(data.model ?? data.provider ?? null);
        setStorage(data.storage ?? null);
      })
      .catch(() => setMode(null));
  }, []);

  const saveLlm = (next: Settings) => {
    setLlm(next);
    writeSettings(next);
    fetch("/api/settings", { headers: llmHeaders(next) })
      .then((r) => r.json())
      .then((data: { ai?: "configured" | "demo"; model?: string | null; provider?: string | null }) => {
        setMode(data.ai === "configured" ? "live" : "demo");
        setModel(data.model ?? data.provider ?? null);
      })
      .catch(() => undefined);
  };

  const chooseThinking = (effort: Effort) => {
    setThinking(effort);
    try {
      window.localStorage.setItem(LS_THINKING, effort);
    } catch {
      // A preference that cannot be saved is still a preference for this tab.
    }
  };

  return (
    <main className="min-h-dvh">
      <SettingsPage
        settings={llm}
        onChange={saveLlm}
        mode={mode}
        model={model}
        storage={storage}
        thinking={thinking}
        onThinking={chooseThinking}
      />
    </main>
  );
}
