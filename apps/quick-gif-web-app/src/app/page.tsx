"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { VideoCard } from "@/components/library/video-card";
import { SortSelect, useSortMode } from "@/components/ui/sort-select";
import { EDIT, SETTINGS, generateRoute } from "@/lib/routes";
import type { VideoMeta } from "@/lib/types";

const Page = () => {
  const router = useRouter();
  const [watchDir, setWatchDir] = useState("");
  const [videos, setVideos] = useState<VideoMeta[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [sort, setSort] = useSortMode("quick-gif:sort:library");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sorted = useMemo(
    () =>
      [...videos].sort((a, b) =>
        sort === "name" ? a.name.localeCompare(b.name) : b.modifiedAt - a.modifiedAt,
      ),
    [videos, sort],
  );

  const loadLibrary = useCallback(() => {
    fetch("/api/videos")
      .then((r) => r.json())
      .then((b) => {
        setVideos(b.videos ?? []);
        setWatchDir(b.watchDir ?? "");
      })
      .catch(() => setVideos([]))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Upload failed");
        return;
      }
      const meta = json.data as VideoMeta;
      router.push(`${generateRoute(EDIT, { name: meta.name })}?source=upload`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  const removeVideo = async (name: string) => {
    if (!window.confirm(`Delete ${name} from the watch folder? This cannot be undone.`)) {
      return;
    }
    // Drop it from the list right away; only re-list if the delete failed
    // (avoids a stale cached listing re-adding the removed file).
    setVideos((prev) => prev.filter((v) => v.name !== name));
    const res = await fetch(`/api/videos?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    if (!res.ok) loadLibrary();
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {/* Upload */}
      <div className="flex flex-col gap-2">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
            dragActive
              ? "border-purple bg-purple/10"
              : "border-comment hover:border-purple hover:bg-current-line/40"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-purple" aria-hidden>
            <path d="M12 16V4m0 0L8 8m4-4 4 4" />
            <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
          </svg>
          <span className="text-base font-semibold text-foreground">
            {uploading ? "Uploading…" : "Drop a video here, or click to upload"}
          </span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,.mp4,.webm,.mov,.mkv,.m4v,.avi"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
          className="hidden"
        />
        {error ? <span className="text-sm text-red">{error}</span> : null}
      </div>

      {/* Directory (watch folder) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Library</h2>
          <div className="flex min-w-0 items-center gap-3">
            {videos.length > 1 ? <SortSelect value={sort} onChange={setSort} /> : null}
            <span className="truncate text-xs text-comment">{watchDir || "—"}</span>
          </div>
        </div>

        {!loaded ? (
          <p className="text-sm text-comment">Loading library…</p>
        ) : !watchDir ? (
          <p className="text-sm text-comment">
            Set a watch folder in{" "}
            <Link href={SETTINGS} className="text-cyan hover:underline">
              Settings
            </Link>{" "}
            to browse your videos here.
          </p>
        ) : videos.length === 0 ? (
          <p className="text-sm text-comment">No videos found in the watch folder.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {sorted.map((v) => (
              <VideoCard key={v.name} v={v} onDelete={removeVideo} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Page;
