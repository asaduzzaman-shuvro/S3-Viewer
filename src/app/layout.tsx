import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Distinctive geometric display face for titles — gives the app character
// beyond the system/Arial default.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "S3 Storage Viewer",
  description: "Browse and preview files in an S3 bucket.",
};

// Runs synchronously before first paint: resolves the stored theme preference
// ("light" | "dark" | "system" | none) to a concrete light/dark value and sets it on
// <html data-theme>, so the page renders in the right theme with no flash. "system"
// (and the no-preference default) falls back to the OS setting.
const themeInitScript = `(function(){try{var p=localStorage.getItem("theme");var d=(p==="light"||p==="dark")?p:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=d;}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the inline script sets data-theme on <html> before
    // React hydrates, so the server/client attributes differ by design.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning on <body>: browser extensions (e.g. Grammarly)
          inject data-* attributes before React hydrates, which otherwise trips a
          benign hydration-mismatch warning. */}
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
