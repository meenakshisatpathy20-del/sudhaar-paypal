import { PartnerGate } from "@/components/shell/PartnerGate";
import { SiteShell } from "@/components/shell/SiteShell";

// Karigar, Saathi and admin pages: the same website as customers, behind a partner login.
export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteShell>
      <PartnerGate>{children}</PartnerGate>
    </SiteShell>
  );
}
