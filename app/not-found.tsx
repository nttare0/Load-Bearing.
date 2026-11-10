import Link from "next/link";

export default function NotFound() {
  return (
    <div className="to-column flex min-h-dvh flex-col justify-center gap-[0.75rem] py-[3rem]">
      <h1 className="lb-wordmark text-[1.5rem]">Nothing here</h1>
      <p className="text-[0.9375rem] leading-[1.6] text-ink-2">
        This report is gone, or it was never saved.
      </p>
      <Link href="/" className="text-[0.875rem] text-[var(--to-accent)] underline underline-offset-4">
        Check a plan
      </Link>
    </div>
  );
}
