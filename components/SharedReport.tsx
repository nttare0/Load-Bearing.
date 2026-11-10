"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { Report } from "@/components/Report";
import type { Analysis } from "@/lib/schema";

/**
 * Read-only view of a saved analysis. No delete, no test recording — the
 * person who ran it owns those actions.
 */
export function SharedReport({ analysis }: { analysis: Analysis }) {
  const noop = useCallback(() => {
    toast("This is a shared, read-only report.");
  }, []);

  return <Report analysis={analysis} persisted readOnly onDelete={undefined} onOutcome={noop} />;
}
