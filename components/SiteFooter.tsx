import Link from "next/link";

/**
 * The footer links the two legal pages, which are required to exist and be
 * reachable. Kept to one line and low contrast: this app is a canvas, and a
 * heavy footer under a composer reads as a different product.
 */
export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`flex flex-wrap items-center gap-x-[0.75rem] gap-y-[0.25rem] px-[0.25rem] py-[0.5rem] text-[0.6875rem] text-ink-3 ${className}`}
    >
      <Link href="/privacy" className="hover:text-foreground">
        Privacy
      </Link>
      <Link href="/terms" className="hover:text-foreground">
        Terms
      </Link>
      <a
        href="https://www.rareui.com"
        target="_blank"
        rel="noreferrer noopener"
        className="hover:text-foreground"
      >
        Components from Rare UI
      </a>
    </footer>
  );
}
