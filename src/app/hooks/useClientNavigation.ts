"use client";

import { useCallback } from "react";

export function useClientNavigation() {
  const navigateTo = useCallback((path: string) => {
    // History APIを使用してURLを変更（リロードなし）
    window.history.pushState({}, '', path);
    
    // カスタムイベントを発行してルーティング状態を更新
    window.dispatchEvent(new CustomEvent('routeChange'));
  }, []);

  const replaceTo = useCallback((path: string) => {
    // replaceStateを使用してURLを置換（リロードなし）
    window.history.replaceState({}, '', path);
    
    // カスタムイベントを発行してルーティング状態を更新
    window.dispatchEvent(new CustomEvent('routeChange'));
  }, []);

  return {
    navigateTo,
    replaceTo
  };
}