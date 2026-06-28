import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Zex Box — Watch Movies & TV Shows Free Online",
  description: "Stream movies and TV shows free. No account needed. Powered by the real MovieBox backend.",
  keywords: ["Zex Box", "watch movies online", "free movies", "tv shows", "streaming"],
  authors: [{ name: "Zex Box" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Zex Box",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d0d0f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className="antialiased"
        style={{
          backgroundColor: "#0d0d0f",
          color: "#fff",
          fontFamily: '"Segoe UI", "SF Pro Display", "PingFang SC", "Helvetica Neue", Arial, sans-serif',
        }}
      >
        {children}
        <Toaster
          position="top-center"
          theme="dark"
          toastOptions={{
            style: { background: "#1a1a1d", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" },
          }}
        />
      </body>
    </html>
  );
}
