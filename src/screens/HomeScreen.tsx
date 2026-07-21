import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Palette } from '../colors';
import { Radius, Spacing, Type } from '../colors';
import { EmptyState } from '../components/EmptyState';
import { HomeMetrics } from '../components/HomeMetrics';
import { PressableScale } from '../components/PressableScale';
import { ChevronRightIcon, PlusIcon } from '../components/icons';
import { PhoneLockTimerSheet } from '../components/PhoneLockTimerSheet';
import { usePermissions } from '../hooks/usePermissions';
import { formatPhoneLockCountdown, formatPhoneLockDuration } from '../domain';
import {
  AppBlocker,
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
};

export const HomeScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const permissions = usePermissions();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [blockedApps, setBlockedApps] = useState<BlockedApp[]>([]);
  const [stats, setStats] = useState({ totalAttempts: 0, todayAttempts: 0 });
  const [phoneLock, setPhoneLock] = useState<PhoneLockState>(emptyPhoneLock);
  const [showPhoneLockSheet, setShowPhoneLockSheet] = useState(false);
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
    } catch {
      setPhoneLock(emptyPhoneLock);
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

  const confirmPhoneLock = (durationMs: number) => {
    setShowPhoneLockSheet(false);
    const durationLabel = formatPhoneLockDuration(durationMs);
    const endsAt = new Date(Date.now() + durationMs).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
    Alert.alert(
      `Lock phone for ${durationLabel}?`,
      `Ends at ${endsAt}. You get three 2-minute passes, and Phone stays available. This cannot be stopped early.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start lock',
          onPress: () => {
            try {
              AppBlocker.startPhoneLock(durationMs);
            } catch {
              Alert.alert('Could not start phone lock', 'Check blocking permissions and rebuild the native app.');
            }
          },
        },
      ]
    );
  };

  const now = Date.now();
  const passActive = phoneLock.passEndsAt != null && phoneLock.passEndsAt > now;

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
              <Text style={styles.phoneLockKicker}>{passActive ? '2-MINUTE PASS' : 'PHONE LOCKED'}</Text>
              <Text style={styles.phoneLockCountdown}>
                {formatPhoneLockCountdown(passActive ? phoneLock.passEndsAt : phoneLock.endsAt, now)}
              </Text>
              <Text style={styles.phoneLockBody}>
                {passActive
                  ? `Full phone available now · ${phoneLock.passesRemaining} pass${phoneLock.passesRemaining === 1 ? '' : 'es'} left`
                  : `Phone stays available · ${phoneLock.passesRemaining} pass${phoneLock.passesRemaining === 1 ? '' : 'es'} left`}
              </Text>
              {passActive ? (
                <Text style={styles.phoneLockEnd}>
                  Phone lock ends in {formatPhoneLockCountdown(phoneLock.endsAt, now)}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.phoneLockKicker}>DEEP FOCUS</Text>
              <Text style={styles.phoneLockTitle}>Lock your phone</Text>
              <Text style={styles.phoneLockBody}>Only Phone and three 2-minute passes stay available.</Text>
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
