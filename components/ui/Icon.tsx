import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
import { useTokens } from './theme';

export type IconName =
  | 'overview'
  | 'planning'
  | 'live'
  | 'results'
  | 'devices'
  | 'settings'
  | 'menu'
  | 'close'
  | 'plus'
  | 'check'
  | 'check-circle'
  | 'alert'
  | 'offline'
  | 'upload'
  | 'chevron-right'
  | 'chevron-down'
  | 'user'
  | 'map-pin'
  | 'clock'
  | 'package'
  | 'shield'
  | 'refresh'
  | 'medical'
  | 'arrow-left'
  | 'headset'
  | 'phone'
  | 'play'
  | 'pause'
  | 'stop'
  | 'minus'
  | 'undo'
  | 'users'
  | 'flag'
  | 'trophy'
  | 'wifi-off';

type ShapeProps = {
  stroke: string;
  strokeWidth: number;
  strokeLinecap: 'round';
  strokeLinejoin: 'round';
};

const shapes: Record<IconName, (p: ShapeProps) => React.ReactNode> = {
  overview: (p) => (
    <>
      <Rect x="3" y="3" width="7" height="7" rx="1.5" {...p} />
      <Rect x="14" y="3" width="7" height="7" rx="1.5" {...p} />
      <Rect x="3" y="14" width="7" height="7" rx="1.5" {...p} />
      <Rect x="14" y="14" width="7" height="7" rx="1.5" {...p} />
    </>
  ),
  planning: (p) => (
    <>
      <Rect x="3" y="4.5" width="18" height="16" rx="2.5" {...p} />
      <Line x1="3" y1="9.5" x2="21" y2="9.5" {...p} />
      <Line x1="8" y1="2.5" x2="8" y2="6.5" {...p} />
      <Line x1="16" y1="2.5" x2="16" y2="6.5" {...p} />
    </>
  ),
  live: (p) => <Polyline points="3 12 7.5 12 10.5 5 14 19 16.5 12 21 12" {...p} />,
  results: (p) => (
    <>
      <Line x1="6" y1="20" x2="6" y2="12" {...p} />
      <Line x1="12" y1="20" x2="12" y2="5" {...p} />
      <Line x1="18" y1="20" x2="18" y2="9" {...p} />
    </>
  ),
  devices: (p) => (
    <>
      <Rect x="6" y="2.5" width="12" height="19" rx="2.5" {...p} />
      <Line x1="10.5" y1="18.5" x2="13.5" y2="18.5" {...p} />
    </>
  ),
  settings: (p) => (
    <>
      <Line x1="4" y1="7" x2="20" y2="7" {...p} />
      <Line x1="4" y1="12" x2="20" y2="12" {...p} />
      <Line x1="4" y1="17" x2="20" y2="17" {...p} />
      <Circle cx="9" cy="7" r="2" fill="none" {...p} />
      <Circle cx="15" cy="12" r="2" fill="none" {...p} />
      <Circle cx="8" cy="17" r="2" fill="none" {...p} />
    </>
  ),
  menu: (p) => (
    <>
      <Line x1="3.5" y1="7" x2="20.5" y2="7" {...p} />
      <Line x1="3.5" y1="12" x2="20.5" y2="12" {...p} />
      <Line x1="3.5" y1="17" x2="20.5" y2="17" {...p} />
    </>
  ),
  close: (p) => (
    <>
      <Line x1="6" y1="6" x2="18" y2="18" {...p} />
      <Line x1="18" y1="6" x2="6" y2="18" {...p} />
    </>
  ),
  plus: (p) => (
    <>
      <Line x1="12" y1="5" x2="12" y2="19" {...p} />
      <Line x1="5" y1="12" x2="19" y2="12" {...p} />
    </>
  ),
  check: (p) => <Polyline points="4.5 12.5 9.5 17.5 19.5 7" {...p} />,
  'check-circle': (p) => (
    <>
      <Circle cx="12" cy="12" r="9" {...p} />
      <Polyline points="8 12.5 11 15.5 16 9.5" {...p} />
    </>
  ),
  alert: (p) => (
    <>
      <Path d="M10.3 3.9 2.6 17.4a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" {...p} />
      <Line x1="12" y1="9" x2="12" y2="13.5" {...p} />
      <Line x1="12" y1="17" x2="12" y2="17.01" {...p} />
    </>
  ),
  offline: (p) => (
    <>
      <Path d="M17.5 18H7a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 17.2 8.6 4.7 4.7 0 0 1 21 13a4.5 4.5 0 0 1-3.5 5Z" {...p} />
      <Line x1="4" y1="3.5" x2="20" y2="20.5" {...p} />
    </>
  ),
  upload: (p) => (
    <>
      <Path d="M17.5 18H7a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 17.2 8.6 4.7 4.7 0 0 1 21 13a4.5 4.5 0 0 1-3.5 5Z" {...p} />
      <Polyline points="12 15 12 8.5" {...p} />
      <Polyline points="9.2 11.2 12 8.4 14.8 11.2" {...p} />
    </>
  ),
  'chevron-right': (p) => <Polyline points="9 5 16 12 9 19" {...p} />,
  'chevron-down': (p) => <Polyline points="5 9 12 16 19 9" {...p} />,
  user: (p) => (
    <>
      <Circle cx="12" cy="8" r="3.75" {...p} />
      <Path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" {...p} />
    </>
  ),
  'map-pin': (p) => (
    <>
      <Path d="M12 21s6.5-5.4 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15.6 12 21 12 21Z" {...p} />
      <Circle cx="12" cy="10.5" r="2.4" {...p} />
    </>
  ),
  clock: (p) => (
    <>
      <Circle cx="12" cy="12" r="9" {...p} />
      <Polyline points="12 7 12 12 15.5 14" {...p} />
    </>
  ),
  package: (p) => (
    <>
      <Path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5Z" {...p} />
      <Polyline points="3.5 7.5 12 12 20.5 7.5" {...p} />
      <Line x1="12" y1="12" x2="12" y2="21" {...p} />
    </>
  ),
  shield: (p) => (
    <>
      <Path d="M12 3 5 6v5.5c0 4.3 2.9 8.1 7 9.5 4.1-1.4 7-5.2 7-9.5V6Z" {...p} />
      <Polyline points="9 12 11.2 14.2 15.2 9.8" {...p} />
    </>
  ),
  refresh: (p) => (
    <>
      <Path d="M20 11a8 8 0 0 0-14.2-4.4L3.5 9" {...p} />
      <Polyline points="3.5 4.5 3.5 9 8 9" {...p} />
      <Path d="M4 13a8 8 0 0 0 14.2 4.4L20.5 15" {...p} />
      <Polyline points="20.5 19.5 20.5 15 16 15" {...p} />
    </>
  ),
  medical: (p) => (
    <>
      <Circle cx="12" cy="12" r="9" {...p} />
      <Line x1="12" y1="8" x2="12" y2="16" {...p} />
      <Line x1="8" y1="12" x2="16" y2="12" {...p} />
    </>
  ),
  'arrow-left': (p) => (
    <>
      <Line x1="19" y1="12" x2="5" y2="12" {...p} />
      <Polyline points="11 6 5 12 11 18" {...p} />
    </>
  ),
  headset: (p) => (
    <>
      <Path d="M4 13v-1a8 8 0 0 1 16 0v1" {...p} />
      <Rect x="3" y="13" width="4" height="6" rx="1.5" {...p} />
      <Rect x="17" y="13" width="4" height="6" rx="1.5" {...p} />
    </>
  ),
  phone: (p) => (
    <Path
      d="M6.5 3.5h2.2l1.3 3.3-1.7 1.3a11 11 0 0 0 5.1 5.1l1.3-1.7 3.3 1.3v2.2a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2Z"
      {...p}
    />
  ),
  play: (p) => <Path d="M6 4.5v15l14-7.5Z" fill={p.stroke} {...p} />,
  pause: (p) => (
    <>
      <Rect x="6" y="4.5" width="4" height="15" rx="1" fill={p.stroke} {...p} />
      <Rect x="14" y="4.5" width="4" height="15" rx="1" fill={p.stroke} {...p} />
    </>
  ),
  stop: (p) => <Rect x="5.5" y="5.5" width="13" height="13" rx="2.5" fill={p.stroke} {...p} />,
  minus: (p) => <Line x1="5" y1="12" x2="19" y2="12" {...p} />,
  undo: (p) => (
    <>
      <Path d="M4 11.5a8 8 0 1 1 2.3 5.6" {...p} />
      <Polyline points="4 6 4 11.5 9.5 11.5" {...p} />
    </>
  ),
  users: (p) => (
    <>
      <Circle cx="9" cy="8" r="3.25" {...p} />
      <Path d="M2.75 20a6.25 6.25 0 0 1 12.5 0" {...p} />
      <Path d="M15.5 5.1a3.25 3.25 0 0 1 0 6.3" {...p} />
      <Path d="M17.5 14.2a6.25 6.25 0 0 1 3.75 5.8" {...p} />
    </>
  ),
  flag: (p) => (
    <>
      <Line x1="5" y1="21" x2="5" y2="3.5" {...p} />
      <Path d="M5 4.5h13l-3.2 4.2L18 13H5Z" {...p} />
    </>
  ),
  trophy: (p) => (
    <>
      <Path d="M7 4h10v4a5 5 0 0 1-10 0Z" {...p} />
      <Path d="M7 5H4.5a2.5 2.5 0 0 0 2.5 4.5" {...p} />
      <Path d="M17 5h2.5A2.5 2.5 0 0 1 17 9.5" {...p} />
      <Line x1="12" y1="13" x2="12" y2="17" {...p} />
      <Line x1="8.5" y1="20.5" x2="15.5" y2="20.5" {...p} />
      <Line x1="9.5" y1="17" x2="14.5" y2="17" {...p} />
    </>
  ),
  'wifi-off': (p) => (
    <>
      <Line x1="3" y1="3" x2="21" y2="21" {...p} />
      <Path d="M5 8.8a15.5 15.5 0 0 1 4.6-2.6" {...p} />
      <Path d="M13.3 5.6A15.5 15.5 0 0 1 19 8.8" {...p} />
      <Path d="M8.3 12.6a9.8 9.8 0 0 1 3.2-1.5" {...p} />
      <Path d="M15.4 13.8a9.8 9.8 0 0 0-1.4-1.2" {...p} />
      <Path d="M11.5 16.4a3.9 3.9 0 0 1 2 .6" {...p} />
      <Circle cx="12" cy="19.5" r="0.9" fill={p.stroke} {...p} />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  color,
  strokeWidth = 1.8,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const tokens = useTokens();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {shapes[name]({
        stroke: color ?? tokens.subtle,
        strokeWidth,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      })}
    </Svg>
  );
}
