"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  images: string[];
  canEdit: boolean;
  busy?: boolean;
  onRemove: (imageIndex: number) => void | Promise<void>;
  onAddFile: (file: File) => void | Promise<void>;
  maxImages?: number;
  /** Shown above the grid (e.g. "Post images"). */
  title?: string;
  /** When true, tapping a thumbnail opens a full-screen style preview (Compose V2 only). */
  enableImagePreview?: boolean;
};

export function PostImagesGallery({
  images,
  canEdit,
  busy = false,
  onRemove,
  onAddFile,
  maxImages = 9,
  title = "Images",
  enableImagePreview = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!previewUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewUrl(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewUrl]);

  if (images.length === 0 && !canEdit) {
    return null;
  }

  return (
    <div className="border-b border-white/10 px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          {title}
        </p>
        {canEdit && images.length < maxImages ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onAddFile(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-md border border-dashed border-white/25 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:border-[#0a66c2]/60 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              + Add image
            </button>
          </>
        ) : null}
      </div>
      {images.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {images.map((src, i) => (
            <li
              key={`${i}-${src.slice(0, 48)}`}
              className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40"
            >
              {enableImagePreview ? (
                <button
                  type="button"
                  className="relative block h-full w-full cursor-zoom-in overflow-hidden p-0 text-left outline-none ring-[#0a66c2]/40 focus-visible:ring-2"
                  aria-label="View image larger"
                  onClick={() => setPreviewUrl(src)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    className="pointer-events-none h-full w-full object-cover"
                  />
                </button>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </>
              )}
              {canEdit ? (
                <button
                  type="button"
                  title="Remove image"
                  disabled={busy}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onRemove(i);
                  }}
                  className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded bg-black/70 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100 hover:bg-rose-700/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-zinc-500">No images yet.</p>
      )}

      {previewUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/88 px-4 pb-4 pt-[max(3.75rem,env(safe-area-inset-top,0px))] backdrop-blur-sm"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-[max(1rem,env(safe-area-inset-top,0px))] z-[201] rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-white/10"
            aria-label="Close preview"
            onClick={() => setPreviewUrl(null)}
          >
            Close
          </button>
          <div
            className="flex min-h-0 min-w-0 max-h-full max-w-full items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt=""
              className="h-auto w-auto max-h-[min(78dvh,82vh)] max-w-[min(88dvw,92vw)] rounded-lg border border-white/15 object-contain shadow-2xl"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
