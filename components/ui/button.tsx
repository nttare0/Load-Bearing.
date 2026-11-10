import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/40 cursor-pointer",
  {
    variants: {
      variant: {
        primary: "bg-ink text-paper hover:bg-[#2b2823]",
        load: "bg-[#b4451f] text-white hover:bg-[#9c3b1a]",
        outline: "border border-ink/15 bg-paper-raised text-ink hover:bg-paper hover:border-ink/25",
        ghost: "text-ink-soft hover:bg-ink/5 hover:text-ink",
        link: "text-ink underline underline-offset-4 decoration-ink/30 hover:decoration-ink",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-4",
        lg: "h-11 px-5",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
