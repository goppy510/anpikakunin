"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface RouterContextType {
  currentRoute: string;
  navigateTo: (path: string) => void;
}

const RouterContext = createContext<RouterContextType | null>(null);

export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error("useRouter must be used within a RouterProvider");
  }
  return context;
}

interface RouterProviderProps {
  children: React.ReactNode;
}

export function RouterProvider({ children }: RouterProviderProps) {
  const [currentRoute, setCurrentRoute] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return '/';
  });

  const navigateTo = (path: string) => {
    // 同じパスの場合は何もしない
    if (currentRoute === path) {
      return;
    }

    // URL を変更
    window.history.pushState({}, '', path);
    
    // 状態を更新
    setCurrentRoute(path);
  };

  // ブラウザの戻る/進むボタンを監視
  useEffect(() => {
    const handlePopState = () => {
      const newPath = window.location.pathname;
      setCurrentRoute(newPath);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  return (
    <RouterContext.Provider value={{ currentRoute, navigateTo }}>
      {children}
    </RouterContext.Provider>
  );
}