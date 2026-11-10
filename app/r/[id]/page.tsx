import Link from "next/link";
import { notFound } from "next/navigation";
import { loadAnalysis } from "@/lib/store";
import { SharedReport } from "@/components/SharedReport";

export const dynamic = "force-dynamic";

export default async function SharedAnalysis({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const analysis = await loadAnalysis(id);

  if (!analysis) notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <div className="to-column flex h-[var(--to-header-h)] items-center justify-between gap-[var(--to-gutter)]">
          <Link href="/" className="lb-wordmark flex items-center gap-[0.5em] text-[1.375rem] text-foreground no-underline">
            Load-Bearing
          </Link>
          <Link href="/" className="text-[0.8125rem] text-[var(--to-accent)] underline-offset-4 hover:underline">
            Check your own plan
          </Link>
        </div>
      </header>
      <main className="to-column flex flex-1 flex-col gap-[1.5rem] py-[1.5rem]">
        <SharedReport analysis={analysis} />
      </main>
    </div>
  );
}
