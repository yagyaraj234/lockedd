import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Palette, Palettes, ThemeName } from './colors';
import { getSettings, updateSettings, subscribeSettings } from './store/storage';

interface ThemeContextValue {
  name: ThemeName;
  colors: Palette;
  setTheme: (name: ThemeName) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [name, setName] = useState<ThemeName>(() => getSettings().theme);

  // Keep the in-memory theme in sync with persisted settings — covers writes
  // from anywhere (Settings screen, onboarding) through one source of truth.
  useEffect(() => subscribeSettings(() => setName(getSettings().theme)), []);

  const value = useMemo<ThemeContextValue>(() => {
    const setTheme = (next: ThemeName) => updateSettings({ theme: next });
    return {
      name,
      colors: Palettes[name],
      setTheme,
      toggle: () => setTheme(name === 'dark' ? 'light' : 'dark'),
    };
  }, [name]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};
