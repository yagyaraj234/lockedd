// Theme palettes. Both palettes expose the SAME keys so any component can be
// rendered under either theme just by swapping the object it reads from (see
// src/theme.tsx). `Colors` stays the default dark palette for any module-level
// references; theme-reactive components read the active palette via useTheme().

export type Palette = {
  bg: string;
  bgDark: string;
  bgSecondary: string;
  accent: string;
  accentDark: string;
  // Soft accent tint used for chip/badge backgrounds.
  accentSoft: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  // Hairline divider / subtle border.
  border: string;
  // Empty-state illustration fills/strokes (ghost shapes).
  illustrationBg: string;
  illustrationLine: string;
  illustrationLineSoft: string;
  // Soft danger tint for the error illustration fill.
  dangerSoft: string;
  danger: string;
  blue: string;
  blueDark: string;
  // Switch off-track color (visible in both themes).
  switchTrackOff: string;
};

export const DarkColors: Palette = {
  bg: '#0D0D0D',
  bgDark: '#000000',
  bgSecondary: '#1A1A1A',
  accent: '#CCFF00',
  accentDark: '#B3E600',
  accentSoft: 'rgba(204,255,0,0.1)',
  text: '#FFFFFF',
  textSecondary: '#999999',
  textTertiary: '#666666',
  border: 'rgba(255,255,255,0.06)',
  illustrationBg: '#151515',
  illustrationLine: '#383838',
  illustrationLineSoft: '#444444',
  dangerSoft: '#1A0606',
  danger: '#FF4747',
  blue: '#1E90FF',
  blueDark: '#1565B8',
  switchTrackOff: '#3A3A3A',
};

// Neon #CCFF00 is unreadable as text/border on white, so light mode uses a
// darker green for those roles. The "accent fill + Colors.bg text" pattern used
// across the app auto-flips because bg flips with the theme.
export const LightColors: Palette = {
  // bg (warm light gray) and bgSecondary (white cards) are kept ~6% apart so
  // borderless cards stay visible against the page.
  bg: '#EAEAE4',
  bgDark: '#FFFFFF',
  bgSecondary: '#FFFFFF',
  accent: '#4D6B00',
  accentDark: '#3D5500',
  accentSoft: 'rgba(77,107,0,0.12)',
  text: '#0D0D0D',
  textSecondary: '#5C5C5C',
  textTertiary: '#8A8A8A',
  border: 'rgba(0,0,0,0.10)',
  illustrationBg: '#FFFFFF',
  illustrationLine: '#C4C4BE',
  illustrationLineSoft: '#D2D2CC',
  dangerSoft: 'rgba(214,48,48,0.1)',
  danger: '#D63030',
  blue: '#1565B8',
  blueDark: '#0E4A8A',
  switchTrackOff: '#C4C4BE',
};

export type ThemeName = 'dark' | 'light';

export const Palettes: Record<ThemeName, Palette> = {
  dark: DarkColors,
  light: LightColors,
};

// Default static export (dark) — used by module-level fallbacks that aren't
// inside a React component (e.g. icon default stroke).
export const Colors = DarkColors;
