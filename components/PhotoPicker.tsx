"use client";

import { useRef, useState } from "react";

/** Picks or captures a photo, downsizes it in the browser (max 1280px JPEG) and uploads it. */
export function PhotoPicker({ onUploaded, label = "Add photo", compact = false }: { onUploaded: (file: string, url: string) => void; label?: string; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File) {
    setError(null);
    setBusy(true);
    try {
      const blob = await downscale(file);
      const form = new FormData();
      form.append("file", blob, "photo.jpg");
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setPreview(json.url);
      onUploaded(json.file, json.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])} />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={`flex w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-brand/40 bg-brand-light/50 text-brand-dark hover:bg-brand-light ${compact ? "h-24" : "h-44"}`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Uploaded" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-sm font-semibold">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            {busy ? "Uploading…" : label}
          </span>
        )}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image"))), "image/jpeg", 0.85));
}
