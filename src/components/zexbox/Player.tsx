"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { X, AlertCircle, Loader2, ExternalLink } from "lucide-react";

interface PlayerProps {
  title: string;
  streamUrl?: string; // .m3u8 / .mp4 direct
  embedUrl?: string; // iframe embed (multiembed etc.)
  poster?: string;
  onClose: () => void;
}

export default function Player({ title, streamUrl, embedUrl, poster, onClose }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<"loading" | "hls" | "mp4" | "embed" | "error">(
    () => (embedUrl ? "embed" : !streamUrl ? "error" : "mp4")
  );
  const [errorMsg, setErrorMsg] = useState(() => (!embedUrl && !streamUrl ? "No stream URL available." : ""));

  useEffect(() => {
    if (embedUrl) return;
    if (!streamUrl) return;
    const v = videoRef.current;
    if (!v) return;

    if (streamUrl.endsWith(".m3u8")) {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true });
        hls.loadSource(streamUrl);
        hls.attachMedia(v);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setMode("hls");
          v.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            setMode("error");
            setErrorMsg(`Stream error: ${data.details || data.type}`);
          }
        });
        return () => hls.destroy();
      } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
        v.src = streamUrl;
        v.addEventListener("loadedmetadata", () => setMode("hls"), { once: true });
        v.play().catch(() => {});
      } else {
        Promise.resolve().then(() => {
          setMode("error");
          setErrorMsg("HLS not supported in this browser.");
        });
      }
    } else {
      // MP4 or other direct formats — set src and let the <video> element load it
      v.src = streamUrl;
      v.load();
      v.play().catch(() => {});
    }
  }, [streamUrl, embedUrl]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Esc to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm">
      <button
        onClick={onClose}
        aria-label="Close player"
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition"
      >
        <X className="h-6 w-6" />
      </button>

      <div className="relative w-full max-w-6xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
        {mode === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <Loader2 className="h-10 w-10 animate-spin text-purple-400" />
          </div>
        )}

        {mode === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-400" />
            <p className="text-lg font-semibold">Unable to play this title</p>
            <p className="text-sm text-white/60 max-w-md">{errorMsg}</p>
            {embedUrl && (
              <a
                href={embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium hover:bg-purple-500 transition"
              >
                Open stream in new tab <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        )}

        {(mode === "hls" || mode === "mp4" || mode === "loading") && (
          <video
            ref={videoRef}
            controls
            autoPlay
            poster={poster}
            className="h-full w-full"
            title={title}
          />
        )}

        {mode === "embed" && embedUrl && (
          <iframe
            src={embedUrl}
            title={title}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="origin"
            className="h-full w-full border-0"
          />
        )}
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center text-white/70 text-sm">
        {title}
      </div>
    </div>
  );
}
