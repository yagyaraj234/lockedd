import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme';
import type { Palette } from '../colors';

// Each intercepted open is treated as an avoided ~18-min session — an estimate,
// labelled "est." in the UI. Daily ring fills toward DAILY_SAVED_GOAL_MIN.
const MINUTES_SAVED_PER_BLOCK = 18;
const DAILY_SAVED_GOAL_MIN = 60;

const RING_RADIUS = 70;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const formatMinutes = (min: number): string => {
  if (min <= 0) return '0m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
};

interface HomeMetricsProps {
  totalAttempts: number;
  todayAttempts: number;
}

export const HomeMetrics = ({ totalAttempts, todayAttempts }: HomeMetricsProps) => {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const todaySavedMin = todayAttempts * MINUTES_SAVED_PER_BLOCK;
  const totalSavedMin = totalAttempts * MINUTES_SAVED_PER_BLOCK;
  const progress = Math.min(todaySavedMin / DAILY_SAVED_GOAL_MIN, 1);
  const offset = RING_CIRCUMFERENCE - progress * RING_CIRCUMFERENCE;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>OVERVIEW</Text>

      {totalAttempts === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No opens stopped yet</Text>
          <Text style={styles.emptyBody}>
            Block an app — every time Locked stops you from opening it, your saved
            time shows up here.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.ringWrap}>
            <Svg height={180} width={180} viewBox="0 0 180 180">
              <Circle
                cx="90"
                cy="90"
                r={RING_RADIUS}
                stroke={Colors.bgSecondary}
                strokeWidth="12"
                fill="none"
              />
              <Circle
                cx="90"
                cy="90"
                r={RING_RADIUS}
                stroke={Colors.accent}
                strokeWidth="12"
                fill="none"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={offset}
                strokeLinecap="round"
                rotation="-90"
                origin="90, 90"
              />
            </Svg>
            <View style={styles.ringCenter}>
              <Text style={styles.ringValue}>{formatMinutes(todaySavedMin)}</Text>
              <Text style={styles.ringCaption}>saved today</Text>
            </View>
          </View>

          <View style={styles.cardRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{todayAttempts}</Text>
              <Text style={styles.statLabel}>Opens stopped{'\n'}today</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totalAttempts}</Text>
              <Text style={styles.statLabel}>Opens stopped{'\n'}all time</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{formatMinutes(totalSavedMin)}</Text>
              <Text style={styles.statLabel}>Time saved{'\n'}all time</Text>
            </View>
          </View>
          <Text style={styles.estNote}>Time saved is an estimate (~18m per stopped open).</Text>
        </>
      )}
    </View>
  );
};

const makeStyles = (Colors: Palette) => StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    marginBottom: 14,
    letterSpacing: 1.2,
  },
  emptyCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: 12,
    padding: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  ringWrap: {
    height: 180,
    width: 180,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  ringValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
  },
  ringCaption: {
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.accent,
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 15,
  },
  estNote: {
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 12,
  },
});
