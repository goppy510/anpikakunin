import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/app/components/ThemeProvider";
import React from "react";

export const metadata: Metadata = {
  title: "安否確認",
  description: "安否確認",
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>{/* Fonts and icons are now moved to _document.tsx */}</head>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
