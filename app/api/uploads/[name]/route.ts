import fs from "node:fs";
import path from "node:path";
import { uploadsDir } from "@/lib/db";

const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const name = path.basename((await params).name);
  const full = path.join(uploadsDir(), name);
  if (!fs.existsSync(full)) return new Response("Not found", { status: 404 });
  return new Response(fs.readFileSync(full), {
    headers: { "Content-Type": MIME[path.extname(name)] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
