import type { AppTheme } from '@/hooks/useTheme';

export const colors = {
  light: { background: '#F6F5EF', surface: '#FFFFFF', surfaceMuted: '#F0F1E8', text: '#22251F', muted: '#6D7166', border: '#DFE1D6', accent: '#556B2F', accentSoft: '#E3E5D8', secondary: '#A9B58A', gold: '#C59A4A', danger: '#A33A32' },
  dark: { background: '#161812', surface: '#21241C', surfaceMuted: '#2B2F24', text: '#F6F5EF', muted: '#B8BCAD', border: '#3A4032', accent: '#A9B58A', accentSoft: '#343B29', secondary: '#7F8E62', gold: '#D5AF67', danger: '#FF9188' },
} as const;

export const palette = (theme: AppTheme) => colors[theme];
