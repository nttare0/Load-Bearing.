# 11 — Security Checklist (32 Checks Before Any Build Ships)

> Every build passes this security gate. Each check: what it is → what the
> agent **must do**. A build that fails any check is not done (see
> [06-workflow-checklist.md](06-workflow-checklist.md)).
> Stack context: Next.js/Vercel + Supabase — verify exact APIs in framework
> docs, never invent config keys.

## Definition of Done — security gate

Before shipping, verify at minimum: security headers present in production
response · `/.git/config` returns 404 · no `.map` files in prod bundle ·
DB not exposed (RLS on, service keys server-side) · prices recalculated
server-side · rate limits on auth/OTP · redirects allowlisted · reset links
from configured base URL · no third-party polyfill CDN · ownership checked
server-side on every object access (IDOR) · CORS allowlist · npm audit clean ·
no secrets in git history · no unauthenticated admin/cron/webhook routes.

## The 32 Checks

### 1. Next.js security headers
Send on every response: `Strict-Transport-Security`, `Content-Security-Policy`,
`X-Frame-Options` (or CSP `frame-ancestors`), `X-Content-Type-Options: nosniff`,
`Referrer-Policy`, `Permissions-Policy`. Set `poweredByHeader: false` in
`next.config.js` (kills `X-Powered-By`). Verify with `curl -I` in production.

### 2. Race conditions
Never check-then-act across requests (balance, quota, OTP use, coupons,
inventory). Do it atomically in the DB: transactions, unique constraints,
conditional updates (`UPDATE … WHERE used = false`), row locks. Client-side
guards are UX, not security.

### 3. `.git` folder exposure
Never ship `.git` into deploy output or a static/serve directory. Verify
`https://site/.git/config` returns 404 in production. If it leaks, secrets
history leaks with it.

### 4. Account pre-hijacking
Protect signup/OAuth/email-change flows: an attacker pre-creating an account
with the victim's email (or pre-linking an OAuth id) must not be able to take
over the real account later. Key identity on the **verified email + provider**,
re-verify ownership on any identity change, and never auto-merge unverified
signups with later OAuth logins.

### 5. Supabase storage
Buckets private by default; public only for truly public assets. Enable
storage RLS policies per bucket; validate file type + size server-side; use
signed URLs for private files. Never accept client-declared paths/ownership —
paths derive from the authenticated user, never from the request body.

### 6. Subdomain takeover
Dangling DNS (CNAME to a decommissioned service) lets attackers claim your
subdomain. Audit DNS entries; remove stale ones; never point subdomains at
unclaimed third-party endpoints; keep vendor verifications (Vercel, etc.) done.

### 7. Price from the browser
Never trust price, discount, quantity, or currency from the client. Recompute
the payable amount server-side from DB prices at checkout; validate coupon
eligibility server-side; verify payment-webhook signatures and amounts before
fulfilling. Client values are display hints only.

### 8. SSRF
Never fetch a user-supplied URL. Allowlist outbound hosts; block internal
ranges, localhost, and cloud metadata endpoints (`169.254.169.254`); pin DNS
re-resolution where possible. Webhook fetches validate targets, not raw input.

### 9. Credential stuffing
Rate-limit login per IP **and** per account with backoff; return one generic
"invalid email or password" error; support MFA; reject known-breached
passwords on signup. Failed attempts are logged, never leaked in verbose errors.

### 10. Path traversal
Never build file paths from raw user input (`../`, absolute paths, encoded
slashes). Normalize + resolve inside an allowlisted base directory and verify
the resolved path is still inside it. Dynamic file routes validate strictly.

### 11. Open database
DB ports are never public. Supabase: **RLS enabled on every table**, no
`anon` full-access policies, `service_role` key server-side only. Env vars
ending in `NEXT_PUBLIC_`/`VITE_`/`EXPOSED` are public — secrets never carry
those prefixes. Connection strings live in server env, verified not in the
client bundle.

### 12. Reset poisoning
Generate password-reset (and magic-link/invite) URLs from a **configured base
URL** — never from `Host`, `X-Forwarded-Host`, `Referer`, or any request
header. Static config, validated allowlist if multi-domain is required.

### 13. Polyfill.io (supply-chain CDNs)
Never include `polyfill.io` or uncontrolled third-party polyfill/JS CDNs —
it was compromised and served malware. Modern targets don't need polyfills
(see [02-modern-web-guidance.md](02-modern-web-guidance.md)). If one is truly
required: self-host and pin it. Static CDN assets get Subresource Integrity
(SRI) where the platform supports it.

### 14. Source maps
No source maps in production (`productionBrowserSourceMaps` stays `false`
unless deliberately needed); no `.map` files served; no sourceMappingURL
pointing to public maps in prod bundles. Maps can expose proprietary code and
embedded secrets. Verify no `*.map` in the deployed output.

### 15. SMS pumping
OTP sends are expensive and attacker-magnetable. Rate-limit per phone **and**
per IP; validate phone format before sending; cap retries; delete expired
codes; enable the provider's fraud guard (e.g. Twilio). Prefer email/OTP
alternatives where possible.

### 16. Clickjacking
`X-Frame-Options: DENY` or CSP `frame-ancestors 'none'` (allowlist only
intentionally embeddable pages). Never leave framing unrestricted on auth,
settings, or payment pages.

### 17. Prompt injection
Any LLM/AI feature (incl. shadcn AI Elements UIs): treat model output as
**untrusted data**, never as instructions. Never execute tool calls, render
HTML/markdown as raw HTML, or change privileges based on model output;
keep system instructions separate from user content; validate outputs before
any side effect.

### 18. Open redirect
Never redirect to a full user-supplied URL (`?next=`, `?returnTo=`). Allowlist
exact hosts or accept only relative paths starting with a single `/`; encode
before use. Login/checkout return URLs are validated against the allowlist.

### 19. Weak JWT secret
Signing secrets: cryptographically random (≥ 256 bits), generated offline,
stored server-side in env, rotated on compromise. Explicit `alg`, verify
`iss`/`aud`/`exp` on every check, reject `none`. Long-lived secrets in code
or client bundles are a ship-stopper.

### 20. User enumeration
Same generic response and near-identical timing for existing vs non-existing
accounts (login, reset, signup). Constant-time comparisons for tokens/hashes;
rate limits make timing probing impractical; signup messages don't confirm
"email already registered" to unauthenticated callers.

### 21. XSS (cross-site scripting)
Escape all user content by default. Never inject user input via
`dangerouslySetInnerHTML`/`innerHTML`; sanitize rich text/markdown/HTML with a
vetted sanitizer before rendering; block `javascript:` URLs; CSP is the
backstop, not the fix.

### 22. SQL injection
Parameterized queries only — never string-concatenate SQL. Supabase: use the
query builder / parameterized `rpc`; if raw SQL is unavoidable, bind
parameters. Dynamic order/filter columns come from a server-side allowlist,
not the client.

### 23. CSRF
Cookie-authenticated state-changing endpoints need CSRF defence:
`SameSite=Lax/Strict` cookies, CSRF tokens, and Origin/Referer validation
server-side. Next.js Server Actions have built-in Origin checks — keep them,
never bypass.

### 24. IDOR / broken access control
Authorization on **every** object access, server-side. Logged-in ≠ allowed:
every query filters by the authenticated user's ownership or explicit role;
IDs come from the session, not the client. Test by fetching another user's
object and confirming denial. Supabase RLS is the enforcement layer — still
verify in code.

### 25. Mass assignment
Never spread a request body into a DB write (`update(req.body)`). Whitelist
assignable fields per endpoint; privileged fields (`role`, `is_admin`,
`plan`, `owner_id`) are never client-settable; strip unknown keys from
signup/profile payloads.

### 26. CORS misconfiguration
Never reflect an arbitrary `Origin` together with
`Access-Control-Allow-Credentials: true`, and never `*` + credentials. Strict
origin allowlist, `Vary: Origin`, explicit preflight handling. Only open
what is genuinely cross-origin.

### 27. Session management
Cookies: `HttpOnly`, `Secure`, `SameSite`, scoped `Path`/`Domain`. Logout and
password change invalidate the session **server-side** (not just client-side
cookie deletion); rotate sessions on privilege change; sane expiry; never
session tokens in URLs.

### 28. Dependency & supply chain
Lockfile committed; `npm audit` clean of high/critical before ship; versions
pinned; packages only from the allowlist ([05](05-forbidden-patterns.md)) —
no typosquats, no unvetted installs; verify package names character by
character; automation (Dependabot/Renovate) watches CVEs.

### 29. Secrets in code & git history
Secrets never enter the repo — not even once. Pre-commit secret scanning
(e.g. gitleaks); if a secret ever touched history: **rotate immediately**,
then purge/rewrite history. Scan env files, dumps, and test fixtures too.

### 30. Verbose errors & debug routes
No stack traces, SQL, or internal paths in client-facing errors — generic
messages plus server-side structured logs. No debug/test/admin routes in
production deployments; error boundaries leak nothing.

### 31. Unauthenticated admin, cron & webhook endpoints
Every server action, API route, cron route, and webhook authenticates or
verifies a secret (constant-time comparison) — Next.js routes are public HTTP
endpoints by default. Admin UIs check roles server-side, not just hide links.
Webhooks verify provider signatures before processing.

### 32. DoS on expensive endpoints
Rate-limit and size-cap uploads, search, exports, image optimization, and
list endpoints; enforce pagination limits and query timeouts; expensive work
runs queued/background, not request-blocking. Disable or restrict unused
optimizers (e.g. `/_next/image`).

## Forbidden

- ❌ Shipping without running the security gate above.
- ❌ Trusting any client-sent value for price, identity, paths, or redirects.
- ❌ Public DB endpoints, missing RLS, or service keys in the client bundle.
- ❌ `X-Powered-By` on, prod source maps, or `.git` in deploy output.
- ❌ Uncontrolled third-party script/polyfill CDNs.
- ❌ Invented config keys — verify header/RLS/config syntax in docs first.
- ❌ Reflecting arbitrary origins with credentials, or `*` + credentials (CORS).
- ❌ Spreading raw request bodies into DB writes (mass assignment).
- ❌ A secret ever committed — if one touched history: rotate immediately.
- ❌ Unauthenticated cron/webhook/admin endpoints in production.
- ❌ Stack traces, debug routes, or internal details in client-facing errors.

## Report in your response

> Security gate: headers ✅ (HSTS, CSP, nosniff, no X-Powered-By) · .git 404 ✅ ·
> RLS on all tables ✅ · prices server-side ✅ · auth rate-limits ✅ ·
> redirects allowlisted ✅ · reset base URL config ✅ · no prod maps ✅ ·
> IDOR ownership checks ✅ · CORS allowlist ✅ · npm audit clean ✅ ·
> no secrets in history ✅ · no unauthenticated admin/cron routes ✅.
