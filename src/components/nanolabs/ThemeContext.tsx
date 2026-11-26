'use client';

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ColorPalette, PALETTES, DEFAULT_PALETTE_ID, getPalette, applyPaletteToDOM } from './palettes';

export type ERPTheme = '1' | '2';

interface ERPThemeContextType {
  theme: ERPTheme;
  setTheme: (theme: ERPTheme) => void;
  toggleERPTheme: () => void;
  palette: ColorPalette;
  setPalette: (paletteId: string) => void;
  isDark: boolean;
  toggleDarkMode: () => void;
}

const ERPThemeContext = createContext<ERPThemeContextType>({
  theme: '2',
  setTheme: () => {},
  toggleERPTheme: () => {},
  palette: PALETTES[DEFAULT_PALETTE_ID],
  setPalette: () => {},
  isDark: true,
  toggleDarkMode: () => {},
});

export const useERPTheme = () => useContext(ERPThemeContext);

export function ERPThemeProvider({
  initialTheme = '2',
  initialPaletteId = DEFAULT_PALETTE_ID,
  children,
}: {
  initialTheme?: ERPTheme;
  initialPaletteId?: string;
  children: ReactNode;
}) {
  const [theme, setThemeState] = useState<ERPTheme>(initialTheme);
  const [palette, setPaletteState] = useState<ColorPalette>(getPalette(initialPaletteId));
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const searchParams = new URLSearchParams(window.location.search);
    const urlPalette = searchParams.get('palette');
    let resolvedPaletteId = initialPaletteId;

    if (urlPalette && PALETTES[urlPalette]) {
      resolvedPaletteId = urlPalette;
      document.cookie = `hub_palette=${urlPalette}; path=/; max-age=31536000; SameSite=Lax`;
      localStorage.setItem('hub_palette', urlPalette);
    } else {
      const savedPalette = localStorage.getItem('hub_palette');
      if (savedPalette && PALETTES[savedPalette]) {
        resolvedPaletteId = savedPalette;
      }
    }
    const pal = getPalette(resolvedPaletteId);
    setPaletteState(pal);

    const savedThemeMode = localStorage.getItem('nl-theme');
    const resolvedDark = savedThemeMode ? savedThemeMode === 'dark' : true;
    setIsDark(resolvedDark);

    const modeVal = resolvedDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', modeVal);
    if (resolvedDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    applyPaletteToDOM(pal, resolvedDark);
  }, [initialPaletteId]);

  const setTheme = (newTheme: ERPTheme) => {
    setThemeState(newTheme);
  };

  const toggleERPTheme = () => {
    setTheme(theme === '1' ? '2' : '1');
  };

  const setPalette = (paletteId: string) => {
    const pal = getPalette(paletteId);
    setPaletteState(pal);
    if (typeof document !== 'undefined') {
      document.cookie = `hub_palette=${paletteId}; path=/; max-age=31536000; SameSite=Lax`;
      localStorage.setItem('hub_palette', paletteId);
      applyPaletteToDOM(pal, isDark);
    }
  };

  const toggleDarkMode = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (typeof document !== 'undefined') {
      const val = nextDark ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', val);
      if (nextDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('nl-theme', val);
      applyPaletteToDOM(palette, nextDark);
    }
  };

  return (
    <ERPThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleERPTheme,
        palette,
        setPalette,
        isDark,
        toggleDarkMode,
      }}
    >
      {children}
    </ERPThemeContext.Provider>
  );
}
