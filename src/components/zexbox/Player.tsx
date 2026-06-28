"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { X, AlertCircle, Loader2, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

interface PlayerProps {
  title: string;
  streamUrl?: string;
  embedUrl?: string;
  poster?: string;
  onClose: () => void;
  // Optional: season/episode navigation (for TV shows)
  seasonTabs?: number[];
  currentSeason?: number;
  currentEpisode?: number;
  maxEpisodes?: number;
  onSeasonChange?: (season: number) => void;
  onEpisodeChange?: (episode: number) => void;
}

export default function Player({
  title, streamUrl, embedUrl, poster, onClose,
  seasonTabs, currentSeason, currentEpisode, maxEpisodes,
  onSeasonChange, onEpisodeChange,
}: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Reset mode when streamUrl/embedUrl changes (e.g., switching episodes)
  // Derive the initial mode from props; use a key-based reset via parent component instead
  const [mode, setMode] = useState<"loading" | "hls" | "mp4" | "embed" | "error">(
    () => (embedUrl ? "embed" : !streamUrl ? "error" : "mp4")
  );
  const [errorMsg, setErrorMsg] = useState(() => (!embedUrl && !streamUrl ? "No stream URL available." : ""));

  useEffect(() => {
    if (embedUrl) return;
    if (!streamUrl) return;
    const v = videoRef.current;
    if (!v) return;

    // Reset the video element
    v.removeAttribute("src");

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
      // MP4 — set src directly
      v.src = streamUrl;
      v.load();
      v.play().catch(() => {});
    }
  }, [streamUrl, embedUrl]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const hasNav = onEpisodeChange && maxEpisodes && currentEpisode;
  const hasSeasons = seasonTabs && seasonTabs.length > 1 && onSeasonChange;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm">
      <button
        onClick={onClose}
        aria-label="Close player"
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition"
      >
        <X className="h-6 w-6" />
      </button>

      <div className="relative w-full max-w-5xl">
        {/* Video container */}
        <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
          {mode === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <Loader2 className="h-10 w-10 animate-spin text-[#e50914]" />
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
                  className="mt-2 inline-flex items-center gap-2 rounded-md bg-[#e50914] px-4 py-2 text-sm font-medium hover:bg-[#f6121d] transition"
                >
                  Open stream in new tab <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          )}

          {/* Always render video element when we have a streamUrl (not embed, not error) */}
          {mode !== "embed" && mode !== "error" && (
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

        {/* Title bar below video */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-white/90 text-sm font-medium truncate flex-1">
            {title}
          </div>

          {/* Episode navigation (for TV) */}
          {hasNav && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => currentEpisode > 1 && onEpisodeChange!(currentEpisode - 1)}
                disabled={currentEpisode <= 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <span className="text-white/60 text-sm px-2">
                EP{currentEpisode} / {maxEpisodes}
              </span>
              <button
                onClick={() => currentEpisode < maxEpisodes! && onEpisodeChange!(currentEpisode + 1)}
                disabled={currentEpisode >= maxEpisodes!}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Season tabs (for TV with multiple seasons) */}
        {hasSeasons && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-white/40 text-xs mr-1">Seasons:</span>
            {seasonTabs!.map((s) => (
              <button
                key={s}
                onClick={() => onSeasonChange!(s)}
                className={`px-3 py-1 rounded text-sm font-medium transition ${
                  currentSeason === s
                    ? "bg-[#e50914] text-white"
                    : "bg-white/10 text-white/60 hover:text-white hover:bg-white/20"
                }`}
              >
                S{String(s).padStart(2, "0")}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
