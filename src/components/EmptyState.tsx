import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Path,
  Circle,
  Line,
  Rect,
} from 'react-native-svg';
import { useTheme } from '../theme';
import type { Palette } from '../colors';
import { Radius, Spacing, Type } from '../colors';
import { PressableScale } from './PressableScale';

// ---------- SVG Illustrations ----------

const ShieldEmptySVG = ({ c }: { c: Palette }) => (
  <Svg width={100} height={100} viewBox="0 0 100 100" fill="none">
    {/* Dashed shield outline */}
    <Path
      d="M50 12 L84 27 L84 52 C84 68 68 79 50 85 C32 79 16 68 16 52 L16 27 Z"
      fill={c.illustration}
      stroke={c.illustrationLine}
      strokeWidth="2"
      strokeDasharray="6 4"
    />
    {/* Accent plus — suggests "add apps" */}
    <Line x1="50" y1="41" x2="50" y2="63" stroke={c.accent} strokeWidth="2.5" strokeLinecap="round" />
    <Line x1="39" y1="52" x2="61" y2="52" stroke={c.accent} strokeWidth="2.5" strokeLinecap="round" />
  </Svg>
);

const SearchEmptySVG = ({ c }: { c: Palette }) => (
  <Svg width={100} height={100} viewBox="0 0 100 100" fill="none">
    {/* Magnifying glass */}
    <Circle cx="42" cy="42" r="25" fill={c.illustration} stroke={c.illustrationLine} strokeWidth="2.5" />
    <Line x1="60" y1="60" x2="82" y2="82" stroke={c.illustrationLine} strokeWidth="3" strokeLinecap="round" />
    {/* Horizontal lines inside — "empty list" metaphor */}
    <Line x1="31" y1="37" x2="53" y2="37" stroke={c.illustrationLine} strokeOpacity={0.6} strokeWidth="1.5" strokeLinecap="round" />
    <Line x1="31" y1="43" x2="53" y2="43" stroke={c.illustrationLine} strokeOpacity={0.6} strokeWidth="1.5" strokeLinecap="round" />
    <Line x1="35" y1="49" x2="49" y2="49" stroke={c.illustrationLine} strokeOpacity={0.6} strokeWidth="1.5" strokeLinecap="round" />
  </Svg>
);

const LockEmptySVG = ({ c }: { c: Palette }) => (
  <Svg width={100} height={100} viewBox="0 0 100 100" fill="none">
    {/* Lock body */}
    <Rect x="22" y="46" width="56" height="40" rx="8" fill={c.illustration} stroke={c.illustrationLine} strokeWidth="2" strokeDasharray="6 4" />
    {/* Lock shackle */}
    <Path
      d="M34 46 L34 34 Q34 18 50 18 Q66 18 66 34 L66 46"
      stroke={c.illustrationLine}
      strokeWidth="2"
      strokeDasharray="6 4"
      strokeLinecap="round"
    />
    {/* Keyhole */}
    <Circle cx="50" cy="63" r="5" stroke={c.accent} strokeWidth="2" />
    <Line x1="50" y1="68" x2="50" y2="76" stroke={c.accent} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

// ---------- Type map ----------

type Illustration = 'shield' | 'lock' | 'search';

const ILLUSTRATIONS: Record<Illustration, React.FC<{ c: Palette }>> = {
  shield: ShieldEmptySVG,
  lock: LockEmptySVG,
  search: SearchEmptySVG,
};

// ---------- Component ----------

interface EmptyStateProps {
  illustration: Illustration;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState = ({
  illustration,
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) => {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const Illustration = ILLUSTRATIONS[illustration];

  return (
    <View style={styles.container}>
      <View style={styles.illustrationWrap}>
        <Illustration c={Colors} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <PressableScale containerStyle={styles.actionWrap} accessibilityRole="button" style={styles.action} pressedStyle={styles.actionPressed} onPress={onAction}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
};

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: Spacing.xl,
  },
  illustrationWrap: {
    marginBottom: 24,
    opacity: 0.9,
  },
  title: {
    ...Type.bodyStrong,
    color: Colors.label,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    ...Type.footnote,
    color: Colors.labelSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  actionWrap: { marginTop: Spacing.xl },
  action: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  actionPressed: { backgroundColor: Colors.accent },
  actionText: {
    ...Type.bodyStrong,
    color: Colors.onAccent,
  },
});
