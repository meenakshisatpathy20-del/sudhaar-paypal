import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold [&>svg]:size-3", {
  variants: {
    variant: {
      default: "bg-primary/15 text-primary ring-1 ring-primary/30",
      gold: "bg-gold/15 text-gold ring-1 ring-gold/30",
      paypal: "bg-[#e6f0ff] text-[#0050b3] ring-1 ring-[#0070e0]/25",
      outline: "text-muted-foreground ring-1 ring-border",
      destructive: "bg-destructive/15 text-destructive ring-1 ring-destructive/30",
      solid: "bg-primary text-primary-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
