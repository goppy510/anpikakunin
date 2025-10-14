import "./globals.css";
import { ClientProviders } from "@/app/components/providers/ClientProviders";
import React from "react";
import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "安否確認システム",
  description: "地震発生時の安否確認システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        {/* Font Awesome は Script コンポーネント経由で読み込み */}
      </head>
      <body className="antialiased" suppressHydrationWarning={true}>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
