"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { JSX, Suspense } from "react";

const MainPage = dynamic(() => import("@/app/components/main/page"));
const OauthPage = dynamic(() => import("@/app/components/oauth/page"));
const SafetyConfirmationDashboard = dynamic(() => import("@/app/components/safety-confirmation/pages/SafetyConfirmationDashboard").then(mod => ({ default: mod.SafetyConfirmationDashboard })));

export default function AppLayout() {
  const pathname = usePathname();
  const [currentRoute, setCurrentRoute] = useState(pathname);

  // カスタムルーティング状態を管理
  useEffect(() => {
    setCurrentRoute(pathname);
  }, [pathname]);

  // popstate（ブラウザの戻る/進むボタン）を監視
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname);
    };

    const handleRouteChange = () => {
      setCurrentRoute(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('routeChange', handleRouteChange);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('routeChange', handleRouteChange);
    };
  }, []);

  let PageComponent: JSX.Element | null = null;

  if (currentRoute.startsWith("/oauth")) {
    PageComponent = <OauthPage />;
  } else if (currentRoute.startsWith("/safety-confirmation")) {
    PageComponent = <SafetyConfirmationDashboard />;
  } else {
    PageComponent = <MainPage />;
  }

  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>{PageComponent}</Suspense>
    </div>
  );
}
