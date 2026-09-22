import { useWindowDimensions } from 'react-native';

/**
 * Matches the sidebar breakpoint in app/(backoffice)/_layout.tsx so table
 * layouts switch at the same width as the wide (sidebar) shell.
 */
export function useDesktop(threshold = 960) {
  const { width } = useWindowDimensions();
  return width >= threshold;
}
