/**
 * A rate limit for the endpoints that spend money.
 *
 * The expensive route here is `/api/analyze`: one call runs five model passes.
 * Without a limit, one script can empty the deployment's daily quota in a
 * minute, which is a denial of service against every real visitor.
 *
 * Scope, stated plainly because it bounds what this protects:
 *
 *  - **Memory only.** A serverless instance is not shared, so each instance gets
 *    its own counters, and a cold start forgets them. This throttles a single
 *    instance being hammered; it does not enforce a global budget. A global
 *    limit needs shared state (Supabase), and this deployment has none.
 *  - **Keyed on the caller, not the account.** There are no accounts. The key is
 *    a hash of forwarded-for plus user-agent, so a rotating IP with a stable UA
 *    still accumulates.
 *
 * What makes this honest: a visitor who brings their own key is billed to
 * themselves, so they get a much wider limit than someone spending the shared
 * one. That is the right shape — the limit exists to protect the shared quota,
 * not to ration analysis.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Stop the map growing without bound on a long-lived instance. */
const MAX_KEYS = 5_000;

export type LimitVerdict = {
  ok: boolean;
  /** Whole seconds until the window resets. */
  retryAfter: number;
  remaining: number;
  limit: number;
};

/**
 * A stable, non-identifying key for this caller.
 *
 * Hashed so the map never holds an IP address in the clear, which matters if a
 * future debugging path ever prints it.
 */
export function callerKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const address = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const agent = request.headers.get("user-agent") ?? "";
  // FNV-1a: enough to separate callers, cheap enough to run per request.
  let hash = 0x811c9dc5;
  for (const char of `${address}|${agent}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Count this hit and say whether it is allowed.
 *
 * `limit` is the whole budget per window; `windowMs` defaults to an hour, which
 * matches how the model provider meters the day.
 */
export function take(
  key: string,
  { limit, windowMs = 60 * 60 * 1000 }: { limit: number; windowMs?: number }
): LimitVerdict {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  if (bucket.count >= limit) {
    return { ok: false, retryAfter, remaining: 0, limit };
  }

  bucket.count += 1;

  if (buckets.size > MAX_KEYS) {
    // Drop everything already expired before touching live buckets.
    for (const [id, value] of buckets) if (value.resetAt <= now) buckets.delete(id);
  }

  return { ok: true, retryAfter, remaining: limit - bucket.count, limit };
}

/** Header set on a limited response, so a client can behave. */
export function limitHeaders(verdict: LimitVerdict): Record<string, string> {
  return {
    "Retry-After": String(verdict.retryAfter),
    "X-RateLimit-Limit": String(verdict.limit),
    "X-RateLimit-Remaining": String(verdict.remaining),
  };
}
