import React, { useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Palette } from '../colors';
import { Radius, Spacing, Type } from '../colors';
import { useTheme } from '../theme';

const MINUTES_PER_DAY = 24 * 60;
const THUMB_SIZE = 28;
const TOUCH_SIZE = 48;
const TRACK_HEIGHT = 6;
const TICK_HOURS = [0, 3, 6, 9, 12, 15, 18, 21];
const THUMB_TOUCH_OFFSET = (TOUCH_SIZE - THUMB_SIZE) / 2;

type Props = {
  startMinute: number;
  endMinute: number;
  onChange: (startMinute: number, endMinute: number) => void;
  step?: number;
};

const clampMinute = (minute: number, step: number) => {
  const snapped = Math.round(minute / step) * step;
  return Math.min(MINUTES_PER_DAY - step, Math.max(0, snapped));
};

const formatClock = (minute: number) => {
  const hour24 = Math.floor(minute / 60);
  const mins = minute % 60;
  const period = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(mins).padStart(2, '0')} ${period}`;
};

const formatDuration = (startMinute: number, endMinute: number) => {
  if (startMinute === endMinute) return '0m';
  const duration =
    endMinute > startMinute ? endMinute - startMinute : MINUTES_PER_DAY - startMinute + endMinute;
  const hours = Math.floor(duration / 60);
  const mins = duration % 60;
  return [hours > 0 ? `${hours}h` : '', mins > 0 ? `${mins}m` : ''].filter(Boolean).join(' ');
};

const hapticTick = () => {
  if (Platform.OS === 'android') {
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick).catch(() => {});
  } else {
    Haptics.selectionAsync().catch(() => {});
  }
};

export function TimeRangeSlider({ startMinute, endMinute, onChange, step = 15 }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [trackWidth, setTrackWidth] = useState(0);
  const usableWidth = Math.max(0, trackWidth - THUMB_SIZE);
  const activeThumb = useRef<'start' | 'end'>('start');
  const dragStart = useRef(0);
  const latestStart = useRef(startMinute);
  const latestEnd = useRef(endMinute);
  const onChangeRef = useRef(onChange);
  latestStart.current = startMinute;
  latestEnd.current = endMinute;
  onChangeRef.current = onChange;

  const minuteToX = (minute: number) => (minute / MINUTES_PER_DAY) * usableWidth;

  const adjustMinute = (minute: number, delta: number, otherMinute: number) => {
    const next = (minute + delta + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    return next === otherMinute ? (next + delta + MINUTES_PER_DAY) % MINUTES_PER_DAY : next;
  };

  const trackResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (event) => {
          const touchX = event.nativeEvent.locationX - THUMB_SIZE / 2;
          activeThumb.current =
            Math.abs(touchX - minuteToX(latestStart.current)) <=
            Math.abs(touchX - minuteToX(latestEnd.current))
              ? 'start'
              : 'end';
          dragStart.current =
            activeThumb.current === 'start' ? latestStart.current : latestEnd.current;
        },
        onPanResponderMove: (_, gesture) => {
          if (usableWidth <= 0) return;
          const deltaMinutes = (gesture.dx / usableWidth) * MINUTES_PER_DAY;
          const next = clampMinute(dragStart.current + deltaMinutes, step);
          const current =
            activeThumb.current === 'start' ? latestStart.current : latestEnd.current;
          const other =
            activeThumb.current === 'start' ? latestEnd.current : latestStart.current;
          if (next === current || next === other) return;
          if (activeThumb.current === 'start') {
            onChangeRef.current(next, latestEnd.current);
          } else {
            onChangeRef.current(latestStart.current, next);
          }
          hapticTick();
        },
      }),
    [usableWidth, step]
  );

  const overnight = endMinute < startMinute;
  const startX = minuteToX(startMinute);
  const endX = minuteToX(endMinute);

  return (
    <View style={styles.container}>
      <View style={styles.labels}>
        <Text style={styles.timeLabel}>{formatClock(startMinute)}</Text>
        <Text style={styles.duration}>{formatDuration(startMinute, endMinute)}</Text>
        <Text style={styles.timeLabel}>{formatClock(endMinute)}</Text>
      </View>

      <View
        style={styles.track}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      >
        <View style={styles.trackBase} />
        {overnight ? (
          <>
            <View
              style={[styles.trackFill, { left: startX + THUMB_SIZE / 2, right: THUMB_SIZE / 2 }]}
            />
            <View style={[styles.trackFill, { left: THUMB_SIZE / 2, width: endX }]} />
          </>
        ) : (
          <View
            style={[
              styles.trackFill,
              { left: startX + THUMB_SIZE / 2, width: Math.max(0, endX - startX) },
            ]}
          />
        )}

        <Animated.View
          accessibilityRole="adjustable"
          accessibilityLabel="Schedule start time"
          accessibilityValue={{ text: formatClock(startMinute) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => {
            const delta = event.nativeEvent.actionName === 'increment' ? step : -step;
            onChange(adjustMinute(startMinute, delta, endMinute), endMinute);
          }}
          style={[styles.thumbTouch, { transform: [{ translateX: startX - THUMB_TOUCH_OFFSET }] }]}
        >
          <View style={styles.thumb} />
        </Animated.View>
        <Animated.View
          accessibilityRole="adjustable"
          accessibilityLabel="Schedule end time"
          accessibilityValue={{ text: formatClock(endMinute) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => {
            const delta = event.nativeEvent.actionName === 'increment' ? step : -step;
            onChange(startMinute, adjustMinute(endMinute, delta, startMinute));
          }}
          style={[styles.thumbTouch, { transform: [{ translateX: endX - THUMB_TOUCH_OFFSET }] }]}
        >
          <View style={[styles.thumb, styles.thumbEnd]} />
        </Animated.View>
        <View
          {...trackResponder.panHandlers}
          accessible={false}
          importantForAccessibility="no"
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={styles.ticks}>
        {TICK_HOURS.map((hour) => (
          <Text key={hour} style={styles.tickLabel}>
            {hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`}
          </Text>
        ))}
      </View>

      {overnight ? <Text style={styles.hint}>Overnight — ends the next day</Text> : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { gap: Spacing.sm },
    labels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    timeLabel: { ...Type.bodyStrong, color: colors.label, fontVariant: ['tabular-nums'] },
    duration: { ...Type.footnote, color: colors.labelSecondary },
    track: {
      height: TOUCH_SIZE,
    },
    trackBase: {
      position: 'absolute',
      left: THUMB_SIZE / 2,
      right: THUMB_SIZE / 2,
      top: (TOUCH_SIZE - TRACK_HEIGHT) / 2,
      height: TRACK_HEIGHT,
      borderRadius: Radius.pill,
      backgroundColor: colors.surface,
    },
    trackFill: {
      position: 'absolute',
      top: (TOUCH_SIZE - TRACK_HEIGHT) / 2,
      height: TRACK_HEIGHT,
      borderRadius: Radius.pill,
      backgroundColor: colors.accent,
    },
    thumbTouch: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: TOUCH_SIZE,
      height: TOUCH_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumb: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: Radius.pill,
      backgroundColor: colors.accent,
      borderWidth: 3,
      borderColor: colors.onAccent,
    },
    thumbEnd: { backgroundColor: colors.label },
    ticks: { flexDirection: 'row', justifyContent: 'space-between' },
    tickLabel: { ...Type.footnote, color: colors.labelTertiary, fontSize: 11 },
    hint: { ...Type.footnote, color: colors.labelSecondary },
  });
