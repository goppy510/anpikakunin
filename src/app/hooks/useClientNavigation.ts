"use client";

import { useCallback } from "react";

export function useClientNavigation() {
  const navigateTo = useCallback((path: string) => {
    // 現在のパスと同じ場合は何もしない
    if (window.location.pathname === path) {
      return;
    }

    // History APIを使用してURLを変更（リロードなし）
    window.history.pushState({}, "", path);

    // popstateイベントを手動で発火（Next.jsが監視している）
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
  }, []);

  const replaceTo = useCallback((path: string) => {
    // 現在のパスと同じ場合は何もしない
    if (window.location.pathname === path) {
      return;
    }

    // replaceStateを使用してURLを置換（リロードなし）
    window.history.replaceState({}, "", path);

    // popstateイベントを手動で発火（Next.jsが監視している）
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
  }, []);

  return {
    navigateTo,
    replaceTo,
  };
}
