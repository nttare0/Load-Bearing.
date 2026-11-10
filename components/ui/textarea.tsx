import * as React from "react";
import { cn } from "./utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex w-full rounded-lg border border-rule bg-paper-raised px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/15 focus-visible:border-ink/25 resize-y",
        className
      )}
      {...props}
    />
  );
}
