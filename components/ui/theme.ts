import type { AppTheme } from '@/hooks/useTheme';

export const colors = {
  light: { background: '#F7F8FA', surface: '#FFFFFF', text: '#15171A', muted: '#656B73', border: '#E1E4E8', accent: '#2563EB', danger: '#B42318' },
  dark: { background: '#101214', surface: '#1A1D21', text: '#F5F7FA', muted: '#A6ADB7', border: '#30353B', accent: '#7DA7FF', danger: '#FF8B82' },
} as const;

export const palette = (theme: AppTheme) => colors[theme];
