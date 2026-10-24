import { SiteShell } from "@/components/shell/SiteShell";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
