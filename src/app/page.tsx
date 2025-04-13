"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { JSX, Suspense } from "react";
import pack from "../../package.json";

const MainPage = dynamic(() => import("@/app/components/main/page"));
const OauthPage = dynamic(() => import("@/app/components/oauth/page"));

export default function AppLayout() {
  const pathname = usePathname();

  let PageComponent: JSX.Element | null = null;

  if (pathname.startsWith("/oauth")) {
    PageComponent = <OauthPage />;
  } else {
    PageComponent = <MainPage />;
  }

  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>{PageComponent}</Suspense>
    </div>
  );
}
