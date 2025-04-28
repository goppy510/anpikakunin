"use client";

import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/app/components/ThemeProvider";
import React from "react";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>{/* Fonts and icons are now moved to _document.tsx */}</head>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
