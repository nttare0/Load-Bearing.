import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-rule bg-paper text-ink-soft",
        fact: "border-[#4a6b57]/30 bg-[#eaf0e9] text-[#33503f]",
        guess: "border-[#9a6b12]/30 bg-[#f7edd5] text-[#7a540e]",
        unverified: "border-[#8a837a]/35 bg-[#f1ede4] text-[#5f584e]",
        contradicted: "border-[#b4451f]/35 bg-[#f8e3da] text-[#8f3417]",
        load: "border-[#b4451f]/25 bg-[#fbe8e0] text-[#96391b]",
        structural: "border-[#9a6b12]/25 bg-[#f8eeda] text-[#7d570f]",
        light: "border-[#4a6b57]/25 bg-[#eaf0e9] text-[#3c5b49]",
        outline: "border-ink/20 bg-transparent text-ink-soft",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
