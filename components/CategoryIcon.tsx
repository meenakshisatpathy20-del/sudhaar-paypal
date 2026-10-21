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

export const CATEGORY_EXAMPLE: Record<Category, { en: string; hi: string }> = {
  shoes: { en: "The sole of my leather shoe is coming off", hi: "मेरे चमड़े के जूते का सोल निकल रहा है" },
  bags: { en: "School bag zip is broken and one strap is torn", hi: "स्कूल बैग की ज़िप टूट गई है और एक पट्टा फट गया है" },
  clothes: { en: "My kurta is torn near the pocket", hi: "मेरा कुर्ता जेब के पास से फट गया है" },
  "small-appliance": { en: "Mixer grinder jar blade is loose and it makes a grinding noise", hi: "मिक्सर जार का ब्लेड ढीला है और आवाज़ करता है" },
  electronics: { en: "Phone charging port is loose, it charges only at an angle", hi: "फ़ोन का चार्जिंग पोर्ट ढीला है" },
  furniture: { en: "Wooden chair leg is wobbly", hi: "लकड़ी की कुर्सी का पैर हिलता है" },
  plumbing: { en: "Kitchen tap is leaking", hi: "रसोई का नल टपक रहा है" },
  electrical: { en: "Bedroom switchboard sparks when I switch on the fan", hi: "पंखा चलाने पर स्विचबोर्ड में चिंगारी आती है" },
};
