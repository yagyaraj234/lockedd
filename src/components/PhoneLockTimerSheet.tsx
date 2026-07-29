import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Palette } from '../colors';
import { Radius, Spacing, Type } from '../colors';
import { formatPhoneLockDuration, phoneLockDurationFromParts } from '../domain';
import { useTheme } from '../theme';
import { AllowedAppsSheet } from './AllowedAppsSheet';
import { ChevronRightIcon, CloseIcon } from './icons';
import { PressableScale } from './PressableScale';

type Props = {
  visible: boolean;
  onConfirm: (durationMs: number, allowedPackageNames: string[]) => void;
  onDismiss: () => void;
};

const ITEM_HEIGHT = 48;
const WHEEL_HEIGHT = ITEM_HEIGHT * 3;
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) => index * 5);

type WheelProps = {
  label: string;
  options: number[];
  selected: number;
  onChange: (value: number) => void;
  scrollRef: React.RefObject<ScrollView | null>;
};

function Wheel({ label, options, selected, onChange, scrollRef }: WheelProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const selectIndex = (index: number) => {
    const value = options[Math.max(0, Math.min(index, options.length - 1))];
    if (value !== selected) {
      Haptics.selectionAsync().catch(() => {});
      onChange(value);
    }
  };

  return (
    <View style={styles.wheelColumn}>
      <Text style={styles.wheelLabel}>{label}</Text>
      <View style={styles.wheel}>
        <View pointerEvents="none" style={styles.wheelSelection} />
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={(event) => selectIndex(Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT))}
          contentContainerStyle={styles.wheelContent}
          accessibilityLabel={`Select ${label}`}
        >
          {options.map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: value === selected }}
              onPress={() => onChange(value)}
              style={styles.wheelItem}
            >
              <Text style={[styles.wheelValue, value === selected && styles.wheelValueSelected]}>
                {String(value).padStart(2, '0')}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

export function PhoneLockTimerSheet({ visible, onConfirm, onDismiss }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const hourRef = useRef<ScrollView>(null);
  const minuteRef = useRef<ScrollView>(null);
  const [hours, setHours] = useState(5);
  const [minutes, setMinutes] = useState(0);
  const [allowedPackageNames, setAllowedPackageNames] = useState<string[]>([]);
  const [showAllowedApps, setShowAllowedApps] = useState(false);
  const minuteOptions = hours === 0 ? MINUTE_OPTIONS.slice(1) : hours === 24 ? [0] : MINUTE_OPTIONS;
  const selectedMinutes = minuteOptions.includes(minutes) ? minutes : minuteOptions[0];
  const durationMs = phoneLockDurationFromParts(hours, selectedMinutes);

  const scrollToSelection = (ref: React.RefObject<ScrollView | null>, options: number[], value: number) => {
    const index = Math.max(0, options.indexOf(value));
    requestAnimationFrame(() => ref.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false }));
  };

  useEffect(() => {
    if (!visible) return;
    setHours(5);
    setMinutes(0);
    setAllowedPackageNames([]);
    scrollToSelection(hourRef, Array.from({ length: 25 }, (_, index) => index), 5);
    scrollToSelection(minuteRef, MINUTE_OPTIONS, 0);
  }, [visible]);

  useEffect(() => {
    if (!minuteOptions.includes(minutes)) setMinutes(minuteOptions[0]);
    scrollToSelection(minuteRef, minuteOptions, selectedMinutes);
  }, [hours, minuteOptions.length, selectedMinutes]);

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss} statusBarTranslucent>
        <View style={styles.fill}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close duration picker"
            style={styles.scrim}
            onPress={onDismiss}
          />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Lock your phone</Text>
              <Text style={styles.subtitle}>Pick a duration from 5 minutes to 24 hours.</Text>
            </View>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onDismiss}
              style={styles.close}
              pressedStyle={styles.pressed}
            >
              <CloseIcon size={20} color={colors.labelSecondary} />
            </PressableScale>
          </View>

          <Text style={styles.duration}>{formatPhoneLockDuration(durationMs)}</Text>
          <View style={styles.wheels}>
            <Wheel
              label="Hours"
              options={Array.from({ length: 25 }, (_, index) => index)}
              selected={hours}
              onChange={setHours}
              scrollRef={hourRef}
            />
            <Wheel
              label="Minutes"
              options={minuteOptions}
              selected={selectedMinutes}
              onChange={setMinutes}
              scrollRef={minuteRef}
            />
          </View>
          <Text style={styles.note}>Two 1-minute passes, then a 5-minute cooldown. Cycle repeats.</Text>

          <PressableScale
            containerStyle={styles.fullWidth}
            accessibilityRole="button"
            accessibilityLabel={`Allowed apps, ${allowedPackageNames.length} selected`}
            onPress={() => setShowAllowedApps(true)}
            style={styles.allowedApps}
            pressedStyle={styles.pressed}
          >
            <View style={styles.allowedCopy}>
              <Text style={styles.allowedTitle}>Allowed apps</Text>
              <Text style={styles.allowedDetail}>
                {allowedPackageNames.length}/5 selected · Phone always available
              </Text>
            </View>
            <ChevronRightIcon size={20} color={colors.labelTertiary} />
          </PressableScale>

          <PressableScale
            containerStyle={styles.fullWidth}
            accessibilityRole="button"
            accessibilityLabel={`Lock phone for ${formatPhoneLockDuration(durationMs)}`}
            onPress={() => onConfirm(durationMs, allowedPackageNames)}
            style={styles.confirm}
            pressedStyle={styles.confirmPressed}
          >
            <Text style={styles.confirmText}>Continue</Text>
          </PressableScale>
          </View>
        </View>
      </Modal>
      <AllowedAppsSheet
        visible={showAllowedApps}
        selected={allowedPackageNames}
        onConfirm={(packages) => {
          setAllowedPackageNames(packages);
          setShowAllowedApps(false);
        }}
        onDismiss={() => setShowAllowedApps(false)}
      />
    </>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.scrim },
  sheet: { backgroundColor: colors.surfaceElevated, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  handle: { width: 38, height: 5, borderRadius: 3, backgroundColor: colors.labelTertiary, opacity: 0.55, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginTop: Spacing.lg },
  headerCopy: { flex: 1 },
  title: { ...Type.title, color: colors.label },
  subtitle: { ...Type.footnote, color: colors.labelSecondary, marginTop: 3 },
  close: { width: 44, minHeight: 44, borderRadius: Radius.pill, alignItems: 'center', backgroundColor: colors.surfacePressed },
  duration: { fontSize: 30, lineHeight: 38, fontWeight: '700', letterSpacing: -0.4, color: colors.label, textAlign: 'center', marginTop: Spacing.xl },
  wheels: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xxl, marginTop: Spacing.lg },
  wheelColumn: { width: 116, alignItems: 'center' },
  wheelLabel: { ...Type.footnoteStrong, color: colors.labelSecondary, marginBottom: Spacing.sm },
  wheel: { width: '100%', height: WHEEL_HEIGHT, overflow: 'hidden' },
  wheelSelection: { position: 'absolute', top: ITEM_HEIGHT, left: 0, right: 0, height: ITEM_HEIGHT, borderRadius: Radius.md, backgroundColor: colors.accentMuted, borderWidth: 1, borderColor: colors.accent },
  wheelContent: { paddingVertical: ITEM_HEIGHT },
  wheelItem: { height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  wheelValue: { ...Type.body, color: colors.labelTertiary, fontVariant: ['tabular-nums'] },
  wheelValueSelected: { ...Type.title, color: colors.label },
  note: { ...Type.footnote, color: colors.labelSecondary, textAlign: 'center', marginTop: Spacing.lg },
  allowedApps: {
    minHeight: 68,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  allowedCopy: { flex: 1 },
  allowedTitle: { ...Type.bodyStrong, color: colors.label },
  allowedDetail: { ...Type.footnote, color: colors.labelSecondary, marginTop: 2 },
  fullWidth: { width: '100%' },
  confirm: { minHeight: 54, borderRadius: Radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl },
  confirmPressed: { backgroundColor: colors.accent },
  confirmText: { ...Type.bodyStrong, color: colors.onAccent },
  pressed: { backgroundColor: colors.surfacePressed },
});
