"use client";

import { CATEGORY_I18N } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/types";
import { CATEGORY_ICON } from "./CategoryIcon";
import { useLang } from "./LanguageProvider";

const CATS: Category[] = ["shoes", "bags", "clothes", "small-appliance", "electronics", "furniture", "plumbing", "electrical"];

/** Optional "what kind of item is it?" chips: helps the estimate, required for photo-only quotes without AI. */
export function CategoryChips({ value, onChange, exclude = [] }: { value: Category | null; onChange: (c: Category | null) => void; exclude?: Category[] }) {
  const { lang } = useLang();
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATS.filter((c) => !exclude.includes(c)).map((c) => {
        const Icon = CATEGORY_ICON[c];
        const on = value === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(on ? null : c)}
            className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition", on ? "bg-primary text-primary-foreground ring-primary" : "bg-card ring-border hover:bg-muted")}
          >
            <Icon className="size-3.5" /> {CATEGORY_I18N[c][lang]}
          </button>
        );
      })}
    </div>
  );
}
