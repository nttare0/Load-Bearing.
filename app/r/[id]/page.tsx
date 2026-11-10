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
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[15px] font-semibold tracking-tight">Load-Bearing</span>
        <Link href="/" className="text-[12px] text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Check your own plan
        </Link>
      </div>
      <SharedReport analysis={analysis} />
    </main>
  );
}
