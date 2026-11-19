"use client";

import type { SVGProps } from "react";

/**
 * Brand marks, as real paths rather than rough sketches.
 *
 * Paths come from Simple Icons (CC0 1.0 — see icons/LICENSE.txt), which means
 * every one is the company's own drawing on a 24-unit grid, not an approximation
 * traced from memory. They are decorative: the name always sits beside them, so
 * each is `aria-hidden` and inherits the surrounding text colour.
 *
 * One component per mark, and `markFor(name)` for when the name is data. Adding a
 * connector means adding a path here and a row where it is listed — nothing else.
 */

export type MarkName = "github" | "vercel" | "supabase" | "gemini" | "generic";

type MarkProps = SVGProps<SVGSVGElement> & { size?: number };

function Mark({ size = 16, children, ...props }: MarkProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/** GitHub. */
export function GithubMark(props: MarkProps) {
  return (
    <Mark {...props}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </Mark>
  );
}

/** Vercel. */
export function VercelMark(props: MarkProps) {
  return (
    <Mark {...props}>
      <path d="m12 1.608 12 20.784H0Z" />
    </Mark>
  );
}

/** Supabase. */
export function SupabaseMark(props: MarkProps) {
  return (
    <Mark {...props}>
      <path d="M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C-.33 13.427.65 15.455 2.409 15.455h9.579l.113 7.51c.014.985 1.259 1.408 1.873.636l9.262-11.653c1.093-1.375.113-3.403-1.645-3.403h-9.642z" />
    </Mark>
  );
}

/** Google Gemini. */
export function GeminiMark(props: MarkProps) {
  return (
    <Mark {...props}>
      <path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81" />
    </Mark>
  );
}

/** Anything we have no brand drawing for: a plug, not a guess at someone's logo. */
export function GenericMark(props: MarkProps) {
  return (
    <Mark fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v4" strokeLinecap="round" />
    </Mark>
  );
}

const MARKS = {
  github: GithubMark,
  vercel: VercelMark,
  supabase: SupabaseMark,
  gemini: GeminiMark,
  generic: GenericMark,
} as const satisfies Record<MarkName, (props: MarkProps) => React.ReactElement>;

export function markFor(name: MarkName) {
  return MARKS[name];
}

/**
 * Pick a mark from whatever the server called the provider. An unknown provider
 * gets the plug rather than a wrong logo: a connectors panel that shows the
 * Anthropic mark for a Gemini key is worse than one that admits it does not know.
 */
export function markForProvider(provider: string | null): MarkName {
  const name = (provider ?? "").toLowerCase();
  if (name.includes("github")) return "github";
  if (name.includes("vercel")) return "vercel";
  if (name.includes("supabase")) return "supabase";
  if (name.includes("gemini") || name.includes("google")) return "gemini";
  return "generic";
}
