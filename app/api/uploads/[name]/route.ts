import fs from "node:fs";
import path from "node:path";
import { uploadsDir } from "@/lib/db";
import { loadUpload } from "@/lib/snapshot";

const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const name = path.basename((await params).name);
  const full = path.join(uploadsDir(), name);
  if (!fs.existsSync(full)) {
    // After a restart the disk is empty: fetch the photo back from the saved copy (lib/snapshot.ts).
    const saved = /^[\w-]+\.(jpg|png|webp)$/.test(name) ? await loadUpload(name) : null;
    if (!saved) return new Response("Not found", { status: 404 });
    fs.writeFileSync(full, saved);
  }
  return new Response(fs.readFileSync(full), {
    headers: { "Content-Type": MIME[path.extname(name)] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
