import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { uploadsDir } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { FlowError } from "@/lib/orders";

const TYPES: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new FlowError("No file uploaded");
    const ext = TYPES[file.type];
    if (!ext) throw new FlowError("Only JPEG, PNG or WebP images are accepted");
    if (file.size > MAX_BYTES) throw new FlowError("Image is larger than 4 MB");
    const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
    fs.writeFileSync(path.join(uploadsDir(), name), Buffer.from(await file.arrayBuffer()));
    return ok({ file: name, url: `/api/uploads/${name}` });
  } catch (e) {
    return fail(e);
  }
}
