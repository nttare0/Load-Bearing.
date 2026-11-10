import * as React from "react";
import { cn } from "./utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-lg border border-rule bg-paper-raised px-3 text-sm text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/15",
        className
      )}
      {...props}
    />
  );
}
