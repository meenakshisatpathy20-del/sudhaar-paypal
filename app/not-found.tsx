import Link from "next/link";
import { Chappal, NeedleThread } from "@/components/Doodles";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex items-end gap-3">
        <Chappal className="w-20" />
        <NeedleThread className="w-28" />
      </div>
      <h1 className="text-3xl font-bold">This page needs a repair</h1>
      <p className="text-muted-foreground">We couldn&apos;t find what you were looking for. Let&apos;s get you back home.</p>
      <Link href="/" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
        Back to Sudhaar
      </Link>
    </div>
  );
}
