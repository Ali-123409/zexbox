"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface HistoryEntry {
  id: number | string; // Store original ID (string for MovieBox, number for catalog)
  type: "movie" | "tv";
  title: string;
  poster: string;
  watchedAt: number; // epoch ms
  progress: number; // 0-100
  episode?: string; // for TV: "S1E3"
}

export interface DownloadEntry {
  id: number | string;
  type: "movie" | "tv";
  title: string;
  poster: string;
  quality: string;
  sizeMB: number;
  downloadedAt: number;
  status: "queued" | "downloading" | "complete" | "failed";
  progress: number;
  cost: number;
  streamUrl?: string;       // Real stream URL from MovieBox
  blobUrl?: string;         // Local blob URL after download (for offline playback)
  downloadSpeed?: string;   // Current download speed (e.g. "2.3 MB/s")
}

export interface WatchlistEntry {
  id: number | string;
  type: "movie" | "tv";
  title: string;
  poster: string;
  addedAt: number;
}

interface StoreState {
  // Coins
  coins: number;
  lastDailyCheckIn: number;
  addCoins: (n: number) => void;
  spendCoins: (n: number) => boolean;
  dailyCheckIn: () => boolean;
  watchAdForCoins: () => void;

  // History
  history: HistoryEntry[];
  addToHistory: (entry: Omit<HistoryEntry, "watchedAt">) => void;
  clearHistory: () => void;

  // Watchlist
  watchlist: WatchlistEntry[];
  toggleWatchlist: (entry: Omit<WatchlistEntry, "addedAt">) => void;
  isInWatchlist: (id: number) => boolean;

  // Downloads
  downloads: DownloadEntry[];
  startDownload: (entry: Omit<DownloadEntry, "downloadedAt" | "status" | "progress">) => boolean;
  tickDownload: (id: number) => void;
  removeDownload: (id: number) => void;
  clearDownloads: () => void;

  // Settings
  preferredQuality: string;
  setPreferredQuality: (q: string) => void;
}

const DAILY_CHECKIN_AMOUNT = 10;
const AD_REWARD = 15;
const STARTING_COINS = 100;

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      coins: STARTING_COINS,
      lastDailyCheckIn: 0,

      addCoins: (n) => set((s) => ({ coins: Math.max(0, s.coins + n) })),

      spendCoins: (n) => {
        if (get().coins < n) return false;
        set((s) => ({ coins: s.coins - n }));
        return true;
      },

      dailyCheckIn: () => {
        const now = Date.now();
        const last = get().lastDailyCheckIn;
        const oneDay = 24 * 60 * 60 * 1000;
        if (now - last < oneDay) return false;
        set((s) => ({
          coins: s.coins + DAILY_CHECKIN_AMOUNT,
          lastDailyCheckIn: now,
        }));
        return true;
      },

      watchAdForCoins: () => {
        set((s) => ({ coins: s.coins + AD_REWARD }));
      },

      // ===== History =====
      history: [],
      addToHistory: (entry) =>
        set((s) => {
          const filtered = s.history.filter((h) => h.id !== entry.id);
          return {
            history: [{ ...entry, watchedAt: Date.now() }, ...filtered].slice(0, 50),
          };
        }),
      clearHistory: () => set({ history: [] }),

      // ===== Watchlist =====
      watchlist: [],
      toggleWatchlist: (entry) =>
        set((s) => {
          const exists = s.watchlist.find((w) => w.id === entry.id);
          if (exists) {
            return { watchlist: s.watchlist.filter((w) => w.id !== entry.id) };
          }
          return {
            watchlist: [{ ...entry, addedAt: Date.now() }, ...s.watchlist],
          };
        }),
      isInWatchlist: (id) => !!get().watchlist.find((w) => w.id === id),

      // ===== Downloads =====
      downloads: [],
      startDownload: (entry) => {
        if (!get().spendCoins(entry.cost)) return false;
        const newEntry: DownloadEntry = {
          ...entry,
          downloadedAt: Date.now(),
          status: "downloading",
          progress: 0,
        };
        set((s) => ({ downloads: [newEntry, ...s.downloads] }));

        // === REAL DOWNLOAD: fetch the actual MP4 file with progress tracking ===
        if (entry.streamUrl) {
          (async () => {
            const downloadId = entry.id;
            const updateProgress = (progress: number, speed?: string) => {
              set((s) => ({
                downloads: s.downloads.map((d) =>
                  d.id === downloadId
                    ? { ...d, progress: Math.min(100, progress), downloadSpeed: speed, status: progress >= 100 ? "complete" : "downloading" }
                    : d
                ),
              }));
            };

            try {
              const response = await fetch(entry.streamUrl!);
              if (!response.ok) throw new Error(`HTTP ${response.status}`);

              const contentLength = Number(response.headers.get("content-length") || 0);
              const totalMB = contentLength > 0 ? contentLength / (1024 * 1024) : entry.sizeMB;

              const reader = response.body?.getReader();
              if (!reader) throw new Error("No readable stream");

              const chunks: Uint8Array[] = [];
              let receivedBytes = 0;
              const startTime = Date.now();

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                chunks.push(value);
                receivedBytes += value.length;

                const progress = contentLength > 0 ? (receivedBytes / contentLength) * 100 : 0;
                const elapsedSec = (Date.now() - startTime) / 1000;
                const speedMBps = elapsedSec > 0 ? (receivedBytes / (1024 * 1024)) / elapsedSec : 0;
                const speedStr = speedMBps >= 1 ? `${speedMBps.toFixed(1)} MB/s` : `${(speedMBps * 1024).toFixed(0)} KB/s`;

                updateProgress(progress, speedStr);
              }

              // Create blob and save to device
              const blob = new Blob(chunks, { type: "video/mp4" });
              const blobUrl = URL.createObjectURL(blob);

              // Trigger browser download to save the file
              const a = document.createElement("a");
              a.href = blobUrl;
              a.download = `${entry.title} (${entry.quality}).mp4`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);

              // Mark as complete with blob URL for offline playback
              set((s) => ({
                downloads: s.downloads.map((d) =>
                  d.id === downloadId
                    ? { ...d, progress: 100, status: "complete", blobUrl, sizeMB: Math.round(totalMB) }
                    : d
                ),
              }));
            } catch (e: any) {
              set((s) => ({
                downloads: s.downloads.map((d) =>
                  d.id === downloadId
                    ? { ...d, status: "failed", downloadSpeed: undefined }
                    : d
                ),
              }));
            }
          })();
        } else {
          // Fallback: no stream URL — mark as failed
          set((s) => ({
            downloads: s.downloads.map((d) =>
              d.id === entry.id ? { ...d, status: "failed" } : d
            ),
          }));
        }
        return true;
      },
      tickDownload: (id) =>
        set((s) => ({
          downloads: s.downloads.map((d) =>
            d.id === id
              ? {
                  ...d,
                  progress: Math.min(100, d.progress + 5),
                  status: d.progress + 5 >= 100 ? "complete" : d.status,
                }
              : d
          ),
        })),
      removeDownload: (id) =>
        set((s) => ({ downloads: s.downloads.filter((d) => d.id !== id) })),
      clearDownloads: () => set({ downloads: [] }),

      // ===== Settings =====
      preferredQuality: "Auto",
      setPreferredQuality: (q) => set({ preferredQuality: q }),
    }),
    {
      name: "zexbox-store",
      version: 1,
    }
  )
);
