import { useColorScheme } from 'react-native';

export type AppTheme = 'light' | 'dark';
export const useTheme = (): AppTheme => (useColorScheme() === 'dark' ? 'dark' : 'light');
