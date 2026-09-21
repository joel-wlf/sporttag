import { OverlayProvider } from '@gluestack-ui/core/overlay/creator';

export function GluestackUIProvider({ children }: { children: React.ReactNode }) {
  return <OverlayProvider>{children}</OverlayProvider>;
}
