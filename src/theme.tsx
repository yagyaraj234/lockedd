import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Palette, Palettes, ThemeName, ThemePreference } from './colors';
import { getSettings, updateSettings, subscribeSettings } from './store/storage';

interface ThemeContextValue {
  preference: ThemePreference;
  name: ThemeName;
  colors: Palette;
  setTheme: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemName = useColorScheme() === 'light' ? 'light' : 'dark';
  const [preference, setPreference] = useState<ThemePreference>(() => getSettings().theme);

  useEffect(() => subscribeSettings(() => setPreference(getSettings().theme)), []);

  const value = useMemo<ThemeContextValue>(() => {
    const name = preference === 'system' ? systemName : preference;
    return {
      preference,
      name,
      colors: Palettes[name],
      setTheme: (next) => updateSettings({ theme: next }),
    };
  }, [preference, systemName]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};
