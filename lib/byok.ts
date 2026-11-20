/**
 * Bring your own model key.
 *
 * The deployment's key is the operator's, and it has a budget: on the free tier
 * that is twenty requests a day, which the five-pass pipeline spends in about
 * four plans. So a visitor who wants to use this properly brings their own key.
 *
 * What happens to it:
 *   - it is stored in this browser's localStorage, under this app's prefix;
 *   - it is mirrored into a same-site cookie so the server can use it if it ever
 *     needs to (it does not persist it either way);
 *   - it travels on each request as `x-llm-key` and is used for that request
 *     only. No route writes it to storage, to a log, or to a report.
 *
 * What must never happen: a key in a share link, a key in an exported report, a
 * key echoed back by an API. The three functions at the bottom of this file are
 * what the UI uses to keep that true.
 */

export const BYOK_STORAGE = "load-bearing:llm";

export type ProviderId = "anthropic" | "gemini";

export type Credential = {
  provider: ProviderId;
  key: string;
};

/** What the settings form holds: a chosen provider, or "auto" to infer one. */
export type LlmSettings = {
  provider: ProviderId | "auto";
  key: string;
  /** Remember on this device. Off means it lives for the tab only. */
  remember: boolean;
};

export const EMPTY_SETTINGS: LlmSettings = { provider: "auto", key: "", remember: true };

/** Key shapes, as the providers themselves issue them. */
const SHAPES: { provider: ProviderId; label: string; pattern: RegExp; example: string }[] = [
  {
    provider: "anthropic",
    label: "Anthropic",
    pattern: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
    example: "sk-ant-api03-…",
  },
  {
    provider: "gemini",
    label: "Google Gemini",
    pattern: /^AIza[A-Za-z0-9_-]{30,}$/,
    example: "AIza…",
  },
];

/**
 * Guess the provider from the key itself, because that is the one fact a person
 * pasting a key should not have to look up twice.
 */
export function inferProvider(key: string): ProviderId | null {
  const trimmed = key.trim();
  if (!trimmed) return null;
  for (const shape of SHAPES) if (shape.pattern.test(trimmed)) return shape.provider;
  // Known prefixes with the wrong length are still a better guess than nothing.
  if (trimmed.startsWith("sk-ant-")) return "anthropic";
  if (trimmed.startsWith("AIza")) return "gemini";
  return null;
}

export type KeyCheck =
  | { ok: true; provider: ProviderId; credential: Credential }
  | { ok: false; reason: string };

/**
 * Validate what was typed, without ever printing the key back.
 *
 * The check is deliberately shape-based and not a live call: a paste that is
 * obviously wrong (whitespace in the middle, six characters, a URL) should not
 * cost a request to find out.
 */
export function checkKey(settings: LlmSettings): KeyCheck {
  const key = settings.key.trim();

  if (!key) return { ok: false, reason: "Paste a key first." };
  if (/\s/.test(key)) return { ok: false, reason: "A key has no spaces in it — check for a line break in the paste." };
  if (/^https?:\/\//i.test(key)) return { ok: false, reason: "That is a URL, not a key." };
  if (key.length < 20) return { ok: false, reason: "That looks too short to be a key." };

  const inferred = inferProvider(key);
  if (!inferred) {
    return {
      ok: false,
      reason:
        "That does not look like an Anthropic key (sk-ant-…) or a Google AI Studio key (AIza…). Check the paste, or pick the provider below.",
    };
  }

  if (settings.provider !== "auto" && settings.provider !== inferred) {
    const named = SHAPES.find((s) => s.provider === settings.provider)?.label ?? settings.provider;
    const looks = SHAPES.find((s) => s.provider === inferred)?.label ?? inferred;
    return {
      ok: false,
      reason: `You picked ${named}, but that key looks like a ${looks} key.`,
    };
  }

  return { ok: true, provider: inferred, credential: { provider: inferred, key } };
}

/**
 * What the settings sheet says about where a key lives. One sentence, because
 * the honest answer is short: it does not leave this browser except to make the
 * request you asked for.
 */
export function credentialNote(provider: ProviderId): string {
  return `Requests run on your own ${provider === "gemini" ? "Google AI Studio" : "Anthropic"} key. It stays in this browser and is sent only to make the request you asked for — it is never stored on the server, never put in a shared link, and never written into a report.`;
}

/** `sk-ant-api03-abc…xyz9` — enough to recognise a key, not enough to use it. */
export function maskKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 10) return "…";
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-4)}`;
}

/** The credential to send, or null when the visitor is using the deployment's. */
export function activeCredential(settings: LlmSettings): Credential | null {
  const checked = checkKey(settings);
  return checked.ok ? checked.credential : null;
}

/**
 * Headers for a request that should use the visitor's key. The server treats a
 * missing header as "use the deployment's own".
 */
export function llmHeaders(settings: LlmSettings): Record<string, string> {
  const checked = checkKey(settings);
  if (!checked.ok) return {};
  return { "x-llm-provider": checked.provider, "x-llm-key": checked.credential.key };
}

// ---- storage ---------------------------------------------------------------

export function readSettings(): LlmSettings {
  if (typeof window === "undefined") return EMPTY_SETTINGS;
  try {
    const raw = window.localStorage.getItem(BYOK_STORAGE);
    if (!raw) return EMPTY_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<LlmSettings>;
    return {
      provider: parsed.provider === "anthropic" || parsed.provider === "gemini" ? parsed.provider : "auto",
      key: typeof parsed.key === "string" ? parsed.key : "",
      remember: parsed.remember !== false,
    };
  } catch {
    return EMPTY_SETTINGS;
  }
}

/**
 * Save, and keep the cookie in step.
 *
 * A remembered key goes to localStorage; a forgotten one is removed from it and
 * survives only in React state for as long as the tab does. Either way the
 * cookie carries the key for the current session only, which is what the server
 * would read if a request ever arrived without the header.
 */
export function writeSettings(settings: LlmSettings): void {
  if (typeof window === "undefined") return;
  try {
    if (settings.remember && settings.key.trim()) {
      window.localStorage.setItem(BYOK_STORAGE, JSON.stringify({ ...settings, key: settings.key.trim() }));
    } else {
      window.localStorage.removeItem(BYOK_STORAGE);
    }

    const value = settings.key.trim();
    if (value) {
      // Session cookie, SameSite=Strict, Secure on https: it dies with the tab
      // and is never sent from another site.
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `lb_llm=${encodeURIComponent(value)}; path=/; SameSite=Strict${secure}`;
    } else {
      document.cookie = "lb_llm=; path=/; max-age=0; SameSite=Strict";
    }
  } catch {
    // Private mode, a full disk, a blocked cookie: none of it is worth a dialog.
    // The key still works for this page's requests, held in memory.
  }
}

export function clearSettings(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(BYOK_STORAGE);
  } catch {
    // nothing to clear
  }
  document.cookie = "lb_llm=; path=/; max-age=0; SameSite=Strict";
}
