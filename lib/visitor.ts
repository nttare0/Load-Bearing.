import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Whose key a request runs on.
 *
 * The five passes read their provider and key from the environment. That is
 * correct for the deployment's own key and useless for a visitor's, so the key
 * a visitor brought arrives on the request (`x-llm-key`, or the `lb_llm`
 * cookie) and is parked here for the life of that request. `lib/ai` and
 * `lib/gemini` ask this store before they ask the environment.
 *
 * Why a store rather than threading a parameter through: the pipeline makes
 * five calls across four modules, and every one of them would otherwise need to
 * learn about a feature that is not theirs. A request-scoped store keeps the
 * knowledge in one file and makes "no credential" the default everywhere else.
 *
 * The key is never logged, never stored, and never included in a response.
 */

export type VisitorCredential = {
  provider: "anthropic" | "gemini";
  key: string;
};

type Store = { credential: VisitorCredential | null };

const store = new AsyncLocalStorage<Store>();

/** Run `fn` with this request's credential visible to every model call inside it. */
export function withVisitor<T>(credential: VisitorCredential | null, fn: () => T): T {
  return store.run({ credential }, fn);
}

/** The visitor's credential, if this request is running on one. */
export function visitorCredential(): VisitorCredential | null {
  return store.getStore()?.credential ?? null;
}

/** Same key shapes the browser checks for; a bad header is ignored, not trusted. */
const SHAPES: { provider: VisitorCredential["provider"]; pattern: RegExp }[] = [
  { provider: "anthropic", pattern: /^sk-ant-[A-Za-z0-9_-]{20,}$/ },
  { provider: "gemini", pattern: /^AIza[A-Za-z0-9_-]{30,}$/ },
];

function infer(key: string): VisitorCredential["provider"] | null {
  for (const shape of SHAPES) if (shape.pattern.test(key)) return shape.provider;
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("AIza")) return "gemini";
  return null;
}

/**
 * Read the credential a request carries, and refuse anything malformed.
 *
 * Returns `{ credential }` for a usable key, `{ credential: null }` when the
 * request says nothing (the deployment's own key applies), and `{ error }` when
 * a key was sent but is not a key — because quietly falling back to the
 * deployment's key would spend the operator's budget on a request the visitor
 * meant to pay for.
 */
export function credentialFrom(request: Request): {
  credential: VisitorCredential | null;
  error?: string;
} {
  const header = request.headers.get("x-llm-key")?.trim() ?? "";
  const cookie = readCookie(request.headers.get("cookie") ?? "", "lb_llm");
  const key = header || cookie;

  if (!key) return { credential: null };

  if (/\s/.test(key) || key.length < 20) {
    return { credential: null, error: "That key looks malformed. Paste it again in Settings." };
  }

  const inferred = infer(key);
  if (!inferred) {
    return {
      credential: null,
      error: "That key is not an Anthropic (sk-ant-…) or Google AI Studio (AIza…) key.",
    };
  }

  const claimed = request.headers.get("x-llm-provider");
  if (claimed && claimed !== inferred) {
    return {
      credential: null,
      error: `The key you sent is a ${inferred} key, but it was labelled ${claimed}.`,
    };
  }

  return { credential: { provider: inferred, key } };
}

function readCookie(header: string, name: string): string {
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return "";
      }
    }
  }
  return "";
}
