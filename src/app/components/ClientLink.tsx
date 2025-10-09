"use client";

import React from "react";
import { useRouter } from "./providers/RouterProvider";

interface ClientLinkProps {
  href: string;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export function ClientLink({ href, className, children, onClick }: ClientLinkProps) {
  const { navigateTo } = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick?.();
    navigateTo(href);
  };

  return (
    <a 
      href={href} 
      className={className} 
      onClick={handleClick}
    >
      {children}
    </a>
  );
}