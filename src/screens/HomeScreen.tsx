import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Palette } from '../colors';
import { Radius, Spacing, Type } from '../colors';
import { EmptyState } from '../components/EmptyState';
import { HomeMetrics } from '../components/HomeMetrics';
import { PressableScale } from '../components/PressableScale';
import { ChevronRightIcon, PlusIcon } from '../components/icons';
import { PhoneLockTimerSheet } from '../components/PhoneLockTimerSheet';
import { PhoneLockScheduleSheet } from '../components/PhoneLockScheduleSheet';
import { usePermissions } from '../hooks/usePermissions';
import { formatPhoneLockCountdown, formatPhoneLockDuration } from '../domain';
import {
    AppBlocker,
    type PhoneLockSchedule,
    type PhoneLockScheduleInput,
    type PhoneLockState,
} from '../../modules/app-blocker/src';
import { getBlockedApps, type BlockedApp } from '../store/storage';
import { useTheme } from '../theme';

const formatTimeRemaining = (blockUntil: number) => {
  const remaining = Math.max(0, blockUntil - Date.now());
  if (remaining === 0) return 'Expired';
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m left` : `${Math.max(1, minutes)}m left`;
};

const emptyPhoneLock: PhoneLockState = {
  active: false,
  endsAt: null,
  passEndsAt: null,
  passesRemaining: 0,
  cooldownEndsAt: null,
  source: null,
  activeScheduleId: null,
  allowedPackageNames: [],
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatScheduleDays = (days: number[]) => {
  const sorted = [...days].sort();
  if (sorted.join(',') === '1,2,3,4,5') return 'Weekdays';
  if (sorted.join(',') === '0,6') return 'Weekends';
  return sorted.map((day) => DAY_LABELS[day]).join(', ');
};

const formatScheduleMinute = (minute: number) => {
  const date = new Date(2000, 0, 1, Math.floor(minute / 60), minute % 60);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const scheduleTimeRange = (schedule: PhoneLockSchedule) =>
  `${formatScheduleMinute(schedule.startMinute)}–${formatScheduleMinute(schedule.endMinute)}`;

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message.replace(/^.*?:\s*/, '') : 'Try again.';

export const HomeScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const permissions = usePermissions();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [blockedApps, setBlockedApps] = useState<BlockedApp[]>([]);
  const [stats, setStats] = useState({ totalAttempts: 0, todayAttempts: 0 });
  const [phoneLock, setPhoneLock] = useState<PhoneLockState>(emptyPhoneLock);
  const [schedules, setSchedules] = useState<PhoneLockSchedule[]>([]);
  const [showPhoneLockSheet, setShowPhoneLockSheet] = useState(false);
  const [showScheduleSheet, setShowScheduleSheet] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<PhoneLockSchedule | null>(null);
  const [, setTick] = useState(0);

  const refresh = useCallback(() => {
    setBlockedApps(getBlockedApps().filter((app) => app.blockType === 'timed' && (app.blockUntil ?? 0) > Date.now()));
    try {
      setStats(AppBlocker.getBlockStats());
    } catch {
      setStats({ totalAttempts: 0, todayAttempts: 0 });
    }
    try {
      setPhoneLock(AppBlocker.getPhoneLockState());
      setSchedules(AppBlocker.getPhoneLockSchedules());
    } catch {
      setPhoneLock(emptyPhoneLock);
      setSchedules([]);
    }
  }, []);

  useEffect(() => navigation.addListener('focus', refresh), [navigation, refresh]);
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((value) => value + 1);
      refresh();
    }, phoneLock.active ? 1_000 : 60_000);
    return () => clearInterval(interval);
  }, [refresh, phoneLock.active]);

  const beginBlock = () => {
    if (!permissions.coreReady) {
      navigation.navigate('Permissions');
      return;
    }
    navigation.navigate('AddApps', { mode: 'temporary' });
  };

  const beginPhoneLock = () => {
    if (!permissions.coreReady) {
      navigation.navigate('Permissions');
      return;
    }
    setShowPhoneLockSheet(true);
  };

  const confirmPhoneLock = (durationMs: number, allowedPackageNames: string[]) => {
    setShowPhoneLockSheet(false);
    const durationLabel = formatPhoneLockDuration(durationMs);
    const endsAt = new Date(Date.now() + durationMs).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
    Alert.alert(
      `Lock phone for ${durationLabel}?`,
      `Ends at ${endsAt}. Two 1-minute passes reset after each 5-minute cooldown. Phone and ${allowedPackageNames.length} allowed app${allowedPackageNames.length === 1 ? '' : 's'} stay available. This cannot be stopped early.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start lock',
          onPress: () => {
            try {
              AppBlocker.startPhoneLock(durationMs, allowedPackageNames);
              refresh();
            } catch (error) {
              Alert.alert('Could not start phone lock', errorMessage(error));
            }
          },
        },
      ]
    );
  };

  const beginSchedule = (schedule: PhoneLockSchedule | null = null) => {
    if (!permissions.coreReady || (!schedule && !permissions.statuses.exactAlarms)) {
      navigation.navigate('Permissions');
      return;
    }
    if (phoneLock.active) {
      Alert.alert('Phone Lock is active', 'Schedules can change after the current lock ends.');
      return;
    }
    setEditingSchedule(schedule);
    setShowScheduleSheet(true);
  };

  const saveSchedule = (schedule: PhoneLockScheduleInput) => {
    try {
      AppBlocker.upsertPhoneLockSchedule(schedule);
      setShowScheduleSheet(false);
      setEditingSchedule(null);
      refresh();
    } catch (error) {
      Alert.alert('Could not save schedule', errorMessage(error));
    }
  };

  const toggleSchedule = (schedule: PhoneLockSchedule) => {
    if (phoneLock.active) {
      Alert.alert('Phone Lock is active', 'Schedules can change after the current lock ends.');
      return;
    }
    if (!permissions.statuses.exactAlarms && !schedule.enabled) {
      navigation.navigate('Permissions');
      return;
    }
    try {
      AppBlocker.setPhoneLockScheduleEnabled(schedule.id, !schedule.enabled);
      refresh();
    } catch (error) {
      Alert.alert('Could not update schedule', errorMessage(error));
    }
  };

  const deleteSchedule = (schedule: PhoneLockSchedule) => {
    if (phoneLock.active) {
      Alert.alert('Phone Lock is active', 'Schedules can change after the current lock ends.');
      return;
    }
    Alert.alert(
      'Delete schedule?',
      schedule.name || scheduleTimeRange(schedule),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              AppBlocker.deletePhoneLockSchedule(schedule.id);
              refresh();
            } catch (error) {
              Alert.alert('Could not delete schedule', errorMessage(error));
            }
          },
        },
      ]
    );
  };

  const now = Date.now();
  const passActive = phoneLock.passEndsAt != null && phoneLock.passEndsAt > now;
  const coolingDown =
    phoneLock.cooldownEndsAt != null && phoneLock.cooldownEndsAt > now;
  const activeSchedule = schedules.find(
    (schedule) => schedule.id === phoneLock.activeScheduleId
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.maxWidth}>
        <Text style={styles.brand}>LOCKED</Text>
        <Text style={styles.largeTitle}>Today</Text>

        {!permissions.loading && !permissions.coreReady ? (
          <View style={styles.setupCard}>
            <View style={styles.setupCopy}>
              <Text style={styles.setupTitle}>Finish blocking setup</Text>
              <Text style={styles.setupBody}>Allow Accessibility and Draw over apps before adding a block.</Text>
            </View>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Finish blocking setup"
              onPress={() => navigation.navigate('Permissions')}
              style={styles.setupAction}
              pressedStyle={styles.pressed}
            >
              <ChevronRightIcon size={20} color={colors.onAccent} />
            </PressableScale>
          </View>
        ) : null}

        <View style={styles.metricsWrap}>
          <HomeMetrics totalAttempts={stats.totalAttempts} todayAttempts={stats.todayAttempts} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Phone lock</Text>
          {phoneLock.active ? <Text style={styles.sectionCount}>ACTIVE</Text> : null}
        </View>

        <View style={[styles.phoneLock, phoneLock.active && styles.phoneLockActive]}>
          {phoneLock.active ? (
            <>
              <Text style={styles.phoneLockKicker}>
                {passActive
                  ? '1-MINUTE PASS'
                  : coolingDown
                    ? 'PASS COOLDOWN'
                    : phoneLock.source === 'schedule'
                      ? 'SCHEDULED LOCK'
                      : 'PHONE LOCKED'}
              </Text>
              <Text style={styles.phoneLockCountdown}>
                {formatPhoneLockCountdown(
                  passActive
                    ? phoneLock.passEndsAt
                    : coolingDown
                      ? phoneLock.cooldownEndsAt
                      : phoneLock.endsAt,
                  now
                )}
              </Text>
              <Text style={styles.phoneLockBody}>
                {passActive
                  ? `Full phone available now · ${phoneLock.passesRemaining} pass${phoneLock.passesRemaining === 1 ? '' : 'es'} left`
                  : coolingDown
                    ? 'Phone and allowed apps remain available until passes reset.'
                    : `${activeSchedule?.name || 'Phone and allowed apps stay available'} · ${phoneLock.passesRemaining} pass${phoneLock.passesRemaining === 1 ? '' : 'es'} left`}
              </Text>
              {passActive || coolingDown ? (
                <Text style={styles.phoneLockEnd}>
                  Phone lock ends in {formatPhoneLockCountdown(phoneLock.endsAt, now)}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.phoneLockKicker}>DEEP FOCUS</Text>
              <Text style={styles.phoneLockTitle}>Lock your phone</Text>
              <Text style={styles.phoneLockBody}>
                Phone, up to five allowed apps, and repeating short passes stay available.
              </Text>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Choose phone lock duration"
                onPress={beginPhoneLock}
                style={styles.phoneLockAction}
                pressedStyle={styles.phoneLockActionPressed}
              >
                <Text style={styles.phoneLockActionText}>Choose time</Text>
                <ChevronRightIcon size={19} color={colors.onAccent} />
              </PressableScale>
            </>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Schedules</Text>
          {schedules.length > 0 ? (
            <Text style={styles.sectionCount}>{schedules.length}</Text>
          ) : null}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Add Phone Lock schedule"
            accessibilityState={{ disabled: phoneLock.active }}
            disabled={phoneLock.active}
            onPress={() => beginSchedule()}
            style={styles.scheduleAdd}
            pressedStyle={styles.pressed}
          >
            <PlusIcon size={17} color={phoneLock.active ? colors.labelTertiary : colors.accent} />
            <Text
              style={[
                styles.scheduleAddText,
                phoneLock.active && styles.scheduleAddTextDisabled,
              ]}
            >
              Add
            </Text>
          </PressableScale>
        </View>

        {!permissions.loading && !permissions.statuses.exactAlarms ? (
          <PressableScale
            containerStyle={styles.fullWidth}
            accessibilityRole="button"
            accessibilityLabel="Allow Alarms and reminders for schedules"
            onPress={() => navigation.navigate('Permissions')}
            style={styles.schedulePermission}
            pressedStyle={styles.pressed}
          >
            <View style={styles.schedulePermissionCopy}>
              <Text style={styles.schedulePermissionTitle}>Schedules need alarm access</Text>
              <Text style={styles.schedulePermissionBody}>
                Allow Alarms & reminders for exact, closed-app starts.
              </Text>
            </View>
            <ChevronRightIcon size={20} color={colors.labelTertiary} />
          </PressableScale>
        ) : null}

        {schedules.length === 0 ? (
          <View style={styles.scheduleEmpty}>
            <Text style={styles.scheduleEmptyTitle}>No schedules</Text>
            <Text style={styles.scheduleEmptyBody}>
              Add weekly focus windows for any days and times.
            </Text>
          </View>
        ) : (
          <View style={styles.scheduleList}>
            {schedules.map((schedule, index) => (
              <View key={schedule.id}>
                <View style={styles.scheduleRow}>
                  <PressableScale
                    containerStyle={styles.scheduleMainContainer}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${schedule.name || scheduleTimeRange(schedule)}`}
                    accessibilityState={{ disabled: phoneLock.active }}
                    disabled={phoneLock.active}
                    onPress={() => beginSchedule(schedule)}
                    style={styles.scheduleMain}
                    pressedStyle={styles.pressed}
                  >
                    <Text style={styles.scheduleName} numberOfLines={1}>
                      {schedule.name || scheduleTimeRange(schedule)}
                    </Text>
                    <Text style={styles.scheduleDetail}>
                      {formatScheduleDays(schedule.days)} · {scheduleTimeRange(schedule)}
                    </Text>
                    <Text style={styles.scheduleDetail}>
                      {schedule.allowedPackageNames.length}/5 allowed apps
                    </Text>
                  </PressableScale>
                  <View style={styles.scheduleActions}>
                    <Switch
                      value={schedule.enabled}
                      disabled={phoneLock.active}
                      onValueChange={() => toggleSchedule(schedule)}
                      accessibilityLabel={`${schedule.name || scheduleTimeRange(schedule)} enabled`}
                      trackColor={{ false: colors.separator, true: colors.accentMuted }}
                      thumbColor={schedule.enabled ? colors.accent : colors.labelTertiary}
                    />
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${schedule.name || scheduleTimeRange(schedule)}`}
                      accessibilityState={{ disabled: phoneLock.active }}
                      disabled={phoneLock.active}
                      onPress={() => deleteSchedule(schedule)}
                      style={styles.deleteSchedule}
                      pressedStyle={styles.pressed}
                    >
                      <Text style={styles.deleteScheduleText}>Delete</Text>
                    </PressableScale>
                  </View>
                </View>
                {index < schedules.length - 1 ? <View style={styles.separator} /> : null}
              </View>
            ))}
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Timed blocks</Text>
          {blockedApps.length > 0 ? <Text style={styles.sectionCount}>{blockedApps.length}</Text> : null}
        </View>

        {blockedApps.length === 0 ? (
          <EmptyState
            illustration="shield"
            title="No timed blocks"
            subtitle="Choose a distraction and give your attention some room."
            actionLabel={permissions.coreReady ? 'Block an app' : undefined}
            onAction={permissions.coreReady ? beginBlock : undefined}
          />
        ) : (
          <>
            <View style={styles.list}>
              {blockedApps.map((app, index) => (
                <View key={app.packageName}>
                  <View style={styles.row}>
                    {app.iconBase64 ? (
                      <Image source={{ uri: `data:image/png;base64,${app.iconBase64}` }} style={styles.icon} />
                    ) : <View style={styles.iconPlaceholder} />}
                    <View style={styles.rowCopy}>
                      <Text style={styles.appName} numberOfLines={1}>{app.appName}</Text>
                      <Text style={styles.remaining}>{formatTimeRemaining(app.blockUntil!)}</Text>
                    </View>
                  </View>
                  {index < blockedApps.length - 1 ? <View style={styles.separator} /> : null}
                </View>
              ))}
            </View>
            <PressableScale
              containerStyle={styles.fullWidth}
              accessibilityRole="button"
              onPress={beginBlock}
              style={styles.addButton}
              pressedStyle={styles.pressed}
            >
              <PlusIcon size={18} color={colors.accent} />
              <Text style={styles.addText}>Add timed block</Text>
            </PressableScale>
          </>
        )}
      </View>
      <PhoneLockTimerSheet
        visible={showPhoneLockSheet}
        onConfirm={confirmPhoneLock}
        onDismiss={() => setShowPhoneLockSheet(false)}
      />
      <PhoneLockScheduleSheet
        visible={showScheduleSheet}
        schedule={editingSchedule}
        schedules={schedules}
        onSave={saveSchedule}
        onDismiss={() => {
          setShowScheduleSheet(false);
          setEditingSchedule(null);
        }}
      />
    </ScrollView>
  );
};

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 120, alignItems: 'center' },
  maxWidth: { width: '100%', maxWidth: 680 },
  brand: { ...Type.footnoteStrong, color: colors.accent, letterSpacing: 1.2 },
  largeTitle: { ...Type.largeTitle, color: colors.label, marginTop: 2 },
  setupCard: { marginTop: Spacing.xl, padding: Spacing.lg, borderRadius: Radius.lg, backgroundColor: colors.accentMuted, flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  setupCopy: { flex: 1 },
  setupTitle: { ...Type.bodyStrong, color: colors.label },
  setupBody: { ...Type.footnote, color: colors.labelSecondary, marginTop: 3 },
  setupAction: { width: 48, minHeight: 48, borderRadius: Radius.pill, alignItems: 'center', backgroundColor: colors.accent },
  metricsWrap: { marginTop: Spacing.xl },
  sectionHeader: { marginTop: Spacing.xxl, marginBottom: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionTitle: { ...Type.title, color: colors.label },
  sectionCount: { ...Type.footnoteStrong, color: colors.accent, backgroundColor: colors.accentMuted, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill },
  phoneLock: { borderRadius: Radius.lg, backgroundColor: colors.surface, padding: Spacing.xl },
  phoneLockActive: { backgroundColor: colors.accentMuted, borderWidth: 1, borderColor: colors.accent },
  phoneLockKicker: { ...Type.footnoteStrong, color: colors.accent, letterSpacing: 0.9 },
  phoneLockTitle: { ...Type.title, color: colors.label, marginTop: Spacing.sm },
  phoneLockCountdown: { fontSize: 38, lineHeight: 44, fontWeight: '700', letterSpacing: -0.6, color: colors.label, marginTop: Spacing.sm },
  phoneLockBody: { ...Type.body, color: colors.labelSecondary, marginTop: Spacing.sm, maxWidth: 520 },
  phoneLockEnd: { ...Type.footnote, color: colors.labelSecondary, marginTop: Spacing.xs },
  phoneLockAction: { alignSelf: 'flex-start', minHeight: 50, marginTop: Spacing.xl, paddingHorizontal: Spacing.lg, borderRadius: Radius.pill, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  phoneLockActionPressed: { backgroundColor: colors.accent },
  phoneLockActionText: { ...Type.bodyStrong, color: colors.onAccent },
  scheduleAdd: {
    minHeight: 40,
    marginLeft: 'auto',
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: colors.accentMuted,
  },
  scheduleAddText: { ...Type.footnoteStrong, color: colors.accent },
  scheduleAddTextDisabled: { color: colors.labelTertiary },
  schedulePermission: {
    minHeight: 72,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: colors.accentMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  schedulePermissionCopy: { flex: 1 },
  schedulePermissionTitle: { ...Type.bodyStrong, color: colors.label },
  schedulePermissionBody: {
    ...Type.footnote,
    color: colors.labelSecondary,
    marginTop: 2,
  },
  scheduleEmpty: {
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
  },
  scheduleEmptyTitle: { ...Type.bodyStrong, color: colors.label },
  scheduleEmptyBody: { ...Type.footnote, color: colors.labelSecondary, marginTop: 3 },
  scheduleList: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  scheduleRow: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingRight: Spacing.md,
  },
  scheduleMainContainer: { flex: 1, alignSelf: 'stretch' },
  scheduleMain: {
    flex: 1,
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 0,
  },
  scheduleName: { ...Type.bodyStrong, color: colors.label },
  scheduleDetail: { ...Type.footnote, color: colors.labelSecondary, marginTop: 2 },
  scheduleActions: { alignItems: 'center', gap: 2 },
  deleteSchedule: {
    minHeight: 36,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
  },
  deleteScheduleText: { ...Type.footnoteStrong, color: colors.danger },
  list: { backgroundColor: colors.surface, borderRadius: Radius.lg, overflow: 'hidden' },
  row: { minHeight: 72, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center' },
  icon: { width: 44, height: 44, borderRadius: 11, marginRight: Spacing.md },
  iconPlaceholder: { width: 44, height: 44, borderRadius: 11, marginRight: Spacing.md, backgroundColor: colors.surfacePressed },
  rowCopy: { flex: 1 },
  appName: { ...Type.bodyStrong, color: colors.label },
  remaining: { ...Type.footnote, color: colors.accent, marginTop: 2 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: 72 },
  fullWidth: { width: '100%' },
  addButton: { marginTop: Spacing.md, borderRadius: Radius.pill, borderWidth: 1, borderColor: colors.separator, backgroundColor: colors.surface, alignItems: 'center', flexDirection: 'row', gap: Spacing.sm },
  addText: { ...Type.bodyStrong, color: colors.accent },
  pressed: { backgroundColor: colors.surfacePressed },
});
