import { cn } from "./utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-ink/[0.07]", className)}
      {...props}
    />
  );
}
