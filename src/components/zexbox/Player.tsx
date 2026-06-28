"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import {
  X, AlertCircle, Loader2, ExternalLink,
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, ChevronLeft, ChevronRight,
} from "lucide-react";

interface PlayerProps {
  title: string;
  streamUrl?: string;
  embedUrl?: string;
  poster?: string;
  onClose: () => void;
  seasonTabs?: number[];
  currentSeason?: number;
  currentEpisode?: number;
  maxEpisodes?: number;
  onSeasonChange?: (season: number) => void;
  onEpisodeChange?: (episode: number) => void;
}

function formatTime(s: number): string {
  if (!s || isNaN(s)) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function Player({
  title, streamUrl, embedUrl, poster, onClose,
  seasonTabs, currentSeason, currentEpisode, maxEpisodes,
  onSeasonChange, onEpisodeChange,
}: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isEmbed, setIsEmbed] = useState(!!embedUrl);
  const [error, setError] = useState(!embedUrl && !streamUrl ? "No stream URL available." : "");
  const [loading, setLoading] = useState(!embedUrl && !!streamUrl);

  // Reset state when streamUrl/embedUrl changes (via key prop from parent)
  // Track prop changes with a ref to avoid setState-in-effect lint
  const prevStreamRef = useRef({ streamUrl, embedUrl });
  useEffect(() => {
    if (prevStreamRef.current.streamUrl !== streamUrl || prevStreamRef.current.embedUrl !== embedUrl) {
      prevStreamRef.current = { streamUrl, embedUrl };
      // Reset will happen via key prop remount, but sync state just in case
    }
  }, [streamUrl, embedUrl]);

  // Video state
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load stream — key prop on parent ensures full remount on URL change
  // setLoading/setError are called inside event handlers (not directly in effect body)
  useEffect(() => {
    if (isEmbed || !streamUrl) return;

    const v = videoRef.current;
    if (!v) return;

    v.removeAttribute("src");

    if (streamUrl.endsWith(".m3u8")) {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true });
        hls.loadSource(streamUrl);
        hls.attachMedia(v);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          v.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            Promise.resolve().then(() => setError(`Stream error: ${data.details || data.type}`));
          }
        });
        return () => hls.destroy();
      } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
        v.src = streamUrl;
        v.play().catch(() => {});
      } else {
        Promise.resolve().then(() => setError("HLS not supported."));
      }
    } else {
      v.src = streamUrl;
      v.load();
    }
  }, [streamUrl, isEmbed]);

  // Video event listeners
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrentTime(v.currentTime);
    const onDur = () => setDuration(v.duration);
    const onVol = () => { setVolume(v.volume); setMuted(v.muted); };
    const onLoaded = () => { setLoading(false); v.play().catch(() => {}); };
    const onError = () => { setLoading(false); setError("Failed to load video."); };
    const onProgress = () => {
      if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
    };

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("durationchange", onDur);
    v.addEventListener("volumechange", onVol);
    v.addEventListener("loadeddata", onLoaded);
    v.addEventListener("error", onError);
    v.addEventListener("progress", onProgress);

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("durationchange", onDur);
      v.removeEventListener("volumechange", onVol);
      v.removeEventListener("loadeddata", onLoaded);
      v.removeEventListener("error", onError);
      v.removeEventListener("progress", onProgress);
    };
  }, []);

  // Fullscreen
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Auto-hide controls
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  }, [playing]);

  // Controls
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  };

  const seek = (time: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, time));
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  };

  const changeVolume = (vol: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = vol;
    v.muted = vol === 0;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) { onClose(); return; }
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
      if (e.key === "ArrowLeft") seek(currentTime - 10);
      if (e.key === "ArrowRight") seek(currentTime + 10);
      if (e.key === "f") toggleFullscreen();
      if (e.key === "m") toggleMute();
      showControlsTemporarily();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentTime, onClose, showControlsTemporarily]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const hasNav = onEpisodeChange && maxEpisodes && currentEpisode;
  const hasSeasons = seasonTabs && seasonTabs.length > 1 && onSeasonChange;
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Close player"
        className="absolute right-4 top-4 z-30 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition"
      >
        <X className="h-6 w-6" />
      </button>

      <div className="w-full max-w-6xl px-4">
        {/* Video container */}
        <div
          ref={containerRef}
          className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group"
          onMouseMove={showControlsTemporarily}
          onMouseLeave={() => playing && setShowControls(false)}
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-white z-20 bg-black/50">
              <Loader2 className="h-12 w-12 animate-spin text-[#e50914]" />
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white p-6 text-center z-20">
              <AlertCircle className="h-12 w-12 text-red-400" />
              <p className="text-lg font-semibold">Unable to play this title</p>
              <p className="text-sm text-white/60 max-w-md">{error}</p>
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

          {/* Video element (always rendered for direct streams) */}
          {!isEmbed && !error && (
            <video
              ref={videoRef}
              poster={poster}
              className="h-full w-full"
              title={title}
              onClick={togglePlay}
              playsInline
            />
          )}

          {/* Embed iframe */}
          {isEmbed && embedUrl && (
            <iframe
              src={embedUrl}
              title={title}
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="origin"
              className="h-full w-full border-0"
            />
          )}

          {/* Custom controls overlay (only for direct streams) */}
          {!isEmbed && !error && !loading && (
            <div
              className={`absolute inset-0 z-10 flex flex-col justify-between transition-opacity duration-300 ${
                showControls ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              {/* Top gradient + title */}
              <div className="bg-gradient-to-b from-black/80 to-transparent p-4 pb-12">
                <p className="text-white text-sm font-medium truncate">{title}</p>
              </div>

              {/* Center play/pause button */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <button
                  onClick={togglePlay}
                  className="bg-black/50 rounded-full p-4 hover:bg-black/70 transition pointer-events-auto"
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? (
                    <Pause className="h-8 w-8 text-white fill-white" />
                  ) : (
                    <Play className="h-8 w-8 text-white fill-white" />
                  )}
                </button>
              </div>

              {/* Bottom controls */}
              <div className="bg-gradient-to-t from-black/90 to-transparent p-4 pt-12 space-y-2">
                {/* Seekbar */}
                <div className="relative h-1.5 bg-white/20 rounded-full cursor-pointer group/seek"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = (e.clientX - rect.left) / rect.width;
                    seek(pct * duration);
                  }}
                >
                  {/* Buffered */}
                  <div className="absolute inset-y-0 left-0 bg-white/30 rounded-full" style={{ width: `${bufferedPct}%` }} />
                  {/* Played */}
                  <div className="absolute inset-y-0 left-0 bg-[#e50914] rounded-full" style={{ width: `${progressPct}%` }} />
                  {/* Seek handle */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/seek:opacity-100 transition"
                    style={{ left: `${progressPct}%` }}
                  />
                </div>

                {/* Control buttons */}
                <div className="flex items-center gap-3 text-white">
                  {/* Prev episode */}
                  {hasNav && (
                    <button
                      onClick={() => currentEpisode! > 1 && onEpisodeChange!(currentEpisode! - 1)}
                      disabled={currentEpisode! <= 1}
                      className="hover:text-[#e50914] transition disabled:opacity-30"
                      aria-label="Previous episode"
                    >
                      <SkipBack className="h-5 w-5" />
                    </button>
                  )}

                  {/* Play/Pause */}
                  <button onClick={togglePlay} className="hover:text-[#e50914] transition" aria-label={playing ? "Pause" : "Play"}>
                    {playing ? <Pause className="h-6 w-6 fill-white" /> : <Play className="h-6 w-6 fill-white" />}
                  </button>

                  {/* Next episode */}
                  {hasNav && (
                    <button
                      onClick={() => currentEpisode! < maxEpisodes! && onEpisodeChange!(currentEpisode! + 1)}
                      disabled={currentEpisode! >= maxEpisodes!}
                      className="hover:text-[#e50914] transition disabled:opacity-30"
                      aria-label="Next episode"
                    >
                      <SkipForward className="h-5 w-5" />
                    </button>
                  )}

                  {/* Volume */}
                  <button onClick={toggleMute} className="hover:text-[#e50914] transition" aria-label={muted ? "Unmute" : "Mute"}>
                    {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </button>
                  <input
                    type="range"
                    min="0" max="1" step="0.05"
                    value={muted ? 0 : volume}
                    onChange={(e) => changeVolume(Number(e.target.value))}
                    className="w-16 h-1 accent-[#e50914] cursor-pointer"
                    aria-label="Volume"
                  />

                  {/* Time */}
                  <span className="text-xs font-mono text-white/80 ml-1">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>

                  <div className="flex-1" />

                  {/* Episode counter */}
                  {hasNav && (
                    <span className="text-xs text-white/60">
                      EP{currentEpisode} / {maxEpisodes}
                    </span>
                  )}

                  {/* Fullscreen */}
                  <button onClick={toggleFullscreen} className="hover:text-[#e50914] transition" aria-label="Fullscreen">
                    {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Title + navigation below video */}
        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-white/90 text-sm font-medium truncate flex-1">{title}</div>
          {hasNav && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => currentEpisode! > 1 && onEpisodeChange!(currentEpisode! - 1)}
                disabled={currentEpisode! <= 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <span className="text-white/60 text-sm px-2">EP{currentEpisode} / {maxEpisodes}</span>
              <button
                onClick={() => currentEpisode! < maxEpisodes! && onEpisodeChange!(currentEpisode! + 1)}
                disabled={currentEpisode! >= maxEpisodes!}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Season tabs below video */}
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
