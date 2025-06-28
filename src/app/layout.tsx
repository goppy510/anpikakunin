"use client";

import "./globals.css";
import { ThemeProvider } from "@/app/components/ThemeProvider";
import { WebSocketProvider } from "@/app/components/providers/WebSocketProvider";
import React from "react";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head></head>
      <body className="antialiased" suppressHydrationWarning={true}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <WebSocketProvider>
            {children}
          </WebSocketProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
