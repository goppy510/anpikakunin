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
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
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
