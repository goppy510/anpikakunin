"use client";

import "./globals.css";
import { ThemeProvider } from "@/app/components/ThemeProvider";
import { WebSocketProvider } from "@/app/components/providers/WebSocketProvider";
import { RouterProvider } from "@/app/components/providers/RouterProvider";
import { WebSocketResponseMarker } from "@/app/components/monitor/WebSocketResponseMarker";
import { ApiHealthMonitor } from "@/app/components/monitor/ApiHealthMonitor";
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
          <RouterProvider>
            {/* WebSocket接続を一時的に無効化（開発中） */}
            {/* <WebSocketProvider>
              <WebSocketResponseMarker />
              {children}
            </WebSocketProvider> */}
            <ApiHealthMonitor />
            {children}
          </RouterProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
