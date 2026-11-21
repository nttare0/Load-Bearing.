import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteFooter } from "@/components/SiteFooter";

/**
 * The shell both legal pages use.
 *
 * The banner is not decoration. Nothing on this site collects an account, a card,
 * or an address, and the text below describes that honestly — but it is written
 * by an engineer describing software, not by a lawyer, and it says so at the top
 * rather than in a footnote.
 */
export function LegalPage({
  title,
  updated,
  summary,
  sections,
}: {
  title: string;
  updated: string;
  summary: string;
  sections: { heading: string; body: string[] }[];
}) {
  return (
    <div className="mx-auto flex w-full max-w-[40rem] flex-col px-[1rem] pb-[3rem] pt-[1rem]">
      <Link
        href="/"
        className="mb-[0.75rem] flex w-fit items-center gap-[0.25rem] text-[0.75rem] text-ink-3 hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-3.5" />
        Back to the workspace
      </Link>

      <header className="mb-[1rem] flex flex-col gap-[0.375rem]">
        <h1 className="lb-serif text-[1.625rem] leading-[1.1] text-foreground">{title}</h1>
        <p className="text-[0.75rem] text-ink-3">Last updated {updated}</p>
      </header>

      <Card className="mb-[1rem] gap-[0.5rem] border-[var(--to-warning)] bg-transparent py-[0.75rem] shadow-none">
        <CardContent className="flex flex-col gap-[0.375rem] px-[0.75rem]">
          <Badge
            variant="outline"
            className="w-fit border-[var(--to-warning)] text-[0.625rem] text-[var(--to-warning)]"
          >
            Placeholder — needs your review
          </Badge>
          <p className="text-[0.8125rem] leading-[1.55] text-ink-2">
            This page describes how the software actually behaves, written by the people who built
            it. It is <strong className="font-medium text-foreground">not legal advice</strong> and
            has not been reviewed by a lawyer. Replace or review it before you rely on it, and add
            the operator&apos;s real name, address and contact details where marked.
          </p>
        </CardContent>
      </Card>

      <p className="mb-[1rem] text-[0.875rem] leading-[1.6] text-ink-2">{summary}</p>

      <div className="flex flex-col gap-[0.75rem]">
        {sections.map((section) => (
          <Card key={section.heading} className="gap-[0.375rem] border-[var(--to-border)] bg-transparent py-[0.75rem] shadow-none">
            <CardHeader className="px-[0.75rem]">
              <CardTitle className="text-[0.875rem] font-medium text-foreground">
                {section.heading}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-[0.5rem] px-[0.75rem]">
              {section.body.map((paragraph) => (
                <p key={paragraph} className="text-[0.8125rem] leading-[1.6] text-ink-2">
                  {paragraph}
                </p>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-[1rem] text-[0.75rem] leading-[1.6] text-ink-3">
        Questions about this page: replace this line with the operator&apos;s real contact details
        before launch.
      </p>

      <SiteFooter className="mt-[0.5rem]" />
    </div>
  );
}
