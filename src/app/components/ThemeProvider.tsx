'use client'

import * as React from 'react'
import { useState, useEffect } from 'react'

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps, useTheme } from 'next-themes'

const ThemeProvider = ({ children, ...props }: ThemeProviderProps) => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <>{children}</>
  }

  return (
    <NextThemesProvider {...props} suppressHydrationWarning>
      {children}
    </NextThemesProvider>
  )
}

export { ThemeProvider, useTheme }
