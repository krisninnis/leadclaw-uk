"use client";

import { useRef } from "react";
import { track } from "@/lib/analytics";

// Client wrapper around the social demo <video>. Emits `social_video_view` the
// first time playback starts. Markup mirrors the original inline player.
export default function SocialDemoVideo({ src }: { src: string }) {
  const viewed = useRef(false);

  function handlePlay() {
    if (viewed.current) return;
    viewed.current = true;
    track("social_video_view", { src });
  }

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-black">
      <video
        className="aspect-video w-full"
        controls
        playsInline
        preload="metadata"
        onPlay={handlePlay}
      >
        <source src={src} type="video/mp4" />
        Your browser does not support embedded video. Use the links below to
        start a free trial or book a demo.
      </video>
    </div>
  );
}
