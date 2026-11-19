import { spawn } from "node:child_process";

/**
 * Run a check inside the deployment, with the deployment's own environment.
 *
 * The problem this solves: production holds the only Gemini key, the sandbox has
 * no key and cannot reach googleapis.com, and it cannot POST to the deployment
 * either. So the one question worth asking — "does the key Vercel holds actually
 * return valid claims?" — could not be asked from anywhere.
 *
 * Everything travels in the path, because the only transport available to an
 * outside checker may not be able to carry a query string or a body:
 *
 *   GET /api/check/<token>                          → /api/health (default)
 *   GET /api/check/<token>/api/selftest             → just the first pass
 *   GET /api/check/<token>/api/selftest/full        → the whole five-pass run
 *
 * The target is spawned as a child of this same function, so it inherits the
 * real environment — a request from outside would too, but this keeps the
 * platform's own protection out of the way and makes the result one document.
 *
 * Off unless CHECK_TOKEN is set. Wrong token → 401. Anything that is not one of
 * this app's own /api paths → 400, so it cannot become an open proxy.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

/** As much of the child's output as the caller can use, and no more. */
const MAX_OUTPUT = 24_000;
/** Hard stop. The child usually finishes well before this. */
const TIMEOUT_MS = 280_000;

export async function GET(
  request: Request,
  context: { params: Promise<{ args?: string[] }> }
) {
  const expected = process.env.CHECK_TOKEN;
  if (!expected) {
    return Response.json(
      { error: "The check tool is off. Set CHECK_TOKEN in the deployment's env to enable it." },
      { status: 404 }
    );
  }

  const { args = [] } = await context.params;
  const [token, ...rest] = args;

  if (!token || !sameSecret(token, expected)) {
    return Response.json(
      { error: "That token is not the one this deployment expects." },
      { status: 401 }
    );
  }

  // No path given, or a query string used instead: default to the cheap check.
  const url = new URL(request.url);
  const queryPath = url.searchParams.get("path");
  const segments = rest.length > 0 ? rest : queryPath ? [queryPath] : ["api", "health"];

  const target = toTarget(segments);
  if (!target) {
    return Response.json(
      {
        error:
          "The path after the token must be one of this app's /api routes, e.g. /api/check/<token>/api/selftest",
      },
      { status: 400 }
    );
  }

  return run(target);
}

/**
 * `/token/api/selftest` → `/api/selftest`; `/token/api/health` → `/api/health`.
 * A trailing "full" turns the single-pass self-test into the whole pipeline,
 * since a path segment is the only place a parameter can live on this transport.
 */
function toTarget(segments: string[]): string | null {
  const parts = segments.flatMap((segment) => segment.split("/")).filter(Boolean);
  if (parts[0] !== "api" || parts.length < 2) return null;
  // Only routes this app actually has. A wildcard would be an open proxy.
  const allowed = new Set(["health", "selftest", "analyze", "organize", "ask"]);
  if (!allowed.has(parts[1])) return null;

  const query: string[] = [];
  const path = parts.slice(0, 2);
  for (const extra of parts.slice(2)) {
    if (parts[1] === "selftest" && extra === "full") continue;
    if (parts[1] === "selftest" && extra === "extract") query.push("only=extract");
    else return null;
  }
  const params = new URLSearchParams(query.join("&")).toString();
  return `/${path.join("/")}${params ? `?${params}` : ""}`;
}

async function run(path: string): Promise<Response> {
  const started = Date.now();
  const port = process.env.PORT;
  if (!port) {
    return Response.json(
      { error: "No PORT in the environment; cannot reach this deployment itself." },
      { status: 500 }
    );
  }

  const target = `http://127.0.0.1:${port}${path}`;
  // Vercel's own protection would otherwise answer 401 before the route runs.
  // This header proves the request came from inside this deployment.
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

  const args = ["-s", "-S", "-m", String(Math.floor(TIMEOUT_MS / 1000)), "-w", "\\n__STATUS__%{http_code}"];
  if (bypass) args.push("-H", `x-vercel-protection-bypass: ${bypass}`);
  args.push(target);

  try {
    const { out, err, code } = await exec("curl", args);
    const marker = out.match(/__STATUS__(\d{3})\s*$/);
    const status = marker ? Number(marker[1]) : null;
    const body = marker && marker.index !== undefined ? out.slice(0, marker.index) : out;

    return Response.json({
      target: path,
      status,
      ms: Date.now() - started,
      ok: status !== null && status >= 200 && status < 300,
      exit: code,
      bypass: Boolean(bypass),
      body: body.slice(0, MAX_OUTPUT),
      // curl's own words when the request never completed — a platform 401 looks
      // nothing like a model error, so keep them apart.
      transport: err.trim().slice(0, 500) || null,
    });
  } catch (error) {
    return Response.json(
      {
        target: path,
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
