"use client";

import { useEffect, useState } from "react";
import { Converter } from "@/components/batch/converter";
import { fetchSettings, type Settings } from "@/lib/settings";
import type { VideoMeta } from "@/lib/types";

const Page = () => {
  const [videos, setVideos] = useState<VideoMeta[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void fetchSettings().then(setSettings).catch(() => {});
    fetch("/api/videos")
      .then((r) => r.json())
      .then((b) => setVideos(b.videos ?? []))
      .catch(() => setVideos([]))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-2xl font-bold">Batch convert</h1>
      {!loaded || !settings ? (
        <p className="text-sm text-comment">Loading…</p>
      ) : videos.length === 0 ? (
        <p className="text-sm text-comment">
          No videos in the watch folder. Set it in Settings.
        </p>
      ) : (
        <Converter videos={videos} settings={settings} />
      )}
    </div>
  );
};

export default Page;
