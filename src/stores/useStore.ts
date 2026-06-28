"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface HistoryEntry {
  id: number;
  type: "movie" | "tv";
  title: string;
  poster: string;
  watchedAt: number; // epoch ms
  progress: number; // 0-100
  episode?: string; // for TV: "S1E3"
}

export interface DownloadEntry {
  id: number;
  type: "movie" | "tv";
  title: string;
  poster: string;
  quality: string;
  sizeMB: number;
  downloadedAt: number;
  status: "queued" | "downloading" | "complete" | "failed";
  progress: number;
  cost: number;
}

export interface WatchlistEntry {
  id: number;
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
        // Kick off simulated progress
        const interval = setInterval(() => {
          const dl = get().downloads.find((d) => d.id === entry.id);
          if (!dl) {
            clearInterval(interval);
            return;
          }
          if (dl.progress >= 100) {
            clearInterval(interval);
            return;
          }
          set((s) => ({
            downloads: s.downloads.map((d) =>
              d.id === entry.id
                ? {
                    ...d,
                    progress: Math.min(100, d.progress + 5 + Math.random() * 10),
                    status: d.progress + 5 >= 100 ? "complete" : "downloading",
                  }
                : d
            ),
          }));
        }, 800);
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
