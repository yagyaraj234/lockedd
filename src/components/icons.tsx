import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors } from '../colors';

// Minimal line icons drawn with react-native-svg (already a dependency, so no
// extra native module / prebuild). Each icon takes size + color props and
// renders a 24x24 stroked glyph. Swap the whole set here if we ever adopt a
// font icon library.

interface IconProps {
  size?: number;
  color?: string;
}

const stroke = (color?: string) => color ?? Colors.label;

export const HomeIcon = ({ size = 24, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"
      stroke={stroke(color)}
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </Svg>
);

// Shield = "Blocked Apps" (permanent protection).
export const ShieldIcon = ({ size = 24, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"
      stroke={stroke(color)}
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <Path
      d="M9.5 12l1.8 1.8L15 10"
      stroke={stroke(color)}
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </Svg>
);

export const GearIcon = ({ size = 24, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={3} stroke={stroke(color)} strokeWidth={2} />
    <Path
      d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.38.28.6.72.6 1.2v3.6c0 .48-.22.92-.6 1.2Z"
      stroke={stroke(color)}
      strokeWidth={1.7}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </Svg>
);

export const PlusIcon = ({ size = 24, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 5v14M5 12h14"
      stroke={stroke(color)}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

// Lock badge for the 30-min disable window on the Blocked Apps screen.
export const LockIcon = ({ size = 24, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M6 10h12v9a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"
      stroke={stroke(color)}
      strokeWidth={2}
      strokeLinejoin="round"
    />
    <Path
      d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"
      stroke={stroke(color)}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

export const ChevronLeftIcon = ({ size = 24, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M15 18l-6-6 6-6"
      stroke={stroke(color)}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const SearchIcon = ({ size = 24, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={11} cy={11} r={7} stroke={stroke(color)} strokeWidth={2} />
    <Path
      d="M20 20l-3.5-3.5"
      stroke={stroke(color)}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

export const CheckIcon = ({ size = 24, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="m5 12.5 4.2 4.2L19 7"
      stroke={stroke(color)}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const ChevronRightIcon = ({ size = 24, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="m9 6 6 6-6 6"
      stroke={stroke(color)}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const CloseIcon = ({ size = 24, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 6l12 12M18 6 6 18" stroke={stroke(color)} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);
