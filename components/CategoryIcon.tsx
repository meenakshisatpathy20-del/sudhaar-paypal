import { Armchair, Backpack, Droplets, Fan, Footprints, Shirt, Smartphone, Zap, type LucideIcon } from "lucide-react";
import type { Category } from "@/lib/types";

export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  shoes: Footprints,
  bags: Backpack,
  clothes: Shirt,
  "small-appliance": Fan,
  electronics: Smartphone,
  furniture: Armchair,
  plumbing: Droplets,
  electrical: Zap,
};
