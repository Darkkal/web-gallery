import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DynamicNavbar } from "@/components/client/DynamicNavbar";
import { ThemeProvider } from "@/components/ThemeProvider";

// All pages query the database at runtime — skip static prerendering during build.
// The database only exists in the mounted volume at runtime, not during `next build`.
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Web Gallery",
    template: "%s | Web Gallery",
  },
  description:
    "A personal media gallery for organizing and browsing downloaded content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <div className="app-container">
          <ThemeProvider>
            <DynamicNavbar />
            <main className="main-content">{children}</main>
          </ThemeProvider>
        </div>
      </body>
    </html>
  );
}
