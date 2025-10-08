"use client";

import dynamic from "next/dynamic";
import { JSX, Suspense } from "react";
import { useRouter } from "@/app/components/providers/RouterProvider";

const MainPage = dynamic(() => import("@/app/components/main/page"));
const OauthPage = dynamic(() => import("@/app/components/oauth/page"));
const SafetyConfirmationDashboard = dynamic(() => import("@/app/components/safety-confirmation/pages/SafetyConfirmationDashboard").then(mod => ({ default: mod.SafetyConfirmationDashboard })));

export default function AppLayout() {
  const { currentRoute } = useRouter();

  let PageComponent: JSX.Element | null = null;

  if (currentRoute.startsWith("/oauth")) {
    PageComponent = <OauthPage />;
  } else if (
    currentRoute === "/" ||
    currentRoute.startsWith("/safety-confirmation")
  ) {
    PageComponent = <SafetyConfirmationDashboard />;
  } else if (currentRoute.startsWith("/monitor")) {
    PageComponent = <MainPage />;
  } else {
    PageComponent = <SafetyConfirmationDashboard />;
  }

  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>{PageComponent}</Suspense>
    </div>
  );
}
