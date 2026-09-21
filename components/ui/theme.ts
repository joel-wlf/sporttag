import { useTheme, type AppTheme } from '@/hooks/useTheme';

/**
 * JS-Spiegel der Design-Tokens aus global.css.
 * Nur für Werte nötig, die nicht als className gesetzt werden können,
 * etwa Spinner-, Icon- und Glass-Farben.
 */
export type ThemeTokens = {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  subtle: string;
  border: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  secondary: string;
  accent: string;
  muted: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  shadow: string;
};

export const colors: Record<AppTheme, ThemeTokens> = {
  light: {
    background: '#F6F5EF',
    surface: '#FFFFFF',
    surfaceMuted: '#F0F1E8',
    text: '#22251F',
    subtle: '#6D7166',
    border: '#DFE1D6',
    primary: '#556B2F',
    primarySoft: '#E3E5D8',
    onPrimary: '#FFFFFF',
    secondary: '#A9B58A',
    accent: '#C59A4A',
    muted: '#E3E5D8',
    danger: '#A33A32',
    dangerSoft: '#F7E5E1',
    success: '#3F6B3A',
    successSoft: '#E6EFE1',
    warning: '#8A651F',
    warningSoft: '#F6ECD6',
    shadow: '#151910',
  },
  dark: {
    background: '#161812',
    surface: '#21241C',
    surfaceMuted: '#2B2F24',
    text: '#F6F5EF',
    subtle: '#B8BCAD',
    border: '#3A4032',
    primary: '#A9B58A',
    primarySoft: '#343B29',
    onPrimary: '#1B1F14',
    secondary: '#7F8E62',
    accent: '#D5AF67',
    muted: '#2B2F24',
    danger: '#FF9188',
    dangerSoft: '#3A2320',
    success: '#9CCF8F',
    successSoft: '#24301F',
    warning: '#E2BE7A',
    warningSoft: '#342C19',
    shadow: '#000000',
  },
};

export const palette = (theme: AppTheme): ThemeTokens => colors[theme];

export const useTokens = (): ThemeTokens => palette(useTheme());
