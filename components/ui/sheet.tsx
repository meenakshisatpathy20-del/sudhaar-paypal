"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

function SheetContent({ className, children, side = "bottom", ...props }: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: "bottom" | "right" }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <SheetPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col gap-4 border-white/10 bg-[#0b1312] p-5 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out",
          side === "bottom" &&
            "inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-3xl border-t data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom sm:inset-x-auto sm:left-1/2 sm:w-[560px] sm:-translate-x-1/2",
          side === "right" && "inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-white/10" aria-label="Close">
          <X className="size-4" />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn("font-display text-lg font-semibold", className)} {...props} />;
}
function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription };
