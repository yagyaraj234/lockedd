import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  PhoneLockSchedule,
  PhoneLockScheduleInput,
} from '../../modules/app-blocker/src';
import type { Palette } from '../colors';
import { Radius, Spacing, Type } from '../colors';
import {
  getNewPhoneLockScheduleDefaults,
  getPhoneLockScheduleValidationError,
  PHONE_LOCK_ALLOWED_APP_LIMIT,
  type PhoneLockSchedule as DomainSchedule,
  type Weekday,
} from '../domain';
import { useTheme } from '../theme';
import { AllowedAppsSheet } from './AllowedAppsSheet';
import { CloseIcon, ChevronRightIcon } from './icons';
import { PressableScale } from './PressableScale';
import { AppDialog } from './AppDialog';
import { TimeRangeSlider } from './TimeRangeSlider';

type Props = {
  visible: boolean;
  schedule: PhoneLockSchedule | null;
  schedules: PhoneLockSchedule[];
  onSave: (schedule: PhoneLockScheduleInput) => void;
  onDismiss: () => void;
};

const DAYS: Array<{ value: Weekday; label: string; full: string }> = [
  { value: 0, label: 'S', full: 'Sunday' },
  { value: 1, label: 'M', full: 'Monday' },
  { value: 2, label: 'T', full: 'Tuesday' },
  { value: 3, label: 'W', full: 'Wednesday' },
  { value: 4, label: 'T', full: 'Thursday' },
  { value: 5, label: 'F', full: 'Friday' },
  { value: 6, label: 'S', full: 'Saturday' },
];

export function PhoneLockScheduleSheet({
  visible,
  schedule,
  schedules,
  onSave,
  onDismiss,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [days, setDays] = useState<Weekday[]>([1, 2, 3, 4, 5]);
  const [startMinute, setStartMinute] = useState(8 * 60);
  const [endMinute, setEndMinute] = useState(10 * 60);
  const [allowedPackageNames, setAllowedPackageNames] = useState<string[]>([]);
  const [showAllowedApps, setShowAllowedApps] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const defaults = getNewPhoneLockScheduleDefaults();
    setName(schedule?.name ?? '');
    setEnabled(schedule?.enabled ?? true);
    setDays((schedule?.days ?? defaults.days) as Weekday[]);
    setStartMinute(schedule?.startMinute ?? defaults.startMinute);
    setEndMinute(schedule?.endMinute ?? defaults.endMinute);
    setAllowedPackageNames(schedule?.allowedPackageNames ?? []);
  }, [visible, schedule]);

  const toggleDay = (day: Weekday) =>
    setDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort()
    );

  const save = () => {
    const candidate: DomainSchedule = {
      id: schedule?.id ?? `schedule-${Date.now().toString(36)}`,
      name: name.trim(),
      enabled,
      days,
      startMinute,
      endMinute,
      allowedPackageNames,
      activationNotBefore: schedule?.activationNotBefore ?? null,
    };
    const error = getPhoneLockScheduleValidationError(
      candidate,
      schedules as DomainSchedule[]
    );
    if (error) {
      AppDialog.alert('Could not save schedule', error);
      return;
    }
    const { activationNotBefore: _, ...input } = candidate;
    onSave(input);
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onDismiss}
        statusBarTranslucent
      >
        <View style={styles.fill}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close schedule editor"
            style={styles.scrim}
            onPress={onDismiss}
          />
          <View
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}
          >
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>{schedule ? 'Edit schedule' : 'New schedule'}</Text>
                <Text style={styles.subtitle}>Repeats weekly. Pick a future start time.</Text>
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

            <ScrollView
              style={styles.form}
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.label}>Name · optional</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Morning focus"
                placeholderTextColor={colors.labelTertiary}
                accessibilityLabel="Schedule name"
                maxLength={60}
                style={styles.input}
              />

              <View style={styles.enabledRow}>
                <View style={styles.enabledCopy}>
                  <Text style={styles.label}>Enabled</Text>
                  <Text style={styles.detail}>Disabled schedules keep their settings.</Text>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={setEnabled}
                  accessibilityLabel="Schedule enabled"
                  trackColor={{ false: colors.separator, true: colors.accentMuted }}
                  thumbColor={enabled ? colors.accent : colors.labelTertiary}
                />
              </View>

              <Text style={styles.label}>Repeat</Text>
              <View style={styles.presets}>
                <PressableScale
                  accessibilityRole="button"
                  onPress={() => setDays([1, 2, 3, 4, 5])}
                  style={styles.preset}
                  pressedStyle={styles.pressed}
                >
                  <Text style={styles.presetText}>Weekdays</Text>
                </PressableScale>
                <PressableScale
                  accessibilityRole="button"
                  onPress={() => setDays([0, 6])}
                  style={styles.preset}
                  pressedStyle={styles.pressed}
                >
                  <Text style={styles.presetText}>Weekends</Text>
                </PressableScale>
              </View>
              <View style={styles.days}>
                {DAYS.map((day) => {
                  const active = days.includes(day.value);
                  return (
                    <PressableScale
                      key={day.value}
                      accessibilityRole="checkbox"
                      accessibilityLabel={day.full}
                      accessibilityState={{ checked: active }}
                      onPress={() => toggleDay(day.value)}
                      style={[styles.day, active && styles.dayActive]}
                      pressedStyle={styles.pressed}
                    >
                      <Text style={[styles.dayText, active && styles.dayTextActive]}>
                        {day.label}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>

              <Text style={styles.label}>Time range</Text>
              <TimeRangeSlider
                startMinute={startMinute}
                endMinute={endMinute}
                onChange={(nextStart, nextEnd) => {
                  setStartMinute(nextStart);
                  setEndMinute(nextEnd);
                }}
              />
              <Text style={styles.detail}>
                A window already in progress starts on its next selected day.
              </Text>

              <PressableScale
                containerStyle={styles.fullWidth}
                accessibilityRole="button"
                accessibilityLabel={`Allowed apps, ${allowedPackageNames.length} selected`}
                onPress={() => setShowAllowedApps(true)}
                style={styles.allowedApps}
                pressedStyle={styles.pressed}
              >
                <View style={styles.allowedCopy}>
                  <Text style={styles.label}>Allowed apps</Text>
                  <Text style={styles.detail}>
                    {allowedPackageNames.length}/{PHONE_LOCK_ALLOWED_APP_LIMIT} selected · Phone always available
                  </Text>
                </View>
                <ChevronRightIcon size={20} color={colors.labelTertiary} />
              </PressableScale>
            </ScrollView>

            <PressableScale
              containerStyle={styles.fullWidth}
              accessibilityRole="button"
              accessibilityLabel="Save schedule"
              onPress={save}
              style={styles.confirm}
              pressedStyle={styles.confirmPressed}
            >
              <Text style={styles.confirmText}>Save schedule</Text>
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

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    fill: { flex: 1, justifyContent: 'flex-end' },
    scrim: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: colors.scrim,
    },
    sheet: {
      height: '92%',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: colors.surfaceElevated,
    },
    handle: {
      width: 38,
      height: 5,
      borderRadius: 3,
      alignSelf: 'center',
      backgroundColor: colors.labelTertiary,
      opacity: 0.55,
    },
    header: {
      marginTop: Spacing.lg,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.md,
    },
    headerCopy: { flex: 1 },
    title: { ...Type.title, color: colors.label },
    subtitle: { ...Type.footnote, color: colors.labelSecondary, marginTop: 3 },
    close: {
      width: 44,
      minHeight: 44,
      borderRadius: Radius.pill,
      alignItems: 'center',
      backgroundColor: colors.surfacePressed,
    },
    form: { flex: 1, marginTop: Spacing.lg },
    formContent: { paddingBottom: Spacing.xl, gap: Spacing.md },
    label: { ...Type.footnoteStrong, color: colors.label },
    detail: { ...Type.footnote, color: colors.labelSecondary, marginTop: 2 },
    input: {
      minHeight: 50,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.md,
      backgroundColor: colors.surface,
      ...Type.body,
      color: colors.label,
    },
    enabledRow: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    enabledCopy: { flex: 1 },
    presets: { flexDirection: 'row', gap: Spacing.sm },
    preset: {
      minHeight: 42,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.pill,
      backgroundColor: colors.accentMuted,
    },
    presetText: { ...Type.footnoteStrong, color: colors.accent },
    days: { flexDirection: 'row', justifyContent: 'space-between', gap: 5 },
    day: {
      flex: 1,
      aspectRatio: 1,
      minHeight: 42,
      borderRadius: Radius.pill,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.separator,
      backgroundColor: colors.surface,
    },
    dayActive: { borderColor: colors.accent, backgroundColor: colors.accent },
    dayText: { ...Type.footnoteStrong, color: colors.labelSecondary },
    dayTextActive: { color: colors.onAccent },
    allowedApps: {
      minHeight: 72,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: colors.surface,
    },
    allowedCopy: { flex: 1 },
    confirm: {
      minHeight: 52,
      borderRadius: Radius.pill,
      alignItems: 'center',
      backgroundColor: colors.accent,
    },
    confirmPressed: { opacity: 0.85 },
    confirmText: { ...Type.bodyStrong, color: colors.onAccent },
    fullWidth: { width: '100%' },
    pressed: { backgroundColor: colors.surfacePressed },
  });
