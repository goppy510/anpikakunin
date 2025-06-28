"use client";

import React from "react";
import { useClientNavigation } from "../hooks/useClientNavigation";

interface ClientLinkProps {
  href: string;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export function ClientLink({ href, className, children, onClick }: ClientLinkProps) {
  const { navigateTo } = useClientNavigation();

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