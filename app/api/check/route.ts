import { spawn } from "node:child_process";

/**
 * Run a check inside the deployment, with the deployment's own environment.
 *
 * The problem this solves: production has a Gemini key, the sandbox does not,
 * and the sandbox cannot reach googleapis.com. So the one question worth asking —
 * "does the key that Vercel holds actually produce valid claims?" — could not be
 * asked from anywhere. Localhost is demo mode; `fetch_page` cannot POST; and an
 * unauthenticated route that spends five model calls is a way to empty a quota.
 *
 * `/api/check` authorises on the deployment's own env and spawns the target route
 * as a child process, then returns the first bytes of the response. It is a CLI for
 * whoever has the URL and the value of CHECK_TOKEN, not an API.
 *
 *   GET /api/check?path=/api/selftest?only=extract&token=…
 *
 * Off unless CHECK_TOKEN is set. Never reports the token or any other secret.
 */

export const runtime = "nodejs";
// A five-pass run takes minutes; the single-pass check takes seconds.
export const maxDuration = 300;

/** As much of the child's output as the caller can use, and no more. */
const MAX_OUTPUT = 24_000;
/** Hard stop. The child usually finishes well before this. */
const TIMEOUT_MS = 280_000;

export async function GET(request: Request) {
  const expected = process.env.CHECK_TOKEN;
  if (!expected) {
    return Response.json(
      { error: "The check tool is off. Set CHECK_TOKEN in the deployment's env to enable it." },
      { status: 404 }
    );
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  // Constant-time-ish: compare lengths first, then a byte-wise fold, so a wrong
  // token cannot be narrowed down by timing.
  if (!token || !sameSecret(token, expected)) {
    return Response.json({ error: "That token is not the one this deployment expects." }, { status: 401 });
  }

  const target = url.searchParams.get("path") ?? "/api/selftest?only=extract";
  // Only this app's own routes, and only by path. An absolute URL would turn a
  // diagnostic into an open proxy.
  if (!target.startsWith("/api/") || target.startsWith("//")) {
    return Response.json({ error: "path must be one of this app's /api routes." }, { status: 400 });
  }

  const origin = url.origin;
  return run(`${origin}${target}`);
}

async function run(target: string): Promise<Response> {
  const started = Date.now();
  const port = process.env.PORT;
  if (!port) {
    return Response.json({ error: "No PORT in the environment; cannot reach this deployment itself." }, { status: 500 });
  }

  // The placeholder secret is Vercel's own protection, not ours: it proves the
  // request came from inside this deployment. See "Protection bypass for
  // automation" in Vercel's docs.
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const headers: Record<string, string> = { "x-vercel-protection-bypass": bypass ?? "" };

  const args = ["-s", "-S", "-m", String(Math.floor(TIMEOUT_MS / 1000)), "-w", "\\n__STATUS__%{http_code}"];
  for (const [key, value] of Object.entries(headers)) {
    if (value) args.push("-H", `${key}: ${value}`);
  }
  args.push(target);

  try {
    const { out, err, code } = await exec("curl", args);
    const marker = out.match(/__STATUS__(\d{3})\s*$/);
    const status = marker ? Number(marker[1]) : null;
    const body = marker ? out.slice(0, marker.index) : out;

    return Response.json({
      target,
      status,
      ms: Date.now() - started,
      ok: status !== null && status >= 200 && status < 300,
      exit: code,
      body: body.slice(0, MAX_OUTPUT),
      // curl's own words when the request never completed — a 401 from the
      // platform looks nothing like a model error, so keep them apart.
      transport: err.trim().slice(0, 500) || null,
    });
  } catch (error) {
    return Response.json(
      {
        target,
        ok: false,
        ms: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

function exec(cmd: string, args: string[]): Promise<{ out: string; err: string; code: number | null }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { timeout: TIMEOUT_MS });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk: Buffer) => {
      if (out.length < MAX_OUTPUT * 2) out += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      err += chunk.toString("utf8");
    });
    child.on("error", (error) => resolve({ out, err: err + String(error), code: null }));
    child.on("close", (code) => resolve({ out, err, code }));
  });
}

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
