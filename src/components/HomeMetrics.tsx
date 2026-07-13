import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { Palette } from '../colors';
import { Radius, Spacing, Type } from '../colors';
import { useAccessibilityPreferences } from '../hooks/useAccessibilityPreferences';
import { useTheme } from '../theme';

const MINUTES_SAVED_PER_BLOCK = 18;
const DAILY_SAVED_GOAL_MIN = 60;
const RADIUS = 48;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle as any);

const formatMinutes = (minutes: number) => {
  if (minutes <= 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h${rest ? ` ${rest}m` : ''}` : `${rest}m`;
};

export const HomeMetrics = ({ totalAttempts, todayAttempts }: { totalAttempts: number; todayAttempts: number }) => {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { reduceMotion } = useAccessibilityPreferences();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const progress = Math.min((todayAttempts * MINUTES_SAVED_PER_BLOCK) / DAILY_SAVED_GOAL_MIN, 1);
  const dashOffset = useRef(new Animated.Value(CIRCUMFERENCE)).current;

  useEffect(() => {
    const next = CIRCUMFERENCE - progress * CIRCUMFERENCE;
    if (reduceMotion) {
      dashOffset.setValue(next);
      return;
    }
    Animated.timing(dashOffset, {
      toValue: next,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, reduceMotion]);

  const todaySaved = todayAttempts * MINUTES_SAVED_PER_BLOCK;
  const totalSaved = totalAttempts * MINUTES_SAVED_PER_BLOCK;
  const wide = width >= 600;

  return (
    <View style={[styles.surface, wide && styles.surfaceWide]}>
      <View style={styles.ring} accessibilityLabel={`${formatMinutes(todaySaved)} estimated time saved today`}>
        <Svg width={124} height={124} viewBox="0 0 124 124">
          <Circle cx={62} cy={62} r={RADIUS} stroke={colors.surfacePressed} strokeWidth={10} fill="none" />
          <AnimatedCircle
            cx={62}
            cy={62}
            r={RADIUS}
            stroke={colors.accent}
            strokeWidth={10}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            rotation={-90}
            origin="62, 62"
          />
        </Svg>
        <View style={styles.ringCopy}>
          <Text style={styles.ringValue}>{formatMinutes(todaySaved)}</Text>
          <Text style={styles.ringLabel}>saved today</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <Text style={styles.heading}>{totalAttempts === 0 ? 'Ready when you are' : 'Your focus today'}</Text>
        <Text style={styles.description}>
          {totalAttempts === 0
            ? 'Stopped opens and estimated time saved will appear here.'
            : `${todayAttempts} open${todayAttempts === 1 ? '' : 's'} stopped today · ${totalAttempts} all time`}
        </Text>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Estimated all-time time saved</Text>
          <Text style={styles.totalValue}>{formatMinutes(totalSaved)}</Text>
        </View>
        <Text style={styles.note}>Estimate based on 18 minutes per stopped open.</Text>
      </View>
    </View>
  );
};

const makeStyles = (colors: Palette) => StyleSheet.create({
  surface: { backgroundColor: colors.surface, borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center', gap: Spacing.lg },
  surfaceWide: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xxl },
  ring: { width: 124, height: 124, alignItems: 'center', justifyContent: 'center' },
  ringCopy: { position: 'absolute', alignItems: 'center' },
  ringValue: { ...Type.title, color: colors.label },
  ringLabel: { fontSize: 11, lineHeight: 15, color: colors.labelSecondary },
  stats: { flex: 1, width: '100%' },
  heading: { ...Type.title, color: colors.label },
  description: { ...Type.footnote, color: colors.labelSecondary, marginTop: Spacing.xs },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator, marginTop: Spacing.lg, paddingTop: Spacing.lg },
  totalLabel: { ...Type.footnote, color: colors.labelSecondary, flex: 1 },
  totalValue: { ...Type.bodyStrong, color: colors.accent },
  note: { fontSize: 11, lineHeight: 15, color: colors.labelTertiary, marginTop: Spacing.sm },
});
