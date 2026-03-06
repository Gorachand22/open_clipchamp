import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Video Editor - Professional Video Editing",
  description: "Professional video editor with timeline, drag-and-drop media library, and real-time preview. Built with Next.js and TypeScript.",
  keywords: ["video editor", "clipchamp", "Next.js", "TypeScript", "Tailwind CSS", "video editing", "timeline"],
  authors: [{ name: "Z.ai Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Video Editor",
    description: "Professional video editing in the browser",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-white`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
