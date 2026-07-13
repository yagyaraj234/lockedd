export type ThemeName = 'dark' | 'light';
export type ThemePreference = 'system' | ThemeName;

export type Palette = {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfacePressed: string;
  label: string;
  labelSecondary: string;
  labelTertiary: string;
  separator: string;
  accent: string;
  accentMuted: string;
  onAccent: string;
  danger: string;
  dangerMuted: string;
  scrim: string;
  skeleton: string;
  switchTrackOff: string;
  illustration: string;
  illustrationLine: string;
};

export const DarkColors: Palette = {
  background: '#0B0C0A',
  surface: '#161813',
  surfaceElevated: '#20231C',
  surfacePressed: '#292D23',
  label: '#F5F7F0',
  labelSecondary: '#A8ADA0',
  labelTertiary: '#74796E',
  separator: 'rgba(255,255,255,0.08)',
  accent: '#B7D95B',
  accentMuted: 'rgba(183,217,91,0.14)',
  onAccent: '#12150B',
  danger: '#FF6B66',
  dangerMuted: 'rgba(255,107,102,0.12)',
  scrim: 'rgba(0,0,0,0.58)',
  skeleton: '#292D23',
  switchTrackOff: '#40443C',
  illustration: '#1D201A',
  illustrationLine: '#4C5147',
};

export const LightColors: Palette = {
  background: '#F2F3EE',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfacePressed: '#E8EAE3',
  label: '#171914',
  labelSecondary: '#5F645A',
  labelTertiary: '#898E84',
  separator: 'rgba(23,25,20,0.10)',
  accent: '#668400',
  accentMuted: 'rgba(102,132,0,0.12)',
  onAccent: '#FFFFFF',
  danger: '#C83F3A',
  dangerMuted: 'rgba(200,63,58,0.10)',
  scrim: 'rgba(0,0,0,0.34)',
  skeleton: '#E2E5DC',
  switchTrackOff: '#C8CCC3',
  illustration: '#FFFFFF',
  illustrationLine: '#B9BEB4',
};

export const Palettes: Record<ThemeName, Palette> = {
  dark: DarkColors,
  light: LightColors,
};

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const Radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;
export const Type = {
  largeTitle: { fontSize: 34, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.7 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 17, lineHeight: 23, fontWeight: '400' as const },
  bodyStrong: { fontSize: 17, lineHeight: 23, fontWeight: '600' as const },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  footnoteStrong: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
} as const;
export const Motion = { quick: 120, standard: 220, spring: { stiffness: 360, damping: 38, mass: 1 } } as const;

export const Colors = DarkColors;
